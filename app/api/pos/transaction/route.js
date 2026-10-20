import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { calculateDeposits, createContainerIssues, createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { createNotification } from "@/lib/server/services/notifications";
import { prisma } from "@/lib/prisma";

function startOfPhnomPenhDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
}
import { getVariantConversionFactor, resolveBaseVariant } from "@/lib/server/services/inventory-units";

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

// Official human Sale ID (e.g. SALE-20260909-015) — sequential per day and
// independent from the internal cuid. Order IDs (ORD-...) are a separate system.
async function generateReceiptNumber(tx) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `SALE-${datePart}-`;

  const start = (await tx.sale.count({ where: { receiptNumber: { startsWith: prefix } } })) + 1;
  for (let i = start; i < start + 100; i += 1) {
    const candidate = `${prefix}${String(i).padStart(3, "0")}`;
    const existing = await tx.sale.findUnique({ where: { receiptNumber: candidate } });
    if (!existing) {
      return candidate;
    }
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return fail("Transaction requires at least one item.", 422);
    }

    if (body.id) {
      const existing = await prisma.sale.findUnique({
        where: { id: String(body.id) },
      });
      if (existing) {
        return ok({
          data: {
            id: existing.id,
            receiptNumber: existing.receiptNumber,
            synced: true,
            message: "Transaction already processed",
          },
        });
      }
    }

    // Resolve shift if open (optional for fast checkout)
    const activeShift = await prisma.shift.findFirst({
      where: { cashierId: user.id, status: "OPEN" },
    });
    const shiftId = activeShift?.id || null;

    // Resolve branchId
    let branchId = body.branchId || user.branchId;
    if (!branchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { code: "HQ" },
      });
      branchId = defaultBranch?.id;
    }

    if (!branchId) {
      const anyBranch = await prisma.branch.findFirst();
      branchId = anyBranch?.id;
    }

    if (!branchId) {
      return fail("Store branch must be configured.", 422);
    }

    // Resolve variants — match by variantId OR productId
    const rawVariantIds = [...new Set(items.map((item) => item.variantId).filter(Boolean))];
    const rawProductIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];

    const variants = await prisma.productVariant.findMany({
      where: {
        OR: [
          { id: { in: rawVariantIds } },
          { productId: { in: rawProductIds } },
        ],
        isActive: true,
      },
      include: {
        product: true,
        unit: true,
      },
    });

    const variantById = new Map(variants.map((v) => [v.id, v]));
    const variantByProductId = new Map(variants.map((v) => [v.productId, v]));

    const transactionPriceType = String(body.priceType || "").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL";

    // Resolve every item to a concrete ProductVariant (auto-create default variant if missing)
    const resolvedItems = [];
    for (const item of items) {
      let variant = (item.variantId && variantById.get(item.variantId)) || (item.productId && variantByProductId.get(item.productId));

      if (!variant) {
        // Check if product exists in DB
        let product = item.productId
          ? await prisma.product.findUnique({ where: { id: item.productId } })
          : null;

        if (!product) {
          // Auto-create product for POS item
          const pId = item.productId || `prod-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
          product = await prisma.product.upsert({
            where: { id: pId },
            update: {},
            create: {
              id: pId,
              name: item.name || "Product",
              sku: item.sku || `SKU-${Date.now().toString().slice(-6)}`,
              price: Number(item.price || 0),
              stock: 100,
              isActive: true,
              category: "General",
            },
          });
        }

        // Auto-create default variant for this product
        variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: item.variantName || "Default",
            sku: item.sku || product.sku || `SKU-${product.id.slice(-6)}`,
            price: Number(item.price || product.price || 0),
            wholesalePrice: Number(item.wholesalePrice || product.wholesalePrice || item.price || product.price || 0),
            isActive: true,
          },
          include: { product: true, unit: true },
        });

        variantById.set(variant.id, variant);
        variantByProductId.set(product.id, variant);
      }

      const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
      
      const isPriceOverridden = Boolean(item.isOverridden || item.isPriceOverridden);
      let expectedPrice = Number(variant.price);
      if (transactionPriceType === "WHOLESALE") {
        expectedPrice = variant.wholesalePrice !== null && variant.wholesalePrice !== undefined
          ? Number(variant.wholesalePrice)
          : Number(variant.price);
      }

      // If price was explicitly overridden by cashier, honor it; otherwise enforce expected price
      const unitPrice = isPriceOverridden && item.price !== undefined && !isNaN(Number(item.price)) && Number(item.price) >= 0
        ? Number(item.price)
        : expectedPrice;

      resolvedItems.push({
        variant,
        quantity,
        unitPrice,
        note: item.note || null,
      });
    }

    const normalizedItems = resolvedItems;
    const totalMoney = toMoney(body.total);
    const paymentMethodName = body.paymentMethod || "Cash";

    // 1. Resolve Payment Method before transaction
    const pm = await prisma.paymentMethod.findFirst({
      where: { name: { equals: paymentMethodName, mode: "insensitive" } },
    });

    // 2. Pre-calculate deposits before transaction
    const { totalDeposit, itemsList: depositItems } = await calculateDeposits(prisma, normalizedItems.map(item => ({
      productId: item.variant.productId,
      quantity: item.quantity,
    })));

    // 3. Resolve Sale Receipt Number (match POS client Sale ID)
    let assignedReceiptNumber = body.receiptNumber;
    if (assignedReceiptNumber) {
      const existingReceipt = await prisma.sale.findUnique({ where: { receiptNumber: assignedReceiptNumber } });
      if (existingReceipt && existingReceipt.id !== body.id) {
        assignedReceiptNumber = await generateReceiptNumber(prisma);
      }
    } else {
      assignedReceiptNumber = await generateReceiptNumber(prisma);
    }

    const sale = await prisma.$transaction(async (tx) => {
      // 1. Resolve Customer & Credit Checks if using credit payment
      let customerId = body.customerId || null;
      
      if (paymentMethodName.toLowerCase() === "customer credit") {
        if (!customerId) {
          throw new Error("CUSTOMER_REQUIRED_FOR_CREDIT");
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const limit = Number(customer.creditLimit || 0);
        const currentBalance = Number(customer.creditBalance || 0);

        if (currentBalance + totalMoney > limit) {
          throw new Error("CREDIT_LIMIT_EXCEEDED");
        }

        // Charge customer credit
        await tx.customer.update({
          where: { id: customerId },
          data: {
            creditBalance: { increment: totalMoney },
          },
        });

        // Log customer credit log
        await tx.customerCredit.create({
          data: {
            customerId,
            branchId,
            type: "CHARGE",
            amount: totalMoney,
            balance: currentBalance + totalMoney,
            note: `POS Sale charge`,
          },
        });
      }

      // 2. Create the POS Sale record — items reference variantId
      const created = await tx.sale.create({
        data: {
          ...(body.id ? { id: String(body.id) } : {}),
          receiptNumber: assignedReceiptNumber,
          channel: "POS",
          branchId,
          cashierUserId: user.id,
          cashierName: body.cashierName || user.name || user.email,
          customerId,
          shiftId,
          subtotal: toMoney(body.subtotal),
          discount: toMoney(body.discount),
          tax: toMoney(body.tax),
          total: totalMoney,
          currency: body.currency || "USD",
          synced: true,
          items: {
            create: normalizedItems.map((item) => ({
              variantId: item.variant.id,
              name: item.variant.product.name,
              sku: item.variant.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: Number((item.unitPrice * item.quantity).toFixed(2)),
              note: item.note,
            })),
          },
          payments: {
            create: {
              method: paymentMethodName,
              paymentMethodId: pm?.id || null,
              branchId,
              amount: totalMoney,
              baseAmount: totalMoney,
              currency: body.currency || "USD",
              reference: body.reference || null,
            },
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      // 3. Log container issues if customer is associated
      if (customerId && depositItems.length > 0) {
        await createContainerIssues(tx, {
          customerId,
          branchId,
          saleId: created.id,
          itemsList: depositItems,
        });
      }

      // 4. Update branch inventory and create logs with unit conversion factor
      for (const item of normalizedItems) {
        const factor = getVariantConversionFactor(item.variant);
        const baseVariant = await resolveBaseVariant(tx, item.variant, item.variant.productId);
        const targetVariantId = baseVariant ? baseVariant.id : item.variant.id;
        const totalDeductUnits = Math.max(1, Math.round(item.quantity * factor));

        const trackedBatches = await tx.inventoryBatch.findMany({
          where: { variantId: targetVariantId, branchId, isActive: true },
          orderBy: [{ expiryDate: "asc" }, { receivedDate: "asc" }],
        });
        if (trackedBatches.length) {
          const todayStart = startOfPhnomPenhDay();
          const eligibleBatches = trackedBatches.filter((batch) => !batch.expiryDate || batch.expiryDate >= todayStart);
          const eligibleQty = eligibleBatches.reduce((sum, batch) => sum + Math.max(0, batch.remainingQty), 0);
          if (eligibleQty < totalDeductUnits) throw new Error("INSUFFICIENT_EXPIRY_BATCH_STOCK");

          let batchRemaining = totalDeductUnits;
          for (const batch of eligibleBatches) {
            if (!batchRemaining) break;
            if (batch.remainingQty <= 0) continue;
            const deductQty = Math.min(batch.remainingQty, batchRemaining);
            const changed = await tx.inventoryBatch.updateMany({
              where: { id: batch.id, remainingQty: { gte: deductQty } },
              data: { remainingQty: { decrement: deductQty } },
            });
            if (changed.count !== 1) throw new Error("INSUFFICIENT_EXPIRY_BATCH_STOCK");
            await createInventoryMovement(tx, {
              variantId: targetVariantId,
              branchId,
              batchId: batch.id,
              type: "STOCK_OUT",
              channel: "POS",
              quantity: deductQty,
              previousStock: batch.remainingQty,
              nextStock: batch.remainingQty - deductQty,
              note: "POS FEFO batch sale",
              userId: user?.id || null,
            });
            batchRemaining -= deductQty;
          }
        }

        const inv = await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: targetVariantId,
              branchId,
            },
          },
          update: {
            quantity: { decrement: totalDeductUnits },
            availableQuantity: { decrement: totalDeductUnits },
          },
          create: {
            variantId: targetVariantId,
            branchId,
            quantity: Math.max(0, 100 - totalDeductUnits),
            reservedQuantity: 0,
            availableQuantity: Math.max(0, 100 - totalDeductUnits),
          },
        });

        // Decrement Product stock if product ID exists (product stock is kept in base units)
        if (item.variant.productId) {
          await tx.product.updateMany({
            where: { id: item.variant.productId },
            data: { stock: { decrement: totalDeductUnits } },
          });
        }

        const availBefore = (inv ? inv.availableQuantity : 100) + totalDeductUnits;
        const availAfter = inv ? inv.availableQuantity : Math.max(0, 100 - totalDeductUnits);

        await createInventoryMovement(tx, {
          variantId: targetVariantId,
          branchId,
          saleId: created.id,
          type: "SALE",
          channel: "POS",
          quantity: totalDeductUnits,
          previousStock: Number(availBefore),
          nextStock: Number(availAfter),
          note: factor > 1
            ? `POS sale (${item.quantity} x factor ${factor} = ${totalDeductUnits} base units)`
            : "POS sale",
          userId: user?.id || null,
        });
      }

      await createAuditLog(tx, {
        userId: user?.id || null,
        action: "CREATE",
        module: "sales",
        recordId: created.id,
        newValue: {
          channel: "POS",
          total: Number(created.total),
          itemCount: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
          paymentMethod: paymentMethodName,
          branchId,
        },
      });

      return created;
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    // Post-transaction: notify branch cashiers about this POS sale (best-effort)
    try {
      if (branchId) {
        const itemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
        await createNotification(prisma, {
          branchId,
          userId: user.id,
          type: "ORDER_PLACED",
          title: "POS Sale Completed",
          message: `Sale ${sale.receiptNumber} — ${itemCount} item${itemCount === 1 ? "" : "s"} · $${Number(sale.total).toFixed(2)} via ${paymentMethodName}`,
          data: { saleId: sale.id, receiptNumber: sale.receiptNumber, channel: "POS" },
        });
      }
    } catch {
      // Never block sale on notification failure
    }

    return ok({
      data: {
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        synced: true,
      },
    });
  } catch (error) {
    if (error?.message === "INSUFFICIENT_STOCK") {
      return fail("One or more products no longer have enough stock.", 409);
    }
    if (error?.message === "INSUFFICIENT_EXPIRY_BATCH_STOCK") {
      return fail("Available unexpired batch stock is not enough. Expired stock cannot be sold.", 409);
    }
    if (error?.message === "CUSTOMER_REQUIRED_FOR_CREDIT") {
      return fail("A customer profile is required for credit transactions.", 422);
    }
    if (error?.message === "CUSTOMER_NOT_FOUND") {
      return fail("Linked customer account was not found.", 404);
    }
    if (error?.message === "CREDIT_LIMIT_EXCEEDED") {
      return fail("Customer credit limit exceeded.", 409);
    }

    if (error?.code === "P2002") {
      return ok({
        data: {
          synced: true,
        },
      });
    }

    return handleRouteError(error, "Unable to sync POS transaction.");
  }
}

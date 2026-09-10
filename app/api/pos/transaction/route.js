import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { calculateDeposits, createContainerIssues, createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

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
      },
    });

    const variantById = new Map(variants.map((v) => [v.id, v]));
    const variantByProductId = new Map(variants.map((v) => [v.productId, v]));

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
            stock: Number(product.stock || 100),
            isActive: true,
          },
          include: { product: true },
        });

        variantById.set(variant.id, variant);
        variantByProductId.set(product.id, variant);
      }

      const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
      const unitPrice = item.price !== undefined && !isNaN(Number(item.price)) && Number(item.price) >= 0
        ? Number(item.price)
        : Number(variant.price);

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

      // 2. Resolve Payment Method
      const pm = await tx.paymentMethod.findFirst({
        where: { name: { equals: paymentMethodName, mode: "insensitive" } },
      });

      // 2.5 Calculate deposits — uses productId from variant.productId
      const { totalDeposit, itemsList: depositItems } = await calculateDeposits(tx, normalizedItems.map(item => ({
        productId: item.variant.productId,
        quantity: item.quantity,
      })));

      // 2.6 Resolve Sale Receipt Number (match POS client Sale ID)
      let assignedReceiptNumber = body.receiptNumber;
      if (assignedReceiptNumber) {
        const existingReceipt = await tx.sale.findUnique({ where: { receiptNumber: assignedReceiptNumber } });
        if (existingReceipt && existingReceipt.id !== body.id) {
          assignedReceiptNumber = await generateReceiptNumber(tx);
        }
      } else {
        assignedReceiptNumber = await generateReceiptNumber(tx);
      }

      // 3. Create the POS Sale record — items now reference variantId
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

      // 3.5 Log container issues if customer is associated
      if (customerId && depositItems.length > 0) {
        await createContainerIssues(tx, {
          customerId,
          branchId,
          saleId: created.id,
          itemsList: depositItems,
        });
      }

      // 4. Update branch inventory and create logs
      for (const item of normalizedItems) {
        const inv = await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: item.variant.id,
              branchId,
            },
          },
          update: {
            quantity: { decrement: item.quantity },
            availableQuantity: { decrement: item.quantity },
          },
          create: {
            variantId: item.variant.id,
            branchId,
            quantity: Math.max(0, (Number(item.variant.stock) || 100) - item.quantity),
            reservedQuantity: 0,
            availableQuantity: Math.max(0, (Number(item.variant.stock) || 100) - item.quantity),
          },
        });

        // Also decrement ProductVariant and Product stock
        await tx.productVariant.updateMany({
          where: { id: item.variant.id },
          data: { stock: { decrement: item.quantity } },
        });
        if (item.variant.productId) {
          await tx.product.updateMany({
            where: { id: item.variant.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        const availBefore = (inv ? inv.availableQuantity : (Number(item.variant.stock) || 0)) + item.quantity;
        const availAfter = inv ? inv.availableQuantity : Math.max(0, (Number(item.variant.stock) || 100) - item.quantity);

        await createInventoryMovement(tx, {
          variantId: item.variant.id,
          branchId,
          saleId: created.id,
          type: "SALE",
          channel: "POS",
          quantity: item.quantity,
          previousStock: Number(availBefore),
          nextStock: Number(availAfter),
          note: "POS sale",
          userId: user.id,
        });
      }

      await createAuditLog(tx, {
        userId: user.id,
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
    });

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

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

    // Verify shift check-in for cashiers
    const activeShift = await prisma.shift.findFirst({
      where: { cashierId: user.id, status: "OPEN" },
    });
    if (user.role === "CASHIER" && !activeShift) {
      return fail("A cash drawer shift must be opened before processing sales.", 403);
    }
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
      return fail("Store branch must be configured.", 422);
    }

// Resolve variants — items must reference variantId for variant products
    const variantIds = [...new Set(items.map((item) => item.variantId || item.productId).filter(Boolean))];

    // Check for items missing variantId when product has variants
    const productOnlyIds = [...new Set(items.filter((item) => !item.variantId && item.productId).map((item) => item.productId))];
    if (productOnlyIds.length > 0) {
      const productsWithVariants = await prisma.product.count({
        where: { id: { in: productOnlyIds }, isVariant: true },
      });
      if (productsWithVariants > 0) {
        return fail("Variant selection is required for products with multiple options.", 422);
      }
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
      },
      include: {
        product: true,
      },
    });

    if (variants.length !== variantIds.length) {
      return fail("One or more products are unavailable.", 422);
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const normalizedItems = items.map((item) => {
      const variantId = item.variantId || item.productId;
      const variant = variantMap.get(variantId);
      if (!variant) {
        throw new Error(`Variant not found: ${variantId}`);
      }
      const quantity = Number(item.qty || item.quantity || 0);

      return {
        variant,
        quantity,
        note: item.note || null,
      };
    });

    if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return fail("Invalid item quantity.", 422);
    }

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

      // 3. Create the POS Sale record — items now reference variantId
      const created = await tx.sale.create({
        data: {
          ...(body.id ? { id: String(body.id) } : {}),
          receiptNumber: await generateReceiptNumber(tx),
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
              unitPrice: Number(item.variant.price),
              lineTotal: Number((Number(item.variant.price) * item.quantity).toFixed(2)),
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
        // Ensure inventory record exists for the branch (initialize to 0 if not present)
        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: item.variant.id,
              branchId,
            },
          },
          update: {},
          create: {
            variantId: item.variant.id,
            branchId,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
          },
        });

        // POS sales: atomically check availableQuantity >= item.quantity AND deduct
        // Using updateMany with gte condition on availableQuantity prevents race conditions
        const deductResult = await tx.inventory.updateMany({
          where: {
            variantId: item.variant.id,
            branchId,
            availableQuantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
            availableQuantity: { decrement: item.quantity },
          },
        });

        if (deductResult.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            variantId_branchId: {
              variantId: item.variant.id,
              branchId,
            },
          },
        });

        const availBefore = updatedInventory ? (updatedInventory.availableQuantity + item.quantity) : 0;

        await createInventoryMovement(tx, {
          variantId: item.variant.id,
          branchId,
          saleId: created.id,
          type: "SALE",
          channel: "POS",
          quantity: item.quantity,
          previousStock: availBefore,
          nextStock: Number(updatedInventory.availableQuantity),
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

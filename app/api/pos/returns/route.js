import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createInventoryMovement } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasPermission(user, "pos:sales") && !hasPermission(user, "pos:returns"))) {
      return fail("Unauthorized.", 403);
    }

    const body = await request.json();
    const { saleId, returns, refundMethod } = body;
    const returnItems = Array.isArray(returns) ? returns : [];

    if (!saleId || !returnItems.length || !refundMethod) {
      return fail("Sale ID, returns array, and refund method are required.", 422);
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: true,
          customer: true,
        },
      });

      if (!sale) {
        throw new Error("SALE_NOT_FOUND");
      }

      const branchId = sale.branchId;
      const refundAmount = returnItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

      // 1. Create the Return record — variantId, totalAmount
      const returnRecord = await tx.return.create({
        data: {
          saleId,
          cashierId: user.id,
          totalAmount: refundAmount,
          items: {
            create: returnItems.map((item) => ({
              variantId: item.variantId || item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      // 2. Create the Refund record
      await tx.refund.create({
        data: {
          returnId: returnRecord.id,
          paymentMethod: refundMethod,
          amount: refundAmount,
        },
      });

      // 3. Sync branch inventory & log movement
      for (const item of returnItems) {
        const variantId = item.variantId || item.productId;

        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId,
              branchId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
          },
          create: {
            variantId,
            branchId,
            quantity: item.quantity,
          },
        });

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            variantId_branchId: {
              variantId,
              branchId,
            },
          },
        });

        await createInventoryMovement(tx, {
          variantId,
          branchId,
          saleId: sale.id,
          type: "STOCK_IN",
          channel: "POS",
          quantity: item.quantity,
          previousStock: Number(updatedInventory.quantity) - item.quantity,
          nextStock: Number(updatedInventory.quantity),
          note: `Returned from sale: ${sale.id}`,
          userId: user.id,
        });

        // 4. Reverse container deposits if a customer is linked
        if (sale.customerId) {
          // Find productId through the variant
          const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
          });
          const productId = variant?.productId;

          if (productId) {
            const productDeposits = await tx.productDeposit.findMany({
              where: { productId },
            });

            for (const dep of productDeposits) {
              const containerReturnQty = item.quantity * dep.quantity;
              
              // Log empty container return transaction
              await tx.containerTransaction.create({
                data: {
                  customerId: sale.customerId,
                  depositTypeId: dep.depositTypeId,
                  branchId,
                  saleId: sale.id,
                  type: "RETURN",
                  quantity: containerReturnQty,
                },
              });
            }
          }
        }
      }

      // 5. If refund is credited back to wholesale balance
      if (refundMethod.toLowerCase() === "customer credit" && sale.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customerId },
        });

        if (customer) {
          const nextBalance = Number(customer.creditBalance) - refundAmount;

          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              creditBalance: nextBalance,
            },
          });

          // Log customer credit refund payoff
          await tx.customerCredit.create({
            data: {
              customerId: sale.customerId,
              branchId,
              saleId,
              type: "PAYMENT",
              amount: refundAmount,
              balance: Math.max(nextBalance, 0),
              note: `Deduction from POS returned sale refund`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          module: "sales",
          recordId: saleId,
          newValue: {
            returnedId: returnRecord.id,
            refundAmount,
            refundMethod,
          },
        },
      });

      return returnRecord;
    });

    return ok({ data: result });
  } catch (error) {
    if (error.message === "SALE_NOT_FOUND") {
      return fail("Original sale record not found.", 404);
    }
    return handleRouteError(error, "Unable to process POS return.");
  }
}

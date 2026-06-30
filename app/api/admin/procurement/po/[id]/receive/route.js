import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createInventoryMovement } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!po) {
        throw new Error("PO_NOT_FOUND");
      }

      if (po.status === "RECEIVED") {
        throw new Error("PO_ALREADY_RECEIVED");
      }

      if (po.status === "CANCELLED") {
        throw new Error("PO_CANCELLED");
      }

      // 1. Update PO Status
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
      });

      // 2. Log Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          grNumber: `GR-${Date.now()}`,
          purchaseOrderId: id,
          branchId: po.branchId,
          receivedById: user.id,
          status: "COMPLETED",
          items: {
            create: po.items.map((item) => ({
              variantId: item.variantId,
              orderedQty: item.orderedQty,
              receivedQty: item.orderedQty, // default full receipt for now
              unitCost: item.unitCost,
            })),
          },
        },
      });

      // 3. Receive stock for each item
      for (const item of po.items) {
        // Upsert inventory record for the branch
        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: item.variantId,
              branchId: po.branchId,
            },
          },
          update: {
            quantity: { increment: item.orderedQty },
            availableQuantity: { increment: item.orderedQty },
          },
          create: {
            variantId: item.variantId,
            branchId: po.branchId,
            quantity: item.orderedQty,
            availableQuantity: item.orderedQty,
          },
        });

        // Update receivedQty on PurchaseOrderItem
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            receivedQty: item.orderedQty,
          },
        });

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            variantId_branchId: {
              variantId: item.variantId,
              branchId: po.branchId,
            },
          },
        });

        // Log Stock-in Inventory Movement
        await createInventoryMovement(tx, {
          variantId: item.variantId,
          branchId: po.branchId,
          type: "STOCK_IN",
          channel: "POS",
          quantity: item.orderedQty,
          previousStock: Number(updatedInventory.quantity) - item.orderedQty,
          nextStock: Number(updatedInventory.quantity),
          note: `Received PO: ${po.poNumber}`,
          userId: user.id,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          module: "procurement",
          recordId: id,
          newValue: {
            status: "RECEIVED",
            goodsReceiptId: receipt.id,
          },
        },
      });

      return updatedPo;
    });

    return ok({ data: result });
  } catch (error) {
    if (error.message === "PO_NOT_FOUND") {
      return fail("Purchase order not found.", 404);
    }
    if (error.message === "PO_ALREADY_RECEIVED") {
      return fail("This purchase order has already been received.", 409);
    }
    if (error.message === "PO_CANCELLED") {
      return fail("This purchase order has been cancelled.", 409);
    }
    return handleRouteError(error, "Unable to fulfill purchase order.");
  }
}

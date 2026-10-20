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
    const body = await request.json().catch(() => ({}));
    const requestedItems = Array.isArray(body.items) ? body.items : [];

    if (requestedItems.length === 0) {
      return fail("Expiry information is required for every received purchase order item.", 422);
    }

    const expiryByItem = new Map();
    for (const entry of requestedItems) {
      if (!entry?.purchaseOrderItemId || expiryByItem.has(entry.purchaseOrderItemId)) {
        return fail("Invalid or duplicate purchase order item expiry data.", 422);
      }
      if (entry.noExpiry) {
        expiryByItem.set(entry.purchaseOrderItemId, null);
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiryDate || "")) {
        return fail("Enter a valid expiry date or explicitly mark the item as having no printed expiry date.", 422);
      }
      const [year, month, day] = entry.expiryDate.split("-").map(Number);
      const calendarCheck = new Date(Date.UTC(year, month - 1, day));
      if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) {
        return fail("One or more expiry dates are invalid.", 422);
      }
      const expiryDate = new Date(`${entry.expiryDate}T00:00:00+07:00`);
      expiryByItem.set(entry.purchaseOrderItemId, expiryDate);
    }

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

      if (po.items.length !== requestedItems.length || po.items.some((item) => !expiryByItem.has(item.id))) {
        throw new Error("EXPIRY_ITEMS_MISMATCH");
      }

      // 1. Update PO Status
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
      });

      // 2. Log Goods Receipt
      const grNumber = `GR-${Date.now()}`;
      const receipt = await tx.goodsReceipt.create({
        data: {
          grNumber,
          purchaseOrderId: id,
          branchId: po.branchId,
          receivedById: user.id,
          status: "COMPLETED",
        },
      });

      // 3. Receive stock for each item
      for (const item of po.items) {
        const expiryDate = expiryByItem.get(item.id);
        const batchNumber = `${grNumber}-${item.id.slice(-6)}`;
        const batch = await tx.inventoryBatch.create({
          data: {
            batchNumber,
            variantId: item.variantId,
            branchId: po.branchId,
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            goodsReceiptId: receipt.id,
            initialQty: item.orderedQty,
            remainingQty: item.orderedQty,
            costPrice: item.unitCost,
            currency: po.currency,
            expiryDate,
          },
        });

        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            variantId: item.variantId,
            batchId: batch.id,
            batchNumber,
            orderedQty: item.orderedQty,
            receivedQty: item.orderedQty,
            unitCost: item.unitCost,
            expiryDate,
            note: expiryDate ? null : "No printed expiry date",
          },
        });
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
          batchId: batch.id,
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
    if (error.message === "EXPIRY_ITEMS_MISMATCH") {
      return fail("Expiry information must be provided for each purchase order item.", 422);
    }
    return handleRouteError(error, "Unable to fulfill purchase order.");
  }
}

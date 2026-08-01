import { fail, handleRouteError, ok } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";

function mapStatus(status) {
  const normalized = String(status || "").toUpperCase();
  return ["PENDING", "CONFIRMED", "PICKING", "PACKING", "READY", "COMPLETED", "CANCELLED", "PROCESSING", "PREPARING", "SHIPPED", "DELIVERED"].includes(
    normalized,
  )
    ? normalized
    : null;
}

async function allocateFefoBatches(tx, { order, userId }) {
  if (order.channel !== "ONLINE" || !order.branchId) {
    return;
  }

  const alreadyAllocated = await tx.inventoryMovement.count({
    where: {
      orderId: order.id,
      type: "STOCK_OUT",
      note: {
        contains: "FEFO picking",
      },
    },
  });

  if (alreadyAllocated > 0) {
    return;
  }

  for (const line of order.items || order.lines || []) {
    let remaining = line.quantity;
    const variantId = line.variantId;
    const batches = await tx.inventoryBatch.findMany({
      where: {
        variantId,
        branchId: order.branchId,
        remainingQty: {
          gt: 0,
        },
      },
      orderBy: [
        {
          expiryDate: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    for (const batch of batches) {
      if (remaining <= 0) {
        break;
      }

      const deductQty = Math.min(batch.remainingQty, remaining);
      const batchUpdate = await tx.inventoryBatch.updateMany({
        where: {
          id: batch.id,
          remainingQty: {
            gte: deductQty,
          },
        },
        data: {
          remainingQty: {
            decrement: deductQty,
          },
        },
      });

      if (batchUpdate.count !== 1) {
        throw new Error("INSUFFICIENT_BATCH_STOCK");
      }

      await createInventoryMovement(tx, {
        variantId,
        branchId: order.branchId,
        batchId: batch.id,
        orderId: order.id,
        type: "STOCK_OUT",
        channel: "ONLINE",
        quantity: deductQty,
        previousStock: batch.remainingQty,
        nextStock: batch.remainingQty - deductQty,
        note: "FEFO picking batch allocation",
        userId,
      });

      remaining -= deductQty;
    }

if (remaining > 0) {
      throw new Error("INSUFFICIENT_BATCH_STOCK");
    }
  }
}

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  const body = await request.json();
  const { id } = await params;
  const nextStatus = body.status !== undefined ? mapStatus(body.status) : undefined;

  if (body.status !== undefined && !nextStatus) {
    return fail("Invalid order status.", 422);
  }

  // ════════════════════════════════════════════════════════════════
  // CLIENT CANCELLATION PATH
  // The order owner can cancel their own pending order.
  // Inventory is restored and a cancellation audit entry is created.
  // ════════════════════════════════════════════════════════════════
  if (user && nextStatus === "CANCELLED" && !canAccessPOS(user.role)) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existing) {
          throw Object.assign(new Error("ORDER_NOT_FOUND"), { code: "P2025" });
        }

        // Only allow cancellation when the order belongs to this user and is in PENDING status
        if (existing.userId !== user.id) {
          throw Object.assign(new Error("FORBIDDEN"), { code: "P2025" });
        }

        if (existing.status !== "PENDING") {
          throw Object.assign(new Error("INVALID_STATUS"), { code: "P2025" });
        }

// Cancel reservations for each item in the order
        if (existing.branchId) {
          for (const line of existing.items || []) {
            if (!line.variantId) continue;

            // Atomically release reservation — decrement reservedQuantity, increment availableQuantity
            // Using updateMany with gte condition on reservedQuantity prevents race conditions
            const releaseResult = await tx.inventory.updateMany({
              where: {
                variantId: line.variantId,
                branchId: existing.branchId,
                reservedQuantity: { gte: line.quantity },
              },
              data: {
                reservedQuantity: { decrement: line.quantity },
                availableQuantity: { increment: line.quantity },
              },
            });

            // Record the inventory movement as a reservation release
            await createInventoryMovement(tx, {
              variantId: line.variantId,
              branchId: existing.branchId,
              orderId: existing.id,
              type: "RESERVATION_RELEASE",
              channel: "ONLINE",
              quantity: line.quantity,
              note: "Order cancelled by customer — reservation released.",
              userId: user.id,
            });
          }
        }

        const next = await tx.order.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: { items: true },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: "STATUS_CHANGE",
          module: "orders",
          recordId: id,
          oldValue: { status: existing.status },
          newValue: { status: "CANCELLED" },
        });

        return next;
      });

      return ok({ data: serializeOrder(updated) });
    } catch (error) {
      if (error?.message === "FORBIDDEN") {
        return fail("You do not have permission to cancel this order.", 403);
      }
      if (error?.message === "INVALID_STATUS") {
        return fail("Order can only be cancelled while status is PENDING.", 422);
      }
      return handleRouteError(error, "Unable to cancel order.", {
        notFoundMessage: "Order not found.",
      });
    }
  }

// ════════════════════════════════════════════════════════════════
  // POS / ADMIN STATUS UPDATE PATH (existing logic preserved)
  // ════════════════════════════════════════════════════════════════
  if (!user || !canAccessPOS(user.role)) {
    return fail("POS access required.", 403);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: {
          id,
        },
        include: {
          items: true,
        },
      });

      if (!existing) {
        throw Object.assign(new Error("ORDER_NOT_FOUND"), { code: "P2025" });
      }

      if (nextStatus === "PICKING" && existing.status !== "PICKING") {
        await allocateFefoBatches(tx, {
          order: existing,
          userId: user.id,
        });
      }

      const next = await tx.order.update({
        where: {
          id,
        },
        data: {
          ...(body.status !== undefined ? { status: nextStatus } : {}),
          ...(body.trackingNumber !== undefined ? { trackingNumber: body.trackingNumber || null } : {}),
          ...(body.trackingCarrier !== undefined ? { trackingCarrier: body.trackingCarrier || null } : {}),
          ...(body.trackingStatus !== undefined ? { trackingStatus: body.trackingStatus || null } : {}),
          ...(body.trackingNumber !== undefined || body.trackingCarrier !== undefined || body.trackingStatus !== undefined
            ? { trackingUpdatedAt: new Date() }
            : {}),
        },
        include: {
          items: true,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: body.status !== undefined && existing.status !== next.status ? "STATUS_CHANGE" : "UPDATE",
        module: "orders",
        recordId: id,
        oldValue: {
          status: existing.status,
          trackingNumber: existing.trackingNumber,
          trackingCarrier: existing.trackingCarrier,
          trackingStatus: existing.trackingStatus,
        },
        newValue: {
          status: next.status,
          trackingNumber: next.trackingNumber,
          trackingCarrier: next.trackingCarrier,
          trackingStatus: next.trackingStatus,
        },
      });

      return next;
    });

    return ok({
      data: serializeOrder(updated),
    });
  } catch (error) {
    if (error?.message === "INSUFFICIENT_BATCH_STOCK") {
      return fail("Not enough batch stock is available for FEFO picking.", 409);
    }

    return handleRouteError(error, "Unable to update order.", {
      notFoundMessage: "Order not found.",
    });
  }
}

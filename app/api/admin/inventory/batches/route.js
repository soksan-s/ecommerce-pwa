import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseExpiryDate(value) {
  if (value == null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day) return undefined;
  return new Date(`${value}T00:00:00+07:00`);
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) return fail("Admin access required.", 403);

    const body = await request.json();
    const variantId = String(body.variantId || "");
    const branchId = String(body.branchId || "");
    const quantity = Number(body.quantity);
    const expiryDate = body.noExpiry ? null : parseExpiryDate(body.expiryDate);
    if (!variantId || !branchId || !Number.isInteger(quantity) || quantity <= 0) return fail("Variant, branch, and a positive whole quantity are required.", 422);
    if (!body.noExpiry && expiryDate === undefined) return fail("Enter a valid expiry date or explicitly mark that there is no printed expiry date.", 422);

    const result = await prisma.$transaction(async (tx) => {
      const [variant, inventory] = await Promise.all([
        tx.productVariant.findUnique({ where: { id: variantId }, include: { product: true } }),
        tx.inventory.findUnique({ where: { variantId_branchId: { variantId, branchId } } }),
      ]);
      if (!variant || !inventory) throw new Error("INVENTORY_NOT_FOUND");

      const tracked = await tx.inventoryBatch.aggregate({
        where: { variantId, branchId, remainingQty: { gt: 0 } },
        _sum: { remainingQty: true },
      });
      const untrackedQty = Math.max(0, inventory.quantity - Number(tracked._sum.remainingQty || 0));
      if (quantity > untrackedQty) throw new Error("TRACKED_QTY_EXCEEDED");

      const batch = await tx.inventoryBatch.create({
        data: {
          batchNumber: String(body.batchNumber || `LEGACY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim().slice(0, 80),
          variantId,
          branchId,
          initialQty: quantity,
          remainingQty: quantity,
          costPrice: Number(variant.costPrice || variant.product.costPrice || 0),
          currency: "USD",
          expiryDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: "CREATE",
          module: "inventory_batch",
          recordId: batch.id,
          newValue: { variantId, branchId, quantity, expiryDate, batchNumber: batch.batchNumber },
        },
      });
      return batch;
    });

    return ok({ data: result });
  } catch (error) {
    if (error.message === "INVENTORY_NOT_FOUND") return fail("Inventory record not found for this branch.", 404);
    if (error.message === "TRACKED_QTY_EXCEEDED") return fail("Quantity exceeds current stock that has no batch record. Refresh and try again.", 409);
    return handleRouteError(error, "Unable to record inventory batch.");
  }
}

import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");

    const where = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            variant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ data: pos });
  } catch (error) {
    return handleRouteError(error, "Unable to load purchase orders.");
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const body = await request.json();
    const { supplierId, branchId, items, note, expectedDate } = body;
    const poItems = Array.isArray(items) ? items : [];

    if (!supplierId || !branchId || !poItems.length) {
      return fail("Supplier, branch, and items are required.", 422);
    }

    let subtotal = 0;
    const mappedItems = poItems.map((item) => {
      const orderedQty = Number(item.quantity);
      const unitCost = Number(item.costPrice);
      const lineTotal = orderedQty * unitCost;
      subtotal += lineTotal;
      return {
        variantId: item.variantId,
        orderedQty,
        unitCost,
        lineTotal,
      };
    });

    const poNumber = `PO-${Date.now()}`;

    const po = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          branchId,
          status: "DRAFT",
          subtotal,
          totalAmount: subtotal, // Assuming no tax/discount initially
          note,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          items: {
            create: mappedItems,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          module: "procurement",
          recordId: created.id,
          newValue: {
            poNumber,
            supplierId,
            branchId,
            totalAmount: subtotal,
            itemCount: poItems.length,
          },
        },
      });

      return created;
    });

    return ok({ data: po });
  } catch (error) {
    return handleRouteError(error, "Unable to create purchase order.");
  }
}

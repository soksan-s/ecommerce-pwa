import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        receipts: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!po) {
      return fail("Purchase order not found.", 404);
    }

    return ok({ data: po });
  } catch (error) {
    return handleRouteError(error, "Unable to load purchase order.");
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { status, note } = body;

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      return fail("Purchase order not found.", 404);
    }

    if (existing.status !== "DRAFT" && status === "DRAFT") {
       return fail("Cannot revert to DRAFT.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      let approvedById = existing.approvedById;
      let approvedAt = existing.approvedAt;
      
      if (status === "APPROVED" && existing.status === "DRAFT") {
        approvedById = user.id;
        approvedAt = new Date();
      }

      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: status || existing.status,
          note: note !== undefined ? note : existing.note,
          approvedById,
          approvedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          module: "procurement",
          recordId: po.id,
          oldValue: { status: existing.status, note: existing.note },
          newValue: { status: po.status, note: po.note },
        },
      });

      return po;
    });

    return ok({ data: updated });
  } catch (error) {
    return handleRouteError(error, "Unable to update purchase order.");
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:procurement")) {
      return fail("Unauthorized.", 403);
    }

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw { code: "P2025" };
      }

      if (existing.status !== "DRAFT") {
        throw new Error("Only DRAFT purchase orders can be deleted.");
      }

      await tx.purchaseOrder.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE",
          module: "procurement",
          recordId: id,
          oldValue: { poNumber: existing.poNumber, totalAmount: existing.totalAmount },
        },
      });
    });

    return ok({ success: true });
  } catch (error) {
    if (error?.message === "Only DRAFT purchase orders can be deleted.") {
       return fail(error.message, 400);
    }
    return handleRouteError(error, "Unable to delete purchase order.");
  }
}

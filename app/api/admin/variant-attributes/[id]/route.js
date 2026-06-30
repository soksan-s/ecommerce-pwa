import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { createAuditLog } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attributeSchema } from "@/lib/validations";

export async function GET(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;

    const attribute = await prisma.variantAttribute.findUnique({
      where: { id },
      include: {
        values: true,
      },
    });

    if (!attribute) {
      return fail("Attribute not found.", 404);
    }

    return NextResponse.json({ data: attribute });
  } catch (error) {
    return handleRouteError(error, "Unable to load attribute.");
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const result = attributeSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid attribute payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.variantAttribute.findUnique({
        where: { id },
      });

      if (!existing) {
        throw { code: "P2025" };
      }

      const attribute = await tx.variantAttribute.update({
        where: { id },
        data: {
          name: result.data.name,
          nameKh: result.data.nameKh || null,
        },
      });

      await createAuditLog(tx, {
        userId: admin.id,
        action: "UPDATE",
        module: "variant-attributes",
        recordId: attribute.id,
        oldValue: existing,
        newValue: attribute,
      });

      return attribute;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleRouteError(error, "Unable to update attribute.", {
      conflictMessage: "Attribute name already exists.",
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.variantAttribute.findUnique({
        where: { id },
      });

      if (!existing) {
        throw { code: "P2025" };
      }

      await tx.variantAttribute.delete({
        where: { id },
      });

      await createAuditLog(tx, {
        userId: admin.id,
        action: "DELETE",
        module: "variant-attributes",
        recordId: id,
        oldValue: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "Unable to delete attribute.");
  }
}

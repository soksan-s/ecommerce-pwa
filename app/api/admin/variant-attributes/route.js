import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { createAuditLog } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attributeSchema } from "@/lib/validations";

export async function GET() {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const attributes = await prisma.variantAttribute.findMany({
      orderBy: { name: "asc" },
      include: {
        values: true,
      },
    });

    return NextResponse.json({ data: attributes });
  } catch (error) {
    return handleRouteError(error, "Unable to load attributes.");
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const body = await request.json();
    const result = attributeSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid attribute payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const attribute = await tx.variantAttribute.create({
        data: {
          name: result.data.name,
          nameKh: result.data.nameKh || null,
        },
      });

      await createAuditLog(tx, {
        userId: admin.id,
        action: "CREATE",
        module: "variant-attributes",
        recordId: attribute.id,
        newValue: attribute,
      });

      return attribute;
    });

    return NextResponse.json({ data: created });
  } catch (error) {
    return handleRouteError(error, "Unable to create attribute.", {
      conflictMessage: "Attribute name already exists.",
    });
  }
}

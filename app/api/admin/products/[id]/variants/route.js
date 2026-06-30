import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { createAuditLog } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { variantSchema } from "@/lib/validations";

export async function GET(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;

    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
      include: {
        unit: true,
        attributeValues: {
          include: {
            attribute: true,
          },
        },
        images: true,
      },
    });

    return NextResponse.json({ data: variants });
  } catch (error) {
    return handleRouteError(error, "Unable to load variants.");
  }
}

export async function POST(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const result = variantSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid variant payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw { code: "P2025" };
      }

      // Check SKU uniqueness
      if (result.data.sku) {
        const existingSku = await tx.productVariant.findUnique({
          where: { sku: result.data.sku },
        });
        if (existingSku) {
          throw new Error("SKU already exists.");
        }
      }

      const variant = await tx.productVariant.create({
        data: {
          productId: id,
          sku: result.data.sku,
          name: result.data.name,
          nameKh: result.data.nameKh || null,
          unitId: result.data.unitId || null,
          price: result.data.price,
          costPrice: result.data.costPrice || null,
          wholesalePrice: result.data.wholesalePrice || null,
          vipPrice: result.data.vipPrice || null,
          discountPercent: result.data.discountPercent || 0,
          weight: result.data.weight || null,
          volume: result.data.volume || null,
          barcode: result.data.barcode || null,
        },
      });

      // Update product to indicate it has variants
      if (!product.isVariant) {
        await tx.product.update({
          where: { id },
          data: { isVariant: true },
        });
      }

      await createAuditLog(tx, {
        userId: admin.id,
        action: "CREATE",
        module: "product-variants",
        recordId: variant.id,
        newValue: variant,
      });

      return variant;
    });

    return NextResponse.json({ data: created });
  } catch (error) {
    if (error?.message === "SKU already exists.") {
      return fail(error.message, 409);
    }
    return handleRouteError(error, "Unable to create variant.", {
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

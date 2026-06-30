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

    const { id, variantId } = await params;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId, productId: id },
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

    if (!variant) {
      return fail("Variant not found.", 404);
    }

    return NextResponse.json({ data: variant });
  } catch (error) {
    return handleRouteError(error, "Unable to load variant.");
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id, variantId } = await params;
    const body = await request.json();
    const result = variantSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid variant payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.productVariant.findUnique({
        where: { id: variantId, productId: id },
      });

      if (!existing) {
        throw { code: "P2025" };
      }
      
      // Check SKU uniqueness if changed
      if (result.data.sku && result.data.sku !== existing.sku) {
        const existingSku = await tx.productVariant.findUnique({
          where: { sku: result.data.sku },
        });
        if (existingSku) {
          throw new Error("SKU already exists.");
        }
      }

      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: {
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

      await createAuditLog(tx, {
        userId: admin.id,
        action: "UPDATE",
        module: "product-variants",
        recordId: variant.id,
        oldValue: existing,
        newValue: variant,
      });

      return variant;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error?.message === "SKU already exists.") {
      return fail(error.message, 409);
    }
    return handleRouteError(error, "Unable to update variant.", {
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id, variantId } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.productVariant.findUnique({
        where: { id: variantId, productId: id },
      });

      if (!existing) {
        throw { code: "P2025" };
      }

      await tx.productVariant.delete({
        where: { id: variantId },
      });

      await createAuditLog(tx, {
        userId: admin.id,
        action: "DELETE",
        module: "product-variants",
        recordId: variantId,
        oldValue: existing,
      });
      
      // Update product to indicate it might not have variants anymore
      const remainingVariants = await tx.productVariant.count({
        where: { productId: id },
      });
      
      if (remainingVariants === 0) {
        await tx.product.update({
          where: { id },
          data: { isVariant: false },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "Unable to delete variant.");
  }
}

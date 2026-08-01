import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { normalizeProduct } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export async function PATCH(request, { params }) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const costPrice = body.costPrice !== undefined ? Number(body.costPrice) : undefined;
    const wholesalePrice = body.wholesalePrice !== undefined ? Number(body.wholesalePrice) : undefined;
    const discountPercent = body.discountPercent !== undefined ? Number(body.discountPercent) : undefined;
    const stock = body.stock !== undefined ? Number(body.stock) : undefined;
    const minStockAlert = body.minStockAlert !== undefined ? Number(body.minStockAlert) : undefined;
    const ratingAvg = body.ratingAvg !== undefined ? Number(body.ratingAvg) : undefined;
    const ratingCount = body.ratingCount !== undefined ? Number(body.ratingCount) : undefined;

    if (
      (price !== undefined && (Number.isNaN(price) || price < 0)) ||
      (costPrice !== undefined && (Number.isNaN(costPrice) || costPrice < 0)) ||
      (wholesalePrice !== undefined && (Number.isNaN(wholesalePrice) || wholesalePrice < 0)) ||
      (discountPercent !== undefined && (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) ||
      (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) ||
      (minStockAlert !== undefined && (!Number.isInteger(minStockAlert) || minStockAlert < 0)) ||
      (ratingAvg !== undefined && (Number.isNaN(ratingAvg) || ratingAvg < 0)) ||
      (ratingCount !== undefined && (!Number.isInteger(ratingCount) || ratingCount < 0))
    ) {
      return fail("Invalid product update payload.", 422);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: {
          id,
        },
      });

      if (!existing) {
        throw Object.assign(new Error("PRODUCT_NOT_FOUND"), { code: "P2025" });
      }

      const product = await tx.product.update({
        where: {
          id,
        },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sku !== undefined ? { sku: body.sku || null } : {}),
          ...(body.barcode !== undefined ? { barcode: body.barcode || null } : {}),
          ...(body.brand !== undefined ? { brand: body.brand || null } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.price !== undefined ? { price } : {}),
          ...(body.costPrice !== undefined ? { costPrice: costPrice || null } : {}),
          ...(body.wholesalePrice !== undefined ? { wholesalePrice: wholesalePrice || null } : {}),
          ...(body.discountPercent !== undefined ? { discountPercent } : {}),
          ...(body.stock !== undefined ? { stock } : {}),
          ...(body.minStockAlert !== undefined ? { minStockAlert } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          ...(body.ratingAvg !== undefined ? { ratingAvg } : {}),
          ...(body.ratingCount !== undefined ? { ratingCount } : {}),
        },
        include: {
          comments: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      });

if (body.stock !== undefined && existing.stock !== product.stock) {
        // For variant products, variantId is required for stock changes
        const stockDiff = product.stock - existing.stock;
        if (product.isVariant && !body.variantId) {
          throw new Error("Variant ID is required for stock changes on variant products.");
        }

        let variantId = body.variantId;

        if (!variantId) {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: product.id },
          });
          variantId = firstVariant?.id || product.id;
        }

        // Sync variant-level inventory for the branch
        const branch = await prisma.branch.findFirst({ where: { code: "HQ" } });
        if (branch && variantId) {
          await tx.inventory.upsert({
            where: {
              variantId_branchId: {
                variantId,
                branchId: branch.id,
              },
            },
            update: {
              quantity: { increment: stockDiff },
              availableQuantity: { increment: stockDiff },
            },
            create: {
              variantId,
              branchId: branch.id,
              quantity: Math.max(stockDiff, 0),
              availableQuantity: Math.max(stockDiff, 0),
            },
          });
        }

        await createInventoryMovement(tx, {
          variantId,
          type: stockDiff > 0 ? "STOCK_IN" : "ADJUSTMENT_DECREASE",
          channel: "ONLINE",
          quantity: Math.abs(stockDiff),
          previousStock: existing.stock,
          nextStock: product.stock,
          note: "Admin product stock update",
          userId: admin.id,
        });
      }

      await createAuditLog(tx, {
        userId: admin.id,
        action: body.stock !== undefined && existing.stock !== product.stock ? "STOCK_CHANGE" : "UPDATE",
        module: "products",
        recordId: product.id,
        oldValue: normalizeProduct(existing),
        newValue: normalizeProduct(product),
      });

      return product;
    });

    return NextResponse.json({
      data: normalizeProduct(updated),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to update product.", {
      notFoundMessage: "Product not found.",
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

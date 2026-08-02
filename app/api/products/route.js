import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { listCatalogProducts, normalizeProduct } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations";

function buildVariantSku(productName, productSku) {
  const base = String(productSku || productName || "PRODUCT")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 32);
  return `${base}-DEFAULT`;
}


export async function GET() {
  return NextResponse.json({
    data: await listCatalogProducts(),
  });
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const body = await request.json();
    const result = productSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid product payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: result.data.name,
          sku: result.data.sku || null,
          barcode: result.data.barcode || null,
          brand: result.data.brand || null,
          category: result.data.category,
          description: result.data.description,
          imageUrl: result.data.imageUrl,
          price: result.data.price,
          costPrice: result.data.costPrice || null,
          wholesalePrice: result.data.wholesalePrice || null,
          discountPercent: result.data.discountPercent,
          stock: result.data.stock,
          minStockAlert: result.data.minStockAlert,
          isActive: result.data.isActive ?? true,
        },
      });

      // Always create a default variant so the product is orderable through the
      // variant-based order API and the storefront never shows an unpurchasable
      // product. All pricing authority lives on the variant.
      const variantSku =
        (result.data.sku && String(result.data.sku).trim()
          ? `${String(result.data.sku).trim()}-DEFAULT`
          : buildVariantSku(result.data.name, result.data.sku)) || `PROD-${product.id}-DEFAULT`;

      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: variantSku,
          name: "Default",
          price: result.data.price,
          costPrice: result.data.costPrice || null,
          wholesalePrice: result.data.wholesalePrice || null,
          discountPercent: result.data.discountPercent,
          isActive: result.data.isActive ?? true,
        },
      });

      // Seed HQ inventory so the storefront stock matches the entered stock.
      const branch = await tx.branch.findFirst({
        where: { code: "HQ" },
      });

      if (branch) {
        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: variant.id,
              branchId: branch.id,
            },
          },
          update: {
            quantity: result.data.stock,
            availableQuantity: result.data.stock,
          },
          create: {
            variantId: variant.id,
            branchId: branch.id,
            quantity: result.data.stock,
            availableQuantity: result.data.stock,
          },
        });

        if (result.data.stock > 0) {
          await createInventoryMovement(tx, {
            variantId: variant.id,
            branchId: branch.id,
            type: "STOCK_IN",
            channel: "POS",
            quantity: result.data.stock,
            previousStock: 0,
            nextStock: result.data.stock,
            note: "Initial product stock",
            userId: admin.id,
          });
        }
      }

      await createAuditLog(tx, {
        userId: admin.id,
        action: "CREATE",
        module: "products",
        recordId: product.id,
        newValue: normalizeProduct(product),
      });

      return {
        ...product,
        variants: [variant],
      };
    });

    return NextResponse.json({
      data: normalizeProduct(created),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to create product.", {
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

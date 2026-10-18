import { NextResponse } from "next/server";

import { fail, handleRouteError, ok } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { canAccessPOS, getCurrentUser, requireAdminUser } from "@/lib/auth";
import { listCatalogProducts, normalizeProduct } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { findCodeConflict } from "@/lib/server/services/product-codes";
import { productSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Keep SKUs ASCII-safe: names in Khmer or other non-Latin scripts strip down
// to nothing, so fall back to the product id to stay unique.
function buildVariantSku(productName, productSku, productSkuFallback) {
  const base = String(productSku || productName || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || productSkuFallback || "PRODUCT"}-DEFAULT`;
}


export async function GET() {
  return ok({
    data: await listCatalogProducts(),
  });
}

// Barcodes/SKUs must stay unique across products and variants — checked up
// front so the admin gets a precise message instead of a generic conflict.
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || (!canAccessPOS(user.role) && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return fail("Staff access required.", 403);
    }

    const body = await request.json();
    const result = productSchema.safeParse(body);

    if (!result.success) {
      return fail("Invalid product payload.", 422, {
        issues: result.error.flatten(),
      });
    }

    const conflict = await findCodeConflict(prisma, {
      sku: result.data.sku,
      barcode: result.data.barcode,
    });
    if (conflict) {
      return fail(conflict, 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      const hasVariantList = Array.isArray(result.data.variants) && result.data.variants.length > 0;
      const isVariant = result.data.isVariant || hasVariantList;

      const totalStock = hasVariantList
        ? result.data.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
        : result.data.stock;

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
          stock: totalStock,
          minStockAlert: result.data.minStockAlert,
          isActive: result.data.isActive ?? true,
          isVariant,
        },
      });

      const branch = await tx.branch.findFirst({
        where: { code: "HQ" },
      });

      if (hasVariantList) {
        for (const v of result.data.variants) {
          const vSku = v.sku || `${product.sku || "VAR"}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
          const vPrice = Number(v.retailPrice !== undefined ? v.retailPrice : (v.price !== undefined ? v.price : result.data.price));
          const vWholesale = v.wholesalePrice !== undefined && v.wholesalePrice !== "" ? Number(v.wholesalePrice) : (result.data.wholesalePrice || null);
          const vCost = v.costPrice !== undefined && v.costPrice !== "" ? Number(v.costPrice) : (result.data.costPrice || null);
          const vDiscount = Number(v.discountPercent || 0);
          const vActive = v.isActive !== false;
          const vStock = Number(v.stock || 0);
          const vBarcode = v.barcode ? String(v.barcode).trim() : null;

          const createdVar = await tx.productVariant.create({
            data: {
              productId: product.id,
              name: v.name || "Default",
              sku: vSku,
              barcode: vBarcode,
              price: vPrice,
              costPrice: vCost,
              wholesalePrice: vWholesale,
              discountPercent: vDiscount,
              isActive: vActive,
            },
          });

          if (branch && vStock >= 0) {
            await tx.inventory.create({
              data: {
                variantId: createdVar.id,
                branchId: branch.id,
                quantity: vStock,
                availableQuantity: vStock,
              },
            });
          }
        }
      } else {
        const variantSku =
          (result.data.sku && String(result.data.sku).trim()
            ? `${String(result.data.sku).trim()}-DEFAULT`
            : buildVariantSku(result.data.name, result.data.sku, product.id)) || `PROD-${product.id}-DEFAULT`;

        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variantSku,
            name: "Default",
            barcode: result.data.barcode || null,
            price: result.data.price,
            costPrice: result.data.costPrice || null,
            wholesalePrice: result.data.wholesalePrice || null,
            discountPercent: result.data.discountPercent,
            isActive: result.data.isActive ?? true,
          },
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
              userId: user.id,
            });
          }
        }
      }

      await createAuditLog(tx, {
        userId: user.id,
        action: "CREATE",
        module: "products",
        recordId: product.id,
        newValue: normalizeProduct(product),
      });

      const finalProduct = await tx.product.findUnique({
        where: { id: product.id },
        include: {
          variants: {
            where: { isActive: true },
            include: {
              unit: true,
              inventory: {
                select: {
                  availableQuantity: true,
                },
              },
              attributeValues: {
                include: {
                  attribute: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      return finalProduct;
    });

    return ok({
      data: normalizeProduct(created),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to create product.", {
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

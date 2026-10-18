import { fail, handleRouteError, ok } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { normalizeProduct } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { findCodeConflict } from "@/lib/server/services/product-codes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getAuthorizedStaff() {
  const user = await getCurrentUser();
  if (!user || (!canAccessPOS(user.role) && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }
  return user;
}

/**
 * DELETE /api/products/[id]
 * Soft-deletes a product: sets deletedAt + isActive=false on the product
 * and deactivates all its variants. Hard-deleting is unsafe because
 * ProductVariant has many onDelete: Restrict relations.
 */
export async function DELETE(request, { params }) {
  try {
    const staff = await getAuthorizedStaff();

    if (!staff) {
      return fail("Staff access required.", 403);
    }

    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!existing) {
        throw Object.assign(new Error("PRODUCT_NOT_FOUND"), { code: "P2025" });
      }

      // Deactivate all variants so they no longer appear on the storefront
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { isActive: false },
      });

      const product = await tx.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      await createAuditLog(tx, {
        userId: staff.id,
        action: "DELETE",
        module: "products",
        recordId: product.id,
        oldValue: normalizeProduct(existing),
      });

      return product;
    });

    return ok({
      data: normalizeProduct(deleted),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to delete product.", {
      notFoundMessage: "Product not found.",
    });
  }
}

export async function PATCH(request, { params }) {
  try {
    const staff = await getAuthorizedStaff();

    if (!staff) {
      return fail("Staff access required.", 403);
    }

    const { id } = await params;
    const body = await request.json();

    const price = body.price !== undefined && body.price !== "" ? Number(body.price) : undefined;
    const costPrice = body.costPrice !== undefined && body.costPrice !== "" ? Number(body.costPrice) : undefined;
    const wholesalePrice = body.wholesalePrice !== undefined && body.wholesalePrice !== "" ? Number(body.wholesalePrice) : undefined;
    const discountPercent = body.discountPercent !== undefined && body.discountPercent !== "" ? Number(body.discountPercent) : undefined;
    const stock = body.stock !== undefined && body.stock !== "" ? Number(body.stock) : undefined;
    const minStockAlert = body.minStockAlert !== undefined && body.minStockAlert !== "" ? Number(body.minStockAlert) : undefined;
    const ratingAvg = body.ratingAvg !== undefined && body.ratingAvg !== "" ? Number(body.ratingAvg) : undefined;
    const ratingCount = body.ratingCount !== undefined && body.ratingCount !== "" ? Number(body.ratingCount) : undefined;

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

    if (body.sku !== undefined || body.barcode !== undefined) {
      const conflict = await findCodeConflict(prisma, {
        sku: body.sku,
        barcode: body.barcode,
        excludeProductId: id,
      });
      if (conflict) {
        return fail(conflict, 409);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!existing) {
        throw Object.assign(new Error("PRODUCT_NOT_FOUND"), { code: "P2025" });
      }

      const branch =
        (await tx.branch.findFirst({ where: { code: "HQ" } })) ||
        (await tx.branch.findFirst());

      const hasVariantList = Array.isArray(body.variants) && body.variants.length > 0;
      const isVariant = body.isVariant !== undefined ? Boolean(body.isVariant) : (hasVariantList || existing.isVariant);

      // Handle variant updates / creation if provided
      if (hasVariantList) {
        for (const v of body.variants) {
          const vPrice = Number(v.retailPrice !== undefined ? v.retailPrice : (v.price !== undefined ? v.price : 0));
          const vWholesale = v.wholesalePrice !== undefined && v.wholesalePrice !== "" && Number(v.wholesalePrice) > 0 ? Number(v.wholesalePrice) : null;
          const vCost = v.costPrice !== undefined && v.costPrice !== "" && Number(v.costPrice) > 0 ? Number(v.costPrice) : null;
          const vDiscount = Number(v.discountPercent || 0);
          const vActive = v.isActive !== false;
          const vStock = v.stock !== undefined ? Number(v.stock) : 0;
          const vBarcode = v.barcode ? String(v.barcode).trim() : null;
          const vSku = v.sku ? String(v.sku).trim() : null;

          const isExisting = v.id && !String(v.id).startsWith("new-") && !String(v.id).startsWith("var-");
          let existingVar = null;
          if (isExisting) {
            existingVar = await tx.productVariant.findUnique({ where: { id: v.id } });
          }

          if (existingVar) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name || existingVar.name,
                nameKh: v.nameKh || existingVar.nameKh,
                ...(vSku ? { sku: vSku } : {}),
                barcode: vBarcode,
                price: vPrice,
                costPrice: vCost,
                wholesalePrice: vWholesale,
                discountPercent: vDiscount,
                isActive: vActive,
              },
            });

            if (branch && !Number.isNaN(vStock)) {
              await tx.inventory.upsert({
                where: {
                  variantId_branchId: {
                    variantId: existingVar.id,
                    branchId: branch.id,
                  },
                },
                update: {
                  quantity: vStock,
                  availableQuantity: vStock,
                },
                create: {
                  variantId: existingVar.id,
                  branchId: branch.id,
                  quantity: vStock,
                  availableQuantity: vStock,
                },
              });
            }
          } else {
            const newSku = vSku || `${body.sku || existing.sku || "VAR"}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
            const createdVar = await tx.productVariant.create({
              data: {
                productId: id,
                name: v.name || "Default",
                nameKh: v.nameKh || null,
                sku: newSku,
                barcode: vBarcode,
                price: vPrice,
                costPrice: vCost,
                wholesalePrice: vWholesale,
                discountPercent: vDiscount,
                isActive: vActive,
              },
            });

            if (branch && !Number.isNaN(vStock)) {
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
        }
      }

      // Calculate total stock if variants provided
      const totalStock = hasVariantList
        ? body.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
        : stock;

      const product = await tx.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.nameKh !== undefined ? { nameKh: body.nameKh || null } : {}),
          ...(body.sku !== undefined ? { sku: body.sku || null } : {}),
          ...(body.barcode !== undefined ? { barcode: body.barcode || null } : {}),
          ...(body.brand !== undefined ? { brand: body.brand || null } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : (body.image !== undefined ? { imageUrl: body.image } : {})),
          ...(price !== undefined ? { price } : {}),
          ...(costPrice !== undefined ? { costPrice: costPrice || null } : {}),
          ...(wholesalePrice !== undefined ? { wholesalePrice: wholesalePrice || null } : {}),
          ...(discountPercent !== undefined ? { discountPercent } : {}),
          ...(totalStock !== undefined ? { stock: totalStock } : {}),
          ...(minStockAlert !== undefined ? { minStockAlert } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          isVariant,
          ...(ratingAvg !== undefined ? { ratingAvg } : {}),
          ...(ratingCount !== undefined ? { ratingCount } : {}),
        },
      });

      // If single-variant product and stock changed, sync HQ inventory
      if (!hasVariantList && stock !== undefined && existing.stock !== product.stock) {
        const stockDiff = product.stock - existing.stock;
        let variantId = body.variantId;

        if (!variantId) {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: product.id },
          });
          variantId = firstVariant?.id;
        }

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

          await createInventoryMovement(tx, {
            variantId,
            type: stockDiff > 0 ? "STOCK_IN" : "ADJUSTMENT_DECREASE",
            channel: "POS",
            quantity: Math.abs(stockDiff),
            previousStock: existing.stock,
            nextStock: product.stock,
            note: "Staff product stock update",
            userId: staff.id,
          });
        }
      }

      await createAuditLog(tx, {
        userId: staff.id,
        action: "UPDATE",
        module: "products",
        recordId: product.id,
        oldValue: normalizeProduct(existing),
        newValue: normalizeProduct(product),
      });

      // Load full product with variants and inventories for clean serialization
      const finalProduct = await tx.product.findUnique({
        where: { id },
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

      return finalProduct;
    });

    return ok({
      data: normalizeProduct(updated),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to update product.", {
      notFoundMessage: "Product not found.",
      conflictMessage: "SKU or barcode already exists.",
    });
  }
}

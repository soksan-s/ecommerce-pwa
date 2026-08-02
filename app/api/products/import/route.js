import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { parseCsvRows } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

function parseBoolean(value) {
  if (value == null || value === "") {
    return true;
  }
  return String(value).toLowerCase() !== "false" && String(value) !== "0";
}

function parseNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function buildVariantSku(productName, productSku, variantName) {
  const base = String(productSku || productName || "PRODUCT")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 32);
  const suffix = String(variantName || "DEFAULT")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 16);
  return `${base}-${suffix}`;
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const body = await request.json();
    const rows = parseCsvRows(typeof body.csv === "string" ? body.csv : "");

    if (!rows.length) {
      return fail("CSV is empty or has no data rows.", 422);
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2; // +1 for header, +1 for zero-based
      const name = String(row.name || "").trim();

      if (!name) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: "Missing required column: name." });
        continue;
      }

      if (!row.category) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" is missing required column: category.` });
        continue;
      }

      const description = String(row.description || "").trim();
      if (!description) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" is missing required column: description.` });
        continue;
      }

      const imageUrl = String(row.imageUrl || "").trim();
      if (!imageUrl) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" is missing required column: imageUrl (or image).` });
        continue;
      }

      const price = parseNumber(row.price);
      const costPrice = parseNumber(row.costPrice);
      const wholesalePrice = parseNumber(row.wholesalePrice);
      const discountPercent = parseNumber(row.discountPercent);
      const stock = parseNumber(row.stock);
      const minStockAlert = parseNumber(row.minStockAlert);

      if (price == null || price < 0) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" has an invalid price.` });
        continue;
      }

      if (stock == null || !Number.isInteger(stock) || stock < 0) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" has an invalid stock quantity.` });
        continue;
      }

      if (discountPercent != null && (discountPercent < 0 || discountPercent > 100)) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: `"${name}" discount must be between 0 and 100.` });
        continue;
      }

      const sku = String(row.sku || "").trim() || null;
      const isActive = parseBoolean(row.isActive);

      try {
        // Upsert the product by SKU first, then by name.
        let product = sku
          ? await prisma.product.findUnique({ where: { sku } })
          : null;

        if (!product) {
          product = await prisma.product.findFirst({
            where: { name },
            select: { id: true, sku: true, name: true, price: true, stock: true },
          });
        }

        const productData = {
          name,
          sku,
          category: row.category,
          description,
          imageUrl,
          price,
          costPrice: costPrice ?? null,
          wholesalePrice: wholesalePrice ?? null,
          discountPercent: discountPercent ?? 0,
          stock: Math.round(stock),
          minStockAlert: minStockAlert != null ? Math.round(minStockAlert) : 5,
          isActive,
        };

        let createdProduct;
        if (product) {
          createdProduct = await prisma.product.update({
            where: { id: product.id },
            data: {
              ...productData,
              sku: sku || product.sku,
            },
          });
        } else {
          createdProduct = await prisma.product.create({
            data: productData,
          });
        }

        // Auto-create a default variant so the product can be ordered through
        // the variant-based order API. Variant prices are authoritative.
        const existingVariant = await prisma.productVariant.findFirst({
          where: { productId: createdProduct.id },
        });

        if (!existingVariant) {
          const variantSku = sku || buildVariantSku(name, sku, "DEFAULT");
          const variant = await prisma.productVariant.create({
            data: {
              productId: createdProduct.id,
              sku: variantSku,
              name: "Default Variant",
              price,
              costPrice: costPrice ?? null,
              wholesalePrice: wholesalePrice ?? null,
              discountPercent: discountPercent ?? 0,
              isActive: isActive,
            },
          });

          // Sync inventory at the HQ branch so the storefront stock reflects
          // the imported quantity.
          const branch = await prisma.branch.findFirst({
            where: { code: "HQ" },
          });

          if (branch) {
            await prisma.inventory.upsert({
              where: {
                variantId_branchId: {
                  variantId: variant.id,
                  branchId: branch.id,
                },
              },
              update: {
                quantity: { increment: Math.round(stock) },
                availableQuantity: { increment: Math.round(stock) },
              },
              create: {
                variantId: variant.id,
                branchId: branch.id,
                quantity: Math.round(stock),
                availableQuantity: Math.round(stock),
              },
            });

            await createInventoryMovement(prisma, {
              variantId: variant.id,
              branchId: branch.id,
              type: "STOCK_IN",
              channel: "POS",
              quantity: Math.round(stock),
              previousStock: 0,
              nextStock: Math.round(stock),
              note: "Imported from CSV",
              userId: admin.id,
            });
          }
        } else if (existingVariant) {
          // Keep the variant price in sync with the imported product price so
          // storefront display and order pricing never diverge.
          await prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              price,
              costPrice: costPrice ?? null,
              wholesalePrice: wholesalePrice ?? null,
              discountPercent: discountPercent ?? 0,
              isActive,
            },
          });
        }

        await createAuditLog(prisma, {
          userId: admin.id,
          action: product ? "UPDATE" : "CREATE",
          module: "products",
          recordId: createdProduct.id,
          newValue: {
            name,
            sku: sku || undefined,
            category: row.category,
            price,
            stock: Math.round(stock),
            source: "csv-import",
          },
        });

        importedCount += 1;
      } catch (error) {
        skippedCount += 1;
        errors.push({
          row: rowNumber,
          message: `"${name}" failed to import: ${error?.message || "database error"}`,
        });
      }
    }

    return ok({
      importedCount,
      skippedCount,
      errors: errors.slice(0, 50),
      totalRows: rows.length,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to import products from CSV.");
  }
}


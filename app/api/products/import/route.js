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
  // Strip to ASCII-safe characters; Khmer/non-Latin names fall back to
  // a timestamp so the SKU stays unique and CSV/URL friendly.
  const slug = (value, max) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max);
  const base = slug(productSku || productName, 32) || `IMP-${Date.now().toString(36).toUpperCase()}`;
  const suffix = slug(variantName, 16) || "DEFAULT";
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
        errors.push({ row: rowNumber, message: "Missing required product name." });
        continue;
      }

      // Safe defaults for optional fields so CSV files without image, description, or category can import seamlessly
      const category = String(row.category || "").trim() || "General";
      const description = String(row.description || "").trim() || name;
      const imageUrl = String(row.imageUrl || row.image || "").trim();

      const priceRaw = parseNumber(row.price);
      const price = priceRaw != null && priceRaw >= 0 ? priceRaw : 0;

      const costPrice = parseNumber(row.costPrice);
      const wholesalePrice = parseNumber(row.wholesalePrice);

      const discountRaw = parseNumber(row.discountPercent);
      const discountPercent = discountRaw != null ? Math.max(0, Math.min(100, discountRaw)) : 0;

      const stockRaw = parseNumber(row.stock);
      const stock = stockRaw != null && stockRaw >= 0 ? Math.round(stockRaw) : 0;

      const minStockAlertRaw = parseNumber(row.minStockAlert);
      const minStockAlert = minStockAlertRaw != null && minStockAlertRaw >= 0 ? Math.round(minStockAlertRaw) : 5;

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
          category,
          description,
          imageUrl,
          price,
          costPrice: costPrice ?? null,
          wholesalePrice: wholesalePrice ?? null,
          discountPercent,
          stock,
          minStockAlert,
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

        // Auto-create or update a default variant so the product can be ordered through
        // the variant-based order API.
        const existingVariant = await prisma.productVariant.findFirst({
          where: { productId: createdProduct.id },
        });

        const branch = await prisma.branch.findFirst({
          where: { code: "HQ" },
        });

        let targetVariant = existingVariant;

        if (!existingVariant) {
          const baseVariantSku = sku || buildVariantSku(name, sku, "DEFAULT");
          let variantSku = baseVariantSku;

          const colliding = await prisma.productVariant.findUnique({
            where: { sku: variantSku },
          });
          if (colliding) {
            variantSku = `${baseVariantSku}-${createdProduct.id.slice(-6).toUpperCase()}`;
          }

          targetVariant = await prisma.productVariant.create({
            data: {
              productId: createdProduct.id,
              sku: variantSku,
              name: "Default Variant",
              price,
              costPrice: costPrice ?? null,
              wholesalePrice: wholesalePrice ?? null,
              discountPercent,
              isActive,
            },
          });
        } else {
          targetVariant = await prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              price,
              costPrice: costPrice ?? null,
              wholesalePrice: wholesalePrice ?? null,
              discountPercent,
              isActive,
            },
          });
        }

        // Sync inventory at the HQ branch so storefront stock matches imported stock
        if (branch && targetVariant) {
          await prisma.inventory.upsert({
            where: {
              variantId_branchId: {
                variantId: targetVariant.id,
                branchId: branch.id,
              },
            },
            update: {
              quantity: stock,
              availableQuantity: stock,
            },
            create: {
              variantId: targetVariant.id,
              branchId: branch.id,
              quantity: stock,
              availableQuantity: stock,
            },
          });

          await createInventoryMovement(prisma, {
            variantId: targetVariant.id,
            branchId: branch.id,
            type: "STOCK_IN",
            channel: "POS",
            quantity: stock,
            previousStock: 0,
            nextStock: stock,
            note: "Imported from CSV",
            userId: admin.id,
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
            category,
            price,
            stock,
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


import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { parseCsvRows } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const body = await request.json();
    const rows = parseCsvRows(typeof body.csv === "string" ? body.csv : "");

    if (!rows.length) {
      return fail("CSV is empty.", 422);
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const identifier = row.variantId || row.productId || row.id || row.sku || row.name;
      const quantity = Number(row.quantity || row.quantityAdded || row.stock || 0);
      const expiryText = String(row.expiryDate || row.expiry || "").trim();
      const noExpiry = ["true", "yes", "none", "no"].includes(String(row.noExpiry || "").trim().toLowerCase());
      let expiryDate = null;
      if (!noExpiry) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryText)) {
          skippedCount += 1;
          continue;
        }
        const [year, month, day] = expiryText.split("-").map(Number);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
          skippedCount += 1;
          continue;
        }
        expiryDate = new Date(`${expiryText}T00:00:00+07:00`);
      }

      if (!identifier || !Number.isInteger(quantity) || quantity <= 0) {
        skippedCount += 1;
        continue;
      }

      // Try to find the variant first, then fall back to product
      let variant = null;
      if (row.variantId || row.sku) {
        variant = await prisma.productVariant.findFirst({
          where: {
            OR: [
              ...(row.variantId ? [{ id: row.variantId }] : []),
              ...(row.sku ? [{ sku: row.sku }] : []),
            ],
          },
        });
      }

      if (!variant) {
        // Try as a product identifier
        const product = row.productId || row.id
          ? await prisma.product.findUnique({ where: { id: identifier } })
          : await prisma.product.findFirst({ where: { name: identifier } });

        if (!product) {
          skippedCount += 1;
          continue;
        }

        // If product found but no variant, use the product's first variant, or create one
        variant = await prisma.productVariant.findFirst({
          where: { productId: product.id },
        });

        if (!variant) {
          // Create a default variant for this product
          variant = await prisma.productVariant.create({
            data: {
              productId: product.id,
              sku: product.sku || `VAR-${product.id}`,
              name: "Default Variant",
              price: product.price || 0,
              costPrice: product.costPrice,
              wholesalePrice: product.wholesalePrice,
            },
          });
        }
      }

      // Update variant-level inventory for the HQ branch
      const branch = await prisma.branch.findFirst({
        where: { code: "HQ" },
      });
      const branchId = branch?.id;

      if (!branchId) {
        skippedCount += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: variant.id,
              branchId,
            },
          },
          update: {
            quantity: { increment: quantity },
            availableQuantity: { increment: quantity },
          },
          create: {
            variantId: variant.id,
            branchId,
            quantity,
            availableQuantity: quantity,
          },
        });

        await tx.inventoryBatch.create({
          data: {
            batchNumber: String(row.batchNumber || `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim().slice(0, 80),
            variantId: variant.id,
            branchId,
            initialQty: quantity,
            remainingQty: quantity,
            costPrice: Number(row.costPrice || row.unitCost || variant.costPrice || 0),
            currency: "USD",
            expiryDate,
          },
        });
      });

      importedCount += 1;
    }

    return ok({
      importedCount,
      skippedCount,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to import inventory restocks from CSV.");
  }
}

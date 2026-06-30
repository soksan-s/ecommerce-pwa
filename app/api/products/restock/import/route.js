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

      if (branchId) {
        await prisma.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: variant.id,
              branchId,
            },
          },
          update: {
            quantity: { increment: quantity },
          },
          create: {
            variantId: variant.id,
            branchId,
            quantity,
          },
        });
      }

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

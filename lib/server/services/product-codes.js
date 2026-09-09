// Barcode/SKU uniqueness checking shared by product create/update APIs.
// Codes are trimmed strings; leading zeros are significant and preserved.
export async function findCodeConflict(db, { sku, barcode, excludeProductId = null }) {
  const cleanBarcode = String(barcode || "").trim();
  const cleanSku = String(sku || "").trim();

  if (cleanBarcode) {
    const [variant, product, extra] = await Promise.all([
      db.productVariant.findFirst({
        where: { barcode: cleanBarcode, ...(excludeProductId ? { product: { id: { not: excludeProductId } } } : {}) },
        select: { id: true },
      }),
      db.product.findFirst({
        where: { barcode: cleanBarcode, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
        select: { id: true },
      }),
      db.productBarcode.findUnique({ where: { barcode: cleanBarcode }, select: { id: true, productId: true } }),
    ]);

    if (variant || product || (extra && extra.productId !== excludeProductId)) {
      return "This barcode is already assigned to another product.";
    }
  }

  if (cleanSku) {
    const [variant, product] = await Promise.all([
      db.productVariant.findFirst({
        where: { sku: cleanSku, ...(excludeProductId ? { product: { id: { not: excludeProductId } } } : {}) },
        select: { id: true },
      }),
      db.product.findFirst({
        where: { sku: cleanSku, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
        select: { id: true },
      }),
    ]);

    if (variant || product) {
      return "This SKU is already assigned to another product.";
    }
  }

  return null;
}

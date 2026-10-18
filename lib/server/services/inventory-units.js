/**
 * Inventory Unit and Conversion Helper
 * Handles carton-to-piece conversions and shared inventory deduction.
 */

export function getVariantConversionFactor(variant) {
  if (!variant) return 1;

  // 1. Direct unit conversion factor on Unit model
  if (variant.unit?.conversionFactor != null) {
    const factor = Number(variant.unit.conversionFactor);
    if (!Number.isNaN(factor) && factor > 0) {
      return factor;
    }
  }

  // 2. Variant attribute values (e.g. attribute "Packaging" = "Case 24x" or "Units per Carton" = "24")
  if (Array.isArray(variant.attributeValues)) {
    for (const av of variant.attributeValues) {
      const val = String(av.value || "");
      const match = val.match(/(\d+)\s*(?:cans|pieces|pcs|pack|x)?$/i) || val.match(/(\d+)x/i);
      if (match && Number(match[1]) > 1) {
        return Number(match[1]);
      }
    }
  }

  // 3. Name or packaging indicators (e.g. "Case (24x Cans)", "Carton (24 cans)", "24-Pack", "Box of 24")
  const text = `${variant.name || ""} ${variant.sku || ""}`;
  const cartonMatch =
    text.match(/(?:carton|case|box|pack)\s*(?:of|\()?[\s]*(\d+)/i) ||
    text.match(/(\d+)\s*(?:x|cans|pieces|pcs|bottles|pack)/i);

  if (cartonMatch && Number(cartonMatch[1]) > 1) {
    return Number(cartonMatch[1]);
  }

  return 1;
}

/**
 * Resolves the base variant that holds inventory for a product.
 * If the variant is a derived unit (e.g. Carton), stock is tracked on the base unit (e.g. Can).
 */
export async function resolveBaseVariant(prismaOrTx, variant, productId = null) {
  if (!variant) return null;
  const pId = productId || variant.productId;
  if (!pId) return variant;

  const factor = getVariantConversionFactor(variant);
  // If factor is 1, this variant is already a base unit
  if (factor === 1) {
    return variant;
  }

  // Look for sibling variants of the same product
  const siblings = await prismaOrTx.productVariant.findMany({
    where: { productId: pId, isActive: true },
    include: { unit: true },
    orderBy: { sortOrder: "asc" },
  });

  if (!siblings.length) {
    return variant;
  }

  // 1. If variant's unit has a baseUnitId, find sibling matching that baseUnitId
  if (variant.unit?.baseUnitId) {
    const baseSibling = siblings.find((s) => s.unitId === variant.unit.baseUnitId);
    if (baseSibling) return baseSibling;
  }

  // 2. Find sibling with factor === 1 (e.g. "Can", "Bottle", "Piece", "Default")
  const baseSibling = siblings.find((s) => s.id !== variant.id && getVariantConversionFactor(s) === 1);
  if (baseSibling) {
    return baseSibling;
  }

  // Fallback to variant itself if no base sibling exists
  return variant;
}

/**
 * Computes available and total stock for a variant based on its conversion factor
 * and the shared base inventory record.
 */
export function calculateVariantStock(baseInventory, factor = 1) {
  const safeFactor = Math.max(1, factor);
  const rawAvail = typeof baseInventory === "number"
    ? baseInventory
    : (baseInventory ? (baseInventory.availableQuantity ?? baseInventory.quantity ?? 0) : 0);
  const rawTotal = typeof baseInventory === "number"
    ? baseInventory
    : (baseInventory ? (baseInventory.quantity ?? 0) : 0);

  return {
    availableQuantity: Math.floor(Math.max(0, rawAvail) / safeFactor),
    quantity: Math.floor(Math.max(0, rawTotal) / safeFactor),
    factor: safeFactor,
  };
}

import { prisma } from "@/lib/server/db/prisma";
import { fallbackProducts } from "@/lib/shared/constants/fallback-data";

export function normalizeProduct(product) {
  // Extract variant data for the storefront
  const variants = (product.variants || [])
    .filter((v) => v.isActive)
    .map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku || "",
      barcode: v.barcode || "",
      price: Number(v.price),
      discountPercent: v.discountPercent || 0,
      // Discounted price for sorting
      discountedPrice: Number((Number(v.price) * (1 - (v.discountPercent || 0) / 100)).toFixed(2)),
      stock: (v.inventory && v.inventory.length > 0) 
        ? v.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0) 
        : 0,
      // Expose attribute values for the variant selector UI
      attributeValues: (v.attributeValues || []).map((av) => ({
        attributeName: av.attribute?.name || "",
        value: av.value,
      })),
    }));

  const hasVariants = variants.length > 0;
  const prices = variants.map((v) => v.discountedPrice);
  const minPrice = prices.length ? Math.min(...prices) : Number(product.price);
  const maxPrice = prices.length ? Math.max(...prices) : Number(product.price);
  // For displayPrice: use cheapest variant price if variants exist, else legacy product.price
  const displayPrice = hasVariants ? minPrice : Number(product.price);
  // For non-variant products keep the legacy discount percent so the storefront
  // can display the strikethrough price correctly. For multi-variant products
  // the discount is already baked into the variant prices (displayDiscountPercent
  // stays 0 to avoid double-discounting).
  const displayDiscountPercent = hasVariants
    ? 0
    : Number(product.discountPercent || 0);
  // Always expose the original (pre-discount) price so the storefront can show
  // "was $X" correctly for both variant and non-variant products.
  const originalPrice = hasVariants
    ? Math.max(...variants.map((v) => Number(v.price)))
    : Number(product.price);
  const priceRange = hasVariants ? { min: minPrice, max: maxPrice } : null;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku || product.id,
    barcode: product.barcode || "",
    brand: product.brand || "",
    category: product.category,
    description: product.description,
    image: product.imageUrl,
    // Legacy price retained for backward compatibility (products without variants)
    price: Number(product.price),
    costPrice: Number(product.costPrice || 0),
    wholesalePrice: Number(product.wholesalePrice || 0),
    discountPercent: product.discountPercent || 0,
    rating: Number(product.ratingAvg || 0),
    ratingCount: product.ratingCount || 0,
    stock: product.stock,
    minStockAlert: product.minStockAlert || 5,
    isActive: product.isActive,
    isVariant: product.isVariant || false,
    // Variant data for the storefront
    variants,
    // Convenience flags for multi-variant products
    hasVariants,
    minPrice,
    maxPrice,
    displayPrice,
    displayDiscountPercent,
    originalPrice,
    priceRange,
    comments:
      product.comments?.map((entry) => ({
        id: entry.id,
        userEmail: entry.user?.email || "",
        message: entry.message,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        isEdited: entry.updatedAt?.getTime?.() !== entry.createdAt?.getTime?.(),
      })) || [],
  };
}

export async function listCatalogProducts() {
  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            attributeValues: {
              include: {
                attribute: true,
              },
            },
            inventory: {
              select: {
                availableQuantity: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      // Comments are intentionally excluded from the catalog listing for performance.
      // They are only fetched on the product detail page via /api/products/[id].
    });

    if (!products.length) {
      return fallbackProducts;
    }

    return products.map(normalizeProduct);
  } catch {
    return fallbackProducts;
  }
}

export async function getProductById(id) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            attributeValues: {
              include: {
                attribute: true,
              },
            },
            inventory: {
              select: {
                availableQuantity: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        comments: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    return normalizeProduct(product);
  } catch {
    return null;
  }
}

export async function listCatalogCategories() {
  const products = await listCatalogProducts();
  return [...new Set(products.map((product) => product.category))];
}

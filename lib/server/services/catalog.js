import { prisma } from "@/lib/server/db/prisma";
import { fallbackProducts } from "@/lib/shared/constants/fallback-data";

export function normalizeProduct(product) {
  // Extract variant data for the storefront
  const variants = (product.variants || [])
    .filter((v) => v.isActive)
    .map((v) => {
      const retailPrice = Number(v.price || 0);
      const configuredWholesale = v.wholesalePrice != null ? Number(v.wholesalePrice) : null;
      // If wholesalePrice is configured on variant, use it; otherwise fallback to product wholesalePrice, then retail price.
      const wholesalePrice =
        configuredWholesale !== null && !Number.isNaN(configuredWholesale) && configuredWholesale > 0
          ? configuredWholesale
          : (product.wholesalePrice != null && Number(product.wholesalePrice) > 0
              ? Number(product.wholesalePrice)
              : retailPrice);
      const discountPercent = v.discountPercent || 0;
      // Storefront uses wholesale price as the primary price
      const storefrontPrice = wholesalePrice;
      const discountedPrice = Number((storefrontPrice * (1 - discountPercent / 100)).toFixed(2));

      return {
        id: v.id,
        name: v.name,
        nameKh: v.nameKh || "",
        sku: v.sku || "",
        barcode: v.barcode || "",
        price: storefrontPrice,
        retailPrice,
        wholesalePrice,
        unitId: v.unitId || null,
        conversionFactor: v.unit?.conversionFactor ? Number(v.unit.conversionFactor) : 1,
        discountPercent,
        discountedPrice,
        stock: (v.inventory && v.inventory.length > 0)
          ? v.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0)
          : 0,
        // Expose attribute values for the variant selector UI
        attributeValues: (v.attributeValues || []).map((av) => ({
          attributeName: av.attribute?.name || "",
          value: av.value,
        })),
      };
    });

  const hasVariants = variants.length > 0;
  const prices = variants.map((v) => v.discountedPrice);
  const minPrice = prices.length ? Math.min(...prices) : Number(product.wholesalePrice ?? product.price ?? 0);
  const maxPrice = prices.length ? Math.max(...prices) : Number(product.wholesalePrice ?? product.price ?? 0);
  const productRetailPrice = Number(product.price || 0);
  const productWholesalePrice =
    product.wholesalePrice != null && Number(product.wholesalePrice) > 0
      ? Number(product.wholesalePrice)
      : productRetailPrice;

  // For displayPrice: use cheapest variant wholesale price if variants exist, else product wholesale price
  const displayPrice = hasVariants ? minPrice : productWholesalePrice;
  const displayDiscountPercent = hasVariants
    ? 0
    : Number(product.discountPercent || 0);
  const originalPrice = hasVariants
    ? Math.max(...variants.map((v) => v.wholesalePrice))
    : productWholesalePrice;
  const priceRange = hasVariants ? { min: minPrice, max: maxPrice } : null;

  return {
    id: product.id,
    name: product.name,
    nameKh: product.nameKh || "",
    sku: product.sku || product.id,
    barcode: product.barcode || "",
    brand: product.brand || "",
    category: product.category,
    description: product.description,
    descriptionKh: product.descriptionKh || "",
    image: product.imageUrl,
    // Storefront price is wholesalePrice
    price: displayPrice,
    retailPrice: productRetailPrice,
    wholesalePrice: productWholesalePrice,
    costPrice: Number(product.costPrice || 0),
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
            unit: true,
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
            unit: true,
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

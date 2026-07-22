import { prisma } from "@/lib/server/db/prisma";
import { fallbackProducts } from "@/lib/shared/constants/fallback-data";

export function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku || product.id,
    barcode: product.barcode || "",
    brand: product.brand || "",
    category: product.category,
    description: product.description,
    image: product.imageUrl,
    price: Number(product.price),
    costPrice: Number(product.costPrice || 0),
    wholesalePrice: Number(product.wholesalePrice || 0),
    discountPercent: product.discountPercent || 0,
    rating: Number(product.ratingAvg || 0),
    ratingCount: product.ratingCount || 0,
    stock: product.stock,
    minStockAlert: product.minStockAlert || 5,
    isActive: product.isActive,
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
      orderBy: {
        createdAt: "desc",
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

export async function listCatalogCategories() {
  const products = await listCatalogProducts();
  return [...new Set(products.map((product) => product.category))];
}

"use client";

import { clearStore, getAll, put } from "@/lib/client/offline/db";

/**
 * Standard product normalization helper for POS client components.
 * Preserves all fields required by both Product List and New Sale cart/variants.
 */
export function normalizeCatalogProduct(product) {
  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  const variants = rawVariants.map((v) => ({
    id: v.id,
    name: v.name || "Default",
    sku: v.sku || product.sku || product.id,
    price: Number(v.discountedPrice ?? v.price ?? product.price ?? 0),
    originalPrice: Number(v.price ?? product.price ?? 0),
    discountPercent: Number(v.discountPercent || 0),
    stock: Number(v.stock ?? product.stock ?? 0),
    attributeValues: Array.isArray(v.attributeValues) ? v.attributeValues : [],
    isActive: v.isActive !== false,
  }));

  const prices = variants.map((v) => v.price);
  const basePrice = (product.displayPrice ?? product.price) || 0;
  const minPrice = prices.length ? Math.min(...prices) : Number(basePrice);
  const maxPrice = prices.length ? Math.max(...prices) : Number(basePrice);

  return {
    id: String(product.id),
    name: product.name || "Unnamed Product",
    sku: product.sku || String(product.id),
    barcode: product.barcode || "",
    category: product.category || "General",
    price: Number(basePrice),
    minPrice,
    maxPrice,
    stock: Number(product.stock || 0),
    lowStockThreshold: Number(product.lowStockThreshold || product.minStockAlert || 5),
    unit: product.unit || "pcs",
    image: product.image || product.imageUrl || "",
    isActive: product.isActive !== false,
    hasVariants: variants.length > 0,
    variants,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

/**
 * Saves a list of server products into IndexedDB using upserts (no wipe).
 */
export async function saveProductsToCache(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  const normalized = products.map(normalizeCatalogProduct);
  await Promise.all(normalized.map((product) => put("products", product)));
  return normalized;
}

/**
 * Reads all products from IndexedDB and returns them normalized.
 */
export async function getProductsFromCache() {
  const localProducts = await getAll("products");
  if (!Array.isArray(localProducts) || localProducts.length === 0) {
    return [];
  }
  return localProducts.map(normalizeCatalogProduct);
}

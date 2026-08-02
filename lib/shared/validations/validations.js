import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().trim().optional().default(""),
  barcode: z.string().trim().optional().default(""),
  brand: z.string().trim().optional().default(""),
  category: z.string().min(2),
  description: z.string().min(10),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional().default(0),
  wholesalePrice: z.coerce.number().min(0).optional().default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  stock: z.coerce.number().int().min(0),
  minStockAlert: z.coerce.number().int().min(0).optional().default(5),
  // Images are optional — the add-product form may submit an empty string when
  // the admin hasn't uploaded an image yet. Reject only invalid non-empty URLs.
  imageUrl: z.string().url().or(z.literal("")).default(""),
  // Respect the admin's publish/draft toggle.
  isActive: z.boolean().optional().default(true),
});

export const variantSchema = z.object({
  sku: z.string().trim().min(2),
  name: z.string().min(2),
  nameKh: z.string().trim().optional(),
  unitId: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional().default(0),
  wholesalePrice: z.coerce.number().min(0).optional().default(0),
  vipPrice: z.coerce.number().min(0).optional().default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  weight: z.coerce.number().min(0).optional().nullable(),
  volume: z.coerce.number().min(0).optional().nullable(),
  barcode: z.string().trim().optional().default(""),
  // Per-variant stock is seeded into HQ inventory on create so the storefront
  // never shows an out-of-stock variant immediately after it is added.
  stock: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const attributeSchema = z.object({
  name: z.string().min(1),
  nameKh: z.string().optional(),
});

export const attributeValueSchema = z.object({
  attributeId: z.string(),
  value: z.string().min(1),
});

import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { normalizeProduct } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Shared product lookup for barcode scanning and manual search (Admin + POS).
// Codes are always handled as trimmed strings — leading zeros are preserved.
//
// GET /api/products/lookup?barcode=8850001234567  → exact match, first hit wins
// GET /api/products/lookup?q=cola                 → contains search, ranked list
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_INCLUDE = {
  attributeValues: {
    include: { attribute: true },
  },
  inventory: {
    select: { availableQuantity: true },
  },
};

const PRODUCT_INCLUDE = {
  variants: {
    where: { isActive: true },
    include: VARIANT_INCLUDE,
    orderBy: { sortOrder: "asc" },
  },
};

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS or admin access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const barcodeParam = searchParams.get("barcode");
    const queryParam = searchParams.get("q");

    // ── Exact barcode/SKU scan ──────────────────────────────────────────────
    if (barcodeParam !== null) {
      const code = String(barcodeParam).trim();
      if (!code) {
        return fail("Barcode value is required.", 422);
      }

      // Priority: variant barcode → variant SKU → product barcode → extra
      // product barcodes (ProductBarcode table) → product SKU.
      let matchType = null;
      let matchedVariant = await prisma.productVariant.findFirst({
        where: { barcode: code, isActive: true },
        include: { product: { include: PRODUCT_INCLUDE } },
      });
      if (matchedVariant) {
        matchType = "variant-barcode";
      } else {
        matchedVariant = await prisma.productVariant.findFirst({
          where: { sku: code, isActive: true },
          include: { product: { include: PRODUCT_INCLUDE } },
        });
        if (matchedVariant) {
          matchType = "variant-sku";
        }
      }

      if (matchedVariant) {
        return ok({
          data: {
            matchType,
            variantId: matchedVariant.id,
            product: normalizeProduct(matchedVariant.product),
          },
        });
      }

      let product = await prisma.product.findFirst({
        where: { barcode: code, deletedAt: null },
        include: PRODUCT_INCLUDE,
      });
      if (product) {
        matchType = "product-barcode";
      } else {
        const extra = await prisma.productBarcode.findUnique({
          where: { barcode: code },
          include: { product: { include: PRODUCT_INCLUDE } },
        });
        if (extra?.product && extra.product.deletedAt == null) {
          product = extra.product;
          matchType = "product-extra-barcode";
        }
      }
      if (!product) {
        product = await prisma.product.findFirst({
          where: { sku: code, deletedAt: null },
          include: PRODUCT_INCLUDE,
        });
        if (product) {
          matchType = "product-sku";
        }
      }

      if (!product) {
        return ok({ data: null });
      }

      return ok({
        data: { matchType, variantId: null, product: normalizeProduct(product) },
      });
    }

    // ── Manual contains-search across name / SKU / barcode ─────────────────
    const query = String(queryParam || "").trim();
    if (query.length < 1) {
      return fail("Search query is required.", 422);
    }
    if (query.length < 2) {
      return ok({ data: [] });
    }

    const lower = query.toLowerCase();
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
          { barcode: { contains: query } },
          { barcodes: { some: { barcode: { contains: query } } } },
          { variants: { some: { isActive: true, OR: [{ sku: { contains: query } }, { barcode: { contains: query } }] } } },
        ],
      },
      include: PRODUCT_INCLUDE,
      take: 20,
      orderBy: { name: "asc" },
    });

    // Rank exact code matches ahead of partial name matches.
    const ranked = products.sort((a, b) => {
      const exact = (p) =>
        [p.sku, p.barcode, ...(p.variants || []).flatMap((v) => [v.sku, v.barcode])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase() === lower)
          ? 0
          : 1;
      return exact(a) - exact(b);
    });

    return ok({ data: ranked.map(normalizeProduct) });
  } catch (error) {
    return handleRouteError(error, "Unable to look up product.");
  }
}

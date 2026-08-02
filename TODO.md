# E-Commerce Fix Plan

## Goal
Fix three related storefront issues:
1. Product CSV import silently imports 0 products.
2. Order price differs from storefront price (e.g. variant $100 vs $3.50).
3. Multi-variant products don't show a variant picker when adding to cart.

## Steps

### 1. Robust CSV parser
- [x] Rewrite `lib/shared/utils/csv.js` to handle:
  - UTF-8 BOM
  - Quoted fields (Excel-style)
  - Commas inside quoted fields
  - CRLF / LF line endings
  - Header normalization (trim, lowercase, spaces→underscores)
  - Header aliases (`image` → `imageUrl`, `qty` → `stock`, etc.)

### 2. Product import API
- [x] Rewrite `app/api/products/import/route.js` to:
  - Use the robust parser + alias normalization
  - Validate each row with clear per-row skip reasons
  - Upsert product by name or SKU
  - Auto-create a default ProductVariant + HQ inventory for non-variant rows
  - Return `{ importedCount, skippedCount, errors }` with useful feedback
  - Import initial stock into variant inventory
  - Create inventory movements + audit log

### 3. ✅ Admin form discount percent fix + variant creation + default variant seeding
- [x] **Discount math fix** – `Math.round(((basePrice - discountPrice) / basePrice) * 100)` now correctly computes the discount % (e.g. $100 base with $3.50 discount price → 97% off).
- [x] **Products POST route** – now creates a default `ProductVariant` + HQ inventory row on product creation, so the variant-based order API can resolve every product.
- [x] **Variant creation route** – now seeds per-variant stock into HQ inventory and passes `isActive`.
- [x] **Admin form** – passes `stock`, `isActive`, and `publishActive` to both product and variant API calls.
- [x] **Store `addProduct`** – now forwards `sku`, `barcode`, `brand`, and `isActive` to the products API so publish/draft status and SKUs persist on create.

### 4. Catalog normalization (price consistency)
- [x] Update `lib/server/services/catalog.js` `normalizeProduct`:
  - Report correct `displayDiscountPercent` for non-variant products
  - Ensure `displayPrice`/`minPrice`/`maxPrice` reflect discounted variant prices
  - Expose `priceRange` metadata for the storefront

### 5. Storefront price display + variant picker
- [x] Update `components/client-pages.js`:
  - `getProductDiscountedPrice` → use `displayPrice` (variant-aware)
  - `ProductCard` → show price range for multi-variant products, variant-aware pricing
  - `ClientProductDetailPageView` → add variant selector (name + price + stock), show selected variant price in sticky bar, pass variantId to `addToCart`
  - Cart page → show variant name + actual unitPrice per line
  - Order detail reorder + image lookups → resolve variant → product

### 6. Order API default variant fallback
- [x] Update `app/api/orders/route.js` so legacy product-only lines resolve to a variant (create a default variant if none exists) so non-variant products can be ordered.

## Follow-up
- [ ] Test: create a product with base price $100, discount price $3.50 → verify storefront shows $3.50
- [ ] Test: create a product with variants (Small $10, Medium $15, Large $20) → verify variant picker appears and each variant adds to cart at correct price
- [ ] Test: order a product and verify order total matches storefront price
- [ ] Test: import a CSV with quoted fields / commas; verify importedCount > 0
- [ ] Run `npm run build` or dev server to confirm no lint errors


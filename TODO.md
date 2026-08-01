# Variant Handling, Pricing & Inventory Reservation Fixes

## Progress Tracker

- [x] Phase 1 — Catalog: variant pricing metadata (`hasVariants`, `minPrice`, `maxPrice`, `displayPrice` = cheapest variant)
- [x] Phase 1 — Store provider: `cartQuantityFor(id, variantId)` cartKey fix, `findProductForVariant`, variant-aware cart ops
- [x] Phase 1 — Storefront UI: variant selector on product detail, "From $X" pricing, variant-aware add-to-cart, cart/checkout variant names, fixed reorder & product image lookup
- [x] Phase 2 — Orders: strict `variantId` validation (422 when product has variants), price from selected variant only, reservation tracking (`reservedQuantity += qty`, `availableQuantity -= qty`)
- [x] Phase 2 — Order cancel: release reservation only (`reservedQuantity -= qty`, recompute `availableQuantity`), no physical stock change
- [ ] Phase 3 — POS: variant-aware cashier UI (select variant before adding), cart stores `variantId`, sale transaction saves `variantId`
- [x] Phase 3 — POS transaction: rejects missing variantId for variant products, uses `availableQuantity` check, decrements both `quantity` and `availableQuantity`
- [x] Phase 3 — POS returns: restores `availableQuantity` alongside `quantity`
- [x] Phase 4 — Inventory: product stock PATCH requires `variantId` for variant products, syncs to variant inventory, maintains `availableQuantity` across restock import
- [ ] Phase 4 — Admin UI: variant products show price/stock as "managed in Variants" (read-only), restock buttons only for non-variant products
- [ ] Phase 5 — Validate: `next lint`, `next build`, manual test flows

## Files edited
1. ✅ `lib/server/services/catalog.js` — added `hasVariants`, `minPrice`, `maxPrice`, `discountedPrice` per variant
2. ✅ `components/app-store-provider.js` — fixed `cartQuantityFor` with variantId, added `findProductForVariant`
3. ✅ `components/client-pages.js` — variant selector, "From $X" pricing, variant-aware cart/checkout, fixed reorder
4. ✅ `app/api/orders/route.js` — strict variantId validation, reservation tracking (reservedQuantity, not physical)
5. ✅ `app/api/orders/[id]/route.js` — cancel releases reservation, no physical stock change
6. 🔲 `components/pos-shell.js` — variant chips, store variantId, send variantId in sale lines
7. ✅ `app/api/pos/transaction/route.js` — variantId validation, availableQuantity check, proper deduction
8. ✅ `app/api/pos/returns/route.js` — restores availableQuantity
9. ✅ `app/api/products/[id]/route.js` — variantId required for stock changes on variant products, syncs variant inventory
10. ✅ `app/api/products/restock/import/route.js` — sets availableQuantity on restock
11. 🔲 `components/admin-pages.js` — variant products show "managed in Variants" (read-only)

## Key invariants
- Inventory is always tracked at variant level (`Inventory.variantId`).
- `availableQuantity = quantity - reservedQuantity`.
- Online orders reserve stock (do not deduct physical quantity).
- POS sales deduct physical quantity immediately.
- Missing `variantId` for a variant product → 422 validation error (no silent fallback).
- All atomic stock updates use `updateMany` with `gte` guard to prevent race conditions.

## Atomic Race Condition Fix Applied
- ✅ `app/api/orders/route.js` — online order reservation uses `updateMany` with `availableQuantity >= qty` guard
- ✅ `app/api/orders/[id]/route.js` — cancellation release uses `updateMany` with `reservedQuantity >= qty` guard
- ✅ `app/api/pos/transaction/route.js` — POS sale deduct uses `updateMany` with `availableQuantity >= qty` guard

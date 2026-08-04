"use client";

import { Layers, X } from "lucide-react";
import { formatPrimaryMoney } from "@/components/pos/format";

function stockBadgeClass(stock) {
  if (stock <= 0) {
    return "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300";
  }

  if (stock <= 5) {
    return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300";
  }

  return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300";
}

export function VariantSelectorModal({ open, product, settings, onClose, onSelectVariant }) {
  if (!open || !product) {
    return null;
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const initial = product.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 text-[var(--foreground)] shadow-2xl transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-soft)] text-xl font-extrabold text-[var(--muted-foreground)]">
              {product.image ? (
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--pos-action-surface)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[var(--pos-action)]">
                  <Layers className="size-3" />
                  Select Variant
                </span>
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">{product.category}</span>
              </div>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--foreground)]">{product.name}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--surface-soft)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Options list */}
        <div className="mt-4 max-h-[24rem] space-y-2.5 overflow-y-auto pr-1">
          {variants.map((variant) => {
            const disabled = variant.stock <= 0 || variant.isActive === false;
            const attributes = Array.isArray(variant.attributeValues) ? variant.attributeValues : [];

            return (
              <button
                key={variant.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    onSelectVariant(product, variant);
                    onClose();
                  }
                }}
                className={`group flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border-soft)] p-3.5 text-left transition-all ${
                  disabled
                    ? "cursor-not-allowed opacity-50 bg-[var(--surface-soft)]"
                    : "bg-[var(--surface-soft)] hover:border-[var(--pos-action)] hover:bg-[var(--surface-strong)] active:scale-[0.99] shadow-xs"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-[var(--foreground)] group-hover:text-[var(--pos-action)] transition-colors">
                      {variant.name}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${stockBadgeClass(variant.stock)}`}>
                      {variant.stock <= 0 ? "Out of stock" : `${variant.stock} available`}
                    </span>
                  </div>

                  {attributes.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {attributes.map((attr, idx) => (
                        <span
                          key={idx}
                          className="inline-flex rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]"
                        >
                          {attr.attributeName ? `${attr.attributeName}: ` : ""}
                          {attr.value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] font-mono text-[var(--muted-foreground)]">SKU: {variant.sku}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-[var(--foreground)]">
                    {formatPrimaryMoney(variant.price, settings)}
                  </p>
                  {variant.originalPrice && variant.originalPrice > variant.price ? (
                    <p className="text-[11px] font-bold text-[var(--muted-foreground)] line-through">
                      {formatPrimaryMoney(variant.originalPrice, settings)}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}

          {!variants.length ? (
            <div className="p-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
              No variants available for this product.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

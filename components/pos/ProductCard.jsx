"use client";

import { Layers } from "lucide-react";
import { useState } from "react";

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

export function ProductCard({ product, settings, onAdd }) {
  const [pulse, setPulse] = useState(false);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 1;

  const totalStock = hasVariants
    ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : product.stock;

  const disabled = totalStock <= 0 || product.isActive === false;
  const initial = product.name?.charAt(0)?.toUpperCase() || "?";

  const displayPrice = hasVariants
    ? `${formatPrimaryMoney(product.minPrice || product.price, settings)}${
        product.maxPrice && product.maxPrice !== product.minPrice
          ? ` - ${formatPrimaryMoney(product.maxPrice, settings)}`
          : ""
      }`
    : formatPrimaryMoney(product.price, settings);

  function handleClick() {
    if (disabled) {
      return;
    }

    onAdd(product);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 180);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={[
        "group relative overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3 text-left shadow-xs transition-all duration-150",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--pos-action)]/40",
        pulse ? "scale-[0.97] ring-2 ring-[var(--pos-action)]" : "",
      ].join(" ")}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--surface-soft)]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-quiet)] text-2xl font-extrabold text-[var(--muted-foreground)]">
            {initial}
          </div>
        )}

        {hasVariants ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-[var(--surface-strong)]/90 px-2 py-0.5 text-[10px] font-extrabold text-[var(--pos-action)] shadow-xs backdrop-blur-xs">
            <Layers className="size-3" />
            {variants.length} options
          </div>
        ) : null}

        {disabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-strong)]/80 backdrop-blur-xs text-xs font-bold text-red-600 dark:text-red-400">
            Out of Stock
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-col justify-between min-h-20">
        <div>
          <p className="line-clamp-2 text-xs font-bold leading-snug text-[var(--foreground)]">{product.name}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <p className="text-xs font-extrabold text-[var(--foreground)] truncate">{displayPrice}</p>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${stockBadgeClass(totalStock)}`}>
            {totalStock <= 0 ? "Out" : `${totalStock} left`}
          </span>
        </div>
      </div>
    </button>
  );
}

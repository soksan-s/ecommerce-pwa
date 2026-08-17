"use client";

import { Layers } from "lucide-react";
import { useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";

function stockBadgeClass(stock) {
  if (stock <= 0) {
    return "bg-red-500/10 text-red-400";
  }
  if (stock <= 5) {
    return "bg-amber-500/10 text-amber-400";
  }
  return "bg-emerald-500/10 text-emerald-400";
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
    if (disabled) return;
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
        "group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3 text-left shadow-sm transition-all duration-150",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:-translate-y-1 hover:border-[rgba(16,185,129,0.35)] hover:shadow-[var(--shadow-glow)]",
        pulse ? "scale-[0.97] ring-2 ring-[var(--action)]" : "",
      ].join(" ")}
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--surface-quiet)]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-soft)]">
            <span className="text-2xl font-extrabold text-[var(--muted-foreground)]">
              {initial}
            </span>
          </div>
        )}

        {hasVariants ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-lg bg-[var(--surface-strong)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--action)] backdrop-blur-sm">
            <Layers className="size-3" />
            {variants.length} options
          </div>
        ) : null}

        {disabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-strong)]/80 backdrop-blur-sm text-xs font-bold text-[var(--error)]">
            Out of Stock
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="mt-2.5 flex flex-col justify-between min-h-[4.5rem]">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--foreground)]">
          {product.name}
        </p>
        <div className="mt-2 flex items-center justify-between gap-1">
          <p className="text-[13px] font-bold text-[var(--action)] tabular-nums truncate">
            {displayPrice}
          </p>
          <span
            className={[
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
              stockBadgeClass(totalStock),
            ].join(" ")}
          >
            {totalStock <= 0 ? "Out" : `${totalStock} left`}
          </span>
        </div>
      </div>
    </button>
  );
}

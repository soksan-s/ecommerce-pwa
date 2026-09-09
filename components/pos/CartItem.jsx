"use client";

import { Tag, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatDisplayMoney } from "@/components/pos/format";

export function CartItem({ item, settings, displayCurrency, onUpdateQty, onRemove, onUpdateNote, onReprice }) {
  const [showNote, setShowNote] = useState(Boolean(item.note));
  const lineTotal = item.qty * item.price;
  const originalPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
  const isOverridden = Boolean(item.isOverridden && item.price !== originalPrice);

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      isOverridden
        ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/15"
        : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setShowNote((value) => !value)} className="min-w-0 text-left group block w-full">
            <p className="truncate text-xs font-bold text-[var(--foreground)] group-hover:text-[var(--pos-action)] transition-colors">{item.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">
              <span>Unit:</span>
              {isOverridden ? (
                <>
                  <span className="line-through opacity-70">
                    {formatDisplayMoney(originalPrice, displayCurrency, settings)}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {formatDisplayMoney(item.price, displayCurrency, settings)}
                  </span>
                  <span className="rounded-md bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">
                    Override
                  </span>
                </>
              ) : (
                <span>{formatDisplayMoney(item.price, displayCurrency, settings)}</span>
              )}
            </div>
            {isOverridden && item.overrideReason ? (
              <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 italic truncate">
                Reason: {item.overrideReason}
              </p>
            ) : null}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onReprice}
            className={`grid size-7 place-items-center rounded-lg text-xs font-bold transition-colors ${
              isOverridden
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 hover:bg-amber-200"
                : "bg-[var(--surface-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border-soft)]"
            }`}
            title="Reprice item (Price override)"
            aria-label="Reprice item"
          >
            <Tag className="size-3.5" />
          </button>
          <button 
            type="button" 
            onClick={onRemove} 
            className="grid size-7 place-items-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
            title="Remove item"
            aria-label="Remove item"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center border border-[var(--border-soft)] bg-[var(--surface-strong)] p-0.5">
          <button
            type="button"
            onClick={() => onUpdateQty(Math.max(0, item.qty - 1))}
            aria-label="Decrease quantity"
            className="grid size-7 place-items-center bg-[var(--surface-soft)] text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--pos-action-surface)] hover:text-[var(--pos-action-on-muted)]"
          >
            -
          </button>
          <input
            value={item.qty}
            onChange={(event) => onUpdateQty(event.target.value)}
            aria-label="Quantity"
            className="w-10 bg-transparent text-center text-xs font-extrabold tabular-nums text-[var(--foreground)] outline-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.qty + 1)}
            aria-label="Increase quantity"
            className="grid size-7 place-items-center bg-[var(--surface-soft)] text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--pos-action-surface)] hover:text-[var(--pos-action-on-muted)]"
          >
            +
          </button>
        </div>
        <p className="text-xs font-extrabold text-[var(--foreground)]">
          {formatDisplayMoney(lineTotal, displayCurrency, settings)}
        </p>
      </div>

      {showNote ? (
        <textarea
          value={item.note || ""}
          onChange={(event) => onUpdateNote(event.target.value)}
          placeholder="Item note..."
          className="mt-2.5 min-h-14 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors placeholder:text-[var(--muted-foreground)]"
        />
      ) : null}
    </div>
  );
}

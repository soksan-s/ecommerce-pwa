"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { formatDisplayMoney } from "@/components/pos/format";

export function CartItem({ item, settings, displayCurrency, onUpdateQty, onRemove, onUpdateNote }) {
  const [showNote, setShowNote] = useState(Boolean(item.note));
  const lineTotal = item.qty * item.price;

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => setShowNote((value) => !value)} className="min-w-0 text-left group">
          <p className="truncate text-xs font-bold text-[var(--foreground)] group-hover:text-[var(--pos-action)] transition-colors">{item.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-foreground)]">
            Unit: {formatDisplayMoney(item.price, displayCurrency, settings)}
          </p>
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

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-0.5">
          <button 
            type="button" 
            onClick={() => onUpdateQty(Math.max(0, item.qty - 1))} 
            className="grid size-6 place-items-center rounded-md bg-[var(--surface-soft)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
          >
            -
          </button>
          <input
            value={item.qty}
            onChange={(event) => onUpdateQty(event.target.value)}
            className="w-9 bg-transparent text-center text-xs font-extrabold text-[var(--foreground)] outline-none"
          />
          <button 
            type="button" 
            onClick={() => onUpdateQty(item.qty + 1)} 
            className="grid size-6 place-items-center rounded-md bg-[var(--surface-soft)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
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

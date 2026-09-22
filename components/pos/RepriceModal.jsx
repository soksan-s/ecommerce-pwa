"use client";

import { AlertCircle, Check, RotateCcw, Tag, X } from "lucide-react";
import { useState } from "react";

import { convertMoney, formatDisplayMoney } from "@/components/pos/format";

const QUICK_REASONS = [
  "Wholesale negotiation",
  "Volume discount",
  "Damaged packaging",
  "Price match",
  "Customer courtesy",
];

function RepriceModalForm({ item, settings, displayCurrency, onClose, onApply, onReset }) {
  const activeCurrency = displayCurrency || settings?.currency?.primaryCurrency || "USD";
  const exchangeRate = settings?.currency?.exchangeRate || 4000;

  const originalPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
  const isCurrentlyOverridden = Boolean(item.isOverridden && item.price !== originalPrice);

  const initialInDisplay =
    activeCurrency === "KHR"
      ? convertMoney(item.price, "USD", "KHR", exchangeRate)
      : Number(item.price || 0);

  const [inputValue, setInputValue] = useState(() =>
    activeCurrency === "KHR" ? String(Math.round(initialInDisplay)) : Number(initialInDisplay).toFixed(2)
  );
  const [reason, setReason] = useState(() => item.overrideReason || "");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e?.preventDefault();
    // const num = parseFloat(inputValue);
    const cleanVal = String(inputValue || "").replace(/,/g, "").trim();
    const num = parseFloat(cleanVal);

    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid price greater than 0.");
      return;
    }

    // Convert display currency back to base USD for storage
    const priceInUsd =
      activeCurrency === "KHR"
        ? convertMoney(num, "KHR", "USD", exchangeRate)
        : num;

    onApply(priceInUsd, reason);
    onClose();
  }

  function handleReset() {
    onReset();
    onClose();
  }

  return (
    <div
      className="w-full max-w-md rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 text-[var(--foreground)] shadow-2xl transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pos-action-surface)] text-[var(--pos-action)]">
            <Tag className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">
                Price Override
              </span>
            </div>
            <h2 className="mt-0.5 text-base font-black tracking-tight text-[var(--foreground)] truncate max-w-[16rem]">
              {item.name}
            </h2>
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

      {/* Price Summary Comparison */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-[var(--surface-soft)] p-3 border border-[var(--border-soft)]">
        <div>
          <p className="text-[11px] font-bold text-[var(--muted-foreground)]">Normal Price</p>
          <p className="mt-0.5 text-xs font-black text-[var(--foreground)]">
            {formatDisplayMoney(originalPrice, activeCurrency, settings)}
          </p>
        </div>
        <div className="border-l border-[var(--border-soft)] pl-3">
          <p className="text-[11px] font-bold text-[var(--muted-foreground)]">Current Sale Price</p>
          <p className={`mt-0.5 text-xs font-black ${isCurrentlyOverridden ? "text-amber-600 dark:text-amber-400" : "text-[var(--foreground)]"}`}>
            {formatDisplayMoney(item.price, activeCurrency, settings)}
          </p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* New Price Input */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1.5">
            New Unit Price ({activeCurrency})
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-black text-[var(--muted-foreground)]">
              {activeCurrency === "USD" ? "$" : "KHR"}
            </span>
            <input
              type="number"
              // step={activeCurrency === "USD" ? "0.01" : "100"}
              // min="0.01"
              step="any"
              min="0"
              autoFocus
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError("");
              }}
              placeholder="0.00"
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] pl-9 pr-3.5 py-2.5 text-sm font-extrabold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors"
            />
          </div>
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
              <AlertCircle className="size-3.5" />
              {error}
            </p>
          )}
        </div>

        {/* Reason Input */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1.5">
            Reason for Override <span className="font-normal text-[var(--muted-foreground)]">(Optional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Wholesale negotiation, promo..."
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors placeholder:text-[var(--muted-foreground)]"
          />
          {/* Quick Reason Chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-colors ${reason === r
                  ? "bg-[var(--pos-action)] text-[var(--pos-action-fg)]"
                  : "bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border-soft)]"
                  }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-4">
          <div>
            {isCurrentlyOverridden && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                <RotateCcw className="size-3.5" />
                Reset to Original
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98]"
            >
              <Check className="size-3.5" />
              Apply Price
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function RepriceModal({ open, item, settings, displayCurrency, onClose, onApply, onReset }) {
  if (!open || !item) {
    return null;
  }

  const key = `${item.keyId || item.productId}-${item.price}-${displayCurrency}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 backdrop-blur-xs p-4">
      <RepriceModalForm
        key={key}
        item={item}
        settings={settings}
        displayCurrency={displayCurrency}
        onClose={onClose}
        onApply={onApply}
        onReset={onReset}
      />
    </div>
  );
}

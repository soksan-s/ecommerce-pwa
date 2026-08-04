"use client";

import { useMemo, useState } from "react";

import { convertMoney, formatDisplayMoney, formatMoney } from "@/components/pos/format";

const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

export function PaymentModal({ open, summary, settings, displayCurrency, cashierName, onClose, onConfirm }) {
  const [method, setMethod] = useState("cash");
  const [cashInput, setCashInput] = useState("");
  const [reference, setReference] = useState("");
  const exchangeRate = settings.currency.exchangeRate;
  const money = (value, showBoth = true) => formatDisplayMoney(value, displayCurrency, settings, showBoth);
  const showBothCurrencies = Boolean(settings.currency.showBothCurrencies);

  const cashReceivedUSD = useMemo(() => {
    const rawValue = Number(cashInput || 0);
    return convertMoney(rawValue, displayCurrency, "USD", exchangeRate);
  }, [cashInput, displayCurrency, exchangeRate]);

  const changeDue = Math.max(0, cashReceivedUSD - summary.total);
  const canConfirmCash = cashReceivedUSD >= summary.total;
  const quickAmounts = Array.from(new Set([summary.total, 5, 10, 20, 50, 100].filter((amt) => amt > 0)));

  if (!open) {
    return null;
  }

  function pressKey(key) {
    if (key === "back") {
      setCashInput((value) => value.slice(0, -1));
      return;
    }

    setCashInput((value) => `${value}${key}`);
  }

  function setQuickAmount(amountUSD) {
    const displayAmount = convertMoney(amountUSD, "USD", displayCurrency, exchangeRate);
    setCashInput(String(displayCurrency === "USD" ? Number(displayAmount.toFixed(2)) : Math.round(displayAmount)));
  }

  function confirm() {
    onConfirm({
      paymentMethod: method,
      cashReceived: method === "cash" ? cashReceivedUSD : summary.total,
      changeDue: method === "cash" ? changeDue : 0,
      reference,
      cashierName,
      currency: displayCurrency,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 text-[var(--foreground)] shadow-2xl transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Payment</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)]">Complete Sale</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">Order Summary</h3>
            <div className="mt-3 space-y-2 text-xs font-semibold text-[var(--muted-foreground)]">
              <div className="flex justify-between"><span>Items</span><span className="text-[var(--foreground)] font-bold">{summary.itemCount}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span className="text-[var(--foreground)] font-bold">{money(summary.subtotal)}</span></div>
              <div className="flex justify-between text-[var(--pos-action)] font-bold"><span>Discount</span><span>-{money(summary.discount)}</span></div>
              <div className="flex justify-between"><span>{settings.tax.taxName}</span><span className="text-[var(--foreground)] font-bold">{money(summary.tax)}</span></div>
              <div className="flex justify-between border-t border-[var(--border-soft)] pt-3 text-lg font-black text-[var(--foreground)]">
                <span>Total</span><span>{money(summary.total)}</span>
              </div>
            </div>
          </section>

          <section>
            <div className="grid grid-cols-3 rounded-xl bg-[var(--surface-soft)] p-1 border border-[var(--border-soft)]">
              {["cash", "card", "qr"].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setMethod(entry)}
                  className={
                    method === entry 
                      ? "rounded-lg bg-[var(--surface-strong)] px-3 py-2 text-xs font-extrabold capitalize text-[var(--foreground)] shadow-xs transition-all" 
                      : "rounded-lg px-3 py-2 text-xs font-bold capitalize text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  }
                >
                  {entry === "qr" ? "QR / Other" : entry}
                </button>
              ))}
            </div>

            {method === "cash" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                <div>
                  <p className="text-xs font-bold text-[var(--muted-foreground)]">Cash Received</p>
                  <div className="mt-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-4 py-3 text-2xl font-black text-[var(--foreground)]">
                    {cashInput ? formatMoney(Number(cashInput), displayCurrency, exchangeRate, showBothCurrencies) : "0"}
                  </div>
                  <p className={changeDue >= 0 ? "mt-3 text-lg font-black text-[var(--pos-action)]" : "mt-3 text-lg font-black text-red-600 dark:text-red-400"}>
                    Change Due: {money(changeDue)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {quickAmounts.map((amount, idx) => (
                      <button 
                        key={`${amount}-${idx}`} 
                        type="button" 
                        onClick={() => setQuickAmount(amount)} 
                        className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] active:scale-[0.97] transition-all"
                      >
                        {amount === summary.total ? "Exact" : money(amount, false)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {keypad.map((key) => (
                    <button 
                      key={key} 
                      type="button" 
                      onClick={() => pressKey(key)} 
                      className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-3 text-base font-extrabold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] active:scale-[0.96] transition-all"
                    >
                      {key === "back" ? "⌫" : key}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!canConfirmCash}
                  onClick={confirm}
                  className="rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-3 text-base font-extrabold text-[var(--pos-action-fg)] disabled:opacity-40 transition-all active:scale-[0.98] md:col-span-2 shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-8 text-center text-lg font-extrabold text-[var(--foreground)]">
                  Swipe card or scan QR code
                </div>
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Reference number (optional)"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3.5 py-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors placeholder:text-[var(--muted-foreground)]"
                />
                <button 
                  type="button" 
                  onClick={confirm} 
                  className="w-full rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-3 text-base font-extrabold text-[var(--pos-action-fg)] transition-all active:scale-[0.98] shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

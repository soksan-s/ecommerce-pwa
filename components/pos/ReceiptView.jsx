"use client";

import { Printer, ShoppingBag } from "lucide-react";
import { formatDisplayMoney } from "@/components/pos/format";

export function ReceiptView({ transaction, settings, onNewSale }) {
  if (!transaction) {
    return null;
  }

  const money = (value) => formatDisplayMoney(value, transaction.currency, settings);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 text-[var(--foreground)] shadow-xs transition-colors">
      <style>
        {`@media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; color: #000 !important; background: #fff !important; font-family: "Content", "Plus Jakarta Sans", system-ui, sans-serif !important; }
          #receipt-print { position: absolute; inset: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }`}
      </style>

      <div id="receipt-print" className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-black text-[var(--foreground)]">{settings.storeInfo.storeName}</h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--muted-foreground)]">{settings.storeInfo.storeAddress}</p>
          <p className="text-xs font-medium text-[var(--muted-foreground)]">{settings.storeInfo.receiptHeaderNote}</p>
        </div>

        <div className="border-y border-dashed border-[var(--border-soft)] py-2.5 text-xs font-medium text-[var(--muted-foreground)] space-y-1">
          <div className="flex justify-between"><span>Sale ID</span><span className="font-mono text-[var(--foreground)]">{transaction.receiptNumber || transaction.id}</span></div>
          <div className="flex justify-between"><span>Date</span><span className="text-[var(--foreground)]">{new Date(transaction.timestamp).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Cashier</span><span className="text-[var(--foreground)]">{transaction.cashierName || "POS"}</span></div>
        </div>

        <div className="space-y-2.5">
          {transaction.items.map((item, idx) => (
            <div key={item.keyId || item.variantId || item.productId || idx} className="text-xs">
              <div className="flex justify-between gap-4 font-bold text-[var(--foreground)]">
                <span>{item.name}</span>
                <span>{money(item.price * item.qty)}</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">{item.qty} x {money(item.price)}</p>
              {item.note ? <p className="text-[11px] text-[var(--muted-foreground)] italic">Note: {item.note}</p> : null}
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-[var(--border-soft)] pt-3 text-xs font-semibold text-[var(--muted-foreground)]">
          <div className="flex justify-between"><span>Subtotal</span><span className="text-[var(--foreground)] font-bold">{money(transaction.subtotal)}</span></div>
          <div className="flex justify-between text-[var(--pos-action)] font-bold"><span>Discount</span><span>-{money(transaction.discount)}</span></div>
          <div className="flex justify-between"><span>{settings.tax.taxName}</span><span className="text-[var(--foreground)] font-bold">{money(transaction.tax)}</span></div>
          <div className="flex justify-between border-t border-[var(--border-soft)] pt-2 text-base font-black text-[var(--foreground)]">
            <span>Total</span><span>{money(transaction.total)}</span>
          </div>
          <div className="flex justify-between pt-1"><span>Cash Received</span><span className="text-[var(--foreground)]">{money(transaction.cashReceived)}</span></div>
          <div className="flex justify-between"><span>Change Due</span><span className="text-[var(--pos-action)] font-bold">{money(transaction.changeDue)}</span></div>
        </div>

        <p className="pt-2 text-center text-xs font-medium text-[var(--muted-foreground)]">{settings.storeInfo.receiptFooterMessage}</p>
      </div>

      <div className="no-print mt-6 grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onClick={() => window.print()} 
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
        >
          <Printer className="size-4" />
          Print Receipt
        </button>
        <button 
          type="button" 
          onClick={onNewSale} 
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-2.5 text-xs font-extrabold text-[var(--pos-action-fg)] transition-all active:scale-[0.98] shadow-xs"
        >
          <ShoppingBag className="size-4" />
          New Sale
        </button>
      </div>
    </div>
  );
}

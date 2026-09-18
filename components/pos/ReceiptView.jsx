"use client";

import { Printer, ShoppingBag } from "lucide-react";
import { formatDisplayMoney } from "@/components/pos/format";
import { useTranslation } from "@/lib/translations";

export function ReceiptView({ transaction, settings, onNewSale }) {
  if (!transaction) {
    return null;
  }

  const lang = settings?.appearance?.defaultLanguage || "km";
  const { t } = useTranslation(lang);
  const money = (value) => formatDisplayMoney(value, transaction.currency, settings);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 text-[var(--foreground)] shadow-xs transition-colors font-khmer">
      <style>
        {`@media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; color: #000 !important; background: #fff !important; font-family: "Noto Sans Khmer", "Plus Jakarta Sans", system-ui, sans-serif !important; }
          #receipt-print { position: absolute; inset: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }`}
      </style>

      <div id="receipt-print" className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-black text-[var(--foreground)]">{settings?.storeInfo?.storeName || t("store_name")}</h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--muted-foreground)]">{settings?.storeInfo?.storeAddress || t("store_location")}</p>
          <p className="text-xs font-medium text-[var(--muted-foreground)]">{settings?.storeInfo?.receiptHeaderNote || t("store_tagline")}</p>
        </div>

        <div className="border-y border-dashed border-[var(--border-soft)] py-2.5 text-xs font-medium text-[var(--muted-foreground)] space-y-1">
          <div className="flex justify-between"><span>{t("sale_id")}</span><span className="font-mono text-[var(--foreground)]">{transaction.receiptNumber || transaction.id}</span></div>
          <div className="flex justify-between"><span>{t("date_time")}</span><span className="text-[var(--foreground)]">{new Date(transaction.timestamp).toLocaleString(lang === "km" ? "km-KH" : "en-US")}</span></div>
          <div className="flex justify-between"><span>{t("cashier_label")}</span><span className="text-[var(--foreground)]">{transaction.cashierName || "POS"}</span></div>
        </div>

        <div className="space-y-2.5">
          {transaction.items.map((item, idx) => {
            const itemName = (lang === "km" && item.nameKh) ? item.nameKh : item.name;
            return (
              <div key={item.keyId || item.variantId || item.productId || idx} className="text-xs">
                <div className="flex justify-between gap-4 font-bold text-[var(--foreground)]">
                  <span>{itemName}</span>
                  <span>{money(item.price * item.qty)}</span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">{item.qty} x {money(item.price)}</p>
                {item.note ? <p className="text-[11px] text-[var(--muted-foreground)] italic">{t("notes")}: {item.note}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5 border-t border-[var(--border-soft)] pt-3 text-xs font-semibold text-[var(--muted-foreground)]">
          <div className="flex justify-between"><span>{t("subtotal")}</span><span className="text-[var(--foreground)] font-bold">{money(transaction.subtotal)}</span></div>
          <div className="flex justify-between text-[var(--pos-action)] font-bold"><span>{t("discount")}</span><span>-{money(transaction.discount)}</span></div>
          <div className="flex justify-between"><span>{settings?.tax?.taxName || t("tax_vat")}</span><span className="text-[var(--foreground)] font-bold">{money(transaction.tax)}</span></div>
          <div className="flex justify-between border-t border-[var(--border-soft)] pt-2 text-base font-black text-[var(--foreground)]">
            <span>{t("total")}</span><span>{money(transaction.total)}</span>
          </div>
          <div className="flex justify-between pt-1"><span>{t("cash_received")}</span><span className="text-[var(--foreground)]">{money(transaction.cashReceived)}</span></div>
          <div className="flex justify-between"><span>{t("change_due")}</span><span className="text-[var(--pos-action)] font-bold">{money(transaction.changeDue)}</span></div>
        </div>

        <p className="pt-2 text-center text-xs font-medium text-[var(--muted-foreground)]">{settings?.storeInfo?.receiptFooterMessage || t("thank_you")}</p>
      </div>

      <div className="no-print mt-6 grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onClick={() => window.print()} 
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
        >
          <Printer className="size-4" />
          {t("print_receipt")}
        </button>
        <button 
          type="button" 
          onClick={onNewSale} 
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-2.5 text-xs font-extrabold text-[var(--pos-action-fg)] transition-all active:scale-[0.98] shadow-xs"
        >
          <ShoppingBag className="size-4" />
          {t("new_sale")}
        </button>
      </div>
    </div>
  );
}

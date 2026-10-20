"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatPrimaryMoney } from "@/components/pos/format";
import { usePOSSettings } from "@/hooks/usePOSSettings";

function todayInPhnomPenh() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function AdminShiftCloseReportPageView() {
  const { settings } = usePOSSettings();
  const [date, setDate] = useState(todayInPhnomPenh);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const money = (value) => formatPrimaryMoney(value, settings, false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shift-close?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error || "Unable to load close report.");
      setReport(payload.data);
    } catch (loadError) {
      setError(loadError.message || "Unable to load close report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const cards = report ? [
    ["Closed shifts", `${report.summary.closedCount} / ${report.summary.shiftCount}`, `${report.summary.openCount} still open`],
    ["POS sales", money(report.summary.salesTotal), "Completed shift sales"],
    ["Expected cash", money(report.summary.expectedCash), "Closed shifts"],
    ["Cash counted", money(report.summary.countedCash), "Closed shifts"],
    ["Difference", money(report.summary.discrepancy), "Closed shifts"],
  ] : [];

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[var(--action)]">Admin reports</p><h1 className="mt-1 text-2xl font-black text-[var(--foreground)]">Daily close review</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Review cashier shift counts and discrepancies by Phnom Penh business date.</p></div>
        <div className="flex items-center gap-2"><input aria-label="Business date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 text-xs font-bold text-[var(--foreground)]" /><button type="button" onClick={loadReport} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 text-xs font-bold text-[var(--foreground)] disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
      </header>
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, detail]) => <section key={label} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs"><p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p><p className="mt-2 text-xl font-black tabular-nums text-[var(--foreground)]">{value}</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{detail}</p></section>)}</div>
      <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-xs">
        <div className="border-b border-[var(--border-soft)] px-4 py-4"><h2 className="font-extrabold text-[var(--foreground)]">Cashier shifts</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Selected day: {date} · open shifts remain visible until closed.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[var(--surface-quiet)] text-[10px] font-bold uppercase text-[var(--muted-foreground)]"><tr><th className="p-3">Cashier / Branch</th><th className="p-3">Opened / Closed</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Expected</th><th className="p-3 text-right">Counted</th><th className="p-3 text-right">Difference</th><th className="p-3">Status / Note</th></tr></thead><tbody className="divide-y divide-[var(--border-soft)]">
          {loading ? <tr><td colSpan={7} className="p-10 text-center text-[var(--muted-foreground)]">Loading…</td></tr> : report?.shifts?.length ? report.shifts.map((shift) => <tr key={shift.id} className="align-top hover:bg-[var(--surface-quiet)]/50"><td className="p-3"><b className="text-[var(--foreground)]">{shift.cashierName}</b><p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{shift.branchName}</p></td><td className="p-3 text-[var(--muted-foreground)]"><div>{new Date(shift.openTime).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}</div><div className="mt-1">{shift.closeTime ? new Date(shift.closeTime).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" }) : "Not closed"}</div></td><td className="p-3 text-right font-bold text-[var(--foreground)]">{money(shift.salesTotal)}<div className="mt-1 text-[10px] font-normal text-[var(--muted-foreground)]">{shift.transactionCount} transactions</div></td><td className="p-3 text-right tabular-nums">{shift.expectedCash == null ? "—" : money(shift.expectedCash)}</td><td className="p-3 text-right tabular-nums">{shift.countedCash == null ? "—" : money(shift.countedCash)}</td><td className={`p-3 text-right font-bold tabular-nums ${shift.discrepancy && Math.abs(shift.discrepancy) >= 0.005 ? "text-amber-700" : "text-emerald-700"}`}>{shift.discrepancy == null ? "—" : money(shift.discrepancy)}</td><td className="max-w-64 p-3"><span className="rounded-full bg-[var(--surface-quiet)] px-2 py-1 text-[10px] font-bold">{shift.status}</span>{shift.note ? <p className="mt-2 whitespace-normal text-[var(--muted-foreground)]">{shift.note}</p> : null}<div className="mt-2 flex flex-wrap gap-1">{Object.entries(shift.paymentTotals).map(([method, amount]) => <span key={method} className="rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted-foreground)]">{method} {money(amount)}</span>)}</div></td></tr>) : <tr><td colSpan={7} className="p-10 text-center text-sm text-[var(--muted-foreground)]">No cashier shifts for this date.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}

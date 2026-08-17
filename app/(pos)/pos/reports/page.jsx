"use client";

import { Download, Filter } from "lucide-react";
import { useEffect, useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";
import { usePOSSettings } from "@/hooks/usePOSSettings";

function MetricCard({ label, value, detail, comparison }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs text-[var(--foreground)] transition-colors">
      <p className="text-xs font-bold text-[var(--muted-foreground)]">{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">{value}</p>
        {comparison !== undefined && (
          <span className={`text-xs font-bold ${comparison >= 0 ? "text-[var(--pos-action)]" : "text-red-600 dark:text-red-400"}`}>
            {comparison > 0 ? "+" : ""}{comparison.toFixed(1)}% vs prev
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium text-[var(--muted-foreground)]">{detail}</p>
    </section>
  );
}

function ProgressRows({ rows, formatter }) {
  const max = Math.max(...rows.map((row) => Number(row.value ?? row.quantity ?? 0)), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = Number(row.value ?? row.quantity ?? 0);

        return (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="truncate font-extrabold text-[var(--foreground)]">{row.label}</span>
              <span className="shrink-0 font-bold text-[var(--muted-foreground)]">{formatter(value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div className="h-full rounded-full bg-[var(--pos-action)] transition-all duration-300" style={{ width: `${Math.max((value / max) * 100, value > 0 ? 8 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PosReportsPage() {
  const { settings } = usePOSSettings();
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");

  async function loadReport() {
    try {
      const response = await fetch(`/api/pos/reports?startDate=${startDate}&endDate=${endDate}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        setMessage(payload.error || "Unable to load POS reports.");
        return;
      }

      setReport(payload.data);
      setMessage("");
    } catch {
      setMessage("Unable to load POS reports.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadReport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [startDate, endDate]);

  function handleExport() {
    window.location.href = `/api/pos/reports/export?startDate=${startDate}&endDate=${endDate}`;
  }

  const metrics = report?.metrics || {
    totalRevenue: 0,
    transactions: 0,
    itemsSold: 0,
    averageTransaction: 0,
    discountTotal: 0,
    taxTotal: 0,
  };

  return (
    <div className="space-y-5 transition-colors">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Reports</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)]">Cashier POS Reports</h1>
          <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">Track sales, payment mix, and product performance from synced POS transactions.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-1 px-2 shadow-xs">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--foreground)] outline-none bg-[var(--surface-soft)]"
            />
            <span className="text-[var(--muted-foreground)] text-xs font-bold">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--foreground)] outline-none bg-[var(--surface-soft)]"
            />
          </div>
          <button 
            type="button" 
            onClick={loadReport} 
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-3.5 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98]"
          >
            <Filter className="size-3.5" />
            Apply
          </button>
          <button 
            type="button" 
            onClick={handleExport} 
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Revenue" value={formatPrimaryMoney(metrics.totalRevenue, settings, false)} detail="Total synced POS revenue." comparison={report?.comparisons?.totalRevenue} />
        <MetricCard label="Transactions" value={Number(metrics.transactions || 0).toLocaleString()} detail="Completed POS transactions." comparison={report?.comparisons?.transactions} />
        <MetricCard label="Items Sold" value={Number(metrics.itemsSold || 0).toLocaleString()} detail="Total product units sold." />
        <MetricCard label="Average Sale" value={formatPrimaryMoney(metrics.averageTransaction, settings, false)} detail="Average transaction value." />
        <MetricCard label="Discounts" value={formatPrimaryMoney(metrics.discountTotal, settings, false)} detail="Discount value given at POS." />
        <MetricCard label="Tax" value={formatPrimaryMoney(metrics.taxTotal, settings, false)} detail="Tax collected in POS sales." />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 text-[var(--foreground)] shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Payment method report</p>
          <h2 className="mt-1 text-base font-extrabold text-[var(--foreground)]">Payment Mix</h2>
          <div className="mt-4">
            {report?.paymentRevenue?.length ? (
              <ProgressRows rows={report.paymentRevenue} formatter={(value) => formatPrimaryMoney(value, settings, false)} />
            ) : (
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">No payment data yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 text-[var(--foreground)] shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Sales by product</p>
          <h2 className="mt-1 text-base font-extrabold text-[var(--foreground)]">Top Products</h2>
          <div className="mt-4">
            {report?.topProducts?.length ? (
              <ProgressRows rows={report.topProducts} formatter={(value) => `${value} sold`} />
            ) : (
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">No product sales yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
        <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
          <h2 className="text-base font-extrabold text-[var(--foreground)]">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead className="bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2.5">Transaction</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Discount</th>
                <th className="px-4 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {(report?.recentTransactions || []).map((transaction) => (
                <tr key={transaction.id} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                  <td className="px-4 py-2.5 font-bold font-mono text-[var(--foreground)]">{transaction.id}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--muted-foreground)]">{new Date(transaction.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-semibold capitalize text-[var(--foreground)]">{transaction.paymentMethod}</td>
                  <td className="px-4 py-2.5 font-semibold text-[var(--foreground)]">{transaction.itemCount}</td>
                  <td className="px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">{formatPrimaryMoney(transaction.discount, settings, false)}</td>
                  <td className="px-4 py-2.5 font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(transaction.total, settings, false)}</td>
                </tr>
              ))}
              {!report?.recentTransactions?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
                    No synced POS transactions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

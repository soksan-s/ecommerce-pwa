"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";
import { usePOSSettings } from "@/hooks/usePOSSettings";

const REPORT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "pos-sales", label: "Daily Sales" },
  { key: "pos-sales-detail", label: "Sales Detail" },
  { key: "pos-payment-summary", label: "Payment Summary" },
  { key: "pos-void-refund", label: "Void / Refund" },
];

const STATUS_TONES = {
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  open: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  refunded: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  voided: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

const PAYMENT_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "Cash", label: "Cash" },
  { value: "KHQR", label: "KHQR" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "OPEN", label: "Open" },
  { value: "VOIDED", label: "Voided" },
  { value: "REFUNDED", label: "Refunded" },
];

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

function formatCell(value, type, money) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return money(value);
  if (type === "percent") return `${Number(value || 0).toFixed(1)}%`;
  if (type === "int") return Number(value || 0).toLocaleString();
  if (type === "datetime") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  if (type === "date") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
  }
  return String(value);
}

function ReportTable({ data, sort, dir, onSort, loading, money }) {
  const { columns, rows, totalRow } = data;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-xs">
          <thead className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            <tr>
              {columns.map((column) => {
                const isSorted = sort === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    onClick={column.sortable !== false ? () => onSort(column.key) : undefined}
                    aria-sort={isSorted ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={
                      "px-4 py-2.5 " +
                      (column.align === "right" ? "text-right " : "") +
                      (column.sortable !== false ? "cursor-pointer select-none hover:text-[var(--foreground)]" : "")
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {isSorted ? (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted-foreground)]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading report…
                  </span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row._rowKey} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={
                        "px-4 py-2.5 " +
                        (column.align === "right" ? "text-right tabular-nums " : "") +
                        (column.key === "saleId" ? "font-bold font-mono text-[var(--foreground)]" : "font-medium text-[var(--foreground)]")
                      }
                    >
                      {column.type === "status" ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_TONES[String(row[column.key]).toLowerCase()] || "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"}`}>
                          {row[column.key]}
                        </span>
                      ) : (
                        formatCell(row[column.key], column.type, money)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-xs font-semibold text-[var(--muted-foreground)]">
                  No data for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
          {!loading && rows.length && totalRow ? (
            <tfoot className="border-t border-[var(--border-soft)] bg-[var(--surface-soft)]">
              <tr>
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={
                      "px-4 py-2.5 text-[11px] font-extrabold text-[var(--foreground)] " +
                      (column.align === "right" ? "text-right tabular-nums" : "")
                    }
                  >
                    {index === 0 ? "Total" : totalRow[column.key] !== undefined ? formatCell(totalRow[column.key], column.type, money) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function ReportPagination({ pagination, onPage, onPageSize }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">
        {pagination.total.toLocaleString()} row{pagination.total === 1 ? "" : "s"} · page {pagination.page} of {pagination.pageCount}
      </p>
      <div className="flex items-center gap-2">
        <select
          value={String(pagination.pageSize)}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 text-xs font-bold text-[var(--foreground)] outline-none"
          aria-label="Rows per page"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onPage(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] transition disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onPage(pagination.page + 1)}
          disabled={pagination.page >= pagination.pageCount}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] transition disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

const moneyFormatter = (value) => formatPrimaryMoney(value, {}, false);

export default function PosReportsPage() {
  const { settings } = usePOSSettings();
  const [tab, setTab] = useState("overview");

  // Shared date range (Overview + all report tabs)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");

  // Report-tab state
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null);
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const activeReport = useMemo(() => REPORT_TABS.find((entry) => entry.key === tab) || REPORT_TABS[0], [tab]);

  const reportQuery = useMemo(() => {
    if (activeReport.key === "overview") return null;
    const params = new URLSearchParams();
    params.set("report", activeReport.key);
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    if (paymentFilter) params.set("paymentMethod", paymentFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    if (sort) {
      params.set("sort", sort);
      params.set("dir", dir);
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [activeReport.key, startDate, endDate, paymentFilter, statusFilter, search, sort, dir, page, pageSize]);

  useEffect(() => {
    if (!reportQuery) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setReportLoading(true);
      try {
        const response = await fetch(`/api/pos/reports/data?${reportQuery}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !payload.data) {
          setReportError(payload.error || "Unable to load report.");
          setReportData(null);
        } else {
          setReportData(payload.data);
          setReportError("");
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        setReportError("Unable to load report.");
        setReportData(null);
      } finally {
        setReportLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [reportQuery]);

  function handleTabSelect(key) {
    setTab(key);
    setReportData(null);
    setReportError("");
    setPage(1);
    setSort(null);
    setDir("desc");
  }

  function handleSort(key) {
    if (sort === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir("desc");
    }
    setPage(1);
  }

  function handleExport(format) {
    const params = new URLSearchParams();
    params.set("report", activeReport.key);
    params.set("format", format);
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    if (paymentFilter) params.set("paymentMethod", paymentFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    if (sort) {
      params.set("sort", sort);
      params.set("dir", dir);
    }
    const link = document.createElement("a");
    link.href = `/api/pos/reports/export?${params.toString()}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const metrics = report?.metrics || {
    totalRevenue: 0,
    transactions: 0,
    itemsSold: 0,
    averageTransaction: 0,
    discountTotal: 0,
    taxTotal: 0,
  };
  const money = (value) => formatPrimaryMoney(value, settings, false);

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
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {message}
        </div>
      ) : null}

      {/* Report tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-1.5 shadow-xs">
        {REPORT_TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => handleTabSelect(entry.key)}
            className={
              tab === entry.key
                ? "rounded-xl bg-[var(--pos-action)] px-3.5 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all"
                : "rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Revenue" value={money(metrics.totalRevenue)} detail="Total synced POS revenue." comparison={report?.comparisons?.totalRevenue} />
            <MetricCard label="Transactions" value={Number(metrics.transactions || 0).toLocaleString()} detail="Completed POS transactions." comparison={report?.comparisons?.transactions} />
            <MetricCard label="Items Sold" value={Number(metrics.itemsSold || 0).toLocaleString()} detail="Total product units sold." />
            <MetricCard label="Average Sale" value={money(metrics.averageTransaction)} detail="Average transaction value." />
            <MetricCard label="Discounts" value={money(metrics.discountTotal)} detail="Discount value given at POS." />
            <MetricCard label="Tax" value={money(metrics.taxTotal)} detail="Tax collected in POS sales." />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 text-[var(--foreground)] shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Payment method report</p>
              <h2 className="mt-1 text-base font-extrabold text-[var(--foreground)]">Payment Mix</h2>
              <div className="mt-4">
                {report?.paymentRevenue?.length ? (
                  <ProgressRows rows={report.paymentRevenue} formatter={moneyFormatter} />
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
                    <th className="px-4 py-2.5">Sale ID</th>
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
                      <td className="px-4 py-2.5 font-bold font-mono text-[var(--foreground)]">{transaction.receiptNumber || transaction.id}</td>
                      <td className="px-4 py-2.5 font-medium text-[var(--muted-foreground)]">{new Date(transaction.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold capitalize text-[var(--foreground)]">{transaction.paymentMethod}</td>
                      <td className="px-4 py-2.5 font-semibold text-[var(--foreground)]">{transaction.itemCount}</td>
                      <td className="px-4 py-2.5 font-semibold text-[var(--muted-foreground)]">{money(transaction.discount)}</td>
                      <td className="px-4 py-2.5 font-extrabold text-[var(--foreground)]">{money(transaction.total)}</td>
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
        </>
      ) : (
        <>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs md:flex-row md:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">POS Report</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--foreground)]">{reportData?.reportName || activeReport.label}</h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--muted-foreground)]">{reportData?.range?.label ? `Period: ${reportData.range.label}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={paymentFilter}
                onChange={(event) => {
                  setPaymentFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 text-xs font-bold text-[var(--foreground)] outline-none"
                aria-label="Payment method"
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 text-xs font-bold text-[var(--foreground)] outline-none"
                aria-label="Sale status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search…"
                className="h-9 w-36 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
              />
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pos-action)] px-3 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <FileText className="size-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)] active:scale-[0.98]"
              >
                <FileSpreadsheet className="size-3.5" />
                CSV
              </button>
            </div>
          </div>

          {reportError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
              {reportError}
            </div>
          ) : null}

          {reportData ? (
            <>
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {(reportData.summaryCards || []).map((card) => (
                  <MetricCard
                    key={card.key}
                    label={card.label}
                    value={card.type === "money" ? money(reportData.summary[card.key] ?? 0) : Number(reportData.summary[card.key] ?? 0).toLocaleString()}
                    detail=""
                  />
                ))}
              </div>

              <ReportTable data={reportData} sort={sort} dir={dir} onSort={handleSort} loading={reportLoading} money={money} />

              <ReportPagination
                pagination={reportData.pagination}
                onPage={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), reportData.pagination.pageCount))}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] py-16 shadow-xs">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                <Download className="size-4" />
                Loading report…
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

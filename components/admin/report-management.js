"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  ReceiptText,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";

import {
  RANGE_PRESETS,
  REPORT_CATEGORIES,
  REPORTS,
  STATIC_FILTER_OPTIONS,
} from "@/lib/reports/registry";
import { cn, formatCurrency } from "@/lib/utils";

const CATEGORY_ICONS = {
  sales: ShoppingBag,
  orders: ReceiptText,
  inventory: Package,
  additional: Users,
};

const DYNAMIC_OPTION_SOURCES = {
  cashier: { metaKey: "cashiers", valueKey: null, labelKey: null, allLabel: "All Cashiers" },
  category: { metaKey: "categories", valueKey: "id", labelKey: "name", allLabel: "All Categories" },
  brand: { metaKey: "brands", valueKey: "id", labelKey: "name", allLabel: "All Brands" },
  customer: { metaKey: "customers", valueKey: "id", labelKey: "name", allLabel: "All Customers" },
};

const STATUS_TONES = {
  completed: "success",
  paid: "success",
  delivered: "success",
  "in stock": "success",
  ready: "success",
  shipped: "info",
  confirmed: "info",
  processing: "info",
  preparing: "info",
  picking: "info",
  packing: "info",
  open: "warning",
  pending: "warning",
  partial: "warning",
  "low stock": "warning",
  cancelled: "danger",
  voided: "danger",
  failed: "danger",
  expired: "danger",
  refunded: "danger",
  returned: "danger",
  "out of stock": "danger",
};

const TONE_CLASSES = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  neutral: "bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
};

function formatDateValue(value, type) {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (type === "datetime") {
    return date.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCell(value, type) {
  if (type === "rank") return `#${value}`;
  if (type === "money") return formatCurrency(value);
  if (type === "percent") return `${Number(value || 0).toFixed(1)}%`;
  if (type === "int") return Number(value || 0).toLocaleString();
  if (type === "datetime" || type === "date") return formatDateValue(value, type);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function StatusBadge({ value }) {
  const label = String(value ?? "—");
  const tone = STATUS_TONES[label.toLowerCase()] || "neutral";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap", TONE_CLASSES[tone])}>
      {label}
    </span>
  );
}

function defaultFilters(report) {
  const filters = {
    preset: report.defaultRange || "this_month",
    from: "",
    to: "",
    search: "",
  };
  for (const key of report.filters) {
    if (key !== "range") filters[key] = "";
  }
  return filters;
}

function buildQuery(reportId, filters, sort, dir, page, pageSize) {
  const params = new URLSearchParams();
  params.set("report", reportId);
  if (filters.preset === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  } else {
    params.set("range", filters.preset);
  }
  for (const [key, value] of Object.entries(filters)) {
    if (["preset", "from", "to", "search"].includes(key)) continue;
    if (value) params.set(key, value);
  }
  if (filters.search) params.set("search", filters.search);
  if (sort) params.set("sort", sort);
  if (dir) params.set("dir", dir);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

// ─────────────────────────────────────────────────────────────────────────────

function ReportNavigator({ activeId, onSelect }) {
  return (
    <nav aria-label="Report categories" className="space-y-4">
      {REPORT_CATEGORIES.map((category) => {
        const CategoryIcon = CATEGORY_ICONS[category.key] || ClipboardList;
        const reports = REPORTS.filter((report) => report.category === category.key);
        return (
          <div key={category.key}>
            <p className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              <CategoryIcon className="size-3" />
              {category.label}
            </p>
            <div className="mt-1.5 space-y-0.5">
              {reports.map((report, index) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => onSelect(report.id)}
                  aria-current={activeId === report.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all",
                    activeId === report.id
                      ? "bg-[var(--action)] text-white shadow-xs"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                  )}
                >
                  <span className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black",
                    activeId === report.id ? "bg-white/20" : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                  )}>
                    {index + 1}
                  </span>
                  <span className="truncate">{report.name.replace(/ Report$/, "")}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function FilterBar({ report, filters, meta, onChange, onApply, onReset }) {
  const selectClass = "h-9 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]";

  function renderSelect(filterKey) {
    if (STATIC_FILTER_OPTIONS[filterKey]) {
      return (
        <select
          key={filterKey}
          value={filters[filterKey] || ""}
          onChange={(event) => onChange(filterKey, event.target.value)}
          className={selectClass}
          aria-label={filterKey}
        >
          {STATIC_FILTER_OPTIONS[filterKey].map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    const source = DYNAMIC_OPTION_SOURCES[filterKey];
    if (source) {
      const options = meta[source.metaKey] || [];
      return (
        <select
          key={filterKey}
          value={filters[filterKey] || ""}
          onChange={(event) => onChange(filterKey, event.target.value)}
          className={selectClass}
          aria-label={filterKey}
        >
          <option value="">{source.allLabel}</option>
          {options.map((option) => (
            <option
              key={source.valueKey ? option[source.valueKey] : option}
              value={source.valueKey ? option[source.valueKey] : option}
            >
              {source.labelKey ? option[source.labelKey] : option}
            </option>
          ))}
        </select>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.preset}
        onChange={(event) => onChange("preset", event.target.value)}
        className={selectClass}
        aria-label="Date range preset"
      >
        {RANGE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>{preset.label}</option>
        ))}
      </select>

      {filters.preset === "custom" ? (
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-1">
          <input
            type="date"
            value={filters.from}
            onChange={(event) => onChange("from", event.target.value)}
            className="bg-transparent text-xs font-bold text-[var(--foreground)] outline-none"
            aria-label="From date"
          />
          <span className="text-xs font-bold text-[var(--muted-foreground)]">to</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => onChange("to", event.target.value)}
            className="bg-transparent text-xs font-bold text-[var(--foreground)] outline-none"
            aria-label="To date"
          />
        </div>
      ) : null}

      {report.filters.filter((key) => key !== "range").map((key) => renderSelect(key))}

      <div className="relative min-w-[11rem] flex-1 sm:max-w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder="Search…"
          className="h-9 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] pl-8 pr-3 text-xs font-semibold text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]"
        />
      </div>

      <button
        type="button"
        onClick={onApply}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--action)] px-3.5 text-xs font-extrabold text-[var(--action-foreground)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Apply Filter
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-9 items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 text-xs font-bold text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
      >
        Reset
      </button>
    </div>
  );
}

function SummaryCards({ cards, summary }) {
  if (!cards.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{card.label}</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
            {formatCell(summary[card.key] ?? 0, card.type)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReportTable({ report, data, sort, dir, onSort, loading }) {
  const { columns, rows, totalRow } = data;
  const colCount = columns.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)]">
            <tr>
              {columns.map((column) => {
                const isSorted = sort === column.key;
                const canSort = column.sortable !== false;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      canSort && "cursor-pointer select-none hover:text-[var(--foreground)]"
                    )}
                    onClick={canSort ? () => onSort(column.key) : undefined}
                    aria-sort={isSorted ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {isSorted ? (
                        dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading report data…
                  </span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row._rowKey} className="transition-colors hover:bg-[var(--surface-soft)]/50">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-2.5 font-medium text-[var(--foreground)]",
                        column.align === "right" && "text-right tabular-nums",
                        column.align === "center" && "text-center",
                        (column.type === "money" || column.type === "int" || column.type === "percent") && "tabular-nums"
                      )}
                    >
                      {column.type === "status" ? <StatusBadge value={row[column.key]} /> : formatCell(row[column.key], column.type)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center">
                  <ClipboardList className="mx-auto size-6 text-[var(--muted-foreground)] opacity-40" />
                  <p className="mt-2 text-xs font-bold text-[var(--foreground)]">No data for the selected filters</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                    Try widening the date range or clearing a filter.
                  </p>
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
                    className={cn(
                      "px-3 py-2.5 text-[11px] font-extrabold text-[var(--foreground)]",
                      column.align === "right" && "text-right tabular-nums",
                      column.align === "center" && "text-center"
                    )}
                  >
                    {index === 0 ? "Total" : totalRow[column.key] !== undefined ? formatCell(totalRow[column.key], column.type) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function Pagination({ pagination, onPage, onPageSize }) {
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

// ─────────────────────────────────────────────────────────────────────────────

export function AdminReportsPageView() {
  const [reportId, setReportId] = useState("daily-sales");
  const report = useMemo(() => REPORTS.find((item) => item.id === reportId) || REPORTS[0], [reportId]);

  const [filters, setFilters] = useState(() => defaultFilters(REPORTS[0]));
  const [sort, setSort] = useState(REPORTS[0].defaultSort.sort);
  const [dir, setDir] = useState(REPORTS[0].defaultSort.dir);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const requestRef = useRef(0);

  function selectReport(nextId) {
    const nextReport = REPORTS.find((item) => item.id === nextId);
    if (!nextReport || nextId === reportId) return;
    setReportId(nextId);
    setFilters(defaultFilters(nextReport));
    setSort(nextReport.defaultSort.sort);
    setDir(nextReport.defaultSort.dir);
    setPage(1);
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  function handleSort(key) {
    if (sort === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir("desc");
    }
    setPage(1);
  }

  function handleReset() {
    setFilters(defaultFilters(report));
    setSort(report.defaultSort.sort);
    setDir(report.defaultSort.dir);
    setPage(1);
  }

  const queryString = useMemo(
    () => buildQuery(reportId, filters, sort, dir, page, pageSize),
    [reportId, filters, sort, dir, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/data?${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (requestRef.current !== requestId) return;
        if (!response.ok || !payload.data) {
          setError(payload.error || "Unable to load report data.");
          setData(null);
        } else {
          setData(payload.data);
          setError("");
        }
      } catch (fetchError) {
        if (fetchError.name === "AbortError") return;
        setError("Unable to load report data.");
        setData(null);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [queryString, reloadToken]);

  function handleExport(format) {
    const params = new URLSearchParams(queryString);
    params.delete("page");
    params.delete("pageSize");
    params.set("report", reportId);
    params.set("format", format);
    const link = document.createElement("a");
    link.href = `/api/reports/export?${params.toString()}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        {/* Report navigator */}
        <aside className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3 shadow-xs">
          <div className="hidden xl:block">
            <p className="px-2 pb-3 pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--foreground)]">Report Management</p>
            <ReportNavigator activeId={reportId} onSelect={selectReport} />
          </div>
          <div className="xl:hidden">
            <select
              value={reportId}
              onChange={(event) => selectReport(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--foreground)] outline-none"
              aria-label="Select report"
            >
              {REPORT_CATEGORIES.map((category) => (
                <optgroup key={category.key} label={category.label}>
                  {REPORTS.filter((item) => item.category === category.key).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </aside>

        {/* Main panel */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs md:flex-row md:items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--action)]">
                {REPORT_CATEGORIES.find((category) => category.key === report.category)?.label}
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-[var(--foreground)]">{report.name}</h1>
              <p className="mt-0.5 max-w-2xl text-xs font-medium text-[var(--muted-foreground)]">{report.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--action)] px-3.5 py-2 text-xs font-extrabold text-[var(--action-foreground)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <FileText className="size-3.5" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)] active:scale-[0.98]"
              >
                <FileSpreadsheet className="size-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs">
            <FilterBar
              report={report}
              filters={filters}
              meta={data?.meta || {}}
              onChange={handleFilterChange}
              onApply={() => setReloadToken((token) => token + 1)}
              onReset={handleReset}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          ) : null}

          <SummaryCards cards={report.summaryCards} summary={data?.summary || {}} />

          {data ? (
            <>
              <ReportTable
                report={report}
                data={data}
                sort={sort}
                dir={dir}
                onSort={handleSort}
                loading={loading}
              />
              <Pagination
                pagination={data.pagination}
                onPage={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), data.pagination.pageCount))}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] py-16 shadow-xs">
              {loading ? (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading report data…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                  <Download className="size-4" />
                  Select a report to begin.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

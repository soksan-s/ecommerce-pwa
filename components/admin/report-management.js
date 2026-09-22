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
  cashier: {
    metaKey: "cashiers",
    valueKey: null,
    labelKey: null,
    allLabel: "All Cashiers",
  },
  category: {
    metaKey: "categories",
    valueKey: "id",
    labelKey: "name",
    allLabel: "All Categories",
  },
  brand: {
    metaKey: "brands",
    valueKey: "id",
    labelKey: "name",
    allLabel: "All Brands",
  },
  customer: {
    metaKey: "customers",
    valueKey: "id",
    labelKey: "name",
    allLabel: "All Customers",
  },
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
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  info:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  neutral:
    "bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
};

const KHMER_TEXT = {
  "Report Management": "ការគ្រប់គ្រងរបាយការណ៍",
  "Select report": "ជ្រើសរើសរបាយការណ៍",
  "Apply Filter": "អនុវត្តតម្រង",
  Reset: "កំណត់ឡើងវិញ",
  Search: "ស្វែងរក",
  "Export PDF": "នាំចេញ PDF",
  "Export CSV": "នាំចេញ CSV",
  "Loading report data…": "កំពុងផ្ទុកទិន្នន័យរបាយការណ៍…",
  "Select a report to begin.": "ជ្រើសរើសរបាយការណ៍ដើម្បីចាប់ផ្តើម។",
  "No data for the selected filters": "មិនមានទិន្នន័យសម្រាប់តម្រងដែលបានជ្រើស",
  "Try widening the date range or clearing a filter.":
    "សាកល្បងពង្រីកចន្លោះកាលបរិច្ឆេទ ឬលុបតម្រងមួយចំនួន។",
  "Previous page": "ទំព័រមុន",
  "Next page": "ទំព័របន្ទាប់",
  "Rows per page": "ចំនួនជួរដេកក្នុងមួយទំព័រ",
  "Date range preset": "ចន្លោះកាលបរិច្ឆេទ",
  "From date": "ចាប់ពីកាលបរិច្ឆេទ",
  "To date": "ដល់កាលបរិច្ឆេទ",
  to: "ដល់",
  Total: "សរុប",
  Today: "ថ្ងៃនេះ",
  Yesterday: "ម្សិលមិញ",
  "Last 7 Days": "៧ ថ្ងៃចុងក្រោយ",
  "This Month": "ខែនេះ",
  "All Cashiers": "អ្នកគិតលុយទាំងអស់",
  "All Categories": "ប្រភេទទាំងអស់",
  "All Brands": "ម៉ាកទាំងអស់",
  "All Customers": "អតិថិជនទាំងអស់",
};

const KHMER_REPORT_NAMES = {
  "Daily Sales Report": "របាយការណ៍ការលក់ប្រចាំថ្ងៃ",
  "Sales Summary Report": "របាយការណ៍សង្ខេបការលក់",
  "Best-Selling Products Report": "របាយការណ៍ផលិតផលលក់ដាច់បំផុត",
  "Sales by Payment Method Report":
    "របាយការណ៍ការលក់តាមវិធីទូទាត់",
  "Sales by Channel Report":
    "របាយការណ៍ការលក់តាមបណ្តាញ",
  "Order Report": "របាយការណ៍ការបញ្ជាទិញ",
  "Inventory Report": "របាយការណ៍សារពើភ័ណ្ឌ",
  "Low-Stock Report": "របាយការណ៍ស្តុកទាប",
  "Sales Return / Refund Report":
    "របាយការណ៍ការត្រឡប់ / សងប្រាក់",
  "Customer Purchase Report":
    "របាយការណ៍ការទិញរបស់អតិថិជន",
};

const KHMER_CATEGORY_NAMES = {
  "Sales Reports": "របាយការណ៍ការលក់",
  "Order Reports": "របាយការណ៍ការបញ្ជាទិញ",
  "Inventory Reports": "របាយការណ៍សារពើភ័ណ្ឌ",
  "Additional Reports": "របាយការណ៍បន្ថែម",
};

function getCurrentLanguage() {
  if (typeof document === "undefined") {
    return "en";
  }

  const htmlLanguage = (
    document.documentElement.getAttribute("lang") || ""
  ).toLowerCase();

  if (
    htmlLanguage === "km" ||
    htmlLanguage.startsWith("km-") ||
    htmlLanguage.startsWith("kh")
  ) {
    return "km";
  }

  try {
    const storedLanguage =
      localStorage.getItem("language") ||
      localStorage.getItem("locale") ||
      localStorage.getItem("lang") ||
      "";

    const normalized = storedLanguage.toLowerCase();

    if (
      normalized === "km" ||
      normalized.startsWith("km-") ||
      normalized.startsWith("kh")
    ) {
      return "km";
    }
  } catch {
    // Ignore localStorage access errors.
  }

  return "en";
}

function usePageLanguage() {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const updateLanguage = () => {
      setLanguage(getCurrentLanguage());
    };

    updateLanguage();

    const observer = new MutationObserver(updateLanguage);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    const intervalId = window.setInterval(updateLanguage, 500);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
    };
  }, []);

  return language;
}

function translateText(value, language) {
  if (language !== "km") {
    return value;
  }

  return KHMER_TEXT[value] || value;
}

function translateReportName(value, language) {
  if (language !== "km") {
    return value;
  }

  return KHMER_REPORT_NAMES[value] || value;
}

function translateCategoryName(value, language) {
  if (language !== "km") {
    return value;
  }

  return KHMER_CATEGORY_NAMES[value] || value;
}

function translateFilterLabel(value, language) {
  if (language !== "km") {
    return value;
  }

  return KHMER_TEXT[value] || value;
}

function formatDateValue(value, type, language = "en") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const locale = language === "km" ? "km-KH" : "en-GB";

  if (type === "datetime") {
    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCell(value, type, language = "en") {
  if (type === "rank") {
    return `#${value}`;
  }

  if (type === "money") {
    return formatCurrency(value);
  }

  if (type === "percent") {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  if (type === "int") {
    return Number(value || 0).toLocaleString(
      language === "km" ? "km-KH" : "en-US"
    );
  }

  if (type === "datetime" || type === "date") {
    return formatDateValue(value, type, language);
  }

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function StatusBadge({ value }) {
  const label = String(value ?? "—");
  const tone = STATUS_TONES[label.toLowerCase()] || "neutral";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-normal break-words",
        TONE_CLASSES[tone]
      )}
    >
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

  for (const key of report.filters || []) {
    if (key !== "range") {
      filters[key] = "";
    }
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
    if (["preset", "from", "to", "search"].includes(key)) {
      continue;
    }

    if (value) {
      params.set(key, value);
    }
  }

  if (filters.search) {
    params.set("search", filters.search);
  }

  if (sort) {
    params.set("sort", sort);
  }

  if (dir) {
    params.set("dir", dir);
  }

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return params.toString();
}

// Keep this report navigation structure unchanged.
function ReportNavigator({ activeId, onSelect }) {
  return (
    <nav aria-label="Report categories" className="space-y-4">
      {REPORT_CATEGORIES.map((category) => {
        const CategoryIcon =
          CATEGORY_ICONS[category.key] || ClipboardList;

        const reports = REPORTS.filter(
          (report) => report.category === category.key
        );

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
                  aria-current={
                    activeId === report.id ? "page" : undefined
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all",
                    activeId === report.id
                      ? "bg-[var(--action)] text-white shadow-xs"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black",
                      activeId === report.id
                        ? "bg-white/20"
                        : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                    )}
                  >
                    {index + 1}
                  </span>

                  <span className="truncate">
                    {report.name.replace(/ Report$/, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function FilterBar({
  report,
  filters,
  meta,
  onChange,
  onApply,
  onReset,
  language,
}) {
  const selectClass =
    "h-9 w-full min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]";

  function renderSelect(filterKey) {
    if (STATIC_FILTER_OPTIONS[filterKey]) {
      return (
        <select
          key={filterKey}
          value={filters[filterKey] || ""}
          onChange={(event) =>
            onChange(filterKey, event.target.value)
          }
          className={selectClass}
          aria-label={filterKey}
        >
          {STATIC_FILTER_OPTIONS[filterKey].map((option) => (
            <option key={option.value} value={option.value}>
              {translateFilterLabel(option.label, language)}
            </option>
          ))}
        </select>
      );
    }

    const source = DYNAMIC_OPTION_SOURCES[filterKey];

    if (!source) {
      return null;
    }

    const options = meta[source.metaKey] || [];

    return (
      <select
        key={filterKey}
        value={filters[filterKey] || ""}
        onChange={(event) =>
          onChange(filterKey, event.target.value)
        }
        className={selectClass}
        aria-label={filterKey}
      >
        <option value="">
          {translateFilterLabel(source.allLabel, language)}
        </option>

        {options.map((option) => {
          const value = source.valueKey
            ? option[source.valueKey]
            : option;

          const label = source.labelKey
            ? option[source.labelKey]
            : option;

          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <select
        value={filters.preset}
        onChange={(event) =>
          onChange("preset", event.target.value)
        }
        className={selectClass}
        aria-label={translateText("Date range preset", language)}
      >
        {RANGE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {translateFilterLabel(preset.label, language)}
          </option>
        ))}
      </select>

      {filters.preset === "custom" ? (
        <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-2">
          <div className="min-w-0">
            <label
              htmlFor="report-from-date"
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
            >
              {translateText("From date", language)}
            </label>

            <input
              id="report-from-date"
              type="date"
              value={filters.from}
              onChange={(event) =>
                onChange("from", event.target.value)
              }
              className="h-8 w-full min-w-0 rounded-md bg-transparent px-1 text-xs font-bold text-[var(--foreground)] outline-none"
              aria-label={translateText("From date", language)}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="report-to-date"
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
            >
              {translateText("To date", language)}
            </label>

            <input
              id="report-to-date"
              type="date"
              value={filters.to}
              onChange={(event) =>
                onChange("to", event.target.value)
              }
              min={filters.from || undefined}
              className="h-8 w-full min-w-0 rounded-md bg-transparent px-1 text-xs font-bold text-[var(--foreground)] outline-none"
              aria-label={translateText("To date", language)}
            />
          </div>
        </div>
      ) : null}

      {(report.filters || [])
        .filter((key) => key !== "range")
        .map((key) => renderSelect(key))}

      <div className="relative min-w-0 xl:col-span-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />

        <input
          type="search"
          value={filters.search}
          onChange={(event) =>
            onChange("search", event.target.value)
          }
          placeholder={translateText("Search", language)}
          className="h-9 w-full min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] pl-8 pr-3 text-xs font-semibold text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]"
        />
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-2">
        <button
          type="button"
          onClick={onApply}
          className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--action)] px-3 text-xs font-extrabold text-[var(--action-foreground)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {translateText("Apply Filter", language)}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 min-w-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 text-xs font-bold text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
        >
          {translateText("Reset", language)}
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ cards, summary, language }) {
  if (!cards || !cards.length) {
    return null;
  }

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs"
        >
          <p className="break-words text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {translateText(card.label, language)}
          </p>

          <p className="mt-1.5 break-words font-display text-xl font-bold tabular-nums tracking-tight text-[var(--foreground)] sm:text-2xl">
            {formatCell(
              summary[card.key] ?? 0,
              card.type,
              language
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function SortButton({
  column,
  sort,
  dir,
  onSort,
  language,
}) {
  const isSorted = sort === column.key;
  const canSort = column.sortable !== false;

  if (!canSort) {
    return (
      <span className="break-words">
        {column.label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className="inline-flex max-w-full items-center gap-1 break-words text-left hover:text-[var(--foreground)]"
      aria-label={translateText(
        `Sort by ${column.label}`,
        language
      )}
    >
      <span className="break-words">{column.label}</span>

      {isSorted ? (
        dir === "asc" ? (
          <ArrowUp className="size-3 shrink-0" />
        ) : (
          <ArrowDown className="size-3 shrink-0" />
        )
      ) : null}
    </button>
  );
}

function ReportTable({
  data,
  sort,
  dir,
  onSort,
  loading,
  language,
}) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const totalRow = data?.totalRow || null;

  const colCount = columns.length;

  if (!colCount) {
    return (
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-10 text-center shadow-xs">
        <ClipboardList className="mx-auto size-6 text-[var(--muted-foreground)] opacity-40" />
        <p className="mt-2 text-xs font-bold text-[var(--foreground)]">
          {translateText(
            "No data for the selected filters",
            language
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-xs">
      <div className="lg:hidden">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
              <Loader2 className="size-4 animate-spin" />
              {translateText(
                "Loading report data…",
                language
              )}
            </span>
          </div>
        ) : rows.length ? (
          <div className="divide-y divide-[var(--border-soft)]">
            {rows.map((row) => (
              <div
                key={row._rowKey}
                className="min-w-0 space-y-3 p-4 transition-colors hover:bg-[var(--surface-soft)]/50"
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="grid min-w-0 grid-cols-[minmax(88px,34%)_minmax(0,1fr)] items-start gap-3"
                  >
                    <div className="min-w-0 break-words text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {column.label}
                    </div>

                    <div
                      className={cn(
                        "min-w-0 break-words text-xs font-medium text-[var(--foreground)]",
                        column.align === "right" &&
                        "text-right tabular-nums",
                        column.align === "center" &&
                        "text-center",
                        (column.type === "money" ||
                          column.type === "int" ||
                          column.type === "percent") &&
                        "tabular-nums"
                      )}
                    >
                      {column.type === "status" ? (
                        <StatusBadge value={row[column.key]} />
                      ) : (
                        formatCell(
                          row[column.key],
                          column.type,
                          language
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {!loading && rows.length && totalRow ? (
              <div className="min-w-0 bg-[var(--surface-soft)] p-4">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--foreground)]">
                  {translateText("Total", language)}
                </div>

                <div className="space-y-2.5">
                  {columns.map((column, index) => {
                    if (
                      index === 0 ||
                      totalRow[column.key] === undefined
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={column.key}
                        className="grid min-w-0 grid-cols-[minmax(88px,34%)_minmax(0,1fr)] gap-3"
                      >
                        <span className="min-w-0 break-words text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                          {column.label}
                        </span>

                        <span className="min-w-0 break-words text-xs font-extrabold text-[var(--foreground)]">
                          {formatCell(
                            totalRow[column.key],
                            column.type,
                            language
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <ClipboardList className="mx-auto size-6 text-[var(--muted-foreground)] opacity-40" />

            <p className="mt-2 text-xs font-bold text-[var(--foreground)]">
              {translateText(
                "No data for the selected filters",
                language
              )}
            </p>

            <p className="mt-0.5 break-words text-[11px] font-medium text-[var(--muted-foreground)]">
              {translateText(
                "Try widening the date range or clearing a filter.",
                language
              )}
            </p>
          </div>
        )}
      </div>

      <div className="hidden min-w-0 lg:block">
        <table className="w-full table-fixed text-left text-[10px]">
          <thead className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "min-w-0 px-2.5 py-3 align-top text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--muted-foreground)] xl:px-3 xl:text-[10px]",
                    column.align === "right" &&
                    "text-right",
                    column.align === "center" &&
                    "text-center"
                  )}
                  aria-sort={
                    sort === column.key
                      ? dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <SortButton
                    column={column}
                    sort={sort}
                    dir={dir}
                    onSort={onSort}
                    language={language}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-soft)]">
            {loading ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-12 text-center"
                >
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                    <Loader2 className="size-4 animate-spin" />
                    {translateText(
                      "Loading report data…",
                      language
                    )}
                  </span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr
                  key={row._rowKey}
                  className="transition-colors hover:bg-[var(--surface-soft)]/50"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "min-w-0 max-w-0 px-2.5 py-3 align-top font-medium text-[var(--foreground)] xl:px-3",
                        column.align === "right" &&
                        "text-right tabular-nums",
                        column.align === "center" &&
                        "text-center",
                        (column.type === "money" ||
                          column.type === "int" ||
                          column.type === "percent") &&
                        "tabular-nums"
                      )}
                    >
                      <div className="min-w-0 break-words">
                        {column.type === "status" ? (
                          <StatusBadge
                            value={row[column.key]}
                          />
                        ) : (
                          formatCell(
                            row[column.key],
                            column.type,
                            language
                          )
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-12 text-center"
                >
                  <ClipboardList className="mx-auto size-6 text-[var(--muted-foreground)] opacity-40" />

                  <p className="mt-2 text-xs font-bold text-[var(--foreground)]">
                    {translateText(
                      "No data for the selected filters",
                      language
                    )}
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                    {translateText(
                      "Try widening the date range or clearing a filter.",
                      language
                    )}
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
                      "min-w-0 max-w-0 px-2.5 py-3 text-[10px] font-extrabold text-[var(--foreground)] xl:px-3",
                      column.align === "right" &&
                      "text-right tabular-nums",
                      column.align === "center" &&
                      "text-center"
                    )}
                  >
                    <div className="min-w-0 break-words">
                      {index === 0
                        ? translateText("Total", language)
                        : totalRow[column.key] !== undefined
                          ? formatCell(
                            totalRow[column.key],
                            column.type,
                            language
                          )
                          : ""}
                    </div>
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

function Pagination({
  pagination,
  onPage,
  onPageSize,
  language,
}) {
  const total = Number(pagination?.total || 0);
  const currentPage = Number(pagination?.page || 1);
  const pageCount = Math.max(
    Number(pagination?.pageCount || 1),
    1
  );
  const pageSize = Number(pagination?.pageSize || 25);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 break-words text-xs font-semibold text-[var(--muted-foreground)]">
        {total.toLocaleString(
          language === "km" ? "km-KH" : "en-US"
        )}{" "}
        {total === 1 ? "row" : "rows"} · page {currentPage}{" "}
        of {pageCount}
      </p>

      <div className="flex min-w-0 items-center gap-2">
        <select
          value={String(pageSize)}
          onChange={(event) =>
            onPageSize(Number(event.target.value))
          }
          className="h-8 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 text-xs font-bold text-[var(--foreground)] outline-none"
          aria-label={translateText("Rows per page", language)}
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] transition disabled:opacity-40"
          aria-label={translateText(
            "Previous page",
            language
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => onPage(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] transition disabled:opacity-40"
          aria-label={translateText("Next page", language)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminReportsPageView() {
  const language = usePageLanguage();

  const [reportId, setReportId] = useState("daily-sales");

  const report = useMemo(
    () =>
      REPORTS.find((item) => item.id === reportId) ||
      REPORTS[0],
    [reportId]
  );

  const [filters, setFilters] = useState(() =>
    defaultFilters(REPORTS[0])
  );

  const [sort, setSort] = useState(
    REPORTS[0]?.defaultSort?.sort || ""
  );

  const [dir, setDir] = useState(
    REPORTS[0]?.defaultSort?.dir || "desc"
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const requestRef = useRef(0);

  function selectReport(nextId) {
    const nextReport = REPORTS.find(
      (item) => item.id === nextId
    );

    if (!nextReport || nextId === reportId) {
      return;
    }

    setReportId(nextId);
    setFilters(defaultFilters(nextReport));
    setSort(nextReport?.defaultSort?.sort || "");
    setDir(nextReport?.defaultSort?.dir || "desc");
    setPage(1);
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  }, []);

  function handleSort(key) {
    if (sort === key) {
      setDir((current) =>
        current === "asc" ? "desc" : "asc"
      );
    } else {
      setSort(key);
      setDir("desc");
    }

    setPage(1);
  }

  function handleReset() {
    setFilters(defaultFilters(report));
    setSort(report?.defaultSort?.sort || "");
    setDir(report?.defaultSort?.dir || "desc");
    setPage(1);
  }

  const queryString = useMemo(
    () =>
      buildQuery(
        reportId,
        filters,
        sort,
        dir,
        page,
        pageSize
      ),
    [reportId, filters, sort, dir, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      const requestId = requestRef.current + 1;

      requestRef.current = requestId;
      setLoading(true);

      try {
        const response = await fetch(
          `/api/reports/data?${queryString}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const payload = await response
          .json()
          .catch(() => ({}));

        if (requestRef.current !== requestId) {
          return;
        }

        if (!response.ok || !payload.data) {
          setError(
            payload.error || "Unable to load report data."
          );
          setData(null);
        } else {
          setData(payload.data);
          setError("");
        }
      } catch (fetchError) {
        if (fetchError?.name === "AbortError") {
          return;
        }

        setError("Unable to load report data.");
        setData(null);
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
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

  const category =
    REPORT_CATEGORIES.find(
      (item) => item.key === report.category
    ) || null;

  const mobileReports = REPORT_CATEGORIES.flatMap(
    (categoryItem) =>
      REPORTS.filter(
        (item) => item.category === categoryItem.key
      ).map((item) => ({
        ...item,
        categoryLabel: categoryItem.label,
      }))
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] overflow-x-hidden">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[230px_minmax(0,1fr)]">
          {/* Report navigator - kept unchanged */}
          <aside className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3 shadow-xs">
            <div className="hidden xl:block">
              <p className="px-2 pb-3 pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--foreground)]">
                Report Management
              </p>

              <ReportNavigator
                activeId={reportId}
                onSelect={selectReport}
              />
            </div>

            <div className="xl:hidden">
              <select
                value={reportId}
                onChange={(event) =>
                  selectReport(event.target.value)
                }
                className="h-10 w-full min-w-0 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--foreground)] outline-none"
                aria-label={translateText(
                  "Select report",
                  language
                )}
              >
                {REPORT_CATEGORIES.map((categoryItem) => (
                  <optgroup
                    key={categoryItem.key}
                    label={translateCategoryName(
                      categoryItem.label,
                      language
                    )}
                  >
                    {REPORTS.filter(
                      (item) =>
                        item.category === categoryItem.key
                    ).map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {translateReportName(
                          item.name,
                          language
                        )}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <div className="md:hidden min-w-0 overflow-x-hidden">
              <div className="flex min-w-0 flex-wrap gap-2">
                {mobileReports.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectReport(item.id)}
                    className={cn(
                      "max-w-full rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      item.id === reportId
                        ? "bg-[var(--action)] text-white shadow-xs"
                        : "border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
                    )}
                  >
                    <span className="block max-w-full truncate">
                      {translateReportName(
                        item.name.replace(/ Report$/, ""),
                        language
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <section className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs sm:p-5">
              <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--action)]">
                    {translateCategoryName(
                      category?.label || "",
                      language
                    )}
                  </p>

                  <h1 className="mt-1 break-words text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl">
                    {translateReportName(
                      report.name,
                      language
                    )}
                  </h1>

                  <p className="mt-1 max-w-3xl break-words text-xs font-medium text-[var(--muted-foreground)] sm:text-sm">
                    {report.description}
                  </p>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-2 md:w-auto md:shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--action)] px-3.5 py-2 text-xs font-extrabold text-[var(--action-foreground)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <FileText className="size-3.5 shrink-0" />

                    <span className="truncate">
                      {translateText(
                        "Export PDF",
                        language
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)] active:scale-[0.98]"
                  >
                    <FileSpreadsheet className="size-3.5 shrink-0" />

                    <span className="truncate">
                      {translateText(
                        "Export CSV",
                        language
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs sm:p-4">
              <FilterBar
                report={report}
                filters={filters}
                meta={data?.meta || {}}
                onChange={handleFilterChange}
                onApply={() =>
                  setReloadToken(
                    (token) => token + 1
                  )
                }
                onReset={handleReset}
                language={language}
              />
            </section>

            {error ? (
              <div className="min-w-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold break-words text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </div>
            ) : null}

            <SummaryCards
              cards={report.summaryCards || []}
              summary={data?.summary || {}}
              language={language}
            />

            {data ? (
              <>
                <ReportTable
                  data={data}
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                  loading={loading}
                  language={language}
                />

                <Pagination
                  pagination={data.pagination || {}}
                  onPage={(nextPage) =>
                    setPage(
                      Math.min(
                        Math.max(nextPage, 1),
                        Math.max(
                          Number(
                            data.pagination?.pageCount || 1
                          ),
                          1
                        )
                      )
                    )
                  }
                  onPageSize={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  language={language}
                />
              </>
            ) : (
              <div className="flex min-w-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-16 shadow-xs">
                {loading ? (
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                    <Loader2 className="size-4 shrink-0 animate-spin" />

                    <span className="break-words">
                      {translateText(
                        "Loading report data…",
                        language
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                    <Download className="size-4 shrink-0" />

                    <span className="break-words">
                      {translateText(
                        "Select a report to begin.",
                        language
                      )}
                    </span>
                  </span>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
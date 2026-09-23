"use client";

import {
  ChevronRight,
  DollarSign,
  Package,
  Printer,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";
import { getAll, put } from "@/lib/db";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { usePosStore } from "@/store/posStore";

const fallbackStats = {
  revenue: 0,
  transactions: 0,
  itemsSold: 0,
  pendingSync: 0,
};

const HOURS = Array.from({ length: 13 }, (_, index) => index + 7);

const TEXT = {
  en: {
    dashboard: "Dashboard",
    overview: "POS Overview",
    date: "Date",
    todayRevenue: "Today's Revenue",
    transactions: "Transactions",
    itemsSold: "Items Sold",
    pendingSync: "Pending Sync",

    salesPendingSync: (count) =>
      `${count} sales pending sync — will upload automatically when online.`,

    offlineMode:
      "Offline mode: dashboard stats are loaded from local transactions.",

    avgTicket: "Avg ticket",
    itemsPerCustomer: "items per customer",
    allOfflineSynced: "All offline sales synchronized",

    hourlySales: "Hourly Sales & Traffic Peak",
    hourlyDescription: "Today's sales activity by hour",
    revenue: "Revenue (KHR)",
    orders: "Orders",
    now: "(Now)",

    fastVelocity: "Fast Velocity",
    topSelling: "Top Selling Items Today",
    byUnits: "By Units",

    onlineOrders: "Online Orders & Transactions",
    onlineOrdersDescription:
      "Real-time receipts processed by local terminal",

    all: "All",
    khqr: "KHQR",
    cash: "Cash",

    orderIdTime: "Order ID / Time",
    itemsSummary: "Items Summary",
    method: "Method",
    totalKhr: "Total (KHR)",
    usd: "USD",
    status: "Status",
    action: "Action",

    paid: "PAID",
    printReceipt: "Print Receipt",

    showing: "Showing",
    of: "of",
    ordersLabel: "orders",
    viewAll: "View All Transactions",

    itemsTotal: (count) => `${count} items total`,
    unit: "units",
    inStock: (count) => `${count} in stock`,
    soldToday: (count) => `${count} sold today`,

    noTransactions: "No transactions recorded today.",
    noProducts: "No products sold today.",

    other: "OTHER",
  },

  km: {
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    overview: "ទិដ្ឋភាពទូទៅ POS",
    date: "កាលបរិច្ឆេទ",
    todayRevenue: "ចំណូលថ្ងៃនេះ",
    transactions: "ប្រតិបត្តិការ",
    itemsSold: "ទំនិញបានលក់",
    pendingSync: "រង់ចាំធ្វើសមកាលកម្ម",

    salesPendingSync: (count) =>
      `ការលក់ ${count} កំពុងរង់ចាំធ្វើសមកាលកម្ម — នឹងផ្ទុកឡើងដោយស្វ័យប្រវត្តិនៅពេលមានអ៊ីនធឺណិត។`,

    offlineMode:
      "របៀបក្រៅបណ្តាញ៖ ទិន្នន័យស្ថិតិផ្ទាំងគ្រប់គ្រងត្រូវបានផ្ទុកពីប្រតិបត្តិការក្នុងម៉ាស៊ីន។",

    avgTicket: "មធ្យមក្នុងមួយវិក្កយបត្រ",
    itemsPerCustomer: "ទំនិញក្នុងមួយអតិថិជន",
    allOfflineSynced: "ការលក់ក្រៅបណ្តាញទាំងអស់បានធ្វើសមកាលកម្ម",

    hourlySales: "ការលក់ប្រចាំម៉ោង និងម៉ោងអតិថិជនកំពូល",
    hourlyDescription: "សកម្មភាពលក់ថ្ងៃនេះតាមម៉ោង",
    revenue: "ចំណូល (KHR)",
    orders: "ការបញ្ជាទិញ",
    now: "(ឥឡូវនេះ)",

    fastVelocity: "លក់លឿន",
    topSelling: "ទំនិញលក់ដាច់ថ្ងៃនេះ",
    byUnits: "តាមចំនួន",

    onlineOrders: "ការបញ្ជាទិញ និងប្រតិបត្តិការ",
    onlineOrdersDescription:
      "វិក្កយបត្រដែលបានដំណើរការតាម POS ក្នុងពេលជាក់ស្តែង",

    all: "ទាំងអស់",
    khqr: "KHQR",
    cash: "សាច់ប្រាក់",

    orderIdTime: "លេខបញ្ជាទិញ / ម៉ោង",
    itemsSummary: "សង្ខេបទំនិញ",
    method: "វិធីទូទាត់",
    totalKhr: "សរុប (KHR)",
    usd: "USD",
    status: "ស្ថានភាព",
    action: "សកម្មភាព",

    paid: "បានបង់",
    printReceipt: "បោះពុម្ពវិក្កយបត្រ",

    showing: "បង្ហាញ",
    of: "នៃ",
    ordersLabel: "ការបញ្ជាទិញ",
    viewAll: "មើលប្រតិបត្តិការទាំងអស់",

    itemsTotal: (count) => `សរុប ${count} ទំនិញ`,
    unit: "ឯកតា",
    inStock: (count) => `នៅសល់ ${count} ក្នុងស្តុក`,
    soldToday: (count) => `លក់បាន ${count} ថ្ងៃនេះ`,

    noTransactions: "មិនមានប្រតិបត្តិការសម្រាប់ថ្ងៃនេះទេ។",
    noProducts: "មិនមានទំនិញបានលក់នៅថ្ងៃនេះទេ។",

    other: "ផ្សេងៗ",
  },
};

function getTodayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toLocalDateKey(value) {
  if (!value) return "";

  const raw = String(value);

  // Keep date-only values untouched.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTimestamp(entry) {
  return (
    entry?.timestamp ??
    entry?.createdAt ??
    entry?.created_at ??
    entry?.date ??
    null
  );
}

function getTransactionItems(entry) {
  return Array.isArray(entry?.items) ? entry.items : [];
}

function getItemName(item) {
  return (
    item?.name ??
    item?.productName ??
    item?.product_name ??
    item?.title ??
    item?.product?.name ??
    item?.product?.title ??
    "Unknown Product"
  );
}

function getItemQty(item) {
  return Number(item?.qty ?? item?.quantity ?? item?.count ?? 0) || 0;
}

function getItemUnitPrice(item) {
  const value =
    item?.unitPrice ??
    item?.unit_price ??
    item?.price ??
    item?.sellingPrice ??
    item?.selling_price ??
    item?.product?.sellingPrice ??
    item?.product?.price;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function getItemUnit(item) {
  return (
    item?.unitLabel ??
    item?.unit_label ??
    item?.unit ??
    item?.packaging ??
    item?.product?.unitLabel ??
    item?.product?.unit ??
    ""
  );
}

function getItemStock(item) {
  const value =
    item?.stock ??
    item?.stockQty ??
    item?.stockQuantity ??
    item?.inventory ??
    item?.product?.stock ??
    item?.product?.stockQty ??
    item?.product?.stockQuantity;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function getPaymentMethod(entry) {
  const raw =
    entry?.paymentMethod ??
    entry?.payment_method ??
    entry?.method ??
    entry?.paymentType ??
    entry?.payment_type ??
    "";

  const normalized = String(raw).trim().toUpperCase();

  if (normalized.includes("KHQR") || normalized.includes("BAKONG")) {
    return "KHQR";
  }

  if (normalized.includes("CASH")) {
    return "CASH";
  }

  return normalized || "OTHER";
}

function getTransactionStatus(entry) {
  const raw = String(
    entry?.status ??
    entry?.paymentStatus ??
    entry?.payment_status ??
    "",
  )
    .trim()
    .toUpperCase();

  if (!raw || raw === "COMPLETED" || raw === "SUCCESS") {
    return "PAID";
  }

  return raw;
}

function getUsdAmount(entry) {
  const value =
    entry?.usdTotal ??
    entry?.usdAmount ??
    entry?.totalUsd ??
    entry?.totalUSD ??
    entry?.usd;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : "—";
}

function getTransactionTotal(entry) {
  return Number(
    entry?.total ??
    entry?.grandTotal ??
    entry?.grand_total ??
    entry?.amount ??
    entry?.totalAmount ??
    0,
  );
}

function getTransactionId(entry) {
  return (
    entry?.orderNumber ??
    entry?.order_number ??
    entry?.orderId ??
    entry?.order_id ??
    entry?.id ??
    "UNKNOWN"
  );
}

function formatDateTime(value, language) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const locale = language === "km" ? "km-KH" : "en-GB";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatTime(value, language) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(language === "km" ? "km-KH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getPageLanguage() {
  if (typeof document === "undefined") {
    return "en";
  }

  const htmlLanguage =
    document.documentElement.getAttribute("lang") ||
    document.documentElement.getAttribute("data-language") ||
    document.documentElement.getAttribute("data-lang") ||
    "";

  const normalized = htmlLanguage.toLowerCase();

  if (normalized.startsWith("km") || normalized.startsWith("kh")) {
    return "km";
  }

  return "en";
}

function usePageLanguage() {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const readLanguage = () => {
      setLanguage(getPageLanguage());
    };

    readLanguage();

    const observer = new MutationObserver(readLanguage);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang", "data-language", "data-lang"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return language;
}

function calculateStatsFromTransactions(transactions) {
  const todayKey = getTodayKey();

  const todaysTransactions = transactions.filter(
    (entry) =>
      entry?.type !== "stats" &&
      toLocalDateKey(getTimestamp(entry)) === todayKey,
  );

  return {
    revenue: todaysTransactions.reduce(
      (sum, entry) => sum + getTransactionTotal(entry),
      0,
    ),

    transactions: todaysTransactions.length,

    itemsSold: todaysTransactions.reduce(
      (sum, entry) =>
        sum +
        getTransactionItems(entry).reduce(
          (itemSum, item) => itemSum + getItemQty(item),
          0,
        ),
      0,
    ),

    pendingSync: todaysTransactions.filter((entry) => !entry?.synced).length,
  };
}

function getHourlySales(transactions) {
  return HOURS.map((hour) => {
    const matchingTransactions = transactions.filter((entry) => {
      const timestamp = getTimestamp(entry);

      if (!timestamp) {
        return false;
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return date.getHours() === hour;
    });

    const revenue = matchingTransactions.reduce(
      (sum, entry) => sum + getTransactionTotal(entry),
      0,
    );

    return {
      hour,
      revenue,
      orders: matchingTransactions.length,
    };
  });
}

function getTopProducts(transactions) {
  const productMap = new Map();

  for (const transaction of transactions) {
    for (const item of getTransactionItems(transaction)) {
      const name = getItemName(item);
      const qty = getItemQty(item);

      if (!qty) {
        continue;
      }

      const key = String(name).trim().toLowerCase();

      if (!key) {
        continue;
      }

      const existing = productMap.get(key);

      if (existing) {
        existing.qty += qty;

        if (existing.unitPrice == null) {
          existing.unitPrice = getItemUnitPrice(item);
        }

        if (!existing.unit) {
          existing.unit = getItemUnit(item);
        }

        if (existing.stock == null) {
          existing.stock = getItemStock(item);
        }

        continue;
      }

      productMap.set(key, {
        name,
        qty,
        unit: getItemUnit(item),
        unitPrice: getItemUnitPrice(item),
        stock: getItemStock(item),
      });
    }
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);
}

function getProductInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}

function getProductAccent(index) {
  const accents = [
    "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300",
  ];

  return accents[index % accents.length];
}

function buildItemsSummary(entry, t) {
  const items = getTransactionItems(entry);

  if (!items.length) {
    return {
      title: "—",
      subtitle: t.itemsTotal(0),
    };
  }

  const summary = items
    .slice(0, 2)
    .map((item) => `${getItemName(item)} (x${getItemQty(item)})`)
    .join(", ");

  const extraCount = Math.max(0, items.length - 2);

  return {
    title:
      extraCount > 0
        ? `${summary}, +${extraCount}`
        : summary,
    subtitle: t.itemsTotal(
      items.reduce((sum, item) => sum + getItemQty(item), 0),
    ),
  };
}

export default function PosDashboardPage() {
  const { isOnline, isOffline } = useOffline();
  const { settings } = usePOSSettings();

  const pendingSyncCount = usePosStore((state) => state.pendingSyncCount);
  const setPendingSyncCount = usePosStore(
    (state) => state.setPendingSyncCount,
  );

  const language = usePageLanguage();
  const t = TEXT[language];

  const [stats, setStats] = useState(fallbackStats);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transactionFilter, setTransactionFilter] = useState("ALL");

  useEffect(() => {
    let active = true;

    async function loadStats() {
      if (active) {
        setLoading(true);
      }

      try {
        const rawTransactions = await getAll("transactions");
        const safeTransactions = Array.isArray(rawTransactions)
          ? rawTransactions
          : [];

        const salesTransactions = safeTransactions.filter(
          (entry) => entry?.type !== "stats",
        );

        const localStats =
          calculateStatsFromTransactions(salesTransactions);

        const queuedResult = await getAll("offline_queue");
        const queued = Array.isArray(queuedResult) ? queuedResult : [];

        setPendingSyncCount(queued.length);

        if (active) {
          setTransactions(salesTransactions);

          setStats({
            ...localStats,
            pendingSync: queued.length,
          });
        }

        if (isOnline) {
          try {
            const response = await fetch("/api/pos/stats", {
              cache: "no-store",
            });

            if (response.ok) {
              const data = await response.json();
              const nextStats = data.data || data;
              const todayKey = getTodayKey();

              await put("transactions", {
                id: `stats-${todayKey}`,
                type: "stats",
                date: todayKey,
                ...nextStats,
                pendingSync: queued.length,
              });

              if (active) {
                setStats({
                  ...nextStats,
                  pendingSync: queued.length,
                });
              }
            }
          } catch {
            // Keep local IndexedDB stats when the backend is unavailable.
          }
        }
      } catch {
        if (active) {
          setStats(fallbackStats);
          setTransactions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [isOnline, setPendingSyncCount]);

  const todayTransactions = useMemo(() => {
    const todayKey = getTodayKey();

    return transactions
      .filter(
        (entry) =>
          entry?.type !== "stats" &&
          toLocalDateKey(getTimestamp(entry)) === todayKey,
      )
      .sort((a, b) => {
        const first = new Date(getTimestamp(a) || 0).getTime();
        const second = new Date(getTimestamp(b) || 0).getTime();

        return second - first;
      });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "ALL") {
      return todayTransactions;
    }

    return todayTransactions.filter(
      (entry) => getPaymentMethod(entry) === transactionFilter,
    );
  }, [todayTransactions, transactionFilter]);

  const visibleTransactions = filteredTransactions.slice(0, 4);

  const hourlySales = useMemo(
    () => getHourlySales(todayTransactions),
    [todayTransactions],
  );

  const topProducts = useMemo(
    () => getTopProducts(todayTransactions),
    [todayTransactions],
  );

  const maxHourlyRevenue = Math.max(
    1,
    ...hourlySales.map((item) => item.revenue),
  );

  const maxHourlyOrders = Math.max(
    1,
    ...hourlySales.map((item) => item.orders),
  );

  const peakHour = [...hourlySales].sort(
    (a, b) => b.orders - a.orders,
  )[0];

  const peakEndHour = peakHour ? peakHour.hour + 1 : null;

  const cards = [
    {
      label: t.todayRevenue,
      value: formatPrimaryMoney(stats.revenue, settings, false),
      icon: DollarSign,
      footer:
        stats.transactions > 0
          ? `${t.avgTicket}: ${formatPrimaryMoney(
            stats.revenue / stats.transactions,
            settings,
            false,
          )}`
          : null,
    },
    {
      label: t.transactions,
      value: Number(stats.transactions || 0).toLocaleString(),
      icon: ShoppingBag,
      footer:
        stats.transactions > 0
          ? `${t.avgTicket}: ${formatPrimaryMoney(
            stats.revenue / stats.transactions,
            settings,
            false,
          )}`
          : null,
    },
    {
      label: t.itemsSold,
      value: Number(stats.itemsSold || 0).toLocaleString(),
      icon: Package,
      footer:
        stats.transactions > 0
          ? `${(
            Number(stats.itemsSold || 0) /
            Number(stats.transactions || 1)
          ).toFixed(2)} ${t.itemsPerCustomer}`
          : null,
    },
    {
      label: t.pendingSync,
      value: Number(
        pendingSyncCount ?? stats.pendingSync ?? 0,
      ).toLocaleString(),
      icon: RefreshCw,
      footer:
        Number(pendingSyncCount ?? stats.pendingSync ?? 0) === 0
          ? t.allOfflineSynced
          : null,
    },
  ];

  const khqrCount = todayTransactions.filter(
    (entry) => getPaymentMethod(entry) === "KHQR",
  ).length;

  const cashCount = todayTransactions.filter(
    (entry) => getPaymentMethod(entry) === "CASH",
  ).length;

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <>
      <div
        data-pos-dashboard
        className="pos-dashboard-scroll w-full min-w-0 max-w-full overflow-x-hidden transition-colors"
      >
        <div className="mx-auto w-full max-w-[1400px] min-w-0 px-3 py-5 sm:px-4 sm:py-6 md:px-6 lg:px-8 lg:py-7">
          {/* Existing dashboard title + design date area */}
          <header className="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-[var(--pos-action)]">
                {t.dashboard}
              </span>

              <h1 className="mt-0.5 break-words font-display text-2xl font-bold tracking-tight text-[var(--foreground)]">
                {t.overview}
              </h1>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                <span className="shrink-0 text-[var(--muted-foreground)]">
                  {t.date}:
                </span>

                <span className="min-w-0 break-words font-mono text-[var(--foreground)]">
                  {formatDateTime(new Date(), language)}
                </span>
              </div>
            </div>
          </header>

          {/* Existing status messages */}
          {pendingSyncCount > 0 ? (
            <div className="mb-4 w-full min-w-0 border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              {t.salesPendingSync(pendingSyncCount)}
            </div>
          ) : null}

          {isOffline ? (
            <div className="mb-4 w-full min-w-0 border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">
              {t.offlineMode}
            </div>
          ) : null}

          {/* Metric cards */}
          <section
            className="mb-6 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-purpose="metrics-row"
          >
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <section
                  key={card.label}
                  className="flex min-w-0 flex-col justify-between border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 transition-colors"
                >
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 break-words text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                      {card.label}
                    </span>

                    <span className="grid size-7 shrink-0 place-items-center bg-[var(--surface-soft)] text-[var(--pos-action)]">
                      <Icon
                        className="size-4"
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  <div className="min-w-0">
                    {loading ? (
                      <div className="h-8 w-32 max-w-full animate-pulse bg-[var(--surface-soft)]" />
                    ) : (
                      <div className="break-words font-display text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                        {card.value}
                      </div>
                    )}

                    {card.footer ? (
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                        {card.label === t.pendingSync &&
                          Number(
                            pendingSyncCount ?? stats.pendingSync ?? 0,
                          ) === 0 ? (
                          <span className="inline-block size-1.5 shrink-0 bg-emerald-600" />
                        ) : null}

                        <span className="min-w-0 break-words">
                          {card.footer}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </section>

          {/* Main dashboard work area */}
          <div className="space-y-6">
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Hourly Sales */}
              <section
                className="flex min-w-0 flex-col border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5"
                data-purpose="hourly-performance"
              >
                <div className="mb-4 flex min-w-0 flex-col gap-3 border-b border-[var(--border-soft)] pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold uppercase tracking-tight text-[var(--foreground)]">
                      {t.hourlySales}
                    </h3>

                    <p className="mt-0.5 break-words text-xs text-[var(--muted-foreground)]">
                      {peakHour && peakHour.orders > 0
                        ? language === "km"
                          ? `ចំនួនអតិថិជនខ្ពស់បំផុតនៅចន្លោះ ${String(
                            peakHour.hour,
                          ).padStart(2, "0")}:00 - ${String(
                            peakEndHour,
                          ).padStart(2, "0")}:00`
                          : `Peak customer volume observed between ${String(
                            peakHour.hour,
                          ).padStart(2, "0")}:00 - ${String(
                            peakEndHour,
                          ).padStart(2, "0")}:00`
                        : t.hourlyDescription}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3 text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <span className="inline-block size-3 bg-[var(--pos-action)]" />
                      <span>{t.revenue}</span>
                    </span>

                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <span className="inline-block size-3 bg-amber-400" />
                      <span>{t.orders}</span>
                    </span>
                  </div>
                </div>

                <div className="flex min-h-[230px] w-full min-w-0 flex-1 items-end pt-4 pb-2">
                  <div className="relative flex h-[210px] w-full min-w-0 items-end">
                    <div className="pointer-events-none absolute inset-x-0 top-[15%] border-t border-dashed border-[var(--border-soft)] opacity-70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[38%] border-t border-dashed border-[var(--border-soft)] opacity-70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[61%] border-t border-dashed border-[var(--border-soft)] opacity-70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[84%] border-t border-[var(--border-soft)] opacity-70" />

                    <div className="relative z-10 grid h-full w-full min-w-0 grid-cols-13 items-end gap-1 sm:gap-2">
                      {hourlySales.map((item, index) => {
                        const outerHeight =
                          item.orders > 0
                            ? Math.max(
                              10,
                              (item.orders / maxHourlyOrders) * 88,
                            )
                            : 2;

                        const innerHeight =
                          item.revenue > 0
                            ? Math.max(
                              8,
                              (item.revenue / maxHourlyRevenue) * 82,
                            )
                            : 2;

                        return (
                          <div
                            key={item.hour}
                            className="flex h-full min-w-0 items-end justify-center"
                            title={`${String(item.hour).padStart(2, "0")}:00 — ${item.orders} orders`}
                          >
                            <div
                              className="relative flex w-full max-w-7 items-end justify-center bg-[var(--surface-soft)]"
                              style={{
                                height: `${outerHeight}%`,
                              }}
                            >
                              <div
                                className="w-full bg-[var(--pos-action)]"
                                style={{
                                  height: `${Math.min(
                                    100,
                                    (innerHeight / outerHeight) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid w-full min-w-0 grid-cols-13 gap-1 px-1 font-mono text-[8px] text-[var(--muted-foreground)] sm:gap-2 sm:text-[10px]">
                  {HOURS.map((hour, index) => {
                    const isPeak =
                      peakHour?.hour === hour ||
                      peakHour?.hour + 1 === hour;

                    const isNow =
                      new Date().getHours() === hour;

                    return (
                      <span
                        key={hour}
                        className={`min-w-0 text-center ${isPeak || isNow
                          ? "font-bold text-[var(--foreground)]"
                          : ""
                          }`}
                      >
                        <span className="hidden sm:inline">
                          {String(hour).padStart(2, "0")}:00
                          {isNow ? ` ${t.now}` : ""}
                        </span>

                        <span className="sm:hidden">
                          {index % 2 === 0
                            ? String(hour).padStart(2, "0")
                            : ""}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </section>

              {/* Top Selling Items */}
              <section
                className="flex min-w-0 flex-col border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5"
                data-purpose="top-selling-products"
              >
                <div className="mb-3 flex min-w-0 items-start justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t.fastVelocity}
                    </h3>

                    <div className="mt-0.5 break-words text-sm font-bold text-[var(--foreground)]">
                      {t.topSelling}
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)] sm:text-[11px]">
                    {t.byUnits}
                  </span>
                </div>

                <div className="flex flex-1 min-w-0 flex-col justify-around gap-3">
                  {topProducts.length > 0 ? (
                    topProducts.map((product, index) => (
                      <div
                        key={`${product.name}-${index}`}
                        className="flex min-w-0 items-center justify-between gap-3 border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`grid size-8 shrink-0 place-items-center border border-[var(--border-soft)] text-xs font-bold ${getProductAccent(
                              index,
                            )}`}
                          >
                            {getProductInitial(product.name)}
                          </div>

                          <div className="min-w-0">
                            <div className="break-words text-xs font-bold text-[var(--foreground)]">
                              {product.name}
                            </div>

                            <div className="mt-0.5 break-words text-[10px] text-[var(--muted-foreground)]">
                              {product.unitPrice != null
                                ? `${formatPrimaryMoney(
                                  product.unitPrice,
                                  settings,
                                  false,
                                )}`
                                : "—"}

                              {product.unit
                                ? ` • ${product.unit}`
                                : null}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="font-mono text-xs font-bold text-[var(--foreground)]">
                            {product.qty.toLocaleString()}{" "}
                            {product.unit || t.unit}
                          </div>

                          {product.stock != null ? (
                            <span
                              className={`mt-0.5 inline-block border px-1 text-[10px] ${product.stock <= 15
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                }`}
                            >
                              {t.inStock(product.stock)}
                            </span>
                          ) : (
                            <span className="mt-0.5 inline-block border border-[var(--border-soft)] bg-[var(--surface-strong)] px-1 text-[10px] text-[var(--muted-foreground)]">
                              {t.soldToday(product.qty)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center text-center text-xs text-[var(--muted-foreground)]">
                      {t.noProducts}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Live Transactions */}
            <section
              className="min-w-0 border border-[var(--border-soft)] bg-[var(--surface-strong)]"
              data-purpose="live-transactions"
            >
              <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold uppercase tracking-tight text-[var(--foreground)]">
                    {t.onlineOrders}
                  </h3>

                  <p className="mt-0.5 break-words text-xs text-[var(--muted-foreground)]">
                    {t.onlineOrdersDescription}
                  </p>
                </div>

                <div className="flex max-w-full min-w-0 items-center overflow-hidden border border-[var(--border-soft)] bg-[var(--surface-soft)] text-xs">
                  <button
                    type="button"
                    onClick={() => setTransactionFilter("ALL")}
                    className={`min-w-0 flex-1 px-2.5 py-1.5 font-semibold transition-colors sm:px-3 ${transactionFilter === "ALL"
                      ? "bg-[var(--surface-strong)] text-[var(--pos-action)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-strong)]"
                      }`}
                  >
                    {t.all} ({todayTransactions.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransactionFilter("KHQR")}
                    className={`min-w-0 flex-1 border-l border-[var(--border-soft)] px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${transactionFilter === "KHQR"
                      ? "bg-[var(--surface-strong)] text-[var(--pos-action)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-strong)]"
                      }`}
                  >
                    {t.khqr} ({khqrCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransactionFilter("CASH")}
                    className={`min-w-0 flex-1 border-l border-[var(--border-soft)] px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${transactionFilter === "CASH"
                      ? "bg-[var(--surface-strong)] text-[var(--pos-action)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-strong)]"
                      }`}
                  >
                    {t.cash} ({cashCount})
                  </button>
                </div>
              </div>

              {/* Mobile / tablet transaction cards.
                  This replaces horizontal table scrolling. */}
              <div className="divide-y divide-[var(--border-soft)] xl:hidden">
                {visibleTransactions.length > 0 ? (
                  visibleTransactions.map((entry) => {
                    const method = getPaymentMethod(entry);
                    const status = getTransactionStatus(entry);
                    const itemsSummary = buildItemsSummary(entry, t);

                    return (
                      <article
                        key={String(getTransactionId(entry))}
                        className="min-w-0 p-4 transition-colors hover:bg-[var(--surface-soft)]"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-all font-mono text-xs font-bold text-[var(--foreground)]">
                              #{String(getTransactionId(entry))}
                            </div>

                            <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                              {formatTime(
                                getTimestamp(entry),
                                language,
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            title={t.printReceipt}
                            aria-label={t.printReceipt}
                            onClick={handlePrintReceipt}
                            className="shrink-0 border border-[var(--border-soft)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                          >
                            <Printer
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <div className="mt-3 min-w-0">
                          <div className="break-words text-xs font-semibold text-[var(--foreground)]">
                            {itemsSummary.title}
                          </div>

                          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                            {itemsSummary.subtitle}
                          </div>
                        </div>

                        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold ${method === "KHQR"
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                              : method === "CASH"
                                ? "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                                : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                              }`}
                          >
                            {method === "KHQR" ? (
                              <span className="size-1.5 bg-red-600" />
                            ) : null}

                            {method === "KHQR"
                              ? t.khqr
                              : method === "CASH"
                                ? t.cash
                                : t.other}
                          </span>

                          <span className="font-mono text-sm font-bold text-[var(--foreground)]">
                            {formatPrimaryMoney(
                              getTransactionTotal(entry),
                              settings,
                              false,
                            )}
                          </span>
                        </div>

                        <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                          <span
                            className={`border px-2 py-0.5 text-[10px] font-semibold ${status === "PAID"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                              }`}
                          >
                            {status === "PAID" ? t.paid : status}
                          </span>

                          <span className="font-mono text-xs text-[var(--muted-foreground)]">
                            {getUsdAmount(entry)}
                          </span>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
                    {t.noTransactions}
                  </div>
                )}
              </div>

              {/* Desktop transaction table */}
              <div className="hidden min-w-0 overflow-hidden xl:block">
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col className="w-[17%]" />
                    <col className="w-[28%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                  </colgroup>

                  <thead className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)] uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      <th className="break-words px-4 py-3 font-semibold">
                        {t.orderIdTime}
                      </th>

                      <th className="break-words px-4 py-3 font-semibold">
                        {t.itemsSummary}
                      </th>

                      <th className="break-words px-4 py-3 font-semibold">
                        {t.method}
                      </th>

                      <th className="break-words px-4 py-3 text-right font-semibold">
                        {t.totalKhr}
                      </th>

                      <th className="break-words px-4 py-3 text-right font-semibold">
                        {t.usd}
                      </th>

                      <th className="break-words px-4 py-3 text-center font-semibold">
                        {t.status}
                      </th>

                      <th className="break-words px-4 py-3 text-right font-semibold">
                        {t.action}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--border-soft)] font-mono">
                    {visibleTransactions.length > 0 ? (
                      visibleTransactions.map((entry) => {
                        const method = getPaymentMethod(entry);
                        const status = getTransactionStatus(entry);
                        const itemsSummary = buildItemsSummary(
                          entry,
                          t,
                        );

                        return (
                          <tr
                            key={String(getTransactionId(entry))}
                            className="transition-colors hover:bg-[var(--surface-soft)]"
                          >
                            <td className="min-w-0 break-words px-4 py-3 align-top">
                              <div className="break-all font-bold text-[var(--foreground)]">
                                #{String(getTransactionId(entry))}
                              </div>

                              <div className="mt-0.5 break-words text-[10px] text-[var(--muted-foreground)]">
                                {formatTime(
                                  getTimestamp(entry),
                                  language,
                                )}
                              </div>
                            </td>

                            <td className="min-w-0 break-words px-4 py-3 align-top font-sans">
                              <span className="break-words font-semibold text-[var(--foreground)]">
                                {itemsSummary.title}
                              </span>

                              <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                                {itemsSummary.subtitle}
                              </div>
                            </td>

                            <td className="min-w-0 break-words px-4 py-3 align-top font-sans">
                              <span
                                className={`inline-flex max-w-full items-center gap-1 border px-2 py-0.5 text-[10px] font-bold ${method === "KHQR"
                                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                                  : method === "CASH"
                                    ? "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                                    : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                                  }`}
                              >
                                {method === "KHQR" ? (
                                  <span className="size-1.5 shrink-0 bg-red-600" />
                                ) : null}

                                <span className="break-words">
                                  {method === "KHQR"
                                    ? t.khqr
                                    : method === "CASH"
                                      ? t.cash
                                      : t.other}
                                </span>
                              </span>
                            </td>

                            <td className="min-w-0 break-words px-4 py-3 text-right align-top font-bold text-[var(--foreground)]">
                              {formatPrimaryMoney(
                                getTransactionTotal(entry),
                                settings,
                                false,
                              )}
                            </td>

                            <td className="min-w-0 break-words px-4 py-3 text-right align-top text-[var(--muted-foreground)]">
                              {getUsdAmount(entry)}
                            </td>

                            <td className="px-4 py-3 text-center align-top font-sans">
                              <span
                                className={`inline-block border px-2 py-0.5 text-[10px] font-semibold ${status === "PAID"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                                  }`}
                              >
                                {status === "PAID"
                                  ? t.paid
                                  : status}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right align-top font-sans">
                              <button
                                type="button"
                                title={t.printReceipt}
                                aria-label={t.printReceipt}
                                onClick={handlePrintReceipt}
                                className="border border-[var(--border-soft)] p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                              >
                                <Printer
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center font-sans text-xs text-[var(--muted-foreground)]"
                        >
                          {t.noTransactions}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex min-w-0 flex-col gap-3 border-t border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words">
                  {t.showing} {visibleTransactions.length} {t.of}{" "}
                  {filteredTransactions.length} {t.ordersLabel}
                </span>

                <a
                  href="#orders"
                  className="flex shrink-0 items-center gap-1 font-semibold text-[var(--pos-action)] hover:underline"
                >
                  <span>{t.viewAll}</span>

                  <ChevronRight
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /*
         * This targets only the scroll container that contains this dashboard.
         * Sidebar layout/styling is untouched.
         */
        main:has([data-pos-dashboard]) {
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        main:has([data-pos-dashboard])::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        [data-pos-dashboard] {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        [data-pos-dashboard]::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        [data-pos-dashboard] * {
          scrollbar-width: none;
        }

        [data-pos-dashboard] *::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        @media print {
          main:has([data-pos-dashboard]) {
            overflow: visible !important;
          }

          [data-pos-dashboard] {
            overflow: visible !important;
          }
        }
      `}</style>
    </>
  );
}
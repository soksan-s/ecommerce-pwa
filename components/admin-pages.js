"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  ImagePlus,
  Layers,
  PackageOpen,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Ticket,
  TrendingUp,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { EntranceMotion } from "@/components/motion/entrance-motion";
import { HoverLift } from "@/components/motion/hover-lift";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

function Card({ children, className = "" }) {
  return <div className={`app-card p-4 sm:p-6 ${className}`}>{children}</div>;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const dashboardRangeOptions = [
  { key: "sevenDays", label: "7 days" },
  { key: "month", label: "1 month" },
  { key: "year", label: "1 year" },
  { key: "custom", label: "Custom" },
];

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

function parseDateInput(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateInputValue(value) {
  const date = startOfDay(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
  const date = startOfDay(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDashboardRangeConfig(rangeKey, customStart, customEnd) {
  const today = startOfDay(new Date());

  switch (rangeKey) {
    case "month":
      return {
        key: "month",
        label: "1 month",
        start: addDays(today, -29),
        end: today,
        bucketDays: 1,
      };
    case "year":
      return {
        key: "year",
        label: "1 year",
        start: addDays(today, -364),
        end: today,
        bucketDays: 30,
      };
    case "custom": {
      const parsedStart = parseDateInput(customStart) || addDays(today, -6);
      const parsedEnd = parseDateInput(customEnd) || today;
      const start = parsedStart <= parsedEnd ? startOfDay(parsedStart) : startOfDay(parsedEnd);
      const end = parsedStart <= parsedEnd ? startOfDay(parsedEnd) : startOfDay(parsedStart);
      const totalDays = Math.max(Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1, 1);
      return {
        key: "custom",
        label: "Custom",
        start,
        end,
        bucketDays: totalDays > 60 ? 7 : 1,
      };
    }
    case "sevenDays":
    default:
      return {
        key: "sevenDays",
        label: "7 days",
        start: addDays(today, -6),
        end: today,
        bucketDays: 1,
      };
  }
}

function statusClasses(status) {
  switch (status) {
    case "delivered":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "shipped":
      return "bg-sky-100 text-sky-700";
    case "processing":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    case "closed":
      return "bg-[var(--surface-quiet)] text-[var(--muted-foreground)]";
    default:
      return "bg-violet-100 text-violet-700";
  }
}

function StatusPill({ status }) {
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase", statusClasses(status))}>{status}</span>;
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral", className = "" }) {
  const toneClasses = {
    neutral: "bg-[var(--surface-quiet)] text-[var(--foreground)]",
    success: "bg-emerald-100/80 text-emerald-900",
    warning: "bg-amber-100/90 text-amber-900",
    danger: "bg-rose-100/90 text-rose-900",
  };

  return (
    <div className={cn("h-full rounded-2xl border border-[var(--border-soft)] p-5 shadow-[var(--shadow-soft)]", toneClasses[tone], className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="app-top-label text-current/70">{label}</p>
        <div className="rounded-2xl bg-[var(--surface-soft)] p-2">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 text-current/75">{detail}</p>
    </div>
  );
}

function RevenueChart({ points, height = 220 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const safePoints = points.length ? points : [{ label: formatShortDate(new Date()), value: 0 }];
  const maxValue = Math.max(...safePoints.map((point) => point.value), 1);
  const chartWidth = Math.max(safePoints.length * 56, 320);
  const plotHeight = Math.max(height - 36, 160);
  const labelCount = Math.max(Math.floor(chartWidth / 56), 2);
  const labelStep = Math.max(Math.ceil(safePoints.length / labelCount), 1);
  const yScale = Array.from({ length: 5 }, (_, index) => maxValue * (1 - index / 4));

  const positions = safePoints.map((point, index) => {
    const x = safePoints.length === 1 ? 0 : (chartWidth / (safePoints.length - 1)) * index;
    const y = plotHeight - (point.value / maxValue) * plotHeight;
    return { ...point, x, y };
  });

  const linePoints = positions.map((point) => `${point.x},${point.y}`).join(" ");
  const safeHoveredIndex = hoveredIndex != null && hoveredIndex < positions.length ? hoveredIndex : null;
  const activePoint = safeHoveredIndex == null ? null : positions[safeHoveredIndex] || null;

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-3" style={{ gridTemplateColumns: "56px minmax(0, 1fr)", minWidth: `${chartWidth + 68}px` }}>
        <div className="flex flex-col justify-between pt-1 text-xs text-[var(--muted-foreground)]" style={{ height: `${height}px` }}>
          {yScale.map((value, index) => (
            <span key={`${value}-${index}`}>{formatCurrency(value)}</span>
          ))}
        </div>
        <div className="relative" style={{ width: `${chartWidth}px`, height: `${height}px` }}>
          <svg width={chartWidth} height={height} className="overflow-visible">
            {Array.from({ length: 4 }, (_, index) => {
              const y = (plotHeight / 4) * (index + 1);
              return <line key={y} x1="0" y1={y} x2={chartWidth} y2={y} stroke="color-mix(in srgb, var(--action) 18%, transparent)" strokeWidth="1" />;
            })}
            <line x1="0" y1={plotHeight} x2={chartWidth} y2={plotHeight} stroke="color-mix(in srgb, var(--action) 22%, transparent)" strokeWidth="1" />
            <motion.polyline
              fill="none"
              stroke="var(--action)"
              strokeWidth="2.5"
              points={linePoints}
              initial={{ pathLength: 0, opacity: 0.45 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: easeInOutCubic }}
            />
            {positions.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                {safeHoveredIndex === index ? (
                  <>
                    <line x1={point.x} y1="0" x2={point.x} y2={plotHeight} stroke="color-mix(in srgb, var(--action) 20%, transparent)" strokeWidth="1" />
                    <circle cx={point.x} cy={point.y} r="7" fill="color-mix(in srgb, var(--action) 16%, transparent)" />
                  </>
                ) : null}
                <circle cx={point.x} cy={point.y} r={safeHoveredIndex === index ? "4.5" : "3.5"} fill="var(--action)" />
              </g>
            ))}
          </svg>

          <div className="absolute inset-x-0 top-0" style={{ height: `${plotHeight}px` }}>
            {positions.map((point, index) => (
              <button
                key={`hit-${point.label}-${index}`}
                type="button"
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="absolute top-0 h-full -translate-x-1/2 bg-transparent outline-none"
                style={{ left: `${point.x}px`, width: `${Math.max(chartWidth / Math.max(safePoints.length, 2), 24)}px` }}
                aria-label={`${point.label} ${formatCurrency(point.value)}`}
              />
            ))}
          </div>

          {activePoint ? (
            <motion.div
              key={`${activePoint.label}-${activePoint.value}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: easeInOutCubic }}
              className="pointer-events-none absolute z-10 w-28 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-soft)]"
              style={{
                left: `${Math.min(Math.max(activePoint.x - 56, 0), chartWidth - 112)}px`,
                top: `${Math.min(Math.max(activePoint.y - 54, 0), plotHeight - 34)}px`,
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{activePoint.label}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(activePoint.value)}</p>
            </motion.div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 flex items-center" style={{ height: "28px" }}>
            {positions.map((point, index) => {
              const showLabel = index === 0 || index === positions.length - 1 || index % labelStep === 0;
              return (
                <span
                  key={`label-${point.label}-${index}`}
                  className="absolute -translate-x-1/2 text-[11px] font-medium text-[var(--muted-foreground)]"
                  style={{ left: `${point.x}px` }}
                >
                  {showLabel ? point.label : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressRows({ rows, formatter = (value) => value }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">{row.label}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{formatter(row.value)}</p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--surface-quiet)]">
            <div className="h-full rounded-full bg-[var(--action)]" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function filterOrdersForRange(orders, rangeConfig) {
  const endExclusive = addDays(rangeConfig.end, 1);

  return orders.filter((order) => {
    if (order.status === "cancelled") {
      return false;
    }

    const createdAt = new Date(order.createdAt);
    return createdAt >= rangeConfig.start && createdAt < endExclusive;
  });
}

function buildRangeSeries(orders, rangeConfig) {
  const totalDays = Math.max(Math.round((rangeConfig.end.getTime() - rangeConfig.start.getTime()) / DAY_IN_MS) + 1, 1);
  const bucketDays = Math.min(rangeConfig.bucketDays, totalDays);
  const bucketCount = Math.ceil(totalDays / bucketDays);
  const totals = Array.from({ length: bucketCount }, () => 0);

  orders.forEach((order) => {
    const createdAt = startOfDay(order.createdAt);
    const index = Math.floor((createdAt.getTime() - rangeConfig.start.getTime()) / DAY_IN_MS / bucketDays);

    if (index >= 0 && index < bucketCount) {
      totals[index] += order.total;
    }
  });

  return totals.map((value, index) => ({
    label: formatShortDate(addDays(rangeConfig.start, index * bucketDays)),
    value: Number(value.toFixed(2)),
  }));
}

function buildTopProducts(orders) {
  const counts = new Map();

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      counts.set(line.productName, (counts.get(line.productName) || 0) + line.quantity);
    });
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function ChartCard({ title, onExpand, children, delay }) {
  return (
    <EntranceMotion delay={delay}>
      <HoverLift hoverOffset={4} hoverScale={1.004} hoverElevation={18} normalElevation={6}>
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
            <button type="button" onClick={onExpand} className="app-icon-button p-2" aria-label={`Expand ${title}`}>
              <ChartColumn className="size-4" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </Card>
      </HoverLift>
    </EntranceMotion>
  );
}

export function AdminDashboardPageView() {
  const store = useAppStore();
  const [range, setRange] = useState("sevenDays");
  const [customStart, setCustomStart] = useState(() => toDateInputValue(addDays(new Date(), -6)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [expandedChart, setExpandedChart] = useState("");
  const productsCount = store.products.length;
  const totalStock = store.products.reduce((sum, product) => sum + product.stock, 0);
  const revenue = store.orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0);
  const pending = store.orders.filter((order) => order.status === "pending").length;
  const complaints = store.supportTickets.filter((ticket) => ticket.status !== "closed").length;
  const lowStock = store.products.filter((product) => product.stock <= 5).length;
  const rangeConfig = useMemo(() => getDashboardRangeConfig(range, customStart, customEnd), [range, customStart, customEnd]);
  const filteredOrders = useMemo(() => filterOrdersForRange(store.orders, rangeConfig), [store.orders, rangeConfig]);
  const revenueSeries = useMemo(() => buildRangeSeries(filteredOrders, rangeConfig), [filteredOrders, rangeConfig]);
  const topProducts = useMemo(() => buildTopProducts(filteredOrders), [filteredOrders]);
  const alerts = [
    complaints
      ? {
          title: "Customer complaints",
          message: `${complaints} active ticket${complaints === 1 ? "" : "s"} need a reply or closure.`,
          tone: "danger",
        }
      : null,
    lowStock
      ? {
          title: "Low stock",
          message: `${lowStock} product${lowStock === 1 ? "" : "s"} are close to running out.`,
          tone: lowStock >= 5 ? "danger" : "warning",
        }
      : null,
    pending >= 8
      ? {
          title: "Pending orders",
          message: `${pending} orders are still waiting for movement.`,
          tone: "warning",
        }
      : null,
  ].filter(Boolean);
  const metrics = [
    { icon: PackageSearch, label: "Products", value: productsCount, detail: "Catalog items across the storefront.", tone: "neutral" },
    { icon: PackageSearch, label: "Total Stock", value: totalStock, detail: "Combined stock units for all products.", tone: "neutral" },
    { icon: AlertTriangle, label: "Low Stock", value: lowStock, detail: "Products close to running out.", tone: lowStock ? "warning" : "success" },
    { icon: ShieldAlert, label: "Complaints", value: complaints, detail: "Support tickets that still need attention.", tone: complaints ? "danger" : "success" },
    { icon: ClipboardCheck, label: "Pending Orders", value: pending, detail: "Orders waiting for manual review or processing.", tone: pending >= 8 ? "warning" : "neutral" },
    { icon: CircleDollarSign, label: "Revenue", value: formatCurrency(revenue), detail: "Combined revenue from non-cancelled orders.", tone: "success" },
  ];

  const expandedTitle = expandedChart === "revenue" ? "Revenue" : "Top products";

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric, index) => (
            <EntranceMotion key={metric.label} delay={0.08 + index * 0.06}>
              <HoverLift hoverOffset={5} hoverScale={1.01} hoverElevation={20} normalElevation={8}>
                <MetricCard {...metric} />
              </HoverLift>
            </EntranceMotion>
          ))}
        </div>

        {alerts.length ? (
          <div className="space-y-3">
            <EntranceMotion delay={0.44}>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Active alerts</h2>
            </EntranceMotion>
            <div className="grid gap-4 lg:grid-cols-3">
              {alerts.map((alert, index) => (
                <EntranceMotion key={alert.title} delay={0.48 + index * 0.06}>
                  <HoverLift hoverOffset={4} hoverScale={1.004} hoverElevation={18} normalElevation={6}>
                    <div className={cn("rounded-[1.6rem] border border-[var(--border-soft)] p-5", alert.tone === "danger" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-[var(--surface-soft)] p-2">
                          <AlertTriangle className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold">{alert.title}</h2>
                          <p className="mt-2 text-sm leading-7 text-current/75">{alert.message}</p>
                        </div>
                      </div>
                    </div>
                  </HoverLift>
                </EntranceMotion>
              ))}
            </div>
          </div>
        ) : null}

        <EntranceMotion delay={0.54}>
          <div className="flex flex-wrap gap-2">
            {dashboardRangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRange(option.key)}
                className="app-chip px-4 py-2 text-sm"
                data-active={range === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
        </EntranceMotion>

        <AnimatePresence initial={false}>
          {range === "custom" ? (
            <motion.div
              key="custom-range"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: easeInOutCubic }}
              className="grid gap-3 md:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Start date</span>
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="app-input px-4 py-3" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">End date</span>
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="app-input px-4 py-3" />
              </label>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <ChartCard title="Revenue" delay={0.62} onExpand={() => setExpandedChart("revenue")}>
            <RevenueChart points={revenueSeries} />
          </ChartCard>

          <ChartCard title="Top products" delay={0.7} onExpand={() => setExpandedChart("topProducts")}>
            {topProducts.length ? (
              <ProgressRows rows={topProducts} formatter={(value) => `${value} sold`} />
            ) : (
              <p className="text-sm leading-7 text-[var(--muted-foreground)]">No sales data yet.</p>
            )}
          </ChartCard>
        </div>

        <EntranceMotion delay={0.78}>
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">Latest Orders</h2>
              </div>
              <Link href="/admin/order-management" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                Open order management
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {store.orders.length ? (
                store.orders.slice(0, 5).map((order, index) => (
                  <EntranceMotion key={order.id} delay={0.82 + index * 0.055}>
                    <div className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-4 text-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-[var(--foreground)]">{order.id}</span>
                            <StatusPill status={order.status} />
                          </div>
                          <p className="mt-2 text-[var(--muted-foreground)]">{order.shippingAddress}</p>
                        </div>
                        <div className="grid gap-2 text-right">
                          <span className="font-semibold text-[var(--foreground)]">{formatCurrency(order.total)}</span>
                          <span className="text-[var(--muted-foreground)]">{order.paymentMethod}</span>
                        </div>
                      </div>
                    </div>
                  </EntranceMotion>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">No orders yet.</p>
              )}
            </div>
          </Card>
        </EntranceMotion>
      </div>
      <AnimatePresence>
        {expandedChart ? (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: easeInOutCubic }}
              className="absolute inset-0 bg-black/55"
              onClick={() => setExpandedChart("")}
            />
            <motion.div
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.42, ease: easeInOutCubic }}
              className="absolute inset-0 bg-[var(--background-start)]"
            >
              <header className="app-bar px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">{expandedTitle}</h2>
                  <Button type="button" variant="ghost" onClick={() => setExpandedChart("")}>
                    Close
                  </Button>
                </div>
              </header>
              <div className="h-[calc(100vh-5.5rem)] overflow-auto px-4 py-5 sm:px-6">
                <div className="w-full">
                  {expandedChart === "revenue" ? (
                    <Card>
                      <RevenueChart points={revenueSeries} height={360} />
                    </Card>
                  ) : (
                    <Card>
                      {topProducts.length ? (
                        <ProgressRows rows={topProducts} formatter={(value) => `${value} sold`} />
                      ) : (
                        <p className="text-sm leading-7 text-[var(--muted-foreground)]">No sales data yet.</p>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

const PRODUCT_CATEGORY_OPTIONS = [
  "Fresh Picks",
  "Beverages",
  "Bundles",
  "Pantry",
  "Vegetables",
  "Fruits",
  "Organic Grains",
  "Fresh Herbs",
];

const PRODUCT_UNIT_OPTIONS = [
  "kg (Kilograms)",
  "lbs (Pounds)",
  "unit (Individual)",
  "bunch",
  "box",
  "gallon",
  "liter",
];

function ProductSectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--action)_12%,transparent)] text-[var(--action)]">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
        {subtitle ? <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-8 w-14 items-center rounded-full p-1 transition-colors",
        checked ? "bg-[var(--action)]" : "bg-[var(--outline-variant)]"
      )}
    >
      <span
        className={cn(
          "h-6 w-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-6" : "translate-x-0"
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

export function AdminAddProductPageView() {
  const store = useAppStore();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: PRODUCT_CATEGORY_OPTIONS[0],
    sku: "",
    description: "",
    image: "",
    price: "0",
    discountPercent: "0",
    stock: "0",
    unit: PRODUCT_UNIT_OPTIONS[0],
    minStockAlert: "5",
  });
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantOptions, setVariantOptions] = useState([
    { name: "Size", values: "Small, Medium, Large" },
  ]);
  const [variantRows, setVariantRows] = useState([
    { name: "Small", sku: "", priceAdjustment: "0", stock: "0" },
    { name: "Medium", sku: "", priceAdjustment: "0", stock: "0" },
    { name: "Large", sku: "", priceAdjustment: "0", stock: "0" },
  ]);
  const [tags, setTags] = useState(["Organic", "Vegan"]);
  const [publishActive, setPublishActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadMessage("Uploading media...");

    const url = await store.uploadAsset(file);

    if (url) {
      update("image", url);
      setUploadMessage("Upload complete.");
    } else {
      setUploadMessage("Upload failed. You can still paste an image URL manually.");
    }

    setUploading(false);
  }

  function rebuildVariantRowsFromOptions() {
    const firstOption = variantOptions[0];
    if (!firstOption) {
      setVariantRows([]);
      return;
    }
    const values = firstOption.values
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    setVariantRows(
      values.map((value, index) => {
        const existing = variantRows[index];
        return {
          name: value,
          sku: existing?.sku || "",
          priceAdjustment: existing?.priceAdjustment || "0",
          stock: existing?.stock || "0",
        };
      }),
    );
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");

    try {
      const description = form.description || "Fresh product from the catalog.";
      const imageUrl = form.image || store.products[0]?.image || "";

      // 1. Create the base product
      const productResult = await store.addProduct({
        name: form.name,
        category: form.category,
        description,
        image: imageUrl,
        price: Number(form.price) || 0,
        discountPercent: Number(form.discountPercent) || 0,
        stock: Number(form.stock) || 0,
        sku: form.sku,
        minStockAlert: Number(form.minStockAlert) || 5,
      });

      if (!productResult.success || !productResult.product) {
        setSaveMessage(productResult.message || "Unable to create product.");
        setSaving(false);
        return;
      }

      const product = productResult.product;

      // 2. Create variants (if enabled) one-by-one via the admin variants API
      if (variantsEnabled) {
        for (const row of variantRows) {
          if (!row.name) {
            continue;
          }
          const basePrice = Number(form.price) || 0;
          const priceAdj = Number(row.priceAdjustment) || 0;
          const payload = {
            name: row.name,
            sku: row.sku || `${String(form.name || "PRODUCT").replace(/\s+/g, "-").toUpperCase()}-${row.name.replace(/\s+/g, "-").toUpperCase()}`,
            price: Math.max(0, basePrice + priceAdj),
            costPrice: basePrice,
            discountPercent: Number(form.discountPercent) || 0,
          };

          const res = await fetch(`/api/admin/products/${product.id}/variants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const body = await res.json();
            setSaveMessage(body.error?.message || "Product created but some variants failed.");
            setSaving(false);
            return;
          }
        }
      }

      setSaveMessage("Product created successfully.");
      window.setTimeout(() => {
        router.push("/admin?tab=products");
      }, 600);
    } catch (err) {
      setSaveMessage(err?.message || "Unable to create product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSaveProduct} className="space-y-8 pb-28">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            <span>Admin</span>
            <ChevronRight className="size-3" />
            <span>Product Management</span>
            <ChevronRight className="size-3" />
            <span className="text-[var(--action)]">Add New Product</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)]">Add New Product</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Create a new premium entry for your inventory catalog.
          </p>
        </div>
        <Link
          href="/admin?tab=products"
          className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-quiet)] sm:self-auto"
        >
          <X className="size-4" />
          Cancel
        </Link>
      </div>

      {saveMessage ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            saveMessage.includes("successfully")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {saveMessage}
        </div>
      ) : null}

      {/* Bento layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-8 lg:col-span-2">
          {/* Basic Information */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <ProductSectionHeader icon={PackageSearch} title="Basic Information" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Product Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="e.g. Organic Heirloom Tomatoes"
                  className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm outline-none transition focus:border-[var(--action)]"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Category *</label>
                <select
                  value={form.category}
                  onChange={(event) => update("category", event.target.value)}
                  className="w-full appearance-none rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm outline-none transition focus:border-[var(--action)]"
                >
                  {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">SKU</label>
                <input
                  value={form.sku}
                  onChange={(event) => update("sku", event.target.value)}
                  placeholder="ATR-VEG-001"
                  className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm uppercase tracking-wider outline-none transition focus:border-[var(--action)]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Describe the origin, flavor profile, and health benefits..."
                  className="min-h-[9rem] w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-4 text-sm outline-none transition focus:border-[var(--action)]"
                />
              </div>
            </div>
          </section>

          {/* Pricing & Inventory */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <ProductSectionHeader icon={CircleDollarSign} title="Pricing & Inventory" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Base Price (USD) *</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-[var(--muted-foreground)]">$</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => update("price", event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] py-3 pl-10 pr-6 text-sm outline-none transition focus:border-[var(--action)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Discount %</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-[var(--muted-foreground)]">%</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discountPercent}
                    onChange={(event) => update("discountPercent", event.target.value)}
                    placeholder="0"
                    className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] py-3 pl-10 pr-6 text-sm outline-none transition focus:border-[var(--action)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Stock Quantity *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => update("stock", event.target.value)}
                  placeholder="0"
                  className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm outline-none transition focus:border-[var(--action)]"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Measurement Unit</label>
                <select
                  value={form.unit}
                  onChange={(event) => update("unit", event.target.value)}
                  className="w-full appearance-none rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm outline-none transition focus:border-[var(--action)]"
                >
                  {PRODUCT_UNIT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Low Stock Alert</label>
                <input
                  type="number"
                  min="0"
                  value={form.minStockAlert}
                  onChange={(event) => update("minStockAlert", event.target.value)}
                  placeholder="5"
                  className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-6 py-3 text-sm outline-none transition focus:border-[var(--action)]"
                />
              </div>
            </div>
          </section>

          {/* Product Variants */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">Product Variants</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Manage different versions of this product (e.g., size, color).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--muted-foreground)]">Enable Variants</span>
                <ToggleSwitch checked={variantsEnabled} onChange={setVariantsEnabled} label="Toggle variants" />
              </div>
            </div>

            {variantsEnabled ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--foreground)]">Variant Options</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...variantOptions, { name: "", values: "" }];
                        setVariantOptions(next);
                      }}
                      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-[var(--action)] transition hover:bg-[var(--surface-quiet)]"
                    >
                      <Plus className="size-4" />
                      Add Option
                    </button>
                  </div>

                  <div className="space-y-3">
                    {variantOptions.map((option, index) => (
                      <div
                        key={`option-${index}`}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)] p-4 md:grid-cols-2"
                      >
                        <div className="space-y-1.5">
                          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Option Name</label>
                          <input
                            value={option.name}
                            onChange={(event) => {
                              const next = [...variantOptions];
                              next[index] = { ...next[index], name: event.target.value };
                              setVariantOptions(next);
                            }}
                            placeholder="e.g. Size"
                            className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2 text-sm outline-none transition focus:border-[var(--action)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Values</label>
                          <div className="flex gap-2">
                            <input
                              value={option.values}
                              onChange={(event) => {
                                const next = [...variantOptions];
                                next[index] = { ...next[index], values: event.target.value };
                                setVariantOptions(next);
                              }}
                              placeholder="e.g. Small, Medium, Large"
                              className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2 text-sm outline-none transition focus:border-[var(--action)]"
                            />
                            {variantOptions.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setVariantOptions(variantOptions.filter((_, i) => i !== index))}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] text-[var(--muted-foreground)] transition hover:text-rose-600"
                                aria-label="Remove option"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {index === 0 ? (
                          <button
                            type="button"
                            onClick={rebuildVariantRowsFromOptions}
                            className="md:col-span-2 inline-flex items-center gap-2 justify-self-start rounded-full bg-[color-mix(in_srgb,var(--action)_12%,transparent)] px-4 py-2 text-xs font-bold text-[var(--action)] transition hover:brightness-95"
                          >
                            <RefreshCw className="size-3.5" />
                            Rebuild combinations
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Variant Combinations</h3>
                  <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
                        <tr>
                          <th className="px-4 py-3 font-bold">Variant</th>
                          <th className="px-4 py-3 font-bold">SKU</th>
                          <th className="px-4 py-3 font-bold">Price Adj.</th>
                          <th className="px-4 py-3 font-bold">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-soft)]">
                        {variantRows.map((row, index) => (
                          <tr key={`row-${index}`} className="transition-colors hover:bg-[var(--surface-quiet)]/60">
                            <td className="px-4 py-3 font-medium text-[var(--foreground)]">{row.name}</td>
                            <td className="px-4 py-3">
                              <input
                                value={row.sku}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], sku: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="SKU"
                                className="w-full bg-transparent p-0 text-xs outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={row.priceAdjustment}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], priceAdjustment: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="+0.00"
                                className="w-full bg-transparent p-0 text-xs outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={row.stock}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], stock: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="0"
                                className="w-full bg-transparent p-0 text-xs outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                        {variantRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
                              Add values to your first option to generate combinations.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-soft)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                Variants are disabled. Toggle the switch above to add size, color, or format options.
              </div>
            )}
          </section>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-8">
          {/* Product Images */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <ProductSectionHeader icon={ImagePlus} title="Product Images" />
            <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--outline-variant)] bg-[var(--surface-quiet)] p-8 transition hover:border-[var(--action)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-container-high)] text-[var(--muted-foreground)] transition group-hover:scale-110">
                <Upload className="size-8" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {uploading ? "Uploading..." : "Drop files here or click to upload"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Supports JPG, PNG, WEBP up to 10MB</p>
              </div>
              <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="absolute inset-0 cursor-pointer opacity-0" disabled={uploading} />
            </div>
            {uploadMessage ? <p className="mt-3 text-xs text-[var(--muted-foreground)]">{uploadMessage}</p> : null}

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--surface-container)]">
                {form.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image} alt="Product preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => update("image", "")}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-rose-600"
                      aria-label="Remove image"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--outline-variant)]">
                    <ImagePlus className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex aspect-square items-center justify-center rounded-xl bg-[var(--surface-container)] text-[var(--outline-variant)]">
                <Plus className="size-6" />
              </div>
              <div className="flex aspect-square items-center justify-center rounded-xl bg-[var(--surface-container)] text-[var(--outline-variant)]">
                <Plus className="size-6" />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Image URL</label>
              <input
                value={form.image}
                onChange={(event) => update("image", event.target.value)}
                placeholder="https://..."
                className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-5 py-2.5 text-xs outline-none transition focus:border-[var(--action)]"
              />
            </div>
          </section>

          {/* Attributes & Tags */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <ProductSectionHeader icon={Ticket} title="Attributes & Tags" />

            <div className="flex items-center justify-between rounded-xl bg-[var(--surface-quiet)] p-4">
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">Publish Status</p>
                <p className="text-xs text-[var(--muted-foreground)]">Visible to customers immediately</p>
              </div>
              <ToggleSwitch checked={publishActive} onChange={setPublishActive} label="Publish" />
            </div>

            <div className="mt-6 space-y-3">
              <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Product Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface))] px-4 py-1.5 text-xs font-bold text-[var(--foreground)]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((entry) => entry !== tag))}
                      className="text-[var(--muted-foreground)] transition hover:text-rose-600"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const value = event.currentTarget.value.trim();
                      if (value && !tags.includes(value)) {
                        setTags([...tags, value]);
                      }
                      event.currentTarget.value = "";
                    }
                  }}
                  placeholder="Type and press enter to add..."
                  className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-5 py-2 text-xs outline-none transition focus:border-[var(--action)]"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-soft)] bg-[var(--surface-strong)]/85 px-6 py-4 backdrop-blur-xl lg:left-16 xl:left-[16rem]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-3">
          <Link
            href="/admin?tab=products"
            className="rounded-full px-6 py-3 text-sm font-bold text-[var(--muted-foreground)] transition hover:bg-[var(--surface-quiet)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--action)] px-10 py-3 text-sm font-bold text-[var(--action-foreground)] shadow-lg transition hover:scale-[1.02] hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </form>
  );
}

function isVariantProduct(product) {
  return Boolean(
    product &&
      (product.hasVariants || (product.isVariant && product.variants && product.variants.length > 0)),
  );
}

function getProductDisplayPrice(product) {
  // Multi-variant products: show the range from the cheapest to the most expensive variant.
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.discountedPrice ?? v.price ?? 0));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min !== max) {
      return { isRange: true, min, max };
    }
    return { isRange: false, price: min };
  }
  const price = Number(product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price);
  return { isRange: false, price };
}

function getProductMinPrice(product) {
  const display = getProductDisplayPrice(product);
  return display.isRange ? display.min : display.price;
}

function getProductTotalStock(product) {
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
  }
  return Number(product.stock || 0);
}

function getProductStatusBadge(product) {
  const lowStock = product.stock <= (product.minStockAlert || 8);
  if (!product.isActive) {
    return { label: "Draft", className: "bg-[var(--outline)] text-white" };
  }
  if (lowStock) {
    return { label: "Low Stock", className: "bg-[var(--error)] text-[var(--on-error)]" };
  }
  return { label: "Active", className: "bg-[var(--primary)]/90 text-[var(--on-primary)]" };
}

export function AdminProductManagementPageView() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [csvText, setCsvText] = useState("");
  const [csvMessage, setCsvMessage] = useState("");
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [quickEdit, setQuickEdit] = useState(null);
  const [quickPrice, setQuickPrice] = useState("0");
  const [quickStock, setQuickStock] = useState("0");
  const [quickStatus, setQuickStatus] = useState("Active");
  const [restock, setRestock] = useState(null);
  const [restockAmount, setRestockAmount] = useState("10");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  const products = useMemo(() => {
    const lower = query.trim().toLowerCase();

    let list = store.products.filter((product) => {
      if (lower && ![product.name, product.category, product.description].some((value) => value.toLowerCase().includes(lower))) {
        return false;
      }
      if (statusFilter === "active" && !product.isActive) {
        return false;
      }
      if (statusFilter === "drafts" && product.isActive) {
        return false;
      }
      if (statusFilter === "lowStock" && getProductTotalStock(product) > 8) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "az":
          return a.name.localeCompare(b.name);
        case "priceLow":
          return getProductMinPrice(a) - getProductMinPrice(b);
        case "priceHigh":
          return getProductMinPrice(b) - getProductMinPrice(a);
        case "newest":
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return list;
  }, [store.products, query, statusFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const totalPages = Math.max(Math.ceil(products.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageProducts = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterChips = [
    { key: "all", label: `All Products (${store.products.length})` },
    { key: "active", label: "Active" },
    { key: "drafts", label: "Drafts" },
    { key: "lowStock", label: "Low Stock" },
  ];

  function openQuickEdit(product) {
    setQuickEdit(product);
    setQuickPrice(String(product.price));
    setQuickStock(String(product.stock));
    setQuickStatus(product.isActive ? "Active" : "Draft");
  }

  function saveQuickEdit() {
    if (!quickEdit) {
      return;
    }
    store.updateProduct(quickEdit.id, {
      price: Number(quickPrice) || 0,
      stock: Number(quickStock) || 0,
      isActive: quickStatus === "Active",
    });
    setQuickEdit(null);
  }

  async function handleImport() {
    const result = await store.importProductsCsv(csvText);
    setCsvMessage(result.message);
    if (result.success) {
      setCsvText("");
    }
  }

  function handleCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    file.text().then(setCsvText);
  }

  function handleExport() {
    const header = "name,category,description,price,stock,imageUrl,discountPercent,isActive";
    const rows = store.products.map((product) =>
      [
        product.name,
        product.category,
        product.description,
        product.price,
        product.stock,
        product.image,
        product.discountPercent,
        product.isActive,
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "products-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="app-input w-full px-4 py-3 text-sm" />
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">CSV import / export</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Import products like the Flutter admin tools, or export the current catalog.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                Load CSV
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
              </label>
              <button type="button" onClick={handleExport} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                Export CSV
              </button>
            </div>
          </div>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Paste product CSV here" className="app-input min-h-32 w-full px-4 py-3 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleImport}>Import Products</Button>
            {csvMessage ? <p className="text-sm text-[var(--muted-foreground)]">{csvMessage}</p> : null}
          </div>
        </div>
      </Card>
      <div className="space-y-4">
        {products.map((product) => {
          const priceDisplay = getProductDisplayPrice(product);
          const isRange = priceDisplay.isRange;
          const totalStock = getProductTotalStock(product);
          return (
          <div key={product.id} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5">
            <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_0.7fr_0.7fr_1fr] xl:items-center">
              <div className="overflow-hidden rounded-[1rem] border border-[var(--border-soft)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.image} alt={product.name} className="h-24 w-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{product.name}</h2>
                <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">{product.category}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{product.description}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Price</p>
                {isRange ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(priceDisplay.min)} - {formatCurrency(priceDisplay.max)}
                  </p>
                ) : (
                  <input type="number" value={priceDisplay.price} onChange={(event) => store.updateProduct(product.id, { price: Number(event.target.value) })} className="app-input mt-2 w-full px-3 py-2 text-sm" />
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Stock</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{totalStock}</p>
              </div>
              <div>
                <Link
                  href={`/admin/product-management/${product.id}/variants`}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
                >
                  Variants
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase", product.isActive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-[var(--surface-quiet)] text-[var(--muted-foreground)]")}>
                  {product.isActive ? "Active" : "Hidden"}
                </span>
                <button type="button" onClick={() => store.toggleProductStatus(product.id)} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
                  {product.isActive ? "Hide" : "Activate"}
                </button>
                <Link href="/admin/add-product" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
                  Add More
                </Link>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminInventoryPageView() {
  const store = useAppStore();
  const lowStock = store.products.filter((product) => product.stock <= 8);
  const [csvText, setCsvText] = useState("");
  const [csvMessage, setCsvMessage] = useState("");
  const [movements, setMovements] = useState([]);
  const [movementMessage, setMovementMessage] = useState("");

  async function loadMovements() {
    try {
      const response = await fetch("/api/inventory/movements?limit=30", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload.data)) {
        setMovementMessage(payload.error || "Unable to load movement history.");
        return;
      }

      setMovements(payload.data);
      setMovementMessage("");
    } catch {
      setMovementMessage("Unable to load movement history.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMovements();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleImport() {
    const result = await store.importInventoryCsv(csvText);
    setCsvMessage(result.message);
    if (result.success) {
      setCsvText("");
      loadMovements();
    }
  }

  function handleCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    file.text().then(setCsvText);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Inventory</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">Restock critical products and track availability.</h1>
          </div>
          <Link
            href="/admin/procurement"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--action)] px-6 py-3 text-sm font-semibold text-[var(--action-foreground)]"
          >
            Manage Purchase Orders
          </Link>
        </div>
      </Card>
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Inventory CSV import</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Use `productId,quantity` or `name,quantity` rows to bulk restock items.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
              Load CSV
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
            </label>
          </div>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Paste restock CSV here" className="min-h-32 w-full rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleImport}>Import Inventory</Button>
            {csvMessage ? <p className="text-sm text-[var(--muted-foreground)]">{csvMessage}</p> : null}
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Recent stock movements</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">POS sales, online reservations, and admin stock changes share this history.</p>
          </div>
          <Button variant="secondary" onClick={loadMovements}>Refresh</Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          {movements.length ? (
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-[var(--border-soft)]">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{movement.productName}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{movement.sku}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold uppercase text-[var(--foreground)]">{movement.channel}</td>
                    <td className="px-3 py-3 capitalize text-[var(--muted-foreground)]">{movement.type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{movement.quantity}</td>
                    <td className="px-3 py-3 text-[var(--muted-foreground)]">{movement.previousStock} &gt; {movement.nextStock}</td>
                    <td className="px-3 py-3 text-[var(--muted-foreground)]">{new Date(movement.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[var(--border-soft)] p-6 text-sm text-[var(--muted-foreground)]">
              {movementMessage || "No stock movements yet."}
            </div>
          )}
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {lowStock.map((product) => (
          <div key={product.id} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{product.name}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Current stock {product.stock}</p>
            <div className="mt-4 flex gap-2">
              {[5, 10, 20].map((amount) => (
                <button key={amount} type="button" onClick={() => store.restockProduct(product.id, amount)} className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
                  +{amount}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminOrderManagementPageView() {
  const store = useAppStore();

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Order Management</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">Update order status and tracking.</h1>
      </Card>
      <div className="space-y-4">
        {store.orders.map((order) => (
          <div key={order.id} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{order.id}</h2>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{order.shippingAddress}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select value={order.status} onChange={(event) => store.updateOrder(order.id, { status: event.target.value })} className="rounded-[1rem] bg-[var(--surface)] px-3 py-2 text-sm outline-none">
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input value={order.trackingCarrier || ""} onChange={(event) => store.updateOrder(order.id, { trackingCarrier: event.target.value })} placeholder="Carrier" className="rounded-[1rem] bg-[var(--surface)] px-3 py-2 text-sm outline-none" />
                <input value={order.trackingStatus || ""} onChange={(event) => store.updateOrder(order.id, { trackingStatus: event.target.value })} placeholder="Tracking status" className="rounded-[1rem] bg-[var(--surface)] px-3 py-2 text-sm outline-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCouponsPageView() {
  const store = useAppStore();
  const [code, setCode] = useState("");
  const [type, setType] = useState("percent");
  const [value, setValue] = useState("10");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("all");
  const [userEmail, setUserEmail] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formTone, setFormTone] = useState("neutral");

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Coupons</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">Create and manage active promotions.</h1>
      </Card>
      <Card>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await store.createCoupon({
              code,
              type,
              value: Number(value),
              description,
              audience,
              userEmail,
            });
            setFormMessage(result.message);
            setFormTone(result.success ? "success" : "error");
            if (!result.success) {
              return;
            }
            setCode("");
            setDescription("");
            setUserEmail("");
            setValue("10");
            setAudience("all");
          }}
        >
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Coupon code" className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
          <input value={value} onChange={(event) => setValue(event.target.value)} type="number" placeholder="Value" className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
          <select value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none">
            <option value="all">All shoppers</option>
            <option value="user">Specific user</option>
          </select>
          <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} placeholder={audience === "user" ? "Required user email" : "User email optional"} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
          <div className="md:col-span-2">
            <Button type="submit">Create coupon</Button>
            {formMessage ? (
              <p className={cn("mt-3 text-sm", formTone === "error" ? "text-rose-600" : "text-emerald-700")}>{formMessage}</p>
            ) : null}
          </div>
        </form>
      </Card>
      <div className="space-y-4">
        {store.coupons.map((coupon) => (
          <div key={coupon.id} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{coupon.code}</h2>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{coupon.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-semibold">
                  {coupon.type === "percent" ? `${coupon.value}%` : formatCurrency(coupon.value)}
                </span>
                <button type="button" onClick={() => store.toggleCoupon(coupon.id)} className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
                  {coupon.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSupportInboxPageView({ user }) {
  const store = useAppStore();
  const [drafts, setDrafts] = useState({});

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Support Inbox</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">Respond to customer tickets and close threads.</h1>
      </Card>
      <div className="space-y-4">
        {store.supportTickets.map((ticket) => (
          <div key={ticket.id} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{ticket.subject}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{ticket.id}</p>
              </div>
              <button type="button" onClick={() => store.closeSupport(ticket.id)} className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {ticket.messages.map((entry) => (
                <div key={entry.id} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{entry.authorRole === "ADMIN" ? "Admin" : entry.authorEmail}</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">{entry.message}</p>
                </div>
              ))}
            </div>
            {ticket.status !== "closed" ? (
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input value={drafts[ticket.id] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Reply as admin" className="flex-1 rounded-[1.2rem] bg-[var(--surface)] px-4 py-3 text-sm outline-none" />
                <Button
                  onClick={() => {
                    const message = (drafts[ticket.id] || "").trim();
                    if (!message) {
                      return;
                    }
                    store.replySupport(ticket.id, message, user.email, "ADMIN");
                    setDrafts((current) => ({ ...current, [ticket.id]: "" }));
                  }}
                >
                  Reply
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPageView({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fetching, setFetching] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phoneNumber: "", password: "", role: "CASHIER" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        if (mounted) setUsers(data.users || []);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setFetching(false);
      }
    }
    loadUsers();
    return () => { mounted = false; };
  }, []);

  const filteredUsers = users.filter(user => 
    (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    user.phoneNumber.includes(searchQuery) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function updateUserRole(userId, newRole) {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage("User role updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleStatus(userId, currentStatus) {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      setMessage("User status updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteUser(userId) {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }

      setUsers(users.filter(u => u.id !== userId));
      setMessage("User deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddUser(event) {
    event.preventDefault();
    setAddError("");
    setAddLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      setUsers([data.user, ...users]);
      setMessage("User created successfully.");
      setShowAddModal(false);
      setAddForm({ name: "", phoneNumber: "", password: "", role: "CASHIER" });
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  if (fetching) {
    return (
      <Card>
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">Loading users...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search users by name, phone, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="app-input w-full max-w-sm px-4 py-3 text-sm"
        />
        <Button onClick={() => { setShowAddModal(true); setAddError(""); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-600">{message}</div>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--foreground)]">
            <thead className="border-b border-[var(--border-soft)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Phone</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--surface-quiet)]">
                  <td className="px-6 py-4 font-medium">
                    {user.name || user.username || "Unknown User"}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{user.phoneNumber}</td>
                  <td className="px-6 py-4">
                    {user.id !== currentUserId && user.role !== "SUPER_ADMIN" ? (
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={isLoading}
                        className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
                      >
                        <option value="CLIENT">CLIENT</option>
                        <option value="CASHIER">CASHIER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
                        <option value="DRIVER">DRIVER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-[var(--surface-quiet)] px-2.5 py-0.5 text-xs font-semibold">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      user.status === "ACTIVE" ? "bg-emerald-100/50 text-emerald-700" : "bg-red-100/50 text-red-700"
                    }`}>
                      {user.status === "ACTIVE" ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                      {user.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-[var(--muted-foreground)]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.id !== currentUserId && user.role !== "SUPER_ADMIN" ? (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => toggleStatus(user.id, user.status)}
                          disabled={isLoading}
                          className="text-xs font-semibold text-amber-500 hover:underline disabled:opacity-50"
                        >
                          {user.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={isLoading}
                          className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="py-8 text-center text-[var(--muted-foreground)]">No users found.</div>
          )}
        </div>
      </Card>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.3 }}
              className="app-card relative w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Add New User</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a new system user account.</p>

              <form onSubmit={handleAddUser} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Full Name (Optional)</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Soksan Staff"
                    className="app-input px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Phone Number <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={addForm.phoneNumber}
                    onChange={(e) => setAddForm(f => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="+855..."
                    required
                    className="app-input px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    required
                    className="app-input px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Role <span className="text-red-500">*</span></label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                    className="app-input px-4 py-3 text-sm"
                  >
                    <option value="CLIENT">Client (Customer)</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="MANAGER">Manager</option>
                    <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                    <option value="DRIVER">Driver</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {addError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{addError}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={addLoading} className="flex-1">
                    {addLoading ? "Creating..." : "Create User"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}




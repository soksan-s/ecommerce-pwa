"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleArrowLeft,
  CircleUserRound,
  CircleDollarSign,
  CircleHelp,
  Copy,
  CreditCard,
  Edit3,
  Filter,
  Gift,
  Globe,
  Heart,
  MessageCircle,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { AuthModal } from "@/components/auth-modal";
import { DeliveryLocationPicker } from "@/components/delivery-location-picker";
import { OrderDeliveryMap } from "@/components/shared/OrderDeliveryMap";
import { OrderPrintView } from "@/components/shared/OrderPrintView";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { cn, formatCurrency } from "@/lib/utils";
import { useTranslation } from "@/lib/translations";

function Card({ children, className = "" }) {
  return (
    <div className={cn("app-card p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatStatusLabel(status) {
  const text = String(status || "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusClasses(status) {
  switch (status) {
    case "delivered":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "shipped":
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
    case "processing":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "cancelled":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    default:
      return "bg-[var(--surface-quiet)] text-[var(--muted-foreground)]";
  }
}

function StatusPill({ status }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase", statusClasses(status))}>
      {formatStatusLabel(status)}
    </span>
  );
}

function getPaymentMethodLabel(method, t) {
  switch (method) {
    case "CASH_ON_DELIVERY":
      return t("cash_on_delivery");
    case "KHQR":
      return "KHQR / Bakong";
    case "CREDIT_CARD":
      return t("credit_card");
    case "BANK_TRANSFER":
      return t("bank_transfer");
    default:
      return method || t("cash_on_delivery");
  }
}

function KhqrPaymentPanel({ payment, onCancel, onPaid }) {
  const [currentPayment, setCurrentPayment] = useState(payment);
  const [message, setMessage] = useState("Checking payment...");
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    if (!payment?.id) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId;
    let attempt = 0;
    let latestPayment = payment;
    const startedAt = Date.now();
    const maxPollingMs = 10 * 60 * 1000;

    async function poll() {
      if (cancelled || Date.now() - startedAt > maxPollingMs) {
        if (!cancelled) {
          setMessage("Still waiting for payment. You can check your order again after reconnecting.");
        }
        return;
      }

      try {
        const response = await fetch(`/api/ecommerce/payments/${encodeURIComponent(payment.id)}/status`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.payment) {
          throw new Error(data.error || "Unable to check payment.");
        }

        if (cancelled) {
          return;
        }

        latestPayment = {
          ...latestPayment,
          ...data.payment,
          qr: data.payment.qr || latestPayment?.qr,
          qrImage: data.payment.qrImage || latestPayment?.qrImage,
          deeplink: data.payment.deeplink || latestPayment?.deeplink,
        };
        setCurrentPayment(latestPayment);

        if (latestPayment.status === "PAID") {
          setMessage("Payment verified.");
          onPaidRef.current?.(latestPayment);
          return;
        }

        if (latestPayment.status === "FAILED") {
          setMessage("We could not verify this payment.");
          return;
        }

        if (latestPayment.status === "EXPIRED") {
          setMessage("This payment request has expired.");
          return;
        }

        setMessage("Waiting for payment...");
      } catch {
        if (!cancelled) {
          setMessage("Connection interrupted. Retrying payment check...");
        }
      }

      attempt += 1;
      timeoutId = window.setTimeout(poll, Math.min(attempt * 3000, 15000));
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [payment]);

  const isPaid = currentPayment?.status === "PAID";
  const isFailed = currentPayment?.status === "FAILED";
  const isExpired = currentPayment?.status === "EXPIRED";
  const orderNumber = currentPayment?.orderNumber || currentPayment?.orderId;

  return (
    <Card className="mx-auto max-w-2xl">
      {isPaid ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">Payment Successful</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Your payment has been verified.</p>
          <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">Order #{orderNumber}</p>
          <Button type="button" className="mt-6" onClick={onCancel}>
            View Order
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">Payment</p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">Order #{orderNumber}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--muted-foreground)]">Amount</p>
              <p className="text-2xl font-semibold text-[var(--foreground)]">
                {currentPayment?.currency === "KHR"
                  ? `${Math.round(currentPayment.amount).toLocaleString()} KHR`
                  : formatCurrency(currentPayment?.amount || 0)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)] p-4 text-center">
            {currentPayment?.qrImage ? (
              <Image
                src={currentPayment.qrImage}
                alt={`KHQR payment for order ${orderNumber}`}
                width={288}
                height={288}
                unoptimized
                className="mx-auto aspect-square w-full max-w-72 rounded-xl bg-white p-3 shadow-sm"
              />
            ) : null}
            <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">Scan this QR using your banking application.</p>
          </div>

          {currentPayment?.deeplink ? (
            <a
              href={currentPayment.deeplink}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-semibold text-[var(--action-foreground)] transition hover:opacity-90"
            >
              <CreditCard className="size-4" />
              Open Payment App
            </a>
          ) : null}

          <div className={cn("rounded-2xl px-4 py-3 text-sm", isFailed || isExpired ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-[var(--surface-quiet)] text-[var(--muted-foreground)]")}>
            {message}
          </div>

          <Button type="button" className="w-full" onClick={onCancel}>
            {isFailed || isExpired ? "Back to Orders" : "Cancel"}
          </Button>
        </div>
      )}
    </Card>
  );
}

const ORDER_PROGRESS_STEPS = [
  { key: "pending", label: "Ordered", icon: ReceiptText },
  { key: "processing", label: "Processing", icon: PackageCheck },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: BadgeCheck },
];

function getOrderProgressIndex(status) {
  if (status === "cancelled") {
    return -1;
  }
  return Math.max(0, ORDER_PROGRESS_STEPS.findIndex((step) => step.key === status));
}

function getPrimaryOrderLine(order) {
  return order.lines?.[0] || order.items?.[0] || null;
}

function getOrderLineLabel(line) {
  if (!line) {
    return "Order";
  }
  return line.variantName ? `${line.productName} ${line.variantName}` : line.productName;
}

function getProductImageForLine(store, line) {
  if (!line?.productId && !line?.variantId) {
    return "";
  }

  // For variant orders, `order.items` carries variantId (no productId) and
  // the legacy `lines` alias maps productId to the variantId. Resolve the
  // real product through both paths so the image is found.
  const product =
    store.products.find((p) => p.id === line.productId) ||
    store.findProductForVariant?.(line.variantId || line.productId);

  return product?.image || "";
}

function getProductInitials(name) {
  return String(name || "Order")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="app-card-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="app-top-label">{label}</p>
        <div className="rounded-2xl bg-[var(--surface-quiet)] p-2 text-[var(--action)]">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="font-display mt-3 text-4xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function NavigationTile({ href, title, description }) {
  return (
    <Link
      href={href}
      className="app-card-soft group p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-quiet)] p-2 text-[var(--foreground)] transition group-hover:bg-[var(--action)] group-hover:text-[var(--action-foreground)]">
          <ArrowRight className="size-4" />
        </div>
      </div>
    </Link>
  );
}

function ActivityBars({ points }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="flex h-36 items-end gap-2">
      {points.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-3">
          <div className="flex h-full w-full items-end rounded-full bg-[var(--surface-quiet)] p-1">
            <div
              className="w-full rounded-full bg-[var(--action)]/85 transition-[height] duration-500"
              style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 12 : 6)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function buildRecentOrderSeries(orders, days) {
  const today = new Date();
  const labels = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setHours(0, 0, 0, 0);
    current.setDate(today.getDate() - offset);
    const next = new Date(current);
    next.setDate(current.getDate() + 1);

    labels.push({
      label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: orders.filter((order) => {
        const createdAt = new Date(order.createdAt);
        return createdAt >= current && createdAt < next;
      }).length,
    });
  }

  return labels;
}

const CLIENT_SORT_OPTIONS = [
  "Featured",
  "Price: Low to High",
  "Price: High to Low",
  "Stock",
  "Name",
  "Biggest discount",
];
const CLIENT_PRICE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "under-15", label: "Under $15" },
  { value: "15-30", label: "$15-$30" },
  { value: "30-plus", label: "$30+" },
];
const CLIENT_QUICK_FILTER_OPTIONS = [
  { id: "inStock", label: "In stock" },
  { id: "onSale", label: "On sale" },
  { id: "topRated", label: "Rating 4.7+" },
  { id: "bulkBuy", label: "Stock 20+" },
];
const INITIAL_CLIENT_QUICK_FILTERS = {
  inStock: false,
  onSale: false,
  topRated: false,
  bulkBuy: false,
};
const CLIENT_VISIBLE_ROWS = 3;
const CLIENT_VISIBLE_COUNT = 3 * CLIENT_VISIBLE_ROWS;
const CLIENT_SHOW_MORE_INCREMENT = CLIENT_VISIBLE_COUNT;
const CLIENT_REVEAL_DURATION_MS = 900;

function isMultiVariantProduct(product) {
  return Boolean(
    product &&
    (product.hasVariants || (product.isVariant && product.variants && product.variants.length > 0)),
  );
}

function getProductVariants(product) {
  return (product?.variants || []).filter((variant) => variant.isActive !== false);
}

function getProductDiscountedPrice(product) {
  // Multi-variant products store their real sellable prices on each variant.
  // displayPrice is the cheapest variant price, so use it for cards, hero,
  // filters, and sorting to match exactly what the customer is charged.
  if (isMultiVariantProduct(product) && product.displayPrice != null) {
    return Number(product.displayPrice);
  }
  return Number((product?.price || 0) * (1 - (product?.discountPercent || 0) / 100));
}

function getProductVariantPrices(product) {
  return getProductVariants(product).map((variant) =>
    Number((Number(variant.price) * (1 - (Number(variant.discountPercent) || 0) / 100)).toFixed(2)),
  );
}

function getProductMinPrice(product) {
  const variants = getProductVariants(product);
  if (variants.length) {
    return Math.min(...getProductVariantPrices(product));
  }
  return getProductDiscountedPrice(product);
}

function getProductMaxPrice(product) {
  const variants = getProductVariants(product);
  if (variants.length) {
    return Math.max(...getProductVariantPrices(product));
  }
  return getProductDiscountedPrice(product);
}

function getProductTotalStock(product) {
  const variants = getProductVariants(product);
  if (variants.length) {
    return variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
  }
  return Number(product?.stock || 0);
}

function getProductMaxDiscountPercent(product) {
  const variants = getProductVariants(product);
  if (variants.length) {
    return Math.max(0, ...variants.map((variant) => Number(variant.discountPercent || 0)));
  }
  return Number(product?.discountPercent || 0);
}

export function ProductCard({ product, store, requireAuth = null }) {
  const { t } = useTranslation(store.language);
  const isFavorite = store.isFavorite(product.id);
  const discountedPrice = getProductDiscountedPrice(product);
  const isVariantProduct = isMultiVariantProduct(product);
  const totalStock = getProductTotalStock(product);
  const maxDiscountPercent = getProductMaxDiscountPercent(product);
  const hasDiscount = maxDiscountPercent > 0 && discountedPrice < Number(product.price || 0);

  // For variant products, use displayPrice
  const displayPrice = product.displayPrice || product.price;
  const displayDiscount = product.displayDiscountPercent ?? product.discountPercent ?? 0;
  const effectivePrice = displayPrice * (1 - displayDiscount / 100);
  const priceRange = isVariantProduct && getProductVariants(product).length > 1
    ? `${formatCurrency(getProductMinPrice(product))} - ${formatCurrency(getProductMaxPrice(product))}`
    : null;

  return (
    <div className="public-home-product-card flex h-full flex-col overflow-hidden rounded-[1.45rem] shadow-[0_16px_38px_rgba(3,10,18,0.22)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]">
      <Link href={`/client/product-detail/${product.id}`} className="block" tabIndex={-1}>
        <div
          className="relative aspect-[1/0.92] overflow-hidden bg-[var(--surface-quiet)]"
          style={{
            backgroundImage: product.image ? `url(${product.image})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(0,0,0,0.52))]" />
          {isVariantProduct ? (
            <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
              Options
            </span>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (requireAuth && !requireAuth("Sign in to save favorites")) return;
              store.toggleFavorite(product.id);
            }}
            className={cn(
              "absolute bottom-3 right-3 inline-flex size-9 items-center justify-center rounded-full border border-white/16 bg-black/26 text-white backdrop-blur-sm transition",
              isFavorite && "bg-rose-100/90 text-rose-600",
            )}
            aria-label="Favorite"
          >
            <Heart className={cn("size-4", isFavorite && "fill-current")} />
          </button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3.5 pt-3">
        <Link
          href={`/client/product-detail/${product.id}`}
          className="public-home-product-title overflow-hidden text-ellipsis whitespace-nowrap text-[0.98rem] font-semibold leading-5"
          title={product.name}
        >
          {product.name}
        </Link>

        <p
          className={cn(
            "line-clamp-2 h-10 overflow-hidden text-xs leading-5",
            product.description?.trim()
              ? "text-[var(--muted-foreground)]"
              : "italic text-[var(--muted-foreground)]/70"
          )}
          title={product.description?.trim() || t("no_description")}
        >
          {product.description?.trim() || t("no_description")}
        </p>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          {priceRange ? (
            <span className="font-display text-[0.95rem] font-semibold tabular-nums text-[var(--action-on-muted)]">
              {priceRange}
            </span>
          ) : (
            <>
              {hasDiscount ? (
                <span className="public-home-product-muted text-[0.85rem] tabular-nums line-through">
                  {formatCurrency(product.price)}
                </span>
              ) : null}
              <span className="font-display text-[0.95rem] font-semibold tabular-nums text-[var(--action-on-muted)]">
                {formatCurrency(effectivePrice)}
              </span>
              {hasDiscount ? <span className="text-[0.78rem] font-bold text-emerald-400">{product.discountPercent}% off</span> : null}
            </>
          )}
          <span className="inline-flex items-center gap-1 text-[var(--public-home-product-foreground)]/70">
            <Star className="size-3.5 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        </div>

        <p className={cn("text-xs font-medium", totalStock <= 5 ? "text-red-400" : "text-emerald-400")}>
          {totalStock > 0 ? t("in_stock").replace("{count}", totalStock) : t("out_of_stock")}
        </p>

        {isVariantProduct ? (
          <Link
            href={`/client/product-detail/${product.id}`}
            className="mt-auto w-full"
          >
            <Button
              className="w-full rounded-[0.95rem] border border-[color-mix(in_srgb,var(--action)_36%,transparent)] bg-[var(--action)] py-2.5 text-[var(--action-foreground)] shadow-none hover:brightness-[1.01]"
              disabled={totalStock <= 0}
            >
              {totalStock > 0 ? (t("choose_options") || "Choose Options") : t("out_of_stock")}
            </Button>
          </Link>
        ) : (
          <Button
            className="mt-auto w-full rounded-[0.95rem] border border-[color-mix(in_srgb,var(--action)_36%,transparent)] bg-[var(--action)] py-2.5 text-[var(--action-foreground)] shadow-none hover:brightness-[1.01]"
            onClick={() => {
              if (requireAuth && !requireAuth("Sign in to add items to your cart")) return;
              store.addToCart(product.id);
            }}
            disabled={totalStock <= 0}
          >
            {totalStock > 0 ? t("add_to_cart") : t("out_of_stock")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ClientHeroCard({ product, language = "en" }) {
  const { t } = useTranslation(language);
  const isVariantProduct = isMultiVariantProduct(product);
  const heroPrice = isVariantProduct
    ? t("from_price").replace("{price}", formatCurrency(getProductDiscountedPrice(product)))
    : formatCurrency(getProductDiscountedPrice(product));

  return (
    <article className="min-w-[17.75rem] snap-start sm:min-w-[19.5rem] lg:min-w-[21rem]">
      <Link href={`/client/product-detail/${product.id}`} className="group block w-full text-left">
        <div className="relative h-[13.5rem] overflow-hidden rounded-[1.55rem] bg-[#d8dcdf] sm:h-[14.5rem]">
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.025]"
            style={{ backgroundImage: product.image ? `url(${product.image})` : undefined }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.05)_38%,rgba(0,0,0,0.66))]" />
          <div className="absolute inset-x-0 bottom-0 p-4.5 sm:p-5">
            <div>
              <p className="text-xs text-white/72">{product.category}</p>
              <h3 className="font-display mt-2 max-w-[11rem] text-[1.68rem] font-bold leading-[1.03] text-white sm:max-w-[12rem] sm:text-[1.8rem]">
                {product.name}
              </h3>
              <p className="mt-2 line-clamp-2 max-w-[13rem] text-[0.76rem] leading-5 text-white/72">
                {product.description}
              </p>
            </div>
            <div className="mt-4 inline-flex items-center rounded-[0.9rem] border border-white/12 bg-white/16 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {heroPrice}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

function ClientHeroCarousel({ products, reverse = false, language = "en" }) {
  const scrollRef = useRef(null);
  const isInteractingRef = useRef(false);
  const visibleProducts = useMemo(() => products.slice(0, 8), [products]);
  const shouldAutoScroll = visibleProducts.length > 1;

  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode || !shouldAutoScroll || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (isInteractingRef.current || !scrollRef.current) {
        return;
      }
      const firstCard = scrollNode.querySelector("article");
      const cardWidth = firstCard ? firstCard.offsetWidth + 16 : 300;

      if (scrollNode.scrollLeft + scrollNode.clientWidth >= scrollNode.scrollWidth - 10) {
        scrollNode.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollNode.scrollBy({ left: reverse ? -cardWidth : cardWidth, behavior: "smooth" });
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [reverse, shouldAutoScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  if (!shouldAutoScroll) {
    return (
      <div className="overflow-hidden pb-1">
        <div className="flex gap-4">
          {visibleProducts.map((product) => (
            <ClientHeroCard key={`${product.id}-single`} product={product} language={language} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden pb-1"
      onPointerDown={() => {
        isInteractingRef.current = true;
      }}
      onPointerUp={() => {
        setTimeout(() => {
          isInteractingRef.current = false;
        }, 2500);
      }}
      onPointerCancel={() => {
        isInteractingRef.current = false;
      }}
    >
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-4 overflow-x-auto py-1 snap-x snap-mandatory scroll-smooth"
      >
        {visibleProducts.map((product) => (
          <div key={product.id} className="snap-start">
            <ClientHeroCard product={product} language={language} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientProductGrid({ products, store, requireAuth = null }) {
  const [visibleCount, setVisibleCount] = useState(CLIENT_VISIBLE_COUNT);
  const [revealStartIndex, setRevealStartIndex] = useState(null);

  useEffect(() => {
    if (revealStartIndex == null) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRevealStartIndex(null);
    }, CLIENT_REVEAL_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [revealStartIndex]);

  function showMoreProducts() {
    setRevealStartIndex(visibleCount);
    setVisibleCount((current) => current + CLIENT_VISIBLE_COUNT);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {products.slice(0, visibleCount).map((product, index) => {
          const isRevealed = revealStartIndex != null && index >= revealStartIndex;

          return (
            <motion.div
              key={product.id}
              initial={isRevealed ? { opacity: 0, x: 36 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: isRevealed ? 0.38 : 0.22,
                delay: isRevealed ? (index - revealStartIndex) * 0.055 : 0,
                ease: easeInOutCubic,
              }}
            >
              <ProductCard product={product} store={store} requireAuth={requireAuth} />
            </motion.div>
          );
        })}
      </div>

      {products.length > visibleCount ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full border-2 border-[color-mix(in_srgb,var(--foreground)_24%,transparent)] px-5 py-2.5 text-sm shadow-none hover:border-[color-mix(in_srgb,var(--foreground)_36%,transparent)]"
            onClick={showMoreProducts}
          >
            {store.t ? store.t("show_more") : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function ClientProductListPageView({
  productsOverride = null,
  requireAuth = null,
  query = "",
  onQueryChange = null,
  selectedCategory = "All",
  onCategoryChange = null,
}) {
  const store = useAppStore();
  const { t } = useTranslation(store.language);
  const isCustomCollection = Boolean(productsOverride);
  const setQuery = onQueryChange || (() => { });
  const [selectedCategories, setSelectedCategories] = useState(() =>
    selectedCategory && selectedCategory !== "All" ? [selectedCategory] : []
  );

  useEffect(() => {
    if (!selectedCategory || selectedCategory === "All") {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([selectedCategory]);
    }
  }, [selectedCategory]);
  const [categorySearch, setCategorySearch] = useState("");
  const [sort, setSort] = useState("Featured");
  const [priceFilter, setPriceFilter] = useState("all");
  const [quickFilters, setQuickFilters] = useState(INITIAL_CLIENT_QUICK_FILTERS);
  const [visibleGridCounts, setVisibleGridCounts] = useState({});
  const [revealState, setRevealState] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categoriesScrollRef = useRef(null);

  useEffect(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);
  const sourceProducts = productsOverride || store.activeProducts;
  const sourceCategories = useMemo(() => [...new Set(sourceProducts.map((product) => product.category))], [sourceProducts]);
  const categoryChips = useMemo(() => ["All", ...sourceCategories], [sourceCategories]);
  const visibleCategoryOptions = useMemo(() => {
    const lower = categorySearch.trim().toLowerCase();
    if (!lower) {
      return sourceCategories;
    }
    return sourceCategories.filter((category) => category.toLowerCase().includes(lower));
  }, [categorySearch, sourceCategories]);

  const preparedProducts = useMemo(
    () =>
      sourceProducts.map((product) => ({
        product,
        discountedPrice: getProductDiscountedPrice(product),
        totalStock: getProductTotalStock(product),
        maxDiscountPercent: getProductMaxDiscountPercent(product),
        searchStr: [
          product.name,
          product.description,
          product.category,
          ...(product.variants || []).map((variant) => variant.name),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [sourceProducts]
  );

  const products = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = preparedProducts.filter((item) => {
      const { product, discountedPrice, totalStock, maxDiscountPercent, searchStr } = item;

      if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) {
        return false;
      }
      if (lower && !searchStr.includes(lower)) {
        return false;
      }
      if (quickFilters.inStock && totalStock <= 0) {
        return false;
      }
      if (quickFilters.onSale && maxDiscountPercent <= 0) {
        return false;
      }
      if (quickFilters.topRated && (product.rating || 0) < 4.7) {
        return false;
      }
      if (quickFilters.bulkBuy && totalStock < 20) {
        return false;
      }

      switch (priceFilter) {
        case "under-15":
          if (discountedPrice >= 15) {
            return false;
          }
          break;
        case "15-30":
          if (discountedPrice < 15 || discountedPrice > 30) {
            return false;
          }
          break;
        case "30-plus":
          if (discountedPrice < 30) {
            return false;
          }
          break;
        default:
          break;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "Price: Low to High":
          return a.discountedPrice - b.discountedPrice;
        case "Price: High to Low":
          return b.discountedPrice - a.discountedPrice;
        case "Stock":
          return b.totalStock - a.totalStock;
        case "Name":
          return a.product.name.localeCompare(b.product.name);
        case "Biggest discount":
          return b.maxDiscountPercent - a.maxDiscountPercent;
        default:
          return b.product.rating - a.product.rating;
      }
    });

    return sorted.map((item) => item.product);
  }, [preparedProducts, priceFilter, query, quickFilters, selectedCategories, sort]);

  const activeFilterCount = useMemo(
    () =>
      selectedCategories.length +
      Object.values(quickFilters).filter(Boolean).length +
      (priceFilter !== "all" ? 1 : 0) +
      (query ? 1 : 0),
    [priceFilter, query, quickFilters, selectedCategories],
  );
  const groupedProducts = useMemo(() => {
    const visibleCategories = selectedCategories.length ? selectedCategories : sourceCategories;

    return visibleCategories
      .map((category) => ({
        category,
        products: products.filter((product) => product.category === category),
      }))
      .filter((group) => group.products.length);
  }, [products, selectedCategories, sourceCategories]);
  const resolvedVisibleGridCounts = useMemo(
    () =>
      groupedProducts.reduce(
        (accumulator, group) => ({
          ...accumulator,
          [group.category]: visibleGridCounts[group.category] ?? CLIENT_VISIBLE_COUNT,
        }),
        {},
      ),
    [groupedProducts, visibleGridCounts],
  );
  const productGridKey = useMemo(() => products.map((product) => product.id).join("|"), [products]);

  useEffect(() => {
    if (!revealState) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRevealState(null);
    }, CLIENT_REVEAL_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [revealState]);

  function chooseQuickCategory(category) {
    if (category === "All") {
      setSelectedCategories([]);
      onCategoryChange?.("All");
      return;
    }
    setSelectedCategories([category]);
    onCategoryChange?.(category);
  }

  function toggleSidebarCategory(category) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );
  }

  function toggleQuickFilter(filterId) {
    setQuickFilters((current) => ({
      ...current,
      [filterId]: !current[filterId],
    }));
  }

  function resetFilters() {
    setQuery("");
    setCategorySearch("");
    setSelectedCategories([]);
    onCategoryChange?.("All");
    setSort("Featured");
    setPriceFilter("all");
    setQuickFilters(INITIAL_CLIENT_QUICK_FILTERS);
  }

  function showMoreProducts(category) {
    setVisibleGridCounts((current) => {
      const start = current[category] ?? resolvedVisibleGridCounts[category] ?? CLIENT_VISIBLE_COUNT;
      setRevealState({ category, start });

      return {
        ...current,
        [category]: start + CLIENT_SHOW_MORE_INCREMENT,
      };
    });
  }

  return (
    <div className="mx-auto max-w-[72rem] space-y-6">
      {/* Category row — like the reference: chips inline, filters at the end */}
      <div className="flex items-center gap-2">
        <div
          ref={categoriesScrollRef}
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5 scroll-smooth"
        >
          {categoryChips.map((category) => {
            const isActive =
              category === "All" ? selectedCategories.length === 0 : selectedCategories.includes(category);

            return (
              <button
                key={category}
                type="button"
                onClick={() => chooseQuickCategory(category)}
                className="public-home-chip inline-flex shrink-0 items-center border px-4 py-2 text-sm transition text-[var(--foreground)]"
                data-active={isActive}
              >
                {category}
              </button>
            );
          })}
        </div>
        {activeFilterCount ? (
          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 text-xs font-bold text-[var(--action)] hover:underline"
          >
            {t("clear_filters")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setFiltersOpen((state) => !state)}
          aria-label={t("filters")}
          aria-expanded={filtersOpen}
          title={t("filters")}
          className={cn(
            "relative inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--action)_36%,transparent)] bg-[var(--action)] text-[var(--action-foreground)] shadow-xs transition hover:brightness-110 active:scale-95 cursor-pointer",
            filtersOpen && "brightness-95 ring-2 ring-[var(--action)] ring-offset-2 ring-offset-[var(--background)]"
          )}
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount ? (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-4.5 h-4.5 px-1 place-items-center bg-rose-500 text-[10px] font-black text-white shadow-xs">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Collapsible filters */}
      {filtersOpen ? (
        <div className="space-y-5 border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {t("filters")}
            </p>
            <AppSelect
              value={sort}
              onChange={setSort}
              options={CLIENT_SORT_OPTIONS}
              aria-label="Sort products"
              className="w-52"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryChips.map((category) => {
              const isActive =
                category === "All" ? selectedCategories.length === 0 : selectedCategories.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => chooseQuickCategory(category)}
                  className="public-home-chip inline-flex shrink-0 items-center border px-4 py-2 text-sm transition text-[var(--foreground)]"
                  data-active={isActive}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {CLIENT_QUICK_FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => toggleQuickFilter(filter.id)}
                className="public-home-chip inline-flex items-center border px-4 py-2 text-sm transition text-[var(--foreground)]"
                data-active={quickFilters[filter.id]}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CLIENT_PRICE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriceFilter(option.value)}
                className="public-home-chip inline-flex items-center justify-center border px-4 py-2 text-sm transition text-[var(--foreground)]"
                data-active={priceFilter === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 space-y-4">

        {products.length ? (
          isCustomCollection ? (
            <ClientProductGrid key={productGridKey} products={products} store={store} requireAuth={requireAuth} />
          ) : (
            <div className="space-y-6">
              <ClientHeroCarousel products={products.slice(0, 5)} language={store.language || "en"} />

              {groupedProducts.map((group) => (
                <section key={group.category} className="space-y-4">
                  <h2 className="font-display px-1 text-xl font-semibold tracking-tight text-[var(--foreground)]">{group.category}</h2>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    {group.products
                      .slice(0, resolvedVisibleGridCounts[group.category] ?? CLIENT_VISIBLE_COUNT)
                      .map((product, index) => {
                        const isRevealed =
                          revealState?.category === group.category &&
                          index >= revealState.start;

                        return (
                          <motion.div
                            key={`${group.category}-${product.id}-grid`}
                            initial={isRevealed ? { opacity: 0, x: 36 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: isRevealed ? 0.38 : 0.22,
                              delay: isRevealed ? (index - revealState.start) * 0.055 : 0,
                              ease: easeInOutCubic,
                            }}
                          >
                            <ProductCard product={product} store={store} requireAuth={requireAuth} />
                          </motion.div>
                        );
                      })}
                  </div>

                  {group.products.length > (resolvedVisibleGridCounts[group.category] ?? CLIENT_VISIBLE_COUNT) ? (
                    <div className="flex justify-center pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full border-2 border-[color-mix(in_srgb,var(--foreground)_24%,transparent)] px-5 py-2.5 text-sm shadow-none hover:border-[color-mix(in_srgb,var(--foreground)_36%,transparent)]"
                        onClick={() => showMoreProducts(group.category)}
                      >
                        {t("show_more")}
                      </Button>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          )
        ) : (
          <div className="rounded-[1.25rem] border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface)_82%,var(--background-start))] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            {t("no_matching_products")}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientFavoritesPageView() {
  const store = useAppStore();
  const { t } = useTranslation(store.language);

  if (!store.favoriteProducts.length) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-[4.625rem] w-[4.625rem] items-center justify-center rounded-[1.375rem] bg-[linear-gradient(135deg,#1E4540,#B57878)] text-white shadow-[var(--shadow-card)]">
            <Heart className="size-8" />
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{t("no_favorites_yet")}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{t("no_favorites_hint")}</p>
        </div>
      </div>
    );
  }

  return <ClientProductListPageView productsOverride={store.favoriteProducts} />;
}



export function ClientCartPageView() {
  const store = useAppStore();
  const { t } = useTranslation(store.language);

  return (
    <>
      <div className="space-y-4">
        {store.cartItems.length ? (
          <>
            <div className="space-y-3 px-4">
              {store.cartItems.map((item) => (
                <Card key={item.cartKey || item.productId} className="p-3">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-xl bg-cover bg-center"
                      style={{
                        backgroundImage: item.product.image
                          ? `url(${item.product.image})`
                          : undefined,
                      }}
                    />

                    <div className="flex min-w-0 flex-1 items-stretch justify-between gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <h2 className="truncate text-lg font-semibold text-[var(--foreground)]">
                          {item.product.name}
                        </h2>

                        {item.variantName ? (
                          <p className="mt-0.5 truncate text-xs font-medium text-[var(--action)]">
                            {item.variantName}
                          </p>
                        ) : null}

                        <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
                          {formatCurrency(item.unitPrice)} {t("each")}
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                          {t("subtotal")}: {formatCurrency(item.subtotal)}
                        </p>
                      </div>

                      <div className="flex h-[5.25rem] shrink-0 flex-col items-end justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            store.removeFromCart(
                              item.productId,
                              item.variantId
                            )
                          }
                          aria-label={t("remove")}
                          title={t("remove")}
                          className="grid size-8 shrink-0 place-items-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={20} strokeWidth={2.5} />
                        </button>

                        <div className="flex shrink-0 items-center border border-[var(--border-strong)] bg-[var(--surface-strong)]">
                          <button
                            type="button"
                            onClick={() =>
                              store.decreaseCart(
                                item.productId,
                                item.variantId
                              )
                            }
                            aria-label="Decrease quantity"
                            className="grid size-8 place-items-center text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--action-surface)] hover:text-[var(--action-on-muted)]"
                          >
                            -
                          </button>

                          <span className="min-w-9 text-center text-sm font-extrabold tabular-nums text-[var(--foreground)]">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              store.addToCart(
                                item.productId,
                                1,
                                item.variantId
                              )
                            }
                            aria-label="Increase quantity"
                            className="grid size-8 place-items-center text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--action-surface)] hover:text-[var(--action-on-muted)]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="rounded-t-[1.5rem] border-t border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--surface-quiet),var(--surface),color-mix(in_srgb,var(--action)_12%,var(--surface)))] px-4 pb-4 pt-3 shadow-[0_-4px_16px_rgba(15,24,35,0.06)]">
              <div className="flex items-center gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-[var(--foreground)]">
                    {t("total")}
                  </p>

                  <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">
                    {formatCurrency(store.cartTotal)}
                  </p>
                </div>

                <div className="ml-auto shrink-0">
                  <Link
                    href="/client/checkout"
                    prefetch={false}
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--action)] px-[1.125rem] py-[0.875rem] text-sm font-semibold text-[var(--action-foreground)] shadow-[var(--shadow-soft)]"
                  >
                    {t("proceed_to_checkout")}
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[14rem] items-center justify-center px-4 text-center text-[var(--muted-foreground)]">
            {t("cart_empty_hint")}
          </div>
        )}
      </div>
    </>
  );
}







export function ClientCheckoutPageView() {
  const store = useAppStore();
  const { t } = useTranslation(store.language);
  const router = useRouter();
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY");
  const [couponCode, setCouponCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [khqrPayment, setKhqrPayment] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (shippingAddress.trim().length < 8) {
      setMessage(t("shipping_address_hint"));
      return;
    }

    if (!store.cartItems.length) {
      setMessage(t("cart_empty_hint"));
      return;
    }

    setSubmitting(true);
    setMessage("");

    const result = await store.placeOrder({
      shippingAddress: shippingAddress.trim(),
      paymentMethod,
      couponCode: couponCode.trim(),
      deliveryLatitude: deliveryCoords?.lat || null,
      deliveryLongitude: deliveryCoords?.lng || null,
      deliveryNote: deliveryNote.trim() || null,
    });

    if (!result.success || !result.order) {
      setSubmitting(false);
      setMessage(result.message || "Unable to place order.");
      return;
    }

    if (paymentMethod === "KHQR") {
      try {
        const response = await fetch("/api/ecommerce/payments/khqr/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: result.order.id }),
        });
        const data = await response.json();

        setSubmitting(false);

        if (!response.ok || !data.payment) {
          setMessage(data.error || `Order ${result.order.orderNumber || result.order.id} was created, but KHQR payment could not be prepared.`);
          return;
        }

        setKhqrPayment(data.payment);
        return;
      } catch {
        setSubmitting(false);
        setMessage(`Order ${result.order.orderNumber || result.order.id} was created, but payment setup is unavailable right now.`);
        return;
      }
    }

    setSubmitting(false);
    setMessage(`Order ${result.order.orderNumber || result.order.id} placed successfully.`);
    router.push("/client?tab=orders");
  }

  if (khqrPayment) {
    return (
      <KhqrPaymentPanel
        payment={khqrPayment}
        onCancel={() => router.push("/client?tab=orders")}
        onPaid={() => { }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/client?tab=cart")}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-quiet)] active:scale-95"
        >
          <CircleArrowLeft className="size-4 text-[var(--action)]" />
          <span>{t("back_to_cart") || "Back to Cart"}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/client?tab=shop")}
          className="text-sm font-semibold text-[var(--action)] transition hover:underline"
        >
          {t("continue_shopping") || "Continue Shopping"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("order_summary")}</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--muted-foreground)]">{t("items")}</span>
              <span className="font-semibold text-[var(--foreground)]">{store.cartItems.length}</span>
            </div>
            {store.cartItems.map((item) => (
              <div key={item.cartKey || item.productId} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--muted-foreground)]">
                  {item.product.name}{item.variantName ? ` (${item.variantName})` : ''} x {item.quantity}
                </span>
                <span className="font-semibold text-[var(--foreground)]">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <p className="text-sm text-[var(--muted-foreground)]">{t("total")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{formatCurrency(store.cartTotal)}</p>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("delivery_details")}</h2>
          <div className="mt-4 space-y-4">
            <DeliveryLocationPicker
              onAddressSelect={setShippingAddress}
              onLocationSelect={(loc) => {
                setShippingAddress(loc.address);
                setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
              }}
              locateLabel={t("use_current_location")}
              pickLabel={t("pick_on_map")}
              hint={t("map_location_hint")}
            />
            <textarea
              value={shippingAddress}
              onChange={(event) => setShippingAddress(event.target.value)}
              placeholder={t("shipping_address")}
              className="app-input min-h-24 px-4 py-3 text-sm"
            />
            <input
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              placeholder="Delivery instructions / notes (e.g. Near Wat Bo, call when arrived)"
              className="app-input px-4 py-2.5 text-sm"
            />
            <div className="rounded-[1.125rem] border border-[color:color-mix(in_srgb,var(--border-soft)_85%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--action)_12%,var(--surface)),color-mix(in_srgb,var(--accent-secondary)_35%,var(--surface)))] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/35 p-2 text-[var(--foreground)]">
                  <Ticket className="size-5" />
                </div>
                <p className="text-sm leading-6 text-[var(--foreground)]/88">
                  {t("coupon_hint")}
                </p>
              </div>
            </div>
            <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder={t("enter_coupon")} className="app-input px-4 py-3 text-sm" />
            <p className="text-xs leading-6 text-[var(--muted-foreground)]">{t("coupon_wallet_note")}</p>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="app-select px-4 py-3 text-sm">
              <option value="CASH_ON_DELIVERY">{getPaymentMethodLabel("CASH_ON_DELIVERY", t)}</option>
              <option value="KHQR">KHQR / Bakong</option>
              <option value="CREDIT_CARD">{getPaymentMethodLabel("CREDIT_CARD", t)}</option>
              <option value="BANK_TRANSFER">{getPaymentMethodLabel("BANK_TRANSFER", t)}</option>
            </select>
            {message ? <div className="rounded-2xl bg-[var(--surface-quiet)] px-4 py-3 text-sm">{message}</div> : null}
            <Button type="submit" className="w-full" disabled={submitting || !store.cartItems.length}>
              {submitting ? t("placing_order") : paymentMethod === "KHQR" ? "Create KHQR payment" : t("place_order")}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

export function ClientOrderHistoryPageView() {
  const store = useAppStore();
  const { t } = useTranslation(store.language || "en");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const orders = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = store.orders.filter((order) => {
      if (status !== "all" && order.status !== status) {
        return false;
      }

      const createdAt = new Date(order.createdAt);
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (createdAt < start) {
          return false;
        }
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (createdAt > end) {
          return false;
        }
      }

      if (!lower) {
        return true;
      }

      return (
        order.id.toLowerCase().includes(lower) ||
        String(order.orderNumber || "").toLowerCase().includes(lower) ||
        String(order.shippingAddress || "").toLowerCase().includes(lower) ||
        String(order.paymentMethod || "").toLowerCase().includes(lower) ||
        (order.lines || []).some((line) =>
          String(line.productName || "").toLowerCase().includes(lower)
        )
      );
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "total-high":
          return b.total - a.total;
        case "total-low":
          return a.total - b.total;
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  }, [store.orders, query, status, sort, startDate, endDate]);

  const orderMetrics = useMemo(() => {
    return {
      total: store.orders.length,
      active: store.orders.filter(
        (order) => !["delivered", "cancelled"].includes(order.status)
      ).length,
      delivered: store.orders.filter(
        (order) => order.status === "delivered"
      ).length,
      spent: store.orders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      ),
    };
  }, [store.orders]);

  const dateRangeLabel =
    startDate && endDate
      ? `${new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      })} - ${new Date(`${endDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      })}`
      : startDate
        ? `From ${new Date(`${startDate}T00:00:00`).toLocaleDateString(
          "en-US",
          { month: "numeric", day: "numeric" }
        )}`
        : endDate
          ? `Until ${new Date(`${endDate}T00:00:00`).toLocaleDateString(
            "en-US",
            { month: "numeric", day: "numeric" }
          )}`
          : "Date range";

  const statusOptions = [
    { value: "all", label: t("all_status") },
    { value: "pending", label: t("status_pending") },
    { value: "processing", label: t("status_processing") },
    { value: "shipped", label: t("status_shipped") },
    { value: "delivered", label: t("status_delivered") },
    { value: "cancelled", label: t("status_cancelled") },
  ];

  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setSort("newest");
    setStartDate("");
    setEndDate("");
  };

  const setRecentRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/client"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--action)] transition hover:text-[var(--foreground)]"
          >
            <ChevronRight className="size-3 rotate-180" />
            Back to shop
          </Link>

          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Order History
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Review previous orders, delivery progress, payment method, and
            applied discounts.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[31rem]">
          {[
            { label: "Orders", value: orderMetrics.total, icon: ReceiptText },
            { label: "Active", value: orderMetrics.active, icon: PackageCheck },
            {
              label: "Delivered",
              value: orderMetrics.delivered,
              icon: BadgeCheck,
            },
            {
              label: "Spent",
              value: formatCurrency(orderMetrics.spent),
              icon: CircleDollarSign,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="min-w-0 rounded-[1.1rem] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 text-[var(--muted-foreground)]">
                <span className="min-w-0 truncate text-xs font-medium">
                  {label}
                </span>
                <Icon className="size-4 shrink-0 text-[var(--action)]" />
              </div>

              <p className="mt-2 truncate text-lg font-semibold text-[var(--foreground)]">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <Card className="w-full min-w-0 max-w-full overflow-hidden p-3 sm:p-4">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <label className="flex min-h-12 min-w-0 items-center gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4">
                <Search className="size-4 shrink-0 text-[var(--action)]" />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("search_order")}
                  className="w-full min-w-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </label>

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="app-select min-h-12 w-full min-w-0"
              >
                <option value="newest">{t("newest")}</option>
                <option value="oldest">{t("oldest")}</option>
                <option value="total-high">{t("total_high")}</option>
                <option value="total-low">{t("total_low")}</option>
              </select>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--action)] hover:text-[var(--action)]"
              >
                <RefreshCw className="size-4 shrink-0" />
                Reset
              </button>
            </div>

            <div className="mt-3 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition",
                    status === option.value
                      ? "border-[var(--action)] bg-[var(--action)] text-[var(--action-foreground)] shadow-sm"
                      : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Card>

          {store.orders.length === 0 ? (
            <div className="flex min-h-[18rem] min-w-0 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] px-6 text-center">
              <ReceiptText className="size-9 text-[var(--action)]" />

              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                No orders yet
              </p>

              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                Completed orders will show here after checkout.
              </p>
            </div>
          ) : orders.length ? (
            <div className="grid min-w-0 gap-3">
              {orders.map((order) => {
                const primaryLine = getPrimaryOrderLine(order);
                const lineCount =
                  order.lines?.length || order.items?.length || 0;
                const productImage = getProductImageForLine(
                  store,
                  primaryLine
                );

                return (
                  <Link
                    key={order.id}
                    className={cn(
                      "group grid w-full min-w-0 gap-4 overflow-hidden rounded-[1.4rem] border bg-[var(--surface)] p-4 text-left shadow-sm transition sm:grid-cols-[4.75rem_minmax(0,1fr)_auto]",
                      "border-[var(--border-soft)] hover:border-[var(--action)] hover:shadow-[var(--shadow-card)]"
                    )}
                    href={`/client/order-history/${encodeURIComponent(
                      order.id
                    )}`}
                  >
                    {productImage ? (
                      <div
                        className="size-[4.75rem] shrink-0 overflow-hidden rounded-[1.25rem] bg-[var(--surface-quiet)] bg-cover bg-center shadow-inner"
                        style={{ backgroundImage: `url(${productImage})` }}
                      />
                    ) : (
                      <div className="flex size-[4.75rem] shrink-0 items-center justify-center rounded-[1.25rem] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.92),rgba(20,127,111,0.22)_34%,rgba(10,53,47,0.86)_100%)] text-lg font-semibold text-white shadow-inner">
                        {getProductInitials(getOrderLineLabel(primaryLine))}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-base font-semibold text-[var(--foreground)]">
                          {getOrderLineLabel(primaryLine)}
                        </p>

                        <StatusPill status={order.status} />
                      </div>

                      <p className="mt-1 min-w-0 truncate text-xs text-[var(--muted-foreground)]">
                        Order {order.orderNumber || order.id} ·{" "}
                        {formatDate(order.createdAt)}
                      </p>

                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <PackageCheck className="size-3.5 shrink-0 text-[var(--action)]" />
                          {lineCount} item{lineCount === 1 ? "" : "s"}
                        </span>

                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <CreditCard className="size-3.5 shrink-0 text-[var(--action)]" />
                          <span className="min-w-0 truncate">
                            {getPaymentMethodLabel(order.paymentMethod, t)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-3 sm:min-w-[8.5rem] sm:flex-col sm:items-end">
                      <p className="truncate text-xl font-semibold text-[var(--foreground)]">
                        {formatCurrency(order.total)}
                      </p>

                      <span className="inline-flex shrink-0 min-h-9 items-center gap-2 rounded-full bg-[var(--action)] px-4 text-xs font-semibold text-[var(--action-foreground)] transition group-hover:brightness-95">
                        Details
                        <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[18rem] min-w-0 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] px-6 text-center">
              <SlidersHorizontal className="size-9 text-[var(--action)]" />

              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                No orders for this filter
              </p>

              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Adjust status, date, search, or sorting to find the order.
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="w-full min-w-0 max-w-full overflow-hidden p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Filter className="size-4 shrink-0 text-[var(--action)]" />

                <p className="truncate font-semibold text-[var(--foreground)]">
                  Filters
                </p>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 text-xs font-semibold text-[var(--action)]"
              >
                Reset all
              </button>
            </div>

            <div className="mt-5 min-w-0 space-y-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Date range
                </p>

                <div className="mt-2 grid min-w-0 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="app-input min-h-11 w-full min-w-0 max-w-full px-3 text-sm"
                  />

                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="app-input min-h-11 w-full min-w-0 max-w-full px-3 text-sm"
                  />
                </div>

                <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRecentRange(30)}
                    className="rounded-full bg-[var(--surface-quiet)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                  >
                    Last 30 days
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecentRange(180)}
                    className="rounded-full bg-[var(--surface-quiet)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                  >
                    Last 6 months
                  </button>
                </div>
              </div>

              <div className="min-w-0 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-quiet)] px-3 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <CalendarRange className="size-4 shrink-0 text-[var(--action)]" />

                  <span className="min-w-0 truncate">{dateRangeLabel}</span>
                </div>

                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  Showing {orders.length} of {store.orders.length} orders.
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function ClientOrderDetailPageView({ orderId }) {
  const store = useAppStore();
  const router = useRouter();
  const order = useMemo(() => store.orders.find((entry) => entry.id === orderId), [store.orders, orderId]);

  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  async function handleCancelOrder() {
    if (!order || order.status !== "pending") return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Cancel failed");
      store.updateOrder(order.id, { status: "cancelled" });
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(false);
      setCancelConfirm(false);
    }
  }

  function reorderItems() {
    const orderLines = order?.items?.length ? order.items : order?.lines || [];
    orderLines.forEach((line) => {
      const quantity = line.quantity || 1;

      // Modern order lines reference the product variant directly.
      if (line.variantId) {
        const product = store.findProductForVariant?.(line.variantId);
        if (product) {
          store.addToCart(product.id, quantity, line.variantId);
        }
        return;
      }

      if (line.productId) {
        // Legacy alias: `productId` may actually hold the variant id.
        const variantProduct = store.findProductForVariant?.(line.productId);
        if (variantProduct) {
          store.addToCart(variantProduct.id, quantity, line.productId);
        } else {
          store.addToCart(line.productId, quantity, null);
        }
      }
    });
    router.push("/client?tab=cart");
  }

  if (!order) {
    return (
      <div className="space-y-5">
        <Link href="/client?tab=orders" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--action)] transition hover:text-[var(--foreground)]">
          <ChevronRight className="size-4 rotate-180" />
          Back to order history
        </Link>
        <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] px-6 text-center">
          <ReceiptText className="size-10 text-[var(--action)]" />
          <p className="mt-4 text-xl font-semibold text-[var(--foreground)]">Order not found</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
            This order may no longer be available in your current session.
          </p>
        </div>
      </div>
    );
  }

  const orderLines = order.items?.length ? order.items : order.lines || [];
  const progressIndex = getOrderProgressIndex(order.status);
  const progressWidth = progressIndex < 0 ? 0 : (Math.min(progressIndex, ORDER_PROGRESS_STEPS.length - 1) / (ORDER_PROGRESS_STEPS.length - 1)) * 100;
  const subtotal = orderLines.reduce((sum, line) => sum + Number(line.lineTotal || line.quantity * line.unitPrice || 0), 0);
  const discount = Number(order.couponDiscount || 0);
  const total = Number(order.total || subtotal - discount);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href="/client?tab=orders" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--action)] transition hover:text-[var(--foreground)]">
            <ChevronRight className="size-3 rotate-180" />
            Back to order history
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Order history</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-[var(--foreground)]">Order {order.orderNumber || order.id}</span>
          </div>
          <h1 className="mt-2 break-words text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">Order {order.orderNumber || order.id}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-4 text-[var(--action)]" />
              Placed on {formatDate(order.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--action)]">
              <CircleDollarSign className="size-4" />
              Total: {formatCurrency(total)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderPrintView order={order} />
          {order.status === "pending" ? (
            <>
              <button
                type="button"
                onClick={() => setCancelConfirm(true)}
                disabled={cancelling}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
              >
                <X className="size-4" />
                {cancelling ? "Cancelling..." : "Cancel Order"}
              </button>
              {cancelConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setCancelConfirm(false)}>
                  <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Cancel Order?</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">This will restore inventory. This action cannot be undone.</p>
                    <div className="mt-5 flex gap-3">
                      <button type="button" onClick={() => setCancelConfirm(false)} className="flex-1 rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">Keep Order</button>
                      <button type="button" onClick={handleCancelOrder} disabled={cancelling} className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Yes, Cancel</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {order.status === "delivered" ? (
            <button
              type="button"
              onClick={reorderItems}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--action)] px-5 text-sm font-semibold text-[var(--action-foreground)] shadow-sm transition hover:brightness-95"
            >
              <RefreshCw className="size-4" />
              Reorder
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-[var(--surface-quiet)] p-5 sm:p-8">
        {order.status === "cancelled" ? (
          <div className="flex items-center gap-3 rounded-[1rem] bg-rose-50 px-4 py-4 text-rose-700">
            <CircleHelp className="size-5 shrink-0" />
            <p className="text-sm font-semibold">This order was cancelled.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-0 right-0 top-5 h-1 rounded-full bg-[var(--surface)]">
              <div className="h-full rounded-full bg-[var(--action)] transition-all" style={{ width: `${progressWidth}%` }} />
            </div>
            <div className="relative grid grid-cols-4 gap-2">
              {ORDER_PROGRESS_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isDone = progressIndex >= index;
                const isCurrent = progressIndex === index;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-3 text-center">
                    <span
                      className={cn(
                        "z-10 grid size-10 place-items-center rounded-full border bg-[var(--surface)] shadow-sm",
                        isDone ? "border-[var(--action)] bg-[var(--action)] text-[var(--action-foreground)]" : "border-[var(--border-soft)] text-[var(--muted-foreground)]",
                        isCurrent && "ring-8 ring-[color:color-mix(in_srgb,var(--action)_10%,var(--surface))]"
                      )}
                    >
                      {isDone ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                    </span>
                    <div>
                      <p className={cn("text-xs font-semibold sm:text-sm", isDone ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>{step.label}</p>
                      <p className="mt-1 hidden text-[11px] text-[var(--muted-foreground)] sm:block">
                        {isCurrent ? "Current status" : index === 0 ? formatDate(order.createdAt) : "-"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border-soft)] pb-4">
              <Truck className="size-5 text-[var(--action)]" />
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Delivery Information</h2>
            </div>
            <div className="grid gap-6 pt-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Shipping address</p>
                <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-[var(--foreground)]">{order.shippingAddress || order.delivery?.address || "Store Pickup"}</p>
                {order.note || order.delivery?.note ? (
                  <p className="mt-2 text-xs italic text-[var(--muted-foreground)]">Note: {order.note || order.delivery?.note}</p>
                ) : null}
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Delivery method</p>
                  <p className="mt-3 text-sm font-medium text-[var(--foreground)]">{order.trackingCarrier || "Standard delivery"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Tracking status</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--action)]">{order.trackingStatus || formatStatusLabel(order.status)}</p>
                  {order.trackingNumber ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">Number: {order.trackingNumber}</p> : null}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <OrderDeliveryMap
                lat={order.delivery?.lat}
                lng={order.delivery?.lng}
                address={order.shippingAddress || order.delivery?.address}
                deliveryNote={order.note || order.delivery?.note}
                driver={order.delivery?.driver}
                status={order.status}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="px-1 text-2xl font-semibold text-[var(--foreground)]">Order Items ({orderLines.length})</h2>
            <div className="space-y-3">
              {orderLines.map((line, index) => {
                const lineName = getOrderLineLabel(line);
                const lineTotal = Number(line.lineTotal || line.quantity * line.unitPrice || 0);
                const productImage = getProductImageForLine(store, line);
                return (
                  <div
                    key={`${order.id}-${line.productId || line.variantId || index}`}
                    className="group grid gap-4 rounded-[1.4rem] bg-[var(--surface)] p-4 shadow-sm transition hover:shadow-[var(--shadow-card)] sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center"
                  >
                    {productImage ? (
                      <div
                        className="size-20 overflow-hidden rounded-full bg-[var(--surface-quiet)] bg-cover bg-center shadow-inner transition group-hover:scale-[1.03]"
                        style={{ backgroundImage: `url(${productImage})` }}
                      />
                    ) : (
                      <div className="grid size-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.92),rgba(20,127,111,0.22)_34%,rgba(10,53,47,0.86)_100%)] text-base font-semibold text-white shadow-inner transition group-hover:scale-[1.03]">
                        {getProductInitials(lineName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-[var(--foreground)]">{lineName}</h3>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{line.sku || line.variantName || "Selected item"}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--action)]">Qty: {line.quantity}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-semibold text-[var(--foreground)]">{formatCurrency(lineTotal)}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">{formatCurrency(line.unitPrice)} each</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[1.5rem] bg-[var(--surface-quiet)] p-5">
            <h2 className="border-b border-[var(--border-soft)] pb-4 text-lg font-semibold text-[var(--foreground)]">Order Summary</h2>
            <div className="space-y-3 pt-4 text-sm">
              <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                <span>Subtotal</span>
                <span className="font-semibold text-[var(--foreground)]">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                <span>Coupon discount</span>
                <span className="font-semibold text-[var(--foreground)]">{discount ? `-${formatCurrency(discount)}` : formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                <span>Delivery fee</span>
                <span className="font-semibold text-[var(--action)]">Included</span>
              </div>
              {order.couponCode ? (
                <div className="rounded-[1rem] bg-[var(--surface)] px-3 py-3 text-xs font-semibold text-[var(--foreground)]">
                  Coupon: <span className="text-[var(--action)]">{order.couponCode}</span>
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-4 border-t border-[var(--border-soft)] pt-4">
                <span className="text-base font-semibold text-[var(--foreground)]">Order Total</span>
                <span className="text-3xl font-semibold text-[var(--action)]">{formatCurrency(total)}</span>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--action)_28%,white),color-mix(in_srgb,var(--accent-secondary)_34%,white))] p-5 text-[var(--foreground)]">
            <div className="grid size-12 place-items-center rounded-full bg-[var(--action)] text-[var(--action-foreground)]">
              <MessageCircle className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Need help with your order?</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/75">
              Contact support with your order number and delivery details.
            </p>
            <Link
              href="/client?tab=profile"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--action)] px-4 text-sm font-semibold text-[var(--action-foreground)] transition hover:brightness-95"
            >
              Chat With Support
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ClientProfilePageView({ user }) {
  const store = useAppStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [copiedCoupon, setCopiedCoupon] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);

  const lang = store.language || "en";
  const { t } = useTranslation(lang);

  const userTickets = store.supportTickets.filter(
    (ticket) => ticket.messages.some((entry) => entry.authorEmail === user.email) || ticket.messages[0]?.authorEmail === user.email,
  );
  const userCoupons = store.coupons.filter(
    (coupon) => coupon.isActive && ((coupon.audience === "everyone" || coupon.audience === "all") || !coupon.userEmail || coupon.userEmail === user.email),
  );

  useEffect(() => {
    if (!walletOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [walletOpen]);

  async function submitTicket(event) {
    event.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 3) {
      setSupportNotice("Please enter a longer subject and message.");
      return;
    }
    const result = await store.submitSupportTicket(subject.trim(), message.trim());
    if (!result.success) {
      setSupportNotice(result.message || "Unable to send support ticket.");
      return;
    }
    setSupportNotice("Support ticket sent.");
    setSubject("");
    setMessage("");
  }

  async function copyCoupon(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCoupon(code);
      window.setTimeout(() => setCopiedCoupon(""), 1400);
    } catch {
      setCopiedCoupon(code);
      window.setTimeout(() => setCopiedCoupon(""), 1400);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(19,127,111,0.16),rgba(19,127,111,0.05))] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)]">
            <CircleUserRound className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-[var(--foreground)]">Welcome back</p>
            <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{user.email}</p>
          </div>
          <LogoutButton iconOnly />
        </div>
      </div>

      <Card className="p-0">
        <div className="divide-y divide-[var(--border-soft)]">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-3">
              <ReceiptText className="size-5 text-[var(--action)]" />
              <span className="font-medium text-[var(--foreground)]">Total orders</span>
            </div>
            <span className="text-base font-semibold text-[var(--foreground)]">{store.orders.length}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <Truck className="size-5 text-[var(--action)]" />
            <div>
              <p className="font-medium text-[var(--foreground)]">Delivery preferences</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Standard delivery - 2 to 3 days</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <Globe className="size-5 text-[var(--action)]" />
            <div className="flex-1">
              <p className="font-medium text-[var(--foreground)]">{t("change_language")}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => store.setLanguage("en")}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    lang === "en" ? "border-[color-mix(in_srgb,var(--action)_45%,transparent)] bg-[var(--action-surface)] text-[var(--action-on-muted)]" : "border-[var(--border-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  {t("english")}
                </button>
                <button
                  type="button"
                  onClick={() => store.setLanguage("km")}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    lang === "km" ? "border-[color-mix(in_srgb,var(--action)_45%,transparent)] bg-[var(--action-surface)] text-[var(--action-on-muted)]" : "border-[var(--border-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  {t("khmer")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setWalletOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setWalletOpen(true);
          }
        }}
        className="rounded-[1.5rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--action)_24%,white),color-mix(in_srgb,var(--accent-secondary)_28%,white),color-mix(in_srgb,var(--accent-tertiary)_20%,white))] p-5 text-[var(--foreground)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-strong)]"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/30 p-3">
            <Ticket className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">Coupon wallet</h2>
            <p className="mt-1 text-sm text-[var(--foreground)]/78">
              {userCoupons.length ? "Tap to view, copy, and use your coupons" : "No coupons yet. New offers will appear here."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {userCoupons.length ? (
            userCoupons.slice(0, 3).map((coupon) => (
              <div
                key={coupon.id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold"
              >
                <span>
                  {coupon.code} {coupon.type === "percent" ? `${coupon.value}% OFF` : `${formatCurrency(coupon.value)} OFF`}
                </span>
                <Copy className="size-4" />
              </div>
            ))
          ) : (
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-[var(--foreground)]/84">
              When the store publishes a promo or assigns a coupon to your account, you will see it here.
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--foreground)]/78">{userCoupons.length ? `${userCoupons.length} available` : "Waiting for offers"}</span>
          <span className="font-semibold">{copiedCoupon ? `${copiedCoupon} copied` : userCoupons.length ? "Open wallet" : "Check offers"}</span>
        </div>
      </div>

      <AnimatePresence>
        {walletOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/52 px-4 py-6 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: easeInOutCubic }}
            onClick={() => setWalletOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-[40rem] overflow-hidden rounded-[1.85rem] border border-white/10 bg-[color-mix(in_srgb,#0d151d_88%,var(--surface))] p-4 text-white shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:p-5"
              initial={{ opacity: 0, y: 120, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 36, scale: 0.985 }}
              transition={{ duration: 0.38, ease: easeInOutCubic }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(97,194,186,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(181,120,120,0.14),transparent_38%)]" />

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.04, ease: easeInOutCubic }}
                className="relative"
              >
                <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/18" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[2rem] font-semibold tracking-[-0.03em] text-white">Coupon wallet</h2>
                    <p className="mt-1 text-sm text-white/72">
                      {userCoupons.length ? `${userCoupons.length} ready to use` : "0 ready to use"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWalletOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/84 transition hover:bg-white/12"
                    aria-label="Close coupon wallet"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: easeInOutCubic }}
                className="relative mt-5 rounded-[1.5rem] border border-white/8 bg-white/6 p-4 sm:p-5"
              >
                {userCoupons.length ? (
                  <div className="space-y-3">
                    {userCoupons.map((coupon, index) => (
                      <motion.button
                        key={coupon.id}
                        type="button"
                        onClick={() => copyCoupon(coupon.code)}
                        initial={{ opacity: 0, x: 26 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.28,
                          delay: 0.16 + index * 0.06,
                          ease: easeInOutCubic,
                        }}
                        className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-4 text-left transition hover:bg-white/12"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-white">{coupon.code}</p>
                          <p className="mt-1 text-sm text-white/72">
                            {coupon.type === "percent" ? `${coupon.value}% OFF` : `${formatCurrency(coupon.value)} OFF`} · {coupon.description || "Valid at checkout"}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/18 px-3 py-2 text-sm font-semibold text-white/90">
                          <Copy className="size-4" />
                          {copiedCoupon === coupon.code ? "Copied" : "Copy"}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.18, ease: easeInOutCubic }}
                    className="flex min-h-[24rem] flex-col items-center justify-center rounded-[1.5rem] border border-white/8 bg-white/4 px-6 text-center"
                  >
                    <div className="rounded-full border border-[color:rgba(103,219,208,0.25)] bg-[rgba(103,219,208,0.08)] p-4 text-[#7ce5da]">
                      <Ticket className="size-8" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-white">No coupons yet</h3>
                    <p className="mt-3 max-w-md text-sm leading-7 text-white/72">
                      When the store publishes an offer or assigns one to your account, it will appear here and you can copy the code into checkout.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {userTickets.length ? (
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface)_90%,white),color-mix(in_srgb,var(--surface-quiet)_88%,var(--accent-secondary)),color-mix(in_srgb,var(--surface)_92%,var(--action)))] p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Your support tickets</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Track replies and ticket status from the support team.</p>
          <div className="mt-4 space-y-3">
            {userTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{ticket.subject}</h3>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase", statusClasses(ticket.status))}>
                    {ticket.status}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {ticket.messages.map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">{entry.authorRole === "ADMIN" ? "Admin" : entry.authorEmail}</p>
                      <p className="mt-1 leading-7 text-[var(--muted-foreground)]">{entry.message}</p>
                    </div>
                  ))}
                </div>
                {ticket.status !== "closed" ? (
                  <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <input
                      value={replyDrafts[ticket.id] || ""}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                      placeholder="Reply to this ticket"
                      className="app-input flex-1 px-4 py-3 text-sm"
                    />
                    <Button
                      onClick={() => {
                        const next = (replyDrafts[ticket.id] || "").trim();
                        if (!next) {
                          return;
                        }
                        store.replySupport(ticket.id, next, user.email, "CLIENT");
                        setReplyDrafts((current) => ({ ...current, [ticket.id]: "" }));
                      }}
                    >
                      Reply
                    </Button>
                    <Button variant="secondary" onClick={() => store.closeSupport(ticket.id)}>
                      Close ticket
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <div className="flex items-center gap-3">
          <MessageCircle className="size-5 text-[var(--action)]" />
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Support team</h2>
        </div>
        <form onSubmit={submitTicket} className="mt-5 space-y-4">
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="app-input w-full px-4 py-3 text-sm" />
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe your issue" className="app-input min-h-28 w-full px-4 py-3 text-sm" />
          <p className="text-xs leading-6 text-[var(--muted-foreground)]">
            Only signed-in users can create tickets. Replies will appear above in your ticket history.
          </p>
          {supportNotice ? <div className="rounded-2xl bg-[var(--surface-quiet)] px-4 py-3 text-sm">{supportNotice}</div> : null}
          <Button type="submit">Contact support</Button>
        </form>
      </Card>
    </div>
  );
}

export function ClientProductDetailPageView({ productId, user }) {
  const store = useAppStore();
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingMessage, setEditingMessage] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [authModal, setAuthModal] = useState({ isOpen: false, hint: "" });
  const product = store.getProduct(productId);

  /** Opens the auth modal for guests; returns false so callers can bail early. */
  function requireAuth(hint) {
    if (!user) {
      setAuthModal({ isOpen: true, hint: hint || "" });
      return false;
    }
    return true;
  }

  const isVariantProduct = useMemo(
    () => Boolean(product) && product.isVariant && Array.isArray(product.variants) && product.variants.length > 0,
    [product]
  );
  const productVariants = useMemo(
    () => (isVariantProduct ? product.variants.filter((v) => v.isActive !== false) : []),
    [isVariantProduct, product]
  );
  const selectedVariant = useMemo(
    () => (productVariants.length && selectedVariantId ? productVariants.find((v) => v.id === selectedVariantId) : null),
    [productVariants, selectedVariantId]
  );

  useEffect(() => {
    if (!isVariantProduct || selectedVariantId || !product) {
      return;
    }
    const defaultVariant = product.variants.find((v) => v.isActive !== false && Number(v.stock) > 0);
    if (defaultVariant) {
      setSelectedVariantId(defaultVariant.id);
    }
  }, [isVariantProduct, product, selectedVariantId]);

  const { effectivePrice, effectiveStock, effectiveDiscountPercent } = useMemo(() => {
    if (!product) return { effectivePrice: 0, effectiveStock: 0, effectiveDiscountPercent: 0 };
    if (selectedVariant) {
      return {
        effectivePrice: Number((selectedVariant.price * (1 - (selectedVariant.discountPercent || 0) / 100)).toFixed(2)),
        effectiveStock: Number(selectedVariant.stock || 0),
        effectiveDiscountPercent: selectedVariant.discountPercent || 0,
      };
    }
    const displayPrice = Number(product.displayPrice || product.price || 0);
    const displayDiscount = Number(product.displayDiscountPercent ?? product.discountPercent ?? 0);
    return {
      effectivePrice: Number((displayPrice * (1 - displayDiscount / 100)).toFixed(2)),
      effectiveStock: Number(product.stock || 0),
      effectiveDiscountPercent: displayDiscount,
    };
  }, [product, selectedVariant]);

  const selectedCartQuantity = useMemo(() => {
    if (!product) return 0;
    return isVariantProduct
      ? store.cartQuantityFor(product.id, selectedVariant?.id || null)
      : store.cartQuantityFor(product.id);
  }, [product, isVariantProduct, store, selectedVariant]);

  if (!product) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted-foreground)]">Product not found.</p>
      </Card>
    );
  }

  function handleAddToCart() {
    // Never silently pick a variant. If the customer has not explicitly
    // chosen an option, require the selection first. This prevents ordering
    // the wrong (e.g. cheapest) variant by mistake.
    if (isVariantProduct && !selectedVariantId) {
      return;
    }
    if (!requireAuth("Sign in to add items to your cart")) return;
    store.addToCart(product.id, 1, selectedVariantId);
  }

  return (
    <>
      <div className="space-y-4 pb-28">
        <div className="sticky top-0 z-30 bg-[var(--background-start)]/90 backdrop-blur-md py-2 -mx-5 px-5">
          <Link href="/client" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--action)] transition hover:text-[var(--foreground)]">
            <CircleArrowLeft className="size-5" />
            Back to shop
          </Link>
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)]">
          <div className="min-h-80 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.48)), url(${product.image})` }} />
        </div>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <span className="app-chip px-3 py-1.5 text-sm" data-active="true">{product.category}</span>
              <span className="app-chip px-3 py-1.5 text-sm" data-active="true">
                {effectiveStock > 0 ? `${effectiveStock} available` : "Out of stock"}
              </span>
              <span className="app-chip px-3 py-1.5 text-sm" data-active="true">
                {product.rating.toFixed(1)} * ({product.ratingCount})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!requireAuth("Sign in to save this product to favorites")) return;
                store.toggleFavorite(product.id);
              }}
              className={cn(
                "rounded-full p-3",
                store.isFavorite(product.id) ? "bg-rose-100 text-rose-600" : "bg-[var(--surface)] text-[var(--muted-foreground)]",
              )}
            >
              <Heart className={cn("size-5", store.isFavorite(product.id) && "fill-current")} />
            </button>
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{product.name}</h1>
          <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
            {formatCurrency(effectivePrice)}
          </p>
          {effectiveDiscountPercent > 0 ? <p className="mt-1 text-sm font-semibold text-green-700">{effectiveDiscountPercent}% off</p> : null}

          {/* Variant Selector */}
          {isVariantProduct && product.variants.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Choose option:</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  const variantPrice = variant.price * (1 - (variant.discountPercent || 0) / 100);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm font-semibold transition text-left",
                        isSelected
                          ? "border-[var(--action)] bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] text-[var(--foreground)]"
                          : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--action)]",
                      )}
                    >
                      <span className="block">{variant.name}</span>
                      <span className="block mt-1 text-xs opacity-80">{formatCurrency(variantPrice)}</span>
                      {variant.stock <= 0 ? (
                        <span className="block mt-1 text-[10px] text-red-400">Out of stock</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <p className="mt-5 text-base leading-8 text-[var(--muted-foreground)]">{product.description}</p>

          <div className="mt-6 rounded-[1.4rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--action)_18%,white),color-mix(in_srgb,var(--accent-secondary)_25%,white))] p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/35 p-3 text-[var(--foreground)]">
                <Truck className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Free delivery over $50</p>
                <p className="mt-1 text-sm leading-6 text-[var(--foreground)]/82">
                  Same-day pickup available for essentials and fresh items.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Rate this product</h2>
            <div className="mt-2 flex">
              {Array.from({ length: 5 }, (_, index) => index + 1).map((ratingValue) => (
                <button
                  key={ratingValue}
                  type="button"
                  onClick={() => {
                    if (!user?.email) {
                      return;
                    }
                    store.submitRating?.(product.id, ratingValue);
                  }}
                  className="rounded-full p-1"
                  aria-label={`Rate ${ratingValue} stars`}
                >
                  <Star className={cn("size-6", product.rating >= ratingValue ? "fill-amber-400 text-amber-400" : "text-amber-400")} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <MessageCircle className="size-5 text-[var(--action)]" />
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Customer comments</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(product.comments || []).length ? (
                product.comments.map((entry) => {
                  const canEdit = Boolean(user?.email) && (user.role === "ADMIN" || user.email === entry.userEmail);
                  const isEditing = editingId === entry.id;

                  return (
                    <div key={entry.id} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{entry.userEmail}</p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {entry.isEdited ? `Edited | ${formatDate(entry.updatedAt || entry.createdAt)}` : formatDate(entry.createdAt)}
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditingMessage(entry.message);
                              }}
                              className="app-icon-button p-2"
                              aria-label="Edit comment"
                            >
                              <Edit3 className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => store.deleteComment?.(product.id, entry.id)}
                              className="app-icon-button p-2"
                              aria-label="Delete comment"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {isEditing ? (
                        <div className="mt-3 space-y-3">
                          <textarea value={editingMessage} onChange={(event) => setEditingMessage(event.target.value)} className="app-input min-h-24 w-full px-4 py-3 text-sm" />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                if (editingMessage.trim().length < 3) {
                                  return;
                                }
                                store.updateComment?.(product.id, entry.id, editingMessage.trim());
                                setEditingId("");
                                setEditingMessage("");
                              }}
                            >
                              Save
                            </Button>
                            <Button variant="secondary" onClick={() => {
                              setEditingId("");
                              setEditingMessage("");
                            }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 leading-7 text-[var(--muted-foreground)]">{entry.message}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">No comments yet. Be the first to comment.</p>
              )}
            </div>

            {!user?.email ? (
              <div className="mt-4">
                <Link href="/?auth=login" className="inline-flex items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Login to comment
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" className="app-input min-h-24 w-full px-4 py-3 text-sm" />
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (comment.trim().length < 3) {
                        return;
                      }
                      store.addComment(product.id, comment.trim());
                      setComment("");
                    }}
                  >
                    Post comment
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="sticky bottom-4 rounded-[1.5rem] border border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--surface-quiet),var(--surface),color-mix(in_srgb,var(--action)_12%,var(--surface)))] px-4 py-4 shadow-[0_-4px_16px_rgba(15,24,35,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Total</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {formatCurrency(effectivePrice)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {selectedCartQuantity ? (
                <span className="text-sm font-medium text-[var(--muted-foreground)]">{selectedCartQuantity} in cart</span>
              ) : null}
              <Button onClick={handleAddToCart} disabled={effectiveStock <= 0}>
                {effectiveStock > 0 ? (isVariantProduct && !selectedVariantId ? "Select option" : "Add to cart") : "Out of stock"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth modal — shown to guests when they attempt a protected action */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={() => setAuthModal({ isOpen: false, hint: "" })}
        hint={authModal.hint}
      />
    </>
  );
}

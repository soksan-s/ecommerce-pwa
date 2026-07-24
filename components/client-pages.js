"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarRange,
  CircleUserRound,
  Copy,
  Edit3,
  Gift,
  Globe,
  Heart,
  MessageCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { DeliveryLocationPicker } from "@/components/delivery-location-picker";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { Button } from "@/components/ui/button";
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
      return "bg-emerald-100 text-emerald-700";
    case "shipped":
      return "bg-sky-100 text-sky-700";
    case "processing":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function StatusPill({ status }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase", statusClasses(status))}>
      {formatStatusLabel(status)}
    </span>
  );
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
      <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
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

function getProductDiscountedPrice(product) {
  return product.price * (1 - product.discountPercent / 100);
}

function ProductCard({ product, store }) {
  const { t } = useTranslation(store.language);
  const isFavorite = store.isFavorite(product.id);
  const discountedPrice = getProductDiscountedPrice(product);
  const hasDiscount = product.discountPercent > 0 && discountedPrice < product.price;

  return (
    <div className="public-home-product-card flex h-full flex-col overflow-hidden rounded-[1.45rem] shadow-[0_16px_38px_rgba(3,10,18,0.22)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]">
      <Link href={`/client/product-detail/${product.id}`} className="block">
        <div
          className="relative aspect-[1/0.92] overflow-hidden bg-[#d7dadd]"
          style={{
            backgroundImage: product.image ? `url(${product.image})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(0,0,0,0.52))]" />
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
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

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {hasDiscount ? (
            <span className="public-home-product-muted text-[0.88rem] line-through">
              {formatCurrency(product.price)}
            </span>
          ) : null}
          <span className="font-semibold text-[var(--public-home-product-foreground)]">
            {formatCurrency(discountedPrice)}
          </span>
          {hasDiscount ? <span className="text-emerald-400">{product.discountPercent}% off</span> : null}
          <span className="inline-flex items-center gap-1 text-[var(--public-home-product-foreground)]/80">
            <Star className="size-3.5 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        </div>

        <p className={cn("text-xs font-medium", product.stock <= 5 ? "text-red-400" : "text-emerald-400")}>
          {product.stock > 0 ? t("in_stock").replace("{count}", product.stock) : t("out_of_stock")}
        </p>

        <Button
          className="mt-auto w-full rounded-[0.95rem] border border-[color-mix(in_srgb,var(--action)_36%,transparent)] bg-[var(--action)] py-2.5 text-[var(--action-foreground)] shadow-none hover:brightness-[1.01]"
          onClick={() => store.addToCart(product.id)}
          disabled={product.stock <= 0}
        >
          {product.stock > 0 ? t("add_to_cart") : t("out_of_stock")}
        </Button>
      </div>
    </div>
  );
}

function ClientHeroCard({ product }) {
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
              <h3 className="mt-2 max-w-[11rem] text-[1.68rem] font-bold leading-[1.03] text-white sm:max-w-[12rem] sm:text-[1.8rem]">
                {product.name}
              </h3>
              <p className="mt-2 line-clamp-2 max-w-[13rem] text-[0.76rem] leading-5 text-white/72">
                {product.description}
              </p>
            </div>
            <div className="mt-4 inline-flex items-center rounded-[0.9rem] border border-white/12 bg-white/16 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {formatCurrency(getProductDiscountedPrice(product))}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

function ClientHeroCarousel({ products, reverse = false }) {
  const USER_PAUSE_MS = 1000;
  const REPEAT_COUNT = 5;
  const BASE_CYCLE_INDEX = Math.floor(REPEAT_COUNT / 2);
  const scrollRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);
  const interactionUntilRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const currentVelocityRef = useRef(0);
  const targetVelocityRef = useRef(0);
  const isVisibleRef = useRef(false);
  const shouldAutoScroll = products.length > 1;
  const visibleProducts = products.slice(0, 5);
  const productIdsKey = visibleProducts.map((product) => product.id).join("|");

  useEffect(() => {
    const scrollNode = scrollRef.current;

    if (!scrollNode) {
      return undefined;
    }

    lastTimeRef.current = 0;
    interactionUntilRef.current = 0;
    pointerActiveRef.current = false;
    currentVelocityRef.current = 0;
    targetVelocityRef.current = 0;

    if (!shouldAutoScroll || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const cycleWidth = scrollNode.scrollWidth / REPEAT_COUNT;
    if (!cycleWidth) {
      return undefined;
    }

    scrollNode.scrollLeft = cycleWidth * BASE_CYCLE_INDEX;

    const step = (now) => {
      if (!scrollNode || !isVisibleRef.current) {
        animationRef.current = null;
        return;
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
      }

      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const baseSpeed = window.innerWidth < 640 ? 0.04 : 0.05;
      const directionalSpeed = reverse ? -baseSpeed : baseSpeed;

      if (!pointerActiveRef.current && now >= interactionUntilRef.current) {
        targetVelocityRef.current = directionalSpeed;
      } else {
        targetVelocityRef.current = 0;
      }

      const easing = pointerActiveRef.current ? 0.12 : 0.045;
      currentVelocityRef.current += (targetVelocityRef.current - currentVelocityRef.current) * easing;

      if (Math.abs(currentVelocityRef.current) < 0.0006) {
        currentVelocityRef.current = 0;
      }

      if (currentVelocityRef.current !== 0) {
        scrollNode.scrollLeft += delta * currentVelocityRef.current;
      }

      while (scrollNode.scrollLeft <= cycleWidth * (BASE_CYCLE_INDEX - 0.5)) {
        scrollNode.scrollLeft += cycleWidth;
      }

      while (scrollNode.scrollLeft >= cycleWidth * (BASE_CYCLE_INDEX + 0.5)) {
        scrollNode.scrollLeft -= cycleWidth;
      }

      animationRef.current = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;

        if (entry.isIntersecting && !animationRef.current) {
          lastTimeRef.current = 0;
          animationRef.current = window.requestAnimationFrame(step);
        } else if (!entry.isIntersecting && animationRef.current) {
          window.cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
          lastTimeRef.current = 0;
        }
      },
      { rootMargin: "64px" },
    );
    observer.observe(scrollNode);

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [BASE_CYCLE_INDEX, REPEAT_COUNT, productIdsKey, reverse, shouldAutoScroll]);

  if (!shouldAutoScroll) {
    return (
      <div className="overflow-hidden pb-1">
        <div className="flex gap-4">
          {visibleProducts.map((product) => (
            <ClientHeroCard key={`${product.id}-single`} product={product} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden pb-1"
      onPointerDown={() => {
        pointerActiveRef.current = true;
        interactionUntilRef.current = performance.now() + USER_PAUSE_MS;
        targetVelocityRef.current = 0;
      }}
      onPointerUp={() => {
        pointerActiveRef.current = false;
        interactionUntilRef.current = performance.now() + USER_PAUSE_MS;
      }}
      onPointerCancel={() => {
        pointerActiveRef.current = false;
        interactionUntilRef.current = performance.now() + USER_PAUSE_MS;
      }}
      onWheel={() => {
        interactionUntilRef.current = performance.now() + USER_PAUSE_MS;
        targetVelocityRef.current = 0;
      }}
    >
      <div
        ref={scrollRef}
        className="flex gap-0 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: REPEAT_COUNT }, (_, cycleIndex) => (
          <div
            key={`cycle-${cycleIndex}`}
            aria-hidden={cycleIndex !== BASE_CYCLE_INDEX}
            className={cn("flex shrink-0 gap-4", cycleIndex !== REPEAT_COUNT - 1 && "pr-4")}
          >
            {visibleProducts.map((product) => (
              <ClientHeroCard key={`${product.id}-cycle-${cycleIndex}`} product={product} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientProductGrid({ products, store }) {
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
              <ProductCard product={product} store={store} />
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

export function ClientProductListPageView({ productsOverride = null }) {
  const store = useAppStore();
  const { t } = useTranslation(store.language);
  const isCustomCollection = Boolean(productsOverride);
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [sort, setSort] = useState("Featured");
  const [priceFilter, setPriceFilter] = useState("all");
  const [quickFilters, setQuickFilters] = useState(INITIAL_CLIENT_QUICK_FILTERS);
  const [visibleGridCounts, setVisibleGridCounts] = useState({});
  const [revealState, setRevealState] = useState(null);
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

  const products = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = sourceProducts.filter((product) => {
      const discountedPrice = getProductDiscountedPrice(product);

      if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) {
        return false;
      }
      if (lower && ![product.name, product.description, product.category].some((value) => value.toLowerCase().includes(lower))) {
        return false;
      }

      if (quickFilters.inStock && product.stock <= 0) {
        return false;
      }
      if (quickFilters.onSale && product.discountPercent <= 0) {
        return false;
      }
      if (quickFilters.topRated && (product.rating || 0) < 4.7) {
        return false;
      }
      if (quickFilters.bulkBuy && product.stock < 20) {
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
    return sorted.sort((a, b) => {
      switch (sort) {
        case "Price: Low to High":
          return getProductDiscountedPrice(a) - getProductDiscountedPrice(b);
        case "Price: High to Low":
          return getProductDiscountedPrice(b) - getProductDiscountedPrice(a);
        case "Stock":
          return b.stock - a.stock;
        case "Name":
          return a.name.localeCompare(b.name);
        case "Biggest discount":
          return b.discountPercent - a.discountPercent;
        default:
          return b.rating - a.rating;
      }
    });
  }, [priceFilter, query, quickFilters, selectedCategories, sort, sourceProducts]);

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
      return;
    }
    setSelectedCategories([category]);
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
      <div className="public-home-banner relative overflow-hidden rounded-[1.45rem] px-4 py-4 shadow-[0_12px_28px_rgba(2,10,18,0.16)] sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-32 rounded-full bg-[color-mix(in_srgb,var(--action)_18%,transparent)]" />
        <div className="relative">
          <h2 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {isCustomCollection ? t("favorites") : t("shop")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--foreground)]/82">
            {isCustomCollection
              ? t("no_favorites_hint")
              : t("filter_hint")}
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17.75rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
        <aside className="hidden lg:order-2 lg:block">
          <div className="sticky top-6 rounded-[1.6rem] border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface)_92%,var(--background-start))] p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[1.4rem] font-semibold text-[var(--foreground)]">{t("filters")}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("grocery_items").replace("{count}", products.length)}</p>
              </div>
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-[var(--action)]">
                {t("reset")}
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("sort_by")}</h3>
                <div className="space-y-2">
                  {CLIENT_SORT_OPTIONS.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 text-sm text-[var(--foreground)]">
                      <input
                        type="radio"
                        name="client-sort"
                        checked={sort === option}
                        onChange={() => setSort(option)}
                        className="size-4 accent-[var(--action)]"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("quick_filters")}</h3>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_QUICK_FILTER_OPTIONS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => toggleQuickFilter(filter.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm transition",
                        quickFilters[filter.id]
                          ? "border-transparent bg-[color-mix(in_srgb,var(--action)_16%,var(--surface))] text-[var(--foreground)]"
                          : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--foreground)]",
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("price")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENT_PRICE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriceFilter(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm transition",
                        priceFilter === option.value
                          ? "border-transparent bg-[color-mix(in_srgb,var(--action)_16%,var(--surface))] text-[var(--foreground)]"
                          : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--foreground)]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("categories")}</h3>
                  <span className="text-xs text-[var(--muted-foreground)]">{selectedCategories.length || sourceCategories.length}</span>
                </div>

                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5">
                  <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <Search className="size-4" />
                    <input
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder={t("search_categories")}
                      className="w-full bg-transparent outline-none placeholder:text-[var(--muted-foreground)]"
                    />
                  </label>
                </div>

                <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1">
                  {visibleCategoryOptions.map((category) => (
                    <label key={category} className="flex cursor-pointer items-center gap-3 text-sm text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleSidebarCategory(category)}
                        className="size-4 rounded accent-[var(--action)]"
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 lg:order-1">
          <div className="public-home-search-shell rounded-[1.1rem] p-1.5 shadow-[0_8px_22px_rgba(3,10,18,0.12)]">
            <label className="flex items-center gap-3 rounded-[1.05rem] px-4 py-3">
              <Search className="size-5 text-[var(--action)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search_products_deals")}
                className="w-full bg-transparent text-[1rem] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
              />
            </label>
          </div>

          <div className="space-y-3 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {categoryChips.map((category) => {
                const isActive = category === "All" ? selectedCategories.length === 0 : selectedCategories.includes(category);

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => chooseQuickCategory(category)}
                    className="public-home-chip inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition text-[var(--foreground)]"
                    data-active={isActive}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="public-home-select w-full rounded-[1rem] border px-4 py-3 text-[1rem] text-[var(--foreground)] outline-none"
            >
              {CLIENT_SORT_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="hidden items-center justify-between rounded-[1.2rem] border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--background-start))] px-4 py-3 lg:flex">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{t("products_ready").replace("{count}", products.length)}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t("filter_hint")}</p>
            </div>
            {activeFilterCount ? (
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-[var(--action)]">
                {t("clear_filters")}
              </button>
            ) : null}
          </div>

          {products.length ? (
            isCustomCollection ? (
              <ClientProductGrid key={productGridKey} products={products} store={store} />
            ) : (
              <div className="space-y-6">
                <ClientHeroCarousel products={products.slice(0, 5)} />

                {groupedProducts.map((group) => (
                  <section key={group.category} className="space-y-4">
                    <h2 className="px-1 text-[1.18rem] font-medium text-[var(--foreground)]">{group.category}</h2>

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
                              <ProductCard product={product} store={store} />
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
    <div className="space-y-4">
      {store.cartItems.length ? (
        <>
          <div className="space-y-3 px-4">
            {store.cartItems.map((item) => (
              <Card key={item.productId} className="p-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div
                    className="h-[5.25rem] w-[5.25rem] rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: item.product.image ? `url(${item.product.image})` : undefined }}
                  />
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--foreground)]">{item.product.name}</h2>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {item.product.discountPercent > 0
                          ? `${formatCurrency(item.product.price * (1 - item.product.discountPercent / 100))} ${t("each")} (was ${formatCurrency(item.product.price)})`
                          : `${formatCurrency(item.product.price)} ${t("each")}`}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{t("subtotal")}: {formatCurrency(item.subtotal)}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-center">
                      <div className="flex items-center">
                        <button type="button" onClick={() => store.decreaseCart(item.productId)} className="app-icon-button p-2">
                          -
                        </button>
                        <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                        <button type="button" onClick={() => store.addToCart(item.productId)} className="app-icon-button p-2">
                          +
                        </button>
                      </div>
                      <button type="button" onClick={() => store.removeFromCart(item.productId)} className="text-sm font-medium text-[var(--action)]">
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="rounded-t-[1.5rem] border-t border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--surface-quiet),var(--surface),color-mix(in_srgb,var(--action)_12%,var(--surface)))] px-4 pb-4 pt-3 shadow-[0_-4px_16px_rgba(15,24,35,0.06)]">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-lg font-bold text-[var(--foreground)]">{t("total")}</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{formatCurrency(store.cartTotal)}</p>
              </div>
              <div className="ml-auto">
                <Link href="/client/checkout" prefetch={false} className="inline-flex items-center justify-center rounded-xl bg-[var(--action)] px-[1.125rem] py-[0.875rem] text-sm font-semibold text-[var(--action-foreground)] shadow-[var(--shadow-soft)]">
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
  );
}

export function ClientCheckoutPageView() {
  const store = useAppStore();
  const { t } = useTranslation(store.language);
  const router = useRouter();
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash on delivery");
  const [couponCode, setCouponCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    });

    setSubmitting(false);

    if (!result.success || !result.order) {
      setMessage(result.message || "Unable to place order.");
      return;
    }

    setMessage(`Order ${result.order.id} placed successfully.`);
    router.push("/client?tab=orders");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("order_summary")}</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--muted-foreground)]">{t("items")}</span>
              <span className="font-semibold text-[var(--foreground)]">{store.cartItems.length}</span>
            </div>
            {store.cartItems.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--muted-foreground)]">
                  {item.product.name} x {item.quantity}
                </span>
                <span className="font-semibold text-[var(--foreground)]">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-white/50 pt-4">
            <p className="text-sm text-[var(--muted-foreground)]">{t("total")}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{formatCurrency(store.cartTotal)}</p>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("delivery_details")}</h2>
          <div className="mt-4 space-y-4">
            <DeliveryLocationPicker
              onAddressSelect={setShippingAddress}
              locateLabel={t("use_current_location")}
              pickLabel={t("pick_on_map")}
              hint={t("map_location_hint")}
            />
            <textarea
              value={shippingAddress}
              onChange={(event) => setShippingAddress(event.target.value)}
              placeholder={t("shipping_address")}
              className="app-input min-h-32 px-4 py-3 text-sm"
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
              <option>{t("cash_on_delivery")}</option>
              <option>{t("credit_card")}</option>
              <option>{t("bank_transfer")}</option>
            </select>
            {message ? <div className="rounded-2xl bg-[var(--surface-quiet)] px-4 py-3 text-sm">{message}</div> : null}
            <Button type="submit" className="w-full" disabled={submitting || !store.cartItems.length}>
              {submitting ? t("placing_order") : t("place_order")}
            </Button>
          </div>
        </Card>
      </form>
  );
}

export function ClientOrderHistoryPageView() {
  const store = useAppStore();
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
        order.shippingAddress.toLowerCase().includes(lower) ||
        order.paymentMethod.toLowerCase().includes(lower) ||
        order.lines.some((line) => line.productName.toLowerCase().includes(lower))
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

  const dateRangeLabel =
    startDate && endDate
      ? `${new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })} - ${new Date(`${endDate}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
      : startDate
        ? `From ${new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
        : endDate
          ? `Until ${new Date(`${endDate}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
          : "Date range";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <label className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3">
            <Search className="size-4 text-[var(--action)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={store.t ? store.t("search_order") : "Search order ID, address, payment, product"}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="app-select px-4 py-3 text-sm">
            <option value="all">{store.t ? store.t("all_status") : "All status"}</option>
            <option value="pending">{store.t ? store.t("status_pending") : "Pending"}</option>
            <option value="processing">{store.t ? store.t("status_processing") : "Processing"}</option>
            <option value="shipped">{store.t ? store.t("status_shipped") : "Shipped"}</option>
            <option value="delivered">{store.t ? store.t("status_delivered") : "Delivered"}</option>
            <option value="cancelled">{store.t ? store.t("status_cancelled") : "Cancelled"}</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="app-select px-4 py-3 text-sm">
            <option value="newest">{store.t ? store.t("newest") : "Newest"}</option>
            <option value="oldest">{store.t ? store.t("oldest") : "Oldest"}</option>
            <option value="total-high">{store.t ? store.t("total_high") : "Total high-low"}</option>
            <option value="total-low">{store.t ? store.t("total_low") : "Total low-high"}</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="app-input px-4 py-3 text-sm" />
          <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="app-input px-4 py-3 text-sm" />
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            <CalendarRange className="size-4" />
            {dateRangeLabel}
          </button>
        </div>
      </Card>

      {store.orders.length === 0 ? (
        <div className="flex min-h-[12rem] items-center justify-center text-center text-[var(--muted-foreground)]">
          No orders yet. Completed orders will show here.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length ? (
          orders.map((order) => (
            <details key={order.id} className="app-card overflow-hidden">
              <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-[var(--foreground)]">{order.id}</h2>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{formatDate(order.createdAt)}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{order.shippingAddress}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-left lg:min-w-[11rem] lg:text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Total</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(order.total)}</p>
                  </div>
                </div>
              </summary>

              <div className="grid gap-5 border-t border-[var(--border-soft)] px-5 py-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Items</p>
                  <div className="mt-4 space-y-3">
                    {order.lines.map((line) => (
                      <div key={`${order.id}-${line.productId}`} className="rounded-[1.2rem] bg-[var(--surface)] px-4 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{line.productName}</p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              Qty {line.quantity}
                              {line.discountPercent ? ` | ${line.discountPercent}% off` : " | Regular price"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{formatCurrency(line.quantity * line.unitPrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(order.trackingCarrier || order.trackingStatus || order.trackingNumber) ? (
                    <div className="rounded-[1.2rem] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        <Truck className="size-4 text-[var(--action)]" />
                        Tracking
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                        {order.trackingCarrier ? <p>Carrier: {order.trackingCarrier}</p> : null}
                        {order.trackingNumber ? <p>Number: {order.trackingNumber}</p> : null}
                        {order.trackingStatus ? <p>Status: {order.trackingStatus}</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {order.couponCode ? (
                    <div className="rounded-[1.2rem] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        <Gift className="size-4 text-[var(--action)]" />
                        Coupon applied
                      </div>
                      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        {order.couponCode}
                        {order.couponDiscount ? ` saved ${formatCurrency(order.couponDiscount)}` : ""}
                      </p>
                    </div>
                  ) : null}

                </div>
              </div>
            </details>
          ))
        ) : (
            <div className="flex min-h-[12rem] items-center justify-center text-center text-[var(--muted-foreground)]">
              No orders for this filter.
            </div>
          )}
        </div>
      )}
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
                    lang === "en" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {t("english")}
                </button>
                <button
                  type="button"
                  onClick={() => store.setLanguage("km")}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    lang === "km" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-2 text-sm font-semibold"
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
              <div key={ticket.id} className="rounded-[1.4rem] border border-white/45 bg-white/55 p-4 backdrop-blur-xl">
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
  const product = store.getProduct(productId);

  if (!product) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted-foreground)]">Product not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/45 bg-white/60 shadow-[0_20px_45px_rgba(10,24,35,0.08)] backdrop-blur-xl">
        <div className="min-h-80 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.48)), url(${product.image})` }} />
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="app-chip px-3 py-1.5 text-sm" data-active="true">{product.category}</span>
            <span className="app-chip px-3 py-1.5 text-sm" data-active="true">
              {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
            </span>
            <span className="app-chip px-3 py-1.5 text-sm" data-active="true">
              {product.rating.toFixed(1)} * ({product.ratingCount})
            </span>
          </div>
          <button
            type="button"
            onClick={() => store.toggleFavorite(product.id)}
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
          {formatCurrency(product.price * (1 - product.discountPercent / 100))}
        </p>
        {product.discountPercent ? <p className="mt-1 text-sm font-semibold text-green-700">{product.discountPercent}% off</p> : null}

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
              {formatCurrency(product.price * (1 - product.discountPercent / 100))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {store.cartQuantityFor(product.id) ? (
              <span className="text-sm font-medium text-[var(--muted-foreground)]">{store.cartQuantityFor(product.id)} in cart</span>
            ) : null}
            <Button onClick={() => store.addToCart(product.id)} disabled={product.stock <= 0}>
              {product.stock > 0 ? "Add to cart" : "Out of stock"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

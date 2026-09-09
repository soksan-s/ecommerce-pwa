"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  Clock,
  Coffee,
  CreditCard,
  HeartHandshake,
  MapPin,
  PackageCheck,
  Phone,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Utensils,
  Zap,
} from "lucide-react";

import { ProductCard } from "@/components/client-pages";
import { useTranslation } from "@/lib/translations";

export function ClientHomePageView({ store, requireAuth, onNavigateToShop, onSelectCategory }) {
  const lang = store?.language || "en";
  const { t } = useTranslation(lang);

  // Derive dynamic category list from active products
  const categoryStats = useMemo(() => {
    const products = store?.activeProducts || [];
    const map = new Map();

    for (const p of products) {
      const cat = p.category?.trim();
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    }

    // Default fallback categories if empty
    if (map.size === 0) {
      return [
        { name: "Beverages", count: 0, icon: Coffee },
        { name: "Snacks", count: 0, icon: Utensils },
        { name: "Daily Goods", count: 0, icon: ShoppingBag },
      ];
    }

    return Array.from(map.entries()).map(([name, count]) => {
      let icon = ShoppingBag;
      const lower = name.toLowerCase();
      if (lower.includes("beverage") || lower.includes("drink") || lower.includes("beer") || lower.includes("water") || lower.includes("coffee")) {
        icon = Coffee;
      } else if (lower.includes("snack") || lower.includes("food") || lower.includes("candy") || lower.includes("noodle") || lower.includes("rice")) {
        icon = Utensils;
      }
      return { name, count, icon };
    });
  }, [store?.activeProducts]);

  // Featured / Popular products
  const featuredProducts = useMemo(() => {
    const products = [...(store?.activeProducts || [])];
    // Sort by rating or discount or take first 8
    products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return products.slice(0, 8);
  }, [store?.activeProducts]);

  return (
    <div className="mx-auto max-w-7xl space-y-12 sm:space-y-16 pb-12">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. HERO SECTION                                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-quiet),color-mix(in_srgb,var(--action)_10%,var(--surface)))] p-6 shadow-xl sm:p-10 lg:p-12">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-[var(--action)]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-72 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)]/80 px-3.5 py-1.5 text-xs font-bold text-[var(--foreground)] backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[var(--action)] font-black">
              {lang === "km" ? "ហាង ស៊ើម សាវេត" : "Soeum Savet Store"}
            </span>
            <span className="text-[var(--muted-foreground)]">•</span>
            <span>{t("hero_badge")}</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl leading-[1.15]">
            {t("hero_title")}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base leading-relaxed text-[var(--muted-foreground)] max-w-2xl">
            {t("hero_subtitle")}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={onNavigateToShop}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--action)] px-6 py-3.5 text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-98 cursor-pointer"
            >
              <span>{t("shop_now")}</span>
              <ArrowRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("categories-section");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                } else {
                  onNavigateToShop();
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)]/80 px-5 py-3.5 text-sm font-bold text-[var(--foreground)] backdrop-blur-md transition-all hover:bg-[var(--surface-quiet)] active:scale-98 cursor-pointer"
            >
              <span>{t("view_categories")}</span>
            </button>
          </div>

          {/* Quick Pillars */}
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4 border-t border-[var(--border-soft)]/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
              <MapPin className="size-4 text-[var(--action)] shrink-0" />
              <span>{t("store_location")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
              <Truck className="size-4 text-emerald-500 shrink-0" />
              <span>{t("benefit_delivery")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
              <QrCode className="size-4 text-rose-500 shrink-0" />
              <span>{t("benefit_payment")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
              <PackageCheck className="size-4 text-sky-500 shrink-0" />
              <span>{t("benefit_retail_wholesale")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. PRODUCT CATEGORIES DISCOVERY                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section id="categories-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {t("explore_categories")}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
              {t("explore_categories_sub")}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToShop}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--action)] hover:underline self-start sm:self-auto cursor-pointer"
          >
            <span>{t("view_all_products")}</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {/* 'All Products' card */}
          <div
            onClick={() => onSelectCategory("All")}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--action)] hover:shadow-md cursor-pointer"
            role="button"
            tabIndex={0}
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--action-surface)] text-[var(--action)] transition-transform group-hover:scale-105">
              <Store className="size-5" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--action)] transition-colors">
                {t("all_products")}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {t("showing_products").replace("{count}", store?.activeProducts?.length || 0)}
              </p>
            </div>
          </div>

          {/* Dynamic Category Cards */}
          {categoryStats.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--action)] hover:shadow-md cursor-pointer"
                role="button"
                tabIndex={0}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--surface-quiet)] text-[var(--foreground)] transition-transform group-hover:scale-105 group-hover:bg-[var(--action-surface)] group-hover:text-[var(--action)]">
                  <Icon className="size-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--action)] transition-colors truncate">
                    {cat.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {t("grocery_items").replace("{count}", cat.count)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. FEATURED / POPULAR PRODUCTS                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {featuredProducts.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--action)]" />
                <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                  {t("featured_products")}
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                {t("featured_products_sub")}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToShop}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[var(--action)] hover:underline cursor-pointer"
            >
              <span>{t("view_all_products")}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                store={store}
                requireAuth={requireAuth}
              />
            ))}
          </div>

          <div className="pt-2 text-center sm:hidden">
            <button
              type="button"
              onClick={onNavigateToShop}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] shadow-xs"
            >
              <span>{t("view_all_products")}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. WHY SHOP WITH US (STORE BENEFITS)                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
            {t("why_choose_us")}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            {t("why_choose_us_sub")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <PackageCheck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              {t("benefit_retail_wholesale")}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("benefit_retail_wholesale_desc")}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Truck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              {t("benefit_delivery")}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("benefit_delivery_desc")}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <QrCode className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              {t("benefit_payment")}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("benefit_payment_desc")}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-sm space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <Zap className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              {t("benefit_online_order")}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("benefit_online_order_desc")}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. ABOUT OUR STORE                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/60 p-6 sm:p-8 lg:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--action-surface)] px-3 py-1 text-xs font-bold text-[var(--action)]">
            <HeartHandshake className="size-3.5" />
            <span>{t("about_store_badge")}</span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
            {t("about_store")}
          </h2>

          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t("about_store_p1")}
          </p>

          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t("about_store_p2")}
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. STORE INFORMATION & CONTACT                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl mb-6">
          {t("store_info_title")}
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--action-surface)] text-[var(--action)] shrink-0">
              <MapPin className="size-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("store_address")}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {t("store_address_val")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("store_hours")}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {t("store_hours_val")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("payment_methods_accepted")}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                Bakong KHQR • Cash on Delivery
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

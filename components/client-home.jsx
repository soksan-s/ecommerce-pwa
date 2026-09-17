"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  Clock,
  CreditCard,
  HeartHandshake,
  MapPin,
  PackageCheck,
  Phone,
  QrCode,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";

import { ProductCard } from "@/components/client-pages";
import { useTranslation } from "@/lib/translations";

export function ClientHomePageView({ store, requireAuth, onNavigateToShop }) {
  const lang = store?.language || "en";
  const { t } = useTranslation(lang);

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
      {/* 2. FEATURED / POPULAR PRODUCTS                                      */}
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

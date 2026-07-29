"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe,
  Heart,
  Menu,
  ReceiptText,
  ShoppingCart,
  Store,
  User,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { ClientCartPageView, ClientFavoritesPageView, ClientOrderDetailPageView, ClientOrderHistoryPageView, ClientProductListPageView, ClientProfilePageView } from "@/components/client-pages";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/translations";

const clientTabs = [
  { key: "shop", label: "Shop", icon: Store },
  { key: "favorites", label: "Favorites", icon: Heart },
  { key: "cart", label: "Cart", icon: ShoppingCart },
  { key: "orders", label: "Orders", icon: ReceiptText },
  { key: "profile", label: "Profile", icon: User },
];

function resolveClientTab(value) {
  return clientTabs.some((tab) => tab.key === value) ? value : "shop";
}

function clientTabHref(tab) {
  return tab === "shop" ? "/client" : `/client?tab=${tab}`;
}

function DrawerButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "app-nav-button flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold",
        active && "bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] text-[var(--foreground)]",
      )}
      data-active={active}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

export function ClientShell({ user, initialTab = "shop", orderDetailId = "" }) {
  const store = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(() => resolveClientTab(searchParams.get("tab") || initialTab));

  const lang = store.language || "en";
  const { t } = useTranslation(lang);
  const activeTab = orderDetailId ? "orders" : selectedTab;

  useEffect(() => {
    if (orderDetailId) {
      return undefined;
    }

    function syncTabFromUrl() {
      const params = new URLSearchParams(window.location.search);
      setSelectedTab(resolveClientTab(params.get("tab") || initialTab));
    }

    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, [initialTab, orderDetailId]);

  const title = useMemo(() => {
    switch (activeTab) {
      case "favorites":
        return t("favorites");
      case "cart":
        return t("cart");
      case "orders":
        return t("orders");
      case "profile":
        return t("profile");
      default:
        return t("shop");
    }
  }, [activeTab, t]);

  function openTab(tab) {
    const nextTab = resolveClientTab(tab);
    setSelectedTab(nextTab);
    setDrawerOpen(false);
    router.push(clientTabHref(nextTab));
  }

  function renderContent() {
    if (orderDetailId) {
      return <ClientOrderDetailPageView orderId={orderDetailId} />;
    }

    switch (selectedTab) {
      case "favorites":
        return <ClientFavoritesPageView />;
      case "cart":
        return <ClientCartPageView />;
      case "orders":
        return <ClientOrderHistoryPageView />;
      case "profile":
        return <ClientProfilePageView user={user} />;
      default:
        return <ClientProductListPageView />;
    }
  }

  return (
    <main className="app-shell">
      <header className="app-bar px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="app-icon-button p-2"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => store.setLanguage(lang === "en" ? "km" : "en")}
              className="app-icon-button flex items-center gap-1.5 px-3 py-2 text-xs font-black text-[var(--foreground)]"
              aria-label={t("change_language")}
              title={t("change_language")}
            >
              <Globe className="size-3.5" />
              <span>{lang === "en" ? "EN" : "ខ្មែរ"}</span>
            </button>
            <ThemeToggle />
            {activeTab !== "cart" ? (
              <button
                type="button"
                onClick={() => openTab("cart")}
                className="app-icon-button relative p-2.5"
                aria-label="Open cart"
                title="Open cart"
              >
                <ShoppingCart className="size-4" />
                {store.cartCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--action)] px-1 text-[10px] font-bold text-[var(--action-foreground)]">
                    {store.cartCount}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: easeInOutCubic }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              className="h-full w-[18rem] bg-[var(--background-start)] p-4 shadow-[var(--shadow-strong)]"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.36, ease: easeInOutCubic }}
              onClick={(event) => event.stopPropagation()}
            >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Client</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="app-icon-button p-2"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {clientTabs.map((tab) => (
                <DrawerButton key={tab.key} active={activeTab === tab.key} icon={tab.icon} label={t(tab.key)} onClick={() => openTab(tab.key)} />
              ))}
            </div>
            <LogoutButton className="mt-5 w-full" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pt-6 pb-24 min-[600px]:pb-28">{renderContent()}</div>

      <nav className="app-nav-surface hidden fixed bottom-4 left-4 right-4 z-30 items-center justify-between p-2">
        {clientTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => openTab(tab.key)}
            className={cn(
              "app-nav-button flex min-w-0 flex-1 flex-col items-center gap-1 px-3 py-3 text-xs font-semibold",
              activeTab === tab.key && "bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] text-[var(--foreground)]",
            )}
            data-active={activeTab === tab.key}
          >
            <tab.icon className="size-4" />
            {t(tab.key)}
          </button>
        ))}
      </nav>
    </main>
  );
}

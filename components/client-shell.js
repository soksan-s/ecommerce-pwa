"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Heart,
  Home,
  LogIn,
  LogOut,
  Menu,
  Mic,
  ReceiptText,
  Search,
  ShoppingCart,
  Store,
  User,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { AuthModal } from "@/components/auth-modal";
import {
  ClientCartPageView,
  ClientFavoritesPageView,
  ClientOrderDetailPageView,
  ClientOrderHistoryPageView,
  ClientProductListPageView,
  ClientProfilePageView,
} from "@/components/client-pages";
import { ClientHomePageView } from "@/components/client-home";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/translations";

// Tabs that require a logged-in session
const PROTECTED_TABS = new Set(["favorites", "cart", "orders", "profile"]);

const clientTabs = [
  { key: "home", label: "Home", icon: Home },
  { key: "shop", label: "Shop", icon: Store },
  { key: "favorites", label: "Favorites", icon: Heart },
  { key: "cart", label: "Cart", icon: ShoppingCart },
  { key: "orders", label: "Orders", icon: ReceiptText },
  { key: "profile", label: "Profile", icon: User },
];

function resolveClientTab(value) {
  return clientTabs.some((tab) => tab.key === value) ? value : "home";
}

function clientTabHref(tab) {
  return tab === "home" ? "/client" : `/client?tab=${tab}`;
}

function DrawerButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "app-nav-button flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold rounded-xl transition-all",
        active
          ? "bg-[var(--action)] text-[var(--action-foreground)] font-bold shadow-sm"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
      )}
      data-active={active}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  );
}

export function ClientShell({ user, initialTab = "home", orderDetailId = "" }) {
  const store = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(() => resolveClientTab(searchParams.get("tab") || initialTab));
  const [authModal, setAuthModal] = useState({ isOpen: false, hint: "" });

  const langDropdownRef = useRef(null);

  const lang = store.language || "en";
  const { t } = useTranslation(lang);
  const activeTab = orderDetailId ? "orders" : selectedTab;

  // Close language dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  /** Opens the auth modal for guests; returns false so callers can bail early. */
  const requireAuth = useCallback(
    function (hint) {
      if (!user) {
        setAuthModal({ isOpen: true, hint: hint || "" });
        return false;
      }
      return true;
    },
    [user]
  );

  function openTab(tab) {
    if (PROTECTED_TABS.has(tab) && !user) {
      requireAuth("Sign in to access this section");
      return;
    }
    const nextTab = resolveClientTab(tab);
    setSelectedTab(nextTab);
    setDrawerOpen(false);
    router.push(clientTabHref(nextTab));
  }

  function handleLogoClick() {
    setSelectedCategory("All");
    setQuery("");
    openTab("home");
  }

  function renderContent() {
    if (orderDetailId) {
      return <ClientOrderDetailPageView orderId={orderDetailId} />;
    }

    switch (activeTab) {
      case "home":
        return (
          <ClientHomePageView
            store={store}
            requireAuth={requireAuth}
            onNavigateToShop={() => openTab("shop")}
          />
        );
      case "favorites":
        return <ClientFavoritesPageView />;
      case "cart":
        return <ClientCartPageView />;
      case "orders":
        return <ClientOrderHistoryPageView />;
      case "profile":
        return <ClientProfilePageView user={user} />;
      default:
        return (
          <ClientProductListPageView
            requireAuth={requireAuth}
            query={query}
            onQueryChange={setQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        );
    }
  }

  const storeName = store.settings?.storeInfo?.storeName || "Soeum Savet Store";
  const storeTagline = lang === "km" ? "ហាង ស៊ើម សាវេត" : "Wholesale & Retail · Siem Reap";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans transition-colors duration-200">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TIER 1: Top Announcement Bar                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--surface-quiet)] border-b border-[var(--border-soft)] text-[var(--foreground)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 sm:h-10 flex items-center justify-between gap-4 text-[11px] sm:text-xs font-semibold">
          {/* Local delivery notice */}
          <div className="flex items-center gap-1.5 overflow-hidden truncate">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate text-[var(--muted-foreground)]">
              {lang === "km"
                ? "ដឹកជញ្ជូនក្នុងស្រុក • ខេត្តសៀមរាប • ទូទាត់ KHQR & ជាសាច់ប្រាក់"
                : "Local Delivery in Siem Reap • KHQR & Cash on Delivery • Retail & Wholesale"}
            </span>
          </div>

          {/* Right controls: Language + Theme Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1 text-[var(--foreground)] hover:text-[var(--action)] transition-colors focus:outline-none"
                aria-label="Select Language"
              >
                <span>{lang === "en" ? "English" : "ភាសាខ្មែរ"}</span>
                <ChevronDown className="size-3 text-[var(--muted-foreground)]" />
              </button>

              <AnimatePresence>
                {langDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-32 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        store.setLanguage("en");
                        setLangDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors",
                        lang === "en"
                          ? "bg-[var(--action-surface)] font-bold text-[var(--action)]"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                      )}
                    >
                      <span>English</span>
                      {lang === "en" && <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        store.setLanguage("km");
                        setLangDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors",
                        lang === "km"
                          ? "bg-[var(--action-surface)] font-bold text-[var(--action)]"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                      )}
                    >
                      <span>ភាសាខ្មែរ</span>
                      {lang === "km" && <Check className="size-3.5" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-3.5 w-[1px] bg-[var(--border-strong)]" />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TIER 2: Main Brand Header & Search Row                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <header className="w-full bg-[var(--surface-strong)] border-b border-[var(--border-soft)] py-3 sm:py-4 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Top Row on mobile: Brand + Mobile Menu & Quick Icons */}
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Brand Logo & Name */}
            <div
              onClick={handleLogoClick}
              className="cursor-pointer flex items-center gap-3 select-none group"
              role="button"
              tabIndex={0}
              aria-label="Go to home"
            >
              {/* Store Emblem */}
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--action)] text-[var(--action-foreground)] shadow-lg group-hover:scale-105 transition-transform relative overflow-hidden">
                <span className="text-lg font-black leading-none">S</span>
                <span className="absolute bottom-1 right-1.5 text-[8px] font-black opacity-70">ស</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--action)]">
                  {lang === "km" ? "ហាង លក់ដូរ" : "Wholesale & Retail"}
                </span>
                <span className="font-display text-lg sm:text-xl font-black tracking-tight text-[var(--foreground)] leading-none my-0.5">
                  {storeName}
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  {storeTagline}
                </span>
              </div>
            </div>

            {/* Mobile Actions: Cart + Hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={() => openTab("cart")}
                className="relative p-2 text-[var(--foreground)] hover:text-[var(--action)] transition-colors"
                aria-label="Open cart"
              >
                <ShoppingCart className="size-6" />
                {store.cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--action)] px-1 text-[9px] font-black text-[var(--action-foreground)]">
                    {store.cartCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 text-[var(--foreground)] hover:text-[var(--action)] transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="size-6" />
              </button>
            </div>
          </div>

          {/* Center: Search Box */}
          <div className={cn("flex-1 max-w-2xl w-full mx-auto md:mx-6", activeTab !== "home" && activeTab !== "shop" && "hidden md:flex")}>
            <div className="flex items-center w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-quiet)]/40 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/15 focus-within:bg-[var(--surface-strong)] transition-all relative">
              {/* Search Input Field */}
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (activeTab !== "shop") {
                    setSelectedTab("shop");
                    router.push(clientTabHref("shop"));
                  }
                }}
                placeholder={lang === "km" ? "ស្វែងរកផលិតផល..." : "Search products, beverages, snacks..."}
                className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none min-w-0"
                aria-label="Search catalog"
              />

              {/* Clear Query button */}
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Clear search query"
                >
                  <X className="size-4" />
                </button>
              ) : null}

              {/* Search Icons */}
              <div className="flex items-center pr-3 gap-1 text-[var(--muted-foreground)]">
                <button
                  type="button"
                  className="p-1 hover:text-[var(--action)] transition-colors"
                  aria-label="Voice search"
                  title="Voice search"
                >

                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab !== "shop") {
                      setSelectedTab("shop");
                      router.push(clientTabHref("shop"));
                    }
                  }}
                  className="p-1 hover:text-[var(--action)] transition-colors"
                  aria-label="Submit search"
                >
                  <Search className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Desktop Actions: User Account & Cart */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            {/* Favorites shortcut */}
            <button
              type="button"
              onClick={() => openTab("favorites")}
              className={cn(
                "p-2 text-[var(--muted-foreground)] hover:text-[var(--action)] transition-colors rounded-xl hover:bg-[var(--surface-quiet)]",
                activeTab === "favorites" && "text-[var(--action)]"
              )}
              aria-label="View favorites"
              title="Favorites"
            >
              <Heart className="size-5" />
            </button>

            {/* Profile / Sign In button */}
            {!user ? (
              <button
                type="button"
                onClick={() => setAuthModal({ isOpen: true, hint: "" })}
                className="flex items-center gap-2 p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors rounded-xl hover:bg-[var(--surface-quiet)]"
                aria-label="Sign in"
                title="Sign in / Register"
              >
                <User className="size-5" />
                <span className="text-xs font-bold text-[var(--action)]">Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openTab("profile")}
                className={cn(
                  "flex items-center gap-2 p-1.5 text-[var(--foreground)] hover:text-[var(--action)] transition-colors rounded-xl hover:bg-[var(--surface-quiet)]",
                  activeTab === "profile" && "text-[var(--action)]"
                )}
                aria-label="Open profile"
                title={user.name || user.email || "Account"}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--action-surface)] text-xs font-black text-[var(--action)] ring-1 ring-[color-mix(in_srgb,var(--action)_30%,transparent)]">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
              </button>
            )}

            {/* Shopping Cart button with Badge */}
            <button
              type="button"
              onClick={() => openTab("cart")}
              className={cn(
                "relative flex items-center justify-center p-2.5 rounded-xl border border-[var(--border-strong)] text-[var(--foreground)] hover:border-[var(--action)] hover:text-[var(--action)] transition-colors",
                activeTab === "cart" && "border-[var(--action)] text-[var(--action)] bg-[var(--action-surface)]"
              )}
              aria-label="Open cart"
              title="Shopping Cart"
            >
              <ShoppingCart className="size-5" />
              {store.cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--action)] px-1.5 text-[10px] font-black text-[var(--action-foreground)] shadow-md">
                  {store.cartCount > 99 ? "99+" : store.cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TIER 3: Main Tab Navigation Bar                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <nav className="w-full bg-[var(--surface-strong)]/95 backdrop-blur-md border-b border-[var(--border-soft)] px-4 sm:px-6 lg:px-8 sticky top-0 z-30 transition-colors hidden md:block">
        <div className="no-scrollbar max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-0.5">
          {clientTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => openTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-2 py-3 px-4 text-[11px] sm:text-xs font-bold tracking-wide whitespace-nowrap transition-colors rounded-lg",
                  isActive
                    ? "text-[var(--foreground)] font-extrabold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)]/50"
                )}
              >
                <Icon className="size-3.5" />
                <span>{t(tab.key)}</span>
                {tab.key === "cart" && store.cartCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--action)] px-1 text-[9px] font-black text-[var(--action-foreground)]">
                    {store.cartCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--action)] rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Main Page Content Body                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + "-" + selectedCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: easeInOutCubic }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Mobile Navigation Drawer                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--surface-strong)] border-r border-[var(--border-soft)] p-5 shadow-2xl md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: easeInOutCubic }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-soft)]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--action)]">
                    {user ? "Authenticated" : "Welcome"}
                  </p>
                  <p className="text-sm font-bold text-[var(--foreground)] truncate max-w-[180px]">
                    {user ? user.email : "Browsing as guest"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <div className="py-4 space-y-1.5 flex-1 overflow-y-auto">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Navigation
                </p>
                {clientTabs.map((tab) => (
                  <DrawerButton
                    key={tab.key}
                    active={activeTab === tab.key}
                    icon={tab.icon}
                    label={t(tab.key)}
                    onClick={() => openTab(tab.key)}
                  />
                ))}
              </div>

              {/* Drawer Footer / Auth Action */}
              <div className="pt-4 border-t border-[var(--border-soft)]">
                {user ? (
                  <LogoutButton className="w-full justify-center" />
                ) : (
                  <Button
                    className="w-full rounded-xl bg-[var(--action)] text-[var(--action-foreground)] font-bold shadow-md"
                    onClick={() => {
                      setDrawerOpen(false);
                      setAuthModal({ isOpen: true, hint: "" });
                    }}
                  >
                    <LogIn className="mr-2 size-4" />
                    Sign In / Register
                  </Button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Mobile Floating Bottom Bar for PWA Touch Navigation                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-3 left-4 right-4 z-40 rounded-2xl bg-[var(--surface-strong)]/90 backdrop-blur-xl border border-[var(--border-soft)] shadow-2xl p-1.5 flex items-center justify-around">
        {clientTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => openTab(tab.key)}
              className={cn(
                "relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all",
                isActive
                  ? "text-[var(--action)] font-extrabold"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <tab.icon className="size-4 mb-0.5" />
              <span>{t(tab.key)}</span>
              {tab.key === "cart" && store.cartCount > 0 && (
                <span className="absolute top-0 right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--action)] px-1 text-[8px] font-black text-[var(--action-foreground)]">
                  {store.cartCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={() => setAuthModal({ isOpen: false, hint: "" })}
        hint={authModal.hint}
      />
    </div>
  );
}

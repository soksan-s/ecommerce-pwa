"use client";

import { BarChart3, Home, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ReceiptText, RefreshCw, Settings, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { authClient } from "@/lib/auth-client";
import { getAll } from "@/lib/db";
import { replayQueue } from "@/lib/sync";
import { useTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/store/posStore";

const navItems = [
  { label: "Dashboard", href: "/pos", icon: Home },
  { label: "New Sale", href: "/pos/new-sale", icon: ShoppingCart },
  { label: "Products", href: "/pos/products", icon: Package },
  { label: "Orders", href: "/pos/orders", icon: ReceiptText },
  { label: "Reports", href: "/pos/reports", icon: BarChart3 },
  { label: "Settings", href: "/pos/settings", icon: Settings },
];

export function PosLayoutShell({ children }) {
  const pathname = usePathname();
  const { isOnline, isOffline, isChecking } = useOffline();
  const { settings } = usePOSSettings();

  const settingLanguage =
    settings?.appearance?.defaultLanguage ||
    settings?.appearance?.language ||
    "en";

  const [lang, setLang] = useState("en");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { t } = useTranslation(lang);

  const pendingSyncCount = usePosStore((state) => state.pendingSyncCount);
  const setPendingSyncCount = usePosStore((state) => state.setPendingSyncCount);
  const addLocalNotification = usePosStore(
    (state) => state.addLocalNotification
  );
  const localNotifications = usePosStore(
    (state) => state.localNotifications
  );
  const dismissLocalNotification = usePosStore(
    (state) => state.dismissLocalNotification
  );

  useEffect(() => {
    let active = true;

    async function checkPendingQueue() {
      const queue = await getAll("offline_queue");

      if (active) {
        setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);
      }
    }

    checkPendingQueue();

    if (isOnline) {
      handleAutoSync();
    }

    return () => {
      active = false;
    };
  }, [isOnline, setPendingSyncCount]);

  useEffect(() => {
    const savedLanguage =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pos-language")
        : null;

    if (savedLanguage === "en" || savedLanguage === "km") {
      setLang(savedLanguage);
    } else if (settingLanguage === "km" || settingLanguage === "en") {
      setLang(settingLanguage);
    }
  }, [settingLanguage]);

  useEffect(() => {
    const layout = settings?.appearance?.posLayout || "comfortable";

    document.documentElement.dataset.posLayout = layout;
    document.body.dataset.posLayout = layout;
  }, [settings?.appearance?.posLayout]);

  useEffect(() => {
    if (typeof document !== "undefined" && lang) {
      document.documentElement.lang = lang;
      document.documentElement.setAttribute("data-lang", lang);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("pos-language", lang);
    }
  }, [lang]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  async function handleAutoSync() {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const results = await replayQueue();
      const queue = await getAll("offline_queue");

      setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);

      if (Array.isArray(results)) {
        for (const result of results) {
          const receipt = result.receiptNumber || result.id || "";

          if (result.ok) {
            addLocalNotification({
              type: "success",
              title:
                lang === "km"
                  ? "បានធ្វើសមកាលកម្មការលក់"
                  : "Sale Synced",
              message: receipt
                ? lang === "km"
                  ? `ការលក់ក្រៅបណ្តាញ #${receipt} បានធ្វើសមកាលកម្មដោយជោគជ័យ។`
                  : `Offline sale #${receipt} synchronized successfully.`
                : lang === "km"
                  ? "ការលក់ក្រៅបណ្តាញបានធ្វើសមកាលកម្មដោយជោគជ័យ។"
                  : "Offline sale synchronized successfully.",
              receiptNumber: receipt || null,
            });
          } else {
            addLocalNotification({
              type: "error",
              title:
                lang === "km"
                  ? "សមកាលកម្មបរាជ័យ"
                  : "Sync Failed",
              message: receipt
                ? lang === "km"
                  ? `ការធ្វើសមកាលកម្មការលក់ #${receipt} បានបរាជ័យ។`
                  : `Failed to sync sale #${receipt}.`
                : lang === "km"
                  ? `ការធ្វើសមកាលកម្មការលក់ក្រៅបណ្តាញបានបរាជ័យ (HTTP ${result.status || "error"
                  })។`
                  : `Failed to sync offline sale (HTTP ${result.status || "error"
                  }).`,
              receiptNumber: receipt || null,
            });
          }
        }
      }
    } catch {
      // Offline sync failure.
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleManualSync() {
    if (isSyncing || isOffline) return;

    await handleAutoSync();
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      await authClient.signOut().catch(() => { });
    } catch { }

    window.location.href = "/login";
  }

  function switchLanguage(nextLanguage) {
    if (nextLanguage !== "en" && nextLanguage !== "km") return;

    setLang(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("pos-language", nextLanguage);
    }
  }

  function getNavLabel(item) {
    const key = item.label.toLowerCase().replace(/\s+/g, "_");
    const translated = t(key);

    return translated && translated !== key
      ? translated
      : item.label;
  }

  function isNavItemActive(item) {
    if (pathname === item.href) return true;

    if (item.href === "/pos") return false;

    return pathname.startsWith(`${item.href}/`);
  }

  function getCurrentPageLabel() {
    const activeItem = navItems.find((item) =>
      isNavItemActive(item)
    );

    return activeItem
      ? getNavLabel(activeItem)
      : t("pos") || "POS";
  }

  function renderStatusBadge() {
    if (isChecking) {
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-[var(--muted-foreground)]">
          <span className="size-2 rounded-full bg-[var(--muted-foreground)]/50 animate-pulse" />
          {lang === "km" ? "កំពុងពិនិត្យ" : "Checking"}
        </span>
      );
    }

    if (isSyncing) {
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-amber-600 dark:text-amber-400">
          <RefreshCw className="size-3.5 animate-spin" />
          {lang === "km" ? "កំពុងធ្វើសមកាលកម្ម" : "Syncing"}
        </span>
      );
    }

    if (isOffline) {
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-red-600 dark:text-red-400">
          <span className="size-2 rounded-full bg-red-500 animate-pulse" />
          {lang === "km" ? "ក្រៅបណ្តាញ" : "Offline"}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="size-2 rounded-full bg-emerald-500" />
        {lang === "km" ? "លើបណ្តាញ" : "Online"}
      </span>
    );
  }

  function renderNavLink(
    item,
    compact = false,
    onNavigate
  ) {
    const active = isNavItemActive(item);
    const Icon = item.icon;
    const label = getNavLabel(item);

    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? label : undefined}
        onClick={onNavigate}
        className={cn(
          "group relative flex w-full items-center transition-colors duration-150",
          compact
            ? "justify-center px-0 py-2.5"
            : "gap-3 px-3 py-2.5",
          active
            ? "bg-[var(--action)] text-[var(--action-foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
        )}
      >
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            active
              ? "text-[var(--action-foreground)]"
              : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
          )}
          aria-hidden="true"
        />

        {!compact ? (
          <span className="min-w-0 flex-1 truncate font-medium">
            {label}
          </span>
        ) : null}

        {!compact &&
          item.label === "Orders" &&
          pendingSyncCount > 0 ? (
          <span
            className={cn(
              "min-w-5 px-1.5 py-0.5 text-center text-[11px] font-bold",
              active
                ? "bg-white/20 text-white"
                : "bg-amber-400 text-amber-950"
            )}
          >
            {pendingSyncCount}
          </span>
        ) : null}

        {compact &&
          item.label === "Orders" &&
          pendingSyncCount > 0 ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-400" />
        ) : null}
      </Link>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--border-soft)] bg-[var(--surface-strong)] md:flex md:flex-col",
          sidebarCollapsed ? "w-[72px]" : "w-[248px]"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--border-soft)] px-3">
          <div
            className={cn(
              "flex min-w-0 items-center",
              sidebarCollapsed
                ? "w-full justify-center"
                : "gap-3"
            )}
          >
            <div className="grid size-9 shrink-0 place-items-center bg-[var(--action)] text-[var(--action-foreground)]">
              <ShoppingCart className="size-[18px]" />
            </div>

            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-5 text-[var(--foreground)]">
                  {settings?.storeInfo?.storeName ||
                    "POS Terminal"}
                </h1>

                <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                  {t("pos") || "POS"} Terminal
                </p>
              </div>
            ) : null}
          </div>

          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="ml-auto grid size-8 shrink-0 place-items-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Expand Button */}
        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="mx-auto mt-3 grid size-9 place-items-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : null}

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
          {!sidebarCollapsed ? (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {lang === "km" ? "ម៉ឺនុយ" : "Menu"}
            </p>
          ) : null}

          <div className="space-y-1">
            {navItems.map((item) =>
              renderNavLink(item, sidebarCollapsed)
            )}
          </div>
        </nav>

        {/* Sidebar Bottom */}
        <div className="shrink-0 border-t border-[var(--border-soft)] p-3">
          {/* Manual Sync */}
          <button
            type="button"
            onClick={() => handleManualSync()}
            disabled={
              isSyncing ||
              isOffline ||
              pendingSyncCount === 0
            }
            className={cn(
              "mb-2 flex w-full items-center text-xs font-semibold transition-colors",
              sidebarCollapsed
                ? "justify-center py-2.5"
                : "gap-2 px-2 py-2",
              pendingSyncCount > 0 && !isOffline
                ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                : "text-[var(--muted-foreground)]",
              "disabled:cursor-default disabled:opacity-60"
            )}
            title={
              pendingSyncCount > 0
                ? lang === "km"
                  ? "ធ្វើសមកាលកម្មឥឡូវ"
                  : "Sync now"
                : lang === "km"
                  ? "គ្មានទិន្នន័យរង់ចាំ"
                  : "Nothing to sync"
            }
          >
            <RefreshCw
              className={cn(
                "size-4 shrink-0",
                isSyncing && "animate-spin"
              )}
            />

            {!sidebarCollapsed ? (
              <>
                <span className="flex-1 text-left">
                  {pendingSyncCount > 0
                    ? lang === "km"
                      ? "រង់ចាំសមកាលកម្ម"
                      : "Pending sync"
                    : lang === "km"
                      ? "មិនមានរង់ចាំ"
                      : "All synced"}
                </span>

                {pendingSyncCount > 0 ? (
                  <span className="font-bold">
                    {pendingSyncCount}
                  </span>
                ) : null}
              </>
            ) : null}
          </button>

          {/* Connection Status */}
          <div
            className={cn(
              "mb-2 flex items-center text-xs",
              sidebarCollapsed
                ? "justify-center"
                : "px-2 py-1"
            )}
            title={
              lang === "km"
                ? "ស្ថានភាពប្រព័ន្ធ"
                : "System status"
            }
          >
            {renderStatusBadge()}
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title={
              lang === "km"
                ? "ចាកចេញ"
                : "Log out"
            }
            className={cn(
              "flex w-full items-center text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30",
              sidebarCollapsed
                ? "justify-center py-2.5"
                : "gap-2.5 px-2 py-2.5"
            )}
          >
            <LogOut className="size-4 shrink-0" />

            {!sidebarCollapsed ? (
              <span>
                {t("logout") ||
                  (lang === "km"
                    ? "ចាកចេញ"
                    : "Log Out")}
              </span>
            ) : null}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[var(--border-soft)] bg-[var(--surface-strong)]/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="grid size-9 shrink-0 place-items-center text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
          aria-label="Open sidebar"
        >
          <Menu className="size-5" />
        </button>

        <div className="ml-2 min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {getCurrentPageLabel()}
          </p>

          <p className="truncate text-[11px] text-[var(--muted-foreground)]">
            {settings?.storeInfo?.storeName ||
              "POS Terminal"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Mobile Language Switcher */}
          <div className="inline-flex items-center border border-[var(--border-soft)] p-0.5">
            <button
              type="button"
              onClick={() => switchLanguage("en")}
              aria-pressed={lang === "en"}
              className={cn(
                "min-w-9 px-2 py-1.5 text-[11px] font-bold transition-colors",
                lang === "en"
                  ? "bg-[var(--action)] text-[var(--action-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
              )}
            >
              EN
            </button>

            <button
              type="button"
              onClick={() => switchLanguage("km")}
              aria-pressed={lang === "km"}
              className={cn(
                "min-w-9 px-2 py-1.5 text-[11px] font-bold transition-colors",
                lang === "km"
                  ? "bg-[var(--action)] text-[var(--action-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
              )}
            >
              KM
            </button>
          </div>

          {/* Notifications */}
          <NotificationsDropdown
            lang={lang}
            localNotifs={localNotifications}
            onDismiss={dismissLocalNotification}
            orderHref={() => "/pos/orders"}
          />

          {/* Theme */}
          <ThemeToggle />

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title={
              lang === "km"
                ? "ចាកចេញ"
                : "Log out"
            }
            aria-label={
              lang === "km"
                ? "ចាកចេញ"
                : "Log out"
            }
            className="grid size-9 place-items-center text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="flex h-full w-72 max-w-[84vw] flex-col bg-[var(--surface-strong)] shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Mobile Sidebar Header */}
            <div className="flex h-16 shrink-0 items-center border-b border-[var(--border-soft)] px-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center bg-[var(--action)] text-[var(--action-foreground)]">
                  <ShoppingCart className="size-[18px]" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--foreground)]">
                    {settings?.storeInfo?.storeName ||
                      "POS Terminal"}
                  </p>

                  <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {t("pos") || "POS"} Terminal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobileSidebarOpen(false)
                }
                className="grid size-9 place-items-center text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                aria-label="Close sidebar"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <div className="flex-1 overflow-y-auto px-2 py-4">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {lang === "km" ? "ម៉ឺនុយ" : "Menu"}
              </p>

              <nav className="space-y-1">
                {navItems.map((item) =>
                  renderNavLink(
                    item,
                    false,
                    () =>
                      setMobileSidebarOpen(false)
                  )
                )}
              </nav>
            </div>

            {/* Mobile Sidebar Bottom */}
            <div className="shrink-0 border-t border-[var(--border-soft)] p-3">
              {/* Mobile Sync */}
              <button
                type="button"
                onClick={() => handleManualSync()}
                disabled={
                  isSyncing ||
                  isOffline ||
                  pendingSyncCount === 0
                }
                className={cn(
                  "mb-2 flex w-full items-center gap-2 px-2 py-2 text-xs font-semibold transition-colors",
                  pendingSyncCount > 0 && !isOffline
                    ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                    : "text-[var(--muted-foreground)]",
                  "disabled:cursor-default disabled:opacity-60"
                )}
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    isSyncing && "animate-spin"
                  )}
                />

                <span className="flex-1 text-left">
                  {pendingSyncCount > 0
                    ? lang === "km"
                      ? "ធ្វើសមកាលកម្ម"
                      : "Sync pending"
                    : lang === "km"
                      ? "បានសមកាលកម្ម"
                      : "All synced"}
                </span>

                {pendingSyncCount > 0 ? (
                  <span className="font-bold">
                    {pendingSyncCount}
                  </span>
                ) : null}
              </button>

              {/* Mobile Status */}
              <div className="px-2 py-1 text-xs">
                {renderStatusBadge()}
              </div>

              {/* Mobile Logout */}
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  handleLogout();
                }}
                className="mt-2 flex w-full items-center gap-2.5 px-2 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="size-4 shrink-0" />

                {t("logout") ||
                  (lang === "km"
                    ? "ចាកចេញ"
                    : "Log Out")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main Layout */}
      <div
        className={cn(
          "transition-[padding] duration-200",
          sidebarCollapsed
            ? "md:pl-[72px]"
            : "md:pl-[248px]"
        )}
      >
        {/* Desktop Top Header */}
        <header className="sticky top-0 z-30 hidden h-16 border-b border-[var(--border-soft)] bg-[var(--surface-strong)]/95 px-4 backdrop-blur md:flex md:items-center md:justify-between lg:px-6">
          {/* Current Page */}
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--foreground)]">
              {getCurrentPageLabel()}
            </h2>

            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {settings?.storeInfo?.storeName ||
                "POS Terminal"}
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Sync */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={
                isSyncing ||
                isOffline ||
                pendingSyncCount === 0
              }
              className={cn(
                "inline-flex h-9 items-center gap-2 px-2.5 text-xs font-semibold transition-colors",
                pendingSyncCount > 0 && !isOffline
                  ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  : "text-[var(--muted-foreground)]",
                "disabled:cursor-default disabled:opacity-70"
              )}
              title={
                lang === "km"
                  ? "ធ្វើសមកាលកម្ម"
                  : "Sync now"
              }
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  isSyncing && "animate-spin"
                )}
              />

              {pendingSyncCount > 0 ? (
                <span>{pendingSyncCount}</span>
              ) : null}
            </button>

            {/* Status */}
            <div className="px-2">
              {renderStatusBadge()}
            </div>

            {/* Language Switcher */}
            <div className="inline-flex items-center border border-[var(--border-soft)] p-0.5">
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                aria-pressed={lang === "en"}
                className={cn(
                  "min-w-10 px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                  lang === "en"
                    ? "bg-[var(--action)] text-[var(--action-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
                )}
              >
                EN
              </button>

              <button
                type="button"
                onClick={() => switchLanguage("km")}
                aria-pressed={lang === "km"}
                className={cn(
                  "min-w-10 px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                  lang === "km"
                    ? "bg-[var(--action)] text-[var(--action-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
                )}
              >
                KM
              </button>
            </div>

            {/* Notifications */}
            <NotificationsDropdown
              lang={lang}
              localNotifs={localNotifications}
              onDismiss={dismissLocalNotification}
              orderHref={() => "/pos/orders"}
            />

            {/* Theme */}
            <ThemeToggle />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title={
                lang === "km"
                  ? "ចាកចេញ"
                  : "Log out"
              }
              aria-label={
                lang === "km"
                  ? "ចាកចេញ"
                  : "Log out"
              }
              className="grid size-9 place-items-center text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main>
          <div className="mx-auto w-full max-w-[1440px] px-4 py-4 md:px-6 md:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

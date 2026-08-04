"use client";

import { BarChart3, Home, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ReceiptText, RefreshCw, Settings, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { authClient } from "@/lib/auth-client";
import { getAll } from "@/lib/db";
import { replayQueue } from "@/lib/sync";
import { useTranslation } from "@/lib/translations";
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
  const router = useRouter();
  const { isOnline, isOffline } = useOffline();
  const pendingSyncCount = usePosStore((state) => state.pendingSyncCount);
  const setPendingSyncCount = usePosStore((state) => state.setPendingSyncCount);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
  }, [isOnline, setPendingSyncCount]);

  const incrementCatalogVersion = usePosStore((state) => state.incrementCatalogVersion);

  async function handleAutoSync() {
    setIsSyncing(true);
    try {
      await replayQueue();
      const queue = await getAll("offline_queue");
      setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);
      incrementCatalogVersion();
    } catch {
      // Offline sync failure
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleManualSync() {
    if (isSyncing || isOffline) return;
    await handleAutoSync();
  }

  const { settings } = usePOSSettings();
  const lang = settings?.appearance?.defaultLanguage || "en";
  const { t } = useTranslation(lang);

  async function handleLogout() {
    try {
      await authClient.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  }

  function renderStatusBadge() {
    if (isSyncing) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          <RefreshCw className="size-3 animate-spin" />
          Syncing...
        </span>
      );
    }

    if (isOffline) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
          <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
          Offline
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
        <span className="size-2.5 rounded-full bg-emerald-500" />
        Online
      </span>
    );
  }

  function renderNavLink(item, compact = false, onNavigate) {
    const active = pathname === item.href;
    const Icon = item.icon;
    const key = item.label.toLowerCase().replace(" ", "_");
    const label = t(key) || item.label;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? label : undefined}
        onClick={onNavigate}
        className={
          active
            ? "relative flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--pos-action)] px-3 py-2.5 text-sm font-bold text-[var(--pos-action-fg)] shadow-sm transition-all duration-150 active:scale-[0.98]"
            : "relative flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] transition-all duration-150 active:scale-[0.98]"
        }
      >
        <span className={compact ? "flex w-full justify-center" : "flex min-w-0 items-center gap-3"}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {compact ? null : <span className="truncate">{label}</span>}
        </span>
        {!compact && item.label === "Orders" && pendingSyncCount > 0 ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">
            {pendingSyncCount}
          </span>
        ) : null}
        {compact && item.label === "Orders" && pendingSyncCount > 0 ? (
          <span className="absolute ml-7 mt-[-1.35rem] size-2 rounded-full bg-amber-400" />
        ) : null}
      </Link>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-sm transition-[width] duration-200 md:flex",
          sidebarCollapsed ? "w-20 p-3" : "w-64 p-5",
        ].join(" ")}
      >
        <div className={sidebarCollapsed ? "flex flex-col items-center gap-3" : "flex items-start justify-between gap-3"}>
          <div className={sidebarCollapsed ? "text-center" : ""}>
            <p className={sidebarCollapsed ? "text-xs font-black uppercase tracking-[0.08em] text-[var(--pos-action)]" : "text-xs font-bold uppercase tracking-[0.24em] text-[var(--pos-action)]"}>
              {sidebarCollapsed ? "MS" : (settings?.storeInfo?.storeName || "MyShop")}
            </p>
            {sidebarCollapsed ? null : <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-[var(--foreground)]">{t("pos")} Terminal</h1>}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="grid size-9 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="mt-6 space-y-1.5">{navItems.map((item) => renderNavLink(item, sidebarCollapsed))}</nav>

        <div className={sidebarCollapsed ? "mt-auto space-y-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5" : "mt-auto space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"}>
          <div className={sidebarCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between gap-2"}>
            <div className={sidebarCollapsed ? "flex items-center justify-center" : "flex items-center gap-2 text-xs font-semibold"}>
              {renderStatusBadge()}
            </div>
            {!sidebarCollapsed && pendingSyncCount > 0 ? (
              <button 
                onClick={handleManualSync} 
                disabled={isSyncing || isOffline}
                className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-200 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                title="Click to sync now"
              >
                {isSyncing ? "Syncing..." : `${pendingSyncCount} pending`}
              </button>
            ) : null}
            <div className={sidebarCollapsed ? "scale-90" : ""}>
              <ThemeToggle />
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={
              sidebarCollapsed
                ? "flex w-full items-center justify-center rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-2 text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/50"
                : "flex w-full items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/50"
            }
          >
            <LogOut className="size-4 shrink-0" />
            {sidebarCollapsed ? null : t("logout") || "Log Out"}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--surface-strong)]/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="grid size-9 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--foreground)]" aria-label="Open sidebar">
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">{settings?.storeInfo?.storeName || "MyShop"}</p>
              <p className="text-base font-black">{t("pos")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {renderStatusBadge()}
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="grid size-9 place-items-center rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="flex h-full w-72 max-w-[82vw] flex-col bg-[var(--surface-strong)] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--pos-action)]">{settings?.storeInfo?.storeName || "MyShop"}</p>
                <h1 className="mt-1.5 text-xl font-black tracking-tight">{t("pos")} Terminal</h1>
              </div>
              <button type="button" onClick={() => setMobileSidebarOpen(false)} className="grid size-9 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--foreground)]" aria-label="Close sidebar">
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-6 space-y-1.5">{navItems.map((item) => renderNavLink(item, false, () => setMobileSidebarOpen(false)))}</nav>
            <div className="mt-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {renderStatusBadge()}
                </div>
                {pendingSyncCount > 0 ? (
                  <button 
                    onClick={handleManualSync} 
                    disabled={isSyncing || isOffline}
                    className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                    title="Click to sync now"
                  >
                    {isSyncing ? "Syncing..." : `${pendingSyncCount} pending`}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => { setMobileSidebarOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-100"
              >
                <LogOut className="size-4 shrink-0" />
                {t("logout") || "Log Out"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className={sidebarCollapsed ? "md:pl-20" : "md:pl-64"}>
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

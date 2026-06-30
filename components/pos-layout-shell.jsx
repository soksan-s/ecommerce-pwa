"use client";

import { BarChart3, Home, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOffline } from "@/hooks/useOffline";
import { usePosStore } from "@/store/posStore";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { useTranslation } from "@/lib/translations";
import { requestBackgroundSync } from "@/lib/sync";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleManualSync() {
    setIsSyncing(true);
    await requestBackgroundSync();
    setIsSyncing(false);
  }

  const { settings } = usePOSSettings();
  const lang = settings?.appearance?.defaultLanguage || "en";
  const { t } = useTranslation(lang);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
            ? "relative flex min-h-11 items-center justify-between gap-3 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white"
            : "relative flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
        }
      >
        <span className={compact ? "flex w-full justify-center" : "flex min-w-0 items-center gap-3"}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {compact ? null : <span className="truncate">{label}</span>}
        </span>
        {!compact && item.label === "Orders" && pendingSyncCount > 0 ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">{pendingSyncCount}</span>
        ) : null}
        {compact && item.label === "Orders" && pendingSyncCount > 0 ? (
          <span className="absolute ml-7 mt-[-1.35rem] size-2 rounded-full bg-amber-400" />
        ) : null}
      </Link>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 md:flex",
          sidebarCollapsed ? "w-20 p-3" : "w-64 p-5",
        ].join(" ")}
      >
        <div className={sidebarCollapsed ? "flex flex-col items-center gap-3" : "flex items-start justify-between gap-3"}>
          <div className={sidebarCollapsed ? "text-center" : ""}>
            <p className={sidebarCollapsed ? "text-xs font-black uppercase tracking-[0.08em] text-emerald-700" : "text-xs font-bold uppercase tracking-[0.24em] text-emerald-700"}>
              {sidebarCollapsed ? "MS" : (settings?.storeInfo?.storeName || "MyShop")}
            </p>
            {sidebarCollapsed ? null : <h1 className="mt-2 text-2xl font-black tracking-tight">{t("pos")} Terminal</h1>}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <nav className="mt-8 space-y-2">{navItems.map((item) => renderNavLink(item, sidebarCollapsed))}</nav>

        <div className={sidebarCollapsed ? "mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3" : "mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4"}>
          <div className={sidebarCollapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between gap-3"}>
            <div className={sidebarCollapsed ? "flex items-center justify-center" : "flex items-center gap-2 text-sm font-bold"}>
              <span className={isOnline ? "size-3 rounded-full bg-emerald-500" : "size-3 rounded-full bg-red-500"} title={isOffline ? t("offline") : t("online")} />
              {sidebarCollapsed ? null : isOffline ? t("offline") : t("online")}
            </div>
            {!sidebarCollapsed && pendingSyncCount > 0 ? (
              <button 
                onClick={handleManualSync} 
                disabled={isSyncing || isOffline}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                title="Click to sync now"
              >
                {isSyncing ? "Syncing..." : `${pendingSyncCount} ${t("pending")}`}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={
              sidebarCollapsed
                ? "mt-3 flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-600 transition hover:bg-red-100"
                : "mt-3 flex w-full items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
            }
          >
            <LogOut className="size-4 shrink-0" />
            {sidebarCollapsed ? null : t("logout") || "Log Out"}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700" aria-label="Open sidebar">
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{settings?.storeInfo?.storeName || "MyShop"}</p>
              <p className="text-lg font-black">{t("pos")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={isOnline ? "size-3 rounded-full bg-emerald-500" : "size-3 rounded-full bg-red-500"} />
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="grid size-10 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="flex h-full w-72 max-w-[82vw] flex-col bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">{settings?.storeInfo?.storeName || "MyShop"}</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight">{t("pos")} Terminal</h1>
              </div>
              <button type="button" onClick={() => setMobileSidebarOpen(false)} className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700" aria-label="Close sidebar">
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-8 space-y-2">{navItems.map((item) => renderNavLink(item, false, () => setMobileSidebarOpen(false)))}</nav>
            <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className={isOnline ? "size-3 rounded-full bg-emerald-500" : "size-3 rounded-full bg-red-500"} />
                  {isOffline ? t("offline") : t("online")}
                </div>
                {pendingSyncCount > 0 ? (
                  <button 
                    onClick={handleManualSync} 
                    disabled={isSyncing || isOffline}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                    title="Click to sync now"
                  >
                    {isSyncing ? "Syncing..." : `${pendingSyncCount} ${t("pending")}`}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => { setMobileSidebarOpen(false); handleLogout(); }}
                className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  Ticket,
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
  Plus,
  Command,
  Store,
  TrendingUp,
  Package,
  Globe,
  Check,
  ChevronDown,
} from "lucide-react";

import {
  AdminCouponsPageView,
  AdminDashboardPageView,
  AdminInventoryPageView,
  AdminOrderManagementPageView,
  AdminSupportInboxPageView,
  AdminUsersPageView,
} from "@/components/admin-pages";
import { AdminReportsPageView } from "@/components/admin/report-management";
import { AdminProductManagementPageView } from "@/components/admin-product-pages";
import { useAppStore } from "@/components/app-store-provider";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Config (v0 Sales Operations Style)
// ─────────────────────────────────────────────────────────────────────────────
const adminTabs = [
  { key: "dashboard", label: "Overview", translationKey: "nav_overview", icon: LayoutDashboard, group: "overview" },
  { key: "sales", label: "Reports", translationKey: "nav_reports", icon: BarChart3, group: "overview" },
  { key: "products", label: "Products", translationKey: "nav_products", icon: Boxes, group: "catalog" },
  { key: "inventory", label: "Inventory", translationKey: "nav_inventory", icon: ClipboardList, group: "catalog" },
  { key: "orders", label: "Orders", translationKey: "nav_orders", icon: ReceiptText, group: "operations" },
  { key: "coupons", label: "Coupons", translationKey: "nav_coupons", icon: Ticket, group: "operations" },
  { key: "support", label: "Support Inbox", translationKey: "nav_support", icon: LifeBuoy, group: "operations" },
  { key: "users", label: "Team & Roles", translationKey: "nav_users", icon: Users, group: "settings" },
];

const tabGroups = [
  { key: "overview", label: "Overview", translationKey: "group_overview" },
  { key: "catalog", label: "Catalog & Stock", translationKey: "group_catalog" },
  { key: "operations", label: "Sales & Support", translationKey: "group_operations" },
  { key: "settings", label: "Administration", translationKey: "group_settings" },
];

function resolveAdminTab(value) {
  return adminTabs.some((tab) => tab.key === value) ? value : "dashboard";
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav Item Component (v0 Pill with Accent Dot/Bar)
// ─────────────────────────────────────────────────────────────────────────────
function SideNavItem({ tab, active, collapsed, badge, onClick, t }) {
  const Icon = tab.icon;
  const label = t ? t(tab.translationKey || tab.label) : tab.label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)] focus-visible:ring-offset-1",
        collapsed && "justify-center px-0",
        active
          ? "bg-[var(--action)] text-white shadow-md shadow-[var(--action)]/20 font-semibold"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
      )}
    >
      <Icon
        className={cn(
          "size-4 flex-shrink-0 transition-transform duration-200",
          active ? "text-white" : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
          !active && "group-hover:scale-110"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {badge > 0 && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                active ? "bg-white/20 text-white" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
      {collapsed && badge > 0 && (
        <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[var(--surface-strong)]" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop Collapsible Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function DesktopSidebar({ user, selectedTab, collapsed, setCollapsed, openTab, tabBadges, t }) {
  const initials = (user?.name || user?.email || "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 transition-all duration-300 ease-in-out border-r border-[var(--border-soft)] bg-[var(--surface-strong)]"
      )}
      style={{ width: collapsed ? "4.5rem" : "16rem" }}
    >
      {/* Brand & Store Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-[var(--border-soft)]",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-3")}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--action)] shadow-md shadow-[var(--shadow-glow)] text-[var(--action-foreground)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Zap className="size-5" />
          </button>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--foreground)] tracking-tight">
                {t ? t("admin_title") : "SalesOps Admin"}
              </p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                {t ? t("admin_subtitle") : "Beverage Wholesale & Retail Management System"}
              </p>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {tabGroups.map((group) => {
          const groupTabs = adminTabs.filter((t) => t.group === group.key);
          const groupLabel = t ? t(group.translationKey || group.label) : group.label;
          return (
            <div key={group.key}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {groupLabel}
                </p>
              )}
              <div className="space-y-1">
                {groupTabs.map((tab) => (
                  <SideNavItem
                    key={tab.key}
                    tab={tab}
                    active={selectedTab === tab.key}
                    collapsed={collapsed}
                    badge={tabBadges[tab.key] || 0}
                    onClick={() => openTab(tab.key)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="border-t border-[var(--border-soft)] p-3 space-y-2">
        <div className={cn("flex items-center gap-3 rounded-xl p-2 bg-[var(--surface-quiet)]/50 border border-[var(--border-soft)]", collapsed && "justify-center p-1.5")}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--action-surface)] text-xs font-bold text-[var(--action-on-muted)] ring-1 ring-[color-mix(in_srgb,var(--action)_30%,transparent)]">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">{user?.name || "Admin User"}</p>
              <p className="truncate text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{user?.role || "ADMIN"}</p>
            </div>
          )}
        </div>
        {!collapsed ? (
          <LogoutButton className="w-full justify-start gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10" iconOnly={false} />
        ) : (
          <LogoutButton className="w-full justify-center" iconOnly={true} />
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Drawer
// ─────────────────────────────────────────────────────────────────────────────
function MobileDrawer({ user, selectedTab, drawerOpen, setDrawerOpen, openTab, tabBadges, t, lang, setLanguage }) {
  const initials = (user?.name || user?.email || "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawerOpen(false)}
          />

          <motion.aside
            key="drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--surface-strong)] border-r border-[var(--border-soft)] lg:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3, ease: easeInOutCubic }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--border-soft)]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--action)] text-[var(--action-foreground)]">
                  <Zap className="size-4" />
                </div>
                <p className="text-sm font-bold text-[var(--foreground)]">{t ? t("admin_title") : "SalesOps Admin"}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {tabGroups.map((group) => {
                const groupTabs = adminTabs.filter((t) => t.group === group.key);
                const groupLabel = t ? t(group.translationKey || group.label) : group.label;
                return (
                  <div key={group.key}>
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                      {groupLabel}
                    </p>
                    <div className="space-y-1">
                      {groupTabs.map((tab) => (
                        <SideNavItem
                          key={tab.key}
                          tab={tab}
                          active={selectedTab === tab.key}
                          collapsed={false}
                          badge={tabBadges[tab.key] || 0}
                          onClick={() => openTab(tab.key)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-[var(--border-soft)] p-3 space-y-3">
              {/* Mobile Language Switcher */}
              <div className="flex items-center justify-between rounded-xl p-2 bg-[var(--surface-quiet)]/50 border border-[var(--border-soft)]">
                <span className="text-xs font-semibold text-[var(--muted-foreground)] flex items-center gap-1.5">
                  <Globe className="size-3.5" />
                  {t ? t("language") : "Language"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-colors",
                      lang === "en" ? "bg-[var(--action)] text-white font-bold" : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                    )}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("km")}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-colors font-khmer",
                      lang === "km" ? "bg-[var(--action)] text-white font-bold" : "text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                    )}
                  >
                    ខ្មែរ
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl p-2.5 bg-[var(--surface-quiet)]/50">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--action-surface)] text-xs font-bold text-[var(--action-on-muted)] ring-1 ring-[color-mix(in_srgb,var(--action)_30%,transparent)]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--foreground)]">{user?.name || "Admin"}</p>
                  <p className="truncate text-[10px] text-[var(--muted-foreground)]">{user?.role || "ADMIN"}</p>
                </div>
              </div>
              <LogoutButton className="mt-2 w-full justify-start gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10" iconOnly={false} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Header (Command Search + Notifications + Theme Toggle)
// ─────────────────────────────────────────────────────────────────────────────
function TopHeader({
  title,
  user,
  setDrawerOpen,
  notificationTotal,
  notificationOpen,
  setNotificationOpen,
  notificationAlerts,
  openTab,
  t,
  lang,
  setLanguage,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-strong)]/85 backdrop-blur-md px-4 sm:px-6">
      {/* Mobile drawer toggle */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      {/* Page Title & Subtitle */}
      <div className="flex-1 min-w-0">
        <h1 className="font-display truncate text-xl font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        <p className="hidden sm:block text-xs text-[var(--muted-foreground)] truncate">
          {t ? t("admin_subtitle") : "Beverage Wholesale & Retail Management System"}
        </p>
      </div>

      {/* Search Input / Command Hint */}
      {/* <div className="hidden md:flex items-center">
        <div className="relative w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t ? t("search_admin_placeholder") : "Search orders, products, users..."}
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/60 pl-9 pr-12 py-1.5 text-xs text-[var(--foreground)] placeholder:[var(--muted-foreground)] focus:border-[var(--action)] focus:outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-[var(--border-soft)] bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]">
            <span>Ctrl K</span>
          </div>
        </div>
      </div> */}

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Action: Add Product */}
        <Button
          onClick={() => openTab("products")}
          size="sm"
          className="hidden sm:inline-flex items-center gap-1.5 bg-[var(--action)] text-white hover:opacity-90 shadow-sm"
        >
          <Plus className="size-3.5" />
          <span className="text-xs font-semibold">{t ? t("new_product") : "New Product"}</span>
        </Button>

        {/* Language Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-soft)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors focus:outline-none"
            aria-label="Change Language"
          >
            <Globe className="size-4 text-[var(--muted-foreground)]" />
            <span className="hidden sm:inline">{lang === "en" ? "English" : "ភាសាខ្មែរ"}</span>
            <ChevronDown className="size-3 text-[var(--muted-foreground)]" />
          </button>

          <AnimatePresence>
            {langDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-36 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-1.5 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("en");
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
                    setLanguage("km");
                    setLangDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors font-khmer",
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

        {/* Notifications Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNotificationOpen(!notificationOpen);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-soft)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
            aria-label={`Notifications${notificationTotal > 0 ? `, ${notificationTotal} unread` : ""}`}
          >
            <Bell className="size-4.5" />
            {notificationTotal > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[var(--surface-strong)]">
                {notificationTotal > 99 ? "99+" : notificationTotal}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationOpen && (
              <motion.div
                key="notif-panel"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 bg-[var(--surface-quiet)]/40">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{t ? t("notifications") : "Notifications"}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{t ? t("notifications_sub") : "Inventory & expiry alerts"}</p>
                  </div>
                  {notificationTotal > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {notificationTotal}
                    </Badge>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificationAlerts.length ? (
                    notificationAlerts.slice(0, 10).map((alert) => (
                      <Link
                        key={alert.id}
                        href={alert.href || "/admin"}
                        onClick={() => setNotificationOpen(false)}
                        className="flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-quiet)] border-b border-[var(--border-soft)] last:border-0"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px]",
                            alert.severity === "danger"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          )}
                        >
                          <AlertTriangle className="size-3" />
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "font-semibold text-xs",
                              alert.severity === "danger" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {alert.type === "expired" || alert.type === "out_of_stock" ? "Critical" : "Warning"}
                          </p>
                          <p className="mt-0.5 text-[var(--foreground)] text-xs leading-relaxed">{alert.message}</p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">{t ? t("no_notifications") : "All clear — no pending alerts."}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Night/Light Mode Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// System Alerts Modal
// ─────────────────────────────────────────────────────────────────────────────
function AlertsModal({ activeAlerts, alertOpen, setAlertOpen }) {
  return (
    <AnimatePresence>
      {alertOpen && activeAlerts.length > 0 && (
        <motion.div
          key="alerts-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: easeInOutCubic }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-strong)] px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-none bg-rose-600 text-white shadow-sm dark:bg-rose-500">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <p className="text-base font-extrabold text-[var(--foreground)]">System Alerts</p>
                <p className="text-xs font-semibold text-[var(--foreground)]">{activeAlerts.length} item(s) require admin action</p>
              </div>
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto bg-[var(--surface-soft)] p-4">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.title}
                  className={cn(
                    "flex gap-3 rounded-none border-l-4 border-y border-r bg-[var(--surface-strong)] px-4 py-3 shadow-sm",
                    alert.tone === "danger"
                      ? "border-l-rose-600 border-y-rose-200 border-r-rose-200 dark:border-l-rose-400 dark:border-y-rose-900 dark:border-r-rose-900"
                      : "border-l-amber-500 border-y-amber-200 border-r-amber-200 dark:border-l-amber-300 dark:border-y-amber-900 dark:border-r-amber-900"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-4 flex-shrink-0",
                      alert.tone === "danger" ? "text-rose-600 dark:text-rose-300" : "text-amber-600 dark:text-amber-300"
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-extrabold",
                        alert.tone === "danger" ? "text-rose-700 dark:text-rose-500" : "text-amber-700 dark:text-amber-500"
                      )}
                    >
                      {alert.title}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold leading-relaxed text-[var(--foreground)]"
                      )}
                    >
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[var(--border-soft)] bg-[var(--surface-strong)] px-6 py-4">
              <Button onClick={() => setAlertOpen(false)} size="sm" className="bg-[var(--action)] text-white shadow-md">
                Review Dashboard
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminShell Component
// ─────────────────────────────────────────────────────────────────────────────
export function AdminShell({ user, initialTab = "dashboard" }) {
  const store = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [lastAlertSignature, setLastAlertSignature] = useState("");

  const lang = store.language || "en";
  const { t } = useTranslation(lang);
  const selectedTab = resolveAdminTab(searchParams.get("tab") || initialTab);

  const title = useMemo(() => {
    const found = adminTabs.find((t) => t.key === selectedTab);
    return found ? t(found.translationKey || found.label) : t("nav_overview");
  }, [selectedTab, t]);

  function openTab(tab) {
    const href = tab === "dashboard" ? "/admin" : `/admin?tab=${tab}`;
    router.push(href);
    setDrawerOpen(false);
    setNotificationOpen(false);
  }

  function renderContent() {
    switch (selectedTab) {
      case "products": return <AdminProductManagementPageView />;
      case "inventory": return <AdminInventoryPageView />;
      case "orders": return <AdminOrderManagementPageView />;
      case "sales": return <AdminReportsPageView />;
      case "coupons": return <AdminCouponsPageView />;
      case "support": return <AdminSupportInboxPageView user={user} />;
      case "users": return <AdminUsersPageView currentUserId={user?.id} />;
      default: return <AdminDashboardPageView />;
    }
  }

  // Active alerts calculation
  const activeAlerts = useMemo(() => {
    const lowStock = store.products.filter((p) => p.stock <= 5).length;
    const openComplaints = store.supportTickets.filter((t) => t.status !== "closed").length;
    const pendingOrders = store.orders.filter((o) => o.status === "pending").length;
    const alerts = [];
    if (openComplaints > 0) alerts.push({ title: "Customer complaints need attention", message: `${openComplaints} support ticket${openComplaints === 1 ? "" : "s"} still need admin action.`, tone: "danger" });
    if (lowStock > 0) alerts.push({ title: "Low stock warning", message: `${lowStock} product${lowStock === 1 ? "" : "s"} are running low and may need restocking.`, tone: lowStock >= 5 ? "danger" : "warning" });
    if (pendingOrders >= 8) alerts.push({ title: "Pending orders are building up", message: `${pendingOrders} orders are still pending. Review fulfillment so delivery does not slip.`, tone: "warning" });
    return alerts;
  }, [store.orders, store.products, store.supportTickets]);

  // Tab badges
  const tabBadges = useMemo(
    () => ({
      support: store.supportTickets.filter((t) => t.status !== "closed").length,
      orders: store.orders.filter((o) => o.status === "pending").length,
    }),
    [store.supportTickets, store.orders]
  );

  // Auto alert popup
  useEffect(() => {
    const signature = activeAlerts.map((a) => `${a.title}:${a.message}`).join("|");
    if (!activeAlerts.length) {
      if (!lastAlertSignature) return undefined;
      const t = window.setTimeout(() => setLastAlertSignature(""), 0);
      return () => window.clearTimeout(t);
    }
    if (alertOpen || signature === lastAlertSignature) return;
    const t = window.setTimeout(() => {
      setLastAlertSignature(signature);
      setAlertOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [activeAlerts, alertOpen, lastAlertSignature]);

  // Load notifications API
  useEffect(() => {
    let mounted = true;
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = await res.json();
        if (!mounted) return;
        setNotificationAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
        setNotificationTotal(Number(payload.total || 0));
      } catch {
        if (mounted) {
          setNotificationAlerts([]);
          setNotificationTotal(0);
        }
      }
    }
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Close notifications on window click
  useEffect(() => {
    if (!notificationOpen) return;
    const handler = () => setNotificationOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [notificationOpen]);

  return (
    <div className="min-h-screen bg-[var(--background-start)] font-sans text-[var(--foreground)]">
      {/* Desktop Sidebar (Collapsible) */}
      <DesktopSidebar
        user={user}
        selectedTab={selectedTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        openTab={openTab}
        tabBadges={tabBadges}
        t={t}
      />

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        user={user}
        selectedTab={selectedTab}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        openTab={openTab}
        tabBadges={tabBadges}
        t={t}
        lang={lang}
        setLanguage={store.setLanguage}
      />

      {/* Main Content Area (Dynamic padding for collapsible desktop sidebar) */}
      <div
        className={
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out " +
          (collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")
        }
      >
        {/* Top Header Bar */}
        <TopHeader
          title={title}
          user={user}
          setDrawerOpen={setDrawerOpen}
          notificationTotal={notificationTotal}
          notificationOpen={notificationOpen}
          setNotificationOpen={setNotificationOpen}
          notificationAlerts={notificationAlerts}
          openTab={openTab}
          t={t}
          lang={lang}
          setLanguage={store.setLanguage}
        />

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.28, ease: easeInOutCubic }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* System Alerts Modal */}
      <AlertsModal activeAlerts={activeAlerts} alertOpen={alertOpen} setAlertOpen={setAlertOpen} />
    </div>
  );
}

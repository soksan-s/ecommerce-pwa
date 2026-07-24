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
} from "lucide-react";

import {
  AdminCouponsPageView,
  AdminDashboardPageView,
  AdminInventoryPageView,
  AdminOrderManagementPageView,
  AdminProductManagementPageView,
  AdminSalesReportPageView,
  AdminSupportInboxPageView,
  AdminUsersPageView,
} from "@/components/admin-pages";
import { useAppStore } from "@/components/app-store-provider";
import { LogoutButton } from "@/components/logout-button";
import { easeInOutCubic } from "@/components/motion/motion-utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Config (v0 Sales Operations Style)
// ─────────────────────────────────────────────────────────────────────────────
const adminTabs = [
  { key: "dashboard", label: "Overview",     icon: LayoutDashboard, group: "overview" },
  { key: "sales",     label: "Analytics",    icon: BarChart3,       group: "overview" },
  { key: "products",  label: "Products",     icon: Boxes,           group: "catalog" },
  { key: "inventory", label: "Inventory",    icon: ClipboardList,   group: "catalog" },
  { key: "orders",    label: "Orders",       icon: ReceiptText,     group: "operations" },
  { key: "coupons",   label: "Coupons",      icon: Ticket,          group: "operations" },
  { key: "support",   label: "Support Inbox",icon: LifeBuoy,        group: "operations" },
  { key: "users",     label: "Team & Roles", icon: Users,           group: "settings" },
];

const tabGroups = [
  { key: "overview",   label: "Overview" },
  { key: "catalog",    label: "Catalog & Stock" },
  { key: "operations", label: "Sales & Support" },
  { key: "settings",   label: "Administration" },
];

function resolveAdminTab(value) {
  return adminTabs.some((tab) => tab.key === value) ? value : "dashboard";
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav Item Component (v0 Pill with Accent Dot/Bar)
// ─────────────────────────────────────────────────────────────────────────────
function SideNavItem({ tab, active, collapsed, badge, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? tab.label : undefined}
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
          <span className="flex-1 text-left truncate">{tab.label}</span>
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
function DesktopSidebar({ user, selectedTab, collapsed, setCollapsed, openTab, tabBadges }) {
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
      <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--border-soft)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-600/30 text-white">
            <Zap className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--foreground)] tracking-tight">SalesOps Admin</p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">Cambodia Beverage POS</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {tabGroups.map((group) => {
          const groupTabs = adminTabs.filter((t) => t.group === group.key);
          return (
            <div key={group.key}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {group.label}
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
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-xs font-bold text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30">
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
function MobileDrawer({ user, selectedTab, drawerOpen, setDrawerOpen, openTab, tabBadges }) {
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Zap className="size-4" />
                </div>
                <p className="text-sm font-bold text-[var(--foreground)]">SalesOps Admin</p>
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
                return (
                  <div key={group.key}>
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                      {group.label}
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
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-[var(--border-soft)] p-3">
              <div className="flex items-center gap-3 rounded-xl p-2.5 bg-[var(--surface-quiet)]/50">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-xs font-bold text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30">
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
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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
        <h1 className="truncate text-lg font-bold text-[var(--foreground)] tracking-tight">
          {title}
        </h1>
        <p className="hidden sm:block text-xs text-[var(--muted-foreground)] truncate">
          Beverage Wholesale & Retail Management System
        </p>
      </div>

      {/* Search Input / Command Hint */}
      <div className="hidden md:flex items-center">
        <div className="relative w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, products, users..."
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/60 pl-9 pr-12 py-1.5 text-xs text-[var(--foreground)] placeholder:[var(--muted-foreground)] focus:border-[var(--action)] focus:outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-[var(--border-soft)] bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]">
            <span>Ctrl K</span>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Action: Add Product */}
        <Button
          onClick={() => openTab("products")}
          size="sm"
          className="hidden sm:inline-flex items-center gap-1.5 bg-[var(--action)] text-white hover:opacity-90 shadow-sm"
        >
          <Plus className="size-3.5" />
          <span className="text-xs font-semibold">New Product</span>
        </Button>

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
                    <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Inventory & expiry alerts</p>
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
                    <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">All clear — no pending alerts.</p>
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
            <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-6 py-4 bg-[var(--surface-quiet)]/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15">
                <ShieldAlert className="size-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="font-bold text-[var(--foreground)]">System Alerts</p>
                <p className="text-xs text-[var(--muted-foreground)]">{activeAlerts.length} item(s) require admin action</p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-4 space-y-3">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.title}
                  className={cn(
                    "flex gap-3 rounded-xl border px-4 py-3",
                    alert.tone === "danger"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-4 flex-shrink-0",
                      alert.tone === "danger" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                    )}
                  />
                  <div>
                    <p className="text-xs font-bold">{alert.title}</p>
                    <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border-soft)] px-6 py-4 flex justify-end">
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

  const selectedTab = resolveAdminTab(searchParams.get("tab") || initialTab);

  const title = useMemo(() => {
    const found = adminTabs.find((t) => t.key === selectedTab);
    return found ? found.label : "Overview";
  }, [selectedTab]);

  function openTab(tab) {
    const href = tab === "dashboard" ? "/admin" : `/admin?tab=${tab}`;
    router.push(href);
    setDrawerOpen(false);
    setNotificationOpen(false);
  }

  function renderContent() {
    switch (selectedTab) {
      case "products":  return <AdminProductManagementPageView />;
      case "inventory": return <AdminInventoryPageView />;
      case "orders":    return <AdminOrderManagementPageView />;
      case "sales":     return <AdminSalesReportPageView />;
      case "coupons":   return <AdminCouponsPageView />;
      case "support":   return <AdminSupportInboxPageView user={user} />;
      case "users":     return <AdminUsersPageView currentUserId={user?.id} />;
      default:          return <AdminDashboardPageView />;
    }
  }

  // Active alerts calculation
  const activeAlerts = useMemo(() => {
    const lowStock = store.products.filter((p) => p.stock <= 5).length;
    const openComplaints = store.supportTickets.filter((t) => t.status !== "closed").length;
    const pendingOrders = store.orders.filter((o) => o.status === "pending").length;
    const alerts = [];
    if (openComplaints > 0) alerts.push({ title: "Customer complaints need attention", message: `${openComplaints} support ticket${openComplaints === 1 ? "" : "s"} still need admin action.`, tone: "danger" });
    if (lowStock > 0)       alerts.push({ title: "Low stock warning", message: `${lowStock} product${lowStock === 1 ? "" : "s"} are running low and may need restocking.`, tone: lowStock >= 5 ? "danger" : "warning" });
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
      />

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        user={user}
        selectedTab={selectedTab}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        openTab={openTab}
        tabBadges={tabBadges}
      />

      {/* Main Content Area (Dynamic padding for collapsible desktop sidebar) */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300 ease-in-out"
        style={{
          paddingLeft: typeof window !== "undefined" && window.innerWidth >= 1024 ? (collapsed ? "4.5rem" : "16rem") : "0rem",
        }}
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

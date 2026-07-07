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
  Menu,
  ReceiptText,
  Ticket,
  X,
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
import { cn } from "@/lib/utils";

const adminTabs = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Boxes },
  { key: "inventory", label: "Inventory", icon: ClipboardList },
  { key: "orders", label: "Orders", icon: ReceiptText },
  { key: "sales", label: "Sales", icon: BarChart3 },
  { key: "coupons", label: "Coupons", icon: Ticket },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "users", label: "Users", icon: Users },
];

function resolveAdminTab(value) {
  return adminTabs.some((tab) => tab.key === value) ? value : "dashboard";
}

function NavButton({ active, icon: Icon, label, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "app-nav-button flex items-center gap-3 px-4 py-3 text-sm font-semibold",
        compact && "w-full justify-start",
        active && "bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] text-[var(--foreground)]",
      )}
      data-active={active}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

export function AdminShell({ user, initialTab = "dashboard" }) {
  const store = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [lastAlertSignature, setLastAlertSignature] = useState("");

  const selectedTab = resolveAdminTab(searchParams.get("tab") || initialTab);

  const title = useMemo(() => {
    switch (selectedTab) {
      case "products":
        return "Products";
      case "inventory":
        return "Inventory";
      case "orders":
        return "Orders";
      case "sales":
        return "Sales Report";
      case "coupons":
        return "Coupons";
      case "support":
        return "Support";
      case "users":
        return "User Management";
      default:
        return "Admin Dashboard";
    }
  }, [selectedTab]);

  function openTab(tab) {
    const href = tab === "dashboard" ? "/admin" : `/admin?tab=${tab}`;
    router.push(href);
    setDrawerOpen(false);
  }

  function renderContent() {
    switch (selectedTab) {
      case "products":
        return <AdminProductManagementPageView />;
      case "inventory":
        return <AdminInventoryPageView />;
      case "orders":
        return <AdminOrderManagementPageView />;
      case "sales":
        return <AdminSalesReportPageView />;
      case "coupons":
        return <AdminCouponsPageView />;
      case "support":
        return <AdminSupportInboxPageView user={user} />;
      case "users":
        return <AdminUsersPageView currentUserId={user?.id} />;
      default:
        return <AdminDashboardPageView />;
    }
  }

  const activeAlerts = useMemo(() => {
    const lowStock = store.products.filter((product) => product.stock <= 5).length;
    const openComplaints = store.supportTickets.filter((ticket) => ticket.status !== "closed").length;
    const pendingOrders = store.orders.filter((order) => order.status === "pending").length;
    const alerts = [];

    if (openComplaints > 0) {
      alerts.push({
        title: "Customer complaints need attention",
        message: `${openComplaints} support ticket${openComplaints === 1 ? "" : "s"} still need admin action.`,
        tone: "danger",
      });
    }
    if (lowStock > 0) {
      alerts.push({
        title: "Low stock warning",
        message: `${lowStock} product${lowStock === 1 ? "" : "s"} are running low and may need restocking.`,
        tone: lowStock >= 5 ? "danger" : "warning",
      });
    }
    if (pendingOrders >= 8) {
      alerts.push({
        title: "Pending orders are building up",
        message: `${pendingOrders} orders are still pending. Review fulfillment so delivery does not slip.`,
        tone: "warning",
      });
    }

    return alerts;
  }, [store.orders, store.products, store.supportTickets]);

  useEffect(() => {
    const signature = activeAlerts.map((alert) => `${alert.title}:${alert.message}`).join("|");

    if (!activeAlerts.length) {
      if (!lastAlertSignature) {
        return undefined;
      }

      const clearTimer = window.setTimeout(() => {
        setLastAlertSignature("");
      }, 0);

      return () => window.clearTimeout(clearTimer);
    }

    if (alertOpen || signature === lastAlertSignature) {
      return;
    }

    const openTimer = window.setTimeout(() => {
      setLastAlertSignature(signature);
      setAlertOpen(true);
    }, 0);

    return () => window.clearTimeout(openTimer);
  }, [activeAlerts, alertOpen, lastAlertSignature]);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (!mounted) {
          return;
        }

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
            <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-[var(--muted-foreground)] min-[700px]:inline">
              {user?.name || user?.email || "Admin"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((value) => !value)}
                className="app-icon-button relative p-2"
                aria-label="Open notifications"
              >
                <Bell className="size-5" />
                {notificationTotal > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[0.68rem] font-bold text-white">
                    {notificationTotal > 99 ? "99+" : notificationTotal}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-strong)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
                      <p className="text-xs text-[var(--muted-foreground)]">Inventory and expiry alerts</p>
                    </div>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] px-2 py-1 text-xs font-bold text-[var(--foreground)]">
                      {notificationTotal}
                    </span>
                  </div>
                  <div className="max-h-[22rem] overflow-y-auto p-2">
                    {notificationAlerts.length ? (
                      notificationAlerts.slice(0, 10).map((alert) => (
                        <Link
                          key={alert.id}
                          href={alert.href || "/admin"}
                          onClick={() => setNotificationOpen(false)}
                          className="block rounded-2xl px-3 py-3 text-sm hover:bg-[color-mix(in_srgb,var(--action)_9%,transparent)]"
                        >
                          <span className={cn("block font-semibold", alert.severity === "danger" ? "text-rose-600" : "text-amber-600")}>
                            {alert.type === "expired" || alert.type === "out_of_stock" ? "Critical" : "Warning"}
                          </span>
                          <span className="mt-1 block leading-6 text-[var(--foreground)]">{alert.message}</span>
                        </Link>
                      ))
                    ) : (
                      <p className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">No alerts right now.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <ThemeToggle />
            <LogoutButton className="hidden min-[700px]:inline-flex" iconOnly />
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
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Admin</p>
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
              {adminTabs.map((tab) => (
                <NavButton key={tab.key} active={selectedTab === tab.key} icon={tab.icon} label={tab.label} compact onClick={() => openTab(tab.key)} />
              ))}
            </div>
            <LogoutButton className="mt-5 w-full" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section className="pt-6">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, x: 18, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -12, scale: 0.985 }}
              transition={{ duration: 0.48, ease: easeInOutCubic }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {alertOpen && activeAlerts.length ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 18 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: 14 }}
              transition={{ duration: 0.42, ease: easeInOutCubic }}
              className="app-card w-full max-w-[26rem] p-6"
            >
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Admin alerts</h2>
              <div className="mt-4 space-y-3">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={cn(
                      "rounded-[1.15rem] border px-4 py-4",
                      alert.tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white/70 p-2">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div>
                        <p className="font-semibold">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6 text-current/78">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAlertOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--action)] px-4 py-3 text-sm font-semibold text-[var(--action-foreground)]"
                >
                  Review dashboard
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

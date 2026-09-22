"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, CheckCheck, Package, ReceiptText, ShieldCheck, Wifi, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/translations";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr, t) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return t("notif_just_now") || "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function notifIcon(type) {
  switch (type) {
    case "ORDER_PLACED":
      return <ReceiptText className="size-4 shrink-0 text-blue-500" />;
    case "ORDER_STATUS_CHANGE":
      return <Package className="size-4 shrink-0 text-amber-500" />;
    case "PAYMENT_RECEIVED":
      return <ShieldCheck className="size-4 shrink-0 text-emerald-500" />;
    case "SYSTEM":
      return <Bell className="size-4 shrink-0 text-purple-500" />;
    // Local POS types
    case "success":
      return <Wifi className="size-4 shrink-0 text-emerald-500" />;
    case "error":
      return <Wifi className="size-4 shrink-0 text-red-500" />;
    case "warning":
      return <Package className="size-4 shrink-0 text-amber-500" />;
    default:
      return <Bell className="size-4 shrink-0 text-muted-foreground" />;
  }
}

function notifHref(notif) {
  if (!notif || !notif.data) return null;
  const { orderId } = notif.data;
  if (!orderId) return null;

  // Determine context from the component's "mode" via data attribute
  return null; // callers pass href via prop
}

// ─── Single notification item ─────────────────────────────────────────────────

function NotifItem({ notif, onDismiss, href, t }) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
        notif.isRead
          ? "opacity-60"
          : "bg-[var(--surface-quiet)] hover:bg-[var(--surface-soft)]"
      )}
    >
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-soft)]">
        {notifIcon(notif.type)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[var(--foreground)] truncate">
          {notif.title}
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
          {notif.message}
        </p>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]/70">
          {formatRelativeTime(notif.createdAt, t)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {!notif.isRead && <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />}
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(notif.id)}
            className="hidden group-hover:flex items-center justify-center size-5 rounded-md bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title={t("notif_dismiss") || "Dismiss"}
            aria-label={t("notif_dismiss") || "Dismiss"}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Dropdown Component ─────────────────────────────────────────────────

/**
 * Reusable notification bell + dropdown.
 *
 * Props:
 *   lang          - "en" | "km"
 *   notifications - array of server notification objects
 *   localNotifs   - array of local POS notification objects (optional)
 *   unreadCount   - number (from server)
 *   onMarkAllRead - async callback
 *   onDismiss     - (id: string) => void — dismiss a local notification
 *   orderHref     - (orderId: string) => string — builds the "View Order" link
 *   pollInterval  - ms, default 30000
 *   fetchFn       - optional override for fetching (uses /api/notifications by default)
 */
export function NotificationsDropdown({
  lang = "en",
  notifications: externalNotifs,
  localNotifs = [],
  unreadCount: externalUnread,
  onMarkAllRead,
  onDismiss,
  orderHref,
  pollInterval = 30000,
  fetchFn,
}) {
  const { t } = useTranslation(lang);
  const [open, setOpen] = useState(false);
  const [serverNotifs, setServerNotifs] = useState(externalNotifs || []);
  const [serverUnread, setServerUnread] = useState(externalUnread || 0);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  // ── Fetch server notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const fn = fetchFn || (() => fetch("/api/notifications", { cache: "no-store" }));
      const res = await fn();
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data || json;
      const notifs = data.notifications || [];
      const unread = data.unreadCount ?? notifs.filter((n) => !n.isRead).length;
      setServerNotifs(notifs);
      setServerUnread(unread);
    } catch {
      // Silently ignore polling errors
    }
  }, [fetchFn]);

  // External updates sync
  useEffect(() => {
    if (externalNotifs !== undefined) setServerNotifs(externalNotifs);
  }, [externalNotifs]);

  useEffect(() => {
    if (externalUnread !== undefined) setServerUnread(externalUnread);
  }, [externalUnread]);

  // Poll only if no external provider
  useEffect(() => {
    if (externalNotifs !== undefined) return;
    fetchNotifications();
    if (pollInterval > 0) {
      pollRef.current = setInterval(fetchNotifications, pollInterval);
    }
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications, pollInterval, externalNotifs]);

  // ── Close on outside click ──────────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // ── Mark all read ───────────────────────────────────────────────────────
  async function handleMarkAllRead() {
    setIsMarkingRead(true);
    try {
      if (onMarkAllRead) {
        await onMarkAllRead();
      } else {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAllRead: true }),
        });
      }
      setServerNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setServerUnread(0);
    } catch {
      // Ignore
    } finally {
      setIsMarkingRead(false);
    }
  }

  const localUnread = localNotifs.filter((n) => !n.isRead).length;
  const totalUnread = serverUnread + localUnread;

  const allNotifs = [
    ...localNotifs.map((n) => ({ ...n, _local: true })),
    ...serverNotifs,
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notification_bell_label") || "Open notifications"}
        className={cn(
          "relative grid size-9 place-items-center rounded-lg transition-colors",
          open
            ? "bg-[var(--surface-quiet)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
        )}
      >
        <Bell className="size-5" />
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-[var(--background)]">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-11 z-50 flex w-80 flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-2xl max-h-[420px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--foreground)]">
                {t("notifications") || "Notifications"}
                {totalUnread > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-black text-blue-600 dark:text-blue-400">
                    {totalUnread}
                  </span>
                )}
              </p>
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingRead}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                  title={t("mark_all_read") || "Mark all as read"}
                >
                  <CheckCheck className="size-3.5" />
                  {t("mark_all_read") || "Mark all as read"}
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {allNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell className="size-8 text-[var(--muted-foreground)]/30 mb-3" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t("no_notifications") || "No notifications"}
                  </p>
                </div>
              ) : (
                allNotifs.map((notif) => {
                  const href =
                    orderHref && notif.data?.orderId
                      ? orderHref(notif.data.orderId)
                      : null;

                  return (
                    <div key={notif.id}>
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)} className="block">
                          <NotifItem
                            notif={notif}
                            onDismiss={notif._local ? onDismiss : null}
                            href={href}
                            t={t}
                          />
                        </Link>
                      ) : (
                        <NotifItem
                          notif={notif}
                          onDismiss={notif._local ? onDismiss : null}
                          href={null}
                          t={t}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

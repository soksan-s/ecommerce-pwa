"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BellRing, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Toast / popup banner for incoming online orders.
 */
export function OnlineOrderAlertPopup({
  alerts = [],
  onDismiss,
  lang = "en",
}) {
  if (!alerts || alerts.length === 0) return null;

  const isKm = lang === "km" || lang === "kh";

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-2xl border border-blue-500/30",
              "bg-[var(--surface-strong)] text-[var(--foreground)]",
              "shadow-2xl shadow-blue-500/10 backdrop-blur-xl p-4 ring-1 ring-blue-500/20"
            )}
            role="alert"
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />

            <div className="flex items-start gap-3">
              {/* Animated Icon */}
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30">
                <ShoppingBag className="size-5 animate-bounce" />
              </div>

              {/* Order Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    <BellRing className="size-2.5" />
                    {isKm ? "ការបញ្ជាទិញអនឡាញថ្មី" : "New Online Order"}
                  </span>
                </div>

                <p className="mt-1 text-sm font-bold text-[var(--foreground)] truncate">
                  #{alert.orderNumber}
                </p>

                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ${alert.total} {alert.currency} · {alert.itemCount} {isKm ? "មុខទំនិញ" : "items"}
                </p>

                {alert.customerName && (
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                    {isKm ? "អតិថិជន:" : "Customer:"} {alert.customerName}
                    {alert.customerPhone ? ` (${alert.customerPhone})` : ""}
                  </p>
                )}

                {/* Action Link */}
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={alert.viewHref || "/admin?tab=orders"}
                    onClick={() => onDismiss && onDismiss(alert.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--action)] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <span>{isKm ? "មើលការបញ្ជាទិញ" : "View Order"}</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => onDismiss && onDismiss(alert.id)}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

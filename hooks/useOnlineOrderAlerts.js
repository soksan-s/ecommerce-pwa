"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playOrderAlertSound } from "@/lib/client/order-alert-sound";

const SESSION_KEY = "seen_online_order_ids";

function getStoredSeenIds() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function storeSeenIds(seenSet) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(seenSet).slice(-200); // keep recent 200
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(arr));
  } catch {}
}

/**
 * Hook for detecting new online orders, playing audio, and displaying popups.
 * Baseline tracking ensures old orders on initial page load never trigger alerts.
 *
 * @param {object} options
 * @param {boolean} options.enabled - Whether polling is active (user is authenticated staff)
 * @param {string} options.role - User role
 * @param {number} options.pollInterval - Polling interval in ms (default 15000)
 * @param {string} options.viewHref - Target URL for "View Order" action
 */
export function useOnlineOrderAlerts({
  enabled = true,
  role = "ADMIN",
  pollInterval = 15000,
  viewHref = "/admin?tab=orders",
} = {}) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const seenIdsRef = useRef(getStoredSeenIds());
  const isInitialFetchRef = useRef(true);
  const isPollingRef = useRef(false);

  const dismissAlert = useCallback((orderId) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== orderId));
  }, []);

  const dismissAll = useCallback(() => {
    setActiveAlerts([]);
  }, []);

  const checkForNewOrders = useCallback(async () => {
    if (!enabled || isPollingRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    isPollingRef.current = true;
    try {
      // Fetch latest online orders
      const res = await fetch("/api/orders?channel=ONLINE", {
        cache: "no-store",
      });

      if (!res.ok) {
        isPollingRef.current = false;
        return;
      }

      const json = await res.json();
      const orders = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

      if (isInitialFetchRef.current) {
        // Initial load: record baseline without alerting
        orders.forEach((o) => {
          if (o?.id) seenIdsRef.current.add(String(o.id));
        });
        storeSeenIds(seenIdsRef.current);
        isInitialFetchRef.current = false;
        isPollingRef.current = false;
        return;
      }

      // Subsequent checks: look for newly created online orders
      const newOrders = [];
      for (const order of orders) {
        if (!order || !order.id) continue;
        const oId = String(order.id);
        const isOnline = !order.channel || order.channel === "ONLINE";

        if (isOnline && !seenIdsRef.current.has(oId)) {
          seenIdsRef.current.add(oId);
          newOrders.push(order);
        }
      }

      if (newOrders.length > 0) {
        storeSeenIds(seenIdsRef.current);

        // Play short synthesized notification chime
        playOrderAlertSound();

        // Add to active popup list
        const newAlertItems = newOrders.map((order) => {
          const items = Array.isArray(order.items) ? order.items : [];
          const itemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
          const customerName = order.user?.name || order.customer?.name || null;
          const customerPhone = order.user?.phoneNumber || order.customer?.phone || null;

          return {
            id: String(order.id),
            orderNumber: order.orderNumber || order.id,
            total: Number(order.total || 0).toFixed(2),
            currency: order.currency || "USD",
            customerName,
            customerPhone,
            itemCount,
            createdAt: order.createdAt || new Date().toISOString(),
            viewHref,
          };
        });

        setActiveAlerts((prev) => [...newAlertItems, ...prev].slice(0, 5));
      }
    } catch (err) {
      // Silently ignore network / polling errors
    } finally {
      isPollingRef.current = false;
    }
  }, [enabled, viewHref]);

  useEffect(() => {
    if (!enabled) return;

    // Run initial baseline check
    checkForNewOrders();

    // Set up polling interval
    const interval = setInterval(checkForNewOrders, pollInterval);

    // Refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForNewOrders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, pollInterval, checkForNewOrders]);

  return {
    activeAlerts,
    dismissAlert,
    dismissAll,
  };
}

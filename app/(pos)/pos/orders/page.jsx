"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { getAll } from "@/lib/db";

const mockTransactions = [
  {
    id: "TXN-MOCK-001",
    items: [{ productId: "rice-5kg", name: "Jasmine Rice 5kg", price: 7.8, qty: 1, stock: 12 }],
    total: 8.58,
    tax: 0.78,
    timestamp: "2026-01-01T09:00:00.000Z",
    synced: true,
  },
];

const queueActions = {
  pending: [
    { label: "Accept", status: "preparing" },
    { label: "Cancel", status: "cancelled" },
  ],
  confirmed: [
    { label: "Prepare", status: "preparing" },
    { label: "Cancel", status: "cancelled" },
  ],
  processing: [
    { label: "Prepare", status: "preparing" },
    { label: "Cancel", status: "cancelled" },
  ],
  preparing: [
    { label: "Ready", status: "ready" },
    { label: "Cancel", status: "cancelled" },
  ],
  ready: [
    { label: "Complete", status: "completed" },
    { label: "Cancel", status: "cancelled" },
  ],
};

function isToday(timestamp, todayKey) {
  return String(timestamp || "").slice(0, 10) === todayKey;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleTimeString();
}

export default function PosOrdersPage() {
  const { settings } = usePOSSettings();
  const [transactions, setTransactions] = useState(mockTransactions);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [queueMessage, setQueueMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  async function loadOnlineOrders() {
    try {
      const response = await fetch("/api/orders?channel=online", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload.data)) {
        setQueueMessage(payload.error || "Unable to load online orders.");
        return;
      }

      setOnlineOrders(payload.data);
      setQueueMessage("");
    } catch {
      setQueueMessage("Unable to load online orders.");
    }
  }

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      const todayKey = new Date().toISOString().slice(0, 10);
      const localTransactions = await getAll("transactions");
      const safeTransactions = Array.isArray(localTransactions) ? localTransactions : [];
      const todaysTransactions = safeTransactions.filter(
        (entry) => entry.type !== "stats" && isToday(entry.timestamp, todayKey),
      );

      if (active) {
        setTransactions(todaysTransactions.length ? todaysTransactions : []);
        setHydrated(true);
      }
    }

    loadTransactions();
    const onlineTimer = window.setTimeout(() => {
      loadOnlineOrders();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(onlineTimer);
    };
  }, []);

  const visibleTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (filter === "synced") {
        return transaction.synced;
      }

      if (filter === "pending") {
        return !transaction.synced;
      }

      return true;
    });
  }, [filter, transactions]);

  const queueOrders = useMemo(() => {
    return onlineOrders.filter((order) => !["completed", "cancelled", "delivered"].includes(order.status));
  }, [onlineOrders]);

  async function updateOrderStatus(orderId, status) {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        setQueueMessage(payload.error || "Unable to update order.");
        return;
      }

      setOnlineOrders((current) => current.map((order) => (order.id === orderId ? payload.data : order)));
      setQueueMessage("");
    } catch {
      setQueueMessage("Unable to update order.");
    }
  }

  return (
    <div className="space-y-5 transition-colors">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Orders</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">Online Queue &amp; Today&apos;s Transactions</h1>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-1 shadow-xs">
          {["all", "synced", "pending"].map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFilter(entry)}
              className={
                filter === entry
                  ? "rounded-lg bg-[var(--pos-action)] px-3 py-1.5 text-xs font-extrabold capitalize text-[var(--pos-action-fg)] shadow-xs transition-all"
                  : "rounded-lg px-3 py-1.5 text-xs font-bold capitalize text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              }
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3.5 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-extrabold text-[var(--foreground)]">Online Order Queue</h2>
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">{queueOrders.length} active online orders</p>
          </div>
          <button 
            type="button" 
            onClick={loadOnlineOrders} 
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {queueOrders.map((order) => (
            <article key={order.id} className="grid gap-4 px-4 py-3.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xs font-extrabold text-[var(--foreground)]">{order.id}</h3>
                  <span className="rounded-full bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--pos-action-on-muted)]">{order.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--muted-foreground)]">{order.shippingAddress}</p>
                <p className="mt-1 text-[11px] font-semibold text-[var(--muted-foreground)] opacity-75">{new Date(order.createdAt).toLocaleString()}</p>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(order.total, settings, false)}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  {(order.lines || []).map((line) => `${line.quantity} x ${line.productName}`).join(", ")}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 xl:justify-end">
                {(queueActions[order.status] || []).map((action) => (
                  <button
                    key={`${order.id}-${action.status}`}
                    type="button"
                    onClick={() => updateOrderStatus(order.id, action.status)}
                    className={
                      action.status === "cancelled"
                        ? "rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                        : "rounded-lg bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-3 py-1.5 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98]"
                    }
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}

          {!queueOrders.length ? (
            <div className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
              {queueMessage || "No active online orders."}
            </div>
          ) : null}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
        <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
          <h2 className="text-base font-extrabold text-[var(--foreground)]">Today&apos;s POS Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-xs">
            <thead className="bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2.5">Transaction ID</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {visibleTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                  <td className="px-4 py-2.5 font-bold font-mono text-[var(--foreground)]">{transaction.id}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--muted-foreground)]">
                    {hydrated ? formatTime(transaction.timestamp) : "--"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                    {(transaction.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(transaction.total, settings, false)}</td>
                  <td className="px-4 py-2.5 font-bold">
                    {transaction.synced ? (
                      <span className="text-[var(--pos-action)]">Yes</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
              {!visibleTransactions.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
                    No transactions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

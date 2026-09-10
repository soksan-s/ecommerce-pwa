"use client";

import { CheckCircle2, Clock, Eye, FileText, MapPin, Phone, Printer, RefreshCw, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { formatPrimaryMoney } from "@/components/pos/format";
import { OrderDeliveryMap } from "@/components/shared/OrderDeliveryMap";
import { OrderPrintView } from "@/components/shared/OrderPrintView";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { getAll } from "@/lib/db";
import { cn } from "@/lib/utils";

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
    { label: "Accept", status: "CONFIRMED" },
    { label: "Reject", status: "CANCELLED", variant: "danger" },
  ],
  confirmed: [
    { label: "Prepare", status: "PREPARING" },
    { label: "Cancel", status: "CANCELLED", variant: "danger" },
  ],
  processing: [
    { label: "Prepare", status: "PREPARING" },
    { label: "Cancel", status: "CANCELLED", variant: "danger" },
  ],
  preparing: [
    { label: "Mark Ready", status: "READY" },
    { label: "Cancel", status: "CANCELLED", variant: "danger" },
  ],
  ready: [
    { label: "Dispatch / Ship", status: "SHIPPED" },
    { label: "Delivered", status: "DELIVERED" },
  ],
  shipped: [
    { label: "Mark Delivered", status: "DELIVERED" },
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

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
    return onlineOrders.filter((order) => !["completed", "cancelled", "delivered"].includes(String(order.status).toLowerCase()));
  }, [onlineOrders]);

  async function updateOrderStatus(orderId, status) {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: status.toUpperCase() }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        setQueueMessage(payload.error || "Unable to update order.");
        return;
      }

      setOnlineOrders((current) => current.map((order) => (order.id === orderId ? payload.data : order)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(payload.data);
      }
      setQueueMessage("");
    } catch {
      setQueueMessage("Unable to update order.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5 transition-colors">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">POS Orders</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">Online Order Receiving &amp; POS Queue</h1>
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

      {/* Online Order Queue Section */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3.5 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-extrabold text-[var(--foreground)]">Online Order Receiving Queue</h2>
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">{queueOrders.length} active orders pending fulfillment</p>
          </div>
          <button 
            type="button" 
            onClick={loadOnlineOrders} 
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Refresh Queue
          </button>
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {queueOrders.map((order) => {
            const customerName = order.customer?.name || order.user?.name || "Online Customer";
            const customerPhone = order.customer?.phone || order.user?.phone || "";
            const currentStatus = String(order.status).toLowerCase();
            const actions = queueActions[currentStatus] || [];

            return (
              <article key={order.id} className="grid gap-4 px-4 py-3.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-center hover:bg-[var(--surface-quiet)]/40 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xs font-extrabold text-[var(--foreground)]">{order.orderNumber || order.id}</h3>
                    <span className="rounded-full bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--pos-action-on-muted)]">
                      {order.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1 font-semibold text-[var(--foreground)]">
                      <User className="size-3 text-[var(--pos-action)]" />
                      {customerName}
                    </span>
                    {customerPhone ? (
                      <a href={`tel:${customerPhone}`} className="flex items-center gap-1 hover:text-[var(--pos-action)]">
                        <Phone className="size-3 text-[var(--pos-action)]" />
                        {customerPhone}
                      </a>
                    ) : null}
                  </div>

                  <p className="line-clamp-1 text-xs font-medium text-[var(--muted-foreground)]">
                    <MapPin className="inline size-3 mr-1 text-[var(--muted-foreground)]" />
                    {order.shippingAddress || order.delivery?.address || "Store Pickup"}
                  </p>
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(order.total, settings, false)}</p>
                  <p className="line-clamp-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                    {(order.items || order.lines || []).map((line) => `${line.quantity}x ${line.productName || line.variantName}`).join(", ")}
                  </p>
                  <p className="text-[10px] font-semibold text-[var(--muted-foreground)]">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <OrderPrintView order={order} />

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
                  >
                    <Eye className="size-3.5 text-[var(--muted-foreground)]" />
                    View & Map
                  </button>

                  {actions.map((action) => (
                    <button
                      key={`${order.id}-${action.status}`}
                      type="button"
                      disabled={actionLoading}
                      onClick={() => updateOrderStatus(order.id, action.status)}
                      className={
                        action.variant === "danger"
                          ? "rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50"
                          : "rounded-lg bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-3 py-1.5 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                      }
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}

          {!queueOrders.length ? (
            <div className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
              {queueMessage || "No active online orders right now."}
            </div>
          ) : null}
        </div>
      </section>

      {/* Complete Order Detail & Map Modal */}
      <AnimatePresence>
        {selectedOrder ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-[var(--foreground)]">{selectedOrder.orderNumber || selectedOrder.id}</span>
                  <span className="rounded-full bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--pos-action-on-muted)]">
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <OrderPrintView order={selectedOrder} />
                  <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-lg p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Customer Details & Actions */}
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--foreground)]">
                      {selectedOrder.customer?.name || selectedOrder.user?.name || "Customer"}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {selectedOrder.customer?.phone || selectedOrder.user?.phone ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--muted-foreground)]">Phone:</span>
                      <a href={`tel:${selectedOrder.customer?.phone || selectedOrder.user?.phone}`} className="inline-flex items-center gap-1 font-bold text-[var(--pos-action)] hover:underline">
                        <Phone className="size-3" />
                        {selectedOrder.customer?.phone || selectedOrder.user?.phone}
                      </a>
                    </div>
                  ) : null}

                  <div>
                    <span className="text-[var(--muted-foreground)]">Payment: </span>
                    <strong className="text-[var(--foreground)]">{selectedOrder.paymentMethod || "COD"}</strong> ({String(selectedOrder.paymentStatus || "PENDING").toUpperCase()})
                  </div>
                </div>

                {/* Delivery Map */}
                <div>
                  <p className="mb-1.5 font-bold uppercase tracking-wider text-[10px] text-[var(--muted-foreground)]">Delivery Location</p>
                  <OrderDeliveryMap
                    lat={selectedOrder.delivery?.lat}
                    lng={selectedOrder.delivery?.lng}
                    address={selectedOrder.shippingAddress || selectedOrder.delivery?.address}
                    deliveryNote={selectedOrder.note || selectedOrder.delivery?.note}
                    driver={selectedOrder.delivery?.driver}
                    status={selectedOrder.status}
                  />
                </div>

                {/* Ordered Items Table */}
                <div>
                  <p className="mb-1.5 font-bold uppercase tracking-wider text-[10px] text-[var(--muted-foreground)]">Order Items</p>
                  <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
                    <table className="w-full text-left">
                      <thead className="bg-[var(--surface-soft)] uppercase text-[10px] text-[var(--muted-foreground)]">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-soft)]">
                        {(selectedOrder.items || selectedOrder.lines || []).map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td className="px-3 py-2 font-medium">
                              <p className="text-[var(--foreground)]">{item.productName || item.variantName}</p>
                              {item.variantName && item.variantName !== "Default" && item.variantName !== item.productName ? (
                                <p className="text-[10px] text-[var(--muted-foreground)]">{item.variantName}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-[var(--foreground)]">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-[var(--muted-foreground)]">${Number(item.unitPrice || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-bold text-[var(--foreground)]">
                              ${Number(item.lineTotal || item.quantity * item.unitPrice || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-[var(--muted-foreground)]">
                    <span>Subtotal:</span>
                    <span>${Number(selectedOrder.subtotal || selectedOrder.total || 0).toFixed(2)}</span>
                  </div>
                  {selectedOrder.shippingFee ? (
                    <div className="flex justify-between text-[var(--muted-foreground)]">
                      <span>Shipping Fee:</span>
                      <span>${Number(selectedOrder.shippingFee).toFixed(2)}</span>
                    </div>
                  ) : null}
                  {selectedOrder.couponDiscount ? (
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Discount ({selectedOrder.couponCode || "Promo"}):</span>
                      <span>-${Number(selectedOrder.couponDiscount).toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-[var(--border-soft)] pt-1.5 flex justify-between font-extrabold text-sm text-[var(--foreground)]">
                    <span>Grand Total:</span>
                    <span className="text-[var(--pos-action)]">{formatPrimaryMoney(selectedOrder.total, settings, false)}</span>
                  </div>
                </div>

                {/* Order Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-soft)]">
                  {["CONFIRMED", "PREPARING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"].map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      disabled={actionLoading || String(selectedOrder.status).toUpperCase() === statusOption}
                      onClick={() => updateOrderStatus(selectedOrder.id, statusOption)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40",
                        statusOption === "DELIVERED"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : statusOption === "CANCELLED"
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                      )}
                    >
                      {statusOption === "CONFIRMED" ? "Accept Order" : statusOption === "PREPARING" ? "Prepare" : statusOption === "READY" ? "Mark Ready" : statusOption === "SHIPPED" ? "Dispatch" : statusOption === "DELIVERED" ? "Delivered" : "Cancel"}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* POS Transactions Section */}
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
                  <td className="px-4 py-2.5 font-bold font-mono text-[var(--foreground)]">{transaction.receiptNumber || transaction.id}</td>
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

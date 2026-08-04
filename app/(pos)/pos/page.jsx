"use client";

import { DollarSign, Package, RefreshCw, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { formatPrimaryMoney } from "@/components/pos/format";
import { getAll, put } from "@/lib/db";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { usePosStore } from "@/store/posStore";

const todayKey = new Date().toISOString().slice(0, 10);
const fallbackStats = {
  revenue: 0,
  transactions: 0,
  itemsSold: 0,
  pendingSync: 0,
};

function calculateStatsFromTransactions(transactions) {
  const todaysTransactions = transactions.filter(
    (entry) => entry.type !== "stats" && String(entry.timestamp || "").slice(0, 10) === todayKey,
  );

  return {
    revenue: todaysTransactions.reduce((sum, entry) => sum + Number(entry.total || 0), 0),
    transactions: todaysTransactions.length,
    itemsSold: todaysTransactions.reduce(
      (sum, entry) => sum + (entry.items || []).reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0),
      0,
    ),
    pendingSync: todaysTransactions.filter((entry) => !entry.synced).length,
  };
}

export default function PosDashboardPage() {
  const { isOnline, isOffline } = useOffline();
  const { settings } = usePOSSettings();
  const pendingSyncCount = usePosStore((state) => state.pendingSyncCount);
  const setPendingSyncCount = usePosStore((state) => state.setPendingSyncCount);
  const [stats, setStats] = useState(fallbackStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      setLoading(true);
      const transactions = await getAll("transactions");
      const localStats = calculateStatsFromTransactions(transactions);
      const queued = await getAll("offline_queue");
      setPendingSyncCount(queued.length);

      if (active) {
        setStats({ ...localStats, pendingSync: queued.length });
      }

      if (isOnline) {
        try {
          const response = await fetch("/api/pos/stats", { cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            const nextStats = data.data || data;
            await put("transactions", {
              id: `stats-${todayKey}`,
              type: "stats",
              date: todayKey,
              ...nextStats,
              pendingSync: queued.length,
            });

            if (active) {
              setStats({ ...nextStats, pendingSync: queued.length });
            }
          }
        } catch {
          // Keep local IndexedDB stats when the backend is unavailable.
        }
      }

      if (active) {
        setLoading(false);
      }
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [isOnline, setPendingSyncCount]);

  const cards = [
    { label: "Today's Revenue", value: formatPrimaryMoney(stats.revenue, settings, false), icon: DollarSign },
    { label: "Transactions", value: Number(stats.transactions || 0).toLocaleString(), icon: ShoppingBag },
    { label: "Items Sold", value: Number(stats.itemsSold || 0).toLocaleString(), icon: Package },
    { label: "Pending Sync", value: Number(pendingSyncCount || stats.pendingSync || 0).toLocaleString(), icon: RefreshCw },
  ];

  return (
    <div className="space-y-6 transition-colors">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Dashboard</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)]">POS Overview</h1>
      </div>

      {pendingSyncCount > 0 ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs font-bold text-amber-900 dark:text-amber-300 shadow-xs">
          {pendingSyncCount} sales pending sync — will upload automatically when online.
        </div>
      ) : null}

      {isOffline ? (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] shadow-xs">
          Offline mode: dashboard stats are loaded from local transactions.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.label} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs transition-all hover:border-[var(--pos-action)]/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--muted-foreground)]">{card.label}</p>
                <div className="grid size-8 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--pos-action)]">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {loading ? (
                  <div className="h-8 w-28 animate-pulse rounded-md bg-[var(--surface-soft)]" />
                ) : (
                  <p className="text-2xl font-black tracking-tight text-[var(--foreground)]">{card.value}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

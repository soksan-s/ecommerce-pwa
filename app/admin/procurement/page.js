"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Receipt } from "lucide-react";

export default function ProcurementPage() {
  const router = useRouter();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPOs();
  }, []);

  async function loadPOs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/procurement/po");
      if (res.ok) {
        const { data } = await res.json();
        setPos(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case "DRAFT":
        return "bg-zinc-100 text-zinc-700";
      case "APPROVED":
        return "bg-sky-100 text-sky-700";
      case "RECEIVED":
        return "bg-emerald-100 text-emerald-700";
      case "CANCELLED":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-zinc-100 text-zinc-700";
    }
  }

  return (
    <main className="app-shell min-h-screen bg-[var(--background-start)]">
      <header className="app-bar flex items-center gap-4 px-5 py-4">
        <button onClick={() => router.push("/admin?tab=inventory")} className="app-icon-button p-2">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Purchase Orders</h1>
      </header>

      <section className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">All Orders</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage and receive stock from suppliers.</p>
          </div>
          <Link
            href="/admin/procurement/new"
            className="flex items-center gap-2 rounded-xl bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
          >
            <Plus className="size-4" />
            New PO
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Loading...</div>
        ) : (
          <div className="grid gap-4">
            {pos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-[var(--muted-foreground)]">
                No purchase orders found.
              </div>
            ) : (
              pos.map((po) => (
                <Link
                  key={po.id}
                  href={`/admin/procurement/${po.id}`}
                  className="flex flex-col gap-4 rounded-[1.2rem] bg-[var(--surface)] p-5 sm:flex-row sm:items-center justify-between shadow-sm border border-white/20 transition hover:bg-[color-mix(in_srgb,var(--action)_4%,var(--surface))]"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-[var(--surface-quiet)] p-3">
                      <Receipt className="size-5 text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-[var(--foreground)]">{po.poNumber}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)]">Supplier: {po.supplier?.name || "Unknown"}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{new Date(po.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Total</span>
                    <span className="font-medium">${Number(po.totalAmount).toFixed(2)}</span>
                    <span className="block mt-1 text-xs text-[var(--muted-foreground)]">{po.items?.length || 0} items</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, PackageOpen, Trash2 } from "lucide-react";

export default function PurchaseOrderDetailPage({ params }) {
  const router = useRouter();
  const [poId, setPoId] = useState("");
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setPoId(p.id);
      loadPO(p.id);
    });
  }, [params]);

  async function loadPO(id) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/procurement/po/${id}`);
      if (res.ok) {
        const { data } = await res.json();
        setPo(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!confirm("Approve this purchase order?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/procurement/po/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" })
      });
      if (res.ok) {
        loadPO(poId);
      } else {
        alert("Failed to approve PO");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReceive() {
    if (!confirm("Receive items for this purchase order? This will update inventory.")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/procurement/po/${poId}/receive`, {
        method: "POST"
      });
      if (res.ok) {
        loadPO(poId);
      } else {
        alert("Failed to receive PO");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }
  
  async function handleDelete() {
    if (!confirm("Delete this draft purchase order?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/procurement/po/${poId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        router.push("/admin/procurement");
      } else {
        const data = await res.json();
        alert(data.error?.message || "Failed to delete PO");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !po) {
    return <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Loading...</div>;
  }

  return (
    <main className="app-shell min-h-screen bg-[var(--background-start)]">
      <header className="app-bar flex items-center gap-4 px-5 py-4">
        <button onClick={() => router.push("/admin/procurement")} className="app-icon-button p-2">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">{po.poNumber}</h1>
        <div className="ml-auto flex gap-2">
          {po.status === "DRAFT" && (
            <>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
              >
                <Trash2 className="size-4" /> Delete
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-xl bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
              >
                <CheckCircle className="size-4" /> Approve
              </button>
            </>
          )}
          {po.status === "APPROVED" && (
            <button
              onClick={handleReceive}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <PackageOpen className="size-4" /> Receive Items
            </button>
          )}
        </div>
      </header>

      <section className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-[1fr_300px]">
          
          <div className="space-y-6">
            <div className="rounded-[1.2rem] bg-[var(--surface)] p-6 shadow-sm border border-white/20">
              <h2 className="mb-4 text-lg font-semibold">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border-soft)]">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Variant ID</th>
                      <th className="pb-3 pr-4 font-medium text-right">Ordered</th>
                      <th className="pb-3 pr-4 font-medium text-right">Received</th>
                      <th className="pb-3 pr-4 font-medium text-right">Unit Cost</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {po.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-4 pr-4">
                           <div className="font-semibold">{item.variantId}</div>
                        </td>
                        <td className="py-4 pr-4 text-right font-medium">{item.orderedQty}</td>
                        <td className="py-4 pr-4 text-right font-medium">{item.receivedQty}</td>
                        <td className="py-4 pr-4 text-right">${Number(item.unitCost).toFixed(2)}</td>
                        <td className="py-4 text-right font-semibold">${Number(item.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {po.note && (
              <div className="rounded-[1.2rem] bg-[var(--surface)] p-6 shadow-sm border border-white/20">
                <h2 className="mb-2 text-lg font-semibold">Notes</h2>
                <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{po.note}</p>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div className="rounded-[1.2rem] bg-[var(--surface)] p-6 shadow-sm border border-white/20">
              <h2 className="mb-4 text-lg font-semibold">Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Status</span>
                  <span className="font-semibold">{po.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Supplier</span>
                  <span className="font-semibold">{po.supplier?.name || po.supplierId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Branch</span>
                  <span className="font-semibold">{po.branch?.name || po.branchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Expected</span>
                  <span className="font-semibold">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "TBD"}</span>
                </div>
                <div className="pt-4 mt-4 border-t border-[var(--border-soft)] flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">${Number(po.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {po.receipts && po.receipts.length > 0 && (
              <div className="rounded-[1.2rem] bg-[var(--surface)] p-6 shadow-sm border border-white/20">
                <h2 className="mb-4 text-lg font-semibold">Receipts</h2>
                <div className="space-y-3">
                  {po.receipts.map(receipt => (
                    <div key={receipt.id} className="p-3 rounded-lg bg-[var(--surface-quiet)] text-sm">
                      <div className="font-semibold">{receipt.grNumber}</div>
                      <div className="text-[var(--muted-foreground)] mt-1">{new Date(receipt.receivedDate).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
        </div>
      </section>
    </main>
  );
}

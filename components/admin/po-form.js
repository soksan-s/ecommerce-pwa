"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";

export function PurchaseOrderForm({ initialData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [variants, setVariants] = useState([]);
  
  const [form, setForm] = useState({
    supplierId: initialData?.supplierId || "",
    branchId: initialData?.branchId || "",
    note: initialData?.note || "",
    expectedDate: initialData?.expectedDate ? new Date(initialData.expectedDate).toISOString().split('T')[0] : "",
    items: initialData?.items?.map(item => ({
      variantId: item.variantId,
      quantity: item.orderedQty,
      costPrice: item.unitCost,
    })) || [],
  });

  useEffect(() => {
    // We fetch related data to populate dropdowns
    // Since we don't have distinct endpoints for these yet, we will just simulate them 
    // or fetch from where they are available.
    // For this boilerplate, we assume they exist or we fallback to empty.
    fetch('/api/admin/suppliers').then(res => res.ok && res.json()).then(data => setSuppliers(data?.data || [])).catch(() => {});
    fetch('/api/admin/branches').then(res => res.ok && res.json()).then(data => setBranches(data?.data || [])).catch(() => {});
    
    // We could fetch all products and their variants
    fetch('/api/admin/products').then(res => res.ok && res.json()).then(data => {
       // Since the endpoint returns products, we might need a variant specific endpoint.
       // For now, this is a placeholder.
    }).catch(() => {});
  }, []);

  function update(field, value) {
    setForm(curr => ({ ...curr, [field]: value }));
  }

  function addItem() {
    setForm(curr => ({
      ...curr,
      items: [...curr.items, { variantId: "", quantity: 1, costPrice: 0 }]
    }));
  }

  function updateItem(index, field, value) {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm(curr => ({ ...curr, items: newItems }));
  }

  function removeItem(index) {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm(curr => ({ ...curr, items: newItems }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplierId || !form.branchId || form.items.length === 0) {
      setError("Please select a supplier, a branch, and at least one item.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = initialData 
        ? `/api/admin/procurement/po/${initialData.id}` 
        : `/api/admin/procurement/po`;
        
      const res = await fetch(url, {
        method: initialData ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        router.push("/admin/procurement");
      } else {
        const body = await res.json();
        setError(body.error?.message || "Failed to save purchase order");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  const subtotal = form.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.costPrice)), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600 border border-rose-200">{error}</div>}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Supplier *</span>
          <select 
            required
            value={form.supplierId} 
            onChange={(e) => update("supplierId", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm bg-white"
          >
            <option value="">Select a supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Branch *</span>
          <select 
            required
            value={form.branchId} 
            onChange={(e) => update("branchId", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm bg-white"
          >
            <option value="">Select a branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Expected Date</span>
          <input 
            type="date"
            value={form.expectedDate} 
            onChange={(e) => update("expectedDate", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Items</h3>
          <button 
            type="button" 
            onClick={addItem}
            className="flex items-center gap-1 rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold shadow-sm border border-[var(--border-soft)]"
          >
            <Plus className="size-3" /> Add Item
          </button>
        </div>
        
        {form.items.length === 0 ? (
           <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
             No items added yet. Click &quot;Add Item&quot; to begin.
           </div>
        ) : (
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-soft)]">
                <div className="flex-1 min-w-[200px]">
                  <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">Variant ID</span>
                  <input
                    required
                    value={item.variantId}
                    onChange={(e) => updateItem(idx, "variantId", e.target.value)}
                    placeholder="Variant ID (e.g. from Products tab)"
                    className="app-input w-full px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="w-24">
                  <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">Qty</span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    className="app-input w-full px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="w-32">
                  <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">Unit Cost</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.costPrice}
                    onChange={(e) => updateItem(idx, "costPrice", e.target.value)}
                    className="app-input w-full px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="w-24 pt-4 text-right">
                  <span className="font-semibold text-sm">${(Number(item.quantity) * Number(item.costPrice)).toFixed(2)}</span>
                </div>
                <div className="pt-4">
                  <button type="button" onClick={() => removeItem(idx)} className="app-icon-button p-2 text-rose-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {form.items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="text-right w-64 rounded-xl bg-[var(--surface)] p-4 border border-[var(--border-soft)] shadow-sm">
              <span className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Subtotal</span>
              <span className="block text-xl font-bold text-[var(--foreground)]">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
      
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Notes</span>
        <textarea 
          value={form.note} 
          onChange={(e) => update("note", e.target.value)}
          className="app-input min-h-24 w-full px-3 py-2 text-sm"
          placeholder="Any instructions for the supplier..."
        />
      </label>

      <div className="flex gap-4 pt-4">
        <button 
          type="button" 
          onClick={() => router.push("/admin/procurement")}
          disabled={loading}
          className="rounded-xl border border-[var(--border-soft)] px-6 py-2.5 font-semibold text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
        >
          Cancel
        </button>
        <button 
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--action)] px-6 py-2.5 font-semibold text-[var(--action-foreground)]"
        >
          <Save className="size-4" />
          {loading ? "Saving..." : (initialData ? "Update PO" : "Create PO")}
        </button>
      </div>
    </form>
  );
}

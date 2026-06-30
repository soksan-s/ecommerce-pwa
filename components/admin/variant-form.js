"use client";

import { useState } from "react";

export function VariantForm({ productId, initialData, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sku: initialData?.sku || "",
    name: initialData?.name || "",
    price: initialData?.price || "0",
    costPrice: initialData?.costPrice || "0",
    wholesalePrice: initialData?.wholesalePrice || "0",
    vipPrice: initialData?.vipPrice || "0",
    barcode: initialData?.barcode || "",
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        wholesalePrice: Number(form.wholesalePrice),
        vipPrice: Number(form.vipPrice),
      };

      const url = initialData
        ? `/api/admin/products/${productId}/variants/${initialData.id}`
        : `/api/admin/products/${productId}/variants`;

      const res = await fetch(url, {
        method: initialData ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const body = await res.json();
        setError(body.error?.message || "Failed to save variant");
      }
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600 border border-rose-200">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
            placeholder="e.g. Large, Red"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">SKU *</span>
          <input
            required
            value={form.sku}
            onChange={(e) => update("sku", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
            placeholder="Unique SKU"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Retail Price *</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Cost Price</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.costPrice}
            onChange={(e) => update("costPrice", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Wholesale Price</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.wholesalePrice}
            onChange={(e) => update("wholesalePrice", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">VIP Price</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.vipPrice}
            onChange={(e) => update("vipPrice", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 block md:col-span-2">
          <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Barcode</span>
          <input
            value={form.barcode}
            onChange={(e) => update("barcode", e.target.value)}
            className="app-input w-full px-3 py-2 text-sm"
            placeholder="Scan or enter barcode"
          />
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-xl border border-[var(--border-soft)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
        >
          {loading ? "Saving..." : "Save Variant"}
        </button>
      </div>
    </form>
  );
}

"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";

import { convertMoney, formatMoney } from "@/components/pos/format";

const emptyProduct = {
  id: "",
  name: "",
  sku: "",
  description: "",
  category: "Beverages",
  price: 0,
  stock: 0,
  lowStockThreshold: 5,
  unit: "pcs",
  image: "",
  isActive: true,
};

function createProductId() {
  return `prd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function generateSku() {
  return `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--pos-action)] focus:bg-[var(--surface-strong)] placeholder:text-[var(--muted-foreground)]";

const labelCls = "text-xs font-bold text-[var(--foreground)]";

export function ProductFormModal({ open, mode = "add", product, categories = [], exchangeRate = 4100, onClose, onSave }) {
  const [form, setForm] = useState(emptyProduct);
  const [newCategory, setNewCategory] = useState("");
  const [overrideSecondary, setOverrideSecondary] = useState(false);
  const [priceSecondary, setPriceSecondary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextForm = {
      ...emptyProduct,
      ...(product || {}),
      id: product?.id || createProductId(),
      sku: product?.sku || "",
      price: Number(product?.price || 0),
      stock: Number(product?.stock || 0),
      lowStockThreshold: Number(product?.lowStockThreshold || 5),
      image: product?.image || product?.imageUrl || "",
      isActive: product?.isActive !== false,
    };

    setForm(nextForm);
    setNewCategory("");
    setOverrideSecondary(false);
    setPriceSecondary("");
    setError("");
  }, [open, product]);

  const categoryOptions = useMemo(() => {
    return [...new Set(["Beverages", "Snacks", "Grocery", "Noodles", "Sauce", ...categories])];
  }, [categories]);

  const secondaryCurrency = "KHR";
  const calculatedSecondary = formatMoney(
    convertMoney(form.price, "USD", secondaryCurrency, exchangeRate),
    secondaryCurrency,
    exchangeRate,
    false,
  );

  function patch(values) {
    setForm((current) => ({ ...current, ...values }));
  }

  function handleImageUpload(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => patch({ image: reader.result });
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!Number(form.price)) {
      setError("Price in USD is required.");
      return;
    }

    setSaving(true);
    setError("");

    const finalCategory = form.category === "__new" ? newCategory.trim() : form.category;
    if (!finalCategory) {
      setError("Category is required.");
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      category: finalCategory,
      sku: form.sku || generateSku(),
      price:
        overrideSecondary && priceSecondary
          ? convertMoney(Number(priceSecondary), secondaryCurrency, "USD", exchangeRate)
          : Number(form.price),
      stock: Number(form.stock || 0),
      lowStockThreshold: Number(form.lowStockThreshold || 0),
      updatedAt: new Date().toISOString(),
      createdAt: form.createdAt || new Date().toISOString(),
    };

    await onSave(payload, mode);
    setSaving(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-2xl text-[var(--foreground)] transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--pos-action)]">
              {mode === "add" ? "Add Product" : "Edit Product"}
            </p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[var(--foreground)]">Product Details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
          {/* Image panel */}
          <section>
            <div
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] bg-cover bg-center text-4xl font-black text-[var(--muted-foreground)]"
              style={form.image ? { backgroundImage: `url(${form.image})` } : undefined}
            >
              {form.image ? null : form.name.charAt(0).toUpperCase() || "P"}
            </div>
            <label className="mt-3 block cursor-pointer rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-center text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors">
              Upload Image
              <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event.target.files?.[0])} className="hidden" />
            </label>
            {form.image ? (
              <button
                type="button"
                onClick={() => patch({ image: "" })}
                className="mt-2 w-full text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
              >
                Remove Image
              </button>
            ) : null}
          </section>

          {/* Fields panel */}
          <section className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Product Name*</label>
                <input
                  value={form.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>SKU</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={form.sku}
                    onChange={(event) => patch({ sku: event.target.value })}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ sku: generateSku() })}
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
                  >
                    Auto
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={form.category}
                  onChange={(event) => patch({ category: event.target.value })}
                  className={inputCls}
                >
                  {categoryOptions.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                  <option value="__new">+ New Category</option>
                </select>
              </div>
              {form.category === "__new" ? (
                <div className="md:col-span-2">
                  <label className={labelCls}>New Category</label>
                  <input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    className={inputCls}
                  />
                </div>
              ) : null}
              <div className="md:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  className={`${inputCls} min-h-20 resize-none`}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Price in USD*</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) => patch({ price: Number(event.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Price in {secondaryCurrency}</label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted-foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideSecondary}
                      onChange={(event) => setOverrideSecondary(event.target.checked)}
                      className="accent-[var(--pos-action)]"
                    />
                    Override
                  </label>
                </div>
                <input
                  value={overrideSecondary ? priceSecondary : calculatedSecondary}
                  onChange={(event) => setPriceSecondary(event.target.value)}
                  readOnly={!overrideSecondary}
                  className={`${inputCls} read-only:opacity-60`}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>Current Stock*</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(event) => patch({ stock: Number(event.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Low Stock Alert</label>
                <input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(event) => patch({ lowStockThreshold: Number(event.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <input
                  value={form.unit}
                  onChange={(event) => patch({ unit: event.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
              <span className="text-xs font-bold text-[var(--foreground)]">Active</span>
              <button
                type="button"
                onClick={() => patch({ isActive: !form.isActive })}
                className={`h-7 w-12 rounded-full p-[3px] transition-colors ${form.isActive ? "bg-[var(--pos-action)]" : "bg-[var(--border-soft)]"}`}
                aria-pressed={form.isActive}
              >
                <span
                  className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-2.5 text-xs font-extrabold text-[var(--pos-action-fg)] disabled:opacity-40 transition-all active:scale-[0.98] shadow-xs"
              >
                {saving ? "Saving..." : "Save Product"}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

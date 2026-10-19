"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Layers,
  Plus,
  ScanBarcode,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { convertMoney, formatMoney } from "@/components/pos/format";
import { BarcodeScannerModal, useCameraBarcodeScanner } from "@/components/shared/barcode-scanner";

const emptyProduct = {
  id: "",
  name: "",
  sku: "",
  barcode: "",
  description: "",
  category: "Beverages",
  price: 0,
  wholesalePrice: 0,
  stock: 0,
  lowStockThreshold: 5,
  unit: "pcs",
  image: "",
  isActive: true,
  isVariant: false,
};

function createProductId() {
  return `prd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function generateSku(prefix = "PRD") {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateBarcode() {
  return `20${Math.floor(1000000000 + Math.random() * 9000000000)}`;
}

function createVariantItem(productSku = "", index = 1, basePrice = 0) {
  const suffix = ["S", "M", "L", "XL", "Pack"][index - 1] || `V${index}`;
  return {
    id: `var-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: "",
    sku: productSku ? `${productSku}-${suffix}` : generateSku("VAR"),
    barcode: "",
    price: basePrice > 0 ? basePrice : 0,
    wholesalePrice: 0,
    stock: 0,
    isActive: true,
  };
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--pos-action)] focus:bg-[var(--surface-strong)] placeholder:text-[var(--muted-foreground)]";

const labelCls = "text-xs font-bold text-[var(--foreground)]";

export function ProductFormModal({
  open,
  mode = "add",
  product,
  categories = [],
  exchangeRate = 4100,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(emptyProduct);
  const [variants, setVariants] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [overrideSecondary, setOverrideSecondary] = useState(false);
  const [priceSecondary, setPriceSecondary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Scan target: "product" | index of variant
  const scanTargetRef = useRef(null);

  const handleBarcodeDetected = useCallback((detectedCode) => {
    if (!detectedCode) return;
    const clean = String(detectedCode).trim();
    if (!clean) return;

    const target = scanTargetRef.current;
    if (target === "product") {
      setForm((cur) => ({ ...cur, barcode: clean }));
    } else if (typeof target === "number") {
      setVariants((cur) => {
        const next = [...cur];
        if (next[target]) {
          next[target] = { ...next[target], barcode: clean };
        }
        return next;
      });
    }
  }, []);

  const scanner = useCameraBarcodeScanner({ onDetected: handleBarcodeDetected });

  function openScannerFor(target) {
    scanTargetRef.current = target;
    scanner.openScanner();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const isMultiVariant = Boolean(
      product?.isVariant &&
      Array.isArray(product?.variants) &&
      product.variants.length > 0 &&
      !(product.variants.length === 1 && (product.variants[0].name === "Default" || product.variants[0].name === "Standard"))
    );

    const initialPrice = Number(
      (product?.retailPrice !== undefined && product?.retailPrice !== null && product?.retailPrice !== ""
        ? product.retailPrice
        : product?.price) || 0
    );
    const initialWholesale = Number(
      (product?.wholesalePrice !== undefined && product?.wholesalePrice !== null && product?.wholesalePrice !== ""
        ? product.wholesalePrice
        : 0)
    );

    const initialVariants =
      Array.isArray(product?.variants) && product.variants.length > 0
        ? product.variants.map((v, i) => ({
            id: v.id || `var-${Date.now()}-${i}`,
            name: v.name || "",
            sku: v.sku || "",
            barcode: v.barcode || "",
            price: Number(v.retailPrice ?? v.price ?? initialPrice),
            wholesalePrice: Number(
              v.wholesalePrice !== undefined && v.wholesalePrice !== null && Number(v.wholesalePrice) > 0
                ? v.wholesalePrice
                : initialWholesale
            ),
            stock: Number(v.stock ?? 0),
            isActive: v.isActive !== false,
          }))
        : [];

    const nextForm = {
      ...emptyProduct,
      ...(product || {}),
      id: product?.id || createProductId(),
      name: product?.name || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      category: product?.category || "Beverages",
      description: product?.description || "",
      price: initialPrice,
      wholesalePrice: initialWholesale,
      stock: Number(product?.stock || 0),
      lowStockThreshold: Number(product?.lowStockThreshold || product?.minStockAlert || 5),
      unit: product?.unit || "pcs",
      image: product?.image || product?.imageUrl || "",
      isActive: product?.isActive !== false,
      isVariant: isMultiVariant,
    };

    setForm(nextForm);
    setVariants(initialVariants);
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

  function handleToggleVariant(checked) {
    patch({ isVariant: checked });
    if (checked && variants.length === 0) {
      // Initialize with a first variant based on the product
      setVariants([
        {
          id: `var-${Date.now()}-1`,
          name: "Standard",
          sku: form.sku ? `${form.sku}-STD` : generateSku("VAR"),
          barcode: form.barcode || "",
          price: Number(form.price || 0),
          wholesalePrice: Number(form.wholesalePrice || 0),
          stock: Number(form.stock || 0),
          isActive: true,
        },
      ]);
    }
  }

  function addVariant() {
    const nextIndex = variants.length + 1;
    const basePrice = variants[0]?.price || form.price || 0;
    setVariants((current) => [
      ...current,
      createVariantItem(form.sku, nextIndex, Number(basePrice)),
    ]);
  }

  function updateVariant(index, patchValues) {
    setVariants((current) => {
      const next = [...current];
      if (next[index]) {
        next[index] = { ...next[index], ...patchValues };
      }
      return next;
    });
  }

  function removeVariant(index) {
    setVariants((current) => current.filter((_, i) => i !== index));
  }

  const totalVariantStock = useMemo(() => {
    if (!form.isVariant) return Number(form.stock || 0);
    return variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }, [form.isVariant, form.stock, variants]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    const finalCategory = form.category === "__new" ? newCategory.trim() : form.category;
    if (!finalCategory) {
      setError("Category is required.");
      return;
    }

    if (form.isVariant) {
      if (variants.length === 0) {
        setError("Please add at least one variant or disable variants.");
        return;
      }

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.name.trim()) {
          setError(`Variant #${i + 1} name is required.`);
          return;
        }
        if (v.price === undefined || v.price === "" || Number(v.price) < 0) {
          setError(`Variant #${i + 1} must have a valid price.`);
          return;
        }
      }
    } else {
      if (form.price === undefined || form.price === "" || Number(form.price) < 0) {
        setError("Price in USD is required.");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const finalPrice = form.isVariant
        ? Number(variants[0]?.price || form.price || 0)
        : overrideSecondary && priceSecondary
        ? convertMoney(Number(priceSecondary), secondaryCurrency, "USD", exchangeRate)
        : Number(form.price || 0);

      const finalStock = form.isVariant ? totalVariantStock : Number(form.stock || 0);

      const sanitizedVariants = form.isVariant
        ? variants.map((v, i) => ({
            id: v.id.startsWith("var-") ? undefined : v.id, // Only send real DB IDs
            name: v.name.trim(),
            sku: v.sku?.trim() || `${form.sku || "VAR"}-V${i + 1}`,
            barcode: v.barcode?.trim() || null,
            price: Number(v.price || 0),
            wholesalePrice: Number(v.wholesalePrice || 0),
            stock: Number(v.stock || 0),
            isActive: v.isActive !== false,
          }))
        : [];

      const payload = {
        ...form,
        name: form.name.trim(),
        category: finalCategory,
        sku: form.sku?.trim() || generateSku(),
        barcode: form.barcode?.trim() || "",
        price: finalPrice,
        retailPrice: finalPrice,
        wholesalePrice: form.isVariant
          ? Number(variants[0]?.wholesalePrice ?? form.wholesalePrice ?? 0)
          : Number(form.wholesalePrice || 0),
        stock: finalStock,
        lowStockThreshold: Number(form.lowStockThreshold || 0),
        isVariant: Boolean(form.isVariant),
        variants: sanitizedVariants,
        updatedAt: new Date().toISOString(),
        createdAt: form.createdAt || new Date().toISOString(),
      };

      await onSave(payload, mode);
    } catch (err) {
      setError(err?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
        <div className="mx-auto my-6 max-w-4xl rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-2xl text-[var(--foreground)] transition-colors">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pos-action-on-muted)]">
                  {mode === "add" ? "New Product" : "Edit Product"}
                </span>
                {form.isVariant ? (
                  <span className="flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                    <Layers className="size-3" />
                    {variants.length} Variants
                  </span>
                ) : null}
              </div>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[var(--foreground)]">
                {mode === "add" ? "Add Product to Inventory" : form.name || "Edit Product"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
            {/* Left Column: Image upload */}
            <section className="flex flex-col items-center">
              <div
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] bg-cover bg-center text-4xl font-black text-[var(--muted-foreground)] shadow-inner"
                style={form.image ? { backgroundImage: `url(${form.image})` } : undefined}
              >
                {form.image ? null : form.name.charAt(0).toUpperCase() || "P"}
              </div>
              <label className="mt-3 block w-full cursor-pointer rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-center text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors shadow-xs">
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageUpload(event.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {form.image ? (
                <button
                  type="button"
                  onClick={() => patch({ image: "" })}
                  className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                >
                  Remove Image
                </button>
              ) : null}

              {/* Status card */}
              <div className="mt-6 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--foreground)]">Product Status</span>
                  <button
                    type="button"
                    onClick={() => patch({ isActive: !form.isActive })}
                    className={`h-6 w-11 rounded-full p-[2px] transition-colors ${
                      form.isActive ? "bg-[var(--pos-action)]" : "bg-[var(--border-soft)]"
                    }`}
                    aria-pressed={form.isActive}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${
                        form.isActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {form.isActive
                    ? "Visible in POS catalog and online store"
                    : "Hidden from sale catalogs"}
                </p>
              </div>
            </section>

            {/* Right Column: Form inputs */}
            <section className="space-y-6">
              {/* Basic Information */}
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)]/50 p-4 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  Basic Information
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Product Name*</label>
                    <input
                      required
                      value={form.name}
                      onChange={(event) => patch({ name: event.target.value })}
                      placeholder="e.g. Angkor Beer, Coca Cola Can"
                      className={inputCls}
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className={labelCls}>SKU (Stock Keeping Unit)</label>
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        value={form.sku}
                        onChange={(event) => patch({ sku: event.target.value })}
                        placeholder="PRD-1001"
                        className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                      />
                      <button
                        type="button"
                        onClick={() => patch({ sku: generateSku() })}
                        className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors shrink-0"
                        title="Auto-generate SKU"
                      >
                        <Sparkles className="size-3 text-amber-500" />
                        Auto
                      </button>
                    </div>
                  </div>

                  {/* Barcode with Scan and Auto buttons */}
                  <div>
                    <label className={labelCls}>Barcode / EAN</label>
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        value={form.barcode}
                        onChange={(event) => patch({ barcode: event.target.value })}
                        placeholder="8851234567890"
                        className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                      />
                      <button
                        type="button"
                        onClick={() => openScannerFor("product")}
                        className="flex items-center gap-1 rounded-xl border border-[var(--pos-action)]/30 bg-[var(--pos-action-surface)] px-3 text-xs font-black text-[var(--pos-action-on-muted)] hover:bg-[var(--pos-action)] hover:text-white transition-colors shrink-0 shadow-xs"
                        title="Scan barcode with camera"
                      >
                        <Camera className="size-3.5" />
                        Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => patch({ barcode: generateBarcode() })}
                        className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors shrink-0"
                        title="Auto-generate barcode"
                      >
                        <Sparkles className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className={labelCls}>Category</label>
                    <select
                      value={form.category}
                      onChange={(event) => patch({ category: event.target.value })}
                      className={inputCls}
                    >
                      {categoryOptions.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                      <option value="__new">+ New Category</option>
                    </select>
                  </div>

                  {/* Unit */}
                  <div>
                    <label className={labelCls}>Unit of Measure</label>
                    <input
                      value={form.unit}
                      onChange={(event) => patch({ unit: event.target.value })}
                      placeholder="pcs, can, bottle, box, kg"
                      className={inputCls}
                    />
                  </div>

                  {form.category === "__new" ? (
                    <div className="md:col-span-2">
                      <label className={labelCls}>New Category Name*</label>
                      <input
                        value={newCategory}
                        onChange={(event) => setNewCategory(event.target.value)}
                        placeholder="Enter new category name"
                        className={inputCls}
                      />
                    </div>
                  ) : null}

                  <div className="md:col-span-2">
                    <label className={labelCls}>Description (Optional)</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => patch({ description: event.target.value })}
                      placeholder="Product details, ingredients, or notes"
                      className={`${inputCls} min-h-16 resize-none`}
                    />
                  </div>
                </div>
              </div>

              {/* Variant Product Toggle */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Layers className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-[var(--foreground)]">Product Variants</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Enable if this product has multiple sizes, flavors, colors, or packaging
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleVariant(!form.isVariant)}
                    className={`h-6 w-11 rounded-full p-[2px] transition-colors ${
                      form.isVariant ? "bg-purple-600" : "bg-[var(--border-soft)]"
                    }`}
                    aria-pressed={form.isVariant}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${
                        form.isVariant ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Variant list editor if enabled */}
                {form.isVariant ? (
                  <div className="mt-5 space-y-4 pt-4 border-t border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--foreground)]">
                        Variants ({variants.length}) · Total Stock:{" "}
                        <span className="font-black text-purple-600 dark:text-purple-400">
                          {totalVariantStock}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-bold text-white transition-all shadow-xs"
                      >
                        <Plus className="size-3.5" />
                        Add Variant
                      </button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {variants.map((v, index) => (
                        <div
                          key={v.id || index}
                          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted-foreground)]">
                              Variant #{index + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted-foreground)] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={v.isActive !== false}
                                  onChange={(e) => updateVariant(index, { isActive: e.target.checked })}
                                  className="accent-purple-600"
                                />
                                Active
                              </label>
                              {variants.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeVariant(index)}
                                  className="grid size-6 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                  title="Delete variant"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                            <div className="sm:col-span-2 md:col-span-1">
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                Variant Name*
                              </label>
                              <input
                                value={v.name}
                                onChange={(e) => updateVariant(index, { name: e.target.value })}
                                placeholder="e.g. 330ml / Large / Can"
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                SKU
                              </label>
                              <div className="mt-1.5 flex gap-1">
                                <input
                                  value={v.sku}
                                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                                  placeholder="SKU"
                                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateVariant(index, { sku: generateSku("VAR") })}
                                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 text-[10px] font-bold hover:bg-[var(--surface-quiet)]"
                                  title="Auto SKU"
                                >
                                  Auto
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                Barcode
                              </label>
                              <div className="mt-1.5 flex gap-1">
                                <input
                                  value={v.barcode}
                                  onChange={(e) => updateVariant(index, { barcode: e.target.value })}
                                  placeholder="Barcode"
                                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => openScannerFor(index)}
                                  className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-colors"
                                  title="Scan barcode for this variant"
                                >
                                  <Camera className="size-3" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                Retail Price ($)*
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.price}
                                onChange={(e) => updateVariant(index, { price: Number(e.target.value) })}
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                Wholesale Price ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.wholesalePrice || ""}
                                onChange={(e) => updateVariant(index, { wholesalePrice: Number(e.target.value) })}
                                placeholder="Optional"
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-[var(--foreground)]">
                                Stock Qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={v.stock}
                                onChange={(e) => updateVariant(index, { stock: Number(e.target.value) })}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Standard Pricing & Inventory (Shown if product does NOT have variants) */}
              {!form.isVariant ? (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)]/50 p-4 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    Pricing & Inventory
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>Retail Price in USD ($)*</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price !== undefined && form.price !== null ? form.price : ""}
                        onChange={(event) => patch({ price: event.target.value === "" ? "" : Number(event.target.value) })}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className={labelCls}>Retail Price in {secondaryCurrency}</label>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted-foreground)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={overrideSecondary}
                            onChange={(event) => setOverrideSecondary(event.target.checked)}
                            className="accent-[var(--pos-action)]"
                          />
                          Manual Override
                        </label>
                      </div>
                      <input
                        value={overrideSecondary ? priceSecondary : calculatedSecondary}
                        onChange={(event) => setPriceSecondary(event.target.value)}
                        readOnly={!overrideSecondary}
                        className={`${inputCls} read-only:opacity-60`}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Wholesale Price ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.wholesalePrice !== undefined && form.wholesalePrice !== null ? form.wholesalePrice : ""}
                        onChange={(event) => patch({ wholesalePrice: event.target.value === "" ? "" : Number(event.target.value) })}
                        placeholder="Optional"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Current Stock (Qty)*</label>
                      <input
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={(event) => patch({ stock: Number(event.target.value) })}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Low Stock Alert Level</label>
                      <input
                        type="number"
                        min="0"
                        value={form.lowStockThreshold}
                        onChange={(event) => patch({ lowStockThreshold: Number(event.target.value) })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Error banner */}
              {error ? (
                <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 text-xs font-bold text-red-600 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-5 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-6 py-2.5 text-xs font-black text-[var(--pos-action-fg)] disabled:opacity-40 transition-all active:scale-[0.98] shadow-md"
                >
                  {saving ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    mode === "add" ? "Create Product" : "Save Changes"
                  )}
                </button>
              </div>
            </section>
          </form>
        </div>
      </div>

      {/* Barcode scanner modal */}
      <BarcodeScannerModal
        open={scanner.open}
        status={scanner.status}
        errorMessage={scanner.errorMessage}
        videoRef={scanner.videoRef}
        onClose={scanner.close}
        onRetry={scanner.retry}
        torchSupported={scanner.torchSupported}
        torchOn={scanner.torchOn}
        onToggleTorch={scanner.toggleTorch}
        onToggleCameraFacing={scanner.toggleCameraFacing}
      />
    </>
  );
}

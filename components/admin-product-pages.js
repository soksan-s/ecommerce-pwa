"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  EyeOff,
  Image,
  ImagePlus,
  Info,
  Italic,
  Layers,
  Link2,
  List,
  PackageOpen,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { BarcodeScannerModal, useCameraBarcodeScanner } from "@/components/shared/barcode-scanner";
import { AppSelect } from "@/components/ui/app-select";
import { cn, formatCurrency } from "@/lib/utils";

const PRODUCT_CATEGORY_OPTIONS = [
  "Fresh Picks",
  "Beverages",
  "Bundles",
  "Pantry",
  "Vegetables",
  "Fruits",
  "Organic Grains",
  "Fresh Herbs",
];

const PRODUCT_UNIT_OPTIONS = [
  "kg (Kilograms)",
  "lbs (Pounds)",
  "unit (Individual)",
  "bunch",
  "box",
  "gallon",
  "liter",
];

function ProductSectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--action)]/30 text-[var(--action)]">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
        {subtitle ? <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-8 w-14 items-center rounded-full p-1 transition-colors",
        checked ? "bg-[var(--action)]" : "bg-[var(--surface-quiet)]"
      )}
    >
      <span
        className={cn(
          "h-6 w-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-6" : "translate-x-0"
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product price / stock helpers
// ─────────────────────────────────────────────────────────────────────────────

function isVariantProduct(product) {
  return Boolean(
    product &&
      (product.hasVariants || (product.isVariant && product.variants && product.variants.length > 0)),
  );
}

function getProductDisplayPrice(product) {
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.discountedPrice ?? v.price ?? 0));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min !== max) {
      return { isRange: true, min, max };
    }
    return { isRange: false, price: min };
  }
  const price = Number(product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price);
  return { isRange: false, price };
}

function getProductMinPrice(product) {
  const display = getProductDisplayPrice(product);
  return display.isRange ? display.min : display.price;
}

function getProductTotalStock(product) {
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
  }
  return Number(product.stock || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable product image editor (preview + Cloudinary upload + URL field)
// ─────────────────────────────────────────────────────────────────────────────

function ProductImageEditor({ image, onImageChange, store }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    setUploadMessage("Uploading media...");

    const url = await store.uploadAsset(file);

    if (url) {
      onImageChange(url);
      setUploadMessage("Upload complete.");
    } else {
      setUploadMessage("Upload failed. You can still paste an image URL manually.");
    }

    setUploading(false);
  }

  return (
    <div>
      <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-6 transition-all hover:border-[var(--action)]/50 hover:bg-[var(--action)]/5">
        {image ? (
          <div className="relative w-full overflow-hidden rounded-lg bg-[var(--surface-quiet)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Product preview" className="h-44 w-full object-cover" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
              <Upload className="size-7" />
            </div>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {uploading ? "Uploading..." : "Click to upload an image"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">JPG, PNG, WEBP up to 10MB</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={uploading}
        />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Image URL</label>
          {image ? (
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="inline-flex items-center gap-1 rounded-full bg-[#fa746f]/20 px-3 py-1 text-xs font-bold text-[#a83836] transition hover:brightness-95"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          ) : null}
        </div>
        <input
          value={image}
          onChange={(event) => onImageChange(event.target.value)}
          placeholder="https://..."
          className="w-full rounded-full border-none bg-[var(--surface-soft)] px-5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
        />
      </div>

      {uploadMessage ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{uploadMessage}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add New Product  (matches Add_Product_with_variant.html)
// ─────────────────────────────────────────────────────────────────────────────

export function AdminAddProductPageView() {
  const store = useAppStore();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: PRODUCT_CATEGORY_OPTIONS[0],
    sku: "",
    barcode: "",
    description: "",
    image: "",
    price: "0",
    discountPrice: "0",
    stock: "0",
    unit: PRODUCT_UNIT_OPTIONS[0],
    minStockAlert: "5",
  });
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantOptions, setVariantOptions] = useState([
    { name: "Size", values: "Small, Medium, Large" },
  ]);
  const [variantRows, setVariantRows] = useState([
    { name: "Small", sku: "", priceAdjustment: "0", stock: "0" },
    { name: "Medium", sku: "", priceAdjustment: "0", stock: "0" },
    { name: "Large", sku: "", priceAdjustment: "0", stock: "0" },
  ]);
  const [tags, setTags] = useState(["Organic", "Vegan"]);
  const [publishActive, setPublishActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const scanner = useCameraBarcodeScanner({
    onDetected: (code) => update("barcode", code),
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadMessage("Uploading media...");

    const url = await store.uploadAsset(file);

    if (url) {
      update("image", url);
      setUploadMessage("Upload complete.");
    } else {
      setUploadMessage("Upload failed. You can still paste an image URL manually.");
    }

    setUploading(false);
  }

  function rebuildVariantRowsFromOptions() {
    const firstOption = variantOptions[0];
    if (!firstOption) {
      setVariantRows([]);
      return;
    }
    const values = firstOption.values
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    setVariantRows(
      values.map((value, index) => {
        const existing = variantRows[index];
        return {
          name: value,
          sku: existing?.sku || "",
          priceAdjustment: existing?.priceAdjustment || "0",
          stock: existing?.stock || "0",
        };
      }),
    );
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");

    try {
      const description = form.description || "Fresh product from the catalog.";
      const imageUrl = form.image || store.products[0]?.image || "";
      const basePrice = Number(form.price) || 0;
      const discountPrice = Number(form.discountPrice) || 0;
      // The form enters a discount *price* (the final price the customer pays).
      // Convert it to a percent discount off the base price so the catalog/API
      // (which stores discountPercent) displays the correct sale price.
      // e.g. base $100, discount price $3.50 → 96.5% off (rounds to 97).
      const discountPercent =
        basePrice > 0 && discountPrice > 0 && discountPrice < basePrice
          ? Math.round(((basePrice - discountPrice) / basePrice) * 100)
          : 0;

      const productResult = await store.addProduct({
        name: form.name,
        category: form.category,
        description,
        image: imageUrl,
        price: basePrice,
        discountPercent,
        stock: Number(form.stock) || 0,
        sku: form.sku,
        barcode: form.barcode,
        minStockAlert: Number(form.minStockAlert) || 5,
        isActive: publishActive,
      });

      if (!productResult.success || !productResult.product) {
        setSaveMessage(productResult.message || "Unable to create product.");
        setSaving(false);
        return;
      }

      const product = productResult.product;

      if (variantsEnabled) {
        for (const row of variantRows) {
          if (!row.name) {
            continue;
          }
          const priceAdj = Number(row.priceAdjustment) || 0;
          const payload = {
            name: row.name,
            sku: row.sku || `${String(form.name || "PRODUCT").replace(/\s+/g, "-").toUpperCase()}-${row.name.replace(/\s+/g, "-").toUpperCase()}`,
            price: Math.max(0, basePrice + priceAdj),
            costPrice: basePrice,
            discountPercent,
            stock: Number(row.stock) || 0,
            isActive: publishActive,
          };

          const res = await fetch(`/api/admin/products/${product.id}/variants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const body = await res.json();
            setSaveMessage(body.error?.message || "Product created but some variants failed.");
            setSaving(false);
            return;
          }
        }
      }

      setSaveMessage("Product created successfully.");
      window.setTimeout(() => {
        router.push("/admin?tab=products");
      }, 600);
    } catch (err) {
      setSaveMessage(err?.message || "Unable to create product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSaveProduct} className="pb-32">
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
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)]">
        <span>Admin</span>
        <ChevronRight className="size-4" />
        <span>Product Management</span>
        <ChevronRight className="size-4" />
        <span className="text-[var(--action)]">Add New Product</span>
      </nav>

      <div className="mb-10 flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Add New Product</h1>
        <p className="text-[var(--muted-foreground)]">Create a new premium entry for your inventory catalog.</p>
      </div>

      {saveMessage ? (
        <div
          className={cn(
            "mb-8 rounded-xl px-5 py-4 text-sm",
            saveMessage.includes("successfully")
              ? "bg-[var(--action-surface)] text-[var(--action-on-muted)]"
              : "bg-[#fa746f]/20 text-[#6e0a12]"
          )}
        >
          {saveMessage}
        </div>
      ) : null}

      {/* Bento Form Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (Core Info) */}
        <div className="space-y-8 lg:col-span-2">
          {/* Basic Information */}
          <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
            <ProductSectionHeader icon={Info} title="Basic Information" />
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Product Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="e.g. Organic Heirloom Tomatoes"
                    className="w-full rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                    className="w-full appearance-none rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  >
                    {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">SKU</label>
                <input
                  value={form.sku}
                  onChange={(event) => update("sku", event.target.value)}
                  placeholder="ATR-VEG-001"
                  className="w-full rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm uppercase tracking-wider outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Barcode</label>
                <div className="flex items-center gap-2">
                  <input
                    value={form.barcode}
                    onChange={(event) => update("barcode", event.target.value)}
                    placeholder="Scan or enter barcode (e.g. 8850001234567)"
                    inputMode="text"
                    autoComplete="off"
                    className="w-full rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm tracking-wider outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  />
                  <button
                    type="button"
                    onClick={scanner.openScanner}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--action)] px-4 py-3 text-xs font-extrabold text-[var(--action-foreground)] transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <ScanLine className="size-4" />
                    Scan
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Description</label>
                <div className="flex min-h-[160px] flex-col rounded-lg bg-[var(--surface-soft)] p-2 transition-all focus-within:ring-2 focus-within:ring-[var(--action)]">
                  <div className="mb-2 flex items-center gap-2 border-b border-[var(--border-soft)] p-2">
                    <button type="button" className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)]">
                      <Bold className="size-4" />
                    </button>
                    <button type="button" className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)]">
                      <Italic className="size-4" />
                    </button>
                    <button type="button" className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)]">
                      <List className="size-4" />
                    </button>
                    <div className="mx-1 h-4 w-px bg-[var(--surface-quiet)]/30" />
                    <button type="button" className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)]">
                      <Link2 className="size-4" />
                    </button>
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    placeholder="Describe the origin, flavor profile, and health benefits..."
                    className="flex-1 resize-none bg-transparent px-4 py-2 text-sm text-[var(--foreground)] outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Pricing & Inventory */}
          <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
            <ProductSectionHeader icon={CircleDollarSign} title="Pricing & Inventory" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Base Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-[var(--muted-foreground)]">$</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => update("price", event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-full border-none bg-[var(--surface-soft)] py-3 pl-10 pr-6 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Discount Price (Optional)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-[var(--muted-foreground)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountPrice}
                    onChange={(event) => update("discountPrice", event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-full border-none bg-[var(--surface-soft)] py-3 pl-10 pr-6 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Stock Quantity</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => update("stock", event.target.value)}
                  placeholder="0"
                  className="w-full rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Measurement Unit</label>
                <select
                  value={form.unit}
                  onChange={(event) => update("unit", event.target.value)}
                  className="w-full appearance-none rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                >
                  {PRODUCT_UNIT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Low Stock Alert</label>
                <input
                  type="number"
                  min="0"
                  value={form.minStockAlert}
                  onChange={(event) => update("minStockAlert", event.target.value)}
                  placeholder="5"
                  className="w-full rounded-full border-none bg-[var(--surface-soft)] px-6 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
            </div>
          </section>

          {/* Product Variants */}
          <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b7e3ff]/30 text-[#38647c]">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">Product Variants</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">Manage different versions of this product (e.g., size, color).</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--muted-foreground)]">Enable Variants</span>
                <ToggleSwitch checked={variantsEnabled} onChange={setVariantsEnabled} label="Toggle variants" />
              </div>
            </div>

            {variantsEnabled ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--foreground)]">Variant Options</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...variantOptions, { name: "", values: "" }];
                        setVariantOptions(next);
                      }}
                      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-[var(--action)] transition-colors hover:bg-[var(--action)]/5"
                    >
                      <Plus className="size-4" />
                      Add Option
                    </button>
                  </div>

                  <div className="space-y-3">
                    {variantOptions.map((option, index) => (
                      <div
                        key={`option-${index}`}
                        className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 md:grid-cols-2"
                      >
                        <div className="space-y-1.5">
                          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Option Name</label>
                          <input
                            value={option.name}
                            onChange={(event) => {
                              const next = [...variantOptions];
                              next[index] = { ...next[index], name: event.target.value };
                              setVariantOptions(next);
                            }}
                            placeholder="e.g. Size"
                            className="w-full rounded-full border-none bg-[var(--input-fill)] px-5 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Values</label>
                          <div className="flex gap-2">
                            <input
                              value={option.values}
                              onChange={(event) => {
                                const next = [...variantOptions];
                                next[index] = { ...next[index], values: event.target.value };
                                setVariantOptions(next);
                              }}
                              placeholder="e.g. Small, Medium, Large"
                              className="w-full rounded-full border-none bg-[var(--input-fill)] px-5 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                            />
                            {variantOptions.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setVariantOptions(variantOptions.filter((_, i) => i !== index))}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--muted-foreground)] transition hover:text-[#a83836]"
                                aria-label="Remove option"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {index === 0 ? (
                          <button
                            type="button"
                            onClick={rebuildVariantRowsFromOptions}
                            className="inline-flex items-center gap-2 justify-self-start rounded-full bg-[var(--action)]/30 px-4 py-2 text-xs font-bold text-[var(--action)] transition hover:brightness-95 md:col-span-2"
                          >
                            <RefreshCw className="size-3.5" />
                            Rebuild combinations
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Variant Combinations</h3>
                  <div className="overflow-hidden rounded-lg border border-[var(--border-soft)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface-soft)] font-bold text-[var(--muted-foreground)]">
                        <tr>
                          <th className="px-4 py-3">Variant</th>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Price Adj.</th>
                          <th className="px-4 py-3">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-soft)]">
                        {variantRows.map((row, index) => (
                          <tr key={`row-${index}`} className="transition-colors hover:bg-[var(--surface-soft)]/50">
                            <td className="px-4 py-3 font-medium text-[var(--foreground)]">{row.name}</td>
                            <td className="px-4 py-3">
                              <input
                                value={row.sku}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], sku: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="SKU"
                                className="w-full bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={row.priceAdjustment}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], priceAdjustment: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="+0.00"
                                className="w-full bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={row.stock}
                                onChange={(event) => {
                                  const next = [...variantRows];
                                  next[index] = { ...next[index], stock: event.target.value };
                                  setVariantRows(next);
                                }}
                                placeholder="0"
                                className="w-full bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                        {variantRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
                              Add values to your first option to generate combinations.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                Variants are disabled. Toggle the switch above to add size, color, or format options.
              </div>
            )}
          </section>
        </div>

        {/* Right Column (Media & Meta) */}
        <div className="space-y-8">
          {/* Product Images */}
          <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
            <ProductSectionHeader icon={Image} title="Product Images" />
            <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-10 transition-all hover:border-[var(--action)]/50 hover:bg-[var(--action)]/5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-quiet)] text-[var(--muted-foreground)] transition-transform group-hover:scale-110">
                <Upload className="size-8" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {uploading ? "Uploading..." : "Drop files here or click to upload"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Supports JPG, PNG, WEBP up to 10MB</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={uploading}
              />
            </div>
            {uploadMessage ? <p className="mt-3 text-xs text-[var(--muted-foreground)]">{uploadMessage}</p> : null}

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="group relative aspect-square overflow-hidden rounded-md bg-[var(--surface-quiet)]">
                {form.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image} alt="Product preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => update("image", "")}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-[#a83836]"
                      aria-label="Remove image"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--muted-foreground)]">
                    <ImagePlus className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex aspect-square items-center justify-center rounded-md bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
                <Plus className="size-6" />
              </div>
              <div className="flex aspect-square items-center justify-center rounded-md bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
                <Plus className="size-6" />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Image URL</label>
              <input
                value={form.image}
                onChange={(event) => update("image", event.target.value)}
                placeholder="https://..."
                className="w-full rounded-full border-none bg-[var(--surface-soft)] px-5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
          </section>

          {/* Attributes & Tags */}
          <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
            <ProductSectionHeader icon={Tag} title="Attributes & Tags" />
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-soft)] p-4">
                <div>
                  <p className="font-bold text-[var(--foreground)]">Publish Status</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Visible to customers immediately</p>
                </div>
                <ToggleSwitch checked={publishActive} onChange={setPublishActive} label="Publish" />
              </div>

              <div className="space-y-3">
                <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Product Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--action-surface)] px-4 py-1.5 text-xs font-bold text-[var(--action-on-muted)]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((entry) => entry !== tag))}
                        className="transition-colors hover:text-[#a83836]"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const value = event.currentTarget.value.trim();
                        if (value && !tags.includes(value)) {
                          setTags([...tags, value]);
                        }
                        event.currentTarget.value = "";
                      }
                    }}
                    placeholder="Type and press enter to add..."
                    className="w-full rounded-full border-none bg-[var(--surface-soft)] px-5 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-soft)] bg-[var(--surface-soft)]/80 px-10 py-6 backdrop-blur-xl lg:left-16 xl:left-[16rem]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-4">
          <Link
            href="/admin?tab=products"
            className="rounded-full px-8 py-3 text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--action)] px-10 py-3 text-sm font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-all hover:scale-[1.02] hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Management  (matches Product_Page_Design.html)
// ─────────────────────────────────────────────────────────────────────────────

function AdminProductCard({ product, store, onQuickEdit, onFullEdit, onDelete, onRestock }) {
  const priceDisplay = getProductDisplayPrice(product);
  const isRange = priceDisplay.isRange;
  const totalStock = getProductTotalStock(product);
  const variantProduct = isVariantProduct(product);
  const lowStock = totalStock <= (product.minStockAlert || 8);
  const badge = !product.isActive
    ? { label: "Draft", className: "bg-[var(--surface-container-highest)] text-white" }
    : lowStock
      ? { label: "Low Stock", className: "bg-[#a83836] text-[#fff7f6]" }
      : { label: "Active", className: "bg-[var(--action)]/90 text-[var(--action-foreground)]" };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] transition-all hover:border-[var(--action)]/20 hover:shadow-xl hover:shadow-[var(--action)]/5">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
            <PackageSearch className="size-10" />
          </div>
        )}

        <div className="absolute left-4 top-4 flex gap-2">
          <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md", badge.className)}>
            {badge.label}
          </span>
          {variantProduct ? (
            <span className="rounded-full bg-[#b7e3ff] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#26536a] backdrop-blur-md">
              Variants
            </span>
          ) : null}
        </div>

        <div className="absolute inset-0 flex items-end gap-3 bg-gradient-to-t from-black/60 to-transparent p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onQuickEdit(product)}
            className="flex-1 rounded-full bg-[var(--surface-strong)] py-2 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--action)] hover:text-[var(--action-foreground)]"
          >
            Quick Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-[#a83836]"
            aria-label="Delete product"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-[var(--foreground)]">{product.name}</h3>
          {isRange ? (
            <span className="text-right text-sm font-bold leading-5 text-[var(--action)]">
              {formatCurrency(priceDisplay.min)}
              <br />- {formatCurrency(priceDisplay.max)}
            </span>
          ) : (
            <span className="text-lg font-bold text-[var(--action)]">{formatCurrency(priceDisplay.price)}</span>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--action-surface)] px-3 py-1 text-[11px] font-bold text-[var(--action-on-muted)]">{product.category}</span>
          <span className="rounded-full bg-[var(--surface-quiet)] px-3 py-1 text-[11px] font-bold text-[var(--muted-foreground)]">{totalStock} in stock</span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onFullEdit(product)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
          >
            <Edit3 className="size-4" />
            Full Edit
          </button>
          {!product.isActive ? (
            <button
              type="button"
              onClick={() => store.toggleProductStatus(product.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--action)] py-3 text-sm font-semibold text-[var(--action-foreground)] transition-all hover:opacity-90"
            >
              <Upload className="size-4" />
              Publish
            </button>
          ) : lowStock ? (
            <button
              type="button"
              onClick={() => onRestock(product)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
            >
              <PackageOpen className="size-4" />
              Restock
            </button>
          ) : (
            <button
              type="button"
              onClick={() => store.toggleProductStatus(product.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
            >
              <EyeOff className="size-4" />
              Deactivate
            </button>
          )}
        </div>

        {variantProduct ? (
          <Link
            href={`/admin/product-management/${product.id}/variants`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--action)]/20 py-2 text-xs font-semibold text-[var(--action)] transition hover:bg-[var(--action)]/5"
          >
            <Layers className="size-3.5" />
            Manage Variants
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AdminProductManagementPageView() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [csvText, setCsvText] = useState("");
  const [csvMessage, setCsvMessage] = useState("");
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [quickEdit, setQuickEdit] = useState(null);
  const [quickPrice, setQuickPrice] = useState("0");
  const [quickStock, setQuickStock] = useState("0");
  const [quickStatus, setQuickStatus] = useState("Active");
  const [quickImage, setQuickImage] = useState("");
  const [fullEdit, setFullEdit] = useState(null);
  const [fullSaving, setFullSaving] = useState(false);
  const [fullEditError, setFullEditError] = useState("");
  const editScanner = useCameraBarcodeScanner({
    onDetected: (code) => setFullEdit((current) => (current ? { ...current, barcode: code } : current)),
  });
  const [restock, setRestock] = useState(null);
  const [restockAmount, setRestockAmount] = useState("10");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  const products = useMemo(() => {
    const lower = query.trim().toLowerCase();

    let list = store.products.filter((product) => {
      if (
        lower &&
        ![
          product.name,
          product.category,
          product.sku,
          product.barcode,
          product.description,
        ].some((value) => value?.toLowerCase().includes(lower)) &&
        !(product.variants || []).some(
          (variant) =>
            variant.sku?.toLowerCase().includes(lower) || variant.barcode?.toLowerCase().includes(lower)
        )
      ) {
        return false;
      }
      if (statusFilter === "active" && !product.isActive) {
        return false;
      }
      if (statusFilter === "drafts" && product.isActive) {
        return false;
      }
      if (statusFilter === "lowStock" && getProductTotalStock(product) > 8) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "az":
          return a.name.localeCompare(b.name);
        case "priceLow":
          return getProductMinPrice(a) - getProductMinPrice(b);
        case "priceHigh":
          return getProductMinPrice(b) - getProductMinPrice(a);
        case "newest":
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return list;
  }, [store.products, query, statusFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const totalPages = Math.max(Math.ceil(products.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageProducts = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIndex = products.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, products.length);

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== "...") {
      pageNumbers.push("...");
    }
  }

  const filterChips = [
    { key: "all", label: `All Products (${store.products.length})` },
    { key: "active", label: "Active" },
    { key: "drafts", label: "Drafts" },
    { key: "lowStock", label: "Low Stock" },
  ];

  function openQuickEdit(product) {
    setQuickEdit(product);
    setQuickPrice(String(product.price));
    setQuickStock(String(product.stock));
    setQuickStatus(product.isActive ? "Active" : "Draft");
    setQuickImage(product.image || "");
  }

  function saveQuickEdit() {
    if (!quickEdit) {
      return;
    }
    store.updateProduct(quickEdit.id, {
      price: Number(quickPrice) || 0,
      stock: Number(quickStock) || 0,
      isActive: quickStatus === "Active",
      image: quickImage,
    });
    setQuickEdit(null);
  }

  function openFullEdit(product) {
    setFullEdit({
      id: product.id,
      name: product.name || "",
      category: product.category || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      description: product.description || "",
      image: product.image || "",
      price: String(product.price ?? 0),
      discountPercent: String(product.discountPercent ?? 0),
      stock: String(product.stock ?? 0),
      minStockAlert: String(product.minStockAlert ?? 5),
      isActive: product.isActive ?? true,
    });
    setFullEditError("");
  }

  async function saveFullEdit() {
    if (!fullEdit) {
      return;
    }
    setFullSaving(true);
    try {
      const result = await store.updateProduct(fullEdit.id, {
        name: fullEdit.name,
        category: fullEdit.category,
        sku: fullEdit.sku,
        barcode: fullEdit.barcode,
        description: fullEdit.description,
        image: fullEdit.image,
        price: Number(fullEdit.price) || 0,
        discountPercent: Number(fullEdit.discountPercent) || 0,
        stock: Number(fullEdit.stock) || 0,
        minStockAlert: Number(fullEdit.minStockAlert) || 5,
        isActive: fullEdit.isActive,
      });
      if (result && result.ok === false) {
        setFullEditError(result.error || "Unable to update product.");
        return;
      }
      setFullEdit(null);
    } finally {
      setFullSaving(false);
    }
  }

  async function handleImport() {
    const result = await store.importProductsCsv(csvText);
    setCsvMessage(result.message);
    if (result.success) {
      setCsvText("");
    }
  }

  function handleCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    file.text().then(setCsvText);
  }

  function handleExport() {
    const header = "name,category,description,price,stock,imageUrl,discountPercent,isActive";
    const rows = store.products.map((product) =>
      [
        product.name,
        product.category,
        product.description,
        product.price,
        product.stock,
        product.image,
        product.discountPercent,
        product.isActive,
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "products-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function confirmRestock() {
    if (!restock) {
      return;
    }
    store.restockProduct(restock.id, Number(restockAmount) || 0);
    setRestock(null);
    setRestockAmount("10");
  }

  function confirmDelete() {
    if (!deleteConfirm) {
      return;
    }
    store.deleteProduct(deleteConfirm.id);
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)]">Product Management</h1>
          <p className="mt-2 text-lg text-[var(--muted-foreground)]">Manage your premium organic inventory and catalog.</p>
        </div>
        <Link
          href="/admin/add-product"
          className="inline-flex items-center gap-3 rounded-full bg-[var(--action)] px-8 py-4 font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        >
          <Plus className="size-5" />
          Add New Product
        </Link>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStatusFilter(chip.key)}
              className={cn(
                "whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                statusFilter === chip.key
                  ? "bg-[var(--action)] text-[var(--action-foreground)]"
                  : "bg-[var(--surface-quiet)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
              )}
            >
              {chip.label}
            </button>
          ))}
          <div className="mx-2 h-6 w-px bg-[var(--surface-quiet)]/30" />
          <button
            type="button"
            onClick={() => setShowCsvPanel((value) => !value)}
            className="flex items-center gap-1 text-sm font-bold text-[var(--action)]"
          >
            <SlidersHorizontal className="size-4" />
            Import / Export
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
              className="w-52 rounded-full border-none bg-[var(--surface-soft)] py-2 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
            />
          </div>
          <span className="text-sm font-medium text-[var(--muted-foreground)]">Sort by:</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="cursor-pointer rounded-full border-none bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
          >
            <option value="newest">Newest first</option>
            <option value="az">Alphabetical (A-Z)</option>
            <option value="priceLow">Price (Low to High)</option>
            <option value="priceHigh">Price (High to Low)</option>
          </select>
        </div>
      </div>

      {/* CSV Import / Export Panel (collapsible) */}
      {showCsvPanel ? (
        <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">CSV import / export</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Import products in bulk or export the current catalog.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                  Load CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Export CSV
                </button>
              </div>
            </div>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="Paste product CSV here"
              className="min-h-24 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--action)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImport}
                className="rounded-full bg-[var(--action)] px-6 py-2.5 text-sm font-bold text-[var(--action-foreground)] transition hover:opacity-90"
              >
                Import Products
              </button>
              {csvMessage ? <p className="text-sm text-[var(--muted-foreground)]">{csvMessage}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {pageProducts.map((product) => (
          <AdminProductCard
            key={product.id}
            product={product}
            store={store}
            onQuickEdit={openQuickEdit}
            onFullEdit={openFullEdit}
            onDelete={setDeleteConfirm}
            onRestock={setRestock}
          />
        ))}

        {/* Add New Product Empty State Card */}
        <Link
          href="/admin/add-product"
          className="group flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-strong)] p-8 transition-all hover:border-[var(--action)]/40 hover:bg-[var(--surface-soft)]"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--action-surface)] text-[var(--action-on-muted)] transition-transform group-hover:scale-110">
            <Plus className="size-8" />
          </div>
          <span className="text-xl font-bold text-[var(--foreground)]">Add New Product</span>
          <p className="mt-2 max-w-[200px] text-center text-sm text-[var(--muted-foreground)]">
            Click to create a new entry in your organic catalog.
          </p>
        </Link>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-8">
        <span className="text-sm text-[var(--muted-foreground)]">
          Showing {startIndex} to {endIndex} of {products.length} products
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(safePage - 1, 1))}
            disabled={safePage <= 1}
            className="rounded-full p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageNumbers.map((number, index) =>
            number === "..." ? (
              <span key={`ellipsis-${index}`} className="text-[var(--muted-foreground)]">
                ...
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={cn(
                  "h-8 w-8 rounded-full text-sm font-bold transition-colors",
                  safePage === number
                    ? "bg-[var(--action)] text-[var(--action-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]"
                )}
              >
                {number}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage(Math.min(safePage + 1, totalPages))}
            disabled={safePage >= totalPages}
            className="rounded-full p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Quick Edit Modal */}
      {quickEdit ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQuickEdit(null)} />
          <div className="relative w-full max-w-md rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]">
            <h2 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Quick Edit</h2>
            <div className="space-y-4">
              <ProductImageEditor image={quickImage} onImageChange={setQuickImage} store={store} />
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Price (USD)</label>
                <input
                  value={quickPrice}
                  onChange={(event) => setQuickPrice(event.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Stock Level</label>
                <input
                  value={quickStock}
                  onChange={(event) => setQuickStock(event.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Status</label>
                <AppSelect
                  value={quickStatus}
                  onChange={setQuickStatus}
                  options={["Active", "Draft", "Archived"]}
                  aria-label="Product status"
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setQuickEdit(null)}
                className="flex-1 rounded-xl bg-[var(--surface-quiet)] py-3 font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveQuickEdit}
                className="flex-1 rounded-xl bg-[var(--action)] py-3 font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full Edit Modal */}
      {fullEdit ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setFullEdit(null)} />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]">
            <h2 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Full Edit</h2>
            {fullEditError ? (
              <div className="mb-4 rounded-xl bg-[#fa746f]/20 px-4 py-3 text-sm font-semibold text-[#6e0a12]">
                {fullEditError}
              </div>
            ) : null}
            <BarcodeScannerModal
              open={editScanner.open}
              status={editScanner.status}
              errorMessage={editScanner.errorMessage}
              videoRef={editScanner.videoRef}
              onClose={editScanner.close}
              onRetry={editScanner.retry}
              torchSupported={editScanner.torchSupported}
              torchOn={editScanner.torchOn}
              onToggleTorch={editScanner.toggleTorch}
              onToggleCameraFacing={editScanner.toggleCameraFacing}
            />
            <div className="space-y-4">
              <ProductImageEditor
                image={fullEdit.image}
                onImageChange={(value) => setFullEdit((current) => ({ ...current, image: value }))}
                store={store}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Product Name</label>
                  <input
                    value={fullEdit.name}
                    onChange={(event) => setFullEdit((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Category</label>
                  <AppSelect
                    value={fullEdit.category}
                    onChange={(value) => setFullEdit((current) => ({ ...current, category: value }))}
                    options={PRODUCT_CATEGORY_OPTIONS}
                    aria-label="Product category"
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">SKU</label>
                <input
                  value={fullEdit.sku}
                  onChange={(event) => setFullEdit((current) => ({ ...current, sku: event.target.value }))}
                  placeholder="ATR-VEG-001"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Barcode</label>
                <div className="flex items-center gap-2">
                  <input
                    value={fullEdit.barcode}
                    onChange={(event) => setFullEdit((current) => ({ ...current, barcode: event.target.value }))}
                    placeholder="Scan or enter barcode (e.g. 8850001234567)"
                    inputMode="text"
                    autoComplete="off"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 tracking-wider focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                  <button
                    type="button"
                    onClick={editScanner.openScanner}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--action)] px-4 py-3 text-xs font-extrabold text-[var(--action-foreground)] transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <ScanLine className="size-4" />
                    Scan
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Description</label>
                <textarea
                  value={fullEdit.description}
                  onChange={(event) => setFullEdit((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Price (USD)</label>
                  <input
                    value={fullEdit.price}
                    onChange={(event) => setFullEdit((current) => ({ ...current, price: event.target.value }))}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Discount %</label>
                  <input
                    value={fullEdit.discountPercent}
                    onChange={(event) => setFullEdit((current) => ({ ...current, discountPercent: event.target.value }))}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Stock</label>
                  <input
                    value={fullEdit.stock}
                    onChange={(event) => setFullEdit((current) => ({ ...current, stock: event.target.value }))}
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Low Stock Alert</label>
                  <input
                    value={fullEdit.minStockAlert}
                    onChange={(event) => setFullEdit((current) => ({ ...current, minStockAlert: event.target.value }))}
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Status</label>
                  <AppSelect
                    value={fullEdit.isActive ? "Active" : "Draft"}
                    onChange={(value) => setFullEdit((current) => ({ ...current, isActive: value === "Active" }))}
                    options={["Active", "Draft"]}
                    aria-label="Product status"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setFullEdit(null)}
                className="flex-1 rounded-xl bg-[var(--surface-quiet)] py-3 font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveFullEdit}
                disabled={fullSaving}
                className="flex-1 rounded-xl bg-[var(--action)] py-3 font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {fullSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Restock Modal */}
      {restock ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRestock(null)} />
          <div className="relative w-full max-w-md rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]">
            <h2 className="mb-2 text-2xl font-bold text-[var(--foreground)]">Restock</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Add stock to {restock.name}</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Quantity to add</label>
                <input
                  value={restockAmount}
                  onChange={(event) => setRestockAmount(event.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div className="flex gap-2">
                {[5, 10, 20].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setRestockAmount(String(amount))}
                    className="rounded-full bg-[var(--surface-quiet)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setRestock(null)}
                className="flex-1 rounded-xl bg-[var(--surface-quiet)] py-3 font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestock}
                className="flex-1 rounded-xl bg-[var(--action)] py-3 font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90"
              >
                Restock
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirm Modal */}
      {deleteConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-md rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]">
            <h2 className="mb-2 text-2xl font-bold text-[var(--foreground)]">Delete product?</h2>
            <p className="text-sm text-[var(--muted-foreground)]">This will remove &quot;{deleteConfirm.name}&quot; from the catalog.</p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl bg-[var(--surface-quiet)] py-3 font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-quiet)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-[#a83836] py-3 font-bold text-[#fff7f6] shadow-lg shadow-[#a83836]/20 transition-colors hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


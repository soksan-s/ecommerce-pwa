"use client";

import { Download, Edit3, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { convertMoney, formatMoney, formatPrimaryMoney } from "@/components/pos/format";
import { ProductFormModal } from "@/components/pos/ProductFormModal";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { getProductsFromCache, put, remove, saveProductsToCache } from "@/lib/db";
import { usePosStore } from "@/store/posStore";

const mockProducts = [
  { id: "angkor-rice", name: "Angkor Premium Jasmine Rice", sku: "RICE-001", category: "Grocery", price: 7.8, stock: 18, lowStockThreshold: 5, unit: "bag", image: "", isActive: true, createdAt: "2026-01-01T01:00:00Z" },
  { id: "coconut-water", name: "Fresh Coconut Water", sku: "DRINK-011", category: "Beverages", price: 1.22, stock: 14, lowStockThreshold: 5, unit: "bottle", image: "", isActive: true, createdAt: "2026-01-02T01:00:00Z" },
  { id: "banana-chips", name: "Banana Chips Pack", sku: "SNACK-020", category: "Snacks", price: 1.83, stock: 2, lowStockThreshold: 5, unit: "pack", image: "", isActive: true, createdAt: "2026-01-03T01:00:00Z" },
  { id: "fish-sauce", name: "Fish Sauce Bottle", sku: "SAUCE-002", category: "Sauce", price: 1.59, stock: 0, lowStockThreshold: 5, unit: "bottle", image: "", isActive: false, createdAt: "2026-01-04T01:00:00Z" },
];

function normalizeProduct(product, exchangeRate = 4100) {
  const price = product.price !== undefined && product.price !== ""
    ? Number(product.price)
    : convertMoney(product.price_khr, "KHR", "USD", exchangeRate);

  return {
    id: product.id || `prd-${Date.now()}`,
    name: product.name || "Unnamed Product",
    sku: product.sku || product.id || "",
    description: product.description || "",
    category: product.category || "General",
    price: Number(price || 0),
    stock: Number(product.stock || 0),
    lowStockThreshold: Number(product.lowStockThreshold || 5),
    unit: product.unit || "pcs",
    image: product.image || product.imageUrl || "",
    isActive: product.isActive !== false,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

function stockLabel(product) {
  if (product.stock <= 0) {
    return <span className="rounded-full bg-red-100 dark:bg-red-950/60 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">Out</span>;
  }

  if (product.stock <= product.lowStockThreshold) {
    return <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">Low ({product.stock})</span>;
  }

  return <span className="font-extrabold text-[var(--pos-action)]">{product.stock.toLocaleString()}</span>;
}

function parseCsv(text, exchangeRate = 4100) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(",").map((header) => header.trim().toLowerCase()) || [];

  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((value) => value.trim());
    const row = headers.reduce((entry, header, headerIndex) => ({ ...entry, [header]: values[headerIndex] || "" }), {});
    const product = normalizeProduct({
      id: row.sku || `csv-${Date.now()}-${index}`,
      name: row.name,
      sku: row.sku,
      category: row.category,
      price: row.price || row.price_usd,
      price_khr: row.price_khr,
      stock: row.stock,
    }, exchangeRate);

    return {
      ...product,
      rowNumber: index + 2,
      errors: [!product.name ? "Missing name" : "", !product.price ? "Missing price" : ""].filter(Boolean),
    };
  });
}

export default function PosProductsPage() {
  const { isOnline } = useOffline();
  const { settings } = usePOSSettings();
  const fileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeSection, setActiveSection] = useState("products");
  const [localCategories, setLocalCategories] = useState([]);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [categoryNotice, setCategoryNotice] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("table");
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSynced, setLastSynced] = useState("Never");
  const [syncing, setSyncing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingProduct, setEditingProduct] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [importResult, setImportResult] = useState("");
  const primaryCurrency = settings.currency.primaryCurrency || "USD";
  const secondaryCurrency = primaryCurrency === "USD" ? "KHR" : "USD";

  function formatSecondaryPrice(value) {
    const converted = convertMoney(value, "USD", secondaryCurrency, settings.currency.exchangeRate);
    return formatMoney(converted, secondaryCurrency, settings.currency.exchangeRate, false);
  }

  const catalogVersion = usePosStore((state) => state.catalogVersion);
  const incrementCatalogVersion = usePosStore((state) => state.incrementCatalogVersion);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      const cached = await getProductsFromCache();
      if (active) {
        if (cached.length > 0) {
          setProducts(cached);
        } else {
          setProducts(mockProducts.map((p) => normalizeProduct(p, settings.currency.exchangeRate)));
        }
        setLastSynced(window.localStorage.getItem("pos-products-last-synced") || "Never");
        setLocalCategories(JSON.parse(window.localStorage.getItem("pos-local-categories") || "[]"));
      }

      if (!isOnline) {
        return;
      }

      await syncProducts(false);
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [isOnline, catalogVersion]);

  const productCategories = useMemo(
    () => products.map((product) => product.category || "General").filter(Boolean),
    [products]
  );
  const categoryNames = useMemo(
    () => [...new Set([...productCategories, ...localCategories].map((entry) => String(entry || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [localCategories, productCategories]
  );
  const categories = useMemo(() => ["All", ...categoryNames], [categoryNames]);
  const categoryRows = useMemo(
    () =>
      categoryNames.map((name) => {
        const categoryProducts = products.filter((product) => product.category === name);
        const activeProducts = categoryProducts.filter((product) => product.isActive).length;
        const stock = categoryProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0);
        return {
          name,
          productCount: categoryProducts.length,
          activeProducts,
          stock,
          isLocalOnly: categoryProducts.length === 0,
        };
      }),
    [categoryNames, products]
  );

  const visibleProducts = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !lower ||
        product.name.toLowerCase().includes(lower) ||
        product.sku.toLowerCase().includes(lower);
      const matchesCategory = category === "All" || product.category === category;
      const matchesStatus =
        status === "all" ||
        (status === "active" && product.isActive) ||
        (status === "inactive" && !product.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [category, products, query, sortBy, status]);

  async function persistProducts(nextProducts) {
    setProducts(nextProducts);
    await saveProductsToCache(nextProducts);
    incrementCatalogVersion();
  }

  function persistLocalCategories(nextCategories) {
    const normalized = [...new Set(nextCategories.map((entry) => String(entry || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    setLocalCategories(normalized);
    window.localStorage.setItem("pos-local-categories", JSON.stringify(normalized));
  }

  function addCategory() {
    const nextName = categoryDraft.trim();
    setCategoryNotice("");

    if (!nextName) {
      setCategoryNotice("Enter a category name first.");
      return;
    }

    if (categoryNames.some((name) => name.toLowerCase() === nextName.toLowerCase())) {
      setCategoryNotice("That category already exists.");
      return;
    }

    persistLocalCategories([...localCategories, nextName]);
    setCategoryDraft("");
    setCategoryNotice(`Category "${nextName}" added locally.`);
  }

  async function renameCategory(oldName) {
    const nextName = editingCategoryName.trim();
    setCategoryNotice("");

    if (!nextName) {
      setCategoryNotice("Enter a new category name.");
      return;
    }

    if (nextName === oldName) {
      setEditingCategory("");
      setEditingCategoryName("");
      return;
    }

    const nextProducts = products.map((product) =>
      product.category === oldName ? { ...product, category: nextName, updatedAt: new Date().toISOString() } : product
    );
    const nextLocalCategories = localCategories.map((name) => (name === oldName ? nextName : name));

    await persistProducts(nextProducts);
    persistLocalCategories(nextLocalCategories.includes(nextName) ? nextLocalCategories : [...nextLocalCategories, nextName]);
    setCategory(nextName);
    setEditingCategory("");
    setEditingCategoryName("");
    setCategoryNotice(`Category "${oldName}" renamed to "${nextName}".`);
  }

  function deleteCategory(name) {
    const productCount = products.filter((product) => product.category === name).length;
    setCategoryNotice("");

    if (productCount > 0) {
      setCategoryNotice("Move or rename products before deleting a category that is in use.");
      return;
    }

    persistLocalCategories(localCategories.filter((entry) => entry !== name));
    setCategoryNotice(`Category "${name}" deleted.`);
  }

  async function syncProducts(showLoading = true) {
    if (showLoading) {
      setSyncing(true);
    }

    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const rawProducts = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      if (rawProducts.length) {
        const saved = await saveProductsToCache(rawProducts);
        if (saved) {
          setProducts(saved);
        }
        const timestamp = new Date().toLocaleString();
        window.localStorage.setItem("pos-products-last-synced", timestamp);
        setLastSynced(timestamp);
      }
    } catch {
      // Keep local products when server sync is unavailable.
    } finally {
      setSyncing(false);
    }
  }

  async function saveProduct(product, mode) {
    const method = mode === "edit" ? "PATCH" : "POST";

    try {
      await fetch("/api/admin/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    } catch {
      // Local IndexedDB update still happens so POS remains offline-capable.
    }

    const nextProducts =
      mode === "edit"
        ? products.map((entry) => (entry.id === product.id ? normalizeProduct(product, settings.currency.exchangeRate) : entry))
        : [normalizeProduct(product, settings.currency.exchangeRate), ...products];
    await persistProducts(nextProducts);
    setModalOpen(false);
  }

  async function deleteProducts(ids) {
    const idSet = new Set(ids);
    try {
      await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Continue with local delete.
    }

    await Promise.all(ids.map((id) => remove("products", id)));
    setProducts((current) => current.filter((product) => !idSet.has(product.id)));
    setSelectedIds([]);
  }

  async function bulkStatus(isActive) {
    const idSet = new Set(selectedIds);
    const nextProducts = products.map((product) => (idSet.has(product.id) ? { ...product, isActive } : product));
    try {
      await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, isActive }),
      });
    } catch {}
    await persistProducts(nextProducts);
    setSelectedIds([]);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setModalMode("edit");
    setModalOpen(true);
  }

  function openAdd() {
    setEditingProduct(null);
    setModalMode("add");
    setModalOpen(true);
  }

  function handleCsvFile(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCsvRows(parseCsv(String(reader.result || ""), settings.currency.exchangeRate));
    reader.readAsText(file);
  }

  async function importCsvRows() {
    const validRows = csvRows.filter((row) => !row.errors.length);
    try {
      await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: validRows }),
      });
    } catch {}

    const nextProducts = [...validRows.map((product) => normalizeProduct(product, settings.currency.exchangeRate)), ...products];
    await persistProducts(nextProducts);
    setImportResult(`Imported ${validRows.length} rows. ${csvRows.length - validRows.length} errors.`);
    setCsvRows([]);
  }

  function toggleSelected(id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  return (
    <div className="space-y-5 transition-colors">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Products</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">Product Catalog</h1>
          <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">Last synced {lastSynced}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button" 
            onClick={openAdd} 
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-3.5 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98]"
          >
            <Plus className="size-4" />
            Add Product
          </button>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
          >
            <Download className="size-4" />
            Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => handleCsvFile(event.target.files?.[0])} className="hidden" />
          <button 
            type="button" 
            onClick={() => syncProducts()} 
            disabled={syncing} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Server"}
          </button>
          <div className="grid grid-cols-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-1">
            <button 
              type="button" 
              onClick={() => setView("table")} 
              className={view === "table" ? "rounded-lg bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-extrabold text-[var(--foreground)] shadow-xs transition-all" : "px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)]"}
            >
              Table
            </button>
            <button 
              type="button" 
              onClick={() => setView("grid")} 
              className={view === "grid" ? "rounded-lg bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-extrabold text-[var(--foreground)] shadow-xs transition-all" : "px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)]"}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-1 shadow-xs sm:inline-grid sm:w-auto sm:grid-cols-2">
        {[
          ["products", "Products"],
          ["categories", "Categories"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={
              activeSection === key
                ? "rounded-xl bg-[var(--pos-action)] px-4 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs"
                : "rounded-xl px-4 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === "products" ? (
        <>
      <div className="grid gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3.5 shadow-xs lg:grid-cols-[minmax(0,1fr)_12rem_12rem_10rem_auto]">
        <input 
          value={query} 
          onChange={(event) => setQuery(event.target.value)} 
          placeholder="Search by name or SKU..." 
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors placeholder:text-[var(--muted-foreground)]" 
        />
        <select 
          value={category} 
          onChange={(event) => setCategory(event.target.value)} 
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors"
        >
          {categories.map((entry) => <option key={entry} value={entry}>{entry === "All" ? "All Categories" : entry}</option>)}
        </select>
        <select 
          value={sortBy} 
          onChange={(event) => setSortBy(event.target.value)} 
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors"
        >
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="price-asc">Price Low-High</option>
          <option value="price-desc">Price High-Low</option>
          <option value="stock-asc">Stock Low-High</option>
          <option value="stock-desc">Stock High-Low</option>
          <option value="newest">Newest</option>
        </select>
        <select 
          value={status} 
          onChange={(event) => setStatus(event.target.value)} 
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <div className="flex items-center text-xs font-bold text-[var(--muted-foreground)] px-1">
          {visibleProducts.length} of {products.length}
        </div>
      </div>

      {selectedIds.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-bold text-amber-900 dark:text-amber-300">
          <span>{selectedIds.length} selected</span>
          <button type="button" onClick={() => bulkStatus(true)} className="rounded-lg bg-white dark:bg-amber-900/40 px-3 py-1.5 shadow-xs text-amber-950 dark:text-amber-200">Set Active</button>
          <button type="button" onClick={() => bulkStatus(false)} className="rounded-lg bg-white dark:bg-amber-900/40 px-3 py-1.5 shadow-xs text-amber-950 dark:text-amber-200">Set Inactive</button>
          <button type="button" onClick={() => deleteProducts(selectedIds)} className="rounded-lg bg-red-600 px-3 py-1.5 text-white shadow-xs">Delete Selected</button>
        </div>
      ) : null}

      {csvRows.length ? (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">CSV Preview ({csvRows.length} rows)</h2>
            <button type="button" onClick={importCsvRows} className="rounded-xl bg-[var(--pos-action)] px-4 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs">
              Import {csvRows.filter((row) => !row.errors.length).length} valid rows
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead><tr className="bg-[var(--surface-soft)] text-[var(--muted-foreground)]"><th className="px-3 py-2">Row</th><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Errors</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {csvRows.map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50 dark:bg-red-950/40" : ""}>
                    <td className="px-3 py-2 font-bold">{row.rowNumber}</td><td>{row.name}</td><td>{row.sku}</td><td>{row.category}</td><td>{formatPrimaryMoney(row.price, settings, false)}</td><td>{row.stock}</td><td className="text-red-600 dark:text-red-400">{row.errors.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {importResult ? <div className="rounded-xl bg-[var(--pos-action-surface)] px-4 py-3 text-xs font-bold text-[var(--pos-action-on-muted)]">{importResult}</div> : null}

      {view === "table" ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-xs">
              <thead className="bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={selectedIds.length === visibleProducts.length && visibleProducts.length > 0} onChange={(event) => setSelectedIds(event.target.checked ? visibleProducts.map((product) => product.id) : [])} /></th>
                  <th className="px-4 py-3">Image</th><th className="px-4 py-3">Name &amp; SKU</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Display ({primaryCurrency})</th><th className="px-4 py-3">Converted ({secondaryCurrency})</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {visibleProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--surface-soft)] bg-cover bg-center font-black text-[var(--muted-foreground)]" style={product.image ? { backgroundImage: `url(${product.image})` } : undefined}>
                        {product.image ? "" : product.name.charAt(0)}
                      </div>
                    </td>
                    <td className="px-4 py-3"><p className="font-extrabold text-[var(--foreground)]">{product.name}</p><p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{product.sku}</p></td>
                    <td className="px-4 py-3 font-semibold text-[var(--muted-foreground)]">{product.category}</td>
                    <td className="px-4 py-3 font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(product.price, settings, false)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--muted-foreground)]">{formatSecondaryPrice(product.price)}</td>
                    <td className="px-4 py-3">{stockLabel(product)}</td>
                    <td className="px-4 py-3">
                      <span className={product.isActive ? "rounded-full bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--pos-action-on-muted)]" : "rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--muted-foreground)]"}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button" 
                          onClick={() => openEdit(product)} 
                          className="grid size-7 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
                          title="Edit product"
                          aria-label="Edit product"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => window.confirm("Delete this product?") && deleteProducts([product.id])} 
                          className="grid size-7 place-items-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                          title="Delete product"
                          aria-label="Delete product"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <article key={product.id} className="group overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-xs transition-all hover:border-[var(--pos-action)]/40">
              <div className="relative flex h-40 items-center justify-center bg-[var(--surface-soft)] bg-cover bg-center text-3xl font-extrabold text-[var(--muted-foreground)]" style={product.image ? { backgroundImage: `url(${product.image})` } : undefined}>
                {product.image ? "" : product.name.charAt(0)}
                <button type="button" onClick={() => openEdit(product)} className="absolute inset-x-3 bottom-3 hidden rounded-lg bg-[var(--foreground)]/90 backdrop-blur-xs py-2 text-xs font-bold text-[var(--background)] group-hover:block transition-all">Edit Product</button>
              </div>
              <div className="p-3.5">
                <p className="font-extrabold text-xs text-[var(--foreground)]">{product.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-foreground)]">{product.sku} · {product.category}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--foreground)]">{formatPrimaryMoney(product.price, settings, false)}</p>
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{formatSecondaryPrice(product.price)}</p>
                  </div>
                  <div>{stockLabel(product)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
        </>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pos-action-surface)] text-[var(--pos-action-on-muted)]">
                  <Tags className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-[var(--foreground)]">Category Management</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Organize local POS product groups for faster filtering and cashier workflows.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Categories</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{categoryRows.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Assigned Products</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{products.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Empty</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{categoryRows.filter((row) => row.isLocalOnly).length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">New Category</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={categoryDraft}
                  onChange={(event) => setCategoryDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addCategory();
                  }}
                  placeholder="e.g. Cold Drinks"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--pos-action)]"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--pos-action)] px-3.5 py-2 text-xs font-extrabold text-[var(--pos-action-fg)]"
                >
                  <Plus className="size-4" />
                  Add
                </button>
              </div>
              {categoryNotice ? (
                <p className="mt-3 rounded-xl bg-[var(--pos-action-surface)] px-3 py-2 text-xs font-bold text-[var(--pos-action-on-muted)]">
                  {categoryNotice}
                </p>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {categoryRows.map((row) => (
                    <tr key={row.name} className="hover:bg-[var(--surface-soft)]/50">
                      <td className="px-4 py-3">
                        {editingCategory === row.name ? (
                          <input
                            value={editingCategoryName}
                            onChange={(event) => setEditingCategoryName(event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                          />
                        ) : (
                          <div>
                            <p className="font-extrabold text-[var(--foreground)]">{row.name}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-foreground)]">
                              {row.isLocalOnly ? "Empty local category" : "Used in product catalog"}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-[var(--foreground)]">{row.productCount}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--muted-foreground)]">{row.activeProducts}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--muted-foreground)]">{row.stock.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {editingCategory === row.name ? (
                            <>
                              <button type="button" onClick={() => renameCategory(row.name)} className="rounded-lg bg-[var(--pos-action)] px-3 py-1.5 text-xs font-extrabold text-[var(--pos-action-fg)]">Save</button>
                              <button type="button" onClick={() => { setEditingCategory(""); setEditingCategoryName(""); }} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)]">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(row.name);
                                  setEditingCategoryName(row.name);
                                  setCategoryNotice("");
                                }}
                                className="grid size-8 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                                title="Rename category"
                                aria-label="Rename category"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCategory(row.name)}
                                className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
                                title="Delete empty category"
                                aria-label="Delete empty category"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <ProductFormModal
        open={modalOpen}
        mode={modalMode}
        product={editingProduct}
        categories={categories.filter((entry) => entry !== "All")}
        exchangeRate={settings.currency.exchangeRate}
        onClose={() => setModalOpen(false)}
        onSave={saveProduct}
      />
    </div>
  );
}

"use client";

import { ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CartItem } from "@/components/pos/CartItem";
import { convertMoney, formatDisplayMoney } from "@/components/pos/format";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { ProductCard } from "@/components/pos/ProductCard";
import { ReceiptView } from "@/components/pos/ReceiptView";
import { RepriceModal } from "@/components/pos/RepriceModal";
import { VariantSelectorModal } from "@/components/pos/VariantSelectorModal";
import { BarcodeScannerModal, useCameraBarcodeScanner } from "@/components/shared/barcode-scanner";
import { useBarcodeScannerInput } from "@/hooks/useBarcodeScannerInput";
import { useOffline } from "@/hooks/useOffline";
import { usePOSSettings } from "@/hooks/usePOSSettings";
import { addToQueue, getAll, getProductsFromCache, put, saveProductsToCache, updateLocalStock } from "@/lib/db";
import { replayQueue } from "@/lib/sync";
import { usePosStore } from "@/store/posStore";

const mockProducts = [
  {
    id: "angkor-beer",
    name: "Angkor Premium Beer",
    sku: "BEER-001",
    category: "Beverages",
    price: 0.85,
    stock: 120,
    image: "",
    isActive: true,
    variants: [
      {
        id: "var-can-330",
        name: "Can 330ml",
        sku: "BEER-001-CAN",
        price: 0.85,
        stock: 48,
        attributeValues: [{ attributeName: "Volume", value: "330ml" }, { attributeName: "Unit", value: "Can" }],
      },
      {
        id: "var-btl-640",
        name: "Bottle 640ml",
        sku: "BEER-001-BTL",
        price: 1.5,
        stock: 24,
        attributeValues: [{ attributeName: "Volume", value: "640ml" }, { attributeName: "Unit", value: "Bottle" }],
      },
      {
        id: "var-case-24",
        name: "Case (24x Cans)",
        sku: "BEER-001-CASE",
        price: 18.5,
        stock: 10,
        attributeValues: [{ attributeName: "Packaging", value: "Case 24x" }],
      },
    ],
  },
  {
    id: "angkor-rice",
    name: "Angkor Premium Jasmine Rice 5kg",
    sku: "RICE-001",
    category: "Rice",
    price: 7.8,
    stock: 18,
    image: "",
    isActive: true,
  },
  {
    id: "kampot-pepper",
    name: "Kampot Black Pepper",
    sku: "SPICE-004",
    category: "Spices",
    price: 5.37,
    stock: 20,
    image: "",
    isActive: true,
    variants: [
      {
        id: "var-pep-100g",
        name: "100g Bag",
        sku: "SPICE-004-100",
        price: 5.37,
        stock: 12,
        attributeValues: [{ attributeName: "Weight", value: "100g" }],
      },
      {
        id: "var-pep-500g",
        name: "500g Pack",
        sku: "SPICE-004-500",
        price: 22.0,
        stock: 8,
        attributeValues: [{ attributeName: "Weight", value: "500g" }],
      },
    ],
  },
  { id: "iced-coffee", name: "Cambodian Iced Coffee", sku: "DRINK-010", category: "Drinks", price: 0.98, stock: 24, image: "", isActive: true },
  { id: "fish-sauce", name: "Fish Sauce Bottle", sku: "SAUCE-002", category: "Sauce", price: 1.59, stock: 5, image: "", isActive: true },
  { id: "palm-sugar", name: "Palm Sugar 500g", sku: "SWEET-003", category: "Grocery", price: 2.2, stock: 3, image: "", isActive: true },
  { id: "nom-banh-chok", name: "Fresh Nom Banh Chok Noodles", sku: "NOOD-008", category: "Noodles", price: 1.34, stock: 0, image: "", isActive: true },
  { id: "coconut-water", name: "Fresh Coconut Water", sku: "DRINK-011", category: "Drinks", price: 1.22, stock: 14, image: "", isActive: true },
  { id: "banana-chips", name: "Banana Chips Pack", sku: "SNACK-020", category: "Snacks", price: 1.83, stock: 11, image: "", isActive: true },
];

function createTransactionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `txn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function generateLocalReceiptNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `SALE-${datePart}-`;

  try {
    const localTxns = await getAll("transactions");
    const todayMatches = (Array.isArray(localTxns) ? localTxns : []).filter((t) => {
      const num = String(t?.receiptNumber || t?.id || "");
      return num.startsWith(prefix);
    });

    let maxSeq = 0;
    for (const txn of todayMatches) {
      const num = String(txn.receiptNumber || txn.id || "");
      const match = num.match(new RegExp(`^${prefix}(\\d+)`));
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (parsed > maxSeq) maxSeq = parsed;
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    return `${prefix}${nextSeq}`;
  } catch {
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
}

function normalizeProduct(product) {
  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  const variants = rawVariants.map((v) => ({
    id: v.id,
    name: v.name || "Default",
    sku: v.sku || product.sku || product.id,
    price: Number(v.discountedPrice ?? v.price ?? product.price ?? 0),
    originalPrice: Number(v.price ?? product.price ?? 0),
    discountPercent: Number(v.discountPercent || 0),
    stock: Number(v.stock ?? product.stock ?? 0),
    attributeValues: Array.isArray(v.attributeValues) ? v.attributeValues : [],
    isActive: v.isActive !== false,
  }));

  const prices = variants.map((v) => v.price);
  const basePrice = (product.displayPrice ?? product.price) || 0;
  const minPrice = prices.length ? Math.min(...prices) : Number(basePrice);
  const maxPrice = prices.length ? Math.max(...prices) : Number(basePrice);

  return {
    id: product.id,
    name: product.name,
    sku: product.sku || product.id,
    category: product.category || "General",
    price: Number(basePrice),
    minPrice,
    maxPrice,
    stock: Number(product.stock || 0),
    image: product.image || product.imageUrl || "",
    isActive: product.isActive !== false,
    variants,
  };
}

export default function NewSalePage() {
  const { isOnline } = useOffline();
  const { settings } = usePOSSettings();
  const cartState = usePosStore((state) => state.cart);
  const heldSalesState = usePosStore((state) => state.heldSales);
  const addToCart = usePosStore((state) => state.addToCart);
  const updateQty = usePosStore((state) => state.updateQty);
  const removeFromCart = usePosStore((state) => state.removeFromCart);
  const updateItemNote = usePosStore((state) => state.updateItemNote);
  const repriceItem = usePosStore((state) => state.repriceItem);
  const resetItemPrice = usePosStore((state) => state.resetItemPrice);
  const clearCart = usePosStore((state) => state.clearCart);
  const holdCurrentSale = usePosStore((state) => state.holdCurrentSale);
  const restoreHeldSale = usePosStore((state) => state.restoreHeldSale);
  const cashierName = usePosStore((state) => state.cashierName);
  const pendingSyncCount = usePosStore((state) => state.pendingSyncCount);
  const setPendingSyncCount = usePosStore((state) => state.setPendingSyncCount);
  const addLocalNotification = usePosStore((state) => state.addLocalNotification);

  const cart = Array.isArray(cartState) ? cartState : [];
  const heldSales = Array.isArray(heldSalesState) ? heldSalesState : [];

  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [lastSynced, setLastSynced] = useState("Never");
  const [displayCurrency, setDisplayCurrency] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState({ type: "percent", value: 0, amount: 0 });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [variantModalProduct, setVariantModalProduct] = useState(null);
  const [repriceItemData, setRepriceItemData] = useState(null);

  const catalogVersion = usePosStore((state) => state.catalogVersion);
  const incrementCatalogVersion = usePosStore((state) => state.incrementCatalogVersion);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      if (active) {
        setLastSynced(window.localStorage.getItem("pos-products-last-synced") || "Never");
      }

      const cached = await getProductsFromCache();
      if (active) {
        if (cached.length > 0) {
          setProducts(cached);
        } else {
          setProducts(mockProducts.map(normalizeProduct));
        }
      }

      if (!active || !isOnline) {
        return;
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
          const timestamp = new Date().toLocaleString();
          window.localStorage.setItem("pos-products-last-synced", timestamp);

          if (active && saved) {
            setProducts(saved);
            setLastSynced(timestamp);
          }
        }
      } catch {
        // Keeps cached IndexedDB products
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [isOnline, catalogVersion]);

  const categories = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    return ["All", ...new Set(safeProducts.map((product) => product.category))];
  }, [products]);

  const categoryCounts = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    const counts = { All: safeProducts.length };
    for (const product of safeProducts) {
      counts[product.category] = (counts[product.category] || 0) + 1;
    }
    return counts;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const safeProducts = Array.isArray(products) ? products : [];

    return safeProducts.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesQuery =
        !lower ||
        product.name.toLowerCase().includes(lower) ||
        product.sku.toLowerCase().includes(lower) ||
        String(product.barcode || "").toLowerCase().includes(lower) ||
        (product.variants &&
          product.variants.some(
            (v) =>
              v.name.toLowerCase().includes(lower) ||
              v.sku.toLowerCase().includes(lower) ||
              String(v.barcode || "").toLowerCase().includes(lower)
          ));
      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);

  // ── Barcode scanning: local catalog first (works offline), then API lookup ──
  const [scanState, setScanState] = useState({ status: "idle", message: "" });
  const scanStateTimer = useRef(null);

  function showScanStatus(status, message) {
    setScanState({ status, message });
    if (scanStateTimer.current) {
      window.clearTimeout(scanStateTimer.current);
    }
    scanStateTimer.current = window.setTimeout(() => setScanState({ status: "idle", message: "" }), 4000);
  }

  function findLocalProductByCode(code) {
    const needle = code.trim().toLowerCase();
    for (const product of Array.isArray(products) ? products : []) {
      if (
        String(product.barcode || "").toLowerCase() === needle ||
        String(product.sku || "").toLowerCase() === needle
      ) {
        return { product, variantId: null };
      }
      for (const variant of product.variants || []) {
        if (
          String(variant.barcode || "").toLowerCase() === needle ||
          String(variant.sku || "").toLowerCase() === needle
        ) {
          return { product, variantId: variant.id };
        }
      }
    }
    return null;
  }

  function addLookedUpProduct(product, variantId) {
    const variant = variantId ? (product.variants || []).find((entry) => entry.id === variantId) : null;
    if (variant) {
      addToCart(product, variant);
      showScanStatus("success", `Added ${variant.name && variant.name !== "Default" ? `${product.name} (${variant.name})` : product.name}`);
    } else if (product.variants && product.variants.length > 1) {
      setVariantModalProduct(product);
      showScanStatus("success", `Select a variant for ${product.name}`);
    } else {
      addToCart(product);
      showScanStatus("success", `Added ${product.name}`);
    }
  }

  const handleBarcodeScan = useCallback(
    async (code) => {
      const clean = String(code || "").trim();
      if (!clean) {
        return;
      }

      const local = findLocalProductByCode(clean);
      if (local) {
        addLookedUpProduct(local.product, local.variantId);
        return;
      }

      if (!isOnline) {
        showScanStatus("error", `Product with barcode ${clean} was not found.`);
        return;
      }

      try {
        const response = await fetch(`/api/products/lookup?barcode=${encodeURIComponent(clean)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (response.ok && payload.data?.product) {
          addLookedUpProduct(payload.data.product, payload.data.variantId);
          return;
        }
        showScanStatus("error", `Product with barcode ${clean} was not found.`);
      } catch {
        showScanStatus("error", `Product with barcode ${clean} was not found.`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, isOnline, addToCart]
  );

  // Physical USB/Bluetooth scanners emulate keyboard input ending in Enter.
  useBarcodeScannerInput({ enabled: true, onScan: handleBarcodeScan });

  const scanner = useCameraBarcodeScanner({ onDetected: handleBarcodeScan });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0); const taxBase = Math.max(0, subtotal - appliedDiscount.amount);
  const tax = settings.tax.enabled
    ? settings.tax.taxType === "inclusive"
      ? Number((taxBase - taxBase / (1 + settings.tax.taxRate / 100)).toFixed(2))
      : Number((taxBase * (settings.tax.taxRate / 100)).toFixed(2))
    : 0;
  const total = Number(
    Math.max(0, taxBase + (settings.tax.enabled && settings.tax.taxType === "exclusive" ? tax : 0)).toFixed(2)
  );
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const activeDisplayCurrency = displayCurrency || settings.currency.primaryCurrency || "USD";
  const money = (value, showBoth = true) => formatDisplayMoney(value, activeDisplayCurrency, settings, showBoth);

  function handleProductAdd(product) {
    if (product.variants && product.variants.length > 1) {
      setVariantModalProduct(product);
    } else {
      addToCart(product);
    }
  }

  function applyDiscount(value = discountValue, type = discountType) {
    const numericValue = Number(value || 0);
    if (!settings.discount.enabled || !numericValue) {
      setAppliedDiscount({ type, value: 0, amount: 0 });
      return;
    }

    if (type === "percent") {
      const max = Number(settings.discount.maxDiscountPercent || 0);
      const threshold = Number(settings.discount.managerPinThresholdPercent || 0);
      if (numericValue > max || (numericValue > threshold && managerPin !== settings.cashiers.managerPin)) {
        return;
      }

      setAppliedDiscount({
        type,
        value: numericValue,
        amount: Number((subtotal * (numericValue / 100)).toFixed(2)),
      });
      return;
    }

    const discountAmountUsd = convertMoney(numericValue, activeDisplayCurrency, "USD", settings.currency.exchangeRate);
    setAppliedDiscount({
      type,
      value: numericValue,
      amount: Number(Math.min(discountAmountUsd, subtotal).toFixed(2)),
    });
  }

  async function confirmPayment(payment) {
    const txnId = createTransactionId();
    const receiptNumber = await generateLocalReceiptNumber();
    const transaction = {
      id: txnId,
      receiptNumber,
      items: cart,
      subtotal,
      tax,
      discount: appliedDiscount.amount,
      total,
      cashReceived: payment.cashReceived,
      changeDue: payment.changeDue,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference || "",
      cashierName: payment.cashierName || cashierName || "Cashier",
      currency: payment.currency,
      timestamp: new Date().toISOString(),
      synced: false,
      syncStatus: "pending",
    };

    // 1. Save transaction locally
    await put("transactions", transaction);

    // 2. Decrement stock locally in IndexedDB for every sold item
    for (const item of cart) {
      await updateLocalStock(item.productId, item.variantId, item.qty);
    }

    // 3. Update products state in UI to reflect deducted stock
    const updatedLocalProducts = await getAll("products");
    if (Array.isArray(updatedLocalProducts) && updatedLocalProducts.length > 0) {
      setProducts(updatedLocalProducts.map(normalizeProduct));
    }

    // 4. If online, sync directly to PostgreSQL immediately so reports update in real-time
    let finalTransaction = transaction;
    if (isOnline) {
      try {
        const response = await fetch("/api/pos/transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transaction),
        });
        const payload = await response.json();
        if (response.ok && payload?.data) {
          finalTransaction = {
            ...transaction,
            synced: true,
            syncStatus: "synced",
            receiptNumber: payload.data.receiptNumber || transaction.receiptNumber,
          };
          await put("transactions", finalTransaction);
        } else {
          // Fall back to queue if backend returned an unexpected response
          await addToQueue({
            url: "/api/pos/transaction",
            method: "POST",
            body: JSON.stringify(transaction),
          });
          addLocalNotification({
            type: "info",
            title: "Sale Saved Offline",
            message: `Sale #${receiptNumber} saved offline. Will sync when online.`,
            receiptNumber,
          });
        }
      } catch {
        // Fall back to queue if network error occurs
        await addToQueue({
          url: "/api/pos/transaction",
          method: "POST",
          body: JSON.stringify(transaction),
        });
        addLocalNotification({
          type: "info",
          title: "Sale Saved Offline",
          message: `Sale #${receiptNumber} saved offline. Will sync when online.`,
          receiptNumber,
        });
      }
    } else {
      await addToQueue({
        url: "/api/pos/transaction",
        method: "POST",
        body: JSON.stringify(transaction),
      });
      addLocalNotification({
        type: "info",
        title: "Sale Saved Offline",
        message: `Sale #${receiptNumber} saved offline. Will sync when online.`,
        receiptNumber,
      });
    }

    const queue = await getAll("offline_queue");
    setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);

    clearCart();
    setPaymentOpen(false);
    setDrawerOpen(false);
    setAppliedDiscount({ type: "percent", value: 0, amount: 0 });
    setReceipt(finalTransaction);
  }

  if (receipt) {
    return <ReceiptView transaction={receipt} settings={settings} onNewSale={() => setReceipt(null)} />;
  }

  const checkoutPanel = (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-sm text-[var(--foreground)] transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-black tracking-tight">Current Sale</h2>
          <span className="rounded-full bg-[var(--pos-action-surface)] px-2.5 py-0.5 text-xs font-bold text-[var(--pos-action-on-muted)]">
            {itemCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {cart.length ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear all cart items?")) {
                  clearCart();
                }
              }}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
            >
              Clear All
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--muted-foreground)] md:hidden"
            aria-label="Close cart"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-3 min-h-[20rem] flex-1 space-y-2 overflow-y-auto pr-1">
        {cart.length ? (
          cart.map((item) => {
            const key = item.keyId || item.productId;
            return (
              <CartItem
                key={key}
                item={item}
                settings={settings}
                displayCurrency={activeDisplayCurrency}
                onUpdateQty={(qty) => updateQty(key, qty)}
                onRemove={() => removeFromCart(key)}
                onUpdateNote={(note) => updateItemNote(key, note)}
                onReprice={() => setRepriceItemData(item)}
              />
            );
          })
        ) : (
          <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-soft)] p-6 text-center text-xs font-semibold text-[var(--muted-foreground)]">
            <p>No items in cart</p>
            <p className="mt-1 text-[11px] opacity-75">Click any product to add it to the sale</p>
          </div>
        )}
      </div>

      <div className="mt-3 shrink-0 space-y-2 border-t border-[var(--border-soft)] pt-3">
        <div className="flex justify-between text-xs font-semibold text-[var(--muted-foreground)]">
          <span>Subtotal</span>
          <span className="font-bold text-[var(--foreground)]">{money(subtotal)}</span>
        </div>
        {appliedDiscount.amount > 0 ? (
          <div className="flex justify-between text-xs font-bold text-[var(--pos-action)]">
            <span>Discount</span>
            <span>-{money(appliedDiscount.amount)}</span>
          </div>
        ) : null}
        {settings.tax.enabled ? (
          <div className="flex justify-between text-xs font-semibold text-[var(--muted-foreground)]">
            <span>{settings.tax.taxName}</span>
            <span className="font-bold text-[var(--foreground)]">{money(tax)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 text-lg font-black text-[var(--foreground)]">
          <span>Total</span>
          <span className="text-right">{money(total)}</span>
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-[var(--surface-soft)] p-1 border border-[var(--border-soft)]">
          {["KHR", "USD"].map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => setDisplayCurrency(currency)}
              className={
                activeDisplayCurrency === currency
                  ? "rounded-md bg-[var(--surface-strong)] py-1 text-xs font-extrabold text-[var(--foreground)] shadow-xs transition-all"
                  : "py-1 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              }
            >
              {currency}
            </button>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setDiscountOpen((value) => !value)}
            className="text-xs font-bold text-[var(--pos-action)] hover:underline"
          >
            {appliedDiscount.amount > 0 ? "Edit Discount" : "+ Add Discount"}
          </button>
          {discountOpen ? (
            <div className="mt-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                <div className="grid grid-cols-2 gap-1 border border-[var(--border-soft)] rounded-lg p-0.5 bg-[var(--surface-strong)]">
                  {["percent", "fixed"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDiscountType(type)}
                      className={
                        discountType === type
                          ? "rounded-md bg-[var(--pos-action)] py-1 text-xs font-bold text-[var(--pos-action-fg)]"
                          : "py-1 text-xs font-bold text-[var(--muted-foreground)]"
                      }
                    >
                      {type === "percent" ? "%" : "Fixed"}
                    </button>
                  ))}
                </div>
                <input
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  type="number"
                  placeholder="0"
                  className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 py-1 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                />
              </div>
              {discountType === "percent" &&
                Number(discountValue || 0) > Number(settings.discount.managerPinThresholdPercent || 0) ? (
                <input
                  value={managerPin}
                  onChange={(event) => setManagerPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Manager PIN"
                  className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 py-1 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                />
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {settings.discount.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyDiscount(preset, "percent")}
                    className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
                  >
                    {preset}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyDiscount()}
                  className="ml-auto rounded-full bg-[var(--pos-action)] px-3 py-1 text-xs font-bold text-[var(--pos-action-fg)]"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!cart.length}
          onClick={() => setPaymentOpen(true)}
          className="w-full rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-3 text-base font-black text-[var(--pos-action-fg)] disabled:opacity-40 transition-all active:scale-[0.98] shadow-xs"
        >
          Charge {money(total)}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)] md:min-h-[44rem]">
      <div className="min-h-[calc(100dvh-2rem)] md:grid md:h-full md:min-h-0 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="min-h-[36rem] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-xs md:min-h-0 text-[var(--foreground)] transition-colors flex flex-col">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    // A scanner typing into the focused search box ends with
                    // Enter — treat it as an exact barcode/SKU lookup first.
                    if (event.key === "Enter") {
                      const value = query.trim();
                      if (value.length >= 4 && !value.includes(" ")) {
                        event.preventDefault();
                        handleBarcodeScan(value);
                      }
                    }
                  }}
                  placeholder="Search product name, SKU, barcode, or variant…"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)] transition-colors placeholder:text-[var(--muted-foreground)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={scanner.openScanner}
                title="Scan barcode with camera"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--pos-action)] px-3 py-2.5 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all hover:bg-[var(--pos-action-hover)] active:scale-[0.98]"
              >
                <ScanLine className="size-4" />
                Scan
              </button>
            </div>
            <button
              type="button"
              onClick={holdCurrentSale}
              disabled={!cart.length}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              Hold Sale
            </button>
          </div>

          {scanState.status !== "idle" ? (
            <p
              className={
                scanState.status === "success"
                  ? "rounded-lg bg-[var(--pos-action-surface)] px-3 py-2 text-xs font-bold text-[var(--pos-action-on-muted)]"
                  : "rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-400"
              }
              role="status"
            >
              {scanState.message}
            </p>
          ) : null}

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                className={
                  category === entry
                    ? "shrink-0 rounded-full bg-[var(--pos-action)] px-3.5 py-1.5 text-xs font-bold text-[var(--pos-action-fg)] transition-all shadow-xs"
                    : "shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all"
                }
              >
                {entry} <span className="ml-1 opacity-70">({categoryCounts[entry] || 0})</span>
              </button>
            ))}
          </div>

          {heldSales.length ? (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <span className="shrink-0 text-xs font-bold text-amber-900 dark:text-amber-300">Held Sales:</span>
              {heldSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => restoreHeldSale(sale.id)}
                  className="shrink-0 rounded-full bg-white dark:bg-amber-900/50 px-2.5 py-1 text-xs font-bold text-amber-900 dark:text-amber-200 shadow-xs hover:bg-amber-100 transition-colors"
                >
                  {sale.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            {visibleProducts.length ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    settings={settings}
                    onAdd={handleProductAdd}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center p-8 text-center text-xs font-semibold text-[var(--muted-foreground)]">
                <p className="text-sm font-bold text-[var(--foreground)]">No products found</p>
                <p className="mt-1">Try adjusting your search query or category filter.</p>
              </div>
            )}
          </div>
        </section>

        <div className="hidden min-h-0 w-full md:block">{checkoutPanel}</div>
      </div>

      {cart.length ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-40 rounded-xl bg-[var(--pos-action)] px-4 py-3.5 text-base font-extrabold text-[var(--pos-action-fg)] shadow-xl md:hidden"
        >
          View Cart ({itemCount} items) — {money(total, false)}
        </button>
      ) : null}

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="max-h-[96dvh] w-full" onClick={(event) => event.stopPropagation()}>
            {checkoutPanel}
          </div>
        </div>
      ) : null}

      <VariantSelectorModal
        open={Boolean(variantModalProduct)}
        product={variantModalProduct}
        settings={settings}
        onClose={() => setVariantModalProduct(null)}
        onSelectVariant={(product, variant) => {
          addToCart(product, variant);
        }}
      />

      <RepriceModal
        open={Boolean(repriceItemData)}
        item={repriceItemData ? cart.find((c) => (c.keyId || c.productId) === (repriceItemData.keyId || repriceItemData.productId)) || repriceItemData : null}
        settings={settings}
        displayCurrency={activeDisplayCurrency}
        onClose={() => setRepriceItemData(null)}
        onApply={(newPrice, reason) => {
          if (repriceItemData) {
            const key = repriceItemData.keyId || repriceItemData.productId;
            repriceItem(key, newPrice, reason);
          }
        }}
        onReset={() => {
          if (repriceItemData) {
            const key = repriceItemData.keyId || repriceItemData.productId;
            resetItemPrice(key);
          }
        }}
      />

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

      <PaymentModal
        open={paymentOpen}
        summary={{ subtotal, tax, discount: appliedDiscount.amount, total, itemCount }}
        settings={settings}
        displayCurrency={activeDisplayCurrency}
        cashierName={cashierName}
        onClose={() => setPaymentOpen(false)}
        onConfirm={confirmPayment}
      />
    </div>
  );
}

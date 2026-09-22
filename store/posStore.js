"use client";

import { create } from "zustand";

export const usePosStore = create((set, get) => ({
  cart: [],
  heldSales: [],
  cashierName: "",
  pendingSyncCount: 0,
  catalogVersion: 0,
  // Local POS notifications (offline events, stock warnings, sync status)
  localNotifications: [],
  addToCart(product, variant = null) {
    const currentCart = get().cart;
    const v = variant || (Array.isArray(product.variants) && product.variants.length === 1 ? product.variants[0] : null);
    const keyId = v?.id ? `${product.id}-${v.id}` : product.id;
    const stock = Number((v ? v.stock : product.stock) || 0);
    const price = Number((v ? (v.discountedPrice ?? v.price) : product.price) || 0);
    const name = v && v.name && v.name !== "Default" ? `${product.name} (${v.name})` : product.name;
    const sku = v?.sku || product.sku || product.id;

    if (stock <= 0) {
      get().addLocalNotification({
        type: "warning",
        title: "Out of Stock",
        message: `${name} is currently out of stock.`,
      });
      return;
    }

    const existingIndex = currentCart.findIndex(
      (item) => item.keyId === keyId || (v?.id && item.variantId === v.id) || (!v?.id && item.productId === product.id && !item.variantId)
    );

    if (existingIndex >= 0) {
      const existing = currentCart[existingIndex];
      if (existing.qty >= existing.stock) {
        get().addLocalNotification({
          type: "warning",
          title: "Stock Limit Reached",
          message: `${name}: Maximum available quantity (${existing.stock}) reached in cart.`,
        });
        return;
      }

      set({
        cart: currentCart.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: Math.min(item.qty + 1, item.stock) } : item
        ),
      });
      return;
    }

    set({
      cart: [
        ...currentCart,
        {
          keyId,
          productId: product.id,
          variantId: v?.id || null,
          variantName: v?.name || null,
          name,
          originalPrice: price,
          price,
          isOverridden: false,
          overrideReason: "",
          qty: 1,
          stock,
          sku,
          image: v?.image || product.image || product.imageUrl || "",
          note: "",
        },
      ],
    });
  },
  removeFromCart(keyId) {
    set({
      cart: get().cart.filter((item) => item.keyId !== keyId && item.productId !== keyId),
    });
  },
  updateQty(keyId, qty) {
    const nextQty = Number(qty || 0);

    if (nextQty <= 0) {
      get().removeFromCart(keyId);
      return;
    }

    set({
      cart: get().cart.map((item) =>
        item.keyId === keyId || item.productId === keyId ? { ...item, qty: Math.min(nextQty, item.stock) } : item
      ),
    });
  },
  clearCart() {
    set({ cart: [] });
  },
  setCart(cart) {
    set({ cart });
  },
  updateItemNote(keyId, note) {
    set({
      cart: get().cart.map((item) => (item.keyId === keyId || item.productId === keyId ? { ...item, note } : item)),
    });
  },
  repriceItem(keyId, newPrice, reason = "") {
    const parsedPrice = Number(newPrice || 0);
    if (parsedPrice < 0) {
      return;
    }

    set({
      cart: get().cart.map((item) => {
        if (item.keyId === keyId || item.productId === keyId) {
          const originalPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
          return {
            ...item,
            originalPrice,
            price: parsedPrice,
            isOverridden: true,
            overrideReason: String(reason || "").trim(),
          };
        }
        return item;
      }),
    });
  },
  resetItemPrice(keyId) {
    set({
      cart: get().cart.map((item) => {
        if (item.keyId === keyId || item.productId === keyId) {
          const originalPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
          return {
            ...item,
            price: originalPrice,
            isOverridden: false,
            overrideReason: "",
          };
        }
        return item;
      }),
    });
  },
  holdCurrentSale() {
    const cart = get().cart;
    if (!cart.length) {
      return;
    }

    set({
      heldSales: [
        ...get().heldSales,
        {
          id: `held-${Date.now()}`,
          label: `Sale ${get().heldSales.length + 1}`,
          cart,
          createdAt: new Date().toISOString(),
        },
      ],
      cart: [],
    });
  },
  restoreHeldSale(id) {
    const heldSale = get().heldSales.find((sale) => sale.id === id);
    if (!heldSale) {
      return;
    }

    set({
      cart: heldSale.cart,
      heldSales: get().heldSales.filter((sale) => sale.id !== id),
    });
  },
  setCashierName(name) {
    set({ cashierName: name });
  },
  setPendingSyncCount(n) {
    set({ pendingSyncCount: Number(n || 0) });
  },
  incrementCatalogVersion() {
    set({ catalogVersion: get().catalogVersion + 1 });
  },
  // ─── Local POS notification helpers ─────────────────────────────────────
  addLocalNotification({ type = "info", title, message, receiptNumber = null }) {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set({
      localNotifications: [
        { id, type, title, message, receiptNumber, createdAt: new Date().toISOString(), isRead: false },
        ...get().localNotifications.slice(0, 49), // keep max 50
      ],
    });
    return id;
  },
  dismissLocalNotification(id) {
    set({
      localNotifications: get().localNotifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    });
  },
  clearLocalNotifications() {
    set({ localNotifications: [] });
  },
}));

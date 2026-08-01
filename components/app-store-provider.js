"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fallbackProducts } from "@/lib/fallback-data";
import { readOfflineAppState, saveOfflineAppState } from "@/lib/offline-db";

const STORAGE_KEY = "grocery-store-web-state-v2";
const AppStoreContext = createContext(null);

function createInitialProducts() {
  return fallbackProducts;
}

function createInitialState() {
  return {
    products: createInitialProducts(),
    favorites: [],
    cart: [],
    orders: [],
    supportTickets: [],
    coupons: [],
    language: "en",
  };
}

function readStoredState() {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }
    return {
      ...createInitialState(),
      ...JSON.parse(raw),
    };
  } catch {
    return createInitialState();
  }
}

function getDiscountedPrice(product) {
  return product.price * (1 - (product.discountPercent || 0) / 100);
}

function normalizeOrderTotals(order) {
  const subtotal = order.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return {
    ...order,
    total: Number((subtotal - (order.couponDiscount || 0)).toFixed(2)),
  };
}

function isLocalOnlyId(id) {
  return /^(ORD-|SUP-|COUPON-)/.test(String(id || ""));
}

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(createInitialState);

  async function readJson(endpoint, fallback) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.data)) {
        return fallback;
      }
      return data.data;
    } catch {
      return fallback;
    }
  }

  async function readCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.user) {
        return null;
      }
      return data.user;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      const localState = readStoredState();
      const offlineState = await readOfflineAppState(localState);

      if (active) {
        setState(offlineState);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

useEffect(() => {
    let active = true;
    let debounceTimer;

    async function syncStore() {
      try {
        const user = await readCurrentUser();
        const [products, favorites, orders, coupons, supportTickets] = await Promise.all([
          readJson("/api/products", fallbackProducts),
          readJson("/api/favorites", []),
          user ? readJson("/api/orders", []) : [],
          readJson("/api/coupons", createInitialState().coupons),
          user ? readJson("/api/support", []) : [],
        ]);

        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          products,
          favorites,
          orders,
          coupons,
          supportTickets,
        }));
      } catch {
        // Keep local fallback state when the API is unavailable.
      }
    }

    // Debounce sync: cancel any pending sync and wait 300ms after the last trigger
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncStore, 300);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, []);

  // useEffect(() => {
  //   window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  //   saveOfflineAppState(state);
  // }, [state]);

  const value = useMemo(() => {
    const products = state.products;
    const productsById = new Map(products.map((product) => [product.id, product]));
    const activeProducts = products.filter((product) => product.isActive);
    const categories = ["All", ...new Set(products.map((product) => product.category))];
    const favoriteProducts = products.filter((product) => state.favorites.includes(product.id));
    const cartItems = state.cart
      .map((item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          return null;
        }
        // Use the stored unitPrice from the cart item (set at add-to-cart time)
        // This ensures variant prices are used correctly
        const subtotal = Number((item.unitPrice * item.quantity).toFixed(2));
        return {
          ...item,
          product,
          subtotal,
        };
      })
      .filter(Boolean);
    const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = Number(cartItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

    function patch(nextState) {
      setState((current) => {
        const resolved = typeof nextState === "function" ? nextState(current) : nextState;
        return resolved;
      });
    }

    async function syncPatchedProduct(productId, changes) {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...changes,
            ...(changes.image !== undefined ? { imageUrl: changes.image } : {}),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.data) {
          return;
        }
        patch((current) => ({
          ...current,
          products: current.products.map((product) => (product.id === productId ? data.data : product)),
        }));
      } catch {
        // ignore update failures in the optimistic UI layer
      }
    }

    return {
      ...state,
      language: state.language || "en",
      products,
      activeProducts,
      categories,
      favoriteProducts,
      cartItems,
      cartCount,
      cartTotal,
      setLanguage(language) {
        patch((current) => ({
          ...current,
          language,
        }));
      },
      getProduct(id) {
        return productsById.get(id) || null;
      },
      isFavorite(id) {
        return state.favorites.includes(id);
      },
cartQuantityFor(id, variantId = null) {
        const cartKey = variantId ? `${id}::${variantId}` : id;
        return state.cart.find((item) => item.cartKey === cartKey)?.quantity || 0;
      },

      // Find which product a variant belongs to
      findProductForVariant(variantId) {
        return products.find((p) => p.variants?.some((v) => v.id === variantId)) || null;
      },
      toggleFavorite(productId) {
        fetch(`/api/favorites/${productId}`, { method: "POST" })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok) {
              return;
            }
            patch((current) => ({
              ...current,
              favorites: data.isFavorite
                ? [...new Set([...current.favorites, productId])]
                : current.favorites.filter((id) => id !== productId),
            }));
          })
          .catch(() => {});
      },
      // Helper: get the effective price for a product+optional variant
      getEffectivePrice(product, variantId) {
        if (variantId && product.variants) {
          const variant = product.variants.find((v) => v.id === variantId);
          if (variant) {
            return Number((variant.price * (1 - (variant.discountPercent || 0) / 100)).toFixed(2));
          }
        }
        // Use displayPrice if available, else legacy product.price
        const displayPrice = product.displayPrice || product.price;
        const displayDiscount = product.displayDiscountPercent ?? product.discountPercent ?? 0;
        return Number((displayPrice * (1 - displayDiscount / 100)).toFixed(2));
      },

      // Helper: get variant details by productId + variantId
      getVariant(productId, variantId) {
        const product = productsById.get(productId);
        if (!product || !product.variants) return null;
        return product.variants.find((v) => v.id === variantId) || null;
      },

      addToCart(productId, quantity = 1, variantId = null) {
        patch((current) => {
          const product = current.products.find((entry) => entry.id === productId);
          if (!product || !product.isActive || quantity <= 0) {
            return current;
          }

          // Determine the cart key: if variantId, use productId+variantId combo
          const cartKey = variantId ? `${productId}::${variantId}` : productId;

          // Get the price from the selected variant or from the product
          let unitPrice;
          let variantName = "";
          let maxStock = product.stock;

          if (variantId && product.variants) {
            const variant = product.variants.find((v) => v.id === variantId);
            if (!variant) return current;
            unitPrice = Number((variant.price * (1 - (variant.discountPercent || 0) / 100)).toFixed(2));
            variantName = variant.name;
            maxStock = variant.stock > 0 ? variant.stock : product.stock;
          } else {
            const displayPrice = product.displayPrice || product.price;
            const displayDiscount = product.displayDiscountPercent ?? product.discountPercent ?? 0;
            unitPrice = Number((displayPrice * (1 - displayDiscount / 100)).toFixed(2));
          }

          if (maxStock <= 0) return current;

          const existing = current.cart.find((item) => item.cartKey === cartKey);
          const nextQuantity = (existing?.quantity || 0) + quantity;
          if (nextQuantity > maxStock) return current;

          const nextCart = existing
            ? current.cart.map((item) =>
                item.cartKey === cartKey ? { ...item, quantity: nextQuantity } : item,
              )
            : [
                ...current.cart,
                {
                  cartKey,
                  productId,
                  variantId: variantId || null,
                  variantName,
                  unitPrice,
                  quantity,
                },
              ];

          return {
            ...current,
            cart: nextCart,
          };
        });
      },
      decreaseCart(productId, variantId = null) {
        const cartKey = variantId ? `${productId}::${variantId}` : productId;
        patch((current) => ({
          ...current,
          cart: current.cart
            .map((item) => (item.cartKey === cartKey ? { ...item, quantity: item.quantity - 1 } : item))
            .filter((item) => item.quantity > 0),
        }));
      },
      removeFromCart(productId, variantId = null) {
        const cartKey = variantId ? `${productId}::${variantId}` : productId;
        patch((current) => ({
          ...current,
          cart: current.cart.filter((item) => item.cartKey !== cartKey),
        }));
      },
      addComment(productId, message) {
        fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId,
            message,
          }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              products: current.products.map((product) =>
                product.id === productId
                  ? {
                      ...product,
                      comments: [...(product.comments || []), data.data],
                    }
                  : product,
              ),
            }));
          })
          .catch(() => {});
      },
      updateComment(productId, commentId, message) {
        fetch(`/api/comments/${commentId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              products: current.products.map((product) =>
                product.id === productId
                  ? {
                      ...product,
                      comments: (product.comments || []).map((entry) => (entry.id === commentId ? data.data : entry)),
                    }
                  : product,
              ),
            }));
          })
          .catch(() => {});
      },
      deleteComment(productId, commentId) {
        fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
        })
          .then((response) => {
            if (!response.ok) {
              return;
            }
            patch((current) => ({
              ...current,
              products: current.products.map((product) =>
                product.id === productId
                  ? {
                      ...product,
                      comments: (product.comments || []).filter((entry) => entry.id !== commentId),
                    }
                  : product,
              ),
            }));
          })
          .catch(() => {});
      },
      submitRating(productId, ratingValue) {
        const product = products.find((entry) => entry.id === productId);
        if (!product) {
          return;
        }

        const nextCount = (product.ratingCount || 0) + 1;
        const nextRating = Number((((product.rating || 0) * (product.ratingCount || 0) + ratingValue) / nextCount).toFixed(1));

        patch((current) => ({
          ...current,
          products: current.products.map((entry) =>
            entry.id === productId
              ? {
                  ...entry,
                  rating: nextRating,
                  ratingCount: nextCount,
                }
              : entry,
          ),
        }));

        syncPatchedProduct(productId, {
          ratingAvg: nextRating,
          ratingCount: nextCount,
        });
      },
      async placeOrder({ shippingAddress, paymentMethod, couponCode }) {
        const currentCart = state.cart;
        if (!currentCart.length) {
          return { success: false, message: "Your cart is empty.", order: null };
        }
        try {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shippingAddress,
              paymentMethod,
              couponCode,
              lines: currentCart.map((item) => ({
                productId: item.productId,
                variantId: item.variantId || undefined,
                quantity: item.quantity,
              })),
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.data) {
            return { success: false, message: data.error || "Unable to place order.", order: null };
          }
          patch((current) => ({
            ...current,
            cart: [],
            orders: [data.data, ...current.orders],
            products: current.products.map((product) => {
              const line = data.data.lines.find((entry) => entry.productId === product.id);
              return line ? { ...product, stock: Math.max(0, product.stock - line.quantity) } : product;
            }),
          }));
          return { success: true, message: "", order: data.data };
        } catch {
          return { success: false, message: "Unable to place order right now.", order: null };
        }
      },
      async submitSupportTicket(subject, message) {
        try {
          const response = await fetch("/api/support", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ subject, message }),
          });
          const data = await response.json();
          if (!response.ok || !data.data) {
            return { success: false, message: data.error || "Unable to send support ticket." };
          }
          patch((current) => ({
            ...current,
            supportTickets: [data.data, ...current.supportTickets],
          }));
          return { success: true, message: "" };
        } catch {
          return { success: false, message: "Unable to send support ticket right now." };
        }
      },
      replySupport(ticketId, message, authorEmail, authorRole) {
        if (isLocalOnlyId(ticketId)) {
          patch((current) => ({
            ...current,
            supportTickets: current.supportTickets.map((ticket) =>
              ticket.id === ticketId
                ? {
                    ...ticket,
                    status: authorRole === "ADMIN" ? "answered" : "open",
                    messages: [
                      ...ticket.messages,
                      {
                        id: `SUP-MSG-${Date.now()}`,
                        authorRole,
                        authorEmail,
                        message,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }
                : ticket,
            ),
          }));
          return;
        }

        fetch(`/api/support/${ticketId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              supportTickets: current.supportTickets.map((ticket) => (ticket.id === ticketId ? data.data : ticket)),
            }));
          })
          .catch(() => {});
      },
      closeSupport(ticketId) {
        if (isLocalOnlyId(ticketId)) {
          patch((current) => ({
            ...current,
            supportTickets: current.supportTickets.map((ticket) =>
              ticket.id === ticketId ? { ...ticket, status: "closed" } : ticket,
            ),
          }));
          return;
        }

        fetch(`/api/support/${ticketId}/close`, { method: "PATCH" })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              supportTickets: current.supportTickets.map((ticket) => (ticket.id === ticketId ? data.data : ticket)),
            }));
          })
          .catch(() => {});
      },
      async addProduct(input) {
        try {
          const response = await fetch("/api/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: input.name,
              category: input.category,
              description: input.description,
              imageUrl: input.image,
              price: input.price,
              discountPercent: input.discountPercent,
              stock: input.stock,
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.data) {
            return;
          }
          patch((current) => ({
            ...current,
            products: [data.data, ...current.products],
          }));
        } catch {
          // ignore create failures in the optimistic UI layer
        }
      },
      async uploadAsset(file) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          if (!response.ok || !data.url) {
            return null;
          }
          return data.url;
        } catch {
          return null;
        }
      },
      async importProductsCsv(csv) {
        try {
          const response = await fetch("/api/products/import", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ csv }),
          });
          const data = await response.json();
          if (!response.ok) {
            return { success: false, message: data.error || "Import failed." };
          }

          const freshProducts = await readJson("/api/products", fallbackProducts);
          patch((current) => ({
            ...current,
            products: freshProducts,
          }));

          return { success: true, message: `Imported ${data.importedCount || 0} products.` };
        } catch {
          return { success: false, message: "Import failed." };
        }
      },
      async importInventoryCsv(csv) {
        try {
          const response = await fetch("/api/products/restock/import", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ csv }),
          });
          const data = await response.json();
          if (!response.ok) {
            return { success: false, message: data.error || "Import failed." };
          }

          const freshProducts = await readJson("/api/products", fallbackProducts);
          patch((current) => ({
            ...current,
            products: freshProducts,
          }));

          return { success: true, message: `Imported ${data.importedCount || 0} inventory rows.` };
        } catch {
          return { success: false, message: "Import failed." };
        }
      },
      async updateProduct(productId, changes) {
        await syncPatchedProduct(productId, changes);
      },
      async toggleProductStatus(productId) {
        const product = products.find((entry) => entry.id === productId);
        if (!product) {
          return;
        }
        await syncPatchedProduct(productId, { isActive: !product.isActive });
      },
      async restockProduct(productId, amount) {
        const product = products.find((entry) => entry.id === productId);
        if (!product) {
          return;
        }
        await syncPatchedProduct(productId, { stock: product.stock + amount });
      },
      updateOrder(orderId, changes) {
        if (isLocalOnlyId(orderId)) {
          patch((current) => ({
            ...current,
            orders: current.orders.map((order) =>
              order.id === orderId ? normalizeOrderTotals({ ...order, ...changes }) : order,
            ),
          }));
          return;
        }

        fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(changes),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              orders: current.orders.map((order) => (order.id === orderId ? data.data : order)),
            }));
          })
          .catch(() => {});
      },
      async createCoupon(input) {
        try {
          const response = await fetch("/api/coupons", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          });
          const data = await response.json();
          if (!response.ok || !data.data) {
            return { success: false, message: data.error || "Unable to create coupon." };
          }
          patch((current) => ({
            ...current,
            coupons: [data.data, ...current.coupons],
          }));
          return { success: true, message: "Coupon created." };
        } catch {
          return { success: false, message: "Unable to create coupon." };
        }
      },
      toggleCoupon(id) {
        const coupon = state.coupons.find((entry) => entry.id === id);
        if (!coupon) {
          return;
        }
        if (isLocalOnlyId(id)) {
          patch((current) => ({
            ...current,
            coupons: current.coupons.map((entry) => (entry.id === id ? { ...entry, isActive: !entry.isActive } : entry)),
          }));
          return;
        }
        fetch(`/api/coupons/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: !coupon.isActive }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok || !data.data) {
              return;
            }
            patch((current) => ({
              ...current,
              coupons: current.coupons.map((entry) => (entry.id === id ? data.data : entry)),
            }));
          })
          .catch(() => {});
      },
    };
  }, [state]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);

  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider.");
  }

  return context;
}

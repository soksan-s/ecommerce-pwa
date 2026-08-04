"use client";

import { openDB } from "idb";

const DB_NAME = "myshop-db";
const DB_VERSION = 3;

let dbPromise;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function getDb() {
  if (!canUseIndexedDb()) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("variants")) {
          const variantStore = db.createObjectStore("variants", { keyPath: "id" });
          variantStore.createIndex("productId", "productId", { unique: false });
          variantStore.createIndex("sku", "sku", { unique: false });
        }

        if (!db.objectStoreNames.contains("inventory")) {
          const invStore = db.createObjectStore("inventory", { keyPath: "variantId" });
          invStore.createIndex("productId", "productId", { unique: false });
        }

        if (!db.objectStoreNames.contains("cart")) {
          db.createObjectStore("cart", { keyPath: "productId" });
        }

        if (!db.objectStoreNames.contains("offline_queue")) {
          db.createObjectStore("offline_queue", { keyPath: "id", autoIncrement: true });
        }

        if (!db.objectStoreNames.contains("sync_logs")) {
          db.createObjectStore("sync_logs", { keyPath: "id", autoIncrement: true });
        }

        if (!db.objectStoreNames.contains("transactions")) {
          db.createObjectStore("transactions", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("sync_meta")) {
          db.createObjectStore("sync_meta", { keyPath: "key" });
        }
      },
    });
  }

  return dbPromise;
}

export async function getAll(store) {
  const db = await getDb();
  return db ? db.getAll(store) : [];
}

export async function getById(store, id) {
  const db = await getDb();
  return db ? db.get(store, id) : null;
}

export async function put(store, item) {
  const db = await getDb();
  if (!db) {
    return item;
  }

  await db.put(store, item);
  return item;
}

export async function remove(store, id) {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db.delete(store, id);
}

export async function clearStore(store) {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db.clear(store);
}

export async function addToQueue(request) {
  const db = await getDb();
  const queuedRequest = {
    ...request,
    createdAt: request.createdAt || new Date().toISOString(),
  };

  if (!db) {
    return queuedRequest;
  }

  const id = await db.add("offline_queue", queuedRequest);
  return { ...queuedRequest, id };
}

export async function getSyncMeta(key) {
  const db = await getDb();
  if (!db) return null;
  const meta = await db.get("sync_meta", key);
  return meta ? meta.value : null;
}

export async function setSyncMeta(key, value) {
  const db = await getDb();
  if (!db) return;
  await db.put("sync_meta", { key, value, updatedAt: new Date().toISOString() });
}

export async function updateLocalStock(productId, variantId, qtySold) {
  const db = await getDb();
  if (!db) return;

  const product = await db.get("products", productId);
  if (!product) return;

  const currentStock = Number(product.stock || 0);
  const nextStock = Math.max(0, currentStock - Number(qtySold || 0));

  let updatedVariants = product.variants;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    updatedVariants = product.variants.map((v) => {
      if (v.id === variantId || (!variantId && v.name === "Default")) {
        const vStock = Number(v.stock || 0);
        return { ...v, stock: Math.max(0, vStock - Number(qtySold || 0)) };
      }
      return v;
    });
  }

  const updatedProduct = {
    ...product,
    stock: nextStock,
    variants: updatedVariants,
  };

  await db.put("products", updatedProduct);

  if (variantId) {
    const inv = await db.get("inventory", variantId);
    if (inv) {
      await db.put("inventory", {
        ...inv,
        availableQuantity: Math.max(0, Number(inv.availableQuantity || 0) - Number(qtySold || 0)),
      });
    }
  }
}

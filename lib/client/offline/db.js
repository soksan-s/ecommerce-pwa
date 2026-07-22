"use client";

import { openDB } from "idb";

const DB_NAME = "myshop-db";
const DB_VERSION = 2;

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

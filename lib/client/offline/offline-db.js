"use client";

import { openDB } from "idb";

const DB_NAME = "grocery-store-offline";
const DB_VERSION = 1;
const APP_STATE_KEY = "app-state";

let dbPromise;

function getDb() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("keyval")) {
          db.createObjectStore("keyval");
        }

        if (!db.objectStoreNames.contains("posSales")) {
          const store = db.createObjectStore("posSales", { keyPath: "id" });
          store.createIndex("synced", "synced");
          store.createIndex("createdAt", "createdAt");
        }
      },
    });
  }

  return dbPromise;
}

export async function readOfflineAppState(fallback) {
  try {
    const db = await getDb();
    if (!db) {
      return fallback;
    }

    return (await db.get("keyval", APP_STATE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

export async function saveOfflineAppState(state) {
  try {
    const db = await getDb();
    if (!db) {
      return;
    }

    await db.put("keyval", state, APP_STATE_KEY);
  } catch {
    // IndexedDB can be unavailable in private browsing or blocked browser contexts.
  }
}

export async function queuePosSale(sale) {
  const db = await getDb();
  if (!db) {
    return sale;
  }

  const queuedSale = {
    ...sale,
    synced: false,
    createdAt: sale.createdAt || new Date().toISOString(),
  };

  await db.put("posSales", queuedSale);
  return queuedSale;
}

export async function listQueuedPosSales() {
  try {
    const db = await getDb();
    if (!db) {
      return [];
    }

    return await db.getAllFromIndex("posSales", "synced", false);
  } catch {
    return [];
  }
}

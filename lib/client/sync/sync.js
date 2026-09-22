"use client";

import { addToQueue, getAll, getById, getSyncMeta, put, remove, setSyncMeta } from "@/lib/client/offline/db";
import { saveProductsToCache } from "@/lib/client/offline/productCache";

function normalizeHeaders(headers = {}) {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  return headers;
}

export async function queueRequest({ url, method = "POST", headers = {}, body }) {
  return addToQueue({
    url,
    method,
    headers: normalizeHeaders(headers),
    body,
  });
}

export async function replayQueue() {
  const queuedRequests = await getAll("offline_queue");
  const results = [];

  for (const entry of queuedRequests) {
    try {
      let parsedBody = null;
      try {
        parsedBody = typeof entry.body === "string" ? JSON.parse(entry.body) : entry.body;
      } catch {
        parsedBody = null;
      }

      const idempotencyKey = parsedBody?.id || `req-${entry.id}`;

      const response = await fetch(entry.url, {
        method: entry.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...(entry.headers || {}),
        },
        body: typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body),
      });

      if (response.ok || response.status === 409) {
        await remove("offline_queue", entry.id);

        if (parsedBody?.id) {
          const txn = await getById("transactions", parsedBody.id);
          if (txn) {
            // Merge the server-assigned Sale ID so the POS shows the official
            // receiptNumber instead of the local UUID after sync.
            let serverReceiptNumber = null;
            try {
              const payload = await response.clone().json();
              serverReceiptNumber = payload?.data?.receiptNumber || null;
            } catch {
              serverReceiptNumber = null;
            }
            await put("transactions", {
              ...txn,
              synced: true,
              syncStatus: "synced",
              ...(serverReceiptNumber ? { receiptNumber: serverReceiptNumber } : {}),
            });
          }
        }

        await put("sync_logs", {
          url: entry.url,
          status: "success",
          timestamp: new Date().toISOString(),
        });

        results.push({ id: entry.id, ok: true, status: response.status, receiptNumber: serverReceiptNumber });
      } else if (response.status >= 400 && response.status < 500) {
        await remove("offline_queue", entry.id);

        if (parsedBody?.id) {
          const txn = await getById("transactions", parsedBody.id);
          if (txn) {
            await put("transactions", { ...txn, synced: false, syncStatus: "failed" });
          }
        }

        await put("sync_logs", {
          url: entry.url,
          status: "failed",
          error: `Client error: ${response.status}`,
          timestamp: new Date().toISOString(),
        });

        results.push({ id: entry.id, ok: false, status: response.status, receiptNumber: parsedBody?.id || null });
      } else {
        await put("sync_logs", {
          url: entry.url,
          status: "failed",
          error: `Server error: ${response.status}`,
          timestamp: new Date().toISOString(),
        });

        results.push({ id: entry.id, ok: false, status: response.status, receiptNumber: parsedBody?.id || null });
        break;
      }
    } catch (error) {
      await put("sync_logs", {
        url: entry.url,
        status: "failed",
        error: error.message || "Network error",
        timestamp: new Date().toISOString(),
      });

      results.push({ id: entry.id, ok: false, status: 0, receiptNumber: null });
      break;
    }
  }

  await performDeltaSync();

  return results;
}

export async function performDeltaSync() {
  try {
    const lastSync = await getSyncMeta("lastCatalogSync");
    const url = lastSync ? `/api/pos/sync?since=${encodeURIComponent(lastSync)}` : "/api/pos/sync";

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.json();
    const data = payload.data || payload;

    if (Array.isArray(data.products) && data.products.length > 0) {
      await saveProductsToCache(data.products);
    }

    if (Array.isArray(data.inventory) && data.inventory.length > 0) {
      await Promise.all(data.inventory.map((inv) => put("inventory", inv)));
    }

    if (data.timestamp) {
      await setSyncMeta("lastCatalogSync", data.timestamp);
    }
  } catch {
    // Offline - keep cached IndexedDB data
  }
}

export async function getSyncLogs() {
  const logs = await getAll("sync_logs");
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
}

export async function requestBackgroundSync() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await registration.sync.register("replay-queue");
        return true;
      }
    } catch {
      // Fallback to direct replay
    }
  }

  await replayQueue();
  return true;
}

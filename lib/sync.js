"use client";

import { addToQueue, getAll, remove } from "@/lib/db";

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
      const response = await fetch(entry.url, {
        method: entry.method || "POST",
        headers: entry.headers || { "Content-Type": "application/json" },
        body: entry.body,
      });

      if (response.ok) {
        await remove("offline_queue", entry.id);
      }

      results.push({ id: entry.id, ok: response.ok, status: response.status });
    } catch {
      results.push({ id: entry.id, ok: false, status: 0 });
    }
  }

  return results;
}

export async function getSyncLogs() {
  const logs = await getAll("sync_logs");
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  if (!("sync" in registration)) {
    await replayQueue();
    return false;
  }

  await registration.sync.register("replay-queue");
  return true;
}

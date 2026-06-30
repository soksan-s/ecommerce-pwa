const CACHE_NAME = "myshop-cache-v1";
const STATIC_CACHE_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2"];
const APP_SHELL = ["/", "/pos", "/ecommerce", "/offline", "/manifest.json", "/icons/icon-192.svg", "/icons/icon-512.svg"];
const DB_NAME = "myshop-db";
const DB_VERSION = 2;

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedRequests() {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_queue", "readonly");
    const store = transaction.objectStore("offline_queue");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function removeQueuedRequest(id) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_queue", "readwrite");
    transaction.objectStore("offline_queue").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function addQueuedRequest(entry) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_queue", "readwrite");
    transaction.objectStore("offline_queue").add(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function addSyncLog(entry) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_logs", "readwrite");
    transaction.objectStore("sync_logs").add(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch {
        // In dev, a route can fail while compiling. Keep installing with the pages that worked.
      }
    }),
  );
}

function isStaticAsset(url) {
  return STATIC_CACHE_EXTENSIONS.some((extension) => url.pathname.endsWith(extension)) || url.pathname.startsWith("/_next/static/");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: "Offline" }), { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      return new Response(JSON.stringify({ error: "Offline" }), { status: 503 });
    });

  return cached || fetchPromise;
}

async function queueFailedApiPost(request) {
  const cloned = request.clone();
  const body = await cloned.text();

  await addQueuedRequest({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    createdAt: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ queued: true, offline: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

async function navigationFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/offline")) || (await cache.match("/")) || Response.error();
  }
}

async function replayQueue() {
  const queuedRequests = await getQueuedRequests();

  for (const entry of queuedRequests) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method || "POST",
        headers: entry.headers || { "Content-Type": "application/json" },
        body: entry.body,
      });

      if (response.ok) {
        await removeQueuedRequest(entry.id);
        await addSyncLog({
          url: entry.url,
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } else {
        await addSyncLog({
          url: entry.url,
          status: "error",
          error: `HTTP Error: ${response.status}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      await addSyncLog({
        url: entry.url,
        status: "error",
        error: error.message || "Network error",
        timestamp: new Date().toISOString(),
      });
      // Keep the item queued until the next sync attempt.
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (request.method === "GET") {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }

    if (request.method === "POST") {
      event.respondWith(fetch(request.clone()).catch(() => queueFailedApiPost(request)));
      return;
    }
  }

  if (request.method === "GET" && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "replay-queue") {
    event.waitUntil(replayQueue());
  }
});

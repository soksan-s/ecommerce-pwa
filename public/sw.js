const CACHE_NAME = "myshop-cache-v5";
const STATIC_CACHE_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".json",
  ".ttf",
];

const APP_SHELL = [
  "/",
  "/pos",
  "/pos/new-sale",
  "/pos/orders",
  "/pos/products",
  "/pos/reports",
  "/pos/settings",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

const DB_NAME = "myshop-db";
const DB_VERSION = 3;

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

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

  await Promise.allSettled(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      } catch {
        // Continue pre-caching other routes even if one fails
      }
    })
  );
}

function isStaticAsset(url) {
  return (
    STATIC_CACHE_EXTENSIONS.some((extension) => url.pathname.endsWith(extension)) ||
    url.pathname.startsWith("/_next/static/")
  );
}

async function staticAssetHandler(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  if (cached) {
    // Return cached asset immediately, revalidate in background if online
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // If offline and not in cache, return safe fallbacks instead of 503 JSON (which breaks script parsing)
    const url = new URL(request.url);
    if (url.pathname.endsWith(".js") || url.pathname.includes("/_next/static/chunks/")) {
      return new Response("/* Offline bundle unavailable */", {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    }
    if (url.pathname.endsWith(".css")) {
      return new Response("/* Offline stylesheet */", {
        status: 200,
        headers: { "Content-Type": "text/css" },
      });
    }
    return new Response(null, { status: 404 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      return cached || new Response(JSON.stringify({ error: "Offline", offline: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
  const url = new URL(request.url);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Cache both the full request and the path name so it matches reliably offline
      await cache.put(request, response.clone());
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    // 1. Try matching exact request
    const exactMatch = await cache.match(request, { ignoreSearch: true });
    if (exactMatch) return exactMatch;

    // 2. Try matching pathname (e.g. /pos/new-sale)
    const pathMatch = await cache.match(url.pathname, { ignoreSearch: true });
    if (pathMatch) return pathMatch;

    // 3. For any /pos/* route, fall back to cached /pos/new-sale or /pos
    if (url.pathname.startsWith("/pos")) {
      const posNewSaleMatch = await cache.match("/pos/new-sale", { ignoreSearch: true });
      if (posNewSaleMatch) return posNewSaleMatch;

      const posMatch = await cache.match("/pos", { ignoreSearch: true });
      if (posMatch) return posMatch;
    }

    // 4. Fall back to /offline page
    const offlineMatch = await cache.match("/offline", { ignoreSearch: true });
    if (offlineMatch) return offlineMatch;

    // 5. Fall back to root /
    const rootMatch = await cache.match("/", { ignoreSearch: true });
    if (rootMatch) return rootMatch;

    // 6. Final fallback HTML if cache was completely cleared while offline
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline — POS</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 10px; color: #38bdf8; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
    .btn { display: inline-block; background: #0ea5e9; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; border: none; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are Offline</h1>
    <p>Please connect to the network once while opening the POS so that all assets are cached for offline use.</p>
    <button class="btn" onclick="location.reload()">Reload Application</button>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
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
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle external fonts (Google Fonts)
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
      event.respondWith(
        caches.match(request).then((cached) => {
          return (
            cached ||
            fetch(request)
              .then((response) => {
                if (response && response.ok) {
                  const clone = response.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
              })
              .catch(() => cached || new Response("", { status: 200 }))
          );
        })
      );
    }
    return;
  }

  // Handle HTML document navigations
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(navigationFallback(request));
    return;
  }

  // Handle API Requests
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

  // Handle Static Assets (_next/static, css, js, icons, images, fonts)
  if (
    request.method === "GET" &&
    (isStaticAsset(url) ||
      request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "image" ||
      request.destination === "font")
  ) {
    event.respondWith(staticAssetHandler(request));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "replay-queue") {
    event.waitUntil(replayQueue());
  }
});

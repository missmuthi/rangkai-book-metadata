import { build, files, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const STATIC_CACHE = `rangkai-static-${version}`;
const RUNTIME_CACHE = `rangkai-runtime-${version}`;

const OFFLINE_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Offline</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0;padding:1.5rem;text-align:center}main{max-width:420px}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#cbd5e1;margin:0}</style></head><body><main><h1>You are offline</h1><p>Please check your connection. Cached pages and assets are still available.</p></main></body></html>`;

const ASSETS = [...build, ...files];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin && ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (_error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 503,
    });
  }
}

async function handleNavigation(event: FetchEvent): Promise<Response> {
  const { request } = event;

  try {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }

    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (_error) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedPage = await cache.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    const root = await cache.match("/");
    if (root) {
      return root;
    }

    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 503,
    });
  }
}

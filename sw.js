const CACHE = "hesabdar-pro1-offline-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./src/core/storage-runtime.js",
  "./manifest.json",
  "./logo.png",
  "./capacitor-local-notifications-bridge.js",
  "./capacitor-filesystem-bridge.js",
  "./capacitor-biometric-bridge.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const asset of ASSETS){try{const response=await fetch(asset,{cache:"no-store"});if(response&&response.ok&&response.type==="basic")await cache.put(asset,response.clone());}catch(e){}}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer the network for the document so a released version is
  // discovered promptly. Offline users still get the cached application shell.
  if (event.request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put("./index.html", copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match("./index.html").then(response => response || caches.match("./")))
    );
    return;
  }

  // Core app files (app.js, style.css) must never be served stale from an
  // old cache without a network check first — otherwise a released fix can
  // sit uninstalled indefinitely on a device that's usually online. Network
  // first, cache fallback only for offline use.
  if (url.pathname.endsWith("/app.js") || url.pathname.endsWith("/style.css")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Only same-origin application assets are eligible for the offline cache.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && response.type === "basic" && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached || Response.error());
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const reminderId = event.notification?.data?.reminderId;
  const url = new URL("./", self.location.origin);
  if (reminderId) url.searchParams.set("reminder", reminderId);

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if ("focus" in client) {
        await client.focus();
        if (reminderId && "navigate" in client) await client.navigate(url.href);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url.href);
  })());
});

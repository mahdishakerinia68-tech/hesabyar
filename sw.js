const CACHE = "hesabdar-pro1.3-offline-v1";
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
            return response;
          }
          // v3.5 fix: the network WAS reachable but answered with an error
          // status (e.g. a transient 404 from the host, such as GitHub Pages
          // briefly 404ing while a new deploy propagates). Previously this
          // branch only checked response.ok before deciding whether to
          // cache, then returned that error response to the page anyway —
          // so users occasionally saw a raw "404" screen even though a
          // working cached copy of the app existed. Now an error status
          // falls back to the cached shell just like a network failure does.
          return caches.match("./index.html").then(cached => cached || caches.match("./") || response);
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
            return response;
          }
          // Same fallback as above: a reachable-but-error response (e.g. a
          // transient 404) should not override a working cached asset.
          return caches.match(event.request).then(cached => cached || response);
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

const CACHE="hesabdar-2-3-offline-v1";
const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./logo.png","./capacitor-local-notifications-bridge.js","./capacitor-filesystem-bridge.js","./capacitor-biometric-bridge.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

/* ---- Cache-first / stale-while-revalidate for the app shell ----
 * The old strategy re-fetched every file over the network (cache:"no-store")
 * before showing anything, even though the file was already cached. On a
 * slow connection that produced a visible delay: raw/unstyled HTML for a
 * couple of seconds until CSS/JS finally arrived. Now cached assets are
 * served instantly from the cache, while a fresh copy is fetched quietly
 * in the background to keep the cache up to date for next time. ---- */
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin){return}
 e.respondWith(
  caches.match(e.request).then(cached=>{
   const network=fetch(e.request).then(r=>{
    if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}
    return r;
   }).catch(()=>null);
   if(cached)return cached;
   return network.then(r=>r||caches.match("./index.html"));
  })
 );
});

const CACHE="hesabdar-3.1-offline-v1";
const ASSETS=["./",
      "./logo.png","./index.html","./style.css","./app.js","./capacitor-local-notifications-bridge.js","./manifest.json","./sw.js"];

self.addEventListener("install", event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", event=>{
  if(event.request.method!=="GET") return;

  const req=event.request;
  const isNavigation=req.mode==="navigate" || (req.headers.get("accept")||"").includes("text/html");

  // App pages: use the cached copy immediately when offline.
  if(isNavigation){
    event.respondWith(
      fetch(req).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
        return response;
      }).catch(()=>caches.match(req).then(r=>r||caches.match("./index.html")))
    );
    return;
  }

  // Local app assets: cache-first, then network, then cached fallback.
  event.respondWith(
    caches.match(req).then(cached=>cached || fetch(req).then(response=>{
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>cached))
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>
    cs.length ? cs[0].focus() : clients.openWindow("./")
  ));
});

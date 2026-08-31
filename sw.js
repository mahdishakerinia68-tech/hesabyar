const CACHE="hesabdar-3.3-offline-v3";
const ASSETS=["./","./logo.png","./index.html","./style.css","./app.js?v=3.3.1","./capacitor-local-notifications-bridge.js","./manifest.json","./sw.js?v=3.3.1"];

self.addEventListener("install", event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(req){
  try{
    const response=await fetch(req,{cache:"no-store"});
    if(response && response.ok){
      const cache=await caches.open(CACHE);
      cache.put(req,response.clone()).catch(()=>{});
    }
    return response;
  }catch(e){
    return caches.match(req).then(r=>r||caches.match("./index.html"));
  }
}

self.addEventListener("fetch", event=>{
  if(event.request.method!=="GET") return;
  // Always prefer the network for HTML/JS/CSS so a deployed version cannot stay stuck in an old cache.
  const url=new URL(event.request.url);
  const isAppAsset=url.origin===location.origin && (/\.(html|js|css|json)$/i.test(url.pathname) || url.pathname.endsWith("/"));
  if(isAppAsset){event.respondWith(networkFirst(event.request));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone())).catch(()=>{});return r;}).catch(()=>cached)));
});

self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>cs.length?cs[0].focus():clients.openWindow("./")));
});

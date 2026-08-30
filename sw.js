const DB_NAME='hesabdar-reminders-v41';
const STORE='reminders';
const DB_VERSION=1;
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putAll(reminders){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();for(const r of reminders||[])s.put(r);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getAll(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
function nextDate(r,ms){let d=new Date(ms);if(r.repeat==='weekly')d.setDate(d.getDate()+7);else if(r.repeat==='monthly')d.setMonth(d.getMonth()+1);else return null;return d}
async function fireDue(){const now=Date.now(), items=await getAll();for(const r of items){let d=new Date(r.date);if(Number.isNaN(d.getTime()))continue;let due=d.getTime();if(r.repeat==='once'){if(due<=now){await self.registration.showNotification('🔔 '+r.title,{body:r.amount?String(r.amount)+' • '+(r.type==='expense'?'پرداخت':'دریافت'):(r.type==='expense'?'پرداخت':'دریافت'),tag:'reminder-'+r.id,data:{id:r.id}})}}else{while(due<=now){await self.registration.showNotification('🔔 '+r.title,{body:r.amount?String(r.amount)+' • '+(r.type==='expense'?'پرداخت':'دریافت'):(r.type==='expense'?'پرداخت':'دریافت'),tag:'reminder-'+r.id+'-'+due,data:{id:r.id}});const nd=nextDate(r,due);if(!nd)break;due=nd.getTime()}}}}
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data?.type==='SYNC_REMINDERS')e.waitUntil(putAll(e.data.reminders||[]).then(fireDue).catch(()=>{}))});
self.addEventListener('sync',e=>{if(e.tag==='hesabdar-reminders')e.waitUntil(fireDue().catch(()=>{}))});
self.addEventListener('periodicsync',e=>{if(e.tag==='hesabdar-reminders')e.waitUntil(fireDue().catch(()=>{}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.length?cs[0].focus():clients.openWindow('./')))});

const KEY="hesabdar-v20";
const SYNC_KEY="hesabdar-firebase-config-v1";
const APP_VERSION="2.2.0";
const SYNC_INTERVAL=5000;
// Firebase project configuration supplied for this app.
// This is safe to ship in a web app; access is protected by Firebase Authentication + Firestore Rules.
const DEFAULT_SYNC_CONFIG={
  apiKey:"AIzaSyAj80ZFjd8nqVwgIIdPTbUbDXoCPwFSxh4",
  authDomain:"hesabdari-fd3a3.firebaseapp.com",
  projectId:"hesabdari-fd3a3",
  storageBucket:"hesabdari-fd3a3.firebasestorage.app",
  messagingSenderId:"1048332879407",
  appId:"1:1048332879407:web:d1168138d754d28c8d68da",
  measurementId:"G-562NVEJKZT"
};
let sync={app:null,auth:null,db:null,user:null,unsubscribe:null,ready:false,saving:false,queued:false,hydrating:false,authListener:false,dirty:new Map()};
function syncConfig(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||"null")||DEFAULT_SYNC_CONFIG}catch{return DEFAULT_SYNC_CONFIG}}
function setSyncStatus(t){const e=$("syncStatus");if(e)e.textContent=t||""}

const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
const money=n=>fa(n)+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const uid=()=>{try{if(globalThis.crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID()}catch(e){}return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2)};
const blankData=()=>({accounts:[],transactions:[],people:[],reminders:[],checks:[],audit:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name})),pin:""});
window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
window.addEventListener("online",()=>{if(sync.db)sync.db.enableNetwork().catch(console.error);setSyncStatus("🌐 اینترنت برقرار شد؛ در حال اتصال به ابر...")});
window.addEventListener("offline",()=>setSyncStatus("⚠️ اینترنت دستگاه قطع است"));

let data;
try{data=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("hesabdar-v11")||"null")}catch{data=null}
data=data||blankData();
data.accounts??=[];data.transactions??=[];data.people??=[];data.reminders??=[];data.checks??=[];data.audit??=[];data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name}));data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name}));data.pin=typeof data.pin==="string"?data.pin:"";data._sync??={tombstones:{}};data._sync.tombstones??={};for(const k of ["accounts","transactions","people","reminders","checks","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString()}}
// Normalize older people records so saved debtors/creditors always render correctly.
for(const p of data.people){if(p.type==="debtor"||p.type==="debtors"||p.type==="بدهکار")p.type="debt";if(p.type==="creditor"||p.type==="creditors"||p.type==="طلبکار"||p.type==="بستانکار")p.type="credit";if(p.type!=="debt"&&p.type!=="credit")p.type="debt";p.amount=Number(p.amount)||0;p.paid=Number(p.paid)||0;p.name=String(p.name||"").trim()} 
let peopleMode="debt";
const AUDIT_LIMIT=1000;
function logEvent(action,detail="",kind="info",doSync=true){
  const entry={id:uid(),at:new Date().toISOString(),action:String(action||"رویداد"),detail:String(detail||""),kind:String(kind||"info")};
  data.audit??=[]; data.audit.unshift(entry); if(data.audit.length>AUDIT_LIMIT)data.audit.length=AUDIT_LIMIT;
  localStorage.setItem(KEY,JSON.stringify(data));
  markDirty("audit",entry.id,false,entry,entry.at);
  render(); if(doSync)syncSave();
}
function auditLabel(k){return ({create:"ایجاد",edit:"ویرایش",delete:"حذف",payment:"تسویه",sync:"همگام‌سازی",auth:"ورود/خروج",system:"سیستم",nav:"ناوبری",settings:"تنظیمات",info:"اطلاعات"})[k]||"رویداد"}
function auditIcon(k){return ({create:"➕",edit:"✏️",delete:"🗑️",payment:"💳",sync:"☁️",auth:"🔐",system:"⚙️",nav:"🧭",settings:"🎛️",info:"ℹ️"})[k]||"•"}
function renderAudit(){
  const box=$("auditList"); if(!box)return;
  const logs=(data.audit||[]).slice(0,250);
  box.innerHTML=logs.map(e=>`<div class="audit-item"><div class="audit-icon">${auditIcon(e.kind)}</div><div class="audit-main"><b>${esc(e.action)}</b>${e.detail?`<div class="meta">${esc(e.detail)}</div>`:""}<small>${new Date(e.at).toLocaleString("fa-IR")}</small></div></div>`).join("")||empty("هنوز گزارشی ثبت نشده است");
}
function clearAudit(){if(!data.audit?.length)return alert("گزارشی برای پاک کردن وجود ندارد");if(confirm("همه گزارش‌های فعالیت پاک شوند؟")){const old=data.audit.slice();data.audit=[];for(const e of old)markDirty("audit",e.id,true,{id:e.id},new Date().toISOString());save();logEvent("گزارش‌ها پاک شدند","سابقه فعالیت قبلی حذف شد","system")}}
function save(){localStorage.setItem(KEY,JSON.stringify(data));render();syncSave()}
function hasMeaningfulData(d){
  if(!d||typeof d!=="object")return false;
  return ["accounts","transactions","people","reminders","checks"].some(k=>Array.isArray(d[k])&&d[k].length>0);
}
function mergeData(remote){
  const base=blankData();
  if(remote&&typeof remote==="object"){
    for(const k of Object.keys(base)) if(remote[k]!==undefined) base[k]=remote[k];
    if(typeof remote.pin==="string") base.pin=remote.pin;
  }
  return base;
}
function cloudDoc(){return sync.db.collection("users").doc(sync.user.uid)}
function recordsCollection(){return cloudDoc().collection("records")}
function recordDocId(type,id){return `${type}__${id}`}
function allSyncRecords(){
  const ks=["accounts","transactions","people","reminders","checks","expenseCats","incomeCats","audit"];
  const out=[];
  for(const k of ks) for(const r of (data[k]||[])) out.push({id:recordDocId(k,r.id),type:k,record:r,updatedAt:r.updatedAt||new Date().toISOString(),deleted:false});
  for(const k of ks) for(const [id,dt] of Object.entries(data._sync?.tombstones?.[k]||{})) out.push({id:recordDocId(k,id),type:k,record:{id},updatedAt:dt,deleted:true});
  return out;
}
function clearOldTombstones(){
  data._sync??={tombstones:{}}; data._sync.tombstones??={};
  // Tombstones are kept locally so an offline device cannot resurrect deleted records.
}
function markDirty(type,id,deleted=false,record=null,updatedAt=null){
  if(!type||!id)return;
  sync.dirty.set(recordDocId(type,id),{id:recordDocId(type,id),type,record:deleted?{id}:record,updatedAt:updatedAt||record?.updatedAt||new Date().toISOString(),deleted});
}
function markAllLocalDirty(){
  const ks=["accounts","transactions","people","reminders","checks","expenseCats","incomeCats","audit"];
  for(const k of ks) for(const r of (data[k]||[])) markDirty(k,r.id,false,r,r.updatedAt);
  for(const k of ks) for(const [id,dt] of Object.entries(data._sync?.tombstones?.[k]||{})) markDirty(k,id,true,{id},dt);
}
function cloudPayload(x){return {type:x.type,record:x.record,updatedAt:x.updatedAt,deleted:x.deleted,updatedBy:sync.user.uid};}
async function commitChunks(items){
  const col=recordsCollection();
  for(let i=0;i<items.length;i+=450){
    const batch=sync.db.batch();
    for(const x of items.slice(i,i+450)) batch.set(col.doc(x.id),cloudPayload(x),{merge:false});
    await batch.commit();
  }
}
async function pushRest(items=null){
  if(!sync.user||!sync.db)throw new Error("همگام‌سازی آماده نیست");
  const outgoing=items||[...sync.dirty.values()];
  if(outgoing.length) await commitChunks(outgoing);
  await sync.db.collection("users").doc(sync.user.uid).set({appVersion:APP_VERSION,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  if(!items){for(const x of outgoing){const current=sync.dirty.get(x.id);if(current&&current.updatedAt===x.updatedAt)sync.dirty.delete(x.id)}}
}
async function pullRest(){
  if(!sync.user||!sync.db)throw new Error("همگام‌سازی آماده نیست");
  const snap=await recordsCollection().get();
  return snap.docs.map(d=>d.data());
}
function recordsFromLocal(){
  const ks=["accounts","transactions","people","reminders","checks","expenseCats","incomeCats","audit"],out=[];
  for(const k of ks) for(const r of (data[k]||[])) out.push({id:recordDocId(k,r.id),type:k,record:r,updatedAt:r.updatedAt||new Date().toISOString(),deleted:false});
  for(const k of ks) for(const [id,dt] of Object.entries(data._sync?.tombstones?.[k]||{})) out.push({id:recordDocId(k,id),type:k,record:{id},updatedAt:dt,deleted:true});
  return out;
}
async function reconcileInitial(remote){
  const remoteMap=new Map((remote||[]).map(x=>[recordDocId(x.type,x.record?.id),x]));
  const outgoing=[];
  for(const local of recordsFromLocal()){
    const r=remoteMap.get(local.id);
    if(!r || String(local.updatedAt)>String(r.updatedAt||r.record?.updatedAt||"")) outgoing.push(local);
  }
  if(outgoing.length) await pushRest(outgoing);
}
function mergeCloud(remote){
  const ks=["accounts","transactions","people","reminders","checks","expenseCats","incomeCats","audit"];
  let changed=false;
  const remoteMap=new Map();
  for(const x of (remote||[])){if(!x?.type||!x?.record?.id)continue;remoteMap.set(recordDocId(x.type,x.record.id),x)}
  data._sync??={tombstones:{}};data._sync.tombstones??={};
  for(const x of remoteMap.values()){
    const type=x.type,id=x.record.id,arr=data[type]; if(!Array.isArray(arr))continue;
    const local=arr.find(r=>r.id===id); const localTs=local?.updatedAt||data._sync.tombstones?.[type]?.[id]||""; const remoteTs=x.updatedAt||x.record.updatedAt||"";
    if(String(remoteTs)<=String(localTs))continue;
    if(x.deleted){
      if(local){arr.splice(arr.indexOf(local),1);changed=true}
      data._sync.tombstones[type]??={};data._sync.tombstones[type][id]=remoteTs;
      sync.dirty.delete(recordDocId(type,id));
    }else{
      const rec={...x.record,updatedAt:remoteTs};
      if(local)Object.assign(local,rec);else arr.push(rec);
      if(data._sync.tombstones?.[type]?.[id])delete data._sync.tombstones[type][id];
      changed=true;
    }
  }
  // Normalize people after remote merges.
  for(const p of data.people||[]){if(p.type==="debtor"||p.type==="debtors"||p.type==="بدهکار")p.type="debt";if(p.type==="creditor"||p.type==="creditors"||p.type==="طلبکار"||p.type==="بستانکار")p.type="credit";if(p.type!=="debt"&&p.type!=="credit")p.type="debt";p.amount=Number(p.amount)||0;p.paid=Number(p.paid)||0}
  return changed;
}
async function hydrateSync(){
  if(!sync.user||!sync.db)return;
  sync.hydrating=true;
  try{const remote=await pullRest();mergeCloud(remote);localStorage.setItem(KEY,JSON.stringify(data));await reconcileInitial(remote);render();setSyncStatus("☁️ آنلاین • همگام‌سازی لحظه‌ای")}
  catch(e){console.error(e);setSyncStatus("⚠️ دریافت اولیه ناموفق: "+(e.code||e.message))}
  finally{sync.hydrating=false}
}
async function syncTick(){
  if(!sync.user||!sync.db||sync.hydrating)return;
  try{if(sync.dirty.size)await pushRest();setSyncStatus("☁️ آنلاین • همگام‌سازی لحظه‌ای")}catch(e){console.error(e)}
}
function dataSummary(d){return `حساب ${fa(d.accounts?.length||0)} • تراکنش ${fa(d.transactions?.length||0)} • افراد ${fa(d.people?.length||0)}`}
async function initSync(){
  const cfg=syncConfig();if(!cfg||!window.firebase)return;
  try{
    if(!sync.app)sync.app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
    sync.auth=firebase.auth();sync.db=firebase.firestore();
    if(sync.authListener)return;
    sync.authListener=true;
    sync.auth.onAuthStateChanged(async user=>{
      sync.user=user;fillSettingsSyncEmail();
      if(sync.timer)clearInterval(sync.timer);if(sync.unsubscribe){sync.unsubscribe();sync.unsubscribe=null}
      if(!user){sync.ready=false;setSyncStatus("☁️ برای همگام‌سازی وارد شوید");return}
      sync.ready=true;await hydrateSync();
      sync.unsubscribe=recordsCollection().onSnapshot(snap=>{
        if(sync.hydrating)return;
        const remote=snap.docs.map(d=>d.data());
        if(mergeCloud(remote)){localStorage.setItem(KEY,JSON.stringify(data));render();syncSave()}
        setSyncStatus("☁️ آنلاین • همگام‌سازی لحظه‌ای")
      },e=>setSyncStatus("⚠️ همگام‌سازی: "+(e.code||e.message)));
      sync.timer=setInterval(syncTick,SYNC_INTERVAL);
    });
  }catch(e){console.error(e);setSyncStatus("⚠️ تنظیمات Firebase نامعتبر است")}
}
async function syncSave(){
  if(!sync.ready||!sync.user||sync.hydrating)return;
  sync.queued=true;if(sync.saving)return;sync.saving=true;
  while(sync.queued){sync.queued=false;try{await pushRest();setSyncStatus("☁️ ذخیره ابری انجام شد — "+dataSummary(data)); logEvent("همگام‌سازی ابری","ذخیره تغییرات در ابر","sync",false)}catch(e){console.error(e);setSyncStatus("⚠️ ذخیره ابری انجام نشد: "+(e.code||"")+" "+e.message)}}
  sync.saving=false;
}
async function pushToCloud(){
  if(!sync.user)return alert("اول با حساب همگام‌سازی وارد شو");
  try{await pushRest();setSyncStatus("☁️ اطلاعات این گوشی به ابر منتقل شد — "+dataSummary(data));alert("ارسال با موفقیت انجام شد\n"+dataSummary(data));}
  catch(e){alert("ارسال ناموفق: "+(e.code||'')+"\n"+e.message)}
}
async function pullFromCloud(){
  if(!sync.user)return alert("اول با حساب همگام‌سازی وارد شو");
  try{
    const remote=await pullRest();
    if(!remote)return alert("هنوز اطلاعاتی در ابر وجود ندارد");
    mergeCloud(remote);localStorage.setItem(KEY,JSON.stringify(data));render();setSyncStatus("☁️ اطلاعات از ابر دریافت شد — "+dataSummary(data));alert("اطلاعات ابری دریافت شد\n"+dataSummary(data));
  }catch(e){alert("دریافت ناموفق: "+(e.code||'')+"\n"+e.message)}
}
function openSyncSettings(){
 const c=syncConfig()||{};
 openModal(`<h2>☁️ اتصال دو گوشی</h2><div class="form">
 <p class="hint">ایمیل و رمز یکسان را روی هر دو گوشی استفاده کن. بعد از ورود، اطلاعات موجود در ابر خودکار دریافت می‌شود.</p>
 <input id="fbApiKey" placeholder="apiKey" value="${esc(c.apiKey||"")}">
 <input id="fbAuthDomain" placeholder="authDomain" value="${esc(c.authDomain||"")}">
 <input id="fbProjectId" placeholder="projectId" value="${esc(c.projectId||"")}">
 <input id="fbStorageBucket" placeholder="storageBucket (اختیاری)" value="${esc(c.storageBucket||"")}">
 <input id="fbAppId" placeholder="appId" value="${esc(c.appId||"")}">
 <hr><input id="syncEmail" type="email" placeholder="ایمیل حساب مشترک" autocomplete="username">
 <input id="syncPass" type="password" placeholder="رمز حساب مشترک" autocomplete="current-password">
 <button class="primary" onclick="saveSyncSettings()">ذخیره و اتصال</button>
 <button onclick="createSyncAccount()">ساخت حساب همگام‌سازی</button>
 <button onclick="logoutSync()">خروج از حساب</button>
 </div>`);
}
async function saveSyncSettings(){
 const cfg={apiKey:$('fbApiKey').value.trim(),authDomain:$('fbAuthDomain').value.trim(),projectId:$('fbProjectId').value.trim(),storageBucket:$('fbStorageBucket').value.trim(),appId:$('fbAppId').value.trim()};
 if(!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId)return alert("apiKey، authDomain، projectId و appId لازم است");
 localStorage.setItem(SYNC_KEY,JSON.stringify(cfg));
 try{await initSync();const email=$('syncEmail').value.trim(),pass=$('syncPass').value;if(email&&pass){await sync.auth.signInWithEmailAndPassword(email,pass);alert("اتصال و ورود انجام شد")}else alert("تنظیمات ذخیره شد؛ ایمیل و رمز را هم وارد کن تا وارد شوی");closeModal()}catch(e){alert("اتصال ناموفق: "+e.message)}}
async function createSyncAccount(){
 const email=$('syncEmail')?.value.trim(),pass=$('syncPass')?.value;if(!email||!pass)return alert("ایمیل و رمز را وارد کن");
 const cfg={apiKey:$('fbApiKey').value.trim(),authDomain:$('fbAuthDomain').value.trim(),projectId:$('fbProjectId').value.trim(),storageBucket:$('fbStorageBucket').value.trim(),appId:$('fbAppId').value.trim()};
 if(!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId)return alert("اول اطلاعات Firebase را کامل کن");
 localStorage.setItem(SYNC_KEY,JSON.stringify(cfg));
 try{await initSync();await sync.auth.createUserWithEmailAndPassword(email,pass);alert("حساب ساخته شد. همین ایمیل و رمز را روی گوشی دوم هم استفاده کن.")}catch(e){alert("ساخت حساب ناموفق: "+e.message)}}
async function ensureSyncReady(){
 const cfg=syncConfig();
 if(!cfg||!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId){alert("اول یک‌بار «تنظیم اتصال Firebase» را باز کن و اطلاعات Firebase را وارد کن.");return false}
 await initSync();
 if(!sync.auth){alert("اتصال Firebase آماده نیست");return false}
 return true;
}
function fillSettingsSyncEmail(){const e=$("settingsSyncEmail");if(e&&sync.user)e.value=sync.user.email||""}
async function loginFromSettings(){
 const email=$("settingsSyncEmail")?.value.trim(), pass=$("settingsSyncPass")?.value;
 if(!email||!pass)return alert("ایمیل و رمز را وارد کن");
 if(!await ensureSyncReady())return;
 try{await sync.auth.signInWithEmailAndPassword(email,pass);alert("ورود با موفقیت انجام شد؛ همگام‌سازی فعال شد");logEvent("ورود به حساب همگام‌سازی",email,"auth");$("settingsSyncPass").value="";setSyncStatus("☁️ همگام‌سازی فعال است")}
 catch(e){alert("ورود ناموفق: "+(e.message||e))}
}
async function createFromSettings(){
 const email=$("settingsSyncEmail")?.value.trim(), pass=$("settingsSyncPass")?.value;
 if(!email||!pass)return alert("ایمیل و رمز را وارد کن");
 if(pass.length<6)return alert("رمز باید حداقل ۶ کاراکتر باشد");
 if(!await ensureSyncReady())return;
 try{await sync.auth.createUserWithEmailAndPassword(email,pass);alert("حساب ساخته شد و همگام‌سازی فعال است. همین ایمیل و رمز را روی گوشی دوم وارد کن.");logEvent("ساخت حساب همگام‌سازی",email,"auth");$("settingsSyncPass").value="";setSyncStatus("☁️ همگام‌سازی فعال است")}
 catch(e){alert("ساخت حساب ناموفق: "+(e.message||e))}
}
async function logoutSync(){try{const email=sync.user?.email||"";await sync.auth?.signOut();alert("از حساب همگام‌سازی خارج شد");logEvent("خروج از حساب همگام‌سازی",email,"auth")}catch(e){alert(e.message)}}

function normalize(s){return String(s||"").replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٬،]/g,",").replace(/\s+/g," ").trim()}
function parseMoney(v){return Number(String(v).replace(/[^\d]/g,""))||0}

function showLock(){
 let old=$("lock"); if(old) old.remove();
 if(!data.pin)return;
 const d=document.createElement("div");d.id="lock";d.className="lock";
 d.innerHTML='<div class="lockbox"><h1>🔐 حسابدار</h1><p>رمز ورود را وارد کن</p><input id="pinInput" inputmode="numeric" maxlength="8" type="password" placeholder="رمز ورود"><button class="primary" id="unlockBtn">ورود</button></div>';
 document.body.appendChild(d);
 $("unlockBtn").onclick=unlock;
 $("pinInput").onkeydown=e=>{if(e.key==="Enter")unlock()};
}
function unlock(){if(!$("pinInput")||$("pinInput").value!==data.pin)return alert("رمز اشتباه است");$("lock").remove()}
function setPin(){
 const old=data.pin?prompt("رمز فعلی را وارد کن:"):"";
 if(data.pin&&old!==data.pin)return alert("رمز فعلی اشتباه است");
 const p=prompt(data.pin?"رمز جدید ۴ تا ۸ رقمی:":"یک رمز ۴ تا ۸ رقمی برای ورود تعیین کن:");
 if(p===null)return;
 if(!/^\d{4,8}$/.test(p))return alert("رمز باید ۴ تا ۸ رقم باشد");
 const p2=prompt("رمز جدید را دوباره وارد کن:");
 if(p!==p2)return alert("دو رمز یکسان نیستند");
 data.pin=p;save();logEvent("تغییر رمز ورود","رمز ورود تغییر کرد","settings");alert("رمز با موفقیت ذخیره شد");
}
function removePin(){
 if(!data.pin)return alert("هنوز رمزی فعال نیست");
 const p=prompt("رمز فعلی را وارد کن:");
 if(p!==data.pin)return alert("رمز فعلی اشتباه است");
 data.pin="";save();logEvent("حذف رمز ورود","قفل برنامه غیرفعال شد","settings");alert("رمز حذف شد");
}

document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",e=>{
 e.preventDefault();
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 const page=$(b.dataset.page);
 if(page)page.classList.add("active");
 const menuModal=$("menuModal");
 if(menuModal)menuModal.classList.add("hidden");
 render();
 logEvent("ورود به بخش",page?.querySelector("h2")?.textContent||b.textContent.trim(),"nav");
}));
$("theme").onclick=()=>{const dark=document.body.classList.toggle("dark");logEvent("تغییر تم",dark?"حالت شیشه‌ای تیره فعال شد":"حالت شیشه‌ای روشن فعال شد","settings")};
$("menuBtn").onclick=()=>{$("menuModal").classList.remove("hidden");logEvent("باز کردن منو","منوی اصلی","nav")};
function closeMenu(){$("menuModal").classList.add("hidden")}
$("menuModal").addEventListener("click",e=>{if(e.target.id==="menuModal")closeMenu()});

const modal=$("modal"),modalBody=$("modalBody");
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}

function touch(r){r.updatedAt=new Date().toISOString();return r}
function markDeleted(type,id){data._sync??={tombstones:{}};data._sync.tombstones??={};data._sync.tombstones[type]??={};const dt=new Date().toISOString();data._sync.tombstones[type][id]=dt;markDirty(type,id,true,{id},dt)}
function removeRecord(type,id){const i=data[type].findIndex(x=>x.id===id);if(i<0)return;data[type].splice(i,1);markDeleted(type,id);save()}
function accountSelect(id="acc",selected=""){return `<select id="${id}">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===selected?"selected":""}>${esc(a.name)}${a.bank?" • "+esc(a.bank):""}</option>`).join("")}</select>`}
function openAccount(id=null){const a=id&&data.accounts.find(x=>x.id===id);openModal(`<h2>${a?"ویرایش حساب":"افزودن حساب"}</h2><div class="form"><input id="an" placeholder="نام حساب" value="${esc(a?.name||"")}"><input id="bank" placeholder="نام بانک" value="${esc(a?.bank||"")}"><input id="sender" placeholder="شماره فرستنده پیامک بانک" value="${esc(a?.sender||"")}"><input id="card" placeholder="شماره کارت (اختیاری)" value="${esc(a?.card||"")}"><input id="ab" type="number" placeholder="موجودی اولیه" value="${Number(a?.balance)||0}"><button class="primary" onclick="saveAccount('${a?.id||""}')">${a?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveAccount(id){if(!$("an").value.trim())return alert("نام حساب را وارد کنید");const o={name:$("an").value.trim(),bank:$("bank").value.trim(),sender:$("sender").value.trim(),card:$("card").value.trim(),balance:Number($("ab").value)||0};if(id){const a=data.accounts.find(x=>x.id===id);Object.assign(a,o);touch(a);markDirty("accounts",a.id,false,a,a.updatedAt)}else{const a=touch({id:uid(),...o});data.accounts.push(a);markDirty("accounts",a.id,false,a,a.updatedAt)}save();logEvent(id?"ویرایش حساب":"ایجاد حساب",o.name,id?"edit":"create");closeModal()}
function deleteAccount(id){if(data.transactions.some(t=>t.accountID===id||t.from===id||t.to===id))return alert("این حساب تراکنش یا انتقال دارد؛ ابتدا آن‌ها را اصلاح یا حذف کنید");if(confirm("این حساب حذف شود؟")){const a=data.accounts.find(x=>x.id===id);removeRecord("accounts",id);logEvent("حذف حساب",a?.name||id,"delete")}}
function categoryButtons(type,selected=""){const arr=type==="expense"?data.expenseCats:data.incomeCats;return `<div class="category-window">${arr.map(c=>`<button type="button" class="cat-btn ${c.name===selected?"selected-cat":""}" onclick="pickCategory('${type}','${c.id}')">${esc(c.name)}</button>`).join("")}</div>`}
function openTx(id=null){if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");const t=id&&data.transactions.find(x=>x.id===id);if(t?.type==="transfer")return openTransfer(id);const typ=t?.type||"expense";openModal(`<h2>${t?"ویرایش تراکنش":"ثبت تراکنش"}</h2><div class="form"><div class="type-switch"><button type="button" id="expBtn" class="${typ==="expense"?"chosen":""}" onclick="txType('expense')">💸 هزینه</button><button type="button" id="incBtn" class="${typ==="income"?"chosen":""}" onclick="txType('income')">💰 دریافت</button></div><input id="txKind" type="hidden" value="${typ}"><input id="title" placeholder="عنوان" value="${esc(t?.title||"")}"><input id="amount" type="number" placeholder="مبلغ" value="${Number(t?.amount)||""}"><div id="expensePanel" style="display:${typ==="expense"?"block":"none"}"><b id="catLabel">${t?.category?"دسته هزینه: "+esc(t.category):"دسته هزینه را انتخاب کنید"}</b>${categoryButtons("expense",typ==="expense"?t?.category:"")}<input id="cat" type="hidden" value="${esc(typ==="expense"?t?.category||"":"")}"></div><div id="incomePanel" style="display:${typ==="income"?"block":"none"}"><b id="incatLabel">${t?.category?"نوع دریافت: "+esc(t.category):"نوع دریافت را انتخاب کنید"}</b>${categoryButtons("income",typ==="income"?t?.category:"")}<input id="incat" type="hidden" value="${esc(typ==="income"?t?.category||"":"")}"></div>${accountSelect("acc",t?.accountID||"")}<button class="primary" onclick="saveTx('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت تراکنش"}</button></div>`)}
function txType(t){$("txKind").value=t;$("expBtn").classList.toggle("chosen",t==="expense");$("incBtn").classList.toggle("chosen",t==="income");$("expensePanel").style.display=t==="expense"?"block":"none";$("incomePanel").style.display=t==="income"?"block":"none"}
function pickCategory(type,id){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===id);if(!c)return;if(type==="expense"){$("cat").value=c.name;$("catLabel").textContent="دسته هزینه: "+c.name}else{$("incat").value=c.name;$(("incatLabel")).textContent="نوع دریافت: "+c.name}}
function saveTx(id){const amount=parseMoney($("amount").value),type=$("txKind").value,category=type==="expense"?$("cat").value:$("incat").value;if(!amount)return alert("مبلغ را وارد کنید");if(!category)return alert("دسته را انتخاب کنید");if(id){const t=data.transactions.find(x=>x.id===id);Object.assign(t,{title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value});touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}else{const nt=touch({id:uid(),title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value,date:new Date().toISOString(),source:"manual"});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt)}save();logEvent(id?"ویرایش تراکنش":"ایجاد تراکنش",`${$("title").value.trim()||category} • ${money(amount)}`,id?"edit":"create");closeModal()}
function saveBankTx(type,amount,accountID){const nt=touch({id:uid(),title:$("bt").value.trim()||"تراکنش بانکی",amount,type,category:$("bc").value,accountID,date:new Date().toISOString(),source:"bank"});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);save();logEvent("ایجاد تراکنش بانکی",`${nt.title} • ${money(nt.amount)}`,"create");closeModal()}
function openTransfer(id=null){if(data.accounts.length<2)return alert("برای انتقال حداقل دو حساب لازم است");const t=id&&data.transactions.find(x=>x.id===id);openModal(`<h2>${t?"ویرایش انتقال":"انتقال بین حساب‌ها"}</h2><div class="form">${accountSelect("from",t?.from||data.accounts[0].id)}<span style="text-align:center">↓</span>${accountSelect("to",t?.to||data.accounts[1].id)}<input id="tam" type="number" placeholder="مبلغ" value="${Number(t?.amount)||""}"><input id="tnote" placeholder="توضیحات" value="${esc(t?.title||"")}"><button class="primary" onclick="saveTransfer('${t?.id||""}')">${t?"ذخیره تغییرات":"انتقال"}</button></div>`)}
function saveTransfer(id){if($("from").value===$("to").value)return alert("مبدأ و مقصد باید متفاوت باشند");const amount=parseMoney($("tam").value);if(!amount)return alert("مبلغ را وارد کنید");const o={title:$("tnote").value.trim()||"انتقال بین حساب‌ها",amount,type:"transfer",from:$("from").value,to:$("to").value,source:"transfer"};if(id){const t=data.transactions.find(x=>x.id===id);Object.assign(t,o);touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}else{const nt=touch({id:uid(),date:new Date().toISOString(),...o});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt)}save();logEvent(id?"ویرایش انتقال":"ایجاد انتقال",`${money(amount)}` ,id?"edit":"create");closeModal()}
function deleteTx(id){if(confirm("این تراکنش حذف شود؟")){const t=data.transactions.find(x=>x.id===id);removeRecord("transactions",id);logEvent("حذف تراکنش",t?.title||id,"delete")}}
function openCategory(){openModal(`<h2>🏷 دسته‌بندی‌ها</h2><div class="section-head"><b>دسته‌های هزینه</b><button onclick="addCatPrompt('expense')">＋</button></div>${data.expenseCats.map(c=>`<div class="item compact"><b>${esc(c.name)}</b><div class="actions"><button onclick="editCategory('expense','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('expense','${c.id}')">🗑</button></div></div>`).join("")}<div class="section-head"><b>نوع‌های دریافت</b><button onclick="addCatPrompt('income')">＋</button></div>${data.incomeCats.map(c=>`<div class="item compact"><b>${esc(c.name)}</b><div class="actions"><button onclick="editCategory('income','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('income','${c.id}')">🗑</button></div></div>`).join("")}`)}
function addCatPrompt(type){const n=prompt(type==="expense"?"نام دسته هزینه:":"نام نوع دریافت:");if(!n?.trim())return;const arr=type==="expense"?data.expenseCats:data.incomeCats;const nc=touch({id:uid(),name:n.trim()});arr.push(nc);markDirty(type==="expense"?"expenseCats":"incomeCats",nc.id,false,nc,nc.updatedAt);save();logEvent("ایجاد دسته",n.trim(),"create");openCategory()}
function editCategory(type,id){const arr=type==="expense"?data.expenseCats:data.incomeCats,c=arr.find(x=>x.id===id);if(!c)return;const n=prompt("نام جدید:",c.name);if(n?.trim()){const old=c.name;c.name=n.trim();touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);data.transactions.forEach(t=>{if(t.category===old){t.category=c.name;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}});save();openCategory()}}
function removeCategory(type,id){if(!confirm("این دسته حذف شود؟"))return;removeRecord(type==="expense"?"expenseCats":"incomeCats",id);openCategory()}
function openPerson(id=null){const p=id&&data.people.find(x=>x.id===id);openModal(`<h2>${p?"ویرایش بدهکار/بستانکار":"بدهکار / بستانکار"}</h2><div class="form"><select id="pt"><option value="debt" ${p?.type==="debt"?"selected":""}>من بدهکارم</option><option value="credit" ${p?.type==="credit"?"selected":""}>من طلبکارم</option></select><input id="pn" placeholder="نام شخص" value="${esc(p?.name||"")}"><input id="pa" type="number" placeholder="مبلغ" value="${Number(p?.amount)||""}"><input id="pd" type="date" value="${esc(p?.due||"")}"><textarea id="pnote" placeholder="توضیحات">${esc(p?.note||"")}</textarea><button class="primary" onclick="savePerson('${p?.id||""}')">${p?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function savePerson(id){const name=$("pn").value.trim(),amount=parseMoney($("pa").value);if(!name||!amount)return alert("نام و مبلغ را وارد کنید");const o={type:$("pt").value,name,amount,due:$("pd").value,note:$("pnote").value.trim()};if(id){const p=data.people.find(x=>x.id===id);if(!p)return alert("این شخص پیدا نشد");Object.assign(p,o);p.paid=Math.min(Number(p.paid)||0,amount);touch(p);markDirty("people",p.id,false,p,p.updatedAt)}else{const np=touch({id:uid(),paid:0,...o});data.people.push(np);markDirty("people",np.id,false,np,np.updatedAt)}localStorage.setItem(KEY,JSON.stringify(data));render();syncSave();logEvent(id?"ویرایش شخص":"ایجاد شخص",`${name} • ${money(amount)}`,id?"edit":"create");closeModal()}
function deletePerson(id){if(confirm("این مورد حذف شود؟")){const p=data.people.find(x=>x.id===id);removeRecord("people",id);logEvent("حذف شخص",p?.name||id,"delete")}}
function payPerson(id){const p=data.people.find(x=>x.id===id);if(!p)return;const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));const v=prompt("مبلغ تسویه:",String(remaining));if(v!==null){const n=parseMoney(v);if(!n)return alert("مبلغ نامعتبر است");p.paid=Math.min(Number(p.amount)||0,(Number(p.paid)||0)+n);touch(p);markDirty("people",p.id,false,p,p.updatedAt);save();logEvent("تسویه شخص",`${p.name} • ${money(n)}`,"payment")}}
function openReminder(id=null){const r=id&&data.reminders.find(x=>x.id===id);openModal(`<h2>${r?"ویرایش یادآوری":"یادآوری"}</h2><div class="form"><input id="rt" placeholder="عنوان" value="${esc(r?.title||"")}"><input id="ra" type="number" placeholder="مبلغ" value="${Number(r?.amount)||""}"><input id="rd" type="datetime-local" value="${esc(r?.date||"")}"><select id="rr"><option value="once" ${r?.repeat==="once"?"selected":""}>یک‌بار</option><option value="monthly" ${r?.repeat==="monthly"?"selected":""}>ماهانه</option><option value="weekly" ${r?.repeat==="weekly"?"selected":""}>هفتگی</option></select><select id="rb"><option value="expense" ${r?.type==="expense"?"selected":""}>پرداخت</option><option value="income" ${r?.type==="income"?"selected":""}>دریافت</option></select><button class="primary" onclick="saveReminder('${r?.id||""}')">${r?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveReminder(id){if(!$("rt").value||!$("rd").value)return alert("عنوان و تاریخ لازم است");const o={title:$("rt").value.trim(),amount:parseMoney($("ra").value),date:$("rd").value,repeat:$("rr").value,type:$("rb").value};if(id){const r=data.reminders.find(x=>x.id===id);Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{const nr=touch({id:uid(),...o});data.reminders.push(nr);markDirty("reminders",nr.id,false,nr,nr.updatedAt)}save();logEvent(id?"ویرایش یادآوری":"ایجاد یادآوری",o.title,id?"edit":"create");closeModal()}
function deleteReminder(id){if(confirm("این یادآوری حذف شود؟")){const r=data.reminders.find(x=>x.id===id);removeRecord("reminders",id);logEvent("حذف یادآوری",r?.title||id,"delete")}}
function openCheck(id=null){const c=id&&data.checks.find(x=>x.id===id);openModal(`<h2>${c?"ویرایش چک":"ثبت چک"}</h2><div class="form"><select id="ct"><option value="receive" ${c?.type==="receive"?"selected":""}>چک دریافتی</option><option value="pay" ${c?.type==="pay"?"selected":""}>چک پرداختی</option></select><input id="cn" placeholder="نام شخص" value="${esc(c?.name||"")}"><input id="camount" type="number" placeholder="مبلغ" value="${Number(c?.amount)||""}"><input id="cdate" type="date" value="${esc(c?.date||"")}"><input id="cnum" placeholder="شماره چک" value="${esc(c?.number||"")}"><input id="cbank" placeholder="بانک" value="${esc(c?.bank||"")}"><textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCheck('${c?.id||""}')">${c?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveCheck(id){if(!$("cn").value.trim()||!parseMoney($("camount").value)||!$("cdate").value)return alert("نام، مبلغ و تاریخ لازم است");const o={type:$("ct").value,name:$("cn").value.trim(),amount:parseMoney($("camount").value),date:$("cdate").value,number:$("cnum").value.trim(),bank:$("cbank").value.trim(),note:$("cnote").value};if(id){const c=data.checks.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("checks",c.id,false,c,c.updatedAt)}else{const nc=touch({id:uid(),done:false,...o});data.checks.push(nc);markDirty("checks",nc.id,false,nc,nc.updatedAt)}save();logEvent(id?"ویرایش چک":"ثبت چک",`${o.name} • ${money(o.amount)}`,id?"edit":"create");closeModal()}
function deleteCheck(id){if(confirm("این چک حذف شود؟")){const c=data.checks.find(x=>x.id===id);removeRecord("checks",id);logEvent("حذف چک",c?.name||id,"delete")}}
function requestNotifications(){if(!("Notification"in window))return alert("اعلان در این مرورگر در دسترس نیست");Notification.requestPermission().then(p=>alert(p==="granted"?"اعلان فعال شد":"اجازه اعلان داده نشد"))}

function accountBalance(id){let a=data.accounts.find(x=>x.id===id),v=Number(a?.balance)||0;data.transactions.forEach(t=>{if(t.type==="income"&&t.accountID===id)v+=t.amount;if(t.type==="expense"&&t.accountID===id)v-=t.amount;if(t.type==="transfer"){if(t.from===id)v-=t.amount;if(t.to===id)v+=t.amount}});return v}
function actionButtons(editFn,deleteFn,id){return `<div class="actions"><button type="button" title="ویرایش" onclick="${editFn}(\'${id}\')">✏️</button><button type="button" class="danger-icon" title="حذف" onclick="${deleteFn}(\'${id}\')">🗑</button></div>`}
function txHTML(t){if(t.type==="transfer")return `<div class="item"><div><b>↔ ${esc(t.title)}</b><div class="meta">${esc(data.accounts.find(a=>a.id===t.from)?.name||"")} ← ${esc(data.accounts.find(a=>a.id===t.to)?.name||"")}</div></div><div><strong>${money(t.amount)}</strong>${actionButtons("openTransfer","deleteTx",t.id)}</div></div>`;let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||"")} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":"دستی"}</div></div><div><strong class="${t.type}">${sign}${money(t.amount)}</strong>${actionButtons("openTx","deleteTx",t.id)}</div></div>`}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}
function render(){
 const inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),base=data.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),net=inc-exp;
 if($("balance"))$("balance").textContent=money(base+net);if($("income"))$("income").textContent=money(inc);if($("expense"))$("expense").textContent=money(exp);
 if($("recent"))$("recent").innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 if($("accountList"))$("accountList").innerHTML=data.accounts.map(a=>`<div class="item"><div><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}${a.sender?" • فرستنده: "+esc(a.sender):""}</div></div><div><strong>${money(accountBalance(a.id))}</strong>${actionButtons("openAccount","deleteAccount",a.id)}</div></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 const q=$("search")?.value?.trim()||"",ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("filterCat")){let opts='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("filterCat").innerHTML=opts;$("filterCat").value=fc}
 if($("txList"))$("txList").innerHTML=data.transactions.filter(t=>(!q||String(t.title).includes(q)||String(t.category||"").includes(q))&&(!ft||t.type===ft)&&(!fc||t.category===fc)).map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 if($("peopleList"))$("peopleList").innerHTML=data.people.filter(p=>(p.type||"debt")===peopleMode).map(p=>{const total=Number(p.amount)||0,paid=Math.min(Number(p.paid)||0,total),remaining=Math.max(0,total-paid);return `<div class="item"><div><b>${esc(p.name)}</b><div class="meta">${p.due?"سررسید: "+p.due:""}${p.note?" • "+esc(p.note):""}</div><div class="meta">کل: ${money(total)} • تسویه: ${money(paid)}</div></div><div><strong>${money(remaining)}</strong><div class="actions"><button type="button" onclick="payPerson('${p.id}')">تسویه</button>${actionButtons("openPerson","deletePerson",p.id)}</div></div></div>`}).join("")||empty(peopleMode==="debt"?"هنوز بدهکاری ثبت نشده":"هنوز طلبی ثبت نشده");
 if($("reminderList"))$("reminderList").innerHTML=data.reminders.map(r=>`<div class="item"><div><b>${esc(r.title)}</b><div class="meta">${new Date(r.date).toLocaleString("fa-IR")} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div></div><strong>${r.amount?money(r.amount):""}</strong></div>`).join("")||empty("یادآوری ندارید");
 if($("checkList"))$("checkList").innerHTML=data.checks.map(c=>`<div class="item"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${c.date}${c.bank?" • "+esc(c.bank):""}</div></div><strong>${money(c.amount)}</strong></div>`).join("")||empty("چکی ثبت نشده");
 if($("categoryList"))$("categoryList").innerHTML='<div class="card"><b>هزینه‌ها</b><p>'+data.expenseCats.map(c=>esc(c.name)).join(" • ")+'</p><b>دریافت‌ها</b><p>'+data.incomeCats.map(c=>esc(c.name)).join(" • ")+'</p></div>';
 const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+p.amount-p.paid,0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+p.amount-p.paid,0);
 if($("totalDebt"))$("totalDebt").textContent=money(debt);if($("totalCredit"))$("totalCredit").textContent=money(credit);
 if($("reportStats"))$("reportStats").innerHTML='<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>'+fa(data.transactions.length)+'</b></div><div class="card"><span>تعداد چک</span><b>'+fa(data.checks.length)+'</b></div></div>';
 drawChart(inc,exp);renderAudit()
}
function drawChart(inc,exp){const c=$("chart");if(!c)return;const x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);const max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{const bh=v[0]/max*170;x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#374151";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
function exportData(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabdar-backup.json";a.click();logEvent("پشتیبان‌گیری","فایل JSON صادر شد","settings")}
function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);data.audit??=[];save();logEvent("بازیابی اطلاعات","پشتیبان وارد شد","settings");showLock();alert("بازیابی شد")}catch{alert("فایل نامعتبر است")}};r.readAsText(file)}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){const pin=data.pin;data=blankData();data.pin=pin;save();logEvent("پاک کردن اطلاعات","اطلاعات برنامه پاک شد","delete");}}
showLock();render();logEvent("اجرای برنامه","برنامه حسابدار اجرا شد","system");initSync();

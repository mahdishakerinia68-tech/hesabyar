const KEY="hesabdar-v40";
const SYNC_KEY="hesabdar-firebase-config-v1";
const APP_VERSION="3.3";
const GITHUB_KEY="hesabdar-github-repo-v1";
const UPDATE_CHECK_MS=6*60*60*1000;
const SYNC_INTERVAL=5000;
const DEVICE_HEARTBEAT_MS=15000;
const DEVICE_ACTIVE_MS=45000;
const DEVICE_ID_KEY="hesabdar-device-id-v1";
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
let sync={app:null,auth:null,db:null,user:null,unsubscribe:null,ready:false,saving:false,queued:false,hydrating:false,authListener:false,dirty:new Map(),timer:null,heartbeatTimer:null,deviceId:null};
function syncConfig(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||"null")||DEFAULT_SYNC_CONFIG}catch{return DEFAULT_SYNC_CONFIG}}
function setSyncStatus(t){const e=$("syncStatus");if(e)e.textContent=t||""}
function getDeviceId(){try{let id=localStorage.getItem(DEVICE_ID_KEY);if(!id){id=uid();localStorage.setItem(DEVICE_ID_KEY,id)}return id}catch(e){return "device-"+Math.random().toString(36).slice(2)}}
async function updateDevicePresence(){if(!sync.user||!sync.db)return;try{sync.deviceId=sync.deviceId||getDeviceId();await cloudDoc().set({devices:{[sync.deviceId]:firebase.firestore.FieldValue.serverTimestamp()},lastConnectionCheck:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){console.warn("device heartbeat",e)}}
function startDeviceHeartbeat(){if(sync.heartbeatTimer)clearInterval(sync.heartbeatTimer);sync.deviceId=getDeviceId();updateDevicePresence();sync.heartbeatTimer=setInterval(updateDevicePresence,DEVICE_HEARTBEAT_MS)}
async function stopDeviceHeartbeat(){if(sync.heartbeatTimer){clearInterval(sync.heartbeatTimer);sync.heartbeatTimer=null}if(sync.user&&sync.db&&sync.deviceId){try{await cloudDoc().set({devices:{[sync.deviceId]:firebase.firestore.FieldValue.delete()}},{merge:true})}catch(e){console.warn("device presence cleanup",e)}}}
async function checkTwoPhoneConnection(){
  if(!sync.user||!sync.db){setSyncStatus("⚠️ برای بررسی اتصال، ابتدا وارد حساب مشترک شوید");return false}
  setSyncStatus("🔎 در حال بررسی اتصال دو گوشی...");
  try{
    await updateDevicePresence();
    const snap=await cloudDoc().get();
    const devices=snap.data()?.devices||{},now=Date.now(),active=Object.entries(devices).filter(([id,v])=>{const t=v?.toMillis?v.toMillis():0;return t&&now-t<DEVICE_ACTIVE_MS});
    const count=active.length;
    if(count>=2){setSyncStatus("🟢 اتصال دو گوشی برقرار است • "+fa(count)+" دستگاه فعال");logEvent("بررسی اتصال دو گوشی","دو دستگاه فعال در حساب همگام‌سازی شناسایی شد","sync");alert("🟢 اتصال دو گوشی برقرار است.\n\n"+fa(count)+" دستگاه در ۴۵ ثانیه اخیر فعال بوده‌اند.")}
    else{setSyncStatus("🟡 فقط این گوشی فعال است؛ گوشی دوم را به همین حساب وارد کن");logEvent("بررسی اتصال دو گوشی","گوشی دوم فعال شناسایی نشد","sync");alert("🟡 گوشی دوم فعال شناسایی نشد.\n\nروی گوشی دوم با همین ایمیل و رمز وارد حساب شو و چند ثانیه صبر کن.")}
    return count>=2;
  }catch(e){setSyncStatus("🔴 بررسی اتصال ناموفق: "+(e.code||e.message));return false}
}

const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
const money=n=>fa(n)+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
// Jalali date helpers (UI uses Persian dates; storage remains ISO/Gregorian for compatibility).
function div(a,b){return Math.floor(a/b)}
function gregorianToJalali(gy,gm,gd){let gdm=[0,31,59,90,120,151,181,212,243,273,304,334];let jy=gy<=1600?0:979;gy-=gy<=1600?621:1600;let gy2=gm>2?gy+1:gy;let days=365*gy+div(gy2+3,4)-div(gy2+99,100)+div(gy2+399,400)-80+gd+gdm[gm-1];jy+=33*div(days,12053);days%=12053;jy+=4*div(days,1461);days%=1461;if(days>365){jy+=div(days-1,365);days=(days-1)%365}let jm=days<186?1+div(days,31):7+div(days-186,30);let jd=1+(days<186?days%31:(days-186)%30);return [jy,jm,jd]}
function jalaliToGregorian(jy,jm,jd){let gy=jy+621;let days=-355668+365*gy+div(gy+3,4)-div(gy+99,100)+div(gy+399,400)+(jm<=6?(jm-1)*31:(jm-1)*30+6)+jd;let g=days;let gy2=400*div(g,146097);g%=146097;if(g>36524){gy2+=100*div(--g,36524);g%=36524;if(g>=365)g++}gy2+=4*div(g,1461);g%=1461;if(g>365){gy2+=div(g-1,365);g=(g-1)%365}let gd=g+1;let leap=(gy2%4===0&&gy2%100!==0)||gy2%400===0;let md=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31],gm=1;while(gd>md[gm-1]){gd-=md[gm-1];gm++}return [gy2,gm,gd]}
function padFa(n){return String(n).padStart(2,'0').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
function toFaDigits(s){return String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
function toEnDigits(s){return String(s).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))}
function jalaliLabel(v){if(!v)return '—';let d=new Date(v);if(Number.isNaN(d.getTime())){let m=toEnDigits(v).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);return m?`${m[1]}/${String(m[2]).padStart(2,'0')}/${String(m[3]).padStart(2,'0')}`:String(v)}let j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${toFaDigits(j[0])}/${padFa(j[1])}/${padFa(j[2])}`} 
function jalaliInputValue(v){if(!v)return '';let d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);let j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${toFaDigits(j[0])}/${String(j[1]).padStart(2,'0')}/${String(j[2]).padStart(2,'0')}`} 
function jalaliToISO(v){let m=toEnDigits(v||'').trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);if(!m)return '';let g=jalaliToGregorian(+m[1],+m[2],+m[3]);return `${g[0]}-${String(g[1]).padStart(2,'0')}-${String(g[2]).padStart(2,'0')}`}
function jalaliDateTimeInput(v){if(!v)return '';let d=new Date(v);if(Number.isNaN(d.getTime()))return toFaDigits(String(v).replace('T',' '));let j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${toFaDigits(j[0])}/${padFa(j[1])}/${padFa(j[2])} ${toFaDigits(String(d.getHours()).padStart(2,'0'))}:${toFaDigits(String(d.getMinutes()).padStart(2,'0'))}`}
function jalaliDateTimeToISO(v){let x=toEnDigits(v||'').trim().replace('T',' ');let m=x.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);if(!m)return '';let g=jalaliToGregorian(+m[1],+m[2],+m[3]);return `${g[0]}-${String(g[1]).padStart(2,'0')}-${String(g[2]).padStart(2,'0')}T${String(m[4]||'00').padStart(2,'0')}:${m[5]||'00'}`}
function todayJalali(){let d=new Date(),j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${j[0]}/${String(j[1]).padStart(2,'0')}/${String(j[2]).padStart(2,'0')}`}

const uid=()=>{try{if(globalThis.crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID()}catch(e){}return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2)};
const NATIVE_NOTIFICATION_ID_PREFIX=700000;
let nativeNotifications=null;
function getNativeSystemAlarm(){try{return globalThis.Capacitor?.Plugins?.SystemAlarm||null}catch(e){return null}}
async function addToAndroidClock(r){const p=getNativeSystemAlarm();if(!p||!r?.date)return false;const d=localDateFromInput(r.date);if(!d||d<=new Date())return false;try{const ret=await p.addAlarm({hour:d.getHours(),minute:d.getMinutes(),message:r.title||"یادآوری حسابدار"});return !!ret?.added}catch(e){console.warn("system clock alarm",e);return false}}
function getNativeLocalNotifications(){try{if(nativeNotifications)return nativeNotifications;const p=globalThis.Capacitor?.Plugins?.LocalNotifications;if(p&&typeof p.schedule==="function")nativeNotifications=p;return nativeNotifications}catch(e){return null}}
function notificationIdForReminder(id){let h=0;for(const ch of String(id||""))h=((h<<5)-h+ch.charCodeAt(0))|0;return NATIVE_NOTIFICATION_ID_PREFIX+(Math.abs(h)%100000000)}
function localDateFromInput(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function addMonthsSafe(d,n){const out=new Date(d.getTime()),day=out.getDate();out.setDate(1);out.setMonth(out.getMonth()+n);const last=new Date(out.getFullYear(),out.getMonth()+1,0).getDate();out.setDate(Math.min(day,last));return out}
function nextReminderDate(r,now=new Date()){let d=localDateFromInput(r?.date);if(!d)return null;const rep=r.repeat||"once";if(rep==="once")return d>now?d:null;let guard=0;while(d<=now&&guard++<500){if(rep==="daily")d=new Date(d.getTime()+86400000);else if(rep==="weekly")d=new Date(d.getTime()+7*86400000);else if(rep==="monthly")d=addMonthsSafe(d,1);else return null}return d>now?d:null}
async function cancelNativeReminder(id){const p=getNativeLocalNotifications();if(!p)return;try{await p.cancel({notifications:[{id:notificationIdForReminder(id)}]})}catch(e){console.warn("cancel reminder",e)}}
function repeatSchedule(rep){if(rep==="daily")return {repeats:true,every:"day"};if(rep==="weekly")return {repeats:true,every:"week"};if(rep==="monthly")return {repeats:true,every:"month"};return {repeats:false}}
async function scheduleNativeReminder(r){const p=getNativeLocalNotifications();if(!p)return false;const at=nextReminderDate(r);if(!at)return false;try{await p.schedule({notifications:[{id:notificationIdForReminder(r.id),title:r.title||"یادآوری حسابدار",body:r.body||"زمان یادآوری فرا رسیده است.",schedule:{at,...repeatSchedule(r.repeat||"once")},extra:{reminderId:r.id,sourceNoteId:r.sourceNoteId||null}}]});return true}catch(e){console.warn("schedule reminder",e);return false}}
async function rescheduleAllNativeReminders(){if(!getNativeLocalNotifications())return;for(const r of data.reminders||[]){await cancelNativeReminder(r.id);await scheduleNativeReminder(r)}}
async function requestNativeNotifications(){const p=getNativeLocalNotifications();if(p){try{const perm=await p.requestPermissions();if(perm.display!=="granted")return false;if(typeof p.checkExactNotificationSetting==="function"){const exact=await p.checkExactNotificationSetting();if(exact.value!=="granted"&&typeof p.changeExactNotificationSetting==="function")try{await p.changeExactNotificationSetting()}catch(e){console.warn("exact notification setting",e)}}await rescheduleAllNativeReminders();return true}catch(e){console.warn("native notification permission",e);return false}}if("Notification"in window){try{return (await Notification.requestPermission())==="granted"}catch(e){}}return false}
function reminderBodyFromNote(note){const parts=[];if(note?.text)parts.push(note.text);const pending=(note?.items||[]).filter(x=>!x.done).map(x=>x.text).filter(Boolean);if(pending.length)parts.push(pending.join(" • "));return parts.join(" — ")||"یادآوری یادداشت"}
function removeRecordSilent(type,id){const i=data[type].findIndex(x=>x.id===id);if(i<0)return;data[type].splice(i,1);markDeleted(type,id)}
async function upsertReminderForNote(note){if(!note?.id)return;const linked=(data.reminders||[]).filter(x=>x.sourceNoteId===note.id);let r=linked[0];for(const duplicate of linked.slice(1)){await cancelNativeReminder(duplicate.id);removeRecordSilent("reminders",duplicate.id)}const o={title:note.title||"یادداشت",amount:0,date:note.date||"",repeat:note.repeat&&note.repeat!=="none"?note.repeat:"once",type:"note",sourceNoteId:note.id,body:reminderBodyFromNote(note)};if(r){Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{r=touch({id:uid(),...o});data.reminders.push(r);markDirty("reminders",r.id,false,r,r.updatedAt)}save();if(r.date){await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}else{await cancelNativeReminder(r.id)}}
async function syncAllNotesToReminders(){let changed=false;const noteIds=new Set((data.notes||[]).map(n=>n.id));for(const n of data.notes||[]){const before=(data.reminders||[]).length;await upsertReminderForNote(n);if((data.reminders||[]).length!==before)changed=true}for(const r of [...(data.reminders||[])]){if(r.sourceNoteId&&!noteIds.has(r.sourceNoteId)){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);changed=true}}if(changed)save();else render();if(sync.db)syncSave()}
async function removeReminderForNote(noteId){const matches=(data.reminders||[]).filter(r=>r.sourceNoteId===noteId);for(const r of matches){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id)}if(matches.length)save()}

const blankData=()=>({accounts:[],transactions:[],people:[],reminders:[],notes:[],checks:[],invoices:[],customers:[],products:[],audit:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name})),pin:"",branding:{storeName:"",logo:"",stamp:"",signature:""},yearSettlements:{}});
window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
window.addEventListener("online",()=>{if(sync.db)sync.db.enableNetwork().catch(console.error);setSyncStatus("🌐 اینترنت برقرار شد؛ در حال اتصال به ابر...")});
window.addEventListener("offline",()=>setSyncStatus("⚠️ اینترنت دستگاه قطع است"));

let data;
try{data=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("hesabdar-v20")||localStorage.getItem("hesabdar-v11")||"null")}catch{data=null}
data=data||blankData();
data.accounts??=[];
if(!data.accounts.some(a=>String(a.name||"").trim()==="کیف پول نقدی")){const cash=touch({id:uid(),name:"کیف پول نقدی",bank:"",sender:"",card:"",balance:0,default:true});data.accounts.unshift(cash);localStorage.setItem(KEY,JSON.stringify(data));}
data.transactions??=[];data.people??=[];data.customers??=[];data.products??=[];data.reminders??=[];data.notes??=[];data.checks??=[];data.invoices??=[];data.audit??=[];data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name}));data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name}));data.pin=typeof data.pin==="string"?data.pin:"";data.branding??={storeName:"",logo:"",stamp:"",signature:""};data.branding.storeName??="";data.branding.logo??="";data.branding.stamp??="";data.branding.signature??="";data.yearSettlements??={};data._sync??={tombstones:{}};data._sync.tombstones??={};for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString()}}
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
  box.innerHTML=logs.map(e=>`<div class="audit-item"><div class="audit-icon">${auditIcon(e.kind)}</div><div class="audit-main"><b>${esc(e.action)}</b>${e.detail?`<div class="meta">${esc(e.detail)}</div>`:""}<small>${new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"short",timeStyle:"short"}).format(new Date(e.at))}</small></div></div>`).join("")||empty("هنوز گزارشی ثبت نشده است");
}
function clearAudit(){if(!data.audit?.length)return alert("گزارشی برای پاک کردن وجود ندارد");if(confirm("همه گزارش‌های فعالیت پاک شوند؟")){const old=data.audit.slice();data.audit=[];for(const e of old)markDirty("audit",e.id,true,{id:e.id},new Date().toISOString());save();logEvent("گزارش‌ها پاک شدند","سابقه فعالیت قبلی حذف شد","system")}}
function save(){localStorage.setItem(KEY,JSON.stringify(data));render();syncSave()}
function hasMeaningfulData(d){
  if(!d||typeof d!=="object")return false;
  return ["accounts","transactions","people","reminders","notes","checks","invoices"].some(k=>Array.isArray(d[k])&&d[k].length>0);
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
  const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"];
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
  const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"];
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
  const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"],out=[];
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
  const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"];
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
function dataSummary(d){return `حساب ${fa(d.accounts?.length||0)} • تراکنش ${fa(d.transactions?.length||0)} • افراد ${fa(d.people?.length||0)} • یادداشت ${fa(d.notes?.length||0)}`}
async function initSync(){
  const cfg=syncConfig();if(!cfg||!window.firebase)return;
  try{
    if(!sync.app)sync.app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
    sync.auth=firebase.auth();sync.db=firebase.firestore();
    if(sync.authListener)return;
    sync.authListener=true;
    sync.auth.onAuthStateChanged(async user=>{
      sync.user=user;fillSettingsSyncEmail();
      if(sync.timer)clearInterval(sync.timer);if(sync.unsubscribe){sync.unsubscribe();sync.unsubscribe=null}if(!user){sync.ready=false;await stopDeviceHeartbeat();setSyncStatus("☁️ برای همگام‌سازی وارد شوید");return}
      sync.ready=true;await hydrateSync();await rescheduleAllNativeReminders();startDeviceHeartbeat();
      sync.unsubscribe=recordsCollection().onSnapshot(snap=>{
        if(sync.hydrating)return;
        const remote=snap.docs.map(d=>d.data());
        if(mergeCloud(remote)){localStorage.setItem(KEY,JSON.stringify(data));render();syncSave();syncAllNotesToReminders().catch(console.error);rescheduleAllNativeReminders().catch(console.error)}
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
document.addEventListener("input",e=>{if(e.target.closest("#invoiceRows"))updateInvoiceLiveTotal()});
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
async function copyCardNumber(id){
 const a=data.accounts.find(x=>x.id===id);
 const card=String(a?.card||"").trim();
 if(!card)return alert("برای این حساب شماره کارت ثبت نشده است");
 try{
   if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(card);
   else {const ta=document.createElement("textarea");ta.value=card;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();}
   alert("شماره کارت کپی شد");
 }catch(e){console.warn("copy card",e);alert("کپی شماره کارت انجام نشد؛ دوباره تلاش کنید");}
}
async function shareCardNumber(id){
 const a=data.accounts.find(x=>x.id===id);
 const card=String(a?.card||"").trim();
 if(!card)return alert("برای این حساب شماره کارت ثبت نشده است");
 const text=`شماره کارت ${a?.name||"حساب"}: ${card}`;
 try{
   if(navigator.share){await navigator.share({title:"شماره کارت",text});}
   else {await copyCardNumber(id);}
 }catch(e){if(e?.name!=="AbortError")console.warn("share card",e);}
}
function cardActions(a){
 if(!String(a?.card||"").trim())return "";
 return `<div class="card-number-box"><span>💳 ${esc(a.card)}</span><div class="actions card-actions"><button type="button" title="کپی شماره کارت" onclick="copyCardNumber('${a.id}\')">📋 کپی</button><button type="button" title="ارسال شماره کارت" onclick="shareCardNumber('${a.id}\')">📤 ارسال</button></div></div>`;
}
function deleteAccount(id){const a=data.accounts.find(x=>x.id===id);if(!a)return;if(confirm("این حساب و تراکنش‌های مرتبط با آن حذف شوند؟")){const related=data.transactions.filter(t=>t.accountID===id||t.from===id||t.to===id);related.forEach(t=>removeRecord("transactions",t.id));removeRecord("accounts",id);logEvent("حذف حساب",`${a.name} • ${related.length} تراکنش مرتبط حذف شد`,"delete")}}
function categoryButtons(type,selected=""){const arr=type==="expense"?data.expenseCats:data.incomeCats;return `<div class="category-window">${arr.map(c=>`<button type="button" class="cat-btn ${c.name===selected?"selected-cat":""}" onclick="pickCategory('${type}','${c.id}')">${esc(c.name)}</button>`).join("")}</div>`}
function openTx(id=null){if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");const t=id&&data.transactions.find(x=>x.id===id);if(t?.type==="transfer")return openTransfer(id);const typ=t?.type||"expense";openModal(`<h2>${t?"ویرایش تراکنش":"ثبت تراکنش"}</h2><div class="form"><div class="type-switch"><button type="button" id="expBtn" class="${typ==="expense"?"chosen":""}" onclick="txType('expense')">💸 هزینه</button><button type="button" id="incBtn" class="${typ==="income"?"chosen":""}" onclick="txType('income')">💰 دریافت</button></div><input id="txKind" type="hidden" value="${typ}"><input id="title" placeholder="عنوان" value="${esc(t?.title||"")}"><input id="amount" type="number" placeholder="مبلغ" value="${Number(t?.amount)||""}"><div id="expensePanel" style="display:${typ==="expense"?"block":"none"}"><b id="catLabel">${t?.category?"دسته هزینه: "+esc(t.category):"دسته هزینه را انتخاب کنید"}</b>${categoryButtons("expense",typ==="expense"?t?.category:"")}<input id="cat" type="hidden" value="${esc(typ==="expense"?t?.category||"":"")}"></div><div id="incomePanel" style="display:${typ==="income"?"block":"none"}"><b id="incatLabel">${t?.category?"نوع دریافت: "+esc(t.category):"نوع دریافت را انتخاب کنید"}</b>${categoryButtons("income",typ==="income"?t?.category:"")}<input id="incat" type="hidden" value="${esc(typ==="income"?t?.category||"":"")}"></div>${accountSelect("acc",t?.accountID||"")}<label class="file-label">📎 تصویر پیوست (اختیاری)<input id="txImage" type="file" accept="image/*" onchange="previewTxImage(this)"></label>${t?.image?`<div class="attachment-preview"><img src="${t.image}" alt="پیوست"></div>`:""}<div id="txImagePreview"></div><button class="primary" onclick="saveTx('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت تراکنش"}</button></div>`)}
function txType(t){$("txKind").value=t;$("expBtn").classList.toggle("chosen",t==="expense");$("incBtn").classList.toggle("chosen",t==="income");$("expensePanel").style.display=t==="expense"?"block":"none";$("incomePanel").style.display=t==="income"?"block":"none"}
function pickCategory(type,id){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===id);if(!c)return;if(type==="expense"){$("cat").value=c.name;$("catLabel").textContent="دسته هزینه: "+c.name}else{$("incat").value=c.name;$(("incatLabel")).textContent="نوع دریافت: "+c.name}}
async function saveTx(id){
 const amount=parseMoney($("amount").value),type=$("txKind").value,category=type==="expense"?$("cat").value:$("incat").value;
 if(!amount)return alert("مبلغ را وارد کنید");if(!category)return alert("دسته را انتخاب کنید");
 let image=null; const file=$("txImage")?.files?.[0];
 if(file){try{image=await compressImage(file,1200,.72)}catch(e){console.warn(e)}}
 if(id){
  const t=data.transactions.find(x=>x.id===id); if(!t)return;
  Object.assign(t,{title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value});
  if(image)t.image=image;
  touch(t);markDirty("transactions",t.id,false,t,t.updatedAt);
 }else{
  const nt=touch({id:uid(),title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value,date:new Date().toISOString(),source:"manual"});
  if(image)nt.image=image;
  data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);
 }
 save();logEvent(id?"ویرایش تراکنش":"ایجاد تراکنش",`${$("title").value.trim()||category} • ${money(amount)}`,id?"edit":"create");closeModal()
}
function compressImage(file,max=1200,quality=.72){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onerror=reject;r.onload=()=>{
   const img=new Image();img.onload=()=>{
    const scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",quality));
   };img.onerror=reject;img.src=r.result;
  };r.readAsDataURL(file)
 })
}
function previewTxImage(input){
 const f=input?.files?.[0],box=$("txImagePreview");if(!box||!f)return;
 const r=new FileReader();r.onload=()=>box.innerHTML=`<div class="attachment-preview"><img src="${r.result}" alt="پیش‌نمایش"></div>`;r.readAsDataURL(f)
}
function openBankMessage(){
  if(!data.accounts.length)return alert("ابتدا یک حساب اضافه کنید");
  openModal(`<h2>🏦 تشخیص پیامک بانکی</h2><div class="form">
    <select id="bma">${data.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}${a.bank?" • "+esc(a.bank):""}</option>`).join("")}</select>
    <select id="bmt"><option value="income">دریافتی / واریز</option><option value="expense">پرداخت / برداشت</option></select>
    <input id="bmaAmount" type="number" min="0" placeholder="مبلغ تراکنش">
    <input id="bt" placeholder="عنوان / شرح پیامک">
    <textarea id="bms" placeholder="متن پیامک بانک (اختیاری)"></textarea>
    <select id="bc"><option value="بانکی">بانکی</option>${data.expenseCats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("")}</select>
    <button class="primary" onclick="processBankMessage()">ثبت تراکنش</button>
  </div>`);
}
function processBankMessage(){
  const accountID=$("bma")?.value, amount=parseMoney($("bmaAmount")?.value||"");
  if(!accountID||!amount)return alert("حساب و مبلغ را وارد کنید");
  const type=$("bmt")?.value||"income", title=$("bt")?.value.trim()||"تراکنش بانکی";
  const nt=touch({id:uid(),title,amount,type,category:$("bc")?.value||"بانکی",accountID,date:new Date().toISOString(),source:"bank",bankMessage:$("bms")?.value||""});
  data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);save();logEvent("ثبت پیامک بانکی",`${title} • ${money(amount)}`,"create");closeModal();
}
function saveBankTx(type,amount,accountID){const nt=touch({id:uid(),title:$("bt").value.trim()||"تراکنش بانکی",amount,type,category:$("bc").value,accountID,date:new Date().toISOString(),source:"bank"});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);save();logEvent("ایجاد تراکنش بانکی",`${nt.title} • ${money(nt.amount)}`,"create");closeModal()}
function openTransfer(id=null){
 const t=id&&data.transactions.find(x=>x.id===id);
 const mode=t?.destinationType||((t?.otherName||t?.otherCard)?"other":"self");
 const fromId=t?.from||data.accounts[0]?.id||"";
 if(!fromId)return alert("ابتدا یک حساب اضافه کنید");
 openModal(`<h2>${t?"ویرایش انتقال":"انتقال / کارت‌به‌کارت"}</h2><div class="form">
 <label>نوع مقصد</label><div class="type-switch"><button type="button" id="selfTransferBtn" class="${mode==="self"?"chosen":""}" onclick="transferMode('self')">🏦 حساب خودم</button><button type="button" id="otherTransferBtn" class="${mode==="other"?"chosen":""}" onclick="transferMode('other')">👤 حساب دیگران</button></div>
 <input id="transferMode" type="hidden" value="${mode}"><div id="selfTransferPanel" style="display:${mode==="self"?"block":"none"}">${accountSelect("from",fromId)}<span style="text-align:center">↓</span>${accountSelect("to",t?.to||data.accounts.find(a=>a.id!==fromId)?.id||"")}</div>
 <div id="otherTransferPanel" style="display:${mode==="other"?"block":"none"}"><select id="otherFrom">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===fromId?"selected":""}>${esc(a.name)}</option>`).join("")}</select><input id="otherName" placeholder="نام صاحب حساب / گیرنده" value="${esc(t?.otherName||"")}"><input id="otherCard" inputmode="numeric" placeholder="شماره کارت گیرنده" value="${esc(t?.otherCard||"")}"></div>
 <input id="tam" type="number" placeholder="مبلغ" value="${Number(t?.amount)||""}"><input id="tnote" placeholder="توضیحات" value="${esc(t?.title||"")}"><button class="primary" onclick="saveTransfer('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت انتقال"}</button></div>`)
}
function transferMode(mode){$("transferMode").value=mode;$("selfTransferBtn").classList.toggle("chosen",mode==="self");$("otherTransferBtn").classList.toggle("chosen",mode==="other");$("selfTransferPanel").style.display=mode==="self"?"block":"none";$("otherTransferPanel").style.display=mode==="other"?"block":"none"}
function saveTransfer(id){
 const mode=$("transferMode").value,amount=parseMoney($("tam").value);if(!amount)return alert("مبلغ را وارد کنید");
 if(mode==="self"){
  if(!$("to").value||$("from").value===$("to").value)return alert("مبدأ و مقصد باید متفاوت باشند");
 }else if(!$("otherName").value.trim()||!$("otherCard").value.trim())return alert("نام و شماره کارت گیرنده را وارد کنید");
 const from=mode==="self"?$("from").value:$("otherFrom").value;
 const o={title:$("tnote").value.trim()||"کارت‌به‌کارت",amount,type:"transfer",from,to:mode==="self"?$("to").value:null,source:"transfer",destinationType:mode,otherName:mode==="other"?$("otherName").value.trim():"",otherCard:mode==="other"?$("otherCard").value.trim():""};
 if(id){const t=data.transactions.find(x=>x.id===id);if(!t)return;Object.assign(t,o);touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}else{const nt=touch({id:uid(),date:new Date().toISOString(),...o});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt)}save();logEvent(id?"ویرایش انتقال":"ایجاد انتقال",`${money(amount)} • ${mode==="other"?o.otherName:"حساب خودم"}`,id?"edit":"create");closeModal()
}
function deleteTx(id){if(confirm("این تراکنش حذف شود؟")){const t=data.transactions.find(x=>x.id===id);removeRecord("transactions",id);logEvent("حذف تراکنش",t?.title||id,"delete")}}
function openCategory(){openModal(`<h2>🏷 دسته‌بندی‌ها</h2><div class="section-head"><b>دسته‌های هزینه</b><button onclick="addCatPrompt('expense')">＋</button></div>${data.expenseCats.map(c=>`<div class="item compact"><b>${esc(c.name)}</b><div class="actions"><button onclick="editCategory('expense','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('expense','${c.id}')">🗑</button></div></div>`).join("")}<div class="section-head"><b>نوع‌های دریافت</b><button onclick="addCatPrompt('income')">＋</button></div>${data.incomeCats.map(c=>`<div class="item compact"><b>${esc(c.name)}</b><div class="actions"><button onclick="editCategory('income','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('income','${c.id}')">🗑</button></div></div>`).join("")}`)}
function addCatPrompt(type){const n=prompt(type==="expense"?"نام دسته هزینه:":"نام نوع دریافت:");if(!n?.trim())return;const arr=type==="expense"?data.expenseCats:data.incomeCats;const nc=touch({id:uid(),name:n.trim()});arr.push(nc);markDirty(type==="expense"?"expenseCats":"incomeCats",nc.id,false,nc,nc.updatedAt);save();logEvent("ایجاد دسته",n.trim(),"create");openCategory()}
function editCategory(type,id){const arr=type==="expense"?data.expenseCats:data.incomeCats,c=arr.find(x=>x.id===id);if(!c)return;const n=prompt("نام جدید:",c.name);if(n?.trim()){const old=c.name;c.name=n.trim();touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);data.transactions.forEach(t=>{if(t.category===old){t.category=c.name;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}});save();openCategory()}}
function removeCategory(type,id){if(!confirm("این دسته حذف شود؟"))return;removeRecord(type==="expense"?"expenseCats":"incomeCats",id);openCategory()}
function openProduct(id=null){const p=id&&data.products.find(x=>x.id===id);openModal(`<h2>${p?"ویرایش کالا":"کالای جدید"}</h2><div class="form"><input id="prdName" placeholder="نام کالا / خدمت" value="${esc(p?.name||"")}"><input id="prdCode" placeholder="کد کالا (اختیاری)" value="${esc(p?.code||"")}"><div class="two-fields"><input id="prdBuy" type="number" min="0" placeholder="قیمت خرید" value="${Number(p?.buyPrice)||0}"><input id="prdPrice" type="number" min="0" placeholder="قیمت فروش" value="${Number(p?.price)||0}"><input id="prdStock" type="number" min="0" placeholder="موجودی" value="${Number(p?.stock)||0}"></div><input id="prdMin" type="number" min="0" placeholder="حداقل موجودی برای هشدار" value="${Number(p?.minStock)||0}"><button class="primary" onclick="saveProduct('${p?.id||""}')">💾 ذخیره</button></div>`)}
function saveProduct(id){const name=$("prdName").value.trim();if(!name)return alert("نام کالا را وارد کن");const o={name,code:$("prdCode").value.trim(),buyPrice:Number($("prdBuy").value)||0,price:Number($("prdPrice").value)||0,stock:Number($("prdStock").value)||0,minStock:Number($("prdMin").value)||0};if(id){const p=data.products.find(x=>x.id===id);Object.assign(p,o);touch(p);markDirty("products",p.id,false,p,p.updatedAt)}else{const p=touch({id:uid(),...o});data.products.unshift(p);markDirty("products",p.id,false,p,p.updatedAt)}save();logEvent(id?"ویرایش کالا":"افزودن کالا",name,id?"edit":"create");closeModal()}
function deleteProduct(id){if(!confirm("این کالا حذف شود؟"))return;const p=data.products.find(x=>x.id===id);removeRecord("products",id);logEvent("حذف کالا",p?.name||id,"delete")}
function renderProducts(){const box=$("productList");if(!box)return;box.innerHTML=data.products.map(p=>`<div class="item"><div><b>📦 ${esc(p.name)}</b><div class="meta">${p.code?"کد: "+esc(p.code)+" • ":""}خرید: ${money(p.buyPrice||0)} • فروش: ${money(p.price)}</div><div class="meta">موجودی: ${fa(p.stock)} ${Number(p.stock)<=Number(p.minStock)&&Number(p.minStock)>0?" • ⚠️ موجودی کم":""}</div></div><div class="actions"><button onclick="openProduct('${p.id}')">✏️</button><button onclick="deleteProduct('${p.id}')" class="danger-icon">🗑</button></div></div>`).join("")||empty("هنوز کالایی ثبت نشده است")}
function adjustStockForInvoice(inv,dir){for(const it of inv?.items||[]){if(!it.productId)continue;const p=data.products.find(x=>x.id===it.productId);if(p){p.stock=Math.max(0,Number(p.stock||0)+(dir*Number(it.qty||0)));touch(p);markDirty("products",p.id,false,p,p.updatedAt)}}}

function openCustomer(id=null){const c=id&&data.customers.find(x=>x.id===id);openModal(`<h2>${c?"ویرایش مشتری":"مشتری جدید"}</h2><div class="form"><input id="cname" placeholder="نام مشتری" value="${esc(c?.name||"")}"><input id="cphone" inputmode="tel" placeholder="شماره تماس" value="${esc(c?.phone||"")}"><textarea id="caddress" placeholder="آدرس">${esc(c?.address||"")}</textarea><textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCustomer('${c?.id||""}')">💾 ذخیره</button></div>`)}
function saveCustomer(id){const name=$("cname").value.trim();if(!name)return alert("نام مشتری را وارد کن");const o={name,phone:$("cphone").value.trim(),address:$("caddress").value.trim(),note:$("cnote").value.trim()};if(id){const c=data.customers.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("customers",c.id,false,c,c.updatedAt)}else{const c=touch({id:uid(),...o});data.customers.unshift(c);markDirty("customers",c.id,false,c,c.updatedAt)}save();logEvent(id?"ویرایش مشتری":"ایجاد مشتری",name,id?"edit":"create");closeModal()}
function deleteCustomer(id){if(!confirm("این مشتری حذف شود؟"))return;const c=data.customers.find(x=>x.id===id);removeRecord("customers",id);logEvent("حذف مشتری",c?.name||id,"delete")}
function customerStats(c){const inv=data.invoices.filter(x=>x.customerId===c.id);return {count:inv.length,total:inv.reduce((s,x)=>s+invoiceTotal(x),0),paid:inv.reduce((s,x)=>s+Number(x.paid||0),0),due:inv.reduce((s,x)=>s+invoiceRemaining(x),0)}}
function renderCustomers(){const box=$("customerList");if(!box)return;box.innerHTML=data.customers.map(c=>{const st=customerStats(c);return `<div class="item"><div><b>👤 ${esc(c.name)}</b><div class="meta">${esc(c.phone||"بدون شماره")} • ${fa(st.count)} فاکتور</div><div class="meta">خرید: ${money(st.total)} • پرداخت: ${money(st.paid)} • مانده: ${money(st.due)}</div></div><div class="actions"><button onclick="openCustomer('${c.id}')">✏️</button><button onclick="exportCustomerExcel('${c.id}')">📊</button><button onclick="deleteCustomer('${c.id}')" class="danger-icon">🗑</button></div></div>`}).join("")||empty("هنوز مشتری ثبت نشده است")}
function exportXLS(filename,headers,rows){const escHtml=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");const html=`<html><head><meta charset="UTF-8"></head><body><table><thead><tr>${headers.map(h=>`<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename.endsWith(".xls")?filename:filename+".xls";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function exportAccountExcel(id){const a=data.accounts.find(x=>x.id===id);if(!a)return;const tx=data.transactions.filter(t=>t.accountID===id||t.from===id||t.to===id).sort((x,y)=>String(x.date).localeCompare(String(y.date)));const rows=tx.map(t=>{const kind=t.type==="income"?"دریافتی":t.type==="expense"?"پرداختی":"انتقال";const other=t.type==="transfer"?(t.destinationType==="other"?(t.otherName||"دیگران"):data.accounts.find(x=>x.id===t.to)?.name||""):"";const sign=t.type==="income"?Number(t.amount||0):(t.type==="expense"||t.from===id)?-Number(t.amount||0):Number(t.amount||0);return [jalaliLabel(t.date),kind,t.title||"",data.accounts.find(x=>x.id===t.accountID)?.name||a.name,other,sign,accountBalance(a.id)]});exportXLS(`گزارش-${a.name}`,['تاریخ','نوع','شرح','حساب','مقصد','مبلغ خالص','مانده حساب'],rows)}
function exportCustomerExcel(id){const c=data.customers.find(x=>x.id===id);if(!c)return;const inv=data.invoices.filter(x=>x.customerId===id);const rows=inv.map(x=>[invoiceDateLabel(x.date),x.number||"",x.name||"",invoiceTotal(x),Number(x.paid||0),invoiceRemaining(x),x.status==="paid"?"پرداخت کامل":x.status==="partial"?"پرداخت بخشی":"پرداخت نشده"]);exportXLS(`مشتری-${c.name}`,['تاریخ','شماره فاکتور','عنوان','مبلغ','پرداخت','مانده','وضعیت'],rows)}
function exportAllCustomersExcel(){const rows=data.customers.map(c=>{const st=customerStats(c);return [c.name,c.phone||"",st.count,st.total,st.paid,st.due]});exportXLS('همه-مشتریان',['نام مشتری','شماره تماس','تعداد فاکتور','مجموع خرید','مجموع پرداخت','مانده'],rows)}

function openPerson(id=null){const p=id&&data.people.find(x=>x.id===id);openModal(`<h2>${p?"ویرایش بدهکار/بستانکار":"بدهکار / بستانکار"}</h2><div class="form"><select id="pt"><option value="debt" ${p?.type==="debt"?"selected":""}>من بدهکارم</option><option value="credit" ${p?.type==="credit"?"selected":""}>من طلبکارم</option></select><input id="pn" placeholder="نام شخص" value="${esc(p?.name||"")}"><input id="pa" type="number" placeholder="مبلغ" value="${Number(p?.amount)||""}"><input id="pd" inputmode="numeric" placeholder="تاریخ شمسی ۱۴۰۵/۰۶/۰۸" value="${esc(jalaliInputValue(p?.due||""))}"><textarea id="pnote" placeholder="توضیحات">${esc(p?.note||"")}</textarea><button class="primary" onclick="savePerson('${p?.id||""}')">${p?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function savePerson(id){const name=$("pn").value.trim(),amount=parseMoney($("pa").value);if(!name||!amount)return alert("نام و مبلغ را وارد کنید");const o={type:$("pt").value,name,amount,due:jalaliToISO($("pd").value),note:$("pnote").value.trim()};if(id){const p=data.people.find(x=>x.id===id);if(!p)return alert("این شخص پیدا نشد");Object.assign(p,o);p.paid=Math.min(Number(p.paid)||0,amount);touch(p);markDirty("people",p.id,false,p,p.updatedAt)}else{const np=touch({id:uid(),paid:0,...o});data.people.push(np);markDirty("people",np.id,false,np,np.updatedAt)}localStorage.setItem(KEY,JSON.stringify(data));render();syncSave();logEvent(id?"ویرایش شخص":"ایجاد شخص",`${name} • ${money(amount)}`,id?"edit":"create");closeModal()}
function deletePerson(id){if(confirm("این مورد حذف شود؟")){const p=data.people.find(x=>x.id===id);removeRecord("people",id);logEvent("حذف شخص",p?.name||id,"delete")}}
function payPerson(id){const p=data.people.find(x=>x.id===id);if(!p)return;const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));const v=prompt("مبلغ تسویه:",String(remaining));if(v!==null){const n=parseMoney(v);if(!n)return alert("مبلغ نامعتبر است");p.paid=Math.min(Number(p.amount)||0,(Number(p.paid)||0)+n);touch(p);markDirty("people",p.id,false,p,p.updatedAt);save();logEvent("تسویه شخص",`${p.name} • ${money(n)}`,"payment")}}

function pickerDateValue(v){if(!v)return todayJalali();let d=new Date(v);if(Number.isNaN(d.getTime()))return toFaDigits(String(v));let j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${toFaDigits(j[0])}/${padFa(j[1])}/${padFa(j[2])}`;}
function pickerTimeValue(v){const d=v?new Date(v):new Date(); if(Number.isNaN(d.getTime())) return ""; return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function pickerToISO(dateId,timeId){const dv=$(dateId)?.value||"", tv=$(timeId)?.value||"00:00"; if(!dv)return ""; return jalaliDateTimeToISO(`${dv} ${tv}`);}
function pickerBox(dateId,timeId,v){return `<div class="date-time-picker"><label>📅 تاریخ شمسی <input id="${dateId}" inputmode="numeric" autocomplete="off" placeholder="۱۴۰۵/۰۶/۰۸" value="${esc(pickerDateValue(v))}"></label><label>⏰ ساعت <input id="${timeId}" type="time" value="${pickerTimeValue(v)}"></label><small>تاریخ را به‌صورت شمسی وارد کن (۱۴۰۵/۰۶/۰۸)</small></div>`;}

function openNote(id=null){
 const n=id&&data.notes.find(x=>x.id===id);
 const items=(n?.items||[]);
 openModal(`<h2>${n?"ویرایش یادداشت":"یادداشت جدید"}</h2><div class="form"><input id="ntitle" placeholder="عنوان یادداشت، مثلاً خرید" value="${esc(n?.title||"")}">${pickerBox("ndatePicker","ntimePicker",n?.date||new Date().toISOString())}<select id="nrepeat"><option value="none" ${!n?.repeat||n?.repeat==="none"?"selected":""}>بدون تکرار</option><option value="daily" ${n?.repeat==="daily"?"selected":""}>روزانه</option><option value="weekly" ${n?.repeat==="weekly"?"selected":""}>هفتگی</option><option value="monthly" ${n?.repeat==="monthly"?"selected":""}>ماهانه</option></select><textarea id="ntext" placeholder="توضیحات اصلی (اختیاری)">${esc(n?.text||"")}</textarea><div><b>آیتم‌های زیرمجموعه</b><div id="noteItemsEditor" class="note-items-editor">${items.map((it,i)=>noteItemEditor(it,i)).join("")}</div><button type="button" class="add-item-btn" onclick="addNoteItemEditor()">＋ افزودن آیتم</button></div><button class="primary" onclick="saveNote('${n?.id||""}')">${n?"ذخیره تغییرات":"ساخت یادداشت"}</button></div>`);
}
function noteItemEditor(it={},i){return `<div class="note-edit-row"><input class="note-item-input" data-note-item="${i}" placeholder="مثلاً خرید نان" value="${esc(it.text||"")}"><button type="button" class="mini-danger" onclick="this.parentElement.remove()">🗑</button></div>`}
function addNoteItemEditor(){const box=$("noteItemsEditor");if(!box)return;const i=box.querySelectorAll(".note-item-input").length;box.insertAdjacentHTML("beforeend",noteItemEditor({},i))}
async function saveNote(id){
 const title=$("ntitle").value.trim(); if(!title)return alert("عنوان یادداشت را وارد کنید");
 const inputs=[...document.querySelectorAll(".note-item-input")];
 const old=id?data.notes.find(x=>x.id===id):null; const oldItems=old?.items||[];
 const items=inputs.map((el,i)=>({id:oldItems[i]?.id||uid(),text:el.value.trim(),done:oldItems[i]?.done||false})).filter(x=>x.text);
 const o={title,date:pickerToISO("ndatePicker","ntimePicker"),repeat:$("nrepeat").value,text:$("ntext").value.trim(),items};
 if(id){if(!old)return alert("یادداشت پیدا نشد");Object.assign(old,o);touch(old);markDirty("notes",old.id,false,old,old.updatedAt);save();await upsertReminderForNote(old)}
 else{const nn=touch({id:uid(),...o});data.notes.unshift(nn);markDirty("notes",nn.id,false,nn,nn.updatedAt);save();await upsertReminderForNote(nn)}
 logEvent(id?"ویرایش یادداشت":"ایجاد یادداشت",title,id?"edit":"create");closeModal();
}
async function toggleNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);const it=n?.items?.find(x=>x.id===itemId);if(!it)return;it.done=!it.done;touch(n);markDirty("notes",n.id,false,n,n.updatedAt);save();await upsertReminderForNote(n);logEvent(it.done?"تکمیل آیتم یادداشت":"بازگردانی آیتم یادداشت",`${n.title} • ${it.text}`,"edit")}
async function deleteNote(id){if(confirm("این یادداشت و همه آیتم‌های آن حذف شود؟")){const n=data.notes.find(x=>x.id===id);await removeReminderForNote(id);removeRecord("notes",id);logEvent("حذف یادداشت",n?.title||id,"delete")}}
function deleteNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);if(!n)return;if(confirm("این آیتم حذف شود؟")){n.items=(n.items||[]).filter(x=>x.id!==itemId);touch(n);markDirty("notes",n.id,false,n,n.updatedAt);save();logEvent("حذف آیتم یادداشت",n.title,"delete")}}
function noteRepeatLabel(r){return r==="daily"?"روزانه":r==="weekly"?"هفتگی":r==="monthly"?"ماهانه":"بدون تکرار"}
function noteItemHTML(n,it){
 return '<div class="note-check-row"><label><input type="checkbox" '+(it.done?'checked':'')+' onchange="toggleNoteItem(\''+n.id+'\',\''+it.id+'\')"><span class="'+(it.done?'done':'')+'">'+esc(it.text)+'</span></label><button type="button" class="mini-danger note-item-delete" title="حذف آیتم" onclick="deleteNoteItem(\''+n.id+'\',\''+it.id+'\')">×</button></div>';
}
function noteHTML(n){
 const items=n.items||[];
 const list=items.length?items.map(it=>noteItemHTML(n,it)).join(''):'<div class="meta">هنوز آیتمی اضافه نشده</div>';
 return '<div class="note-card item"><div class="note-main"><div class="note-title"><span class="note-badge">📝</span><b>'+esc(n.title)+'</b></div>'+(n.text?'<div class="meta note-text">'+esc(n.text)+'</div>':'')+(n.date?'<div class="meta">⏰ '+jalaliDateTimeInput(n.date)+' • '+noteRepeatLabel(n.repeat)+'</div>':'<div class="meta">بدون زمان یادآوری</div>')+'<div class="note-checklist">'+list+'</div></div><div class="note-actions"><strong>'+(items.length?fa(items.filter(x=>x.done).length)+' / '+fa(items.length):'')+'</strong>'+actionButtons('openNote','deleteNote',n.id)+'</div></div>';
}

function openReminder(id=null){const r=id&&data.reminders.find(x=>x.id===id);openModal(`<h2>${r?"ویرایش یادآوری":"یادآوری"}</h2><div class="form"><input id="rt" placeholder="عنوان" value="${esc(r?.title||"")}"><input id="ra" type="number" placeholder="مبلغ" value="${Number(r?.amount)||""}">${pickerBox("rdPicker","rtPicker",r?.date||new Date().toISOString())}<select id="rr"><option value="once" ${r?.repeat==="once"?"selected":""}>یک‌بار</option><option value="monthly" ${r?.repeat==="monthly"?"selected":""}>ماهانه</option><option value="weekly" ${r?.repeat==="weekly"?"selected":""}>هفتگی</option></select><select id="rb"><option value="expense" ${r?.type==="expense"?"selected":""}>پرداخت</option><option value="income" ${r?.type==="income"?"selected":""}>دریافت</option></select><button class="primary" onclick="saveReminder('${r?.id||""}')">${r?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
async function saveReminder(id){if(!$("rt").value||!$("rdPicker").value)return alert("عنوان و تاریخ لازم است");const o={title:$("rt").value.trim(),amount:parseMoney($("ra").value),date:pickerToISO("rdPicker","rtPicker"),repeat:$("rr").value,type:$("rb").value};if(id){const r=data.reminders.find(x=>x.id===id);Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt);save();await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}else{const nr=touch({id:uid(),...o});data.reminders.push(nr);markDirty("reminders",nr.id,false,nr,nr.updatedAt);save();await scheduleNativeReminder(nr);if((nr.type||"")==="note" && (nr.repeat||"once")==="once") await addToAndroidClock(nr)}logEvent(id?"ویرایش یادآوری":"ایجاد یادآوری",o.title,id?"edit":"create");closeModal()}
async function deleteReminder(id){if(confirm("این یادآوری حذف شود؟")){const r=data.reminders.find(x=>x.id===id);await cancelNativeReminder(id);removeRecord("reminders",id);logEvent("حذف یادآوری",r?.title||id,"delete")}}

function openCheck(id=null){const c=id&&data.checks.find(x=>x.id===id);openModal(`<h2>${c?"ویرایش چک":"ثبت چک"}</h2><div class="form"><select id="ct"><option value="receive" ${c?.type==="receive"?"selected":""}>چک دریافتی</option><option value="pay" ${c?.type==="pay"?"selected":""}>چک پرداختی</option></select><input id="cn" placeholder="نام شخص" value="${esc(c?.name||"")}"><input id="camount" type="number" placeholder="مبلغ" value="${Number(c?.amount)||""}"><input id="cdate" inputmode="numeric" placeholder="تاریخ شمسی ۱۴۰۵/۰۶/۰۸" value="${esc(jalaliInputValue(c?.date||""))}"><input id="cnum" placeholder="شماره چک" value="${esc(c?.number||"")}"><input id="cbank" placeholder="بانک" value="${esc(c?.bank||"")}"><textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCheck('${c?.id||""}')">${c?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveCheck(id){if(!$("cn").value.trim()||!parseMoney($("camount").value)||!$("cdate").value)return alert("نام، مبلغ و تاریخ لازم است");const o={type:$("ct").value,name:$("cn").value.trim(),amount:parseMoney($("camount").value),date:jalaliToISO($("cdate").value),number:$("cnum").value.trim(),bank:$("cbank").value.trim(),note:$("cnote").value};if(id){const c=data.checks.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("checks",c.id,false,c,c.updatedAt)}else{const nc=touch({id:uid(),done:false,...o});data.checks.push(nc);markDirty("checks",nc.id,false,nc,nc.updatedAt)}save();logEvent(id?"ویرایش چک":"ثبت چک",`${o.name} • ${money(o.amount)}`,id?"edit":"create");closeModal()}
function deleteCheck(id){if(confirm("این چک حذف شود؟")){const c=data.checks.find(x=>x.id===id);removeRecord("checks",id);logEvent("حذف چک",c?.name||id,"delete")}}
function githubRepo(){return (localStorage.getItem(GITHUB_KEY)||"").trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/$/,"")}
function saveGithubRepo(){const v=$("githubRepo")?.value.trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/$/,"");if(!/^[^/\s]+\/[^/\s]+$/.test(v))return alert("مخزن را به شکل username/repository وارد کن");localStorage.setItem(GITHUB_KEY,v);setUpdateStatus("مخزن GitHub ذخیره شد: "+v);checkForUpdates(true)}
function setUpdateStatus(t){const e=$("updateStatus");if(e)e.textContent=t||""}
function versionParts(v){return String(v||"").replace(/^v/i,"").split(".").map(x=>parseInt(x,10)||0)}
function isNewerVersion(remote,local){const a=versionParts(remote),b=versionParts(local);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false}return false}
async function notifyUpdate(remote,url){const msg="نسخه جدید حسابدار "+remote+" منتشر شده است";try{if("Notification" in window && Notification.permission==="granted")new Notification("بروزرسانی حسابدار",{body:msg});else if("Notification" in window && Notification.permission!=="denied")await Notification.requestPermission().then(p=>{if(p==="granted")new Notification("بروزرسانی حسابدار",{body:msg})})}catch(e){} if(url && confirm(msg+"\n\nبرای مشاهده صفحه انتشار باز شود؟"))window.open(url,"_blank","noopener,noreferrer")}
async function checkForUpdates(manual=false){const repo=githubRepo();if($("githubRepo"))$("githubRepo").value=repo;if(!repo){setUpdateStatus("ابتدا مخزن GitHub را در تنظیمات وارد کن.");return false}if(!navigator.onLine){setUpdateStatus("📴 اینترنت قطع است؛ بررسی بروزرسانی بعد از اتصال انجام می‌شود.");return false}if(manual)setUpdateStatus("در حال بررسی نسخه جدید و بروزرسانی خودکار...");try{
  const r=await fetch("https://api.github.com/repos/"+repo+"/releases/latest",{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});if(!r.ok)throw new Error("GitHub "+r.status);
  const rel=await r.json(),remote=rel.tag_name||rel.name||"";localStorage.setItem("hesabdar-last-update-check",new Date().toISOString());
  if(isNewerVersion(remote,APP_VERSION)){setUpdateStatus("⚠️ نسخه جدید "+remote+" موجود است؛ بروزرسانی بررسی شد");if(localStorage.getItem("hesabdar-last-notified-update")!==remote){localStorage.setItem("hesabdar-last-notified-update",remote);await notifyUpdate(remote,rel.html_url)}}else{setUpdateStatus("✅ برنامه به‌روز است؛ نسخه فعلی "+APP_VERSION);localStorage.setItem("hesabdar-last-update",remote)}
  await updateServiceWorker(true);return true;
}catch(e){setUpdateStatus("❌ بررسی بروزرسانی انجام نشد؛ اینترنت و نام مخزن را بررسی کن.");return false}}
async function updateServiceWorker(force=false){if(!("serviceWorker" in navigator))return false;try{const reg=await navigator.serviceWorker.ready;if(force||reg.update)await reg.update();return true}catch(e){console.warn("service worker update",e);return false}}
function startUpdateChecker(){setTimeout(()=>checkForUpdates(false),2500);setInterval(()=>checkForUpdates(false),UPDATE_CHECK_MS);window.addEventListener("online",()=>setTimeout(()=>checkForUpdates(false),1500));if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!sessionStorage.getItem("hesabdar-sw-reloaded")){sessionStorage.setItem("hesabdar-sw-reloaded","1");location.reload()}})}
async function requestNotifications(){const ok=await requestNativeNotifications();alert(ok?"اعلان‌ها فعال شدند؛ یادآوری‌های زمان‌دار نیز زمان‌بندی شدند.":"اجازه اعلان داده نشد یا قابلیت Native در این محیط در دسترس نیست.")}


let quickTxType="expense";
function openCalculator(){
  openModal(`<h2>🧮 ماشین حساب</h2><div class="calculator"><input id="calcDisplay" class="calc-display" inputmode="decimal" placeholder="۰" readonly><div class="calc-grid">${["7","8","9","÷","4","5","6","×","1","2","3","−","0",".","C","+"].map(k=>`<button type="button" class="calc-key ${/[÷×−+]/.test(k)?"op":""}" onclick="calcKey('${k}')">${k}</button>`).join("")}<button type="button" class="calc-equal" onclick="calcEquals()">=</button></div></div>`);
}
function calcKey(k){const d=$("calcDisplay");if(!d)return;if(k==="C"){d.value="";return}if(k==="=" )return;if(d.value.length>40)return;d.value+=k;}
function calcEquals(){const d=$("calcDisplay");if(!d)return;let e=d.value.replaceAll("×","*").replaceAll("÷","/").replaceAll("−","-");if(!/^[0-9+*/.() -]+$/.test(e))return;try{const v=Function("return ("+e+")")();if(Number.isFinite(v))d.value=String(Math.round(v*100)/100)}catch{alert("عبارت نامعتبر است")}}
function openQuickTx(type="expense"){
  if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");
  quickTxType=type;
  const cats=type==="expense"?data.expenseCats:data.incomeCats;
  openModal(`<h2>${type==="expense"?"💸 ثبت هزینه‌های پشت‌سرهم":"💰 ثبت دریافتی‌های پشت‌سرهم"}</h2><p class="hint">چند مورد را پشت سر هم وارد کن؛ دسته‌ها از دسته‌بندی‌های برنامه خوانده می‌شوند.</p><div id="quickRows"></div><button type="button" class="secondary" onclick="addQuickRow()">＋ افزودن ${type==="expense"?"هزینه":"دریافتی"}</button><button type="button" class="primary" onclick="saveQuickRows()">ذخیره همه</button>`);
  addQuickRow();
}
function addQuickRow(pref={}){
  const box=$("quickRows");if(!box)return;
  const cats=quickTxType==="expense"?data.expenseCats:data.incomeCats;
  const row=document.createElement("div");row.className="quick-row";
  row.innerHTML=`<div class="quick-fields"><input class="quick-title" placeholder="${quickTxType==="expense"?"نام هزینه":"نام دریافتی"}" value="${esc(pref.title||"")}"><input class="quick-amount" type="number" inputmode="decimal" placeholder="مبلغ" value="${pref.amount||""}"><select class="quick-cat">${cats.map(c=>`<option value="${esc(c.name)}" ${pref.category===c.name?"selected":""}>${esc(c.name)}</option>`).join("")}</select><select class="quick-account">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===(pref.accountID||data.accounts[0]?.id)?"selected":""}>${esc(a.name)}</option>`).join("")}</select></div><button type="button" class="danger-icon quick-remove" onclick="this.parentElement.remove()">🗑</button>`;
  box.appendChild(row);
}
function saveQuickRows(){
  const rows=[...document.querySelectorAll("#quickRows .quick-row")];if(!rows.length)return alert("حداقل یک مورد اضافه کن");
  let count=0;
  for(const row of rows){const amount=parseMoney(row.querySelector(".quick-amount")?.value);if(!amount)continue;const category=row.querySelector(".quick-cat")?.value||"سایر";const title=row.querySelector(".quick-title")?.value.trim()||category;const accountID=row.querySelector(".quick-account")?.value||data.accounts[0]?.id;if(!accountID)continue;const nt=touch({id:uid(),title,amount,type:quickTxType,category,accountID,date:new Date().toISOString(),source:"quick"});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);logEvent(quickTxType==="expense"?"ثبت هزینه سریع":"ثبت دریافتی سریع",`${title} • ${money(amount)} • ${data.accounts.find(a=>a.id===accountID)?.name||""}`,"create");count++}
  if(!count)return alert("مبلغ حداقل یک مورد را وارد کن");save();closeModal();render();
}
function accountBalance(id){let a=data.accounts.find(x=>x.id===id),v=Number(a?.balance)||0;data.transactions.forEach(t=>{if(t.type==="income"&&t.accountID===id)v+=t.amount;if(t.type==="expense"&&t.accountID===id)v-=t.amount;if(t.type==="transfer"){if(t.from===id)v-=t.amount;if(t.destinationType!=="other"&&t.to===id)v+=t.amount}});return v}
function actionButtons(editFn,deleteFn,id){return `<div class="actions"><button type="button" title="ویرایش" onclick="${editFn}(\'${id}\')">✏️</button><button type="button" class="danger-icon" title="حذف" onclick="${deleteFn}(\'${id}\')">🗑</button></div>`}
function txHTML(t){if(t.type==="transfer"){const dest=t.destinationType==="other"?`👤 ${esc(t.otherName||"حساب دیگران")} • ${esc(t.otherCard||"")}`:`🏦 ${esc(data.accounts.find(a=>a.id===t.to)?.name||"")}`;return `<div class="item"><div><b>↔ ${esc(t.title)}</b><div class="meta">از ${esc(data.accounts.find(a=>a.id===t.from)?.name||"")} ← ${dest}</div></div><div><strong>${money(t.amount)}</strong>${actionButtons("openTransfer","deleteTx",t.id)}</div></div>`;}let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||"")} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":"دستی"}</div>${t.image?`<img class="tx-thumb" src="${t.image}" alt="پیوست" onclick="viewImage('${t.id}')">`:""}</div><div><strong class="${t.type}">${sign}${money(t.amount)}</strong>${actionButtons("openTx","deleteTx",t.id)}</div></div>`}
function viewImage(id){const t=data.transactions.find(x=>x.id===id);if(!t?.image)return;openModal(`<h2>📎 تصویر پیوست</h2><div class="attachment-large"><img src="${t.image}" alt="پیوست"></div>`)}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}

function invoiceTotal(inv){return (inv.items||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.price)||0),0)}
function invoiceDateLabel(v){return jalaliLabel(v)}
function invoiceRowHTML(item,i){return `<div class="invoice-row"><select class="inv-product" onchange="invoiceProductPick(this)"><option value="">کالا / خدمت</option>${data.products.map(p=>`<option value="${p.id}" ${p.id===item?.productId?"selected":""}>${esc(p.name)}</option>`).join("")}</select><input class="inv-desc" placeholder="شرح کالا / خدمات" value="${esc(item?.desc||"")}"><input class="inv-qty" oninput="updateInvoiceLiveTotal()" type="number" min="0" step="any" placeholder="تعداد" value="${Number(item?.qty)||""}"><input class="inv-price" oninput="updateInvoiceLiveTotal()" type="number" min="0" step="any" placeholder="مبلغ واحد" value="${Number(item?.price)||""}"><button type="button" class="danger-icon" onclick="this.parentElement.remove();updateInvoiceLiveTotal()">🗑</button></div>`}
function addInvoiceRow(pref={}){const box=$("invoiceRows");if(!box)return;const div=document.createElement("div");div.innerHTML=invoiceRowHTML(pref,box.children.length);box.appendChild(div.firstElementChild)}
function invoiceProductPick(sel){const p=data.products.find(x=>x.id===sel.value);const row=sel.closest(".invoice-row");if(!p||!row)return;row.querySelector(".inv-desc").value=p.name;row.querySelector(".inv-price").value=p.price||0;updateInvoiceLiveTotal()}
function openInvoice(id=null){
 const inv=id&&data.invoices.find(x=>x.id===id);
 const items=inv?.items?.length?inv.items:[{desc:"",qty:1,price:""}];
 const cust=inv?.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 openModal(`<h2>🧾 ${inv?"ویرایش فاکتور":"ساخت فاکتور"}</h2><div class="form">
 <input id="invName" placeholder="نام فاکتور" value="${esc(inv?.name||"")}">
 <div class="two-fields"><input id="invSeller" placeholder="نام فروشنده / فروشگاه" value="${esc(inv?.seller||"")}"><select id="invCustomer"><option value="">بدون مشتری</option>${data.customers.map(c=>`<option value="${c.id}" ${c.id===inv?.customerId?"selected":""}>${esc(c.name)}${c.phone?" • "+esc(c.phone):""}</option>`).join("")}</select></div>
 <div class="two-fields"><input id="invDate" inputmode="numeric" placeholder="تاریخ شمسی ۱۴۰۵/۰۶/۰۸" value="${esc(jalaliInputValue(inv?.date)||todayJalali())}"><input id="invNo" placeholder="شماره فاکتور" value="${esc(inv?.number||"")}"></div>
 <div class="two-fields"><select id="invStatus"><option value="unpaid" ${inv?.status!=="paid"&&inv?.status!=="partial"?"selected":""}>🔴 پرداخت نشده</option><option value="partial" ${inv?.status==="partial"?"selected":""}>🟡 پرداخت بخشی</option><option value="paid" ${inv?.status==="paid"?"selected":""}>🟢 پرداخت کامل</option></select><input id="invPaid" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="مبلغ پرداخت‌شده" value="${Number(inv?.paid)||0}"></div>
 <div class="two-fields"><input id="invDiscount" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="تخفیف" value="${Number(inv?.discount)||0}"><input id="invTax" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="مالیات (درصد)" value="${Number(inv?.taxRate)||0}"></div>
 <textarea id="invAddress" placeholder="آدرس / توضیحات مشتری">${esc(inv?.address||cust?.address||"")}</textarea>
 <div class="invoice-table-head"><span>کالا</span><span>توضیحات</span><span>تعداد</span><span>مبلغ واحد</span><span></span></div>
 <div id="invoiceRows">${items.map(invoiceRowHTML).join("")}</div>
 <button type="button" onclick="addInvoiceRow()">＋ افزودن ردیف</button>
 <div class="invoice-total-box">جمع اقلام: <strong id="invLiveSubtotal">۰ تومان</strong><br>تخفیف و مالیات: <strong id="invLiveAdjust">۰ تومان</strong><br>مبلغ نهایی: <strong id="invLiveTotal">۰ تومان</strong></div>
 <button class="primary" onclick="saveInvoice('${inv?.id||""}')">💾 ${inv?"ذخیره تغییرات":"ساخت فاکتور"}</button>
 </div>`);
 updateInvoiceLiveTotal();
}
function invoiceSubtotal(inv){return (inv.items||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.price)||0),0)}
function invoiceTotal(inv){const sub=invoiceSubtotal(inv),discountAmount=Math.min(sub,Math.max(0,Number(inv.discount)||0)),discountPercent=Math.min(100,Math.max(0,Number(inv.discountPercent)||0)),percentAmount=Math.min(sub-discountAmount,Math.round((sub-discountAmount)*discountPercent/100)),discount=discountAmount+percentAmount,tax=Math.max(0,Math.round((sub-discount)*(Number(inv.taxRate)||0)/100));return Math.max(0,sub-discount+tax)}
function invoiceRemaining(inv){return Math.max(0,invoiceTotal(inv)-(Number(inv.paid)||0))}
function updateInvoiceLiveTotal(){
 const rows=[...document.querySelectorAll("#invoiceRows .invoice-row")];let sub=0;
 rows.forEach(r=>sub+=(Number(r.querySelector(".inv-qty")?.value)||0)*(Number(r.querySelector(".inv-price")?.value)||0));
 const da=Math.min(sub,Math.max(0,Number($("invDiscount")?.value)||0)),dp=Math.min(100,Math.max(0,Number($("invDiscountPercent")?.value)||0)),dpAmt=Math.min(sub-da,Math.round((sub-da)*dp/100)),dis=da+dpAmt,tax=Math.max(0,Math.round((sub-dis)*(Number($("invTax")?.value)||0)/100)),total=Math.max(0,sub-dis+tax);
 if($("invLiveSubtotal"))$("invLiveSubtotal").textContent=money(sub);if($("invLiveAdjust"))$("invLiveAdjust").textContent=money(tax-dis);if($("invLiveTotal"))$("invLiveTotal").textContent=money(total)
}
function saveInvoice(id){
 const name=$("invName").value.trim()||"فاکتور جدید", seller=$("invSeller").value.trim(),date=jalaliToISO($("invDate").value)||new Date().toISOString().slice(0,10),number=$("invNo").value.trim();
 const items=[...document.querySelectorAll("#invoiceRows .invoice-row")].map(r=>({productId:r.querySelector(".inv-product")?.value||"",desc:r.querySelector(".inv-desc")?.value.trim()||"",qty:Number(r.querySelector(".inv-qty")?.value)||0,price:Number(r.querySelector(".inv-price")?.value)||0})).filter(x=>x.desc||x.qty||x.price);
 if(!items.length)return alert("حداقل یک ردیف فاکتور وارد کن");
 const discount=Math.max(0,Number($("invDiscount").value)||0),discountPercent=Math.min(100,Math.max(0,Number($("invDiscountPercent").value)||0)),taxRate=Math.max(0,Number($("invTax").value)||0);let paid=Math.max(0,Number($("invPaid").value)||0);
 const o={name,seller,date,number,items,customerId:$("invCustomer").value||"",address:$("invAddress").value.trim(),discount,discountPercent,taxRate,paid,status:$("invStatus").value,total:0};o.total=invoiceTotal(o);if(o.status==="paid")o.paid=o.total;if(o.paid>=o.total&&o.total>0)o.status="paid";else if(o.paid>0)o.status="partial";else o.status="unpaid";
 if(id){const x=data.invoices.find(v=>v.id===id);if(x)adjustStockForInvoice(x,+1);Object.assign(x,o);touch(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}else{const x=touch({id:uid(),...o});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}
 save();logEvent(id?"ویرایش فاکتور":"ساخت فاکتور",`${name} • ${money(o.total)}`,id?"edit":"create");closeModal()
}
function duplicateInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;const x=touch({...JSON.parse(JSON.stringify(inv)),id:uid(),number:"",date:new Date().toISOString().slice(0,10),status:"unpaid",paid:0});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);save();logEvent("تکرار فاکتور",x.name,"create")}
function deleteInvoice(id){if(!confirm("این فاکتور حذف شود؟"))return;const x=data.invoices.find(v=>v.id===id);adjustStockForInvoice(x,+1);removeRecord("invoices",id);logEvent("حذف فاکتور",x?.name||id,"delete")}
function invoiceHTML(inv){
 const total=invoiceTotal(inv);
 return `<div class="item invoice-item"><div><b>🧾 ${esc(inv.name||"فاکتور")}</b><div class="meta">${esc(inv.seller||"فروشنده ثبت نشده")} • ${invoiceDateLabel(inv.date)}${inv.number?" • شماره "+esc(inv.number):""}</div><div class="meta">جمع کل: ${money(total)} • ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}</div></div><div class="actions"><button onclick="openInvoice('${inv.id}')">✏️</button><button onclick="previewInvoice('${inv.id}')">👁</button><button onclick="duplicateInvoice('${inv.id}')">📄</button><button onclick="shareInvoice('${inv.id}')">📤</button><button class="danger-icon" onclick="deleteInvoice('${inv.id}')">🗑</button></div></div>`
}
function previewInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return; const cust=inv.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 const rows=(inv.items||[]).map(x=>`<div class="preview-inv-row"><span>${esc(x.desc)}</span><span>${fa(x.qty)}</span><span>${money(x.price)}</span><span>${money((Number(x.qty)||0)*(Number(x.price)||0))}</span></div>`).join("");
 openModal(`<div id="invoicePreview" class="invoice-preview"><div class="invoice-head"><div>${data.branding?.logo?`<img class="invoice-brand-logo" src="${data.branding.logo}" alt="لوگو">`:""}<h2>فاکتور</h2><b>${esc(inv.seller||data.branding?.storeName||"")}</b></div><div>شماره: ${esc(inv.number||"—")}<br>تاریخ: ${invoiceDateLabel(inv.date)}</div></div><h3>${esc(inv.name||"فاکتور")}</h3>${cust?`<div class="meta">مشتری: ${esc(cust.name)}${cust.phone?" • "+esc(cust.phone):""}</div>`:""}<div class="meta">وضعیت: ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}</div><div class="preview-inv-row head"><b>توضیحات</b><b>تعداد</b><b>مبلغ واحد</b><b>مبلغ</b></div>${rows}<div class="preview-total">جمع کل: <strong>${money(invoiceTotal(inv))}</strong></div></div><div class="actions"><button class="primary" onclick="printInvoice('${inv.id}')">🖨 چاپ / PDF</button><button class="primary" onclick="shareInvoice('${inv.id}')">📤 ارسال فاکتور</button></div>`)
}
function drawInvoiceCanvas(inv){
 const W=794, rowH=58, H=Math.max(1123,520+(inv.items||[]).length*rowH);
 const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
 x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#17352b";x.textAlign="right";x.direction="rtl";
 if(data.branding?.logo){try{const im=new Image();im.src=data.branding.logo;if(im.complete)x.drawImage(im,55,25,90,70)}catch(e){}} x.font="bold 34px sans-serif";x.fillText("فاکتور",W-45,55);
 x.font="bold 22px sans-serif";x.fillText(inv.seller||"فروشگاه / فروشنده",W-45,95);
 x.font="17px sans-serif";x.fillStyle="#56645f";x.fillText("شماره: "+(inv.number||"—"),W-45,130);x.fillText("تاریخ: "+invoiceDateLabel(inv.date),W-245,130);
 x.fillStyle="#17352b";x.font="bold 21px sans-serif";x.fillText(inv.name||"فاکتور",W-45,180);
 let y=245;x.fillStyle="#eaf2ee";x.fillRect(28,y-32,W-56,45);x.fillStyle="#17352b";x.font="bold 14px sans-serif";
 x.fillText("مبلغ",W-38,y-8);x.fillText("مبلغ واحد",W-230,y-8);x.fillText("تعداد",W-400,y-8);x.fillText("توضیحات",W-490,y-8);
 x.font="15px sans-serif";
 (inv.items||[]).forEach((it,i)=>{y+=rowH;x.fillStyle=i%2?"#fafcfb":"#fff";x.fillRect(55,y-50,W-110,rowH);x.fillStyle="#23312c";x.fillText(money((Number(it.qty)||0)*(Number(it.price)||0)),W-38,y);x.fillText(money(it.price),W-230,y);x.fillText(fa(it.qty),W-400,y);x.fillText(it.desc||"—",W-490,y);});
 y+=45;x.fillStyle="#17352b";x.font="bold 20px sans-serif";x.fillText("جمع کل: "+money(invoiceTotal(inv)),W-38,y);
 return c
}
async function shareInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return;
 const c=drawInvoiceCanvas(inv);
 const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.9));const file=new File([blob],`${(inv.name||"فاکتور").replace(/[\\/:*?"<>|]/g,"_")}.jpg`,{type:"image/jpeg"});
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:inv.name||"فاکتور",text:`${inv.name||"فاکتور"} • ${money(invoiceTotal(inv))}`,files:[file]});return}
 }catch(e){if(e?.name==="AbortError")return}
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);alert("عکس فاکتور آماده شد؛ از گزینه اشتراک گوشی می‌توانی ارسالش کنی.")
}
function printInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;previewInvoice(id);setTimeout(()=>window.print(),250)}
function previewBrandFile(input,type){const f=input?.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const box=$(type==="logo"?"brandLogoPreview":type==="stamp"?"brandStampPreview":"brandSignaturePreview");if(box)box.innerHTML=`<img class="brand-preview-img" src="${r.result}" alt="${type}">`;input.dataset.value=r.result};r.readAsDataURL(f)}
function loadBrandingSettings(){const b=data.branding||{};if($("brandStore"))$("brandStore").value=b.storeName||"";[["brandLogoPreview",b.logo,"لوگو"],["brandStampPreview",b.stamp,"مهر"],["brandSignaturePreview",b.signature,"امضا"]].forEach(([id,src,label])=>{const box=$(id);if(box)box.innerHTML=src?`<img class="brand-preview-img" src="${src}" alt="${label}">`:""})}
function saveBranding(){data.branding??={};data.branding.storeName=$("brandStore")?.value.trim()||"";["logo","stamp","signature"].forEach(type=>{const el=$(type==="logo"?"brandLogo":type==="stamp"?"brandStamp":"brandSignature");if(el?.dataset.value)data.branding[type]=el.dataset.value});save();logEvent("ذخیره مشخصات فاکتور",data.branding.storeName||"لوگو، مهر و امضا","settings");alert("مشخصات فاکتور ذخیره شد")}
function clearBranding(){if(!confirm("لوگو، مهر و امضا حذف شوند؟"))return;data.branding={storeName:"",logo:"",stamp:"",signature:""};save();loadBrandingSettings();logEvent("حذف مشخصات فاکتور","لوگو، مهر و امضا حذف شدند","settings")}
function currentJalaliYear(){const j=gregorianToJalali(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());return j[0]}
function settleCurrentYear(){const y=currentJalaliYear();const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);const credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);if(debt>0||credit>0){return alert(`سال ${fa(y)} هنوز تسویه کامل نشده است.\nبدهی باقی‌مانده: ${money(debt)}\nطلب باقی‌مانده: ${money(credit)}\nاین مبالغ به سال بعد منتقل می‌شوند.`)}if(!confirm(`سال ${fa(y)} به‌عنوان «تسویه کامل» ثبت شود؟ اطلاعات سال حذف نمی‌شود.`))return;data.yearSettlements[y]={settled:true,at:new Date().toISOString()};save();logEvent("تسویه کامل سال",`سال ${y} تسویه شد؛ بدهی و طلب باقی‌مانده صفر بود`,`payment`);renderYearSettlement();alert("تسویه کامل سال ثبت شد")}
function renderYearSettlement(){const box=$("yearSettlementBox");if(!box)return;const y=currentJalaliYear(),st=data.yearSettlements?.[y];const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);const rb=$("yearStatusReport");if(rb)rb.innerHTML=st?.settled?`<div class="card settlement-ok">🟢 سال ${fa(y)} تسویه شده است.</div>`:`<div class="card settlement-pending">🟡 سال ${fa(y)} هنوز تسویه نشده است.</div>`;box.innerHTML=st?.settled?`<div class="settlement-ok">🟢 سال ${fa(y)} تسویه شده است.</div>`:`<div class="settlement-pending">🟡 سال ${fa(y)} هنوز تسویه نشده است.<br>بدهی: ${money(debt)} • طلب: ${money(credit)}<br><small>بدهی‌ها و مطالبات تا تسویه کامل باقی می‌مانند.</small></div>`}
function renderBrandingInSettings(){loadBrandingSettings();renderYearSettlement()}
function render(){
 const inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),base=data.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),net=inc-exp;
 if($("balance"))$("balance").textContent=money(base+net);if($("income"))$("income").textContent=money(inc);if($("expense"))$("expense").textContent=money(exp);
 if($("recent"))$("recent").innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 if($("accountList"))$("accountList").innerHTML=data.accounts.map(a=>`<div class="item account-item"><div class="account-main"><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}${a.sender?" • فرستنده: "+esc(a.sender):""}</div>${cardActions(a)}</div><div><strong>${money(accountBalance(a.id))}</strong>${actionButtons("openAccount","deleteAccount",a.id)}<button type="button" title="گزارش Excel" onclick="exportAccountExcel('${a.id}')">📊</button></div></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 const q=$("search")?.value?.trim()||"",ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("reportAccount")){const rv=$("reportAccount").value;$("reportAccount").innerHTML='<option value="">همه حساب‌ها</option>'+data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");$("reportAccount").value=rv;}
 if($("filterCat")){let opts='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("filterCat").innerHTML=opts;$("filterCat").value=fc}
 if($("txList"))$("txList").innerHTML=data.transactions.filter(t=>(!q||String(t.title).includes(q)||String(t.category||"").includes(q))&&(!ft||t.type===ft)&&(!fc||t.category===fc)).map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 if($("customerList"))renderCustomers();
 if($("peopleList"))$("peopleList").innerHTML=data.people.filter(p=>(p.type||"debt")===peopleMode).map(p=>{const total=Number(p.amount)||0,paid=Math.min(Number(p.paid)||0,total),remaining=Math.max(0,total-paid);return `<div class="item"><div><b>${esc(p.name)}</b><div class="meta">${p.due?"سررسید: "+p.due:""}${p.note?" • "+esc(p.note):""}</div><div class="meta">کل: ${money(total)} • تسویه: ${money(paid)}</div></div><div><strong>${money(remaining)}</strong><div class="actions"><button type="button" onclick="payPerson('${p.id}')">تسویه</button>${actionButtons("openPerson","deletePerson",p.id)}</div></div></div>`}).join("")||empty(peopleMode==="debt"?"هنوز بدهکاری ثبت نشده":"هنوز طلبی ثبت نشده");
 if($("reminderList"))$("reminderList").innerHTML=data.reminders.map(r=>`<div class="item"><div><b>${esc(r.title)}</b><div class="meta">${jalaliLabel(r.date)} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div></div><div><strong>${r.amount?money(r.amount):""}</strong>${actionButtons("openReminder","deleteReminder",r.id)}</div></div>`).join("")||empty("یادآوری ندارید");
 if($("noteList"))$("noteList").innerHTML=data.notes.map(noteHTML).join("")||empty("یادداشتی ندارید");
 if($("invoiceList"))$("invoiceList").innerHTML=data.invoices.map(invoiceHTML).join("")||empty("هنوز فاکتوری ساخته نشده است");
 if($("checkList"))$("checkList").innerHTML=data.checks.map(c=>`<div class="item"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${jalaliLabel(c.date)}${c.bank?" • "+esc(c.bank):""}</div></div><div><strong>${money(c.amount)}</strong>${actionButtons("openCheck","deleteCheck",c.id)}</div></div>`).join("")||empty("چکی ثبت نشده");
 if($("categoryList"))$("categoryList").innerHTML='<div class="card"><b>هزینه‌ها</b><p>'+data.expenseCats.map(c=>esc(c.name)).join(" • ")+'</p><b>دریافت‌ها</b><p>'+data.incomeCats.map(c=>esc(c.name)).join(" • ")+'</p></div>';
 const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+p.amount-p.paid,0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+p.amount-p.paid,0);
 if($("totalDebt"))$("totalDebt").textContent=money(debt);if($("totalCredit"))$("totalCredit").textContent=money(credit);
 if($("reportStats")){const now=new Date(),m=now.getMonth(),y=now.getFullYear();const mt=data.transactions.filter(t=>{const d=new Date(t.date);return !isNaN(d)&&d.getMonth()===m&&d.getFullYear()===y});const mi=mt.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0),me=mt.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);const cats={};mt.filter(t=>t.type==="expense").forEach(t=>cats[t.category||"سایر"]=(cats[t.category||"سایر"]||0)+Number(t.amount||0));const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);$("reportStats").innerHTML=`<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>${fa(data.transactions.length)}</b></div><div class="card"><span>تعداد چک</span><b>${fa(data.checks.length)}</b></div><div class="card"><span>درآمد این ماه</span><b class="income">${money(mi)}</b></div><div class="card"><span>هزینه این ماه</span><b class="expense">${money(me)}</b></div></div><div class="card report-card"><h3>📊 بیشترین دسته‌های هزینه این ماه</h3>${top.map((x,i)=>`<div class="report-row"><span>${fa(i+1)}. ${esc(x[0])}</span><strong>${money(x[1])}</strong></div>`).join("")||`<p class="hint">هنوز هزینه‌ای در این ماه ثبت نشده.</p>`}</div><div class="card report-card"><h3>🏦 مانده حساب‌ها</h3>${data.accounts.map(a=>`<div class="report-row"><span>${esc(a.name)}</span><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||`<p class="hint">حسابی ثبت نشده.</p>`}</div>`;}
 drawChart(inc,exp);renderAudit();renderAdvancedReport();renderYearSettlement();if($("settings" )?.classList.contains("active"))renderBrandingInSettings()}
function renderAdvancedReport(){
 const box=$("advancedReport"); if(!box)return;
 const type=$("reportType")?.value||"all", account=$("reportAccount")?.value||"", from=$("reportFrom")?.value||"", to=$("reportTo")?.value||"";
 let rows=data.transactions.filter(t=>t.type!=="transfer" || type==="transfer");
 if(type!=="all" && type!=="transfer") rows=rows.filter(t=>t.type===type);
 if(account) rows=rows.filter(t=>t.accountID===account || t.from===account || t.to===account);
 const fi=from?jalaliToISO(from):"", ti=to?jalaliToISO(to):"";
 const fiISO=fi?jalaliToISO(fi):"", tiISO=ti?jalaliToISO(ti):""; if(fiISO)rows=rows.filter(t=>String(t.date||"")>=fiISO); if(tiISO)rows=rows.filter(t=>String(t.date||"")<=tiISO+"T23:59");
 const income=rows.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0), expense=rows.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
 box.innerHTML=`<div class="report-summary"><div><span>دریافتی</span><b class="income">${money(income)}</b></div><div><span>هزینه</span><b class="expense">${money(expense)}</b></div><div><span>خالص</span><b>${money(income-expense)}</b></div></div><div class="report-table">${rows.slice(0,100).map(t=>`<div class="report-row"><span>${esc(t.title||"تراکنش")}<small>${jalaliLabel(t.date)} • ${esc(t.category||"")}</small></span><strong class="${t.type}">${t.type==="income"?"+":"−"}${money(t.amount)}</strong></div>`).join("")||`<p class="hint">موردی با این فیلتر پیدا نشد.</p>`}</div>`;
}
function drawChart(inc,exp){const c=$("chart");if(!c)return;const x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);const max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{const bh=v[0]/max*170;x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#374151";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
function exportData(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabdar-backup.json";a.click();logEvent("پشتیبان‌گیری","فایل JSON صادر شد","settings")}
function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);data.audit??=[];data.notes??=[];save();logEvent("بازیابی اطلاعات","پشتیبان وارد شد","settings");showLock();alert("بازیابی شد")}catch{alert("فایل نامعتبر است")}};r.readAsText(file)}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){const pin=data.pin;data=blankData();data.pin=pin;save();logEvent("پاک کردن اطلاعات","اطلاعات برنامه پاک شد","delete");}}
showLock();render();renderBrandingInSettings();logEvent("اجرای برنامه","برنامه حسابدار اجرا شد","system");initSync();syncAllNotesToReminders().catch(console.error);rescheduleAllNativeReminders().catch(console.error);startUpdateChecker();

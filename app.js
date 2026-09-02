const KEY="hesabdar-v35";
const LEGACY_KEYS=["hesabdar-v40","hesabdar-v20","hesabdar-v11"];
const SYNC_KEY="hesabdar-firebase-config-v1";
const APP_VERSION="5.7";
const GITHUB_KEY="hesabdar-github-repo-v1";
const UPDATE_CHECK_MS=6*60*60*1000;
const AUTO_BACKUP_KEY="hesabdar-auto-backups-v1";
const AUTO_BACKUP_ENABLED_KEY="hesabdar-auto-backup-enabled-v1";
const AUTO_BACKUP_MS=6*60*60*1000;
const DEVICE_ID_KEY="hesabdar-device-id-v1";
const DEVICE_PRESENCE_MS=45*1000;
const DEVICE_PRESENCE_INTERVAL=20*1000;
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
function autoBackupEnabled(){return localStorage.getItem(AUTO_BACKUP_ENABLED_KEY)!=="false"}
function setAutoBackupEnabled(v){localStorage.setItem(AUTO_BACKUP_ENABLED_KEY,v?"true":"false"); if(v) createAutoBackup("فعال‌سازی پشتیبان خودکار"); logEvent(v?"پشتیبان خودکار فعال شد":"پشتیبان خودکار غیرفعال شد",v?"از این پس هر ۶ ساعت یک فایل پشتیبان واقعی داخل گوشی ساخته می‌شود":"پشتیبان‌گیری خودکار خاموش شد","settings",false); renderSettingsFeatures()}
/* ---- Real file auto-backup -----------------------------------------
 * On a Capacitor build (native app), this writes an actual .json file
 * into Documents/HesabdarBackups on the device using the Filesystem
 * plugin, and prunes old files so only the last 5 remain. In a plain
 * browser/PWA where that native plugin isn't available, it falls back to
 * triggering a normal file download of the same backup onto the phone.
 * The localStorage snapshot list is kept too, as a fast, always-available
 * safety net for the in-app "restore last backup" button. ---- */
const AUTO_BACKUP_DIRECTORY="Documents";
const AUTO_BACKUP_FOLDER="HesabdarBackups";
const AUTO_BACKUP_LAST_FILE_KEY="hesabdar-auto-backup-last-file-v1";
function backupFileName(){const d=new Date(),p=n=>String(n).padStart(2,"0");return `hesabdar-backup-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`}
async function pruneOldBackupFiles(fs){
 try{
  const res=await fs.readdir({path:AUTO_BACKUP_FOLDER,directory:AUTO_BACKUP_DIRECTORY});
  const files=(res?.files||[]).map(f=>typeof f==="string"?f:f?.name).filter(n=>n&&n.endsWith(".json")).sort();
  while(files.length>5){const old=files.shift();try{await fs.deleteFile({path:`${AUTO_BACKUP_FOLDER}/${old}`,directory:AUTO_BACKUP_DIRECTORY})}catch(e){}}
 }catch(e){/* folder may not exist yet on first run - nothing to prune */}
}
async function writeAutoBackupFile(payload){
 const json=JSON.stringify(payload,null,2),filename=backupFileName();
 const fs=window.Capacitor?.Plugins?.Filesystem;
 if(fs&&typeof fs.writeFile==="function"){
  try{
   await fs.writeFile({path:`${AUTO_BACKUP_FOLDER}/${filename}`,data:json,directory:AUTO_BACKUP_DIRECTORY,encoding:"utf8",recursive:true});
   pruneOldBackupFiles(fs).catch(()=>{});
   return {ok:true,method:"filesystem",filename,where:`${AUTO_BACKUP_DIRECTORY}/${AUTO_BACKUP_FOLDER}`};
  }catch(e){console.warn("Filesystem auto backup failed, falling back to download",e)}
 }
 try{
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  return {ok:true,method:"download",filename,where:"Download"};
 }catch(e){console.warn("auto backup file download failed",e);return {ok:false}}
}
function createAutoBackup(reason="زمان‌بندی"){
 try{
  if(!autoBackupEnabled())return false;
  const raw=JSON.stringify(data);
  const list=JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY)||"[]");
  list.unshift({at:new Date().toISOString(),reason,data:JSON.parse(raw)});
  while(list.length>5)list.pop();
  localStorage.setItem(AUTO_BACKUP_KEY,JSON.stringify(list));
  localStorage.setItem(AUTO_BACKUP_KEY+"-last",new Date().toISOString());
  writeAutoBackupFile(JSON.parse(raw)).then(res=>{
   if(res?.ok){localStorage.setItem(AUTO_BACKUP_LAST_FILE_KEY,JSON.stringify({filename:res.filename,where:res.where,at:new Date().toISOString()}));renderSettingsFeatures()}
  }).catch(e=>console.warn("auto backup file",e));
  return true;
 }catch(e){console.warn("auto backup",e);return false}
}
function getAutoBackupInfo(){try{const last=localStorage.getItem(AUTO_BACKUP_KEY+"-last");return last?new Date(last):null}catch{return null}}
function getAutoBackupFileInfo(){try{return JSON.parse(localStorage.getItem(AUTO_BACKUP_LAST_FILE_KEY)||"null")}catch{return null}}
function restoreLatestAutoBackup(){try{const list=JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY)||"[]"); if(!list.length)return alert("هنوز پشتیبان خودکاری وجود ندارد."); if(!confirm("آخرین پشتیبان خودکار جایگزین اطلاعات فعلی شود؟"))return; data=list[0].data; normalizeData(); save(); logEvent("بازیابی پشتیبان خودکار",new Date(list[0].at).toLocaleString("fa-IR"),"settings"); alert("آخرین پشتیبان خودکار بازیابی شد.")}catch(e){alert("پشتیبان خودکار قابل بازیابی نیست.")}}
function normalizeData(){data=data||blankData(); for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"]){data[k]??=[];} data.pin=typeof data.pin==="string"?data.pin:""; data.pinHash=typeof data.pinHash==="string"?data.pinHash:""; data.pinSalt=typeof data.pinSalt==="string"?data.pinSalt:""; data.branding??={storeName:"",logo:"",stamp:"",signature:""}; data.yearSettlements??={}; data._sync??={tombstones:{}}; data._sync.tombstones??={}; for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString();}} for(const c of [...data.expenseCats,...data.incomeCats]){c.children??=[];for(const ch of c.children){ch.id??=uid();}} data.notes.forEach((n,i)=>{if(typeof n.order!=="number")n.order=i;}); data.reminders.forEach((r,i)=>{if(typeof r.order!=="number")r.order=i;});}
function renderSettingsFeatures(){const e=$("autoBackupToggle");if(e)e.checked=autoBackupEnabled(); const last=$("autoBackupLast"); if(last){const d=getAutoBackupInfo();const f=getAutoBackupFileInfo();last.textContent=d?"آخرین پشتیبان: "+d.toLocaleString("fa-IR")+(f?.filename?` • فایل: ${f.filename} (${f.where})`:""):"هنوز پشتیبان خودکاری ساخته نشده";} const v=$("appVersionText");if(v)v.textContent=APP_VERSION; const vp=$("versionPill");if(vp)vp.textContent=APP_VERSION;}
function setSyncStatus(t){const e=$("syncStatus");if(e)e.textContent=t||"";const b=$("syncBadge");if(!b)return;const s=String(t||"");let cls="offline",label="☁️ آفلاین";if(s.includes("آنلاین")||s.includes("انجام شد")||s.includes("متصل است")){cls="online";label="☁️ متصل"}else if(s.includes("⚠️")||s.includes("ناموفق")){cls="error";label="⚠️ خطای اتصال"}else if(s.includes("در حال")||s.includes("بررسی")){cls="pending";label="☁️ در حال اتصال..."}else if(s.includes("وارد شوید")||s.includes("ابتدا")){cls="offline";label="☁️ واردنشده"}b.textContent=label;b.className="sync-badge "+cls}

const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
function debounce(fn,ms=150){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
const money=n=>fa(n)+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
// Jalali date helpers (UI uses Persian dates; storage remains ISO/Gregorian for compatibility).
function div(a,b){return Math.floor(a/b)}
function gregorianToJalali(gy,gm,gd){let gdm=[0,31,59,90,120,151,181,212,243,273,304,334];let jy=gy<=1600?0:979;gy-=gy<=1600?621:1600;let gy2=gm>2?gy+1:gy;let days=365*gy+div(gy2+3,4)-div(gy2+99,100)+div(gy2+399,400)-80+gd+gdm[gm-1];jy+=33*div(days,12053);days%=12053;jy+=4*div(days,1461);days%=1461;if(days>365){jy+=div(days-1,365);days=(days-1)%365}let jm=days<186?1+div(days,31):7+div(days-186,30);let jd=1+(days<186?days%31:(days-186)%30);return [jy,jm,jd]}
function jalaliToGregorian(jy,jm,jd){jy+=1595;let days=-355668+(365*jy)+(div(jy,33)*8)+div(((jy%33)+3),4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);let gy=400*div(days,146097);days%=146097;if(days>36524){gy+=100*div(--days,36524);days%=36524;if(days>=365)days++}gy+=4*div(days,1461);days%=1461;if(days>365){gy+=div(days-1,365);days=(days-1)%365}let gd=days+1;let sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];let gm;for(gm=1;gm<=12;gm++){const v=sal_a[gm];if(gd<=v)break;gd-=v}return [gy,gm,gd]}
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
async function upsertReminderForNote(note,renderAfter=true){if(!note?.id)return;const linked=(data.reminders||[]).filter(x=>x.sourceNoteId===note.id);let r=linked[0];for(const duplicate of linked.slice(1)){await cancelNativeReminder(duplicate.id);removeRecordSilent("reminders",duplicate.id)}if(!note.date){if(r){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);if(renderAfter)save();else{localStorage.setItem(KEY,JSON.stringify(data));syncSave()}}return}const o={title:note.title||"یادداشت",amount:0,date:note.date,repeat:note.repeat&&note.repeat!=="none"?note.repeat:"once",type:"note",sourceNoteId:note.id,body:reminderBodyFromNote(note)};if(r){Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{r=touch({id:uid(),...o});data.reminders.push(r);markDirty("reminders",r.id,false,r,r.updatedAt)}if(renderAfter)save();else{localStorage.setItem(KEY,JSON.stringify(data));syncSave()}await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}
async function syncAllNotesToReminders(){let changed=false;const noteIds=new Set((data.notes||[]).map(n=>n.id));for(const n of data.notes||[]){const before=(data.reminders||[]).length;await upsertReminderForNote(n);if((data.reminders||[]).length!==before)changed=true}for(const r of [...(data.reminders||[])]){if(r.sourceNoteId&&!noteIds.has(r.sourceNoteId)){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);changed=true}}if(changed)save();else render();if(sync.db)syncSave()}
async function removeReminderForNote(noteId){const matches=(data.reminders||[]).filter(r=>r.sourceNoteId===noteId);for(const r of matches){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id)}if(matches.length)save()}

/* ---- Web/PWA notification fallback engine ----
 * The native Capacitor LocalNotifications plugin only works when this app is
 * built and packaged as a real native app with that plugin installed. When it
 * is not available (plain browser, PWA, or a Capacitor build without the
 * plugin), scheduleNativeReminder() above silently does nothing and reminders
 * never fire. This engine provides a working fallback using the standard
 * browser Notification API + a periodic due-check, so alarms actually fire
 * whenever the app is open (foreground or background tab), and it also
 * "catches up" on missed reminders as soon as the app is reopened. */
const REMINDER_FIRED_KEY="hesabdar-reminder-fired-v1";
const REMINDER_CATCHUP_MS=3*24*60*60*1000; // don't resurrect alarms older than 3 days
let reminderCheckTimer=null;
function firedMap(){try{return JSON.parse(localStorage.getItem(REMINDER_FIRED_KEY)||"{}")}catch{return {}}}
function markFired(id,occurrenceISO){try{const m=firedMap();m[id]=occurrenceISO;const ids=new Set((data.reminders||[]).map(r=>r.id));for(const k of Object.keys(m))if(!ids.has(k))delete m[k];localStorage.setItem(REMINDER_FIRED_KEY,JSON.stringify(m))}catch(e){}}
function lastOccurrenceDue(r,now=new Date()){
  let d=localDateFromInput(r?.date);if(!d)return null;
  const rep=r.repeat||"once";
  if(rep==="once")return d<=now?d:null;
  let last=null,guard=0;
  while(d<=now&&guard++<2000){last=d;if(rep==="daily")d=new Date(d.getTime()+86400000);else if(rep==="weekly")d=new Date(d.getTime()+7*86400000);else if(rep==="monthly")d=addMonthsSafe(d,1);else break}
  return last;
}
async function notifyNow(title,body,tag){
  try{
    if("Notification"in window&&Notification.permission==="granted"){
      const reg=("serviceWorker"in navigator)?await navigator.serviceWorker.getRegistration().catch(()=>null):null;
      if(reg&&reg.showNotification){await reg.showNotification(title,{body,tag,icon:"logo.png",badge:"logo.png",dir:"rtl",lang:"fa"});return true}
      new Notification(title,{body,tag,icon:"logo.png",dir:"rtl",lang:"fa"});return true
    }
  }catch(e){console.warn("notifyNow",e)}
  return false
}
async function fireReminder(r,occurrence){
  const title=r.title||"یادآوری حسابدار";
  const body=r.body||(r.amount?`مبلغ: ${money(r.amount)}`:"زمان یادآوری فرا رسیده است.");
  const shown=await notifyNow(title,body,"reminder-"+r.id);
  markFired(r.id,occurrence.toISOString());
  logEvent(shown?"یادآوری فعال شد":"یادآوری سررسید شد","‏"+title+(shown?"":" (اعلان نمایش داده نشد؛ اجازه اعلان را در تنظیمات بررسی کنید)"),"info",false);
  renderDueSoon();
}
async function checkDueReminders(){
  const now=new Date();const fired=firedMap();
  for(const r of (data.reminders||[])){
    if(!r?.date)continue;
    const occ=lastOccurrenceDue(r,now);
    if(!occ)continue;
    if(now.getTime()-occ.getTime()>REMINDER_CATCHUP_MS)continue; // too old, skip silently
    if(fired[r.id]===occ.toISOString())continue; // already notified for this occurrence
    await fireReminder(r,occ);
  }
}
function startReminderChecker(){
  if(reminderCheckTimer)clearInterval(reminderCheckTimer);
  checkDueReminders().catch(console.error);
  reminderCheckTimer=setInterval(()=>checkDueReminders().catch(console.error),30000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkDueReminders().catch(console.error)});
}
function upcomingReminders(hoursAhead=24){
  const now=new Date(),until=new Date(now.getTime()+hoursAhead*3600000);
  const items=[];
  for(const r of (data.reminders||[])){
    if(!r?.date)continue;
    const overdue=lastOccurrenceDue(r,now);
    if(overdue){items.push({r,at:overdue,overdue:true});continue}
    const next=nextReminderDate(r,now);
    if(next&&next<=until)items.push({r,at:next,overdue:false});
  }
  return items.sort((a,b)=>a.at-b.at);
}
function renderDueSoon(){
  const box=$("dueSoon");if(!box)return;
  const items=upcomingReminders(24);
  if(!items.length){box.innerHTML="";return}
  const overdue=items.filter(x=>x.overdue).length;
  const todayCount=items.length;
  box.innerHTML=`🔔 ${overdue?`<b>${fa(overdue)} یادآوری دیرشده</b> • `:""}${fa(todayCount)} یادآوری در ۲۴ ساعت آینده`;
}

const blankData=()=>({accounts:[],transactions:[],people:[],reminders:[],notes:[],checks:[],invoices:[],customers:[],products:[],audit:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name,children:[]})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name,children:[]})),pin:"",branding:{storeName:"",logo:"",stamp:"",signature:""},yearSettlements:{}});
window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
window.addEventListener("online",async()=>{if(sync.db)sync.db.enableNetwork().catch(console.error);setSyncStatus("🌐 اینترنت برقرار شد؛ در حال بررسی اتصال دو گوشی..."); if(!sync.auth)await initSync(); if(sync.dirty&&sync.dirty.size)syncSave(); await verifyTwoPhoneConnection(true); checkForUpdates(false);});
window.addEventListener("offline",()=>setSyncStatus("⚠️ اینترنت دستگاه قطع است"));

let data;
try{
  let raw=localStorage.getItem(KEY);
  if(!raw){
    for(const legacyKey of LEGACY_KEYS){
      const legacy=localStorage.getItem(legacyKey);
      if(legacy){
        raw=legacy;
        try{localStorage.setItem(KEY,legacy)}catch(e){console.warn("storage migration",e)}
        break;
      }
    }
  }
  data=raw?JSON.parse(raw):null;
}catch{data=null}
data=data||blankData();
normalizeData();
data.accounts??=[];
if(!data.accounts.some(a=>String(a.name||"").trim()==="کیف پول نقدی")){const cash=touch({id:uid(),name:"کیف پول نقدی",bank:"",sender:"",card:"",balance:0,default:true});data.accounts.unshift(cash);localStorage.setItem(KEY,JSON.stringify(data));}
data.transactions??=[];data.people??=[];data.customers??=[];data.products??=[];data.reminders??=[];data.notes??=[];data.checks??=[];data.invoices??=[];data.audit??=[];data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name,children:[]}));data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name,children:[]}));data.pin=typeof data.pin==="string"?data.pin:"";data.pinHash=typeof data.pinHash==="string"?data.pinHash:"";data.pinSalt=typeof data.pinSalt==="string"?data.pinSalt:"";data.branding??={storeName:"",logo:"",stamp:"",signature:""};data.branding.storeName??="";data.branding.logo??="";data.branding.stamp??="";data.branding.signature??="";data.yearSettlements??={};data._sync??={tombstones:{}};data._sync.tombstones??={};for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString()}}for(const c of [...data.expenseCats,...data.incomeCats]){c.children??=[];for(const ch of c.children){ch.id??=uid()}}
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
function save(){localStorage.setItem(KEY,JSON.stringify(data)); if(autoBackupEnabled()){const last=getAutoBackupInfo();if(!last||Date.now()-last.getTime()>=AUTO_BACKUP_MS)createAutoBackup("ذخیره زمان‌بندی‌شده")};render();syncSave()}
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
    const local=arr.find(r=>r.id===id); const localTs=local?.updatedAt||data._sync.tombstones?.[type]?.[id]||""; const remoteTs=x.updatedAt||x.record.updatedAt||""; const localBy=String(local?.updatedBy||""); const remoteBy=String(x.updatedBy||x.record?.updatedBy||"");
    const timeCmp=String(remoteTs).localeCompare(String(localTs));
    if(timeCmp<0 || (timeCmp===0 && remoteBy<=localBy))continue;
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
function deviceId(){let id=localStorage.getItem(DEVICE_ID_KEY);if(!id){id=uid();localStorage.setItem(DEVICE_ID_KEY,id)}return id}
async function updateDevicePresence(){if(!sync.user||!sync.db)return false; try{await cloudDoc().collection("devices").doc(deviceId()).set({deviceId:deviceId(),lastSeen:new Date().toISOString(),userAgent:navigator.userAgent.slice(0,120)}, {merge:true}); return true}catch(e){console.warn("presence",e);return false}}
async function verifyTwoPhoneConnection(manual=false){if(!sync.user||!sync.db){if(manual)setSyncStatus("⚠️ ابتدا با حساب همگام‌سازی وارد شوید");return false} try{await updateDevicePresence(); const snap=await cloudDoc().collection("devices").get(); const now=Date.now(); const others=snap.docs.map(d=>d.data()).filter(x=>x.deviceId!==deviceId()&&x.lastSeen&&(now-new Date(x.lastSeen).getTime())<=DEVICE_PRESENCE_MS); setSyncStatus(others.length?`📱 ${fa(others.length)} گوشی دیگر متصل است • همگام‌سازی فعال`:"📱 گوشی دوم در ۴۵ ثانیه اخیر دیده نشد • در حال بررسی مجدد"); if(others.length)logEvent("بررسی اتصال دو گوشی",`گوشی دیگر فعال است (${others.length})`,"sync",false); return !!others.length}catch(e){setSyncStatus("⚠️ بررسی اتصال دو گوشی ناموفق بود: "+(e.code||e.message));return false}}
function startDevicePresence(){if(sync.presenceTimer)clearInterval(sync.presenceTimer); updateDevicePresence(); sync.presenceTimer=setInterval(()=>{if(sync.user)verifyTwoPhoneConnection(false)},DEVICE_PRESENCE_INTERVAL)}
const FIREBASE_SDK_URLS=["https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js","https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];
function loadScriptOnce(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(s=>s.src===src)){resolve();return}const s=document.createElement("script");s.src=src;s.onload=()=>resolve();s.onerror=()=>reject(new Error("script load failed: "+src));document.head.appendChild(s)})}
let firebaseLoadPromise=null;
async function ensureFirebaseLoaded(){
  if(window.firebase)return true;
  if(!navigator.onLine)return false;
  if(!firebaseLoadPromise){
    firebaseLoadPromise=(async()=>{for(const url of FIREBASE_SDK_URLS){await loadScriptOnce(url)}})()
      .catch(e=>{console.warn("firebase sdk load failed",e);firebaseLoadPromise=null;throw e});
  }
  try{await firebaseLoadPromise;return !!window.firebase}catch(e){return false}
}
async function initSync(){
  const cfg=syncConfig();if(!cfg)return;
  if(!window.firebase){const ok=await ensureFirebaseLoaded().catch(()=>false);if(!ok)return}
  try{
    if(!sync.app)sync.app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
    sync.auth=firebase.auth();sync.db=firebase.firestore();
    try{sync.db.settings({ignoreUndefinedProperties:true})}catch(e){}
    if(sync.authListener)return;
    sync.authListener=true;
    sync.auth.onAuthStateChanged(async user=>{
      sync.user=user;fillSettingsSyncEmail();
      if(sync.timer)clearInterval(sync.timer);if(sync.unsubscribe){sync.unsubscribe();sync.unsubscribe=null}
      if(!user){sync.ready=false;if(sync.presenceTimer)clearInterval(sync.presenceTimer);setSyncStatus("☁️ برای همگام‌سازی وارد شوید");return}
      sync.ready=true;await hydrateSync();await rescheduleAllNativeReminders();startDevicePresence();await verifyTwoPhoneConnection(false);
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
    if(!remote||!remote.length)return alert("هنوز اطلاعاتی در ابر وجود ندارد");
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

function bytesToB64(bytes){let s="";for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s)}
function b64ToBytes(s){const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function hashPin(pin,saltB64){const salt=saltB64?b64ToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return {hash:bytesToB64(bits),salt:bytesToB64(salt)}}
async function verifyPin(pin){if(data.pinHash&&data.pinSalt){const x=await hashPin(pin,data.pinSalt);return x.hash===data.pinHash}return String(pin)===String(data.pin||"")}
async function migratePinSecurity(){if(!data.pin||data.pinHash)return;try{const x=await hashPin(data.pin);data.pinHash=x.hash;data.pinSalt=x.salt;data.pin="";localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn("PIN security migration",e)}}
function showLock(){
 let old=$("lock"); if(old) old.remove();
 if(!data.pinHash&&!data.pin)return;
 const d=document.createElement("div");d.id="lock";d.className="lock";
 d.innerHTML='<div class="lockbox"><h1>🔐 حسابدار</h1><p>رمز ورود را وارد کن</p><input id="pinInput" inputmode="numeric" maxlength="8" type="password" autocomplete="off" placeholder="رمز ورود"><button class="primary" id="unlockBtn">ورود</button></div>';
 document.body.appendChild(d);
 $("unlockBtn").onclick=unlock;
 $("pinInput").onkeydown=e=>{if(e.key==="Enter")unlock()};
}
async function unlock(){const input=$("pinInput");if(!input)return;const ok=await verifyPin(input.value).catch(()=>false);if(!ok)return alert("رمز اشتباه است");$("lock")?.remove()}
async function setPin(){
 const old=data.pinHash||data.pin?(prompt("رمز فعلی را وارد کن:")||""):"";
 if((data.pinHash||data.pin)&&!(await verifyPin(old)))return alert("رمز فعلی اشتباه است");
 const p=prompt(data.pinHash||data.pin?"رمز جدید ۴ تا ۸ رقمی:":"یک رمز ۴ تا ۸ رقمی برای ورود تعیین کن:");
 if(p===null)return;
 if(!/^\d{4,8}$/.test(p))return alert("رمز باید ۴ تا ۸ رقم باشد");
 const p2=prompt("رمز جدید را دوباره وارد کن:");
 if(p!==p2)return alert("دو رمز یکسان نیستند");
 try{const x=await hashPin(p);data.pin="";data.pinHash=x.hash;data.pinSalt=x.salt;save();logEvent("تغییر رمز ورود","رمز ورود تغییر کرد","settings");alert("رمز با موفقیت ذخیره شد")}catch(e){alert("ذخیره رمز انجام نشد")}
}
async function removePin(){
 if(!data.pinHash&&!data.pin)return alert("هنوز رمزی فعال نیست");
 const p=prompt("رمز فعلی را وارد کن:");
 if(!(await verifyPin(p||"")))return alert("رمز فعلی اشتباه است");
 data.pin="";data.pinHash="";data.pinSalt="";save();logEvent("حذف رمز ورود","قفل برنامه غیرفعال شد","settings");alert("رمز حذف شد");
}

function tapFeedback(){try{if(navigator.vibrate)navigator.vibrate(8)}catch(e){}}
document.addEventListener("click",e=>{if(e.target.closest("button,.nav"))tapFeedback()},{passive:true});

/* ---- Page navigation with back-history (supports hardware/gesture back) ---- */
let pageHistory=["home"];
function activatePage(name){
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(`.nav[data-page="${name}"]`).forEach(x=>x.classList.add("active"));
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 const page=$(name);
 if(page)page.classList.add("active");
 render();
 return page;
}
function goToPage(name,fromNav){
 if(!$(name))return;
 const page=activatePage(name);
 if(pageHistory[pageHistory.length-1]!==name)pageHistory.push(name);
 if(fromNav)closeMenu();
 logEvent("ورود به بخش",page?.querySelector("h2")?.textContent||name,"nav");
}
function goBackPage(){
 if(pageHistory.length>1){
  pageHistory.pop();
  activatePage(pageHistory[pageHistory.length-1]);
  return true;
 }
 return false;
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",e=>{
 e.preventDefault();
 goToPage(b.dataset.page,true);
}));
document.addEventListener("input",e=>{if(e.target.closest("#invoiceRows"))updateInvoiceLiveTotal()});
$("theme").onclick=()=>{const dark=document.body.classList.toggle("dark");logEvent("تغییر تم",dark?"حالت شیشه‌ای تیره فعال شد":"حالت شیشه‌ای روشن فعال شد","settings")};
function openMenu(){const m=$("menuModal");if(!m)return;m.classList.remove("hidden");$("menuBtn")?.setAttribute("aria-expanded","true");logEvent("باز کردن منو","منوی اصلی","nav")}
function closeMenu(){const m=$("menuModal");if(!m)return;m.classList.add("hidden");$("menuBtn")?.setAttribute("aria-expanded","false")}
$("menuBtn").onclick=openMenu;
$("menuModal").addEventListener("click",e=>{if(e.target.id==="menuModal")closeMenu()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

const modal=$("modal"),modalBody=$("modalBody");
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}

/* ---- Swipe-back / hardware-back gesture, like iOS & Android: swiping in
 * from either screen edge (or pressing the system/browser back button)
 * closes whatever sheet is open, or returns to the previous page — it
 * never leaves or reloads the app. A single "trap" history entry is kept
 * so this works reliably no matter how many sheets are stacked, without
 * needing every close-button call site to manage history itself. ---- */
function closeTopOverlay(){
 if(!$("framerModal")?.classList.contains("hidden")){closeFramer();return true}
 if(!$("calModal")?.classList.contains("hidden")){closeCalModal();return true}
 if(!$("modal")?.classList.contains("hidden")){closeModal();return true}
 if(!$("menuModal")?.classList.contains("hidden")){closeMenu();return true}
 return false;
}
function performBack(){
 if(closeTopOverlay())return true;
 return goBackPage();
}
function armBackTrap(){try{history.pushState({hesabdarTrap:true},"",location.href)}catch(e){}}
try{history.replaceState({hesabdarRoot:true},"",location.href)}catch(e){}
armBackTrap();
window.addEventListener("popstate",()=>{performBack();armBackTrap()});
(function initSwipeBack(){
 const EDGE=28,THRESH=65,MAXV_RATIO=.55;
 let sx=0,sy=0,active=false,claimed=false;
 document.addEventListener("touchstart",e=>{
  if(e.touches.length!==1)return;
  const t=e.touches[0];
  sx=t.clientX;sy=t.clientY;
  active=(sx<=EDGE||sx>=window.innerWidth-EDGE);
  claimed=false;
 },{passive:true});
 /* Once it's clearly a horizontal drag from the edge, take over the gesture
  * ourselves (preventDefault) so the browser/WebView can't also treat it as
  * a native back-navigation — that double handling is what caused the
  * multi-second delay and raw/unstyled flash the user was seeing. */
 document.addEventListener("touchmove",e=>{
  if(!active||claimed)return;
  const t=e.touches[0];
  const dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);
  if(Math.abs(dx)>12&&dy<Math.abs(dx)*MAXV_RATIO){claimed=true;if(e.cancelable)e.preventDefault()}
 },{passive:false});
 document.addEventListener("touchend",e=>{
  if(!active){return}
  active=false;
  const t=e.changedTouches[0];
  const dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);
  if(Math.abs(dx)>THRESH&&dy<Math.abs(dx)*MAXV_RATIO)performBack();
 },{passive:true});
})();

function touch(r){r.updatedAt=new Date().toISOString();r.updatedBy=sync.user?.uid||deviceId();return r}
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
function categoryButtons(type,selected=""){
  const arr=type==="expense"?data.expenseCats:data.incomeCats;
  return `<div class="category-window">${arr.map(c=>{
    const kids=c.children||[];
    const isParentSel=c.name===selected;
    return `<div class="cat-group">
      <button type="button" class="cat-btn ${isParentSel?"selected-cat":""}" onclick="pickCategory('${type}','${c.id}')">${esc(c.name)}${kids.length?'<span class="cat-caret">›</span>':""}</button>
      ${kids.length?`<div class="cat-children">${kids.map(ch=>{const full=c.name+" - "+ch.name;return `<button type="button" class="cat-chip ${selected===full?"selected-cat":""}" onclick="pickSubCategory('${type}','${c.id}','${ch.id}')">${esc(ch.name)}</button>`}).join("")}</div>`:""}
    </div>`;
  }).join("")}</div>`;
}
function openTx(id=null){if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");const t=id&&data.transactions.find(x=>x.id===id);if(t?.type==="transfer")return openTransfer(id);const typ=t?.type||"expense";openModal(`<h2>${t?"ویرایش تراکنش":"ثبت تراکنش"}</h2><div class="form"><div class="type-switch"><button type="button" id="expBtn" class="${typ==="expense"?"chosen":""}" onclick="txType('expense')">💸 هزینه</button><button type="button" id="incBtn" class="${typ==="income"?"chosen":""}" onclick="txType('income')">💰 دریافت</button></div><input id="txKind" type="hidden" value="${typ}"><input id="title" placeholder="عنوان" value="${esc(t?.title||"")}"><input id="amount" type="number" placeholder="مبلغ" value="${Number(t?.amount)||""}"><div id="expensePanel" style="display:${typ==="expense"?"block":"none"}"><b id="catLabel">${t?.category?"دسته: "+esc(t.category):"دسته را انتخاب کنید"}</b>${categoryButtons("expense",typ==="expense"?t?.category:"")}<input id="cat" type="hidden" value="${esc(typ==="expense"?t?.category||"":"")}"></div><div id="incomePanel" style="display:${typ==="income"?"block":"none"}"><b id="incatLabel">${t?.category?"دسته: "+esc(t.category):"دسته را انتخاب کنید"}</b>${categoryButtons("income",typ==="income"?t?.category:"")}<input id="incat" type="hidden" value="${esc(typ==="income"?t?.category||"":"")}"></div>${accountSelect("acc",t?.accountID||"")}<label class="file-label">📎 تصویر پیوست (اختیاری)<input id="txImage" type="file" accept="image/*" onchange="previewTxImage(this)"></label>${t?.image?`<div class="attachment-preview"><img src="${t.image}" alt="پیوست"></div>`:""}<div id="txImagePreview"></div><button class="primary" onclick="saveTx('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت تراکنش"}</button></div>`)}
function txType(t){$("txKind").value=t;$("expBtn").classList.toggle("chosen",t==="expense");$("incBtn").classList.toggle("chosen",t==="income");$("expensePanel").style.display=t==="expense"?"block":"none";$("incomePanel").style.display=t==="income"?"block":"none"}
function pickCategory(type,id){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===id);if(!c)return;setCategoryValue(type,c.name)}
function pickSubCategory(type,catId,childId){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===catId);const ch=c?.children?.find(x=>x.id===childId);if(!c||!ch)return;setCategoryValue(type,c.name+" - "+ch.name)}
function setCategoryValue(type,name){
  const valEl=$(type==="expense"?"cat":"incat"), labelEl=$(type==="expense"?"catLabel":"incatLabel");
  if(valEl)valEl.value=name; if(labelEl)labelEl.textContent="دسته: "+name;
  const panel=$(type==="expense"?"expensePanel":"incomePanel");
  const win=panel?.querySelector(".category-window");
  if(win)win.outerHTML=categoryButtons(type,name);
}
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
function categoryManageRow(type,c){
  const kids=c.children||[];
  return `<div class="cat-manage-row">
    <div class="cat-manage-head"><b>${esc(c.name)}</b><div class="actions"><button title="افزودن زیرمجموعه" onclick="addSubCatPrompt('${type}','${c.id}')">🏷➕</button><button onclick="editCategory('${type}','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('${type}','${c.id}')">🗑</button></div></div>
    ${kids.length?`<div class="cat-sub-list">${kids.map(ch=>`<span class="cat-sub-chip">${esc(ch.name)}<button title="ویرایش" onclick="editSubCategory('${type}','${c.id}','${ch.id}')">✏️</button><button title="حذف" onclick="removeSubCategory('${type}','${c.id}','${ch.id}')">×</button></span>`).join("")}</div>`:`<div class="cat-sub-list"><button type="button" class="cat-sub-add" onclick="addSubCatPrompt('${type}','${c.id}')">＋ افزودن زیرمجموعه</button></div>`}
  </div>`;
}
function openCategory(){openModal(`<h2>🏷 دسته‌ها</h2><p class="hint">هر دسته می‌تواند چند زیرمجموعه داشته باشد؛ هنگام ثبت تراکنش می‌توانی دسته یا زیرمجموعه دقیق‌تر آن را انتخاب کنی.</p><div class="section-head"><b>دسته‌های هزینه</b><button onclick="addCatPrompt('expense')">＋</button></div>${data.expenseCats.map(c=>categoryManageRow('expense',c)).join("")||empty("هنوز دسته‌ای اضافه نشده")}<div class="section-head"><b>دسته‌های دریافت</b><button onclick="addCatPrompt('income')">＋</button></div>${data.incomeCats.map(c=>categoryManageRow('income',c)).join("")||empty("هنوز دسته‌ای اضافه نشده")}`)}
function addCatPrompt(type){const n=prompt("نام دسته:");if(!n?.trim())return;const arr=type==="expense"?data.expenseCats:data.incomeCats;const nc=touch({id:uid(),name:n.trim(),children:[]});arr.push(nc);markDirty(type==="expense"?"expenseCats":"incomeCats",nc.id,false,nc,nc.updatedAt);save();logEvent("ایجاد دسته",n.trim(),"create");openCategory()}
function editCategory(type,id){const arr=type==="expense"?data.expenseCats:data.incomeCats,c=arr.find(x=>x.id===id);if(!c)return;const n=prompt("نام جدید:",c.name);if(n?.trim()){const old=c.name;c.name=n.trim();touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);data.transactions.forEach(t=>{if(t.category===old)/* exact match on the parent name only */ {t.category=c.name;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}else if(String(t.category||"").startsWith(old+" - ")){t.category=c.name+t.category.slice(old.length);touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}});save();openCategory()}}
function removeCategory(type,id){if(!confirm("این دسته و همه زیرمجموعه‌های آن حذف شود؟"))return;removeRecord(type==="expense"?"expenseCats":"incomeCats",id);openCategory()}
function addSubCatPrompt(type,catId){const arr=type==="expense"?data.expenseCats:data.incomeCats;const c=arr.find(x=>x.id===catId);if(!c)return;const n=prompt("نام زیرمجموعه:");if(!n?.trim())return;c.children=c.children||[];c.children.push({id:uid(),name:n.trim()});touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);save();logEvent("ایجاد زیرمجموعه دسته",c.name+" › "+n.trim(),"create");openCategory()}
function editSubCategory(type,catId,childId){const arr=type==="expense"?data.expenseCats:data.incomeCats;const c=arr.find(x=>x.id===catId);const ch=c?.children?.find(x=>x.id===childId);if(!c||!ch)return;const n=prompt("نام جدید:",ch.name);if(!n?.trim())return;const oldFull=c.name+" - "+ch.name;ch.name=n.trim();const newFull=c.name+" - "+ch.name;touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);data.transactions.forEach(t=>{if(t.category===oldFull){t.category=newFull;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}});save();openCategory()}
function removeSubCategory(type,catId,childId){if(!confirm("این زیرمجموعه حذف شود؟"))return;const arr=type==="expense"?data.expenseCats:data.incomeCats;const c=arr.find(x=>x.id===catId);if(!c)return;c.children=(c.children||[]).filter(x=>x.id!==childId);touch(c);markDirty(type==="expense"?"expenseCats":"incomeCats",c.id,false,c,c.updatedAt);save();openCategory()}
function openProduct(id=null){const p=id&&data.products.find(x=>x.id===id);openModal(`<h2>${p?"ویرایش کالا":"کالای جدید"}</h2><div class="form">
 ${invField("نام کالا یا خدمت","",`<input id="prdName" placeholder="مثلاً: کیف چرمی مدل ۱" value="${esc(p?.name||"")}">`)}
 ${invField("کد کالا","اختیاری؛ برای پیدا کردن سریع‌تر",`<input id="prdCode" placeholder="مثلاً: A-102" value="${esc(p?.code||"")}">`)}
 <div class="two-fields">
 ${invField("قیمت خرید","تومان",`<input id="prdBuy" type="number" min="0" inputmode="numeric" placeholder="۰" value="${Number(p?.buyPrice)||""}">`)}
 ${invField("قیمت فروش","تومان",`<input id="prdPrice" type="number" min="0" inputmode="numeric" placeholder="۰" value="${Number(p?.price)||""}">`)}
 </div>
 <div class="two-fields">
 ${invField("موجودی فعلی","تعداد در انبار",`<input id="prdStock" type="number" min="0" inputmode="numeric" placeholder="۰" value="${Number(p?.stock)||""}">`)}
 ${invField("حداقل موجودی","برای هشدار موجودی کم",`<input id="prdMin" type="number" min="0" inputmode="numeric" placeholder="۰" value="${Number(p?.minStock)||""}">`)}
 </div>
 <button class="primary" onclick="saveProduct('${p?.id||""}')">💾 ذخیره</button></div>`)}
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
function exportAccountExcel(id){const a=data.accounts.find(x=>x.id===id);if(!a)return;const tx=data.transactions.filter(t=>t.accountID===id||t.from===id||t.to===id).sort((x,y)=>String(x.date).localeCompare(String(y.date)));const rows=tx.map(t=>{const kind=t.type==="income"?"دریافتی":t.type==="expense"?"پرداختی":"انتقال";const other=t.type==="transfer"?(t.destinationType==="other"?(t.otherName||"دیگران"):data.accounts.find(x=>x.id===t.to)?.name||""):"";const sign=t.type==="income"?Number(t.amount||0):(t.type==="expense"||t.from===id)?-Number(t.amount||0):Number(t.amount||0);return [jalaliDateTimeInput(t.date),kind,t.title||"",data.accounts.find(x=>x.id===t.accountID)?.name||a.name,other,sign,accountBalance(a.id)]});exportXLS(`گزارش-${a.name}`,['تاریخ و ساعت ثبت','نوع','شرح','حساب','مقصد','مبلغ خالص','مانده حساب'],rows)}
function exportCustomerExcel(id){const c=data.customers.find(x=>x.id===id);if(!c)return;const inv=data.invoices.filter(x=>x.customerId===id);const rows=inv.map(x=>[invoiceDateLabel(x.date),x.number||"",x.name||"",invoiceTotal(x),Number(x.paid||0),invoiceRemaining(x),x.status==="paid"?"پرداخت کامل":x.status==="partial"?"پرداخت بخشی":"پرداخت نشده"]);exportXLS(`مشتری-${c.name}`,['تاریخ','شماره فاکتور','عنوان','مبلغ','پرداخت','مانده','وضعیت'],rows)}
function exportAllCustomersExcel(){const rows=data.customers.map(c=>{const st=customerStats(c);return [c.name,c.phone||"",st.count,st.total,st.paid,st.due]});exportXLS('همه-مشتریان',['نام مشتری','شماره تماس','تعداد فاکتور','مجموع خرید','مجموع پرداخت','مانده'],rows)}

function openPerson(id=null){const p=id&&data.people.find(x=>x.id===id);openModal(`<h2>${p?"ویرایش بدهکار/بستانکار":"بدهکار / بستانکار"}</h2><div class="form"><select id="pt"><option value="debt" ${p?.type==="debt"?"selected":""}>من بدهکارم</option><option value="credit" ${p?.type==="credit"?"selected":""}>من طلبکارم</option></select><input id="pn" placeholder="نام شخص" value="${esc(p?.name||"")}"><input id="pa" type="number" placeholder="مبلغ" value="${Number(p?.amount)||""}">${simpleDateField("pd",jalaliInputValue(p?.due||""))}<textarea id="pnote" placeholder="توضیحات">${esc(p?.note||"")}</textarea><button class="primary" onclick="savePerson('${p?.id||""}')">${p?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function savePerson(id){const name=$("pn").value.trim(),amount=parseMoney($("pa").value);if(!name||!amount)return alert("نام و مبلغ را وارد کنید");const o={type:$("pt").value,name,amount,due:jalaliToISO($("pd").value),note:$("pnote").value.trim()};if(id){const p=data.people.find(x=>x.id===id);if(!p)return alert("این شخص پیدا نشد");Object.assign(p,o);p.paid=Math.min(Number(p.paid)||0,amount);touch(p);markDirty("people",p.id,false,p,p.updatedAt)}else{const np=touch({id:uid(),paid:0,...o});data.people.push(np);markDirty("people",np.id,false,np,np.updatedAt)}localStorage.setItem(KEY,JSON.stringify(data));render();syncSave();logEvent(id?"ویرایش شخص":"ایجاد شخص",`${name} • ${money(amount)}`,id?"edit":"create");closeModal()}
function deletePerson(id){if(confirm("این مورد حذف شود؟")){const p=data.people.find(x=>x.id===id);removeRecord("people",id);logEvent("حذف شخص",p?.name||id,"delete")}}
function payPerson(id){const p=data.people.find(x=>x.id===id);if(!p)return;const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));const v=prompt("مبلغ تسویه:",String(remaining));if(v!==null){const n=parseMoney(v);if(!n)return alert("مبلغ نامعتبر است");p.paid=Math.min(Number(p.amount)||0,(Number(p.paid)||0)+n);touch(p);markDirty("people",p.id,false,p,p.updatedAt);save();logEvent("تسویه شخص",`${p.name} • ${money(n)}`,"payment")}}

function pickerDateValue(v){if(!v)return todayJalali();let d=new Date(v);if(Number.isNaN(d.getTime()))return toFaDigits(String(v));let j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return `${toFaDigits(j[0])}/${padFa(j[1])}/${padFa(j[2])}`;}
function pickerTimeValue(v){const d=v?new Date(v):new Date(); if(Number.isNaN(d.getTime())) return ""; return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function pickerToISO(dateId,timeId){const dv=$(dateId)?.value||"", tv=$(timeId)?.value||"00:00"; if(!dv)return ""; return jalaliDateTimeToISO(`${dv} ${tv}`);}
function simpleDateField(id,value){return `<div class="date-input-row"><input id="${id}" inputmode="numeric" autocomplete="off" placeholder="تاریخ شمسی ۱۴۰۵/۰۶/۰۸" value="${esc(value)}"><button type="button" class="cal-open-btn" onclick="openJalaliCalendar('${id}')" title="باز کردن تقویم">📆</button></div>`}
function pickerBox(dateId,timeId,v){return `<div class="date-time-picker"><label>📅 تاریخ شمسی <div class="date-input-row"><input id="${dateId}" inputmode="numeric" autocomplete="off" placeholder="۱۴۰۵/۰۶/۰۸" value="${esc(pickerDateValue(v))}"><button type="button" class="cal-open-btn" onclick="openJalaliCalendar('${dateId}')" title="باز کردن تقویم">📆</button></div></label><label>⏰ ساعت <input id="${timeId}" type="time" value="${pickerTimeValue(v)}"></label><small>می‌توانی تاریخ را تایپ کنی یا از تقویم انتخاب کنی (۱۴۰۵/۰۶/۰۸)</small></div>`;}

/* ---- Full Jalali (Shamsi) month-view calendar picker ---- */
const PERSIAN_MONTHS=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const PERSIAN_WEEKDAYS=["ش","ی","د","س","چ","پ","ج"];
let calState={targetId:null,jy:0,jm:0,jd:0};
function jalaliMonthLength(jy,jm){
  const g1=jalaliToGregorian(jy,jm,1);
  const nm=jm===12?1:jm+1, ny=jm===12?jy+1:jy;
  const g2=jalaliToGregorian(ny,nm,1);
  const d1=new Date(g1[0],g1[1]-1,g1[2]), d2=new Date(g2[0],g2[1]-1,g2[2]);
  return Math.round((d2-d1)/86400000);
}
function jalaliWeekdayIndex(jy,jm,jd){
  const g=jalaliToGregorian(jy,jm,jd);
  const js=new Date(g[0],g[1]-1,g[2]).getDay();
  return (js+1)%7;
}
function openJalaliCalendar(targetId){
  const cur=$(targetId)?.value||"";
  let jy,jm,jd;
  const m=toEnDigits(cur).trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){jy=+m[1];jm=+m[2];jd=+m[3]}
  else{const t=new Date();const j=gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate());jy=j[0];jm=j[1];jd=j[2]}
  calState={targetId,jy,jm,jd};
  renderCalModal();
  $("calModal")?.classList.remove("hidden");
}
function closeCalModal(){$("calModal")?.classList.add("hidden")}
function calNav(dir){
  calState.jm+=dir;
  if(calState.jm<1){calState.jm=12;calState.jy--}
  if(calState.jm>12){calState.jm=1;calState.jy++}
  renderCalModal();
}
function calGoToday(){
  const t=new Date();const j=gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate());
  calState.jy=j[0];calState.jm=j[1];calState.jd=j[2];
  renderCalModal();
}
function calPickDay(jd){
  calState.jd=jd;
  const val=`${toFaDigits(calState.jy)}/${padFa(calState.jm)}/${padFa(jd)}`;
  const input=$(calState.targetId);
  if(input){input.value=val;input.dispatchEvent(new Event("input",{bubbles:true}))}
  closeCalModal();
}
function renderCalModal(){
  const {jy,jm}=calState;
  const len=jalaliMonthLength(jy,jm);
  const startIdx=jalaliWeekdayIndex(jy,jm,1);
  const t=new Date();const today=gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate());
  let cells="";
  for(let i=0;i<startIdx;i++)cells+=`<div class="cal-cell empty"></div>`;
  for(let d=1;d<=len;d++){
    const isToday=today[0]===jy&&today[1]===jm&&today[2]===d;
    const isSel=calState.jd===d;
    cells+=`<button type="button" class="cal-cell${isToday?" cal-today":""}${isSel?" cal-selected":""}" onclick="calPickDay(${d})">${toFaDigits(d)}</button>`;
  }
  const box=$("calBody");if(!box)return;
  box.innerHTML=`<div class="cal-head"><button type="button" class="cal-nav" onclick="calNav(-1)" aria-label="ماه قبل">❮</button><b>${PERSIAN_MONTHS[jm-1]} ${toFaDigits(jy)}</b><button type="button" class="cal-nav" onclick="calNav(1)" aria-label="ماه بعد">❯</button></div><div class="cal-weekdays">${PERSIAN_WEEKDAYS.map(w=>`<span>${w}</span>`).join("")}</div><div class="cal-grid">${cells}</div><button type="button" class="cal-today-btn" onclick="calGoToday()">امروز</button>`;
}

function openNote(id=null){
 const n=id&&data.notes.find(x=>x.id===id);
 const items=(n?.items||[]);
 openModal(`<h2>${n?"ویرایش یادداشت":"یادداشت جدید"}</h2><div class="form"><input id="ntitle" placeholder="عنوان یادداشت، مثلاً خرید" value="${esc(n?.title||"")}">${pickerBox("ndatePicker","ntimePicker",n?.date||new Date().toISOString())}<select id="nrepeat"><option value="none" ${!n?.repeat||n?.repeat==="none"?"selected":""}>بدون تکرار</option><option value="daily" ${n?.repeat==="daily"?"selected":""}>روزانه</option><option value="weekly" ${n?.repeat==="weekly"?"selected":""}>هفتگی</option><option value="monthly" ${n?.repeat==="monthly"?"selected":""}>ماهانه</option></select><textarea id="ntext" placeholder="توضیحات اصلی (اختیاری)">${esc(n?.text||"")}</textarea><div><b>آیتم‌های زیرمجموعه</b><div id="noteItemsEditor" class="note-items-editor">${items.map((it,i)=>noteItemEditor(it,i)).join("")}</div><button type="button" class="add-item-btn" onclick="addNoteItemEditor()">＋ افزودن آیتم</button></div><button class="primary" onclick="saveNote('${n?.id||""}')">${n?"ذخیره تغییرات":"ساخت یادداشت"}</button></div>`);
}
function noteItemEditor(it={},i){return `<div class="note-edit-row"><div class="reorder-btns"><button type="button" title="انتقال به بالا" onclick="moveNoteItemEditorRow(this,-1)">▲</button><button type="button" title="انتقال به پایین" onclick="moveNoteItemEditorRow(this,1)">▼</button></div><input class="note-item-input" data-note-item="${i}" data-note-item-id="${esc(it.id||"")}" placeholder="مثلاً خرید نان" value="${esc(it.text||"")}"><button type="button" class="mini-danger" onclick="this.parentElement.remove()">🗑</button></div>`}
function moveNoteItemEditorRow(btn,dir){const row=btn.closest(".note-edit-row");if(!row)return;const sib=dir<0?row.previousElementSibling:row.nextElementSibling;if(!sib)return;if(dir<0)row.parentElement.insertBefore(row,sib);else row.parentElement.insertBefore(sib,row)}
function addNoteItemEditor(){const box=$("noteItemsEditor");if(!box)return;const i=box.querySelectorAll(".note-item-input").length;box.insertAdjacentHTML("beforeend",noteItemEditor({},i))}
async function saveNote(id){
 const title=$("ntitle").value.trim(); if(!title)return alert("عنوان یادداشت را وارد کنید");
 const inputs=[...document.querySelectorAll(".note-item-input")];
 const old=id?data.notes.find(x=>x.id===id):null; const oldItems=old?.items||[];
 const items=inputs.map((el,i)=>{const oldItem=el.dataset.noteItemId?oldItems.find(x=>x.id===el.dataset.noteItemId):oldItems[i];return {id:oldItem?.id||uid(),text:el.value.trim(),done:!!oldItem?.done}}).filter(x=>x.text);
 const o={title,date:pickerToISO("ndatePicker","ntimePicker"),repeat:$("nrepeat").value,text:$("ntext").value.trim(),items};
 if(id){if(!old)return alert("یادداشت پیدا نشد");Object.assign(old,o);touch(old);markDirty("notes",old.id,false,old,old.updatedAt);save();await upsertReminderForNote(old)}
 else{const minOrder=data.notes.length?Math.min(...data.notes.map(n=>n.order??0)):0;const nn=touch({id:uid(),order:minOrder-1,...o});data.notes.unshift(nn);markDirty("notes",nn.id,false,nn,nn.updatedAt);save();await upsertReminderForNote(nn)}
 logEvent(id?"ویرایش یادداشت":"ایجاد یادداشت",title,id?"edit":"create");closeModal();
}
async function toggleNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);const it=n?.items?.find(x=>x.id===itemId);if(!it)return;it.done=!it.done;touch(n);markDirty("notes",n.id,false,n,n.updatedAt);localStorage.setItem(KEY,JSON.stringify(data));syncSave();await upsertReminderForNote(n,false);logEvent(it.done?"تکمیل آیتم یادداشت":"بازگردانی آیتم یادداشت",`${n.title} • ${it.text}`,"edit");const row=document.querySelector(`[data-note-row="${CSS.escape(itemId)}"]`);if(row){const span=row.querySelector("span");if(span)span.classList.toggle("done",it.done);const cb=row.querySelector("input[type=checkbox]");if(cb)cb.checked=it.done}const card=document.querySelector(`[data-note-card="${CSS.escape(noteId)}"]`);if(card){const total=(n.items||[]).length,done=(n.items||[]).filter(x=>x.done).length;const count=card.querySelector(".note-count");if(count)count.textContent=total?`${fa(done)} / ${fa(total)}`:""}}
async function deleteNote(id){if(confirm("این یادداشت و همه آیتم‌های آن حذف شود؟")){const n=data.notes.find(x=>x.id===id);await removeReminderForNote(id);removeRecord("notes",id);logEvent("حذف یادداشت",n?.title||id,"delete")}}
async function deleteNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);if(!n)return;if(confirm("این آیتم حذف شود؟")){n.items=(n.items||[]).filter(x=>x.id!==itemId);touch(n);markDirty("notes",n.id,false,n,n.updatedAt);localStorage.setItem(KEY,JSON.stringify(data));syncSave();await upsertReminderForNote(n,false);logEvent("حذف آیتم یادداشت",n.title,"delete");const row=document.querySelector(`[data-note-row="${CSS.escape(itemId)}"]`);if(row)row.remove();const card=document.querySelector(`[data-note-card="${CSS.escape(noteId)}"]`);if(card){const total=(n.items||[]).length,done=(n.items||[]).filter(x=>x.done).length;const count=card.querySelector(".note-count");if(count)count.textContent=total?`${fa(done)} / ${fa(total)}⌄`:"⌄";const list=card.querySelector(".note-checklist");if(list&&!total)list.innerHTML='<div class="meta">هنوز آیتمی اضافه نشده</div>';}}}
function noteRepeatLabel(r){return r==="daily"?"روزانه":r==="weekly"?"هفتگی":r==="monthly"?"ماهانه":"بدون تکرار"}
function noteItemHTML(n,it,i,total){
 const moveBtns=total>1?'<div class="reorder-btns" onclick="event.stopPropagation()"><button type="button" title="انتقال به بالا" '+(i===0?'disabled':'')+' onclick="event.stopPropagation();moveNoteItem(\''+n.id+'\',\''+it.id+'\',-1)">▲</button><button type="button" title="انتقال به پایین" '+(i===total-1?'disabled':'')+' onclick="event.stopPropagation();moveNoteItem(\''+n.id+'\',\''+it.id+'\',1)">▼</button></div>':'';
 return '<div class="note-check-row" data-note-row="'+esc(it.id)+'" onclick="event.stopPropagation()">'+moveBtns+'<label onclick="event.stopPropagation()"><input type="checkbox" '+(it.done?'checked':'')+' onclick="event.stopPropagation()" onchange="toggleNoteItem(\''+n.id+'\',\''+it.id+'\')"><span class="'+(it.done?'done':'')+'">'+esc(it.text)+'</span></label><button type="button" class="mini-danger note-item-delete" title="حذف آیتم" onclick="event.stopPropagation();deleteNoteItem(\''+n.id+'\',\''+it.id+'\')">×</button></div>';
}
async function moveNoteItem(noteId,itemId,dir){
 const n=data.notes.find(x=>x.id===noteId); if(!n||!n.items)return;
 const idx=n.items.findIndex(x=>x.id===itemId); if(idx<0)return;
 const swapIdx=idx+dir; if(swapIdx<0||swapIdx>=n.items.length)return;
 [n.items[idx],n.items[swapIdx]]=[n.items[swapIdx],n.items[idx]];
 touch(n); markDirty("notes",n.id,false,n,n.updatedAt); save();
}
const openAccordions=new Set();
function noteHTML(n,pos){
 const items=n.items||[];
 const list=items.length?items.map((it,i)=>noteItemHTML(n,it,i,items.length)).join(''):'<div class="meta">هنوز آیتمی اضافه نشده</div>';
 const alarm=n.date?`<div class="meta">⏰ آلارم جداگانه: ${jalaliDateTimeInput(n.date)} • ${noteRepeatLabel(n.repeat)}</div>`:'<div class="meta">بدون آلارم</div>';
 const accId="note-"+n.id;const isOpen=openAccordions.has(accId);
 /* The header (this note card's own position among other notes) needs its
  * own up/down buttons visible right away — not buried inside the
  * collapsed accordion body, where only the checklist sub-items live.
  * So these sit in a row alongside the collapse button itself. */
 const moveBtns=pos?`<div class="reorder-btns note-head-move" onclick="event.stopPropagation()"><button type="button" title="انتقال یادداشت به بالا" ${pos.i===0?"disabled":""} onclick="event.stopPropagation();moveNote('${n.id}',-1)">▲</button><button type="button" title="انتقال یادداشت به پایین" ${pos.i===pos.total-1?"disabled":""} onclick="event.stopPropagation();moveNote('${n.id}',1)">▼</button></div>`:"";
 return `<div class="note-card item accordion-card${isOpen?' open':''}" data-note-card="${esc(n.id)}" data-acc-id="${accId}"><div class="accordion-head-row">${moveBtns}<button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span><span class="note-badge">📝</span> <b>${esc(n.title)}</b></span><span class="note-count">${items.length?fa(items.filter(x=>x.done).length)+' / '+fa(items.length):''}</span><span class="acc-arrow">⌄</span></button></div><div class="accordion-body"><div class="note-main">${n.text?'<div class="meta note-text">'+esc(n.text)+'</div>':''}${alarm}<div class="note-checklist">${list}</div></div><div class="note-actions">${actionButtons('openNote','deleteNote',n.id)}</div></div></div>`;
}
function moveNote(id,dir){
 const sorted=[...data.notes].sort((a,b)=>(a.order??0)-(b.order??0));
 const pos=sorted.findIndex(n=>n.id===id); if(pos<0)return;
 const swapPos=pos+dir; if(swapPos<0||swapPos>=sorted.length)return;
 const a=sorted[pos],b=sorted[swapPos]; const tmp=a.order??pos; a.order=b.order??swapPos; b.order=tmp;
 touch(a);touch(b); markDirty("notes",a.id,false,a,a.updatedAt); markDirty("notes",b.id,false,b,b.updatedAt);
 save();
}
function toggleAccordion(btn,event){
 if(event)event.stopPropagation();
 const card=btn?.closest(".accordion-card");if(!card)return;
 const open=!card.classList.contains("open");
 card.classList.toggle("open",open);
 btn.setAttribute("aria-expanded",String(open));
 const accId=card.dataset.accId;
 if(accId){if(open)openAccordions.add(accId);else openAccordions.delete(accId)}
}


function openReminder(id=null){const r=id&&data.reminders.find(x=>x.id===id);openModal(`<h2>${r?"ویرایش یادآوری":"یادآوری"}</h2><div class="form"><input id="rt" placeholder="عنوان" value="${esc(r?.title||"")}"><input id="ra" type="number" placeholder="مبلغ" value="${Number(r?.amount)||""}">${pickerBox("rdPicker","rtPicker",r?.date||new Date().toISOString())}<select id="rr"><option value="once" ${r?.repeat==="once"?"selected":""}>یک‌بار</option><option value="monthly" ${r?.repeat==="monthly"?"selected":""}>ماهانه</option><option value="weekly" ${r?.repeat==="weekly"?"selected":""}>هفتگی</option></select><select id="rb"><option value="expense" ${r?.type==="expense"?"selected":""}>پرداخت</option><option value="income" ${r?.type==="income"?"selected":""}>دریافت</option></select><button class="primary" onclick="saveReminder('${r?.id||""}')">${r?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function moveReminder(id,dir){
 const sorted=data.reminders.filter(r=>!r.sourceNoteId).sort((a,b)=>(a.order??0)-(b.order??0));
 const pos=sorted.findIndex(r=>r.id===id); if(pos<0)return;
 const swapPos=pos+dir; if(swapPos<0||swapPos>=sorted.length)return;
 const a=sorted[pos],b=sorted[swapPos]; const tmp=a.order??pos; a.order=b.order??swapPos; b.order=tmp;
 touch(a);touch(b); markDirty("reminders",a.id,false,a,a.updatedAt); markDirty("reminders",b.id,false,b,b.updatedAt);
 save();
}
async function saveReminder(id){if(!$("rt").value||!$("rdPicker").value)return alert("عنوان و تاریخ لازم است");const o={title:$("rt").value.trim(),amount:parseMoney($("ra").value),date:pickerToISO("rdPicker","rtPicker"),repeat:$("rr").value,type:$("rb").value};if(id){const r=data.reminders.find(x=>x.id===id);Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt);save();await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}else{const maxOrder=data.reminders.length?Math.max(...data.reminders.map(x=>x.order??0)):-1;const nr=touch({id:uid(),order:maxOrder+1,...o});data.reminders.push(nr);markDirty("reminders",nr.id,false,nr,nr.updatedAt);save();await scheduleNativeReminder(nr);if((nr.type||"")==="note" && (nr.repeat||"once")==="once") await addToAndroidClock(nr)}logEvent(id?"ویرایش یادآوری":"ایجاد یادآوری",o.title,id?"edit":"create");closeModal()}
async function deleteReminder(id){if(confirm("این یادآوری حذف شود؟")){const r=data.reminders.find(x=>x.id===id);await cancelNativeReminder(id);removeRecord("reminders",id);logEvent("حذف یادآوری",r?.title||id,"delete")}}

function openCheck(id=null){const c=id&&data.checks.find(x=>x.id===id);openModal(`<h2>${c?"ویرایش چک":"ثبت چک"}</h2><div class="form"><select id="ct"><option value="receive" ${c?.type==="receive"?"selected":""}>چک دریافتی</option><option value="pay" ${c?.type==="pay"?"selected":""}>چک پرداختی</option></select><input id="cn" placeholder="نام شخص" value="${esc(c?.name||"")}"><input id="camount" type="number" placeholder="مبلغ" value="${Number(c?.amount)||""}">${simpleDateField("cdate",jalaliInputValue(c?.date||""))}<input id="cnum" placeholder="شماره چک" value="${esc(c?.number||"")}"><input id="cbank" placeholder="بانک" value="${esc(c?.bank||"")}"><textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCheck('${c?.id||""}')">${c?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveCheck(id){if(!$("cn").value.trim()||!parseMoney($("camount").value)||!$("cdate").value)return alert("نام، مبلغ و تاریخ لازم است");const o={type:$("ct").value,name:$("cn").value.trim(),amount:parseMoney($("camount").value),date:jalaliToISO($("cdate").value),number:$("cnum").value.trim(),bank:$("cbank").value.trim(),note:$("cnote").value};if(id){const c=data.checks.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("checks",c.id,false,c,c.updatedAt)}else{const nc=touch({id:uid(),done:false,...o});data.checks.push(nc);markDirty("checks",nc.id,false,nc,nc.updatedAt)}save();logEvent(id?"ویرایش چک":"ثبت چک",`${o.name} • ${money(o.amount)}`,id?"edit":"create");closeModal()}
function deleteCheck(id){if(confirm("این چک حذف شود؟")){const c=data.checks.find(x=>x.id===id);removeRecord("checks",id);logEvent("حذف چک",c?.name||id,"delete")}}
function githubRepo(){return (localStorage.getItem(GITHUB_KEY)||"").trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/$/,"")}
function saveGithubRepo(){const v=$("githubRepo")?.value.trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/$/,"");if(!/^[^/\s]+\/[^/\s]+$/.test(v))return alert("مخزن را به شکل username/repository وارد کن");localStorage.setItem(GITHUB_KEY,v);setUpdateStatus("مخزن GitHub ذخیره شد: "+v);checkForUpdates(true)}
function setUpdateStatus(t){const e=$("updateStatus");if(e)e.textContent=t||""}
function versionParts(v){return String(v||"").replace(/^v/i,"").split(".").map(x=>parseInt(x,10)||0)}
function isNewerVersion(remote,local){const a=versionParts(remote),b=versionParts(local);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false}return false}
async function notifyUpdate(remote,url){const msg="نسخه جدید حسابدار "+remote+" منتشر شده است";try{if("Notification" in window && Notification.permission==="granted")new Notification("بروزرسانی حسابدار",{body:msg});else if("Notification" in window && Notification.permission!=="denied")await Notification.requestPermission().then(p=>{if(p==="granted")new Notification("بروزرسانی حسابدار",{body:msg})})}catch(e){} if(url && confirm(msg+"\n\nبرای مشاهده صفحه انتشار باز شود؟"))window.open(url,"_blank","noopener,noreferrer")}
async function checkForUpdates(manual=false){const repo=githubRepo();if($("githubRepo"))$("githubRepo").value=repo;if(!repo){setUpdateStatus("ابتدا مخزن GitHub را در تنظیمات وارد کن.");return false}if(manual)setUpdateStatus("در حال بررسی نسخه جدید...");try{const r=await fetch("https://api.github.com/repos/"+repo+"/releases/latest",{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});if(!r.ok)throw new Error("GitHub "+r.status);const rel=await r.json(),remote=rel.tag_name||rel.name||"";if(isNewerVersion(remote,APP_VERSION)){setUpdateStatus("⚠️ نسخه جدید "+remote+" موجود است");localStorage.setItem("hesabdar-last-update",remote);await notifyUpdate(remote,rel.html_url)}else{setUpdateStatus("✅ برنامه به‌روز است؛ نسخه فعلی "+APP_VERSION);localStorage.setItem("hesabdar-last-update",remote)}return true}catch(e){setUpdateStatus("❌ بررسی GitHub انجام نشد؛ اینترنت و نام مخزن را بررسی کن.");return false}}
async function updateServiceWorkerNow(){try{if(!('serviceWorker' in navigator))return; const reg=await navigator.serviceWorker.getRegistration(); if(reg){await reg.update();}}catch(e){console.warn("service worker update",e)}}
function startUpdateChecker(){setTimeout(()=>{checkForUpdates(false);updateServiceWorkerNow()},2500);setInterval(()=>{checkForUpdates(false);updateServiceWorkerNow()},UPDATE_CHECK_MS);setInterval(()=>{if(autoBackupEnabled())createAutoBackup("هر ۶ ساعت")},AUTO_BACKUP_MS)}
async function testNotifications(){
  const ok=await requestNativeNotifications();
  if(!ok)return alert("اجازه اعلان داده نشد. از تنظیمات گوشی/مرورگر اجازه اعلان را برای حساب‌یار فعال کن.");
  const native=getNativeLocalNotifications();
  if(native){const test={id:"test-"+Date.now(),title:"تست اعلان حساب‌یار",date:new Date(Date.now()+15000).toISOString(),repeat:"once",type:"note",body:"اگر اعلان را دیدی، سیستم اعلان درست کار می‌کند."};await scheduleNativeReminder(test);alert("یک اعلان آزمایشی برای حدود ۱۵ ثانیه دیگر زمان‌بندی شد.");return}
  alert("یک اعلان آزمایشی برای حدود ۵ ثانیه دیگر نمایش داده می‌شود. برنامه را نبند و صفحه را باز نگه‌دار.");
  setTimeout(()=>{notifyNow("تست اعلان حساب‌یار","اگر این را می‌بینی، اعلان‌ها درست کار می‌کنند.","test-notif")},5000);
}
async function requestNotifications(){
  const ok=await requestNativeNotifications();
  startReminderChecker();
  if(!ok)return alert("اجازه اعلان داده نشد. از تنظیمات مرورگر یا گوشی، اجازه اعلان را برای حساب‌یار فعال کن، سپس دوباره تلاش کن.");
  alert(getNativeLocalNotifications()?"اعلان‌ها فعال شدند؛ یادآوری‌های زمان‌دار نیز زمان‌بندی شدند.":"اعلان‌ها فعال شدند. توجه: چون این نسخه به‌صورت وب/PWA اجراست، یادآوری‌ها وقتی برنامه کاملاً بسته باشد ممکن است دیر یا با تأخیر نمایش داده شوند؛ به‌محض باز کردن برنامه، یادآوری‌های عقب‌افتاده فوراً نمایش داده می‌شوند.");
}


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
function accountBalance(id){let a=data.accounts.find(x=>x.id===id),v=Number(a?.balance)||0;data.transactions.forEach(t=>{const amt=Number(t.amount)||0;if(t.type==="income"&&t.accountID===id)v+=amt;if(t.type==="expense"&&t.accountID===id)v-=amt;if(t.type==="transfer"){if(t.from===id)v-=amt;if(t.destinationType!=="other"&&t.to===id)v+=amt}});return v}
function actionButtons(editFn,deleteFn,id){return `<div class="actions"><button type="button" title="ویرایش" onclick="${editFn}(\'${id}\')">✏️</button><button type="button" class="danger-icon" title="حذف" onclick="${deleteFn}(\'${id}\')">🗑</button></div>`}
function txHTML(t){if(t.type==="transfer"){const dest=t.destinationType==="other"?`👤 ${esc(t.otherName||"حساب دیگران")} • ${esc(t.otherCard||"")}`:`🏦 ${esc(data.accounts.find(a=>a.id===t.to)?.name||"")}`;return `<div class="item"><div><b>↔ ${esc(t.title)}</b><div class="meta">از ${esc(data.accounts.find(a=>a.id===t.from)?.name||"")} ← ${dest}</div><div class="meta">${jalaliDateTimeInput(t.date)}</div></div><div><strong>${money(t.amount)}</strong>${actionButtons("openTransfer","deleteTx",t.id)}</div></div>`;}let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||"")} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":"دستی"}</div><div class="meta">${jalaliDateTimeInput(t.date)}</div>${t.image?`<img class="tx-thumb" src="${t.image}" alt="پیوست" onclick="viewImage('${t.id}')">`:""}</div><div><strong class="${t.type}">${sign}${money(t.amount)}</strong>${actionButtons("openTx","deleteTx",t.id)}</div></div>`}
function viewImage(id){const t=data.transactions.find(x=>x.id===id);if(!t?.image)return;openModal(`<h2>📎 تصویر پیوست</h2><div class="attachment-large"><img src="${t.image}" alt="پیوست"></div>`)}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}

function invoiceDateLabel(v){return jalaliLabel(v)}
function invField(label,hint,inner){return `<div class="field"><span class="field-cap">${esc(label)}</span>${inner}${hint?`<small class="field-hint">${esc(hint)}</small>`:""}</div>`}
function invoiceRowHTML(item,i){return `<div class="invoice-row"><select class="inv-product" onchange="invoiceProductPick(this)"><option value="">کالا / خدمت از انبار (اختیاری)</option>${data.products.map(p=>`<option value="${p.id}" ${p.id===item?.productId?"selected":""}>${esc(p.name)}</option>`).join("")}</select><input class="inv-desc" placeholder="مثلاً: نصب و راه‌اندازی سیستم" value="${esc(item?.desc||"")}"><input class="inv-qty" oninput="updateInvoiceLiveTotal()" type="number" min="0" step="any" placeholder="تعداد" value="${Number(item?.qty)||""}"><input class="inv-price" oninput="updateInvoiceLiveTotal()" type="number" min="0" step="any" placeholder="قیمت هر واحد" value="${Number(item?.price)||""}"><button type="button" class="danger-icon" title="حذف ردیف" onclick="this.parentElement.remove();updateInvoiceLiveTotal()">🗑</button></div>`}
function addInvoiceRow(pref={}){const box=$("invoiceRows");if(!box)return;const div=document.createElement("div");div.innerHTML=invoiceRowHTML(pref,box.children.length);box.appendChild(div.firstElementChild)}
function invoiceProductPick(sel){const p=data.products.find(x=>x.id===sel.value);const row=sel.closest(".invoice-row");if(!p||!row)return;row.querySelector(".inv-desc").value=p.name;row.querySelector(".inv-price").value=p.price||0;updateInvoiceLiveTotal()}
function openInvoice(id=null){
 const inv=id&&data.invoices.find(x=>x.id===id);
 const items=inv?.items?.length?inv.items:[{desc:"",qty:1,price:""}];
 const cust=inv?.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 openModal(`<h2>🧾 ${inv?"ویرایش فاکتور":"ساخت فاکتور جدید"}</h2><div class="form invoice-form">
 ${invField("عنوان فاکتور","برای پیدا کردن آسان‌تر در صندوق فاکتور، مثلاً: فاکتور فروش موبایل",`<input id="invName" placeholder="مثلاً: فاکتور فروش شهریور" value="${esc(inv?.name||"")}">`)}
 ${invField("نام فروشنده / فروشگاه","اسمی که بالای فاکتور چاپ می‌شود",`<input id="invSeller" placeholder="نام فروشگاه یا کسب‌وکار شما" value="${esc(inv?.seller||(inv?"":data.branding?.storeName||""))}">`)}
 <div class="two-fields">
 ${invField("نام مشتری","اسم کسی که فاکتور برایش صادر می‌شود",`<input id="invCustomerName" placeholder="نام و نام خانوادگی مشتری" value="${esc(inv?.customerName||cust?.name||"")}">`)}
 ${invField("انتخاب از لیست مشتری‌ها","اختیاری؛ برای اتصال فاکتور به پرونده مشتری",`<select id="invCustomer"><option value="">بدون اتصال به پرونده مشتری</option>${data.customers.map(c=>`<option value="${c.id}" ${c.id===inv?.customerId?"selected":""}>${esc(c.name)}${c.phone?" • "+esc(c.phone):""}</option>`).join("")}</select>`)}
 </div>
 <div class="two-fields">
 ${invField("تاریخ فاکتور","تاریخ صدور به تقویم شمسی",simpleDateField("invDate",jalaliInputValue(inv?.date)||todayJalali()))}
 ${invField("شماره فاکتور","اختیاری؛ برای پیگیری و مرتب کردن فاکتورها",`<input id="invNo" placeholder="مثلاً: ۱۰۰۱" value="${esc(inv?.number||"")}">`)}
 </div>
 <div class="two-fields">
 ${invField("وضعیت پرداخت","بر اساس مبلغ دریافتی به‌صورت خودکار هم به‌روزرسانی می‌شود",`<select id="invStatus"><option value="unpaid" ${inv?.status!=="paid"&&inv?.status!=="partial"?"selected":""}>🔴 پرداخت نشده</option><option value="partial" ${inv?.status==="partial"?"selected":""}>🟡 پرداخت بخشی</option><option value="paid" ${inv?.status==="paid"?"selected":""}>🟢 پرداخت کامل</option></select>`)}
 ${invField("مبلغ دریافت‌شده","تا امروز از مشتری چقدر گرفته‌ای (تومان)",`<input id="invPaid" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="۰" value="${Number(inv?.paid)||0}">`)}
 </div>
 <div class="two-fields">
 ${invField("تخفیف مبلغی","مبلغ ثابتی که از جمع کل کم می‌شود (تومان)",`<input id="invDiscount" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="۰" value="${Number(inv?.discount)||0}">`)}
 ${invField("تخفیف درصدی","درصدی که بعد از تخفیف مبلغی کم می‌شود (٪)",`<input id="invDiscountPercent" oninput="updateInvoiceLiveTotal()" type="number" min="0" max="100" placeholder="۰" value="${Number(inv?.discountPercent)||0}">`)}
 </div>
 ${invField("مالیات بر ارزش‌افزوده","درصدی که بعد از کسر تخفیف به قیمت اضافه می‌شود (٪)",`<input id="invTax" oninput="updateInvoiceLiveTotal()" type="number" min="0" placeholder="۰" value="${Number(inv?.taxRate)||0}">`)}
 ${invField("آدرس یا توضیحات مشتری","اختیاری؛ آدرس، شماره تماس یا هر توضیح دیگر",`<textarea id="invAddress" placeholder="مثلاً: تهران، خیابان ... - ۰۹۱۲xxxxxxx">${esc(inv?.address||cust?.address||"")}</textarea>`)}
 <div class="invoice-table-head"><span>کالا</span><span>توضیحات</span><span>تعداد</span><span>مبلغ واحد</span><span></span></div>
 <div id="invoiceRows">${items.map(invoiceRowHTML).join("")}</div>
 <button type="button" class="ghost-btn" onclick="addInvoiceRow()">＋ افزودن ردیف کالا یا خدمت</button>
 <div class="invoice-total-box"><div class="inv-total-row"><span>جمع اقلام</span><strong id="invLiveSubtotal">۰ تومان</strong></div><div class="inv-total-row"><span>تخفیف و مالیات</span><strong id="invLiveAdjust">۰ تومان</strong></div><div class="inv-total-row inv-total-final"><span>مبلغ نهایی فاکتور</span><strong id="invLiveTotal">۰ تومان</strong></div></div>
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
 const customerName=$("invCustomerName")?.value.trim()||"";
 const o={name,seller,date,number,items,customerId:$("invCustomer").value||"",customerName,address:$("invAddress").value.trim(),discount,discountPercent,taxRate,paid,status:$("invStatus").value,total:0};o.total=invoiceTotal(o);if(o.status==="paid")o.paid=o.total;if(o.paid>=o.total&&o.total>0)o.status="paid";else if(o.paid>0)o.status="partial";else o.status="unpaid";
 if(id){const x=data.invoices.find(v=>v.id===id);if(x)adjustStockForInvoice(x,+1);Object.assign(x,o);touch(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}else{const x=touch({id:uid(),...o});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}
 save();logEvent(id?"ویرایش فاکتور":"ساخت فاکتور",`${name} • ${money(o.total)}`,id?"edit":"create");closeModal()
}
function duplicateInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;const x=touch({...JSON.parse(JSON.stringify(inv)),id:uid(),number:"",date:new Date().toISOString().slice(0,10),status:"unpaid",paid:0});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);save();logEvent("تکرار فاکتور",x.name,"create")}
function deleteInvoice(id){if(!confirm("این فاکتور حذف شود؟"))return;const x=data.invoices.find(v=>v.id===id);adjustStockForInvoice(x,+1);removeRecord("invoices",id);logEvent("حذف فاکتور",x?.name||id,"delete")}
function invoiceCustomerLabel(inv){if(inv.customerName)return inv.customerName;const c=inv.customerId?data.customers.find(x=>x.id===inv.customerId):null;return c?.name||""}
function invoiceHTML(inv){
 const total=invoiceTotal(inv);
 const custName=invoiceCustomerLabel(inv);
 return `<div class="item invoice-item"><div><b>🧾 ${esc(inv.name||"فاکتور")}</b><div class="meta">${esc(inv.seller||"فروشنده ثبت نشده")}${custName?" • مشتری: "+esc(custName):""} • ${invoiceDateLabel(inv.date)}${inv.number?" • شماره "+esc(inv.number):""}</div><div class="meta">جمع کل: ${money(total)} • ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}</div></div><div class="actions"><button onclick="openInvoice('${inv.id}')">✏️</button><button onclick="previewInvoice('${inv.id}')">👁</button><button onclick="duplicateInvoice('${inv.id}')">📄</button><button onclick="shareInvoice('${inv.id}')">📤</button><button class="danger-icon" onclick="deleteInvoice('${inv.id}')">🗑</button></div></div>`
}
function previewInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return; const cust=inv.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 const b=data.branding||{};
 const rows=(inv.items||[]).map(x=>`<div class="preview-inv-row"><span>${esc(x.desc)}</span><span>${fa(x.qty)}</span><span>${money(x.price)}</span><span>${money((Number(x.qty)||0)*(Number(x.price)||0))}</span></div>`).join("");
 const signRow=(b.stamp||b.signature)?`<div class="invoice-sign-row">${b.stamp?`<div class="invoice-sign-box"><img class="invoice-brand-stamp" src="${b.stamp}" alt="مهر فروشگاه"><small>مهر</small></div>`:"<div></div>"}${b.signature?`<div class="invoice-sign-box"><img class="invoice-brand-signature" src="${b.signature}" alt="امضا"><small>امضا</small></div>`:""}</div>`:"";
 const custName=invoiceCustomerLabel(inv);
 openModal(`<div id="invoicePreview" class="invoice-preview"><div class="invoice-head"><div>${b.logo?`<img class="invoice-brand-logo" src="${b.logo}" alt="لوگو">`:""}<h2>فاکتور</h2><b>${esc(inv.seller||b.storeName||"")}</b></div><div>شماره: ${esc(inv.number||"—")}<br>تاریخ: ${invoiceDateLabel(inv.date)}</div></div><h3>${esc(inv.name||"فاکتور")}</h3>${custName?`<div class="meta">مشتری: ${esc(custName)}${cust?.phone?" • "+esc(cust.phone):""}</div>`:""}<div class="meta">وضعیت: ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}</div><div class="preview-inv-row head"><b>توضیحات</b><b>تعداد</b><b>مبلغ واحد</b><b>مبلغ</b></div>${rows}<div class="preview-total">جمع کل: <strong>${money(invoiceTotal(inv))}</strong></div>${signRow}</div><div class="actions"><button class="primary" onclick="printInvoice('${inv.id}')">🖨 چاپ / PDF</button><button class="primary" onclick="shareInvoice('${inv.id}')">📤 ارسال فاکتور</button></div>`)
}
function loadImg(src){return new Promise(resolve=>{if(!src)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src})}
async function drawInvoiceCanvas(inv){
 const b=data.branding||{};
 const W=794, rowH=58, H=Math.max(1123,560+(inv.items||[]).length*rowH);
 const [logoImg,stampImg,signImg]=await Promise.all([loadImg(b.logo),loadImg(b.stamp),loadImg(b.signature)]);
 const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
 x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#17352b";x.textAlign="right";x.direction="rtl";
 if(logoImg)try{x.drawImage(logoImg,55,25,90,70)}catch(e){}
 x.font="bold 34px sans-serif";x.fillText("فاکتور",W-45,55);
 x.font="bold 22px sans-serif";x.fillText(inv.seller||b.storeName||"فروشگاه / فروشنده",W-45,95);
 x.font="17px sans-serif";x.fillStyle="#56645f";x.fillText("شماره: "+(inv.number||"—"),W-45,130);x.fillText("تاریخ: "+invoiceDateLabel(inv.date),W-245,130);
 x.fillStyle="#17352b";x.font="bold 21px sans-serif";x.fillText(inv.name||"فاکتور",W-45,180);
 const custLabel=invoiceCustomerLabel(inv);
 if(custLabel){x.font="16px sans-serif";x.fillStyle="#56645f";x.fillText("مشتری: "+custLabel,W-45,208)}
 let y=245;x.fillStyle="#eaf2ee";x.fillRect(28,y-32,W-56,45);x.fillStyle="#17352b";x.font="bold 14px sans-serif";
 x.fillText("مبلغ",W-38,y-8);x.fillText("مبلغ واحد",W-230,y-8);x.fillText("تعداد",W-400,y-8);x.fillText("توضیحات",W-490,y-8);
 x.font="15px sans-serif";
 (inv.items||[]).forEach((it,i)=>{y+=rowH;x.fillStyle=i%2?"#fafcfb":"#fff";x.fillRect(55,y-50,W-110,rowH);x.fillStyle="#23312c";x.fillText(money((Number(it.qty)||0)*(Number(it.price)||0)),W-38,y);x.fillText(money(it.price),W-230,y);x.fillText(fa(it.qty),W-400,y);x.fillText(it.desc||"—",W-490,y);});
 y+=45;x.fillStyle="#17352b";x.font="bold 20px sans-serif";x.fillText("جمع کل: "+money(invoiceTotal(inv)),W-38,y);
 if(stampImg||signImg){
   const signY=y+60;
   x.textAlign="center";x.font="14px sans-serif";x.fillStyle="#56645f";
   if(stampImg){try{x.drawImage(stampImg,W-220,signY,120,120)}catch(e){}x.fillText("مهر",W-160,signY+140)}
   if(signImg){try{x.drawImage(signImg,90,signY,120,120)}catch(e){}x.fillText("امضا",150,signY+140)}
   x.textAlign="right";
 }
 return c
}
async function shareInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return;
 const c=await drawInvoiceCanvas(inv);
 const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.9));const file=new File([blob],`${(inv.name||"فاکتور").replace(/[\\/:*?"<>|]/g,"_")}.jpg`,{type:"image/jpeg"});
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:inv.name||"فاکتور",text:`${inv.name||"فاکتور"} • ${money(invoiceTotal(inv))}`,files:[file]});return}
 }catch(e){if(e?.name==="AbortError")return}
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);alert("عکس فاکتور آماده شد؛ از گزینه اشتراک گوشی می‌توانی ارسالش کنی.")
}
function printInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;previewInvoice(id);setTimeout(()=>window.print(),250)}
function previewBrandFile(input,type){const f=input?.files?.[0];if(!f)return;openFramer(f,type,input)}

/* ===== Image framer: Telegram/Instagram-style fixed frame for logo/stamp/signature ===== */
const framerState={img:null,type:null,input:null,scale:1,offX:0,offY:0,baseScale:1,stageW:260,stageH:260,dragging:false,startX:0,startY:0};
const FRAMER_SIZES={logo:{stageW:220,stageH:220,outW:500,outH:500,round:true},stamp:{stageW:220,stageH:220,outW:500,outH:500,round:true},signature:{stageW:260,stageH:150,outW:640,outH:370,round:false}};

/* ---- v5.5: on-device "AI enhance" for logo/stamp/signature photos ----
 * There is no real image-editing model wired into this app, so this runs a small
 * client-side pipeline (auto contrast stretch + unsharp-mask sharpening + background
 * whitening) that noticeably cleans up a phone photo of a stamp/signature/logo:
 * sharper edges and a clean white background instead of a dull/gray paper scan. */
function aiClamp255(v){return v<0?0:v>255?255:v}
function aiBoxBlurRGB(data,w,h,radius){
  const size=radius*2+1;
  const tmp=new Float32Array(data.length);
  for(let y=0;y<h;y++){
    let rSum=0,gSum=0,bSum=0;
    for(let x=-radius;x<=radius;x++){const xi=Math.min(w-1,Math.max(0,x));const idx=(y*w+xi)*4;rSum+=data[idx];gSum+=data[idx+1];bSum+=data[idx+2]}
    for(let x=0;x<w;x++){
      const idx=(y*w+x)*4;
      tmp[idx]=rSum/size;tmp[idx+1]=gSum/size;tmp[idx+2]=bSum/size;
      const addXi=Math.min(w-1,x+radius+1),subXi=Math.max(0,x-radius);
      const addIdx=(y*w+addXi)*4,subIdx=(y*w+subXi)*4;
      rSum+=data[addIdx]-data[subIdx];gSum+=data[addIdx+1]-data[subIdx+1];bSum+=data[addIdx+2]-data[subIdx+2];
    }
  }
  const out=new Float32Array(data.length);
  for(let x=0;x<w;x++){
    let rSum=0,gSum=0,bSum=0;
    for(let y=-radius;y<=radius;y++){const yi=Math.min(h-1,Math.max(0,y));const idx=(yi*w+x)*4;rSum+=tmp[idx];gSum+=tmp[idx+1];bSum+=tmp[idx+2]}
    for(let y=0;y<h;y++){
      const idx=(y*w+x)*4;
      out[idx]=rSum/size;out[idx+1]=gSum/size;out[idx+2]=bSum/size;
      const addYi=Math.min(h-1,y+radius+1),subYi=Math.max(0,y-radius);
      const addIdx=(addYi*w+x)*4,subIdx=(subYi*w+x)*4;
      rSum+=tmp[addIdx]-tmp[subIdx];gSum+=tmp[addIdx+1]-tmp[subIdx+1];bSum+=tmp[addIdx+2]-tmp[subIdx+2];
    }
  }
  return out;
}
function aiEnhancePixels(imageData,w,h){
  const data=imageData.data;
  let minR=255,maxR=0,minG=255,maxG=0,minB=255,maxB=0;
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2];
    if(r<minR)minR=r; if(r>maxR)maxR=r;
    if(g<minG)minG=g; if(g>maxG)maxG=g;
    if(b<minB)minB=b; if(b>maxB)maxB=b;
  }
  const stretch=(v,mn,mx)=>mx<=mn?v:aiClamp255(((v-mn)/(mx-mn))*255);
  for(let i=0;i<data.length;i+=4){data[i]=stretch(data[i],minR,maxR);data[i+1]=stretch(data[i+1],minG,maxG);data[i+2]=stretch(data[i+2],minB,maxB)}
  const blurred=aiBoxBlurRGB(data,w,h,2);
  const amount=0.6;
  for(let i=0;i<data.length;i+=4){
    data[i]=aiClamp255(data[i]+amount*(data[i]-blurred[i]));
    data[i+1]=aiClamp255(data[i+1]+amount*(data[i+1]-blurred[i+1]));
    data[i+2]=aiClamp255(data[i+2]+amount*(data[i+2]-blurred[i+2]));
  }
  for(let i=0;i<data.length;i+=4){
    const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    if(lum>210){const boost=Math.min(1,(lum-210)/45);data[i]=aiClamp255(data[i]+boost*(255-data[i]));data[i+1]=aiClamp255(data[i+1]+boost*(255-data[i+1]));data[i+2]=aiClamp255(data[i+2]+boost*(255-data[i+2]))}
  }
  return imageData;
}
async function aiEnhanceFramerImage(){
  const s=framerState; if(!s.img)return;
  const btn=$("framerEnhanceBtn"); if(btn){btn.disabled=true;btn.textContent="⏳ در حال بهبود تصویر..."}
  try{
    const srcW=s.img.naturalWidth,srcH=s.img.naturalHeight;
    const procMax=900,down=Math.min(1,procMax/Math.max(srcW,srcH));
    const pw=Math.max(1,Math.round(srcW*down)),ph=Math.max(1,Math.round(srcH*down));
    const proc=document.createElement("canvas");proc.width=pw;proc.height=ph;
    const pctx=proc.getContext("2d");pctx.drawImage(s.img,0,0,pw,ph);
    const imgData=aiEnhancePixels(pctx.getImageData(0,0,pw,ph),pw,ph);
    pctx.putImageData(imgData,0,0);
    const full=document.createElement("canvas");full.width=srcW;full.height=srcH;
    const fctx=full.getContext("2d");fctx.imageSmoothingEnabled=true;fctx.imageSmoothingQuality="high";fctx.drawImage(proc,0,0,srcW,srcH);
    const dataUrl=full.toDataURL("image/png",0.95);
    const enhancedImg=new Image();
    await new Promise((resolve,reject)=>{enhancedImg.onload=resolve;enhancedImg.onerror=reject;enhancedImg.src=dataUrl});
    s.img=enhancedImg;
    const imgEl=$("framerImg");if(imgEl)imgEl.src=dataUrl;
    updateFramerTransform();
    logEvent("بهبود هوشمند تصویر",s.type==="logo"?"لوگو":s.type==="stamp"?"مهر":"امضا","edit");
  }catch(e){console.warn("ai enhance",e);alert("بهبود تصویر ممکن نشد؛ دوباره امتحان کن.")}
  if(btn){btn.disabled=false;btn.textContent="🪄 واضح‌تر و تمیزتر کن (AI)"}
}
function openFramer(file,type,input){
 const cfg=FRAMER_SIZES[type]||FRAMER_SIZES.logo;
 const r=new FileReader();
 r.onload=()=>{
  const img=new Image();
  img.onload=()=>{
   framerState.img=img;framerState.type=type;framerState.input=input;framerState.scale=1;framerState.offX=0;framerState.offY=0;
   framerState.stageW=cfg.stageW;framerState.stageH=cfg.stageH;
   framerState.baseScale=Math.max(cfg.stageW/img.naturalWidth,cfg.stageH/img.naturalHeight);
   const modal=$("framerModal");const stage=$("framerStage");const imgEl=$("framerImg");
   stage.style.width=cfg.stageW+"px";stage.style.height=cfg.stageH+"px";
   stage.classList.toggle("framer-round",!!cfg.round);
   imgEl.src=img.src;
   $("framerZoom").value=1;
   updateFramerTransform();
   modal.classList.remove("hidden");
  };
  img.src=r.result;
 };
 r.readAsDataURL(file);
}
function updateFramerTransform(){
 const s=framerState;const imgEl=$("framerImg");if(!imgEl||!s.img)return;
 const total=s.baseScale*s.scale;
 const dispW=s.img.naturalWidth*total,dispH=s.img.naturalHeight*total;
 const maxX=Math.max(0,(dispW-s.stageW)/2),maxY=Math.max(0,(dispH-s.stageH)/2);
 s.offX=Math.max(-maxX,Math.min(maxX,s.offX));s.offY=Math.max(-maxY,Math.min(maxY,s.offY));
 imgEl.style.width=dispW+"px";imgEl.style.height=dispH+"px";
 imgEl.style.transform=`translate(${-dispW/2+s.stageW/2+s.offX}px,${-dispH/2+s.stageH/2+s.offY}px)`;
}
function framerZoomChange(v){framerState.scale=Number(v)||1;updateFramerTransform()}
function framerPointerDown(e){framerState.dragging=true;const p=e.touches?e.touches[0]:e;framerState.startX=p.clientX-framerState.offX;framerState.startY=p.clientY-framerState.offY}
function framerPointerMove(e){if(!framerState.dragging)return;const p=e.touches?e.touches[0]:e;framerState.offX=p.clientX-framerState.startX;framerState.offY=p.clientY-framerState.startY;updateFramerTransform();if(e.cancelable)e.preventDefault()}
function framerPointerUp(){framerState.dragging=false}
function closeFramer(){$("framerModal").classList.add("hidden");framerState.img=null;if(framerState.input)framerState.input.value=""}
function confirmFramer(){
 const s=framerState;if(!s.img)return closeFramer();
 const cfg=FRAMER_SIZES[s.type]||FRAMER_SIZES.logo;
 const total=s.baseScale*s.scale;
 const dispW=s.img.naturalWidth*total,dispH=s.img.naturalHeight*total;
 const imgLeft=-dispW/2+s.stageW/2+s.offX, imgTop=-dispH/2+s.stageH/2+s.offY;
 const sx=(0-imgLeft)/total, sy=(0-imgTop)/total, sw=s.stageW/total, sh=s.stageH/total;
 const canvas=document.createElement("canvas");canvas.width=cfg.outW;canvas.height=cfg.outH;
 const ctx=canvas.getContext("2d");
 ctx.drawImage(s.img,sx,sy,sw,sh,0,0,cfg.outW,cfg.outH);
 const dataUrl=canvas.toDataURL("image/png",0.92);
 const box=$(s.type==="logo"?"brandLogoPreview":s.type==="stamp"?"brandStampPreview":"brandSignaturePreview");
 if(box)box.innerHTML=`<img class="brand-preview-img" src="${dataUrl}" alt="${s.type}">`;
 if(s.input)s.input.dataset.value=dataUrl;
 closeFramer();
}

/* ===== Dashboard customization ===== */
const DASH_WIDGETS=[
 {id:"hero",label:"موجودی کل"},
 {id:"stats",label:"درآمد و هزینه این ماه"},
 {id:"quick",label:"دکمه تراکنش و یادآوری"},
 {id:"invoiceBtn",label:"دکمه صدور فاکتور"},
 {id:"tools",label:"ابزارهای سریع (ماشین‌حساب و ثبت گروهی)"},
 {id:"recent",label:"آخرین تراکنش‌ها"},
 {id:"stgBranding",label:"🔧 ظاهر فروشگاه و فاکتور",settingsIcon:"🏪",settingsHint:"نام فروشگاه، لوگو، مهر و امضا برای فاکتور.",settingsTarget:"stgGroup-branding"},
 {id:"stgYear",label:"🔧 سال مالی",settingsIcon:"📅",settingsHint:"وضعیت تسویه سال مالی جاری.",settingsTarget:"stgGroup-year"},
 {id:"stgNotif",label:"🔧 اعلان‌ها",settingsIcon:"🔔",settingsHint:"فعال‌سازی و تست اعلان یادآوری‌ها.",settingsTarget:"stgGroup-notif"},
 {id:"stgBackup",label:"🔧 پشتیبان و بروزرسانی",settingsIcon:"🚀",settingsHint:"بکاپ خودکار و بررسی نسخه جدید.",settingsTarget:"stgGroup-backup"},
 {id:"stgManualBackup",label:"🔧 پشتیبان‌گیری دستی",settingsIcon:"💾",settingsHint:"خروجی یا بازیابی فایل اطلاعات.",settingsTarget:"stgGroup-manualBackup"},
 {id:"stgSync",label:"🔧 همگام‌سازی دو گوشی",settingsIcon:"☁️",settingsHint:"وضعیت اتصال و ارسال/دریافت ابری.",settingsTarget:"stgGroup-sync"},
 {id:"stgSecurity",label:"🔧 امنیت ورود",settingsIcon:"🔐",settingsHint:"رمز ورود برنامه را تنظیم یا حذف کن.",settingsTarget:"stgGroup-security"},
];
function dashboardConfig(){
 data.dashboardConfig??={};
 if(!Array.isArray(data.dashboardConfig.order)||!data.dashboardConfig.order.length)data.dashboardConfig.order=DASH_WIDGETS.map(w=>w.id);
 for(const w of DASH_WIDGETS)if(!data.dashboardConfig.order.includes(w.id))data.dashboardConfig.order.push(w.id);
 if(!Array.isArray(data.dashboardConfig.hidden))data.dashboardConfig.hidden=[];
 return data.dashboardConfig;
}
function settingsShortcutHTML(w){
 return `<div class="dash-widget" data-widget="${w.id}"><button type="button" class="card settings-shortcut" onclick="goToSettingsGroup('${w.settingsTarget}')"><span class="settings-shortcut-icon">${w.settingsIcon}</span><span class="settings-shortcut-body"><b>${esc(w.label.replace('🔧 ',''))}</b><small>${esc(w.settingsHint)}</small></span><span class="settings-shortcut-arrow">‹</span></button></div>`;
}
function ensureDashWidgetElements(){
 const home=$("home");if(!home)return;
 for(const w of DASH_WIDGETS){
  if(!w.settingsTarget)continue;
  if(home.querySelector(`.dash-widget[data-widget="${w.id}"]`))continue;
  home.insertAdjacentHTML("beforeend",settingsShortcutHTML(w));
 }
}
function goToSettingsGroup(targetId){
 const navBtn=document.querySelector('.nav[data-page="settings"]');
 if(navBtn)navBtn.click();
 setTimeout(()=>{
  const el=$(targetId);if(!el)return;
  el.scrollIntoView({behavior:"smooth",block:"start"});
  el.classList.add("settings-group-highlight");
  setTimeout(()=>el.classList.remove("settings-group-highlight"),1600);
 },260);
}
function applyDashboardConfig(){
 ensureDashWidgetElements();
 const cfg=dashboardConfig();const home=$("home");if(!home)return;
 const afterHead=home.querySelector(".home-head");
 for(const id of cfg.order){
  const el=home.querySelector(`.dash-widget[data-widget="${id}"]`);if(!el)continue;
  home.appendChild(el);
  el.classList.toggle("dash-hidden",cfg.hidden.includes(id));
 }
 if(afterHead)home.insertBefore(afterHead,home.firstChild);
}
function openDashboardCustomize(){
 const cfg=dashboardConfig();
 const rows=cfg.order.map((id,i)=>{
  const w=DASH_WIDGETS.find(x=>x.id===id);if(!w)return"";
  const hidden=cfg.hidden.includes(id);
  return `<div class="dash-cfg-row" data-id="${id}">
   <label class="dash-cfg-check"><input type="checkbox" ${hidden?"":"checked"} onchange="toggleDashWidget('${id}',!this.checked)"><span>${esc(w.label)}</span></label>
   <div class="dash-cfg-move">
    <button type="button" ${i===0?"disabled":""} onclick="moveDashWidget('${id}',-1)">▲</button>
    <button type="button" ${i===cfg.order.length-1?"disabled":""} onclick="moveDashWidget('${id}',1)">▼</button>
   </div>
  </div>`;
 }).join("");
 openModal(`<h2>🎛 سفارشی‌سازی داشبورد</h2><div class="form"><p class="hint">هر بخش که نیاز نداری خاموش کن، و با فلش‌ها ترتیب نمایش را بر اساس اولویت خودت جابه‌جا کن.</p><div id="dashCfgList" class="dash-cfg-list">${rows}</div><button class="primary" onclick="closeModal()">تمام شد</button></div>`);
}
function toggleDashWidget(id,hide){
 const cfg=dashboardConfig();
 cfg.hidden=cfg.hidden.filter(x=>x!==id);
 if(hide)cfg.hidden.push(id);
 save();applyDashboardConfig();
}
function moveDashWidget(id,dir){
 const cfg=dashboardConfig();
 const i=cfg.order.indexOf(id);const j=i+dir;if(i<0||j<0||j>=cfg.order.length)return;
 [cfg.order[i],cfg.order[j]]=[cfg.order[j],cfg.order[i]];
 save();applyDashboardConfig();openDashboardCustomize();
}
function loadBrandingSettings(){const b=data.branding||{};if($("brandStore"))$("brandStore").value=b.storeName||"";[["brandLogoPreview",b.logo,"لوگو"],["brandStampPreview",b.stamp,"مهر"],["brandSignaturePreview",b.signature,"امضا"]].forEach(([id,src,label])=>{const box=$(id);if(box)box.innerHTML=src?`<img class="brand-preview-img" src="${src}" alt="${label}">`:""})}
function saveBranding(){data.branding??={};data.branding.storeName=$("brandStore")?.value.trim()||"";["logo","stamp","signature"].forEach(type=>{const el=$(type==="logo"?"brandLogo":type==="stamp"?"brandStamp":"brandSignature");if(el?.dataset.value)data.branding[type]=el.dataset.value});save();logEvent("ذخیره مشخصات فاکتور",data.branding.storeName||"لوگو، مهر و امضا","settings");alert("مشخصات فاکتور ذخیره شد")}
function clearBranding(){if(!confirm("لوگو، مهر و امضا حذف شوند؟"))return;data.branding={storeName:"",logo:"",stamp:"",signature:""};save();loadBrandingSettings();logEvent("حذف مشخصات فاکتور","لوگو، مهر و امضا حذف شدند","settings")}
function currentJalaliYear(){const j=gregorianToJalali(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());return j[0]}
function settleCurrentYear(){const y=currentJalaliYear();const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);const credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);if(debt>0||credit>0){return alert(`سال ${fa(y)} هنوز تسویه کامل نشده است.\nبدهی باقی‌مانده: ${money(debt)}\nطلب باقی‌مانده: ${money(credit)}\nاین مبالغ به سال بعد منتقل می‌شوند.`)}if(!confirm(`سال ${fa(y)} به‌عنوان «تسویه کامل» ثبت شود؟ اطلاعات سال حذف نمی‌شود.`))return;data.yearSettlements[y]={settled:true,at:new Date().toISOString()};save();logEvent("تسویه کامل سال",`سال ${y} تسویه شد؛ بدهی و طلب باقی‌مانده صفر بود`,`payment`);renderYearSettlement();alert("تسویه کامل سال ثبت شد")}
function renderYearSettlement(){const box=$("yearSettlementBox");if(!box)return;const y=currentJalaliYear(),st=data.yearSettlements?.[y];const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0)),0);const rb=$("yearStatusReport");if(rb)rb.innerHTML=st?.settled?`<div class="card settlement-ok">🟢 سال ${fa(y)} تسویه شده است.</div>`:`<div class="card settlement-pending">🟡 سال ${fa(y)} هنوز تسویه نشده است.</div>`;box.innerHTML=st?.settled?`<div class="settlement-ok">🟢 سال ${fa(y)} تسویه شده است.</div>`:`<div class="settlement-pending">🟡 سال ${fa(y)} هنوز تسویه نشده است.<br>بدهی: ${money(debt)} • طلب: ${money(credit)}<br><small>بدهی‌ها و مطالبات تا تسویه کامل باقی می‌مانند.</small></div>`}
function renderBrandingInSettings(){loadBrandingSettings();renderYearSettlement()}
/* v5.5 perf fix: previously render() recomputed every single page's HTML (accounts,
   transactions, audit log, charts, reports...) on every save/log event regardless of
   which page was actually on screen. With more data this caused visible lag on every
   tap. pageActive() lets each expensive section skip itself when its page isn't the
   one currently shown; it still refreshes fully the moment the user navigates there
   (activatePage() calls render() again right after switching pages). */
function pageActive(id){const el=$(id);return !!(el&&el.classList.contains("active"))}
function render(){
 const inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+(Number(t.amount)||0),0),exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+(Number(t.amount)||0),0),base=data.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),net=inc-exp;
 if($("balance"))$("balance").textContent=money(base+net);if($("income"))$("income").textContent=money(inc);if($("expense"))$("expense").textContent=money(exp);
 if($("recent"))$("recent").innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 if($("accountList")&&pageActive("accounts"))$("accountList").innerHTML=data.accounts.map(a=>`<div class="item account-item"><div class="account-main"><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}${a.sender?" • فرستنده: "+esc(a.sender):""}</div>${cardActions(a)}</div><div><strong>${money(accountBalance(a.id))}</strong>${actionButtons("openAccount","deleteAccount",a.id)}<button type="button" title="گزارش Excel" onclick="exportAccountExcel('${a.id}')">📊</button></div></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 const q=$("search")?.value?.trim()||"",ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("reportAccount")&&pageActive("reports")){const rv=$("reportAccount").value;$("reportAccount").innerHTML='<option value="">همه حساب‌ها</option>'+data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");$("reportAccount").value=rv;}
 if($("filterCat")&&pageActive("transactions")){let opts='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("filterCat").innerHTML=opts;$("filterCat").value=fc}
 if($("txList")&&pageActive("transactions"))$("txList").innerHTML=data.transactions.filter(t=>(!q||String(t.title).includes(q)||String(t.category||"").includes(q))&&(!ft||t.type===ft)&&(!fc||t.category===fc)).map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 if($("customerList")&&pageActive("customers"))renderCustomers();
 if($("peopleList")&&pageActive("people"))$("peopleList").innerHTML=data.people.filter(p=>(p.type||"debt")===peopleMode).map(p=>{const total=Number(p.amount)||0,paid=Math.min(Number(p.paid)||0,total),remaining=Math.max(0,total-paid);return `<div class="item"><div><b>${esc(p.name)}</b><div class="meta">${p.due?"سررسید: "+p.due:""}${p.note?" • "+esc(p.note):""}</div><div class="meta">کل: ${money(total)} • تسویه: ${money(paid)}</div></div><div><strong>${money(remaining)}</strong><div class="actions"><button type="button" onclick="payPerson('${p.id}')">تسویه</button>${actionButtons("openPerson","deletePerson",p.id)}</div></div></div>`}).join("")||empty(peopleMode==="debt"?"هنوز بدهکاری ثبت نشده":"هنوز طلبی ثبت نشده");
 if($("reminderList")&&pageActive("reminders")){const normalReminders=data.reminders.filter(r=>!r.sourceNoteId).sort((a,b)=>(a.order??0)-(b.order??0)); const noteAlarms=data.reminders.filter(r=>r.sourceNoteId); const normal=normalReminders.map((r,i)=>{const accId="rem-"+r.id;const isOpen=openAccordions.has(accId);return `<div class="item accordion-card${isOpen?' open':''}" data-acc-id="${accId}"><button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span>🔔 <b>${esc(r.title)}</b></span><span>⌄</span></button><div class="accordion-body"><div class="meta">${jalaliLabel(r.date)} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div><div class="accordion-actions"><strong>${r.amount?money(r.amount):""}</strong><div class="reorder-btns"><button type="button" title="انتقال به بالا" ${i===0?"disabled":""} onclick="event.stopPropagation();moveReminder('${r.id}',-1)">▲</button><button type="button" title="انتقال به پایین" ${i===normalReminders.length-1?"disabled":""} onclick="event.stopPropagation();moveReminder('${r.id}',1)">▼</button></div>${actionButtons("openReminder","deleteReminder",r.id)}</div></div></div>`}).join(""); $("reminderList").innerHTML=`<div class="section-label">🔔 یادآوری‌های مستقل</div>${normal||empty("یادآوری مستقلی ندارید")}${noteAlarms.length?`<div class="section-label">📝⏰ آلارم یادداشت‌ها</div>`+noteAlarms.map(r=>{const accId="remnote-"+r.id;const isOpen=openAccordions.has(accId);return `<div class="item accordion-card${isOpen?' open':''}" data-acc-id="${accId}"><button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span>📝 <b>${esc(r.title)}</b></span><span>⌄</span></button><div class="accordion-body"><div class="meta">${jalaliLabel(r.date)} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div></div></div>`}).join(""):``}`;}
 if($("noteList")&&pageActive("notes")){const sortedNotes=[...data.notes].sort((a,b)=>(a.order??0)-(b.order??0));$("noteList").innerHTML=sortedNotes.map((n,i)=>noteHTML(n,{i,total:sortedNotes.length})).join("")||empty("یادداشتی ندارید");}
 if($("invoiceList")&&pageActive("invoices"))$("invoiceList").innerHTML=data.invoices.map(invoiceHTML).join("")||empty("هنوز فاکتوری ساخته نشده است");
 if($("checkList")&&pageActive("checks"))$("checkList").innerHTML=data.checks.map(c=>`<div class="item"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${jalaliLabel(c.date)}${c.bank?" • "+esc(c.bank):""}</div></div><div><strong>${money(c.amount)}</strong>${actionButtons("openCheck","deleteCheck",c.id)}</div></div>`).join("")||empty("چکی ثبت نشده");
 if($("categoryList")&&pageActive("categories")){const catLine=c=>esc(c.name)+((c.children||[]).length?" ("+c.children.map(ch=>esc(ch.name)).join("، ")+")":"");$("categoryList").innerHTML='<div class="card"><b>هزینه‌ها</b><p>'+data.expenseCats.map(catLine).join(" • ")+'</p><b>دریافت‌ها</b><p>'+data.incomeCats.map(catLine).join(" • ")+'</p></div>';}
 if(pageActive("reports")){
   const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+((Number(p.amount)||0)-(Number(p.paid)||0)),0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+((Number(p.amount)||0)-(Number(p.paid)||0)),0);
   if($("totalDebt"))$("totalDebt").textContent=money(debt);if($("totalCredit"))$("totalCredit").textContent=money(credit);
   if($("reportStats")){const now=new Date(),m=now.getMonth(),y=now.getFullYear();const mt=data.transactions.filter(t=>{const d=new Date(t.date);return !isNaN(d)&&d.getMonth()===m&&d.getFullYear()===y});const mi=mt.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0),me=mt.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);const cats={};mt.filter(t=>t.type==="expense").forEach(t=>cats[t.category||"سایر"]=(cats[t.category||"سایر"]||0)+Number(t.amount||0));const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);$("reportStats").innerHTML=`<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>${fa(data.transactions.length)}</b></div><div class="card"><span>تعداد چک</span><b>${fa(data.checks.length)}</b></div><div class="card"><span>درآمد این ماه</span><b class="income">${money(mi)}</b></div><div class="card"><span>هزینه این ماه</span><b class="expense">${money(me)}</b></div></div><div class="card report-card"><h3>📊 بیشترین دسته‌های هزینه این ماه</h3>${top.map((x,i)=>`<div class="report-row"><span>${fa(i+1)}. ${esc(x[0])}</span><strong>${money(x[1])}</strong></div>`).join("")||`<p class="hint">هنوز هزینه‌ای در این ماه ثبت نشده.</p>`}</div><div class="card report-card"><h3>🏦 مانده حساب‌ها</h3>${data.accounts.map(a=>`<div class="report-row"><span>${esc(a.name)}</span><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||`<p class="hint">حسابی ثبت نشده.</p>`}</div>`;}
   drawChart(inc,exp);renderAudit();renderAdvancedReport();
 }
 renderYearSettlement();renderDueSoon();if($("settings" )?.classList.contains("active"))renderBrandingInSettings()}
const renderDebounced=debounce(render,120);
function renderAdvancedReport(){
 const box=$("advancedReport"); if(!box)return;
 const type=$("reportType")?.value||"all", account=$("reportAccount")?.value||"", from=$("reportFrom")?.value||"", to=$("reportTo")?.value||"";
 let rows=data.transactions.filter(t=>t.type!=="transfer" || type==="transfer");
 if(type!=="all" && type!=="transfer") rows=rows.filter(t=>t.type===type);
 if(account) rows=rows.filter(t=>t.accountID===account || t.from===account || t.to===account);
 const fiISO=from?jalaliToISO(from):"", tiISO=to?jalaliToISO(to):"";
 if(fiISO)rows=rows.filter(t=>String(t.date||"")>=fiISO); if(tiISO)rows=rows.filter(t=>String(t.date||"")<=tiISO+"T23:59:59");
 const income=rows.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0), expense=rows.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
 box.innerHTML=`<div class="report-summary"><div><span>دریافتی</span><b class="income">${money(income)}</b></div><div><span>هزینه</span><b class="expense">${money(expense)}</b></div><div><span>خالص</span><b>${money(income-expense)}</b></div></div><div class="report-table">${rows.slice(0,100).map(t=>`<div class="report-row"><span>${esc(t.title||"تراکنش")}<small>${jalaliDateTimeInput(t.date)} • ${esc(t.category||"")}</small></span><strong class="${t.type}">${t.type==="income"?"+":"−"}${money(t.amount)}</strong></div>`).join("")||`<p class="hint">موردی با این فیلتر پیدا نشد.</p>`}</div>`;
}
function drawChart(inc,exp){const c=$("chart");if(!c)return;const x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);const max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{const bh=v[0]/max*170;x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#374151";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
function exportData(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabdar-backup.json";a.click();logEvent("پشتیبان‌گیری","فایل JSON صادر شد","settings")}
function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{data=JSON.parse(r.result);normalizeData();await migratePinSecurity();data.audit??=[];data.notes??=[];save();logEvent("بازیابی اطلاعات","پشتیبان وارد شد","settings");showLock();alert("بازیابی شد")}catch{alert("فایل نامعتبر است")}};r.readAsText(file)}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){const pin=data.pin,pinHash=data.pinHash,pinSalt=data.pinSalt;data=blankData();data.pin=pin;data.pinHash=pinHash;data.pinSalt=pinSalt;save();logEvent("پاک کردن اطلاعات","اطلاعات برنامه پاک شد","delete");}}
(async function initApp(){normalizeData();await migratePinSecurity();showLock();render();applyDashboardConfig();renderBrandingInSettings();renderSettingsFeatures();createAutoBackup("اجرای برنامه");logEvent("اجرای برنامه","برنامه حسابدار اجرا شد","system");await initSync();if(!sync.auth){[4000,12000,30000].forEach(ms=>setTimeout(()=>{if(!sync.auth)initSync()},ms))}syncAllNotesToReminders().catch(console.error);rescheduleAllNativeReminders().catch(console.error);startUpdateChecker();startReminderChecker();})();

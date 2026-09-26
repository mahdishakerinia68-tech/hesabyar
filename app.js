const KEY="hesabdar-v35";
const LEGACY_KEYS=["hesabdar-v40","hesabdar-v20","hesabdar-v11"];
const SYNC_KEY="hesabdar-firebase-config-v1";
const APP_VERSION="pro1.4.1";
const AUTO_BACKUP_ENABLED_KEY="hesabdar-auto-backup-enabled-v2";
const AUTO_BACKUP_MS=6*60*60*1000;
const APP_MODE_KEY="hesabdar-app-mode-v1";
function appMode(){return localStorage.getItem(APP_MODE_KEY)||"business"}
/* --- رمز ادمین قفل حالت فروشگاه (v2.5) ---
 * جدا از رمز ورود به برنامه (PIN/الگو) نگه‌داری می‌شود و در localStorage
 * (نه data./پشتیبان) ذخیره می‌شود تا داخل فایل پشتیبان یا همگام‌سازی ابری
 * قرار نگیرد. فقط برای خروج از حالت «فروشگاه» لازم است. */
const ADMIN_PASS_KEY="hesabdar-admin-pass-v1";
function getAdminPass(){try{return JSON.parse(localStorage.getItem(ADMIN_PASS_KEY)||"null")}catch(e){return null}}
function hasAdminPass(){const a=getAdminPass();return !!(a&&a.hash&&a.salt)}
async function verifyAdminPass(pass){const a=getAdminPass();if(!a)return false;const x=await hashPin(pass,a.salt);return x.hash===a.hash}
async function setAdminPassValue(pass){const x=await hashPin(pass);localStorage.setItem(ADMIN_PASS_KEY,JSON.stringify({hash:x.hash,salt:x.salt}))}
async function promptSetAdminPass(){
 const p=prompt("برای ورود به حالت فروشگاه، یک رمز ادمین تعیین کن (حداقل ۴ کاراکتر). فقط با همین رمز می‌شود از حالت فروشگاه خارج شد:");
 if(p==null)return false;
 if(p.trim().length<4){alert("رمز ادمین تعیین نشد؛ حداقل ۴ کاراکتر لازم است.");return false}
 const p2=prompt("رمز ادمین را دوباره وارد کن:");
 if(p2!==p){alert("رمزها یکسان نبودند؛ دوباره تلاش کن.");return false}
 await setAdminPassValue(p.trim());
 alert("رمز ادمین ذخیره شد.");
 return true
}
async function promptVerifyAdminPass(){
 if(!hasAdminPass())return true;
 const p=prompt("برای خروج از حالت فروشگاه، رمز ادمین را وارد کن:");
 if(p==null)return false;
 const ok=await verifyAdminPass(p);
 if(!ok)alert("رمز ادمین اشتباه است.");
 return ok
}
function changeAdminPass(){
 (async()=>{
  if(hasAdminPass()){
   const old=prompt("رمز ادمین فعلی را وارد کن:");
   if(old==null)return;
   if(!(await verifyAdminPass(old))){alert("رمز فعلی اشتباه است.");return}
  }
  const p=prompt("رمز ادمین جدید (حداقل ۴ کاراکتر):");
  if(p==null)return;
  if(p.trim().length<4)return alert("رمز جدید نامعتبر است؛ حداقل ۴ کاراکتر لازم است.");
  const p2=prompt("رمز جدید را دوباره وارد کن:");
  if(p2!==p)return alert("رمزها یکسان نبودند.");
  await setAdminPassValue(p.trim());
  alert("رمز ادمین با موفقیت تغییر کرد.");
  logEvent("تغییر رمز ادمین","رمز ادمین حالت فروشگاه تغییر کرد","settings");
 })();
}
/* v2.3: added "store" as a third app mode (in addition to "personal"/"business").
   v2.5: "store" is now a locked-down kiosk mode — nothing but the invoice
   box is reachable from it. Entering it for the first time requires setting
   an admin password; leaving it (to personal or business) always requires
   that same admin password, so a random employee can't switch out of it.
   v3.1: "store" now also allows reaching «کالا و انبار» (products) from
   inside the kiosk — not just the invoice box — via the hamburger menu
   (kept visible in store mode, with every other menu item still hidden).
   v3.10: «مشتری‌ها» و «چک‌ها» هم به همین لیست اضافه شدند — یک فروشنده در
   کیوسک باید بتواند پرونده مشتری و چک‌های دریافتی/پرداختی را هم ببیند،
   بدون دسترسی به بقیه‌ی برنامه (حساب‌ها، تراکنش‌ها، گزارش‌ها، تنظیمات). */
const LOCKED_MODES=["store"];
const STORE_ALLOWED_PAGES=["invoices","products","customers","checks"];
async function setAppMode(v){
 const cur=appMode();
 if(cur===v)return;
 if(LOCKED_MODES.includes(v)&&!hasAdminPass()){
  const created=await promptSetAdminPass();
  if(!created)return;
 }
 if(LOCKED_MODES.includes(cur)&&!LOCKED_MODES.includes(v)){
  const ok=await promptVerifyAdminPass();
  if(!ok)return;
 }
 localStorage.setItem(APP_MODE_KEY,v);applyAppMode();
 if(v==="personal"&&(pageActive("products")||pageActive("customers")||pageActive("invoices")))goToPage("home");
 if(v==="store")goToPage("invoices");
 if(cur==="store"&&v!=="store")goToPage("home");
}
function applyAppMode(){
  const m=appMode();
  document.body.classList.toggle("personal-mode",m==="personal");
  document.body.classList.toggle("store-mode",m==="store");
  const bp=$("appModeBtnPersonal"),bb=$("appModeBtnBusiness"),bs=$("appModeBtnStore");
  if(bp)bp.classList.toggle("primary",m==="personal");
  if(bb)bb.classList.toggle("primary",m==="business");
  if(bs)bs.classList.toggle("primary",m==="store");
  if(m==="store"&&!STORE_ALLOWED_PAGES.some(pageActive))goToPage("invoices");
}
/* v3.4: «حالت اپ» از تنظیمات (که خیلی شلوغ شده بود) درآمد و شد یک دکمه
 * کنار دارک‌مود/تغییر زبان در نوار بالا؛ همان محتوای قبلی، فقط داخل یک
 * شیت کوچک به‌جای بخشی از صفحه تنظیمات. */
function openAppModeSheet(){
  openModal(`<h2>🧑‍💼 حالت اپ</h2><p class="hint">«شخصی»: بخش‌های محصولات، مشتری‌ها و فاکتور مخفی می‌شوند. «کسب‌وکاری»: همه بخش‌ها فعال است. «فروشگاه»: یک حالت قفل‌شده (کیوسک) است که فقط «صندوق فاکتور»، «کالا و انبار»، «مشتری‌ها» و «چک‌ها» در آن در دسترس‌اند (از طریق منو) و بقیه‌ی برنامه (حساب‌ها، تراکنش‌ها، گزارش‌ها، تنظیمات و...) کاملاً مخفی می‌شود. بار اول ورود به این حالت یک رمز ادمین تعیین می‌شود؛ برای خروج از حالت فروشگاه (رفتن به حالت کسب‌وکار) همیشه همان رمز ادمین لازم است. تغییر رمز ادمین هم از همینجا ممکن است. اطلاعات هیچ بخشی پاک نمی‌شود و هر وقت خواستی می‌تونی برگردونیشون.</p>
  <div class="settings-actions">
    <button id="appModeBtnPersonal" onclick="setAppMode('personal')">👤 شخصی</button>
    <button id="appModeBtnBusiness" onclick="setAppMode('business')">🏪 کسب‌وکاری</button>
    <button id="appModeBtnStore" onclick="setAppMode('store')">🏬 فروشگاه</button>
  </div>
  <div class="settings-actions">
    <button onclick="changeAdminPass()">🔑 تغییر رمز ادمین فروشگاه</button>
  </div>`);
  applyAppMode();
}
const DEVICE_ID_KEY="hesabdar-device-id-v1";
const DEVICE_PRESENCE_MS=45*1000;
const DEVICE_PRESENCE_INTERVAL=20*1000;
const SYNC_INTERVAL=5000;
// Firebase project configuration supplied for this app.
// This is safe to ship in a web app; access is protected by Firebase Authentication + Firestore Rules.
const DEFAULT_SYNC_CONFIG={
  // Firebase API keys are intentionally not committed to the repository.
  // Existing users keep their locally stored sync configuration.
  apiKey:"",
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
/* pro2: پشتیبان واقعیِ خودکار نمی‌تواند بدون رمز کاربر ساخته شود (بکاپ‌ها رمزنگاری‌شده‌اند)،
 * پس این گزینه اکنون «یادآوری پشتیبان‌گیری» است و هیچ ادعای ساخت فایل خودکار ندارد. */
const LAST_BACKUP_KEY="hesabdar-last-backup-at-v1";
const BACKUP_REMIND_DAYS=7;
function getAutoBackupInfo(){try{const v=localStorage.getItem(LAST_BACKUP_KEY);if(!v)return null;const d=new Date(v);return isNaN(d.getTime())?null:d}catch(e){return null}}
function markBackupDone(){try{localStorage.setItem(LAST_BACKUP_KEY,new Date().toISOString())}catch(e){}renderSettingsFeatures()}
function setAutoBackupEnabled(v){localStorage.setItem(AUTO_BACKUP_ENABLED_KEY,v?"true":"false");logEvent(v?"یادآوری پشتیبان‌گیری فعال شد":"یادآوری پشتیبان‌گیری غیرفعال شد",v?"اگر بیش از ۷ روز پشتیبان نگیری، هنگام اجرای برنامه یادآوری می‌شود":"یادآوری پشتیبان‌گیری خاموش شد","settings",false);renderSettingsFeatures()}
/* ---- Real file auto-backup -----------------------------------------
 * On a Capacitor build (native app), this writes an actual .json file
 * into a "حسابداری" folder inside the device's shared Downloads folder
 * (visible from any file manager, not just inside the app), using the
 * Filesystem plugin, and prunes old files so only the last 5 remain. In
 * a plain browser/PWA where that native plugin isn't available, it falls
 * back to triggering a normal file download of the same backup onto the
 * phone (browsers always place downloads in the device's Downloads
 * folder by default, though a sub-folder can't be forced from the web).
 * The localStorage snapshot list is kept too, as a fast, always-available
 * safety net for the in-app "restore last backup" button. ---- */
const AUTO_BACKUP_DIRECTORY="ExternalStorage";
const AUTO_BACKUP_FOLDER="Download/حسابداری";
function backupFileName(){
 const d=new Date(),p=n=>String(n).padStart(2,"0");
 return `hesabdar-backup-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}
async function pruneOldBackupFiles(fs){
 try{
  const res=await fs.readdir({path:AUTO_BACKUP_FOLDER,directory:AUTO_BACKUP_DIRECTORY});
  const files=(res?.files||[]).map(f=>typeof f==="string"?f:f?.name).filter(n=>n&&n.endsWith(".json")).sort();
  while(files.length>5){const old=files.shift();try{await fs.deleteFile({path:`${AUTO_BACKUP_FOLDER}/${old}`,directory:AUTO_BACKUP_DIRECTORY})}catch(e){}}
 }catch(e){/* folder may not exist yet on first run - nothing to prune */}
}
/* Only try the native Filesystem plugin when we're actually on a Capacitor
 * native build AND that plugin is really registered on the native side.
 * Without this check, calling it on a build that only has the JS bridge
 * (no @capacitor/filesystem installed natively) throws on every attempt —
 * which is exactly the error the user hit on every app launch. */
function filesystemPlugin(){
 try{
  const C=window.Capacitor;
  if(!C||typeof C.isNativePlatform!=="function"||!C.isNativePlatform())return null;
  if(typeof C.isPluginAvailable==="function"&&!C.isPluginAvailable("Filesystem"))return null;
  const fs=C.Plugins?.Filesystem;
  if(!fs||typeof fs.writeFile!=="function")return null;
  return fs;
 }catch(e){return null}
}
async function writeAutoBackupFile(payload){
 const json=JSON.stringify(payload,null,2),filename=backupFileName();
 const fs=filesystemPlugin();
 if(fs){
  try{
   await fs.writeFile({path:`${AUTO_BACKUP_FOLDER}/${filename}`,data:json,directory:AUTO_BACKUP_DIRECTORY,encoding:"utf8",recursive:true});
   pruneOldBackupFiles(fs).catch(()=>{});
   return {ok:true,method:"filesystem",filename,where:"Download/حسابداری"};
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
/* یادآوری پشتیبان‌گیری: فقط هنگام اجرای برنامه و فقط اگر داده‌ی واقعی وجود دارد. */
let _backupRemindShown=false;
function maybeBackupReminder(){
 if(_backupRemindShown||!autoBackupEnabled()||!hasUserRecords(data))return false;
 const last=getAutoBackupInfo();
 if(last&&Date.now()-last.getTime()<BACKUP_REMIND_DAYS*24*60*60*1000)return false;
 _backupRemindShown=true;
 setTimeout(()=>{try{alert(last?"⚠️ بیش از ۷ روز از آخرین پشتیبان‌گیری گذشته است. از «تنظیمات ← پشتیبان‌گیری دستی» یک پشتیبان رمزنگاری‌شده بگیر.":"⚠️ هنوز از اطلاعات پشتیبان نگرفته‌ای. از «تنظیمات ← پشتیبان‌گیری دستی» یک پشتیبان رمزنگاری‌شده بگیر.")}catch(e){}},1500);
 return true;
}
function normalizeData(){data=data||blankData(); data.schemaVersion=Number(data.schemaVersion)||1; for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit","trash"]){data[k]??=[];} data.pin=""; data.pinHash=typeof data.pinHash==="string"?data.pinHash:""; data.pinSalt=typeof data.pinSalt==="string"?data.pinSalt:""; data.patternHash=typeof data.patternHash==="string"?data.patternHash:""; data.patternSalt=typeof data.patternSalt==="string"?data.patternSalt:""; data.lockMethod=(data.lockMethod==="pattern")?"pattern":"pin"; data.biometricEnabled=!!data.biometricEnabled; data.webauthnCredId=typeof data.webauthnCredId==="string"?data.webauthnCredId:""; data.lang=(data.lang==="en")?"en":"fa"; data.branding??={storeName:"",logo:"",stamp:"",signature:""}; data.yearSettlements??={}; data._sync??={tombstones:{}}; data._sync.tombstones??={}; data._sync.tombstoneRevisions??={}; for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString();}} for(const c of [...data.expenseCats,...data.incomeCats]){c.children??=[];for(const ch of c.children){ch.id??=uid();}} data.notes.forEach((n,i)=>{if(typeof n.order!=="number")n.order=i;}); data.reminders.forEach((r,i)=>{if(typeof r.order!=="number")r.order=i;});}
/* ---- Language switch (v5.9) -------------------------------------------
 * Translates the app's static "chrome" — menu, page section headers, and
 * settings group titles — between Persian and English, and switches
 * number digits (fa()) and the money unit accordingly. Screens, forms and
 * alerts you type your own data into (transaction titles, notes, etc.)
 * stay exactly as you typed them, in whichever language that was. ---- */
const I18N_EN={
 "page.home":"Home","page.recent":"Recent Transactions","page.accounts":"Accounts & Banks","page.transfer":"Transfer Between Accounts","page.bankMsg":"Bank SMS","page.transactions":"Transactions","page.products":"📦 Products & Inventory","page.customers":"👥 Customers","page.people":"Debts / Credits","page.reminders":"Reminders","page.notes":"📝 Notes","page.checks":"Checks","page.categories":"Expense Categories","page.reports":"Dashboard & Reports","page.audit":"📋 Activity Log","page.invoices":"📦 Invoice Box","page.settings":"Settings",
 "menu.title":"Menu","menu.main":"Main","menu.finance":"Finance","menu.notesGroup":"Notes & Reminders","menu.other":"Other",
 "nav.home":"Home","nav.transactions":"Transactions","nav.invoices":"Invoices","nav.reports":"Reports","nav.accounts":"Accounts","nav.people":"Debts/Credits","nav.customers":"Customers","nav.products":"Products","nav.checks":"Checks","nav.reminders":"Reminders","nav.notes":"Notes","nav.categories":"Categories","nav.settings":"Settings",
 "stg.branding.title":"Store & Invoice Branding","stg.year.title":"Fiscal Year","stg.notif.title":"Notifications","stg.backup.title":"Backup Reminder","stg.github.title":"Update from GitHub","stg.manualBackup.title":"Manual Backup","stg.sync.title":"Two-Device Sync","stg.security.title":"Login Security","stg.lang.title":"App Language","stg.lang.hint":"The menu, page titles and settings section will be shown in this language."
};
function applyLanguage(){
 const lang=data.lang==="en"?"en":"fa";
 document.documentElement.lang=lang==="en"?"en":"fa";
 document.documentElement.dir=lang==="en"?"ltr":"rtl";
 document.querySelectorAll("[data-i18n]").forEach(el=>{
  if(!el.dataset.i18nOrig)el.dataset.i18nOrig=el.textContent;
  const key=el.getAttribute("data-i18n");
  el.textContent=lang==="en"?(I18N_EN[key]||el.dataset.i18nOrig):el.dataset.i18nOrig;
 });
 const lt=$("langToggle");
 if(lt){lt.textContent=lang==="en"?"فا":"EN";lt.setAttribute("aria-label",lang==="en"?"تغییر زبان به فارسی":"Switch language to English")}
 render();
}
function setAppLanguage(lang){
 data.lang=lang==="en"?"en":"fa"; save();
 logEvent(lang==="en"?"Language switched to English":"زبان برنامه به فارسی تغییر کرد","","settings");
 applyLanguage();
}
function toggleAppLanguage(){setAppLanguage(data.lang==="en"?"fa":"en")}

/* ---- v3.12: تم رنگی قابل انتخاب ----
 * چون رنگ اصلی برنامه در تمام صفحه از متغیر CSS به‌نام --blue خوانده
 * می‌شود (دکمه‌های اصلی، تب فعال، لینک‌ها...)، برای تغییر تم فقط کافیست
 * همین یک متغیر روی body با data-accent بازنویسی شود — نیازی به تغییر
 * چیز دیگری در کل برنامه نیست. مقدار انتخابی در localStorage می‌ماند و
 * هم روی حالت روشن هم تاریک، رنگ مناسب همان حالت اعمال می‌شود. */
const ACCENT_THEME_KEY="hesabdar-accent";
const ACCENT_THEMES=[
 {id:"turquoise",label:"فیروزه‌ای (پیش‌فرض)",swatch:"#0F9B8E"},
 {id:"blue",label:"آبی",swatch:"#2563EB"},
 {id:"purple",label:"بنفش",swatch:"#7C3AED"},
 {id:"rose",label:"صورتی",swatch:"#DB2777"},
 {id:"amber",label:"کهربایی",swatch:"#B45309"},
 {id:"emerald",label:"زمردی",swatch:"#059669"},
 {id:"indigo",label:"نیلی",swatch:"#4338CA"},
 {id:"crimson",label:"زرشکی",swatch:"#B91C1C"},
 {id:"gold",label:"طلایی",swatch:"#A16207"},
];
function currentAccentTheme(){return localStorage.getItem(ACCENT_THEME_KEY)||"turquoise"}
function applyAccentThemeOnLoad(){const id=currentAccentTheme();if(id&&id!=="turquoise")document.body.setAttribute("data-accent",id);else document.body.removeAttribute("data-accent")}
function applyAccentTheme(id){
 localStorage.setItem(ACCENT_THEME_KEY,id);
 applyAccentThemeOnLoad();
 renderColorThemeSwatches();
}
function renderColorThemeSwatches(){
 const box=$("colorThemeSwatches");if(!box)return;
 const cur=currentAccentTheme();
 box.innerHTML=ACCENT_THEMES.map(t=>`<button type="button" class="theme-swatch-btn${cur===t.id?" active":""}" style="--swatch:${t.swatch}" onclick="applyAccentTheme('${t.id}')"><span class="theme-swatch-dot"></span><span>${t.label}</span></button>`).join("");
}
/* ---- v3.12: نشانگر قرمز کنار بخش‌های تنظیم‌نشده ----
 * دایره قرمز کوچک کنار عنوان هر بخش تنظیمات که هنوز پیکربندی نشده است،
 * تا کاربر سریع بفهمد کجا کار باقی مانده — بدون باز کردن تک‌تک بخش‌ها. */
function notificationsConfigured(){try{return !("Notification" in window)||Notification.permission==="granted"}catch(e){return true}}
function updateSettingsDots(){
 const set=(id,unset)=>{const el=$(id);if(el)el.classList.toggle("show",!!unset)};
 set("dotSecurity",!hasLockCode());
 set("dotBackup",!autoBackupEnabled());
 set("dotNotif",!notificationsConfigured());
 set("dotSync",!sync?.user);
 set("dotBranding",!(data.branding?.storeName||data.branding?.logo));
}
function renderSettingsFeatures(){const e=$("autoBackupToggle");if(e)e.checked=autoBackupEnabled(); const last=$("autoBackupLast"); if(last){const d=getAutoBackupInfo();last.textContent=d?"آخرین پشتیبان: "+d.toLocaleString("fa-IR"):"هنوز پشتیبان‌گیری نکرده‌ای";} const v=$("appVersionText");if(v)v.textContent=APP_VERSION; const vp=$("versionPill");if(vp)vp.textContent=APP_VERSION;updateSettingsDots();renderColorThemeSwatches();
 const bio=$("biometricToggle");if(bio)bio.checked=!!data.biometricEnabled;
 const mh=$("securityMethodHint");if(mh)mh.textContent=hasLockCode()?("روش فعلی: "+(data.lockMethod==="pattern"?"رمز الگو":"رمز عددی")+(data.biometricEnabled?" + بیومتریک":"")):"هنوز رمزی برای ورود تنظیم نشده.";
 const lt=$("langToggle");if(lt){lt.textContent=data.lang==="en"?"فا":"EN";lt.setAttribute("aria-label",data.lang==="en"?"تغییر زبان به فارسی":"Switch language to English")}
 applyAppMode();
}
function setSyncStatus(t){const e=$("syncStatus");if(e)e.textContent=t||"";const b=$("syncBadge");if(!b)return;const s=String(t||"");let cls="offline",label="☁️ آفلاین";if(s.includes("آنلاین")||s.includes("انجام شد")||s.includes("متصل است")){cls="online";label="☁️ متصل"}else if(s.includes("⚠️")||s.includes("ناموفق")){cls="error";label="⚠️ خطای اتصال"}else if(s.includes("در حال")||s.includes("بررسی")){cls="pending";label="☁️ در حال اتصال..."}else if(s.includes("وارد شوید")||s.includes("ابتدا")){cls="offline";label="☁️ واردنشده"}b.textContent=label;b.className="sync-badge "+cls}

const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
const $=id=>document.getElementById(id);
const fa=n=>{const num=Number(n)||0;return (typeof data!=="undefined"&&data?.lang==="en")?new Intl.NumberFormat("en-US").format(num):new Intl.NumberFormat("fa-IR").format(num)};
function debounce(fn,ms=150){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
const money=n=>fa(n)+((typeof data!=="undefined"&&data?.lang==="en")?" Toman":" تومان");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
// Jalali date helpers (UI uses Persian dates; storage remains ISO/Gregorian for compatibility).
function div(a,b){return Math.floor(a/b)}
function gregorianToJalali(gy,gm,gd){let gdm=[0,31,59,90,120,151,181,212,243,273,304,334];let jy=gy<=1600?0:979;gy-=gy<=1600?621:1600;let gy2=gm>2?gy+1:gy;let days=365*gy+div(gy2+3,4)-div(gy2+99,100)+div(gy2+399,400)-80+gd+gdm[gm-1];jy+=33*div(days,12053);days%=12053;jy+=4*div(days,1461);days%=1461;if(days>365){jy+=div(days-1,365);days=(days-1)%365}let jm=days<186?1+div(days,31):7+div(days-186,30);let jd=1+(days<186?days%31:(days-186)%30);return [jy,jm,jd]}
function jalaliToGregorian(jy,jm,jd){jy+=1595;let days=-355668+(365*jy)+(div(jy,33)*8)+div(((jy%33)+3),4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);let gy=400*div(days,146097);days%=146097;if(days>36524){gy+=100*div(--days,36524);days%=36524;if(days>=365)days++}gy+=4*div(days,1461);days%=1461;if(days>365){gy+=div(days-1,365);days=(days-1)%365}let gd=days+1;let sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];let gm;for(gm=1;gm<=12;gm++){const v=sal_a[gm];if(gd<=v)break;gd-=v}return [gy,gm,gd]}
function padFa(n){return String(n).padStart(2,'0').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
function toFaDigits(s){return String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
/* v1.2.7: کیبورد فارسی/عربی روی گوشی‌ها معمولاً ارقام ۰-۹ (فارسی) یا ٠-٩ (عربی) را
 * می‌فرستد، نه ارقام انگلیسی. قبلاً فقط ارقام فارسی تبدیل می‌شدند و فیلدهای عددی/مبلغی
 * با کیبورد فارسی/عربی عملاً کار نمی‌کردند (ورودی خالی می‌ماند یا صفر ذخیره می‌شد).
 * حالا هر دو دسته رقم پشتیبانی می‌شوند. */
function toEnDigits(s){return String(s).replace(/[۰-۹٠-٩]/g,d=>{const fa='۰۱۲۳۴۵۶۷۸۹'.indexOf(d);if(fa!==-1)return String(fa);return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))})}
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
function localDateFromInput(v){if(!v)return null;const raw=String(v);const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);const d=m?new Date(+m[1],+m[2]-1,+m[3],12,0,0,0):new Date(v);return Number.isNaN(d.getTime())?null:d}
function timeFa(v){const d=localDateFromInput(v);if(!d)return '';return `${toFaDigits(String(d.getHours()).padStart(2,'0'))}:${toFaDigits(String(d.getMinutes()).padStart(2,'0'))}`}
function addMonthsSafe(d,n){const out=new Date(d.getTime()),day=out.getDate();out.setDate(1);out.setMonth(out.getMonth()+n);const last=new Date(out.getFullYear(),out.getMonth()+1,0).getDate();out.setDate(Math.min(day,last));return out}
function nextReminderDate(r,now=new Date()){let d=localDateFromInput(r?.date);if(!d)return null;const rep=r.repeat||"once";if(rep==="once")return d>now?d:null;let guard=0;while(d<=now&&guard++<500){if(rep==="daily")d=new Date(d.getTime()+86400000);else if(rep==="weekly")d=new Date(d.getTime()+7*86400000);else if(rep==="monthly")d=addMonthsSafe(d,1);else return null}return d>now?d:null}
async function cancelNativeReminder(id){const p=getNativeLocalNotifications();if(!p)return;try{await p.cancel({notifications:[{id:notificationIdForReminder(id)}]})}catch(e){console.warn("cancel reminder",e)}}
function repeatSchedule(rep){if(rep==="daily")return {repeats:true,every:"day"};if(rep==="weekly")return {repeats:true,every:"week"};if(rep==="monthly")return {repeats:true,every:"month"};return {repeats:false}}
async function scheduleNativeReminder(r){const p=getNativeLocalNotifications();if(!p)return false;const at=nextReminderDate(r);if(!at)return false;try{await p.schedule({notifications:[{id:notificationIdForReminder(r.id),title:r.title||"یادآوری حسابدار",body:r.body||"زمان یادآوری فرا رسیده است.",schedule:{at,...repeatSchedule(r.repeat||"once")},extra:{reminderId:r.id,sourceNoteId:r.sourceNoteId||null,sourcePersonId:r.sourcePersonId||null,sourceInstallmentId:r.sourceInstallmentId||null}}]});return true}catch(e){console.warn("schedule reminder",e);return false}}
function setupReminderNotificationActions(){const p=getNativeLocalNotifications();if(!p||typeof p.addListener!=="function")return;try{p.addListener("localNotificationActionPerformed",event=>{const id=event?.notification?.extra?.reminderId;const r=(data.reminders||[]).find(x=>x.id===id);if(r?.sourcePersonId)openPerson(r.sourcePersonId);else if(id)openReminder(id)})}catch(e){console.warn("notification action listener",e)}}
async function rescheduleAllNativeReminders(){if(!getNativeLocalNotifications())return;for(const r of data.reminders||[]){await cancelNativeReminder(r.id);await scheduleNativeReminder(r)}}
async function requestNativeNotifications(){const p=getNativeLocalNotifications();if(p){try{const perm=await p.requestPermissions();if(perm.display!=="granted")return false;if(typeof p.checkExactNotificationSetting==="function"){const exact=await p.checkExactNotificationSetting();if(exact.value!=="granted"&&typeof p.changeExactNotificationSetting==="function")try{await p.changeExactNotificationSetting()}catch(e){console.warn("exact notification setting",e)}}await rescheduleAllNativeReminders();return true}catch(e){console.warn("native notification permission",e);return false}}if("Notification"in window){try{return (await Notification.requestPermission())==="granted"}catch(e){}}return false}
function reminderBodyFromNote(note){const parts=[];if(note?.text)parts.push(note.text);const pending=(note?.items||[]).filter(x=>!x.done).map(x=>x.text).filter(Boolean);if(pending.length)parts.push(pending.join(" • "));return parts.join(" — ")||"یادآوری یادداشت"}
function removeRecordSilent(type,id){const i=data[type].findIndex(x=>x.id===id);if(i<0)return;data[type].splice(i,1);markDeleted(type,id)}
/* ---- v3.11: زباله‌دان ۳۰ روزه برای تراکنش/فاکتور/چک ----
 * حذف در این سه بخش برگشت‌ناپذیر بود؛ حالا رکورد حذف‌شده یک کپی کامل از
 * خودش را در data.trash می‌گذارد و به مدت TRASH_DAYS روز قابل بازگردانی
 * است. حذف‌های کناری (مثلاً تراکنشِ خودکارِ تسویه‌ی یک فاکتور که با خود آن
 * فاکتور حذف می‌شود) از این طریق نمی‌روند تا زباله‌دان شلوغ نشود — فقط
 * حذف مستقیمی که کاربر با دکمه 🗑 روی خودِ آیتم می‌زند وارد زباله‌دان
 * می‌شود. */
const TRASH_DAYS=30;
const TRASHABLE_TYPES=["transactions","invoices","checks"];
function trashLabel(type,record){
 if(type==="transactions")return record?.title||"تراکنش";
 if(type==="invoices")return record?.name||("فاکتور "+(record?.number||""));
 if(type==="checks")return `چک ${record?.type==="receive"?"دریافتی":"پرداختی"} ${record?.name||""}`;
 return record?.name||record?.title||"مورد حذف‌شده";
}
function pushToTrash(type,record){
 if(!TRASHABLE_TYPES.includes(type)||!record)return;
 data.trash??=[];
 data.trash.unshift({trashId:uid(),type,record:JSON.parse(JSON.stringify(record)),deletedAt:new Date().toISOString(),label:trashLabel(type,record)});
}
function removeRecordToTrash(type,id){
 const rec=data[type]?.find(x=>x.id===id);
 if(rec)pushToTrash(type,rec);
 removeRecord(type,id);
}
function purgeOldTrash(){
 data.trash??=[];
 const cutoff=Date.now()-TRASH_DAYS*86400000;
 const before=data.trash.length;
 data.trash=data.trash.filter(t=>new Date(t.deletedAt).getTime()>=cutoff);
 if(data.trash.length!==before)persistLocal();
}
function trashDaysLeft(t){const passed=(Date.now()-new Date(t.deletedAt).getTime())/86400000;return Math.max(0,Math.ceil(TRASH_DAYS-passed))}
function restoreFromTrash(trashId){
 const i=data.trash.findIndex(t=>t.trashId===trashId);if(i<0)return;
 const t=data.trash[i];
 const rec=t.record;
 data[t.type]??=[];
 if(!data[t.type].some(x=>x.id===rec.id)){
  data[t.type].push(rec);
  if(t.type==="invoices"){adjustStockForInvoice(rec,-1);syncTransactionForInvoice(rec);syncPersonForInvoice(rec);}
  if(data._sync?.tombstones?.[t.type])delete data._sync.tombstones[t.type][rec.id];
  touch(rec);markDirty(t.type,rec.id,false,rec,rec.updatedAt);
 }
 data.trash.splice(i,1);
 save();
 logEvent("بازگردانی از زباله‌دان",t.label,"create");
 if(t.type==="checks")upsertReminderForCheck(rec).catch(console.error);
 if(pageActive("trash"))renderTrash();
}
function deleteFromTrashForever(trashId){
 if(!confirm("این مورد برای همیشه پاک شود؟ دیگر قابل بازگردانی نیست."))return;
 const i=data.trash.findIndex(t=>t.trashId===trashId);if(i<0)return;
 data.trash.splice(i,1);
 persistLocal();syncSave();
 if(pageActive("trash"))renderTrash();
}
function emptyTrashNow(){
 if(!data.trash?.length)return;
 if(!confirm(`${fa(data.trash.length)} مورد برای همیشه پاک شود؟ دیگر قابل بازگردانی نیست.`))return;
 data.trash=[];
 persistLocal();syncSave();
 if(pageActive("trash"))renderTrash();
}
function trashTypeIcon(type){return {transactions:"☷",invoices:"🧾",checks:"✓"}[type]||"🗑"}
function renderTrash(){
 const box=$("trashList");if(!box)return;
 purgeOldTrash();
 const empty1=$("trashEmptyBtn");if(empty1)empty1.style.display=data.trash?.length?"":"none";
 box.innerHTML=(data.trash||[]).map(t=>`<div class="item trash-row"><div><b>${trashTypeIcon(t.type)} ${esc(t.label)}</b><div class="meta">حذف‌شده: ${jalaliLabel(t.deletedAt)} • ${fa(trashDaysLeft(t))} روز تا حذف همیشگی</div></div><div class="actions"><button class="primary" onclick="restoreFromTrash('${t.trashId}')">↩️ بازگردانی</button><button onclick="deleteFromTrashForever('${t.trashId}')" class="danger-icon">🗑</button></div></div>`).join("")||empty("زباله‌دان خالی است");
}
async function upsertReminderForNote(note,renderAfter=true){if(!note?.id)return;const linked=(data.reminders||[]).filter(x=>x.sourceNoteId===note.id);let r=linked[0];for(const duplicate of linked.slice(1)){await cancelNativeReminder(duplicate.id);removeRecordSilent("reminders",duplicate.id)}if(!note.date){if(r){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);if(renderAfter)save();else{persistLocal();syncSave()}}return}const o={title:note.title||"یادداشت",amount:0,date:note.date,repeat:note.repeat&&note.repeat!=="none"?note.repeat:"once",type:"note",sourceNoteId:note.id,body:reminderBodyFromNote(note)};if(r){Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{r=touch({id:uid(),...o});data.reminders.push(r);markDirty("reminders",r.id,false,r,r.updatedAt)}if(renderAfter)save();else{persistLocal();syncSave()}await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}
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
      if(reg&&reg.showNotification){await reg.showNotification(title,{body,tag,icon:"logo.png",badge:"logo.png",dir:"rtl",lang:"fa",data:{reminderId:tag?String(tag).replace(/^reminder-/,""):null}});return true}
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

const blankData=()=>({accounts:[],transactions:[],people:[],reminders:[],notes:[],checks:[],invoices:[],customers:[],products:[],audit:[],trash:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name,children:[]})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name,children:[]})),pin:"",patternHash:"",patternSalt:"",lockMethod:"pin",biometricEnabled:false,webauthnCredId:"",lang:"fa",branding:{storeName:"",logo:"",stamp:"",signature:""},yearSettlements:{}});
window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
window.addEventListener("online",async()=>{if(sync.db)sync.db.enableNetwork().catch(console.error);setSyncStatus("🌐 اینترنت برقرار شد؛ در حال بررسی اتصال دو گوشی..."); if(!sync.auth)await initSync(); if(sync.dirty&&sync.dirty.size)syncSave(); await verifyTwoPhoneConnection(true);});
window.addEventListener("offline",()=>setSyncStatus("⚠️ اینترنت دستگاه قطع است"));

/* v1.2.8: زیرساخت migration نسخه‌به‌نسخه‌ی داده — غیرمخرب: قبل از هر
 * migration یک کپی اضطراری از داده خام نگه‌داشته می‌شود و در صورت خطا،
 * همان داده‌ی اصلی (بدون migration) برگردانده می‌شود، نه داده خالی.
 * فعلاً migration واقعی‌ای لازم نیست (این اولین نسخه‌ای‌ست که
 * schemaVersion دارد)؛ تابع‌های migrateVXToVY آینده اینجا اضافه می‌شوند. */
const CURRENT_SCHEMA_VERSION=4;
function migrateV1ToV2(d){d.attachments??=[];return d}
function migrateV2ToV3(d){d._sync??={tombstones:{}};d._sync.tombstones??={};return d}
function migrateV3ToV4(d){d._sync.tombstoneRevisions??={};return d}
function migrateData(input){
 let data;try{data=structuredClone(input||blankData())}catch(e){console.warn("data migration clone failed",e);return input}
 try{const version=Number(data.schemaVersion)||1;if(version<2)data=migrateV1ToV2(data);if(version<3)data=migrateV2ToV3(data);if(version<4)data=migrateV3ToV4(data);for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit","attachments","trash"])data[k]??=[];data.schemaVersion=CURRENT_SCHEMA_VERSION;return data}catch(e){console.warn("data migration failed; original preserved",e);return input}
}
let data;
let legacyLoaded=false,legacyCorrupt=false;
try{
  let raw=localStorage.getItem(KEY);
  if(!raw){
    for(const legacyKey of LEGACY_KEYS){
      const legacy=localStorage.getItem(legacyKey);
      if(legacy){
        raw=legacy;
        
        break;
      }
    }
  }
  if(raw){legacyLoaded=true;try{data=migrateData(JSON.parse(raw))}catch(parseErr){legacyCorrupt=true;data=null;console.error("legacy data unreadable; original copy is kept",parseErr)}}
}catch{data=null}
data=data||blankData();
normalizeData();
function ensureCashAccount(){
 data.accounts??=[];
 if(data.accounts.some(a=>String(a.name||"").trim()==="کیف پول نقدی"))return false;
 const cash=touch({id:uid(),name:"کیف پول نقدی",bank:"",sender:"",card:"",balance:0,default:true});
 data.accounts.unshift(cash);persistLocal();return true;
}
/* ensureCashAccount() از initApp صدا زده می‌شود (بعد از خواندن داده‌ی ذخیره‌شده). */
data.transactions??=[];data.people??=[];data.customers??=[];data.products??=[];data.reminders??=[];data.notes??=[];data.checks??=[];data.invoices??=[];data.audit??=[];data.trash??=[];data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name,children:[]}));data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name,children:[]}));data.pin="";data.pinHash=typeof data.pinHash==="string"?data.pinHash:"";data.pinSalt=typeof data.pinSalt==="string"?data.pinSalt:"";data.patternHash=typeof data.patternHash==="string"?data.patternHash:"";data.patternSalt=typeof data.patternSalt==="string"?data.patternSalt:"";data.lockMethod=(data.lockMethod==="pattern")?"pattern":"pin";data.biometricEnabled=!!data.biometricEnabled;data.webauthnCredId=typeof data.webauthnCredId==="string"?data.webauthnCredId:"";data.lang=(data.lang==="en")?"en":"fa";data.branding??={storeName:"",logo:"",stamp:"",signature:""};data.branding.storeName??="";data.branding.logo??="";data.branding.stamp??="";data.branding.signature??="";data.yearSettlements??={};data._sync??={tombstones:{}};data._sync.tombstones??={};for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){for(const r of data[k]){r.id??=uid();r.updatedAt??=new Date().toISOString()}}for(const c of [...data.expenseCats,...data.incomeCats]){c.children??=[];for(const ch of c.children){ch.id??=uid()}}
// Normalize older people records so saved debtors/creditors always render correctly.
for(const p of data.people){if(p.type==="debtor"||p.type==="debtors"||p.type==="بدهکار")p.type="debt";if(p.type==="creditor"||p.type==="creditors"||p.type==="طلبکار"||p.type==="بستانکار")p.type="credit";if(p.type!=="debt"&&p.type!=="credit")p.type="debt";p.amount=Number(p.amount)||0;p.paid=Number(p.paid)||0;p.name=String(p.name||"").trim()} 
// v3.10: older checks از قبل از اتصال چک به حساب — مقادیر پیش‌فرض بگیرند تا خطا ندهند.
for(const c of data.checks){c.settled=!!c.settled;c.accountID=typeof c.accountID==="string"?c.accountID:"";c.txId=c.txId||null}
let peopleMode="debt";
let notesMode="list";
let notesWeekOffset=0;
const AUDIT_LIMIT=1000;
/* v5.9 perf fix: logEvent() used to write the ENTIRE app data blob to
 * localStorage and trigger a full render()+syncSave() synchronously,
 * every single time it ran — and it ran on every page navigation
 * (goToPage), every save, every button tap that logs an action. As the
 * data grew (more transactions/audit entries) this JSON.stringify+render
 * pair got heavier and heavier, which is exactly what showed up as
 * "لag when switching pages". The audit entry itself still needs to be
 * persisted, but that persistence + the cloud sync it triggers are now
 * batched into one debounced flush shortly after the tap, instead of
 * blocking it — so the screen switches instantly and the bookkeeping
 * happens a moment later in the background. */
let _auditFlushTimer=null,_auditFlushSync=false;
function scheduleAuditFlush(doSync){
  _auditFlushSync=_auditFlushSync||!!doSync;
  if(_auditFlushTimer)return;
  _auditFlushTimer=setTimeout(()=>{
    _auditFlushTimer=null;
    try{persistLocal()}catch(e){console.warn("audit flush",e)}
    const s=_auditFlushSync;_auditFlushSync=false;
    if(s)syncSave();
  },300);
}
function logEvent(action,detail="",kind="info",doSync=true){
  const entry={id:uid(),at:new Date().toISOString(),action:String(action||"رویداد"),detail:String(detail||""),kind:String(kind||"info")};
  data.audit??=[]; data.audit.unshift(entry); if(data.audit.length>AUDIT_LIMIT)data.audit.length=AUDIT_LIMIT;
  markDirty("audit",entry.id,false,entry,entry.at);
  scheduleAuditFlush(doSync);
  if(pageActive("reports")&&$("auditList"))renderAudit();
}
function auditLabel(k){return ({create:"ایجاد",edit:"ویرایش",delete:"حذف",payment:"تسویه",sync:"همگام‌سازی",auth:"ورود/خروج",system:"سیستم",nav:"ناوبری",settings:"تنظیمات",info:"اطلاعات"})[k]||"رویداد"}
function auditIcon(k){return ({create:"➕",edit:"✏️",delete:"🗑️",payment:"💳",sync:"☁️",auth:"🔐",system:"⚙️",nav:"🧭",settings:"🎛️",info:"ℹ️"})[k]||"•"}
function renderAudit(){
  const box=$("auditList"); if(!box)return;
  const logs=(data.audit||[]).slice(0,250);
  box.innerHTML=logs.map(e=>`<div class="audit-item"><div class="audit-icon">${auditIcon(e.kind)}</div><div class="audit-main"><b>${esc(e.action)}</b>${e.detail?`<div class="meta">${esc(e.detail)}</div>`:""}<small>${new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"short",timeStyle:"short"}).format(new Date(e.at))}</small></div></div>`).join("")||empty("هنوز گزارشی ثبت نشده است");
}
function clearAudit(){if(!data.audit?.length)return alert("گزارشی برای پاک کردن وجود ندارد");if(confirm("همه گزارش‌های فعالیت پاک شوند؟")){const old=data.audit.slice();data.audit=[];for(const e of old)markDirty("audit",e.id,true,{id:e.id},new Date().toISOString());save();logEvent("گزارش‌ها پاک شدند","سابقه فعالیت قبلی حذف شد","system")}}
/* ---- ذخیره‌سازی (pro2) ---------------------------------------------------
 * ذخیره‌ها در صف serial انجام می‌شوند و چند درخواست پشت‌سرهم به یک نوشتن
 * ادغام می‌شوند (نوشتن همیشه آخرین وضعیت data را می‌خواند). خطا فقط یک بار
 * و بعد از شکست واقعی نوشتن گزارش می‌شود، نه به‌صورت الکی. */
const STORAGE_FULL_MSG="⚠️ حافظه ذخیره‌سازی دستگاه پر شده و تغییرات ذخیره نشد.\nبرای آزاد شدن فضا از تنظیمات، یک پشتیبان بگیر و چند عکس پیوست قدیمی (رسید/تراکنش) را حذف کن.";
const STORAGE_FAIL_MSG="⚠️ ذخیره اطلاعات روی این دستگاه انجام نشد.\nقبل از بستن برنامه از تنظیمات یک پشتیبان بگیر.";
let storageWriteQueue=Promise.resolve();
let _persistScheduled=false,_persistFailureShown=false,_lastAttachmentRecords=null;
/* storageReady: تا پایان خواندن (hydrate) از IndexedDB هیچ نوشتنی انجام نمی‌شود؛ وگرنه داده‌ی خالیِ اولیه
 * می‌توانست قبل از خواندن، اطلاعات ذخیره‌شده‌ی کاربر را بازنویسی کند. */
let storageReady=false,_persistDeferred=false,storageMode="indexeddb";
function isQuotaError(e){return !!e&&(e.name==="QuotaExceededError"||e.code===22||/quota/i.test(String(e.message||"")))}
function onPersistFailure(err){
  console.error("storage save failed",err);
  const recs=_lastAttachmentRecords;_lastAttachmentRecords=null;
  if(isQuotaError(err)&&recs){
    let stripped=false;
    recs.forEach(r=>{if(r&&(r.image||r.receipt||(r.images&&r.images.length))){delete r.image;delete r.receipt;delete r.images;stripped=true}});
    if(stripped){persistLocal();render();alert("⚠️ حجم عکس پیوست بیش از فضای خالی دستگاه بود؛ اطلاعات بدون عکس ذخیره شد.");return}
  }
  if(_persistFailureShown)return;
  _persistFailureShown=true;
  alert(isQuotaError(err)?STORAGE_FULL_MSG:STORAGE_FAIL_MSG);
}
function persistLocal(){
  if(!storageReady){_persistDeferred=true;return true}
  if(storageMode==="localStorage"){
    try{localStorage.setItem(KEY,JSON.stringify(data));_persistFailureShown=false;return true}
    catch(e){onPersistFailure(e);return false}
  }
  if(!globalThis.HesabYarStorage){onPersistFailure(new Error("IndexedDB storage runtime unavailable"));return false}
  if(_persistScheduled)return true;
  _persistScheduled=true;
  storageWriteQueue=storageWriteQueue.then(()=>{_persistScheduled=false;return HesabYarStorage.saveSnapshot(data)}).then(()=>{_persistFailureShown=false;_lastAttachmentRecords=null}).catch(onPersistFailure);
  return true;
}
/* منتظر می‌ماند تا همه‌ی نوشتن‌های در صف تمام شوند. */
function flushPersist(){return storageWriteQueue}
function save(){
 persistLocal(); render();syncSave()
}
/* اگر رکورد تازه یک عکس پیوست دارد و فضای ذخیره‌سازی پر است، عکس را حذف و دوباره تلاش می‌کند
   تا خود اطلاعات (مثلاً تراکنش) به‌جای شکست کامل، بدون عکس ذخیره شود. */
function saveWithAttachments(records){
 _lastAttachmentRecords=Array.isArray(records)?records:[records];
 persistLocal();render();syncSave();return true
}
/* رکوردهای واقعیِ کاربر (بدون حساب پیش‌فرض «کیف پول نقدی») — برای یادآوری پشتیبان‌گیری. */
function hasUserRecords(d){
  if(!d||typeof d!=="object")return false;
  if(["transactions","people","reminders","notes","checks","invoices","customers","products"].some(k=>Array.isArray(d[k])&&d[k].length>0))return true;
  return Array.isArray(d.accounts)&&d.accounts.length>1;
}
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
  for(const k of ks) for(const r of (data[k]||[])) out.push({id:recordDocId(k,r.id),type:k,record:r,revision:Number(r.revision)||0,updatedAt:r.updatedAt||new Date().toISOString(),updatedBy:r.updatedBy||deviceId(),deviceId:r.deviceId||deviceId(),deleted:false});
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
function cloudPayload(x){return {id:x.id,type:x.type,record:x.record,revision:Number(x.record?.revision||0),updatedAt:x.updatedAt,updatedBy:x.record?.updatedBy||sync.user.uid,deviceId:x.record?.deviceId||deviceId(),deleted:x.deleted};}
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
  // Always read the true latest data from the Firestore server when possible,
  // instead of a device's own local cache. Two phones (iPhone/Android/...)
  // signed into the same account share one "users/{uid}/records" collection
  // already — but without this, a device could still show its own last-seen
  // snapshot for a moment instead of the actual latest merged state written
  // by another device/platform. Falls back to the normal (cache-allowed) read
  // when offline, so nothing breaks without a connection.
  let snap;
  try{snap=await recordsCollection().get({source:"server"})}
  catch(e){snap=await recordsCollection().get()}
  return snap.docs.map(d=>d.data());
}
/* v1.2.8: مقایسه زمانی رکوردها بر اساس Date.parse به‌جای مقایسه رشته‌ای
 * (localeCompare)، تا فرمت‌های زمانی متفاوت هم درست مقایسه شوند. */
function compareUpdatedAt(a,b){const ar=Number(a?.revision)||0,br=Number(b?.revision)||0;if(ar!==br)return ar>br?1:-1;const ta=Date.parse(typeof a==="string"?a:a?.updatedAt||"")||0,tb=Date.parse(typeof b==="string"?b:b?.updatedAt||"")||0;if(ta!==tb)return ta>tb?1:-1;const ad=String(a?.deviceId||""),bd=String(b?.deviceId||"");return ad===bd?0:(ad>bd?1:-1)}
function recordsFromLocal(){
  const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"],out=[];
  for(const k of ks) for(const r of (data[k]||[])) out.push({id:recordDocId(k,r.id),type:k,record:r,revision:Number(r.revision)||0,updatedAt:r.updatedAt||new Date().toISOString(),updatedBy:r.updatedBy||deviceId(),deviceId:r.deviceId||deviceId(),deleted:false});
  for(const k of ks) for(const [id,dt] of Object.entries(data._sync?.tombstones?.[k]||{})) out.push({id:recordDocId(k,id),type:k,record:{id},updatedAt:dt,deleted:true});
  return out;
}
async function reconcileInitial(remote){
  const remoteMap=new Map((remote||[]).map(x=>[recordDocId(x.type,x.record?.id),x]));
  const outgoing=[];
  for(const local of recordsFromLocal()){
    const r=remoteMap.get(local.id);
    if(!r || compareUpdatedAt(local.updatedAt,r.updatedAt||r.record?.updatedAt||"")>0) outgoing.push(local);
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
    const timeCmp=compareUpdatedAt({revision:x.revision||x.record?.revision,updatedAt:remoteTs,deviceId:x.deviceId||x.record?.deviceId},{revision:local?.revision||0,updatedAt:localTs,deviceId:localBy});
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
  try{const remote=await pullRest();mergeCloud(remote);persistLocal();await reconcileInitial(remote);render();setSyncStatus("☁️ آنلاین • همگام‌سازی لحظه‌ای")}
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
const FIREBASE_LOAD_TIMEOUT_MS=9000;
function withTimeout(promise,ms,msg){return Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)),ms))])}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(s=>s.src===src)){resolve();return}const s=document.createElement("script");s.src=src;s.onload=()=>resolve();s.onerror=()=>reject(new Error("script load failed: "+src));document.head.appendChild(s)})}
let firebaseLoadPromise=null;
async function ensureFirebaseLoaded(){
  if(window.firebase)return true;
  if(!navigator.onLine)return false;
  if(!firebaseLoadPromise){
    firebaseLoadPromise=(async()=>{for(const url of FIREBASE_SDK_URLS){await withTimeout(loadScriptOnce(url),FIREBASE_LOAD_TIMEOUT_MS,"سرور Firebase در زمان مناسب پاسخ نداد (احتمال فیلترشدن gstatic.com)")}})()
      .catch(e=>{console.warn("firebase sdk load failed",e);firebaseLoadPromise=null;throw e});
  }
  try{await firebaseLoadPromise;return !!window.firebase}catch(e){sync.lastLoadError=e.message||String(e);return false}
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
        if(mergeCloud(remote)){persistLocal();render();syncSave();syncAllNotesToReminders().catch(console.error);syncAllPeopleToReminders().catch(console.error);rescheduleAllNativeReminders().catch(console.error)}
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
  if(!sync.user){if(!await ensureSyncReady())return;if(!sync.user)return alert("اول با حساب همگام‌سازی وارد شو");}
  try{
   // Manual send is a MERGE, not a replace: first fetch the latest shared
   // records, merge them with this phone, then upload the unified dataset.
   const remote=await pullRest();
   mergeCloud(remote||[]);
   persistLocal();
   markAllLocalDirty();
   await pushRest();
   setSyncStatus("☁️ اطلاعات دو گوشی با هم ادغام و ذخیره شد — "+dataSummary(data));
   alert("ارسال و ادغام با موفقیت انجام شد\n"+dataSummary(data));
  }catch(e){alert("ارسال ناموفق: "+(e.code||'')+"\n"+e.message)}
}
async function pullFromCloud(){
  if(!sync.user){if(!await ensureSyncReady())return;if(!sync.user)return alert("اول با حساب همگام‌سازی وارد شو");}
  try{
    const remote=await pullRest();
    if(!remote||!remote.length)return alert("هنوز اطلاعاتی در ابر وجود ندارد");
    mergeCloud(remote);persistLocal();render();setSyncStatus("☁️ اطلاعات از ابر دریافت شد — "+dataSummary(data));alert("اطلاعات ابری دریافت شد\n"+dataSummary(data));
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
 if(!sync.auth){alert("اتصال به سرویس همگام‌سازی برقرار نشد.\nاحتمال زیاد سرورهای گوگل (gstatic.com / firebaseapp.com) روی این اینترنت در دسترس نیستند.\nیک VPN را روشن کن و دوباره امتحان کن."+(sync.lastLoadError?"\n\nجزئیات: "+sync.lastLoadError:""));return false}
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
function parseMoney(v){return Number(toEnDigits(String(v)).replace(/[^\d]/g,""))||0}
/* v1.2.8: اعتبارسنجی مقادیر مالی مثبت (مبلغ تراکنش/چک/فاکتور/بدهی و ...). */
function positiveMoney(value,label="مبلغ"){const n=parseMoney(value);if(!Number.isFinite(n)||n<=0)throw new Error(label+" باید بیشتر از صفر باشد");return n}
function nonNegativeMoney(value,label="مبلغ"){const n=parseMoney(value);if(!Number.isFinite(n)||n<0)throw new Error(label+" نمی‌تواند منفی باشد");return n}
function validPercent(value,label="درصد"){const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw new Error(label+" باید بین صفر و صد باشد");return n}

function bytesToB64(bytes){let s="";for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s)}
function b64ToBytes(s){const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function hashPin(pin,saltB64){const salt=saltB64?b64ToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return {hash:bytesToB64(bits),salt:bytesToB64(salt)}}
/* v1.2.7: رمز عددی همیشه با ارقام انگلیسی هش/ذخیره می‌شود؛ اگر کاربر هنگام
 * ورود یا تعیین رمز از کیبورد فارسی/عربی استفاده کند، اول به رقم انگلیسی
 * تبدیل می‌شود تا با رمز قبلی (صرف‌نظر از کیبورد) مطابقت داشته باشد. */
async function verifyPin(pin){pin=toEnDigits(String(pin??""));if(!(data.pinHash&&data.pinSalt))return false;const x=await hashPin(pin,data.pinSalt);return x.hash===data.pinHash}
async function migratePinSecurity(){if(!data.pin||data.pinHash)return;try{const x=await hashPin(data.pin);data.pinHash=x.hash;data.pinSalt=x.salt;data.pin="";persistLocal();}catch(e){console.warn("PIN security migration",e)}}
function hasLockCode(){return !!((data.pinHash&&data.pinSalt)||(data.patternHash&&data.patternSalt))}

/* ---- Pattern lock (v5.9) --------------------------------------------
 * A 3x3 connect-the-dots pattern, drawn like an Android unlock pattern.
 * The sequence of dot indices (e.g. "0-1-4-7") is hashed with the same
 * PBKDF2 routine used for the numeric PIN, so it's never stored in the
 * clear. Reused both for setting the pattern (settings) and for
 * unlocking the app (lock screen). ---- */
function patternDotXY(i){const col=i%3,row=Math.floor(i/3);return {x:40+col*90,y:40+row*90}}
function patternSVG(){let dots="";for(let i=0;i<9;i++){const c=patternDotXY(i);dots+=`<circle class="pattern-dot" data-i="${i}" cx="${c.x}" cy="${c.y}" r="17"></circle>`}return `<svg id="patternSvg" viewBox="0 0 260 260" class="pattern-svg" touch-action="none"><polyline id="patternLine" class="pattern-line" points=""></polyline>${dots}</svg>`}
let patternPath=[];
function patternPointFromEvent(svg,ev){const rect=svg.getBoundingClientRect();const t=ev.touches&&ev.touches[0]?ev.touches[0]:ev;const x=(t.clientX-rect.left)/rect.width*260,y=(t.clientY-rect.top)/rect.height*260;return {x,y}}
function patternRedraw(svg){svg.querySelectorAll(".pattern-dot").forEach(d=>d.classList.toggle("on",patternPath.includes(+d.dataset.i)));const line=svg.querySelector("#patternLine");if(line)line.setAttribute("points",patternPath.map(i=>{const c=patternDotXY(i);return `${c.x},${c.y}`}).join(" "))}
function patternDown(ev,onDone){ev.preventDefault();const svg=ev.currentTarget;patternPath=[];const move=e=>patternMove(e,svg);const up=()=>{patternUp(svg,onDone);svg.removeEventListener("pointermove",move);svg.removeEventListener("pointerup",up);svg.removeEventListener("pointerleave",up)};svg.addEventListener("pointermove",move);svg.addEventListener("pointerup",up);svg.addEventListener("pointerleave",up);patternMove(ev,svg)}
function patternMove(ev,svg){const p=patternPointFromEvent(svg,ev);for(let i=0;i<9;i++){const c=patternDotXY(i);if(!patternPath.includes(i)&&Math.hypot(p.x-c.x,p.y-c.y)<26)patternPath.push(i)}patternRedraw(svg)}
function patternUp(svg,onDone){onDone([...patternPath])}
function patternKeyOf(path){return path.join("-")}
/* v1.2.8: امنیت تغییر/حذف قفل — قبل از تغییر یا حذف رمز عددی یا الگو،
 * باید همان رمز/الگوی فعلی (یا بیومتریک) تأیید شود؛ صرفاً confirm() برای
 * حذف قفل کافی نیست. بعد از ۳ تلاش ناموفق پیاپی، حداقل ۳۰ ثانیه قفل
 * می‌شود تا حدس زدن پشت‌سرهم دشوارتر شود. */
const LOCK_LOCKOUT_KEY="hesabdar-lock-lockout-v1";
const LOCK_LOCKOUT_MS=30000;
function lockoutState(){try{return JSON.parse(localStorage.getItem(LOCK_LOCKOUT_KEY)||"null")||{fails:0,until:0}}catch{return {fails:0,until:0}}}
function setLockoutState(s){try{localStorage.setItem(LOCK_LOCKOUT_KEY,JSON.stringify(s))}catch(e){}}
function lockoutRemainingMs(){const s=lockoutState();return Math.max(0,(s.until||0)-Date.now())}
function registerLockFail(){const s=lockoutState();s.fails=(s.fails||0)+1;if(s.fails>=3){s.until=Date.now()+LOCK_LOCKOUT_MS;s.fails=0}setLockoutState(s)}
function registerLockSuccess(){setLockoutState({fails:0,until:0})}
async function promptPatternVerification(title="برای ادامه، الگوی فعلی را بکش"){
 return new Promise(resolve=>{
  openModal(`<h2>🔗 تایید هویت</h2><p class="hint">${esc(title)}</p><div class="pattern-wrap">${patternSVG()}</div><p id="patVerifyMsg" class="hint"></p><button type="button" class="ghost-btn" id="patVerifyCancel">انصراف</button>`);
  const svg=$("patternSvg");let done=false;
  $("patVerifyCancel").onclick=()=>{if(done)return;done=true;closeModal();resolve(null)};
  svg.onpointerdown=e=>patternDown(e,path=>{if(done)return;done=true;closeModal();resolve(path)});
 });
}
async function verifyExistingLock(reason="برای ادامه، هویتت را تایید کن"){
 if(lockoutRemainingMs()>0){alert(`به‌خاطر چند تلاش ناموفق، ${Math.ceil(lockoutRemainingMs()/1000)} ثانیه دیگر دوباره تلاش کن.`);return false}
 let ok=false;
 if(data.patternHash&&data.patternSalt){
  const path=await promptPatternVerification(reason);
  ok=path?await verifyPattern(path):false;
 }else if(data.pinHash||data.pin){
  const p=prompt(reason+" (رمز عددی فعلی):");
  if(p===null)return false;
  ok=await verifyPin(p);
 }else{
  ok=true;
 }
 if(ok)registerLockSuccess();else registerLockFail();
 return ok;
}
async function openPatternSetup(){
 const old=data.pinHash||data.pin||data.patternHash;
 if(old){if(!(await verifyExistingLock("برای تغییر روش قفل، رمز/الگوی فعلی را تایید کن")))return alert("تایید هویت ناموفق بود")}
 const step={first:null};
 const body=`<h2>🔗 تعیین رمز الگو</h2><p class="hint">حداقل ۴ نقطه را به هم وصل کن.</p><div id="patSetupWrap" class="pattern-wrap">${patternSVG()}</div><p id="patSetupMsg" class="hint"></p>`;
 openModal(body);
 const svg=$("patternSvg");
 svg.onpointerdown=e=>patternDown(e,async path=>{
  if(path.length<4){$("patSetupMsg").textContent="حداقل ۴ نقطه لازم است، دوباره بکش.";patternPath=[];patternRedraw(svg);return}
  if(!step.first){step.first=path;patternPath=[];patternRedraw(svg);$("patSetupMsg").textContent="همین الگو را دوباره بکش تا تایید شود.";return}
  if(patternKeyOf(step.first)!==patternKeyOf(path)){$("patSetupMsg").textContent="الگو با بار قبل یکسان نبود؛ از اول بکش.";step.first=null;patternPath=[];patternRedraw(svg);return}
  try{const x=await hashPin(patternKeyOf(path));data.pin="";data.pinHash="";data.pinSalt="";data.patternHash=x.hash;data.patternSalt=x.salt;data.lockMethod="pattern";save();logEvent("تعیین رمز الگو",old?"الگوی ورود تغییر کرد":"قفل الگویی فعال شد","settings");alert("رمز الگو با موفقیت ذخیره شد");closeModal();renderSettingsFeatures()}catch(e){alert("ذخیره الگو انجام نشد")}
 });
}
async function verifyPattern(path){if(!data.patternHash||!data.patternSalt)return false;const x=await hashPin(patternKeyOf(path),data.patternSalt);return x.hash===data.patternHash}

/* ---- Biometric unlock (Face ID / fingerprint) (v5.9) -----------------
 * On a native Capacitor build with a biometric plugin available (e.g.
 * capacitor-native-biometric, registered as "NativeBiometric"), the
 * device's own Face ID / fingerprint prompt is used directly. In a
 * plain browser/PWA, the standard WebAuthn platform authenticator is
 * used instead (this covers Face ID/Touch ID in Safari and fingerprint/
 * face unlock in Chrome on supported devices). A PIN or pattern must
 * already be set — biometrics is always an additional, faster way in,
 * never a replacement for having a code configured. ---- */
function getNativeBiometric(){try{const p=globalThis.Capacitor?.Plugins?.NativeBiometric;if(p&&typeof p.verifyIdentity==="function")return p}catch(e){}return null}
async function webauthnSupported(){try{return !!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())}catch(e){return false}}
async function webauthnRegister(){
 if(!(await webauthnSupported()))return false;
 try{
  const cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:"حساب‌یار"},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:"hesabdar-user",displayName:"کاربر حسابدار"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},timeout:60000}});
  if(!cred)return false;
  data.webauthnCredId=bytesToB64(cred.rawId);
  return true;
 }catch(e){console.warn("webauthn register",e);return false}
}
async function webauthnUnlock(){
 if(!data.webauthnCredId)return false;
 try{const cred=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{id:b64ToBytes(data.webauthnCredId),type:"public-key"}],userVerification:"required",timeout:60000}});return !!cred}catch(e){console.warn("webauthn unlock",e);return false}
}
async function biometricAvailable(){const p=getNativeBiometric();if(p){try{const r=await p.isAvailable();return !!(r&&(r.isAvailable||r.has))}catch(e){return false}}return webauthnSupported()}
async function biometricVerify(){const p=getNativeBiometric();if(p){try{await p.verifyIdentity({reason:"ورود به حساب‌یار",title:"ورود با اثرانگشت / چهره",subtitle:"",description:"برای باز کردن برنامه تایید هویت کن"});return true}catch(e){return false}}return webauthnUnlock()}
async function setBiometricEnabled(v){
 if(v){
  if(!hasLockCode()){alert("اول یک رمز ورود (عددی یا الگو) تعیین کن، بعد بیومتریک را فعال کن.");renderSettingsFeatures();return}
  let ok=await biometricAvailable();
  if(ok&&!getNativeBiometric())ok=await webauthnRegister();
  if(!ok){alert("قفل بیومتریک (اثرانگشت/چهره) روی این گوشی در دسترس نیست یا تنظیم نشده.");renderSettingsFeatures();return}
  data.biometricEnabled=true;
 }else{data.biometricEnabled=false;data.webauthnCredId=""}
 save();logEvent(v?"فعال‌سازی قفل بیومتریک":"غیرفعال‌سازی قفل بیومتریک","","settings");renderSettingsFeatures();
}

/* v2.2 fix: this key was a hardcoded string, so once someone had seen it, it never showed
   again for any later version — it needed a manual bump each release and that step kept
   getting missed, which is why "what changed" stopped appearing. Tying it to APP_VERSION
   means every future version bump shows its changelog once automatically, no manual step. */
const WHATS_NEW_KEY="hesabdar-whats-new-seen-"+APP_VERSION;
function showWhatsNewOnce(){
 if(localStorage.getItem(WHATS_NEW_KEY)==="1")return;
 localStorage.setItem(WHATS_NEW_KEY,"1");
 openModal(`<div class="whats-new">
  <div class="whats-new-badge">نسخه ${esc(APP_VERSION)}</div>
  <h2>🎉 به حساب‌یار خوش آمدی</h2>
  <p class="hint">این صفحه فقط یک‌بار در اولین اجرای این نسخه نمایش داده می‌شود.</p>
  <div class="whats-new-section">
   <h3>🛠 تغییرات این نسخه</h3>
   <ul>
    <li>💾 ذخیره‌سازی اطلاعات کاملاً بازنویسی و آزمایش شد: تراکنش‌ها، فاکتورها و همه‌ی تنظیمات (رمز ورود، زبان، مهر و امضا) اکنون با هم و به‌صورت اتمیک در IndexedDB ذخیره می‌شوند.</li>
    <li>🔁 انتقال از نسخه‌های قبلی امن است: نسخه‌ی قدیمی فقط بعد از تأیید خواندن‌مجدد پاک می‌شود.</li>
    <li>🔔 «پشتیبان خودکار» به «یادآوری پشتیبان‌گیری» تبدیل شد؛ چون بکاپ رمزنگاری‌شده بدون رمز شما ساخته نمی‌شود، اگر بیش از ۷ روز پشتیبان نگرفته باشی یادآوری می‌شوی.</li>
    <li>🧾 رفع خطاهایی که با هر ذخیره پیام «حافظه پر است» می‌دادند یا صفحه تنظیمات را از کار می‌انداختند.</li>
   </ul>
  </div>
  <div class="whats-new-section">
   <h3>✨ امکانات حساب‌یار</h3>
   <ul>
    <li>حساب‌ها و بانک‌ها، تراکنش‌ها، درآمد و هزینه و انتقال بین حساب‌ها.</li>
    <li>فاکتور، مشتری و محصولات، یادآوری، چک و گزارش‌ها.</li>
    <li>پشتیبان‌گیری رمزنگاری‌شده و بازیابی، و همگام‌سازی ابری دو گوشی.</li>
    <li>اعلان‌ها، قفل عددی/الگویی و ورود بیومتریک در نسخه‌های سازگار.</li>
    <li>ماشین‌حساب، ثبت سریع تراکنش و ابزارهای کاربردی روزمره.</li>
   </ul>
  </div>
  <button class="primary" onclick="closeModal()">🚀 شروع کار با حساب‌یار</button>
 </div>`);
}
function showLock(){
 let old=$("lock"); if(old) old.remove();
 if(!hasLockCode())return;
 const d=document.createElement("div");d.id="lock";d.className="lock";
 const bioBtn=data.biometricEnabled?'<button type="button" class="lock-bio-btn" id="bioUnlockBtn">👁 ورود با اثرانگشت / چهره</button>':"";
 if(data.lockMethod==="pattern"&&data.patternHash){
  d.innerHTML=`<div class="lockbox"><h1>🔐 حساب‌یار</h1><p>الگوی ورود را بکش</p><div class="pattern-wrap">${patternSVG()}</div><p id="lockMsg" class="hint"></p>${bioBtn}</div>`;
 }else{
  d.innerHTML='<div class="lockbox"><h1>🔐 حساب‌یار</h1><p>رمز ورود را وارد کن</p><input id="pinInput" inputmode="numeric" maxlength="8" type="password" autocomplete="off" placeholder="رمز ورود"><button class="primary" id="unlockBtn">ورود</button>'+bioBtn+'</div>';
 }
 document.body.appendChild(d);
 if(data.lockMethod==="pattern"&&data.patternHash){
  const svg=$("patternSvg");
  svg.onpointerdown=e=>patternDown(e,async path=>{
   if(lockoutRemainingMs()>0){$("lockMsg").textContent=`${Math.ceil(lockoutRemainingMs()/1000)} ثانیه دیگر دوباره تلاش کن`;patternPath=[];patternRedraw(svg);return}
   const ok=await verifyPattern(path).catch(()=>false);
   if(ok){registerLockSuccess();$("lock")?.remove();setTimeout(showWhatsNewOnce,180);return}
   registerLockFail();
   $("lockMsg").textContent=lockoutRemainingMs()>0?`رمز اشتباه بود؛ ${Math.ceil(lockoutRemainingMs()/1000)} ثانیه صبر کن`:"الگو اشتباه است";patternPath=[];patternRedraw(svg);
  });
 }else{
  $("unlockBtn").onclick=unlock;
  $("pinInput").onkeydown=e=>{if(e.key==="Enter")unlock()};
 }
 if(bioBtn)$("bioUnlockBtn").onclick=async()=>{const ok=await biometricVerify().catch(()=>false);if(ok)$("lock")?.remove();else alert("تایید بیومتریک انجام نشد")};
}
async function unlock(){
 const input=$("pinInput");if(!input)return;
 if(lockoutRemainingMs()>0)return alert(`به‌خاطر چند تلاش ناموفق، ${Math.ceil(lockoutRemainingMs()/1000)} ثانیه دیگر دوباره تلاش کن.`);
 const ok=await verifyPin(input.value).catch(()=>false);
 if(!ok){registerLockFail();return alert(lockoutRemainingMs()>0?`رمز اشتباه بود؛ ${Math.ceil(lockoutRemainingMs()/1000)} ثانیه صبر کن`:"رمز اشتباه است")}
 registerLockSuccess();$("lock")?.remove();setTimeout(showWhatsNewOnce,180)
}
async function setPin(){
 if(data.lockMethod==="pattern"&&data.patternHash){alert("در حال حاضر قفل الگو فعال است. برای تغییر به رمز عددی، اول با «حذف رمز ورود» آن را غیرفعال کن.");return}
 const old=data.pinHash||data.pin?(prompt("رمز فعلی را وارد کن:")||""):"";
 if((data.pinHash||data.pin)&&!(await verifyPin(old)))return alert("رمز فعلی اشتباه است");
 let p=prompt(data.pinHash||data.pin?"رمز جدید ۴ تا ۸ رقمی:":"یک رمز ۴ تا ۸ رقمی برای ورود تعیین کن:");
 if(p===null)return;
 p=toEnDigits(p);
 if(!/^\d{4,8}$/.test(p))return alert("رمز باید ۴ تا ۸ رقم باشد");
 const p2=toEnDigits(prompt("رمز جدید را دوباره وارد کن:")||"");
 if(p!==p2)return alert("دو رمز یکسان نیستند");
 try{const x=await hashPin(p);data.pin="";data.pinHash=x.hash;data.pinSalt=x.salt;data.lockMethod="pin";save();logEvent("تغییر رمز ورود","رمز ورود تغییر کرد","settings");alert("رمز با موفقیت ذخیره شد");renderSettingsFeatures()}catch(e){alert("ذخیره رمز انجام نشد")}
}
async function removePin(){
 if(!hasLockCode())return alert("هنوز رمزی فعال نیست");
 if(!(await verifyExistingLock("برای حذف قفل، رمز/الگوی فعلی را تایید کن")))return alert("تایید هویت ناموفق بود؛ قفل حذف نشد");
 if(!confirm("رمز/الگوی ورود حذف شود؟"))return;
 data.pin="";data.pinHash="";data.pinSalt="";data.patternHash="";data.patternSalt="";data.biometricEnabled=false;data.webauthnCredId="";data.lockMethod="pin";save();logEvent("حذف رمز ورود","قفل برنامه غیرفعال شد","settings");alert("رمز حذف شد");renderSettingsFeatures();
}

function tapFeedback(){try{if(navigator.vibrate)navigator.vibrate(8)}catch(e){}}
document.addEventListener("click",e=>{if(e.target.closest("button,.nav"))tapFeedback()},{passive:true});

/* ---- Page navigation with back-history (supports hardware/gesture back) ---- */
let pageHistory=["home"];
function activatePage(name){
 /* v2.5.1: enforce the store-mode lock at this single choke point too —
    goBackPage() (hardware back button / edge swipe-back) used to call
    activatePage() directly with whatever page was earlier in pageHistory
    (e.g. "home", "settings", "accounts" from before the store was
    entered), completely bypassing the goToPage() guard below. That let
    a swipe or the phone's back button reveal the full app from inside
    the locked kiosk. Guarding here closes that regardless of caller. */
 if(appMode()==="store"&&!STORE_ALLOWED_PAGES.includes(name))name="invoices";
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(`.nav[data-page="${name}"]`).forEach(x=>x.classList.add("active"));
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 const page=$(name);
 if(page)page.classList.add("active");
 render();
 return page;
}
function goToPage(name,fromNav){
 if(appMode()==="store"&&!STORE_ALLOWED_PAGES.includes(name))name="invoices";
 if(!$(name))return;
 const page=activatePage(name);
 if(pageHistory[pageHistory.length-1]!==name)pageHistory.push(name);
 if(fromNav)closeMenu();
 logEvent("ورود به بخش",page?.querySelector("h2")?.textContent||name,"nav");
}
function goBackPage(){
 /* در حالت فروشگاه به بیرون از صفحات مجاز (صندوق فاکتور/کالا و انبار/
    مشتری‌ها/چک) برنمی‌گردیم؛ فراتر از قفل activatePage، خود استک تاریخچه
    هم درگیر صفحات قدیمی قبل از ورود به حالت فروشگاه نمی‌شود. */
 if(appMode()==="store"){
  while(pageHistory.length>1&&!STORE_ALLOWED_PAGES.includes(pageHistory[pageHistory.length-2]))pageHistory.splice(pageHistory.length-2,1);
  if(pageHistory.length>1){pageHistory.pop();activatePage(pageHistory[pageHistory.length-1]);return true}
  return false;
 }
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
function openMenu(){
 const m=$("menuModal");if(!m)return;m.classList.remove("hidden");$("menuBtn")?.setAttribute("aria-expanded","true");
 const si=$("menuSearchInput");if(si){si.value="";filterMenu()}
 document.querySelectorAll("#menuGroups .menu-group").forEach(g=>g.classList.toggle("open",g.classList.contains("main-menu-group")));
 logEvent("باز کردن منو","منوی اصلی","nav");setTimeout(()=>si?.focus(),150)
}
function closeMenu(){const m=$("menuModal");if(!m)return;m.classList.add("hidden");$("menuBtn")?.setAttribute("aria-expanded","false")}
/* ---- v3.12: آکاردئون منو ----
 * چون فهرست منو طولانی شده، عنوان هر گروه همیشه دیده می‌شود ولی دکمه‌های
 * زیرش تا زده نشدن باز نمی‌شوند — دقیقاً مثل آکاردئون تنظیمات. اینجا به‌
 * جای دستکاری تک‌تک عنوان‌ها در HTML، یک‌بار روی همه‌ی .menu-group-title
 * موجود کلیک‌گیر سوار می‌شود (ساده‌تر و کمتر مستعد فراموشیِ یک مورد). */
function toggleMenuGroup(titleEl){titleEl.parentElement?.classList.toggle("open")}
document.querySelectorAll("#menuGroups .menu-group-title").forEach(t=>{
 t.style.cursor="pointer";
 t.insertAdjacentHTML("beforeend",'<span class="menu-group-arrow">⌄</span>');
 t.addEventListener("click",()=>toggleMenuGroup(t));
});
/* ---- v3.11: جعبه جستجو بالای منو ----
 * با تایپ کردن، فقط دکمه‌های منوی مطابق (بر اساس متن نمایشی‌شان) نشان
 * داده می‌شوند و گروه‌هایی که هیچ نتیجه‌ای ندارند مخفی می‌شوند؛ زدن Enter
 * وقتی فقط یک نتیجه باقی مانده باشد، مستقیم همان بخش را باز می‌کند. */
function filterMenu(){
 const q=($("menuSearchInput")?.value||"").trim().toLowerCase();
 const groups=document.querySelectorAll("#menuGroups .menu-group");
 groups.forEach(g=>{
  let anyVisible=false;
  g.querySelectorAll(".menu-grid button").forEach(b=>{
   const match=!q||b.textContent.toLowerCase().includes(q);
   b.style.display=match?"":"none";
   if(match)anyVisible=true;
  });
  g.style.display=anyVisible?"":"none";
  g.classList.toggle("open",q?anyVisible:g.classList.contains("main-menu-group"));
 });
}
function menuSearchEnter(){
 const visible=[...document.querySelectorAll("#menuGroups .menu-grid button")].filter(b=>b.style.display!=="none");
 if(visible.length===1)visible[0].click();
}
$("menuBtn").onclick=openMenu;
$("menuModal").addEventListener("click",e=>{if(e.target.id==="menuModal")closeMenu()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

const modal=$("modal"),modalBody=$("modalBody");
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden");bindAmountInputs(modalBody)}
function closeModal(){
  try{document.activeElement?.blur?.()}catch(e){}
  modal.classList.add("hidden");
  try{
    window.scrollTo(0,0);
    if(window.visualViewport){
      const reset=()=>window.scrollTo(0,0);
      requestAnimationFrame(reset); setTimeout(reset,60);
    }
  }catch(e){}
}
/* ---- v3.12: جداکننده هزارگان در تمام فیلدهای عددی مبلغی ----
 * هر فیلدی که کلاس amt-input داشته باشد، هنگام تایپ خودکار هر ۳ رقم یک
 * ویرگول می‌گیرد (۱٬۲۵۰٬۰۰۰) تا میلیون از هزار به‌راحتی تشخیص داده شود؛
 * مقدار واقعی برای ذخیره‌سازی همیشه با parseMoney() (که از قبل در همه‌ی
 * توابع ذخیره استفاده می‌شد) از روی همین متن با ویرگول درست خوانده
 * می‌شود، چون parseMoney هر چیزی جز رقم را حذف می‌کند. این فیلدها از
 * type="number" به type="text" تغییر کردند چون مرورگر روی نوع number
 * اجازه نمایش ویرگول را نمی‌دهد. */
function groupThousandsStr(digitsOnly){return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g,",")}
function fmtAmtValue(n){n=Math.round(Number(n)||0);return n?groupThousandsStr(String(n)):""}
function formatAmountInputEl(el){
 const start=el.selectionStart,before=el.value.length;
 const digits=toEnDigits(String(el.value||"")).replace(/[^\d]/g,"");
 const grouped=groupThousandsStr(digits);
 if(el.value===grouped)return;
 el.value=grouped;
 const diff=grouped.length-before;
 try{const pos=Math.max(0,(start||grouped.length)+diff);el.setSelectionRange(pos,pos)}catch(e){}
}
/* v1.2.7: فیلدهای عددی ساده (تعداد، درصد، موجودی) که جداکننده هزارگان
 * ندارند اما باید همان‌طور که با کیبورد فارسی/عربی تایپ می‌شوند، به رقم
 * انگلیسی تبدیل شوند تا Number(...) درست خوانده شود. با data-decimal="1"
 * یک نقطه اعشار هم مجاز می‌شود (مثلاً تعداد کالای فاکتور). */
function normalizeNumInputEl(el){
 const allowDecimal=el.dataset.decimal==="1";
 const start=el.selectionStart,before=el.value.length;
 let v=toEnDigits(String(el.value||""));
 v=allowDecimal?v.replace(/[^\d.]/g,""):v.replace(/[^\d]/g,"");
 if(allowDecimal){
  const firstDot=v.indexOf(".");
  if(firstDot!==-1)v=v.slice(0,firstDot+1)+v.slice(firstDot+1).replace(/\./g,"");
 }
 if(el.value===v)return;
 el.value=v;
 const diff=v.length-before;
 try{const pos=Math.max(0,(start||v.length)+diff);el.setSelectionRange(pos,pos)}catch(e){}
}
function bindAmountInputs(root){
 (root||document).querySelectorAll(".amt-input").forEach(el=>{
  if(el.dataset.amtBound)return;
  el.dataset.amtBound="1";
  el.addEventListener("input",()=>formatAmountInputEl(el));
  formatAmountInputEl(el);
 });
 (root||document).querySelectorAll(".num-input").forEach(el=>{
  if(el.dataset.numBound)return;
  el.dataset.numBound="1";
  el.addEventListener("input",()=>normalizeNumInputEl(el));
  normalizeNumInputEl(el);
 });
}

/* ---- v3.11: جستجوی سراسری ----
 * یک ذره‌بین بالای صفحه که هم‌زمان در تراکنش، مشتری، کالا، چک و فاکتور
 * می‌گردد و نتیجه را دسته‌بندی‌شده نشان می‌دهد؛ با زدن روی هر نتیجه،
 * همان آیتم برای ویرایش/مشاهده باز می‌شود. از همان مودال عمومی برنامه
 * استفاده می‌کند، پس چیز تازه‌ای به رابط کاربری اضافه نمی‌کند. */
function openGlobalSearch(){
 openModal(`<h2>🔍 جستجوی سراسری</h2><div class="form"><input id="gsInput" placeholder="در تراکنش، مشتری، کالا، چک، فاکتور جستجو کن..." oninput="renderGlobalSearch()"></div><div id="gsResults" class="gs-results"></div>`);
 setTimeout(()=>$("gsInput")?.focus(),50);
 renderGlobalSearch();
}
function gsGroup(title,items){return items.length?`<div class="gs-group"><div class="gs-group-title">${title} (${fa(items.length)})</div>${items.join("")}</div>`:""}
function renderGlobalSearch(){
 const box=$("gsResults");if(!box)return;
 const q=($("gsInput")?.value||"").trim().toLowerCase();
 if(!q){box.innerHTML=`<p class="hint">برای جستجو در همه‌ی بخش‌ها تایپ کن.</p>`;return}
 const has=s=>String(s||"").toLowerCase().includes(q);
 const txRows=sortedTransactions().filter(t=>has(t.title)||has(t.category)||has(t.otherName)||(t.type==="transfer"&&(has(data.accounts.find(a=>a.id===t.from)?.name)||has(data.accounts.find(a=>a.id===t.to)?.name)))).slice(0,8).map(t=>`<div class="item gs-row" onclick="closeModal();openTx('${t.id}')"><div><b>${esc(t.title||"تراکنش")}</b><div class="meta">${jalaliLabel(t.date)}${t.category?" • "+esc(t.category):""}</div></div><strong class="${t.type}">${money(t.amount)}</strong></div>`);
 const custRows=data.customers.filter(c=>has(c.name)||has(c.phone)).slice(0,8).map(c=>`<div class="item gs-row" onclick="closeModal();openCustomer('${c.id}')"><div><b>👤 ${esc(c.name)}</b><div class="meta">${esc(c.phone||"")}</div></div></div>`);
 const prodRows=data.products.filter(p=>has(p.name)||has(p.code)).slice(0,8).map(p=>`<div class="item gs-row" onclick="closeModal();openProduct('${p.id}')"><div><b>📦 ${esc(p.name)}</b><div class="meta">موجودی: ${fa(p.stock||0)} • فروش: ${money(p.price||0)}</div></div></div>`);
 const checkRows=data.checks.filter(c=>has(c.name)||has(c.bank)||has(c.number)).slice(0,8).map(c=>`<div class="item gs-row" onclick="closeModal();openCheck('${c.id}')"><div><b>✓ ${esc(c.name)}</b><div class="meta">${jalaliLabel(c.date)}${c.bank?" • "+esc(c.bank):""}</div></div><strong class="${c.type==="receive"?"income":"expense"}">${money(c.amount)}</strong></div>`);
 const invRows=data.invoices.filter(i=>has(i.name)||has(i.number)||has(invoiceCustomerLabel(i))).slice(0,8).map(i=>`<div class="item gs-row" onclick="closeModal();previewInvoice('${i.id}')"><div><b>🧾 ${esc(i.name||"فاکتور")}</b><div class="meta">${jalaliLabel(i.date)}${i.number?" • شماره "+esc(i.number):""}</div></div><strong>${money(invoiceTotal(i))}</strong></div>`);
 const groups=[gsGroup("تراکنش‌ها",txRows),gsGroup("مشتری‌ها",custRows),gsGroup("کالاها",prodRows),gsGroup("چک‌ها",checkRows),gsGroup("فاکتورها",invRows)].join("");
 box.innerHTML=groups||`<p class="hint">چیزی پیدا نشد.</p>`;
}

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
 let sx=0,sy=0,active=false,confirmedHorizontal=false;
 document.addEventListener("touchstart",e=>{
  if(e.touches.length!==1)return;
  const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
  active=(sx<=EDGE||sx>=window.innerWidth-EDGE);
  confirmedHorizontal=false;
 },{passive:true});
 /* v3.4 fix: without a touchmove handler here, once a gesture started at
  * the edge, the WebView's own native "swipe from edge = go back" gesture
  * could still fire at the same time as ours (each one racing the other),
  * which is what produced the white-flash-then-slow-return-to-home bug on
  * pages like کالا و انبار. Once we can tell the drag is clearly
  * horizontal, we call preventDefault() so only our own performBack() (via
  * touchend below) ever runs — never the WebView's. */
 document.addEventListener("touchmove",e=>{
  if(!active||e.touches.length!==1)return;
  const t=e.touches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);
  if(!confirmedHorizontal&&Math.abs(dx)>12&&dy<Math.abs(dx)*MAXV_RATIO)confirmedHorizontal=true;
  if(confirmedHorizontal&&e.cancelable)e.preventDefault();
 },{passive:false});
 document.addEventListener("touchend",e=>{
  if(!active){confirmedHorizontal=false;return}
  active=false;
  const t=e.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);
  confirmedHorizontal=false;
  if(Math.abs(dx)>THRESH&&dy<Math.abs(dx)*MAXV_RATIO)performBack();
 },{passive:true});
})();

function touch(r){r.revision=Math.max(0,Number(r.revision)||0)+1;r.updatedAt=new Date().toISOString();r.updatedBy=sync.user?.uid||deviceId();r.deviceId=deviceId();return r}
function markDeleted(type,id){data._sync??={tombstones:{}};data._sync.tombstones??={};data._sync.tombstones[type]??={};const dt=new Date().toISOString();const revision=Number(data._sync.tombstoneRevisions?.[type]?.[id]||0)+1;data._sync.tombstoneRevisions??={};data._sync.tombstoneRevisions[type]??={};data._sync.tombstoneRevisions[type][id]=revision;data._sync.tombstones[type][id]=dt;markDirty(type,id,true,{id,revision,updatedAt:dt,updatedBy:sync.user?.uid||deviceId(),deviceId:deviceId()},dt)}
function removeRecord(type,id){const i=data[type].findIndex(x=>x.id===id);if(i<0)return;data[type].splice(i,1);markDeleted(type,id);save()}
function accountSelect(id="acc",selected=""){return `<select id="${id}">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===selected?"selected":""}>${esc(a.name)}${a.bank?" • "+esc(a.bank):""}</option>`).join("")}</select>`}
function openAccount(id=null){const a=id&&data.accounts.find(x=>x.id===id);openModal(`<h2>${a?"ویرایش حساب":"افزودن حساب"}</h2><div class="form"><input id="an" placeholder="نام حساب" value="${esc(a?.name||"")}"><input id="bank" placeholder="نام بانک" value="${esc(a?.bank||"")}"><input id="sender" placeholder="شماره فرستنده پیامک بانک" value="${esc(a?.sender||"")}"><input id="card" placeholder="شماره کارت (اختیاری)" value="${esc(a?.card||"")}"><input id="ab" type="text" inputmode="numeric" class="amt-input" placeholder="موجودی اولیه" value="${fmtAmtValue(a?.balance)}"><button class="primary" onclick="saveAccount('${a?.id||""}')">${a?"ذخیره تغییرات":"ذخیره"}</button></div>`)}
function saveAccount(id){if(!$("an").value.trim())return alert("نام حساب را وارد کنید");const o={name:$("an").value.trim(),bank:$("bank").value.trim(),sender:$("sender").value.trim(),card:$("card").value.trim(),balance:parseMoney($("ab").value)||0};if(id){const a=data.accounts.find(x=>x.id===id);Object.assign(a,o);touch(a);markDirty("accounts",a.id,false,a,a.updatedAt)}else{const a=touch({id:uid(),...o});data.accounts.push(a);markDirty("accounts",a.id,false,a,a.updatedAt)}save();logEvent(id?"ویرایش حساب":"ایجاد حساب",o.name,id?"edit":"create");closeModal()}
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
/* v3.8: subcategories used to always render open under every parent, making
   the picker a long wall of buttons. Now a parent with children just toggles
   open/closed on tap (catExpand) and its children only render while it's the
   expanded one; a parent with no children still picks itself directly. The
   parent of whatever is already selected auto-expands so editing a tx with a
   subcategory set doesn't look like nothing is picked. */
let catExpand={expense:null,income:null};
/* v3.12: چند-عکسی‌شدن پیوست تراکنش (حداکثر ۵ عکس) — وضعیت موقت فرم تراکنش باز */
let txImagesTemp=[];
const TX_IMAGES_MAX=5;
function categoryButtons(type,selected=""){
  const arr=type==="expense"?data.expenseCats:data.incomeCats;
  if(catExpand[type]==null&&selected){
    const parent=arr.find(c=>c.name===selected||(c.children||[]).some(ch=>c.name+" - "+ch.name===selected));
    if(parent)catExpand[type]=parent.id;
  }
  return `<div class="category-window">${arr.map(c=>{
    const kids=c.children||[];
    const isParentSel=c.name===selected;
    const isExpanded=catExpand[type]===c.id;
    const openAction=kids.length?`toggleCategoryExpand('${type}','${c.id}')`:`pickCategory('${type}','${c.id}')`;
    return `<div class="cat-group">
      <button type="button" class="cat-btn ${isParentSel?"selected-cat":""} ${isExpanded?"cat-expanded":""}" onclick="${openAction}">${esc(c.name)}${kids.length?`<span class="cat-caret">${isExpanded?"▾":"›"}</span>`:""}</button>
      ${kids.length&&isExpanded?`<div class="cat-children">${kids.map(ch=>{const full=c.name+" - "+ch.name;return `<button type="button" class="cat-chip ${selected===full?"selected-cat":""}" onclick="pickSubCategory('${type}','${c.id}','${ch.id}')">${esc(ch.name)}</button>`}).join("")}</div>`:""}
    </div>`;
  }).join("")}</div><button type="button" class="cat-manage-link" onclick="openCategory()">⚙ مدیریت کامل دسته‌ها و زیرمجموعه‌ها</button>`;
}
function toggleCategoryExpand(type,id){catExpand[type]=catExpand[type]===id?null:id;refreshCategoryButtonsInTxForm(type)}
function openTx(id=null){if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");const t=id&&data.transactions.find(x=>x.id===id);if(t?.type==="transfer")return openTransfer(id);const typ=t?.type||"expense";catExpand={expense:null,income:null};txImagesTemp=(t?.images&&t.images.length?t.images.slice(0,TX_IMAGES_MAX):(t?.image?[t.image]:[]));openModal(`<h2>${t?"ویرایش تراکنش":"ثبت تراکنش"}</h2><div class="form"><div class="type-switch"><button type="button" id="expBtn" class="${typ==="expense"?"chosen":""}" onclick="txType('expense')">💸 هزینه</button><button type="button" id="incBtn" class="${typ==="income"?"chosen":""}" onclick="txType('income')">💰 دریافت</button></div><input id="txKind" type="hidden" value="${typ}"><input id="title" placeholder="عنوان" value="${esc(t?.title||"")}"><input id="amount" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ" value="${fmtAmtValue(t?.amount)}"><div id="expensePanel" style="display:${typ==="expense"?"block":"none"}"><div class="cat-head-row"><b id="catLabel">${t?.category?"دسته: "+esc(t.category):"دسته را انتخاب کنید"}</b><div class="cat-toolbar"><button type="button" title="افزودن دسته" onclick="quickAddCategory('expense')">＋</button><button type="button" title="ویرایش دسته انتخاب‌شده" onclick="quickEditCategory('expense')">✏️</button><button type="button" title="حذف دسته انتخاب‌شده" class="danger-icon" onclick="quickDeleteCategory('expense')">🗑</button></div></div><div id="expenseCatButtons">${categoryButtons("expense",typ==="expense"?t?.category:"")}</div><input id="cat" type="hidden" value="${esc(typ==="expense"?t?.category||"":"")}"></div><div id="incomePanel" style="display:${typ==="income"?"block":"none"}"><div class="cat-head-row"><b id="incatLabel">${t?.category?"دسته: "+esc(t.category):"دسته را انتخاب کنید"}</b><div class="cat-toolbar"><button type="button" title="افزودن دسته" onclick="quickAddCategory('income')">＋</button><button type="button" title="ویرایش دسته انتخاب‌شده" onclick="quickEditCategory('income')">✏️</button><button type="button" title="حذف دسته انتخاب‌شده" class="danger-icon" onclick="quickDeleteCategory('income')">🗑</button></div></div><div id="incomeCatButtons">${categoryButtons("income",typ==="income"?t?.category:"")}</div><input id="incat" type="hidden" value="${esc(typ==="income"?t?.category||"":"")}"></div>${accountSelect("acc",t?.accountID||"")}<label class="hint" style="display:block;margin-top:8px">🔁 تکرار خودکار</label><select id="txRecur"><option value="none" ${!t?.recurring||t?.recurring==="none"?"selected":""}>بدون تکرار</option><option value="weekly" ${t?.recurring==="weekly"?"selected":""}>هفتگی</option><option value="monthly" ${t?.recurring==="monthly"?"selected":""}>ماهانه</option></select><label class="file-label">📎 تصویر پیوست (حداکثر ${fa(TX_IMAGES_MAX)} عکس)<input id="txImage" type="file" accept="image/*" multiple onchange="handleTxImageSelect(this)"></label><div id="txImagePreview">${txImagesPreviewHTML()}</div><button class="primary" onclick="saveTx('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت تراکنش"}</button></div>`)}
function txType(t){$("txKind").value=t;$("expBtn").classList.toggle("chosen",t==="expense");$("incBtn").classList.toggle("chosen",t==="income");$("expensePanel").style.display=t==="expense"?"block":"none";$("incomePanel").style.display=t==="income"?"block":"none"}
function pickCategory(type,id){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===id);if(!c)return;setCategoryValue(type,c.name)}
function pickSubCategory(type,catId,childId){const c=(type==="expense"?data.expenseCats:data.incomeCats).find(x=>x.id===catId);const ch=c?.children?.find(x=>x.id===childId);if(!c||!ch)return;setCategoryValue(type,c.name+" - "+ch.name)}
function setCategoryValue(type,name){
  const valEl=$(type==="expense"?"cat":"incat"), labelEl=$(type==="expense"?"catLabel":"incatLabel");
  if(valEl)valEl.value=name; if(labelEl)labelEl.textContent="دسته: "+name;
  refreshCategoryButtonsInTxForm(type);
}
/* v3.4: «دسته‌ها» از منوی کناری حذف و به همین‌جا (داخل فرم ثبت تراکنش)
 * منتقل شد — با یک دکمه ＋ برای افزودن دسته، ✏️ برای ویرایش دسته‌ی
 * انتخاب‌شده و 🗑 برای حذفش، درست روبه‌روی انتخاب دسته. مدیریت کامل‌تر
 * (زیرمجموعه‌ها) هنوز از طریق openCategory() ممکن است. */
function refreshCategoryButtonsInTxForm(type){
  const wrap=$(type==="expense"?"expenseCatButtons":"incomeCatButtons");
  const valEl=$(type==="expense"?"cat":"incat");
  if(wrap)wrap.innerHTML=categoryButtons(type,valEl?.value||"");
}
function findCategoryBySelectedName(type,name){
  if(!name)return null;
  const arr=type==="expense"?data.expenseCats:data.incomeCats;
  const parts=name.split(" - ");
  const cat=arr.find(c=>c.name===parts[0]);
  if(!cat)return null;
  if(parts.length>1){const child=(cat.children||[]).find(ch=>ch.name===parts[1]);return child?{cat,child}:null}
  return {cat,child:null};
}
function quickAddCategory(type){
  const n=prompt("نام دسته جدید:");if(!n?.trim())return;
  const arr=type==="expense"?data.expenseCats:data.incomeCats;
  const nc=touch({id:uid(),name:n.trim(),children:[]});
  arr.push(nc);markDirty(type==="expense"?"expenseCats":"incomeCats",nc.id,false,nc,nc.updatedAt);save();
  logEvent("ایجاد دسته",n.trim(),"create");
  refreshCategoryButtonsInTxForm(type);
}
function quickEditCategory(type){
  const valEl=$(type==="expense"?"cat":"incat");
  const found=findCategoryBySelectedName(type,valEl?.value||"");
  if(!found)return alert("اول یک دسته را از لیست انتخاب کن");
  if(found.child){
    const n=prompt("نام جدید:",found.child.name);if(!n?.trim())return;
    const oldFull=found.cat.name+" - "+found.child.name;found.child.name=n.trim();const newFull=found.cat.name+" - "+found.child.name;
    touch(found.cat);markDirty(type==="expense"?"expenseCats":"incomeCats",found.cat.id,false,found.cat,found.cat.updatedAt);
    data.transactions.forEach(t=>{if(t.category===oldFull){t.category=newFull;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}});
    save();
    if(valEl&&valEl.value===oldFull)setCategoryValue(type,newFull);else refreshCategoryButtonsInTxForm(type);
  }else{
    const n=prompt("نام جدید:",found.cat.name);if(!n?.trim())return;
    const old=found.cat.name;found.cat.name=n.trim();
    touch(found.cat);markDirty(type==="expense"?"expenseCats":"incomeCats",found.cat.id,false,found.cat,found.cat.updatedAt);
    data.transactions.forEach(t=>{
      if(t.category===old){t.category=found.cat.name;touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}
      else if(String(t.category||"").startsWith(old+" - ")){t.category=found.cat.name+t.category.slice(old.length);touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}
    });
    save();
    if(valEl&&valEl.value===old)setCategoryValue(type,found.cat.name);else refreshCategoryButtonsInTxForm(type);
  }
}
function quickDeleteCategory(type){
  const valEl=$(type==="expense"?"cat":"incat");
  const found=findCategoryBySelectedName(type,valEl?.value||"");
  if(!found)return alert("اول یک دسته را از لیست انتخاب کن");
  if(found.child){
    if(!confirm("این زیرمجموعه حذف شود؟"))return;
    found.cat.children=(found.cat.children||[]).filter(x=>x.id!==found.child.id);
    touch(found.cat);markDirty(type==="expense"?"expenseCats":"incomeCats",found.cat.id,false,found.cat,found.cat.updatedAt);save();
  }else{
    if(!confirm("این دسته و همه زیرمجموعه‌های آن حذف شود؟"))return;
    removeRecord(type==="expense"?"expenseCats":"incomeCats",found.cat.id);
  }
  if(valEl)valEl.value="";
  const labelEl=$(type==="expense"?"catLabel":"incatLabel");if(labelEl)labelEl.textContent="دسته را انتخاب کنید";
  refreshCategoryButtonsInTxForm(type);
}
async function saveTx(id){
 const amount=parseMoney($("amount").value),type=$("txKind").value,category=type==="expense"?$("cat").value:$("incat").value;
 if(!amount)return alert("مبلغ را وارد کنید");if(!category)return alert("دسته را انتخاب کنید");
 const recur=$("txRecur")?.value||"none";
 const images=txImagesTemp.slice(0,TX_IMAGES_MAX);
 let t;
 if(id){
  t=data.transactions.find(x=>x.id===id); if(!t)return;
  Object.assign(t,{title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value});
  delete t.image;if(images.length)t.images=images;else delete t.images;
  applyRecurSetting(t,recur);
  touch(t);markDirty("transactions",t.id,false,t,t.updatedAt);
 }else{
  t=touch({id:uid(),title:$("title").value.trim()||category,amount,type,category,accountID:$("acc").value,date:new Date().toISOString(),source:"manual"});
  if(images.length)t.images=images;
  applyRecurSetting(t,recur);
  data.transactions.unshift(t);markDirty("transactions",t.id,false,t,t.updatedAt);
 }
 if(!saveWithAttachments(t))return;
 logEvent(id?"ویرایش تراکنش":"ایجاد تراکنش",`${$("title").value.trim()||category} • ${money(amount)}`,id?"edit":"create");closeModal()
}
function applyRecurSetting(t,recur){
  if(recur==="none"){delete t.recurring;delete t.recurNext;return}
  if(t.recurring!==recur||!t.recurNext){
    const base=t.date?new Date(t.date):new Date();
    const nxt=nextRecurDate(base,recur);
    t.recurring=recur;t.recurNext=nxt?nxt.toISOString():null;
  }
}
function nextRecurDate(d,freq){if(freq==="weekly")return new Date(d.getTime()+7*86400000);if(freq==="monthly")return addMonthsSafe(d,1);return null}
function processRecurringTransactions(){
  const now=new Date();let anyChanged=false;
  data.transactions.filter(t=>t.recurring&&t.recurring!=="none"&&t.recurNext).forEach(t=>{
    let guard=0,tChanged=false;
    while(t.recurNext&&new Date(t.recurNext)<=now&&guard++<36){
      const inst=touch({...JSON.parse(JSON.stringify(t)),id:uid(),date:t.recurNext,source:"recurring",recurSourceId:t.id});
      delete inst.recurring;delete inst.recurNext;
      data.transactions.unshift(inst);markDirty("transactions",inst.id,false,inst,inst.updatedAt);
      logEvent("تراکنش تکرارشونده",`${inst.title} • ${money(inst.amount)}`,"create");
      const nxt=nextRecurDate(new Date(t.recurNext),t.recurring);
      t.recurNext=nxt?nxt.toISOString():null;
      tChanged=true;anyChanged=true;
    }
    if(tChanged){touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}
  });
  if(anyChanged){persistLocal();render()}
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
/* v3.12: انتخاب چند عکس برای پیوست تراکنش (حداکثر TX_IMAGES_MAX عکس)؛
   عکس‌های قبلی (در ویرایش) و عکس‌های تازه انتخاب‌شده همه در txImagesTemp
   نگه‌داری می‌شوند تا با یک دکمه ضربدر هرکدام جدا حذف شوند. */
async function handleTxImageSelect(input){
 const files=Array.from(input?.files||[]);input.value="";if(!files.length)return;
 const remain=TX_IMAGES_MAX-txImagesTemp.length;
 if(remain<=0){alert(`حداکثر ${fa(TX_IMAGES_MAX)} عکس می‌توانید پیوست کنید`);return}
 const toAdd=files.slice(0,remain);
 if(files.length>toAdd.length)alert(`فقط ${fa(toAdd.length)} عکس اضافه شد (سقف ${fa(TX_IMAGES_MAX)} عکس)`);
 for(const f of toAdd){
  try{txImagesTemp.push(await compressImage(f,1000,.6))}catch(e){console.warn(e)}
 }
 renderTxImagesPreview();
}
function removeTxImage(idx){txImagesTemp.splice(idx,1);renderTxImagesPreview()}
function txImagesPreviewHTML(){
 if(!txImagesTemp.length)return "";
 const items=txImagesTemp.map((src,i)=>`<div class="tx-img-item"><img src="${src}" alt="پیوست ${fa(i+1)}"><button type="button" class="tx-img-remove" title="حذف این عکس" onclick="removeTxImage(${i})">✕</button></div>`).join("");
 const counter=`<div class="tx-images-count">${fa(txImagesTemp.length)} از ${fa(TX_IMAGES_MAX)} عکس</div>`;
 return `<div class="tx-images-grid">${items}</div>${counter}`;
}
function renderTxImagesPreview(){const box=$("txImagePreview");if(box)box.innerHTML=txImagesPreviewHTML()}
function openBankMessage(){
  if(!data.accounts.length)return alert("ابتدا یک حساب اضافه کنید");
  openModal(`<h2>🏦 تشخیص پیامک بانکی</h2><div class="form">
    <select id="bma">${data.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}${a.bank?" • "+esc(a.bank):""}</option>`).join("")}</select>
    <select id="bmt"><option value="income">دریافتی / واریز</option><option value="expense">پرداخت / برداشت</option></select>
    <input id="bmaAmount" type="text" inputmode="numeric" class="amt-input" min="0" placeholder="مبلغ تراکنش">
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
/* v3.11: انتقال به «حساب دیگران» تا امروز فقط شماره کارت گیرنده را
   می‌گرفت. حالا روش انتقال هم مشخص می‌شود — «کارت به کارت» (شماره کارت
   ۱۶ رقمی) یا «انتقال به شبا» (شماره شبا) — و همان روش هم در عنوان
   پیش‌فرض تراکنش و هم در لیست «انتقال بین حساب‌ها» نمایش داده می‌شود. */
function openTransfer(id=null){
 const t=id&&data.transactions.find(x=>x.id===id);
 const mode=t?.destinationType||((t?.otherName||t?.otherCard||t?.otherSheba)?"other":"self");
 const method=t?.otherMethod==="sheba"?"sheba":"card";
 const fromId=t?.from||data.accounts[0]?.id||"";
 if(!fromId)return alert("ابتدا یک حساب اضافه کنید");
 openModal(`<h2>${t?"ویرایش انتقال":"انتقال / کارت‌به‌کارت"}</h2><div class="form">
 <label>نوع مقصد</label><div class="type-switch"><button type="button" id="selfTransferBtn" class="${mode==="self"?"chosen":""}" onclick="transferMode('self')">🏦 حساب خودم</button><button type="button" id="otherTransferBtn" class="${mode==="other"?"chosen":""}" onclick="transferMode('other')">👤 حساب دیگران</button></div>
 <input id="transferMode" type="hidden" value="${mode}"><div id="selfTransferPanel" style="display:${mode==="self"?"block":"none"}">${accountSelect("from",fromId)}<span style="text-align:center">↓</span>${accountSelect("to",t?.to||data.accounts.find(a=>a.id!==fromId)?.id||"")}</div>
 <div id="otherTransferPanel" style="display:${mode==="other"?"block":"none"}"><select id="otherFrom">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===fromId?"selected":""}>${esc(a.name)}</option>`).join("")}</select><input id="otherName" placeholder="نام صاحب حساب / گیرنده" value="${esc(t?.otherName||"")}">
   <label class="hint" style="display:block;margin:6px 2px 4px">روش انتقال</label>
   <div class="type-switch"><button type="button" id="otherMethodCardBtn" class="${method==="card"?"chosen":""}" onclick="otherTransferMethod('card')">💳 کارت به کارت</button><button type="button" id="otherMethodShebaBtn" class="${method==="sheba"?"chosen":""}" onclick="otherTransferMethod('sheba')">🏦 انتقال به شبا</button></div>
   <input id="otherMethod" type="hidden" value="${method}">
   <input id="otherCard" inputmode="numeric" maxlength="16" placeholder="شماره کارت گیرنده (۱۶ رقم)" value="${esc(t?.otherCard||"")}" style="display:${method==="card"?"block":"none"}">
   <input id="otherSheba" inputmode="numeric" maxlength="26" placeholder="شماره شبا گیرنده (IR + ۲۴ رقم)" value="${esc(t?.otherSheba||"")}" style="display:${method==="sheba"?"block":"none"}">
 </div>
 <input id="tam" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ" value="${fmtAmtValue(t?.amount)}"><input id="tnote" placeholder="توضیحات" value="${esc(t?.title||"")}"><button class="primary" onclick="saveTransfer('${t?.id||""}')">${t?"ذخیره تغییرات":"ثبت انتقال"}</button></div>`)
}
function transferMode(mode){$("transferMode").value=mode;$("selfTransferBtn").classList.toggle("chosen",mode==="self");$("otherTransferBtn").classList.toggle("chosen",mode==="other");$("selfTransferPanel").style.display=mode==="self"?"block":"none";$("otherTransferPanel").style.display=mode==="other"?"block":"none"}
function otherTransferMethod(method){$("otherMethod").value=method;$("otherMethodCardBtn").classList.toggle("chosen",method==="card");$("otherMethodShebaBtn").classList.toggle("chosen",method==="sheba");$("otherCard").style.display=method==="card"?"block":"none";$("otherSheba").style.display=method==="sheba"?"block":"none"}
function saveTransfer(id){
 const mode=$("transferMode").value,amount=parseMoney($("tam").value);if(!amount)return alert("مبلغ را وارد کنید");
 const method=mode==="other"?$("otherMethod").value:"";
 if(mode==="self"){
  if(!$("to").value||$("from").value===$("to").value)return alert("مبدأ و مقصد باید متفاوت باشند");
 }else{
  if(!$("otherName").value.trim())return alert("نام گیرنده را وارد کنید");
  if(method==="card"&&!$("otherCard").value.trim())return alert("شماره کارت گیرنده را وارد کنید");
  if(method==="sheba"&&!$("otherSheba").value.trim())return alert("شماره شبای گیرنده را وارد کنید");
 }
 const from=mode==="self"?$("from").value:$("otherFrom").value;
 const defaultTitle=mode==="other"?(method==="sheba"?"انتقال به شبا":"کارت‌به‌کارت"):"انتقال بین حساب‌ها";
 const o={title:$("tnote").value.trim()||defaultTitle,amount,type:"transfer",from,to:mode==="self"?$("to").value:null,source:"transfer",destinationType:mode,otherName:mode==="other"?$("otherName").value.trim():"",otherMethod:mode==="other"?method:"",otherCard:mode==="other"&&method==="card"?$("otherCard").value.trim():"",otherSheba:mode==="other"&&method==="sheba"?$("otherSheba").value.trim():""};
 if(id){const t=data.transactions.find(x=>x.id===id);if(!t)return;Object.assign(t,o);touch(t);markDirty("transactions",t.id,false,t,t.updatedAt)}else{const nt=touch({id:uid(),date:new Date().toISOString(),...o});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt)}save();logEvent(id?"ویرایش انتقال":"ایجاد انتقال",`${money(amount)} • ${mode==="other"?o.otherName:"حساب خودم"}`,id?"edit":"create");closeModal()
}
function deleteTx(id){if(confirm("این تراکنش حذف شود؟")){const t=data.transactions.find(x=>x.id===id);removeRecordToTrash("transactions",id);logEvent("حذف تراکنش",t?.title||id,"delete")}}
function categoryManageRow(type,c){
  const kids=c.children||[];
  const budgetRow=type==="expense"?`<div class="cat-budget-row"><span class="hint">💰 بودجه ماهانه:</span><input type="text" inputmode="numeric" class="amt-input" value="${fmtAmtValue(c.budget)}" placeholder="بدون سقف" onchange="setCategoryBudget('${c.id}',this.value)"></div>`:"";
  return `<div class="cat-manage-row">
    <div class="cat-manage-head"><b>${esc(c.name)}</b><div class="actions"><button title="افزودن زیرمجموعه" onclick="addSubCatPrompt('${type}','${c.id}')">🏷➕</button><button onclick="editCategory('${type}','${c.id}')">✏️</button><button class="danger-icon" onclick="removeCategory('${type}','${c.id}')">🗑</button></div></div>
    ${budgetRow}
    ${kids.length?`<div class="cat-sub-list">${kids.map(ch=>`<span class="cat-sub-chip">${esc(ch.name)}<button title="ویرایش" onclick="editSubCategory('${type}','${c.id}','${ch.id}')">✏️</button><button title="حذف" onclick="removeSubCategory('${type}','${c.id}','${ch.id}')">×</button></span>`).join("")}</div>`:`<div class="cat-sub-list"><button type="button" class="cat-sub-add" onclick="addSubCatPrompt('${type}','${c.id}')">＋ افزودن زیرمجموعه</button></div>`}
  </div>`;
}
function setCategoryBudget(id,val){const c=data.expenseCats.find(x=>x.id===id);if(!c)return;c.budget=Math.max(0,parseMoney(val)||0);touch(c);markDirty("expenseCats",c.id,false,c,c.updatedAt);save();renderBudgets();logEvent("تنظیم بودجه",`${c.name} • ${money(c.budget)}`,"edit")}
function budgetSpentByCategory(){
  const now=new Date(),m=now.getMonth(),y=now.getFullYear();
  const mt=data.transactions.filter(t=>t.type==="expense"&&(()=>{const d=new Date(t.date);return !isNaN(d)&&d.getMonth()===m&&d.getFullYear()===y})());
  const spent={};mt.forEach(t=>{const base=(t.category||"سایر").split(" - ")[0];spent[base]=(spent[base]||0)+Number(t.amount||0)});
  return spent;
}
function renderBudgets(){
  const box=$("budgetBox");if(!box)return;
  const cats=data.expenseCats.filter(c=>Number(c.budget)>0);
  if(!cats.length){box.innerHTML=`<p class="hint">هنوز برای هیچ دسته‌ای بودجه تعیین نکردی. از «تنظیمات دسته‌ها» یه سقف ماهانه بذار.</p>`;return}
  const spent=budgetSpentByCategory();
  box.innerHTML=cats.map(c=>{
    const s=spent[c.name]||0,pct=Math.min(100,Math.round(s/c.budget*100));
    const color=pct>=100?"#C1483A":pct>=80?"#D98E04":"#2F9E5B";
    return `<div class="budget-row"><div class="budget-row-head"><span>${esc(c.name)}</span><strong>${money(s)} / ${money(c.budget)}</strong></div><div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>${pct>=100?'<div class="hint" style="color:#C1483A">⚠️ از سقف بودجه رد شدی</div>':""}</div>`;
  }).join("");
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
 ${invField("قیمت خرید","تومان",`<input id="prdBuy" type="text" inputmode="numeric" class="amt-input" placeholder="۰" value="${fmtAmtValue(p?.buyPrice)}">`)}
 ${invField("قیمت فروش","تومان",`<input id="prdPrice" type="text" inputmode="numeric" class="amt-input" placeholder="۰" value="${fmtAmtValue(p?.price)}">`)}
 </div>
 <div class="two-fields">
 ${invField("موجودی فعلی","تعداد در انبار",`<input id="prdStock" type="text" class="num-input" inputmode="numeric" placeholder="۰" value="${Number(p?.stock)||""}">`)}
 ${invField("حداقل موجودی","برای هشدار موجودی کم",`<input id="prdMin" type="text" class="num-input" inputmode="numeric" placeholder="۰" value="${Number(p?.minStock)||""}">`)}
 </div>
 <button class="primary" onclick="saveProduct('${p?.id||""}')">💾 ذخیره</button></div>`)}
function saveProduct(id){const name=$("prdName").value.trim();if(!name)return alert("نام کالا را وارد کن");const o={name,code:$("prdCode").value.trim(),buyPrice:parseMoney($("prdBuy").value),price:parseMoney($("prdPrice").value),stock:Math.max(0,Number($("prdStock").value)||0),minStock:Math.max(0,Number($("prdMin").value)||0)};if(id){const p=data.products.find(x=>x.id===id);Object.assign(p,o);touch(p);markDirty("products",p.id,false,p,p.updatedAt)}else{const p=touch({id:uid(),...o});data.products.unshift(p);markDirty("products",p.id,false,p,p.updatedAt)}save();logEvent(id?"ویرایش کالا":"افزودن کالا",name,id?"edit":"create");closeModal()}
function deleteProduct(id){if(!confirm("این کالا حذف شود؟"))return;const p=data.products.find(x=>x.id===id);removeRecord("products",id);logEvent("حذف کالا",p?.name||id,"delete")}
/* v2.3 fix: renderProducts() existed but was never wired into render()'s
   per-page dispatch (every other page — customers, invoices, checks... —
   has a "pageActive" line like this one; products was missing it), so the
   کالا و انبار page never actually filled in and always looked empty no
   matter how many products existed. Also now shows a small summary
   (count / inventory value / low-stock count) and sorts low-stock items
   to the top, so shortages are the first thing seen. */
/* v3.8: added a live search box (name or code) above the list — with the
   catalog sitting behind a scroll on real inventories, finding one item by
   eye stopped being practical. Low-stock items are still pinned to the top,
   and now also get a highlighted row (item-low) so the ones needing
   restocking jump out instantly instead of blending into the rest. */
function renderProducts(){
 const box=$("productList");if(!box)return;
 const isLow=p=>Number(p.minStock)>0&&Number(p.stock)<=Number(p.minStock);
 const q=($("productSearchInput")?.value||"").trim().toLowerCase();
 const all=[...data.products].sort((a,b)=>(isLow(a)?0:1)-(isLow(b)?0:1));
 const lowCount=all.filter(isLow).length;
 const invValue=all.reduce((s,p)=>s+(Number(p.stock)||0)*(Number(p.buyPrice)||0),0);
 const sumBox=$("productSummary");
 if(sumBox)sumBox.innerHTML=all.length?`<div class="inventory-summary"><div class="inv-stat"><span>تعداد کالا</span><b>${fa(all.length)}</b></div><div class="inv-stat"><span>ارزش انبار (قیمت خرید)</span><b>${money(invValue)}</b></div><div class="inv-stat${lowCount?" warn":""}"><span>کسری موجودی</span><b>${lowCount?"⚠️ "+fa(lowCount):"۰"}</b></div></div>`:"";
 const list=q?all.filter(p=>String(p.name||"").toLowerCase().includes(q)||String(p.code||"").toLowerCase().includes(q)):all;
 box.innerHTML=list.map(p=>`<div class="item${isLow(p)?" item-low":""}"><div><b>📦 ${esc(p.name)}</b><div class="meta">${p.code?"کد: "+esc(p.code)+" • ":""}خرید: ${money(p.buyPrice||0)} • فروش: ${money(p.price)}</div><div class="meta">موجودی: ${fa(p.stock)} ${isLow(p)?" • ⚠️ موجودی کم":""}</div></div><div class="actions"><button onclick="openProduct('${p.id}')">✏️</button><button onclick="deleteProduct('${p.id}')" class="danger-icon">🗑</button></div></div>`).join("")||empty(q?"کالایی با این جستجو پیدا نشد":"هنوز کالایی ثبت نشده است")
}
/* v3.8: quick stock top-up — search a product and bump its quantity with a
   single ＋ tap, instead of opening the full edit form just to change one
   number. Stays open after each add so several items can be topped up in a
   row (handy right after the low-stock warning fires). */
function openStockAdjust(){
 openModal(`<h2>📈 افزایش موجودی کالا</h2><p class="hint">کالا را سرچ کن، تعداد اضافه‌شده را بنویس و روی ＋ بزن؛ موجودی خودکار جمع می‌شود.</p><input id="stockAdjSearch" class="search" type="text" placeholder="🔍 جستجوی کالا..." oninput="renderStockAdjustList()"><div id="stockAdjList" class="stock-adj-list"></div>`);
 renderStockAdjustList();
}
function renderStockAdjustList(){
 const box=$("stockAdjList");if(!box)return;
 const q=($("stockAdjSearch")?.value||"").trim().toLowerCase();
 const isLow=p=>Number(p.minStock)>0&&Number(p.stock)<=Number(p.minStock);
 const list=[...data.products].filter(p=>!q||String(p.name||"").toLowerCase().includes(q)||String(p.code||"").toLowerCase().includes(q)).sort((a,b)=>(isLow(a)?0:1)-(isLow(b)?0:1));
 box.innerHTML=list.map(p=>`<div class="item stock-adj-row${isLow(p)?" item-low":""}"><div><b>📦 ${esc(p.name)}</b><div class="meta">موجودی فعلی: ${fa(p.stock||0)}${isLow(p)?" • ⚠️ موجودی کم":""}</div></div><div class="stock-adj-controls"><input type="text" min="1" inputmode="numeric" class="num-input stock-adj-qty" placeholder="تعداد" id="qtyAdj_${p.id}" onkeydown="if(event.key==='Enter')increaseStock('${p.id}')"><button type="button" class="primary" onclick="increaseStock('${p.id}')">＋</button></div></div>`).join("")||empty(q?"کالایی با این جستجو پیدا نشد":"هنوز کالایی ثبت نشده است");
 bindAmountInputs(box);
}
function increaseStock(id){
 const input=$("qtyAdj_"+id);const qty=Number(input?.value);
 if(!qty||qty<=0)return alert("تعداد را وارد کن");
 const p=data.products.find(x=>x.id===id);if(!p)return;
 p.stock=Number(p.stock||0)+qty;touch(p);markDirty("products",p.id,false,p,p.updatedAt);save();
 logEvent("افزایش موجودی کالا",`${p.name} • +${fa(qty)}`,"edit");
 renderStockAdjustList();
 if(pageActive("products"))renderProducts();
}
function invoiceStockDelta(invoice){const m=new Map();for(const it of invoice?.items||[]){if(!it.productId)continue;m.set(it.productId,(m.get(it.productId)||0)+(Number(it.qty)||0));}return m}
function calculateStockDifference(oldInvoice,newInvoice){const m=new Map();for(const [id,q] of invoiceStockDelta(oldInvoice))m.set(id,(m.get(id)||0)+q);for(const [id,q] of invoiceStockDelta(newInvoice))m.set(id,(m.get(id)||0)-q);return m}
function applyInvoiceStock(invoice){adjustStockForInvoice(invoice,-1)}
function rollbackInvoiceStock(invoice){adjustStockForInvoice(invoice,+1)}
function adjustStockForInvoice(inv,dir){for(const it of inv?.items||[]){if(!it.productId)continue;const p=data.products.find(x=>x.id===it.productId);if(!p)continue;const next=Number(p.stock||0)+(dir*Number(it.qty||0));if(dir<0&&next<0){logEvent("کسری موجودی",`${p.name} • کسری ${fa(Math.abs(next))}`,"stock",false);p.stock=0;}else p.stock=next;touch(p);markDirty("products",p.id,false,p,p.updatedAt)}}

function openCustomer(id=null){const c=id&&data.customers.find(x=>x.id===id);openModal(`<h2>${c?"ویرایش مشتری":"مشتری جدید"}</h2><div class="form"><input id="cname" placeholder="نام مشتری" value="${esc(c?.name||"")}"><input id="cphone" inputmode="tel" placeholder="شماره تماس" value="${esc(c?.phone||"")}"><textarea id="caddress" placeholder="آدرس">${esc(c?.address||"")}</textarea><textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCustomer('${c?.id||""}')">💾 ذخیره</button></div>`)}
function saveCustomer(id){const name=$("cname").value.trim();if(!name)return alert("نام مشتری را وارد کن");const o={name,phone:$("cphone").value.trim(),address:$("caddress").value.trim(),note:$("cnote").value.trim()};if(id){const c=data.customers.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("customers",c.id,false,c,c.updatedAt)}else{const c=touch({id:uid(),...o});data.customers.unshift(c);markDirty("customers",c.id,false,c,c.updatedAt)}save();logEvent(id?"ویرایش مشتری":"ایجاد مشتری",name,id?"edit":"create");closeModal()}
function deleteCustomer(id){if(!confirm("این مشتری حذف شود؟"))return;const c=data.customers.find(x=>x.id===id);removeRecord("customers",id);logEvent("حذف مشتری",c?.name||id,"delete")}
function customerStats(c){const inv=data.invoices.filter(x=>x.customerId===c.id);return {count:inv.length,total:inv.reduce((s,x)=>s+invoiceTotal(x),0),paid:inv.reduce((s,x)=>s+Number(x.paid||0),0),due:inv.reduce((s,x)=>s+invoiceRemaining(x),0)}}
function renderCustomers(){const box=$("customerList");if(!box)return;box.innerHTML=data.customers.map(c=>{const st=customerStats(c);return `<div class="item"><div><b>👤 ${esc(c.name)}</b><div class="meta">${esc(c.phone||"بدون شماره")} • ${fa(st.count)} فاکتور</div><div class="meta">خرید: ${money(st.total)} • پرداخت: ${money(st.paid)} • مانده: ${money(st.due)}</div></div><div class="actions"><button onclick="openCustomer('${c.id}')">✏️</button><button title="صورت‌حساب PDF" onclick="shareCustomerStatement('${c.id}')">📄</button><button onclick="exportCustomerExcel('${c.id}')">📊</button><button onclick="deleteCustomer('${c.id}')" class="danger-icon">🗑</button></div></div>`}).join("")||empty("هنوز مشتری ثبت نشده است")}
function exportXLS(filename,headers,rows){const escHtml=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");const html=`<html><head><meta charset="UTF-8"></head><body><table><thead><tr>${headers.map(h=>`<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename.endsWith(".xls")?filename:filename+".xls";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function exportAccountExcel(id){const a=data.accounts.find(x=>x.id===id);if(!a)return;const tx=data.transactions.filter(t=>t.accountID===id||t.from===id||t.to===id).sort((x,y)=>String(x.date).localeCompare(String(y.date)));const rows=tx.map(t=>{const kind=t.type==="income"?"دریافتی":t.type==="expense"?"پرداختی":"انتقال";const other=t.type==="transfer"?(t.destinationType==="other"?(t.otherName||"دیگران"):data.accounts.find(x=>x.id===t.to)?.name||""):"";const sign=t.type==="income"?Number(t.amount||0):(t.type==="expense"||t.from===id)?-Number(t.amount||0):Number(t.amount||0);return [jalaliDateTimeInput(t.date),kind,t.title||"",data.accounts.find(x=>x.id===t.accountID)?.name||a.name,other,sign,accountBalance(a.id)]});exportXLS(`گزارش-${a.name}`,['تاریخ و ساعت ثبت','نوع','شرح','حساب','مقصد','مبلغ خالص','مانده حساب'],rows)}
function exportCustomerExcel(id){const c=data.customers.find(x=>x.id===id);if(!c)return;const inv=data.invoices.filter(x=>x.customerId===id);const rows=inv.map(x=>[invoiceDateLabel(x.date),x.number||"",x.name||"",invoiceTotal(x),Number(x.paid||0),invoiceRemaining(x),x.status==="paid"?"پرداخت کامل":x.status==="partial"?"پرداخت بخشی":"پرداخت نشده"]);exportXLS(`مشتری-${c.name}`,['تاریخ','شماره فاکتور','عنوان','مبلغ','پرداخت','مانده','وضعیت'],rows)}
/* ---- v3.11: صورت‌حساب PDF مشتری ----
 * دقیقاً مثل ساخت PDF تک‌فاکتور (drawInvoiceCanvas → canvasToPdfBytes)، اما
 * به‌جای یک فاکتور، همه‌ی فاکتورهای یک مشتری را در یک صفحه (با صفحه‌بندی
 * خودکار اگر ردیف‌ها زیاد باشند) جمع می‌کند و یک جمع‌بندی کلی بدهی/طلب در
 * پایین می‌آورد — تا بشود مستقیم برای مشتری فرستاد. کاملاً آفلاین و با
 * همان زیرساخت فعلی فاکتور. */
async function drawCustomerStatementCanvas(customer,scale=1){
 const b=data.branding||{};
 const inv=data.invoices.filter(x=>x.customerId===customer.id).sort((a,b2)=>(localDateFromInput(a.date)?.getTime()||0)-(localDateFromInput(b2.date)?.getTime()||0));
 const W=794, rowH=42, headH=250, H=Math.max(1000,headH+inv.length*rowH+140);
 const [logoImg]=await Promise.all([loadImg(b.logo)]);
 const c=document.createElement("canvas");c.width=W*scale;c.height=H*scale;const x=c.getContext("2d");
 x.scale(scale,scale);
 x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#17352b";x.textAlign="right";x.direction="rtl";
 if(logoImg)try{x.drawImage(logoImg,55,25,90,70)}catch(e){}
 x.font="bold 30px sans-serif";x.fillText("صورت‌حساب مشتری",W-45,55);
 x.font="bold 22px sans-serif";x.fillText(b.storeName||"",W-45,90);
 x.font="17px sans-serif";x.fillStyle="#56645f";x.fillText("تاریخ صدور: "+jalaliLabel(new Date().toISOString()),W-45,120);
 x.fillStyle="#17352b";x.font="bold 21px sans-serif";x.fillText("مشتری: "+(customer.name||""),W-45,160);
 x.font="16px sans-serif";x.fillStyle="#56645f";
 if(customer.phone)x.fillText("تماس: "+customer.phone,W-45,185);
 if(customer.address)x.fillText("آدرس: "+customer.address,W-45,208);
 let y=headH;x.fillStyle="#eaf2ee";x.fillRect(28,y-30,W-56,40);x.fillStyle="#17352b";x.font="bold 13px sans-serif";
 x.fillText("مانده",W-38,y-8);x.fillText("پرداخت",W-160,y-8);x.fillText("مبلغ کل",W-280,y-8);x.fillText("عنوان",W-420,y-8);x.fillText("شماره",W-580,y-8);x.fillText("تاریخ",W-680,y-8);
 x.font="14px sans-serif";
 inv.forEach((it,i)=>{y+=rowH;x.fillStyle=i%2?"#fafcfb":"#fff";x.fillRect(55,y-32,W-110,rowH);x.fillStyle="#23312c";
  x.fillText(money(invoiceRemaining(it)),W-38,y-6);x.fillText(money(Number(it.paid||0)),W-160,y-6);x.fillText(money(invoiceTotal(it)),W-280,y-6);
  x.fillText(String(it.name||"—").slice(0,22),W-420,y-6);x.fillText(it.number||"—",W-580,y-6);x.fillText(invoiceDateLabel(it.date),W-680,y-6);
 });
 y+=60;
 const totalAll=inv.reduce((s,it)=>s+invoiceTotal(it),0),paidAll=inv.reduce((s,it)=>s+Number(it.paid||0),0),dueAll=inv.reduce((s,it)=>s+invoiceRemaining(it),0);
 x.fillStyle="#eaf2ee";x.fillRect(28,y-30,W-56,90);x.fillStyle="#17352b";x.font="bold 16px sans-serif";
 x.fillText("جمع کل فاکتورها: "+money(totalAll),W-45,y);
 x.fillText("جمع پرداخت‌شده: "+money(paidAll),W-45,y+28);
 x.font="bold 20px sans-serif";x.fillStyle=dueAll>0?"#C1483A":"#2F9E5B";
 x.fillText("مانده کل: "+money(dueAll),W-45,y+62);
 return c;
}
async function buildCustomerStatementPdf(customer){
 const c=await drawCustomerStatementCanvas(customer);
 const bytes=canvasToPdfBytes(c);
 const filename=`صورتحساب-${(customer.name||"مشتری").replace(/[\\/:*?"<>|]/g,"_")}.pdf`;
 return {bytes,filename,blob:new Blob([bytes],{type:"application/pdf"})};
}
async function shareOrSaveCustomerStatementPdf(customer){
 const {bytes,filename,blob}=await buildCustomerStatementPdf(customer);
 const file=new File([blob],filename,{type:"application/pdf"});
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({title:filename,text:`صورت‌حساب ${customer.name||""}`,files:[file]});
   return true;
  }
 }catch(e){if(e?.name==="AbortError")return false}
 const fs=filesystemPlugin();
 if(fs){
  try{
   await fs.writeFile({path:`${INVOICE_PDF_FOLDER}/${filename}`,data:uint8ToBase64(bytes),directory:AUTO_BACKUP_DIRECTORY,recursive:true});
   alert(`صورت‌حساب ذخیره شد:\nDownload/حسابداری/فاکتورها/${filename}`);
   return true;
  }catch(e){console.warn("statement pdf native save failed",e)}
 }
 try{
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  alert("فایل PDF صورت‌حساب آماده دانلود شد.");
  return true;
 }catch(e){console.warn("statement pdf download failed",e);alert("ساخت PDF صورت‌حساب با خطا مواجه شد.");return false}
}
async function shareCustomerStatement(id){
 const c=data.customers.find(x=>x.id===id);if(!c)return;
 if(!data.invoices.some(x=>x.customerId===id))return alert("این مشتری هنوز فاکتوری ندارد.");
 await shareOrSaveCustomerStatementPdf(c);
}
function exportAllCustomersExcel(){const rows=data.customers.map(c=>{const st=customerStats(c);return [c.name,c.phone||"",st.count,st.total,st.paid,st.due]});exportXLS('همه-مشتریان',['نام مشتری','شماره تماس','تعداد فاکتور','مجموع خرید','مجموع پرداخت','مانده'],rows)}

function openPerson(id=null){
 const p=id&&data.people.find(x=>x.id===id);
 const instCount=p?.installments?.count||1;
 const instFreq=p?.installments?.frequency||"monthly";
 openModal(`<h2>${p?"ویرایش بدهکار/بستانکار":"بدهکار / بستانکار"}</h2><div class="form"><select id="pt"><option value="debt" ${p?.type==="debt"?"selected":""}>من بدهکارم</option><option value="credit" ${p?.type==="credit"?"selected":""}>من طلبکارم</option></select><input id="pn" placeholder="نام شخص" value="${esc(p?.name||"")}"><input id="pa" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ کل" value="${fmtAmtValue(p?.amount)}">${simpleDateField("pd",jalaliInputValue(p?.due||""))}${invField("تعداد اقساط","مثلاً ۴ قسط؛ برنامه خودش اقساط را می‌چیند",`<input id="pInstCount" type="text" class="num-input" inputmode="numeric" min="1" value="${instCount}">`)}${invField("فاصله اقساط","تاریخ و اعلان هر قسط خودکار ساخته می‌شود",`<select id="pInstFreq"><option value="monthly" ${instFreq==="monthly"?"selected":""}>ماهانه</option><option value="weekly" ${instFreq==="weekly"?"selected":""}>هفتگی</option></select>`)}<textarea id="pnote" placeholder="توضیحات">${esc(p?.note||"")}</textarea><button class="primary" onclick="savePerson('${p?.id||""}')">${p?"ذخیره تغییرات":"ذخیره"}</button></div>`)
}
function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function generateInstallments(amount,count,startISO,frequency="monthly"){
  count=Math.max(1,Math.floor(count)||1);
  frequency=frequency==="weekly"?"weekly":"monthly";
  const base=Math.floor(amount/count);
  let startDate=startISO?localDateFromInput(startISO):new Date();
  if(Number.isNaN(startDate.getTime()))startDate=new Date();
  startDate.setHours(12,0,0,0);
  const items=[];
  for(let i=0;i<count;i++){
    const due=frequency==="weekly"?new Date(startDate.getTime()+i*7*86400000):addMonthsSafe(startDate,i);
    const amt=i===count-1?amount-base*(count-1):base;
    items.push({id:uid(),amount:amt,due:localDateKey(due),paid:false,paidAt:""});
  }
  return {count,frequency,items};
}
/* v2.7.3: تغییر «تعداد اقساط» یک بدهکار/بستانکار موجود، دیگر کل برنامه‌ی اقساط را
 * از صفر نمی‌سازد (که باعث می‌شد اقساط قبلاً پرداخت‌شده و تراکنش/تأثیرشان روی
 * موجودی حساب، از دید خارج شود و «پرداخت‌شده» صفر بشود). حالا فقط اقساطِ
 * پرداخت‌نشده جایگزین می‌شوند؛ اقساط پرداخت‌شده (و تراکنش واقعی متصل به هرکدام،
 * که موجودی حساب از روی آن حساب می‌شود) دست‌نخورده می‌مانند. اگر عدد جدید کمتر
 * از تعداد اقساط پرداخت‌شده باشد، اجازه‌ی کوچک‌تر شدن داده نمی‌شود. */
function rebuildInstallmentsForCountChange(p,amount,instCount,dueISO,frequency="monthly"){
  const oldItems=p.installments?.items||[];
  const paidItems=oldItems.filter(x=>x.paid);
  const paidCount=paidItems.length;
  const paidTotal=paidItems.reduce((s,x)=>s+(Number(x.amount)||0),0);
  if(instCount<paidCount){
    alert(`چون ${fa(paidCount)} قسط قبلاً پرداخت شده، تعداد اقساط نمی‌تواند کمتر از ${fa(paidCount)} باشد. تعداد اقساط روی ${fa(paidCount)} نگه داشته شد.`);
    instCount=paidCount;
  }
  const remainingCount=instCount-paidCount;
  const remainingAmount=Math.max(0,amount-paidTotal);
  const newUnpaidItems=[];
  if(remainingCount>0){
    let startDate;
    if(paidCount>0){
      const lastPaidDue=paidItems[paidItems.length-1].due;
      const baseDate=lastPaidDue?localDateFromInput(lastPaidDue):new Date();
      startDate=frequency==="weekly"?new Date(baseDate.getTime()+7*86400000):addMonthsSafe(baseDate,1);
    }else{
      /* v1.4 fix: اینجا برخلاف generateInstallments از new Date(dueISO) به‌جای
       * localDateFromInput استفاده می‌شد؛ چون dueISO فقط یک تاریخ («۱۴۰۵/۰۷/۰۴»
       * تبدیل‌شده به «۲۰۲۶-۰۹-۲۶») است و new Date() رشته‌ی تاریخِ بدون ساعت را
       * UTC می‌خواند نه محلی، این ناهماهنگی می‌توانست باعث جابه‌جایی یک‌روزه در
       * تاریخ سررسید اقساط بازسازی‌شده شود. */
      startDate=dueISO?localDateFromInput(dueISO):new Date();
    }
    if(Number.isNaN(startDate.getTime()))startDate=new Date();
    const base=Math.floor(remainingAmount/remainingCount);
    for(let i=0;i<remainingCount;i++){
      const dueDate=frequency==="weekly"?new Date(startDate.getTime()+i*7*86400000):addMonthsSafe(startDate,i);
      dueDate.setHours(12,0,0,0);
      const amt=i===remainingCount-1?remainingAmount-base*(remainingCount-1):base;
      newUnpaidItems.push({id:uid(),amount:amt,due:localDateKey(dueDate),paid:false,paidAt:""});
    }
  }
  p.paid=paidTotal;
  return {count:instCount,frequency,items:[...paidItems,...newUnpaidItems]};
}
function savePerson(id){
  const name=$("pn").value.trim(),amount=parseMoney($("pa").value);
  if(!name||!amount)return alert("نام و مبلغ را وارد کنید");
  const instCount=Math.max(1,parseInt($("pInstCount")?.value)||1);
  const instFreq=$("pInstFreq")?.value==="weekly"?"weekly":"monthly";
  const due=jalaliToISO($("pd").value);
  const o={type:$("pt").value,name,amount,due,note:$("pnote").value.trim()};
  if(id){
    const p=data.people.find(x=>x.id===id);if(!p)return alert("این شخص پیدا نشد");
    const prevCount=p.installments?.count||1;
    const prevFreq=p.installments?.frequency||"monthly";
    const prevAmount=Number(p.amount)||0;
    const prevDue=p.due||"";
    Object.assign(p,o);
    if(instCount>1){
      if(!p.installments){
        p.installments=generateInstallments(amount,instCount,due,instFreq);p.paid=0;
      /* v3.5 fix: قبلاً وقتی فقط «مبلغ کل» یا «تاریخ» تغییر می‌کرد ولی تعداد/فاصله
       * اقساط همان‌ها می‌ماندند، برنامه‌ی اقساط دوباره ساخته نمی‌شد؛ در نتیجه
       * ویرایش ذخیره می‌شد ولی مبلغ هر قسط با مبلغ کل جدید هم‌خوان نبود. حالا
       * تغییر مبلغ یا تاریخ هم مثل تغییر تعداد/فاصله باعث بازسازی اقساطِ
       * پرداخت‌نشده می‌شود (اقساط پرداخت‌شده دست‌نخورده می‌مانند). */
      }else if(instCount!==prevCount||instFreq!==prevFreq||amount!==prevAmount||due!==prevDue){
        p.installments=rebuildInstallmentsForCountChange(p,amount,instCount,due,instFreq);
      }
    }else if(p.installments){
      p.paid=p.installments.items.filter(x=>x.paid).reduce((s,x)=>s+(Number(x.amount)||0),0);
      delete p.installments;
    }
    p.paid=Math.min(Number(p.paid)||0,amount);
    touch(p);markDirty("people",p.id,false,p,p.updatedAt);
  }else{
    const np=touch({id:uid(),paid:0,...o});
    if(instCount>1)np.installments=generateInstallments(amount,instCount,due,instFreq);
    data.people.push(np);markDirty("people",np.id,false,np,np.updatedAt);
  }
  persistLocal();render();syncSave();logEvent(id?"ویرایش شخص":"ایجاد شخص",`${name} • ${money(amount)}`,id?"edit":"create");closeModal();
  upsertRemindersForPerson(id?data.people.find(x=>x.id===id):data.people[data.people.length-1]).catch(console.error);
}
function deletePerson(id){if(confirm("این مورد حذف شود؟")){const p=data.people.find(x=>x.id===id);if(p?.invoiceId){const inv=data.invoices.find(x=>x.id===p.invoiceId);if(inv){inv.personId="";touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt)}}removeRemindersForPerson(id).catch(console.error);removeRecord("people",id);logEvent("حذف شخص",p?.name||id,"delete")}}
function payPerson(id){openPersonPayment(id)}
function openPersonPayment(id){
  const p=data.people.find(x=>x.id===id);if(!p)return;
  if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");
  const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));
  const accLabel=p.type==="credit"?"واریز به حساب":"پرداخت از حساب";
  const defAcc=data.accounts.find(a=>a.default)?.id||data.accounts[0].id;
  openModal(`<h2>💳 تسویه ${esc(p.name)}</h2><div class="form"><p class="hint">مانده فعلی: ${money(remaining)}</p><input id="ppAmount" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ تسویه" value="${fmtAmtValue(remaining)}">${invField(accLabel,"این تسویه در این حساب ثبت می‌شود",accountSelect("ppAccount",defAcc))}<label class="file-label">📎 عکس رسید ${p.type==="credit"?"دریافتی":"واریزی"} (اختیاری)<input id="ppImage" type="file" accept="image/*" onchange="previewPersonPaymentImage(this)"></label><div id="ppImagePreview"></div><button class="primary" onclick="confirmPersonPayment('${p.id}')">✅ ثبت تسویه</button></div>`);
}
function previewPersonPaymentImage(input){
  const f=input?.files?.[0],box=$("ppImagePreview");if(!box||!f)return;
  const r=new FileReader();r.onload=()=>box.innerHTML=`<div class="attachment-preview"><img src="${r.result}" alt="پیش‌نمایش"></div>`;r.readAsDataURL(f)
}
async function confirmPersonPayment(id){
  const p=data.people.find(x=>x.id===id);if(!p)return;
  let n;try{n=positiveMoney($("ppAmount")?.value||"","مبلغ پرداخت")}catch(e){return alert(e.message)}
  const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));
  if(n>remaining)return alert(`مبلغ پرداخت (${money(n)}) بیشتر از مانده (${money(remaining)}) است`);
  const accountID=$("ppAccount")?.value;if(!accountID)return alert("حساب را انتخاب کنید");
  let receipt=null;const file=$("ppImage")?.files?.[0];
  if(file){try{receipt=await compressImage(file,1200,.72)}catch(e){console.warn(e)}}
  p.paid=Math.min(Number(p.amount)||0,(Number(p.paid)||0)+n);
  touch(p);markDirty("people",p.id,false,p,p.updatedAt);
  const txType=p.type==="credit"?"income":"expense";
  const category=p.type==="credit"?"دریافت طلب":"پرداخت بدهی";
  const nt=touch({id:uid(),title:`تسویه ${p.name}`,amount:n,type:txType,category,accountID,date:new Date().toISOString(),source:"person-settle",personId:p.id});
  if(receipt)nt.image=receipt;
  data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);
  syncInvoiceFromPerson(p);
  if(!saveWithAttachments(nt))return;
  logEvent("تسویه شخص",`${p.name} • ${money(n)} • ${data.accounts.find(a=>a.id===accountID)?.name||""}`,"payment");
  upsertRemindersForPerson(p).catch(console.error);
  closeModal();
}
function installmentStatus(it){
  if(it.paid)return {cls:"paid",label:"پرداخت‌شده",icon:"✓"};
  const due=localDateFromInput(it.due); const now=new Date();
  if(due){due.setHours(23,59,59,999); const diff=Math.ceil((due-now)/86400000); if(diff<0)return {cls:"overdue",label:"عقب‌افتاده",icon:"!"}; if(diff<=3)return {cls:"soon",label:"نزدیک سررسید",icon:"⏰"};}
  return {cls:"pending",label:"در انتظار",icon:"○"};
}
function installmentSummaryHTML(p,items){
  const paid=items.filter(x=>x.paid), paidTotal=paid.reduce((s,x)=>s+(Number(x.amount)||0),0);
  const total=Number(p.amount)||items.reduce((s,x)=>s+(Number(x.amount)||0),0), remaining=Math.max(0,total-paidTotal);
  const pct=total?Math.min(100,Math.round(paidTotal/total*100)):0;
  const next=items.find(x=>!x.paid&&x.due);
  const freq=p.installments?.frequency==="weekly"?"هفتگی":"ماهانه";
  return `<div class="inst-hero">
    <div class="inst-hero-top"><div><span class="inst-eyebrow">برنامه اقساط</span><h3>${esc(p.name)}</h3><span class="inst-freq">${freq} • ${fa(items.length)} قسط</span></div><div class="inst-hero-icon">${p.type==="credit"?"↗":"↙"}</div></div>
    <div class="inst-total"><span>مانده</span><strong>${money(remaining)}</strong></div>
    <div class="inst-progress"><div class="inst-progress-fill" style="width:${pct}%"></div></div>
    <div class="inst-progress-meta"><span>${fa(paid.length)} از ${fa(items.length)} قسط</span><b>${fa(pct)}٪</b></div>
    <div class="inst-stats"><div><span>کل</span><b>${money(total)}</b></div><div><span>پرداخت‌شده</span><b>${money(paidTotal)}</b></div><div><span>قسط بعدی</span><b>${next?jalaliLabel(next.due):"—"}</b></div></div>
  </div>`;
}
function openInstallments(id){
  const p=data.people.find(x=>x.id===id);if(!p?.installments)return;
  const items=p.installments.items||[];
  openModal(`<div class="inst-modal-head"><div><span class="inst-modal-kicker">مدیریت مالی</span><h2>📅 برنامه اقساط</h2></div><button type="button" class="inst-close-hint" onclick="closeModal()">بستن</button></div><div id="installmentsBox">${installmentSummaryHTML(p,items)}<div class="inst-list-head"><b>ریز اقساط</b><span>${fa(items.filter(x=>!x.paid).length)} قسط باقی‌مانده</span></div>${items.map((it,i)=>installmentRowHTML(p,it,i)).join("")}</div>`);
}
function installmentRowHTML(p,it,i){
  const receiptThumb=it.receipt?`<div class="inst-receipt"><img class="tx-thumb" src="${it.receipt}" alt="رسید" onclick="viewInstallmentImage('${p.id}','${it.id}')"><span>رسید</span></div>`:"";
  const st=installmentStatus(it);
  return `<div class="inst-card ${st.cls}">
    <div class="inst-card-main"><div class="inst-number">${fa(i+1)}</div><div class="inst-card-info"><div class="inst-title-row"><b>قسط ${fa(i+1)}</b><span class="inst-status ${st.cls}">${st.icon} ${st.label}</span></div><div class="inst-due">${it.paid?"پرداخت در "+jalaliLabel(it.paidAt):"سررسید "+jalaliLabel(it.due)}</div>${receiptThumb}</div></div>
    <div class="inst-card-side"><strong>${money(it.amount)}</strong><div class="actions"><button type="button" class="${it.paid?"":"primary"}" onclick="toggleInstallment('${p.id}','${it.id}')">${it.paid?"↩️ لغو پرداخت":"✅ پرداخت"}</button><button type="button" class="inst-receipt-btn" onclick="pickInstallmentReceipt('${p.id}','${it.id}')">🖼 ${it.receipt?"رسید":"افزودن"}</button></div></div>
  </div>`;
}
function pickInstallmentReceipt(personId,instId){
  const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
  inp.onchange=async()=>{
    const f=inp.files?.[0];if(!f)return;
    const p=data.people.find(x=>x.id===personId);if(!p?.installments)return;
    const it=p.installments.items.find(x=>x.id===instId);if(!it)return;
    try{
      it.receipt=await compressImage(f,1000,.6);
      let linkedTx=null;
      if(it.txId){linkedTx=data.transactions.find(x=>x.id===it.txId);if(linkedTx){linkedTx.image=it.receipt;touch(linkedTx);markDirty("transactions",linkedTx.id,false,linkedTx,linkedTx.updatedAt)}}
      touch(p);markDirty("people",p.id,false,p,p.updatedAt);
      if(!saveWithAttachments([it,linkedTx]))return;
      const box=$("installmentsBox");if(box)box.innerHTML=installmentSummaryHTML(p,p.installments.items)+`<div class="inst-list-head"><b>ریز اقساط</b><span>${fa(p.installments.items.filter(x=>!x.paid).length)} قسط باقی‌مانده</span></div>`+p.installments.items.map((x,i)=>installmentRowHTML(p,x,i)).join("");
      logEvent("عکس رسید قسط",`${p.name} • قسط ${fa(p.installments.items.indexOf(it)+1)}`,"payment");
    }catch(e){console.warn(e);alert("خطا در بارگذاری عکس رسید")}
  };
  inp.click();
}
function viewInstallmentImage(personId,instId){
  const p=data.people.find(x=>x.id===personId);const it=p?.installments?.items.find(x=>x.id===instId);if(!it?.receipt)return;
  imageViewerOpen([it.receipt],0);
}
function toggleInstallment(personId,instId){
  const p=data.people.find(x=>x.id===personId);if(!p?.installments)return;
  const it=p.installments.items.find(x=>x.id===instId);if(!it)return;
  if(it.paid){
    if(it.txId){removeRecordSilent("transactions",it.txId);it.txId=null}
    it.paid=false;it.paidAt="";
    p.paid=p.installments.items.filter(x=>x.paid).reduce((s,x)=>s+(Number(x.amount)||0),0);
    touch(p);markDirty("people",p.id,false,p,p.updatedAt);
    syncInvoiceFromPerson(p);save();
    logEvent("لغو پرداخت قسط",`${p.name} • ${money(it.amount)}`,"payment");
    upsertRemindersForPerson(p).catch(console.error);
    const box=$("installmentsBox");if(box)box.innerHTML=installmentSummaryHTML(p,p.installments.items)+`<div class="inst-list-head"><b>ریز اقساط</b><span>${fa(p.installments.items.filter(x=>!x.paid).length)} قسط باقی‌مانده</span></div>`+p.installments.items.map((x,i)=>installmentRowHTML(p,x,i)).join("");
    return;
  }
  openInstallmentPayment(personId,instId);
}
function openInstallmentPayment(personId,instId){
  const p=data.people.find(x=>x.id===personId);if(!p?.installments)return;
  const it=p.installments.items.find(x=>x.id===instId);if(!it)return;
  if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کنید");
  const accLabel=p.type==="credit"?"واریز به حساب":"پرداخت از حساب";
  const defAcc=data.accounts.find(a=>a.default)?.id||data.accounts[0].id;
  openModal(`<h2>💳 پرداخت قسط ${esc(p.name)}</h2><div class="form"><p class="hint">مبلغ این قسط: ${money(it.amount)}</p>${invField(accLabel,"این قسط در این حساب ثبت می‌شود",accountSelect("instAccount",defAcc))}<label class="file-label">📎 عکس رسید ${p.type==="credit"?"دریافتی":"واریزی"} (اختیاری)<input id="instImage" type="file" accept="image/*" onchange="previewInstImage(this)"></label>${it.receipt?`<div class="attachment-preview"><img src="${it.receipt}" alt="رسید"></div>`:""}<div id="instImagePreview"></div><button class="primary" onclick="confirmInstallmentPayment('${personId}','${instId}')">✅ ثبت پرداخت</button></div>`);
}
function previewInstImage(input){
  const f=input?.files?.[0],box=$("instImagePreview");if(!box||!f)return;
  const r=new FileReader();r.onload=()=>box.innerHTML=`<div class="attachment-preview"><img src="${r.result}" alt="پیش‌نمایش"></div>`;r.readAsDataURL(f)
}
async function confirmInstallmentPayment(personId,instId){
  const p=data.people.find(x=>x.id===personId);if(!p?.installments)return;
  const it=p.installments.items.find(x=>x.id===instId);if(!it)return;
  if(it.paid)return alert("این قسط قبلاً پرداخت شده است");
  let installmentAmount;try{installmentAmount=positiveMoney(it.amount,"مبلغ قسط")}catch(e){return alert(e.message)}
  const accountID=$("instAccount")?.value;if(!accountID)return alert("حساب را انتخاب کنید");
  let receipt=it.receipt||null;const file=$("instImage")?.files?.[0];
  if(file){try{receipt=await compressImage(file,1000,.6)}catch(e){console.warn(e)}}
  it.paid=true;it.paidAt=new Date().toISOString();
  if(receipt)it.receipt=receipt;
  const txType=p.type==="credit"?"income":"expense";
  const category=p.type==="credit"?"دریافت طلب":"پرداخت بدهی";
  const nt=touch({id:uid(),title:`قسط ${p.name}`,amount:installmentAmount,type:txType,category,accountID,date:new Date().toISOString(),source:"installment",personId:p.id,installmentId:it.id});
  if(receipt)nt.image=receipt;
  data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);
  it.txId=nt.id;
  p.paid=p.installments.items.filter(x=>x.paid).reduce((s,x)=>s+(Number(x.amount)||0),0);
  touch(p);markDirty("people",p.id,false,p,p.updatedAt);
  const linkedInvoiceId=p.invoiceId;
  syncInvoiceFromPerson(p);
  if(!saveWithAttachments([it,nt]))return;
  logEvent("پرداخت قسط",`${p.name} • ${money(it.amount)} • ${data.accounts.find(a=>a.id===accountID)?.name||""}`,"payment");
  upsertRemindersForPerson(p).catch(console.error);
  closeModal();
  if(!linkedInvoiceId||data.people.find(x=>x.id===personId))openInstallments(personId);
}

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

function noteFormInner(n){
 const items=(n?.items||[]);
 return `<input id="ntitle" placeholder="عنوان یادداشت، مثلاً خرید" value="${esc(n?.title||"")}">${pickerBox("ndatePicker","ntimePicker",n?.date||new Date().toISOString())}<select id="nrepeat"><option value="none" ${!n?.repeat||n?.repeat==="none"?"selected":""}>بدون تکرار</option><option value="daily" ${n?.repeat==="daily"?"selected":""}>روزانه</option><option value="weekly" ${n?.repeat==="weekly"?"selected":""}>هفتگی</option><option value="monthly" ${n?.repeat==="monthly"?"selected":""}>ماهانه</option></select><textarea id="ntext" placeholder="توضیحات اصلی (اختیاری)">${esc(n?.text||"")}</textarea><div><b>آیتم‌های زیرمجموعه</b><div id="noteItemsEditor" class="note-items-editor">${items.map((it,i)=>noteItemEditor(it,i)).join("")}</div><button type="button" class="add-item-btn" onclick="addNoteItemEditor()">＋ افزودن آیتم</button></div><button class="primary" onclick="saveNote('${n?.id||""}')">${n?"ذخیره تغییرات":"ساخت یادداشت"}</button>${n?`<button type="button" class="danger" onclick="deleteNote('${n.id}')">🗑 حذف یادداشت</button>`:""}`;
}
function openNote(id=null){
 const n=id&&data.notes.find(x=>x.id===id);
 openModal(`<h2>${n?"ویرایش یادداشت":"یادداشت جدید"}</h2><div class="form">${noteFormInner(n)}</div>`);
}
function noteItemEditor(it={},i){return `<div class="note-edit-row"><div class="reorder-btns"><button type="button" title="انتقال به بالا" onclick="moveNoteItemEditorRow(this,-1)">▲</button><button type="button" title="انتقال به پایین" onclick="moveNoteItemEditorRow(this,1)">▼</button></div><input type="checkbox" class="note-item-done" title="انجام شد" ${it.done?"checked":""}><input class="note-item-input" data-note-item="${i}" data-note-item-id="${esc(it.id||"")}" placeholder="مثلاً خرید نان" value="${esc(it.text||"")}"><button type="button" class="mini-danger" onclick="this.parentElement.remove()">🗑</button></div>`}
function moveNoteItemEditorRow(btn,dir){const row=btn.closest(".note-edit-row");if(!row)return;const sib=dir<0?row.previousElementSibling:row.nextElementSibling;if(!sib)return;if(dir<0)row.parentElement.insertBefore(row,sib);else row.parentElement.insertBefore(sib,row)}
function addNoteItemEditor(){const box=$("noteItemsEditor");if(!box)return;const i=box.querySelectorAll(".note-item-input").length;box.insertAdjacentHTML("beforeend",noteItemEditor({},i))}
async function saveNote(id){
 const title=$("ntitle").value.trim(); if(!title)return alert("عنوان یادداشت را وارد کنید");
 const inputs=[...document.querySelectorAll(".note-item-input")];
 const old=id?data.notes.find(x=>x.id===id):null; const oldItems=old?.items||[];
 const items=inputs.map((el,i)=>{const oldItem=el.dataset.noteItemId?oldItems.find(x=>x.id===el.dataset.noteItemId):oldItems[i];const cb=el.parentElement?.querySelector(".note-item-done");const done=cb?cb.checked:!!oldItem?.done;return {id:oldItem?.id||uid(),text:el.value.trim(),done}}).filter(x=>x.text);
 const o={title,date:pickerToISO("ndatePicker","ntimePicker"),repeat:$("nrepeat").value,text:$("ntext").value.trim(),items};
 if(id){if(!old)return alert("یادداشت پیدا نشد");Object.assign(old,o);touch(old);markDirty("notes",old.id,false,old,old.updatedAt);save();await upsertReminderForNote(old)}
 else{const minOrder=data.notes.length?Math.min(...data.notes.map(n=>n.order??0)):0;const nn=touch({id:uid(),order:minOrder-1,...o});data.notes.unshift(nn);markDirty("notes",nn.id,false,nn,nn.updatedAt);save();await upsertReminderForNote(nn)}
 logEvent(id?"ویرایش یادداشت":"ایجاد یادداشت",title,id?"edit":"create");closeModal();
}
/* v2.7.1: تیک‌خوردن یک آیتم دیگر فقط خط‌خورده نشانش نمی‌دهد — چون در یادداشت‌های
   بلند همین باقی‌ماندن آیتم‌های انجام‌شده در لیست باعث شلوغی می‌شد. حالا به‌محض تیک
   خوردن، آیتم از لیست اصلی کنار می‌رود و زیر یک دکمهٔ جمع‌وجورِ «✓ تکمیل‌شده (n)»
   مخفی می‌شود؛ با زدن همان دکمه می‌شود لیست تکمیل‌شده‌ها را باز/بسته کرد یا از آنجا
   تیک را برداشت. خودِ آیتم هیچ‌وقت واقعاً حذف نمی‌شود، فقط از دید پنهان می‌شود. */
const doneListOpen=new Set();
function toggleDoneList(noteId){
 if(doneListOpen.has(noteId))doneListOpen.delete(noteId);else doneListOpen.add(noteId);
 const n=data.notes.find(x=>x.id===noteId);const card=document.querySelector(`[data-note-card="${CSS.escape(noteId)}"]`);
 if(card&&n){const list=card.querySelector(".note-checklist");if(list)list.innerHTML=noteChecklistHTML(n)}
}
function noteChecklistHTML(n){
 const items=n.items||[];
 if(!items.length)return '<div class="meta">هنوز آیتمی اضافه نشده</div>';
 const pending=items.filter(x=>!x.done),done=items.filter(x=>x.done);
 const showDone=doneListOpen.has(n.id);
 let html=pending.length?pending.map(it=>noteItemHTML(n,it,items.indexOf(it),items.length)).join(''):(done.length?'<div class="meta note-all-done">✓ همه آیتم‌ها انجام شد</div>':'');
 if(done.length){
  html+=`<button type="button" class="note-done-toggle" onclick="event.stopPropagation();toggleDoneList('${n.id}')">${showDone?'▲ پنهان کردن':'✓ تکمیل‌شده'} (${fa(done.length)})</button>`;
  if(showDone)html+='<div class="note-done-list">'+done.map(it=>noteItemHTML(n,it,items.indexOf(it),items.length)).join('')+'</div>';
 }
 return html;
}
async function toggleNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);const it=n?.items?.find(x=>x.id===itemId);if(!it)return;it.done=!it.done;touch(n);markDirty("notes",n.id,false,n,n.updatedAt);persistLocal();syncSave();await upsertReminderForNote(n,false);logEvent(it.done?"تکمیل آیتم یادداشت":"بازگردانی آیتم یادداشت",`${n.title} • ${it.text}`,"edit");const card=document.querySelector(`[data-note-card="${CSS.escape(noteId)}"]`);if(card){const list=card.querySelector(".note-checklist");if(list)list.innerHTML=noteChecklistHTML(n);const total=(n.items||[]).length,doneCount=(n.items||[]).filter(x=>x.done).length;const count=card.querySelector(".note-count");if(count)count.textContent=total?`${fa(doneCount)} / ${fa(total)}`:""}if($("notesTableView")&&$("notesTableView").style.display!=="none")$("notesTableView").innerHTML=notesWeekTableHTML();}
async function deleteNote(id){if(confirm("این یادداشت و همه آیتم‌های آن حذف شود؟")){const n=data.notes.find(x=>x.id===id);await removeReminderForNote(id);removeRecord("notes",id);logEvent("حذف یادداشت",n?.title||id,"delete");closeModal()}}
async function deleteNoteItem(noteId,itemId){const n=data.notes.find(x=>x.id===noteId);if(!n)return;if(confirm("این آیتم حذف شود؟")){n.items=(n.items||[]).filter(x=>x.id!==itemId);touch(n);markDirty("notes",n.id,false,n,n.updatedAt);persistLocal();syncSave();await upsertReminderForNote(n,false);logEvent("حذف آیتم یادداشت",n.title,"delete");const card=document.querySelector(`[data-note-card="${CSS.escape(noteId)}"]`);if(card){const total=(n.items||[]).length,doneCount=(n.items||[]).filter(x=>x.done).length;const count=card.querySelector(".note-count");if(count)count.textContent=total?`${fa(doneCount)} / ${fa(total)}`:"";const list=card.querySelector(".note-checklist");if(list)list.innerHTML=noteChecklistHTML(n)}}}
function noteRepeatLabel(r){return r==="daily"?"روزانه":r==="weekly"?"هفتگی":r==="monthly"?"ماهانه":"بدون تکرار"}
function noteItemHTML(n,it,i,total){
 const moveBtns=total>1?'<div class="reorder-btns" onclick="event.stopPropagation()"><button type="button" title="انتقال به بالا" '+(i===0?'disabled':'')+' onclick="event.stopPropagation();moveNoteItem(\''+n.id+'\',\''+it.id+'\',-1)">▲</button><button type="button" title="انتقال به پایین" '+(i===total-1?'disabled':'')+' onclick="event.stopPropagation();moveNoteItem(\''+n.id+'\',\''+it.id+'\',1)">▼</button></div>':'';
 return '<div class="note-check-row" data-note-row="'+esc(it.id)+'" onclick="event.stopPropagation()">'+moveBtns+'<label class="note-check-label" onclick="event.stopPropagation()"><input type="checkbox" '+(it.done?'checked':'')+' onclick="event.stopPropagation()" onchange="toggleNoteItem(\''+n.id+'\',\''+it.id+'\')"><span class="note-check-mark"></span><span class="'+(it.done?'done':'')+'">'+esc(it.text)+'</span></label><button type="button" class="mini-danger note-item-delete" title="حذف آیتم" onclick="event.stopPropagation();deleteNoteItem(\''+n.id+'\',\''+it.id+'\')">×</button></div>';
}
async function moveNoteItem(noteId,itemId,dir){
 const n=data.notes.find(x=>x.id===noteId); if(!n||!n.items)return;
 const idx=n.items.findIndex(x=>x.id===itemId); if(idx<0)return;
 const swapIdx=idx+dir; if(swapIdx<0||swapIdx>=n.items.length)return;
 [n.items[idx],n.items[swapIdx]]=[n.items[swapIdx],n.items[idx]];
 touch(n); markDirty("notes",n.id,false,n,n.updatedAt); save();
}
/* ---- Weekly (7-day) Jalali table view for notes ---- */
function openNotesWeekTable(){
 notesMode="table";
 goToPage("notes");
 render();
}
function setNotesMode(mode){
  notesMode=mode==="table"?"table":"list";
  notesWeekOffset=0;
  render();
}
function changeNotesWeek(dir){
  notesWeekOffset=dir===0?0:notesWeekOffset+dir;
  render();
}
function notesWeekStart(offset){
  const t=new Date();t.setHours(0,0,0,0);
  const j=gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate());
  const wd=jalaliWeekdayIndex(j[0],j[1],j[2]);
  return new Date(t.getTime()-wd*86400000+offset*7*86400000);
}
function noteOccursOnDay(n,day){
  if(!n.date)return false;
  const base=localDateFromInput(n.date);if(!base)return false;
  const b=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  const d=new Date(day.getFullYear(),day.getMonth(),day.getDate());
  if(d.getTime()<b.getTime())return false;
  const rep=n.repeat||"none";
  if(rep==="none")return d.getTime()===b.getTime();
  if(rep==="daily")return true;
  if(rep==="weekly")return d.getDay()===b.getDay();
  if(rep==="monthly")return d.getDate()===b.getDate();
  return false;
}
function reminderOccursOnDay(r,day){
  if(!r.date)return false;
  const base=localDateFromInput(r.date);if(!base)return false;
  const b=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  const d=new Date(day.getFullYear(),day.getMonth(),day.getDate());
  if(d.getTime()<b.getTime())return false;
  const rep=r.repeat||"once";
  if(rep==="once")return d.getTime()===b.getTime();
  if(rep==="daily")return true;
  if(rep==="weekly")return d.getDay()===b.getDay();
  if(rep==="monthly")return d.getDate()===b.getDate();
  return false;
}
const PERSIAN_WEEKDAY_NAMES=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
function notesWeekTableHTML(){
  const start=notesWeekStart(notesWeekOffset);
  const t=new Date();t.setHours(0,0,0,0);
  const j0=gregorianToJalali(start.getFullYear(),start.getMonth()+1,start.getDate());
  const j6d=new Date(start.getTime()+6*86400000);
  const j6=gregorianToJalali(j6d.getFullYear(),j6d.getMonth()+1,j6d.getDate());
  const rangeLabel=`${toFaDigits(j0[2])} ${PERSIAN_MONTHS[j0[1]-1]} تا ${toFaDigits(j6[2])} ${PERSIAN_MONTHS[j6[1]-1]} ${toFaDigits(j6[0])}`;
  const rows=[];
  for(let i=0;i<7;i++){
    const day=new Date(start.getTime()+i*86400000);
    const jd=gregorianToJalali(day.getFullYear(),day.getMonth()+1,day.getDate());
    const isToday=day.getTime()===t.getTime();
    /* v1.4 fix: وقتی همه‌ی آیتم‌های زیرمجموعه‌ی یک یادداشت تیک می‌خوردند (انجام
     * می‌شدند)، یادداشت همچنان در جدول هفتگی نمایش داده می‌شد، انگار هنوز کاری
     * باقی مانده. حالا اگر یادداشت حداقل یک آیتم داشته باشد و همه‌ی آیتم‌هایش
     * انجام‌شده باشند، از جدول هفتگی همان روز مخفی می‌شود (دقیقاً مثل یادآوری‌
     * که با ✓ از لیست هفتگی حذف می‌شود). یادداشت‌های بدون آیتم (فقط متنی) طبق
     * قبل همیشه نمایش داده می‌شوند. */
    /* v1.4.1 fix: نسخهٔ قبلی فقط وقتی «همهٔ» آیتم‌های یک یادداشت تیک می‌خوردند
     * کل یادداشت را از جدول هفتگی پنهان می‌کرد؛ اگر یادداشت چند آیتم داشت و
     * فقط یکی از آن‌ها تیک می‌خورد، یادداشت (با همان عنوان کلی) همچنان نمایش
     * داده می‌شد و انگار آن یک آیتمِ تیک‌خورده اصلاً پنهان نشده بود. حالا برای
     * یادداشت‌هایی که آیتم (چک‌لیست) دارند، به‌جای یک ردیفِ کلی برای کل
     * یادداشت، هر آیتمِ هنوز انجام‌نشده جداگانه در جدول هفتگی نمایش داده
     * می‌شود؛ به‌محض تیک‌خوردنِ همان آیتم، دقیقاً همان ردیف از جدول پنهان
     * می‌شود (و وقتی همهٔ آیتم‌ها تیک بخورند، یادداشت به‌طور کامل از آن روز
     * حذف می‌شود). یادداشت‌های بدون آیتم (فقط متنی) طبق قبل یک ردیف کلی دارند. */
    const dayNotes=data.notes.filter(n=>noteOccursOnDay(n,day)).flatMap(n=>{
      const items=n.items||[];
      if(!items.length)return [{kind:"note",id:n.id,title:n.title,date:n.date,order:n.order??0}];
      return items.filter(it=>!it.done).map(it=>({kind:"note",id:n.id,title:items.length>1?`${n.title}: ${it.text}`:n.title,date:n.date,order:n.order??0}));
    });
    const dayReminders=(data.reminders||[]).filter(r=>!r.sourceNoteId&&!r.sourcePersonId&&r.date&&reminderOccursOnDay(r,day)).map(r=>({kind:"reminder",id:r.id,title:r.title,date:r.date,order:r.order??0}));
    const dayPeople=personDueItemsOnDay(day).map(pp=>({kind:"person",id:pp.id,title:pp.title,date:null,order:0,ptype:pp.type}));
    /* اولویت‌بندی برنامه‌های هر روز بر اساس ساعت: هرچه زودتر، بالاتر؛ اگر ساعتی
       ثبت نشده باشد آخر لیست همان روز قرار می‌گیرد و ترتیب قبلی (order) حفظ می‌شود. */
    const dayItems=dayNotes.concat(dayReminders).concat(dayPeople).map(it=>{const d=it.date?localDateFromInput(it.date):null;return {...it,mins:d?d.getHours()*60+d.getMinutes():Infinity}}).sort((a,b)=>a.mins-b.mins||a.order-b.order);
    const chips=dayItems.length?dayItems.map(it=>{const timeLbl=Number.isFinite(it.mins)?`<span class="week-chip-time">${timeFa(it.date)}</span> `:"";if(it.kind==="reminder")return `<span class="week-chip-group"><button type="button" class="week-note-chip week-reminder-chip" onclick="openReminder('${it.id}')">🔔 ${timeLbl}${esc(it.title)}</button><button type="button" class="week-chip-done" title="حذف از لیست هفتگی" aria-label="حذف از لیست هفتگی" onclick="event.stopPropagation();dismissWeeklyReminder('${it.id}')">✓</button></span>`;if(it.kind==="person")return `<button type="button" class="week-note-chip week-person-chip${it.ptype==="credit"?" week-credit-chip":""}" onclick="openWeeklyPerson('${it.id}')">${it.ptype==="credit"?"💰":"⚠️"} ${esc(it.title)}</button>`;return `<button type="button" class="week-note-chip" onclick="openNote('${it.id}')">📝 ${timeLbl}${esc(it.title)}</button>`}).join(""):`<span class="meta">برنامه‌ای ثبت نشده</span>`;
    rows.push(`<tr class="${isToday?"week-today":""}"><td class="week-day-cell"><b>${PERSIAN_WEEKDAY_NAMES[i]}</b><div class="meta">${toFaDigits(jd[2])} ${PERSIAN_MONTHS[jd[1]-1]}</div></td><td class="week-notes-cell">${chips}</td></tr>`);
  }
  return `<div class="week-table-wrap"><div class="week-table-head"><button type="button" class="cal-nav" onclick="changeNotesWeek(-1)" aria-label="هفته قبل">❮</button><div><b>جدول هفتگی</b><div class="meta">${rangeLabel}</div></div><button type="button" class="cal-nav" onclick="changeNotesWeek(1)" aria-label="هفته بعد">❯</button></div><table class="week-table"><tbody>${rows.join("")}</tbody></table><button type="button" class="cal-today-btn" onclick="changeNotesWeek(0)">هفته جاری</button></div>`;
}
const openAccordions=new Set();
function noteHTML(n,pos){
 const items=n.items||[];
 const alarm=n.date?`<div class="meta note-alarm">⏰ آلارم جداگانه: ${jalaliDateTimeInput(n.date)} • ${noteRepeatLabel(n.repeat)}</div>`:'<div class="meta note-alarm">بدون آلارم</div>';
 const accId="note-"+n.id;const isOpen=openAccordions.has(accId);
 /* The header (this note card's own position among other notes) needs its
  * own up/down buttons visible right away — not buried inside the
  * collapsed accordion body, where only the checklist sub-items live.
  * So these sit in a row alongside the collapse button itself. */
 const moveBtns=pos?`<div class="reorder-btns note-head-move" onclick="event.stopPropagation()"><button type="button" title="انتقال یادداشت به بالا" ${pos.i===0?"disabled":""} onclick="event.stopPropagation();moveNote('${n.id}',-1)">▲</button><button type="button" title="انتقال یادداشت به پایین" ${pos.i===pos.total-1?"disabled":""} onclick="event.stopPropagation();moveNote('${n.id}',1)">▼</button></div>`:"";
 return `<div class="note-card item accordion-card${isOpen?' open':''}" data-note-card="${esc(n.id)}" data-acc-id="${accId}"><div class="accordion-head-row">${moveBtns}<button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span><span class="note-badge">📝</span> <b>${esc(n.title)}</b></span><span class="note-count">${items.length?fa(items.filter(x=>x.done).length)+' / '+fa(items.length):''}</span><span class="acc-arrow">⌄</span></button></div><div class="accordion-body"><div class="note-main">${n.text?'<div class="meta note-text">'+esc(n.text)+'</div>':''}${alarm}<div class="note-checklist">${noteChecklistHTML(n)}</div></div><div class="note-actions">${actionButtons('openNote','deleteNote',n.id)}</div></div></div>`;
}
function moveNote(id,dir){
 const sorted=[...data.notes].sort((a,b)=>(a.order??0)-(b.order??0));
 const pos=sorted.findIndex(n=>n.id===id); if(pos<0)return;
 const swapPos=pos+dir; if(swapPos<0||swapPos>=sorted.length)return;
 const a=sorted[pos],b=sorted[swapPos]; const tmp=a.order??pos; a.order=b.order??swapPos; b.order=tmp;
 touch(a);touch(b); markDirty("notes",a.id,false,a,a.updatedAt); markDirty("notes",b.id,false,b,b.updatedAt);
 save();
}
/* v3.4 fix: this used to just toggle an "open" class while CSS animated
 * max-height from 0 to a fixed, oversized cap (600px, or 3000px for
 * page-accordion). For a note with only one or two short items, the browser
 * still has to lay out and paint that whole oversized box on every open —
 * on a slower Android WebView that shows up as a visible stutter/lag right
 * as the item list appears, which is «با لگ باز میشه». Measuring the
 * section's real height and animating to that instead removes the wasted
 * layout work, so it opens smoothly regardless of how short or long the
 * content is. */
function toggleAccordion(btn,event){
 if(event)event.stopPropagation();
 const card=btn?.closest(".accordion-card");if(!card)return;
 const body=card.querySelector(".accordion-body");
 const open=!card.classList.contains("open");
 card.classList.toggle("open",open);
 btn.setAttribute("aria-expanded",String(open));
 const accId=card.dataset.accId;
 if(accId){if(open)openAccordions.add(accId);else openAccordions.delete(accId)}
 if(body){
  body.style.maxHeight=(open?body.scrollHeight:0)+"px";
  if(open)setTimeout(()=>{if(card.classList.contains("open"))body.style.maxHeight="none"},260);
 }
}


function reminderFormInner(r){
 return `<input id="rt" placeholder="عنوان" value="${esc(r?.title||"")}"><input id="ra" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ" value="${fmtAmtValue(r?.amount)}">${pickerBox("rdPicker","rtPicker",r?.date||new Date().toISOString())}<select id="rr"><option value="once" ${r?.repeat==="once"?"selected":""}>یک‌بار</option><option value="monthly" ${r?.repeat==="monthly"?"selected":""}>ماهانه</option><option value="weekly" ${r?.repeat==="weekly"?"selected":""}>هفتگی</option></select><select id="rb"><option value="expense" ${r?.type==="expense"?"selected":""}>پرداخت</option><option value="income" ${r?.type==="income"?"selected":""}>دریافت</option></select><button class="primary" onclick="saveReminder('${r?.id||""}')">${r?"ذخیره تغییرات":"ذخیره"}</button>${r?`<button type="button" class="danger" onclick="deleteReminder('${r.id}')">🗑 حذف یادآوری</button>`:""}`;
}
function openReminder(id=null){const r=id&&data.reminders.find(x=>x.id===id);if(r?.sourcePersonId){openPerson(r.sourcePersonId);return}openModal(`<h2>${r?"ویرایش یادآوری":"یادآوری"}</h2><div class="form">${reminderFormInner(r)}</div>`)}
/* --- مرکز ثبت سریع یادداشت/یادآوری از صفحه خانه: دقیقاً مثل تب‌های «صدور فاکتور»،
 * یک مودال با دو تب بالا (📝 یادداشت / 🔔 یادآوری) که با ضربه بین دو فرم جابه‌جا می‌شود؛
 * پیش‌فرض همیشه تب یادداشت باز است. */
function openNoteReminderHub(tab="note"){
 const t=tab==="reminder"?"reminder":"note";
 openModal(`<h2 id="nrHubTitle">${t==="note"?"📝 یادداشت جدید":"🔔 یادآوری جدید"}</h2>
 <div class="tabs nr-hub-tabs" id="nrHubTabs">
 <button type="button" data-type="note" class="${t==="note"?"active":""}" onclick="setNoteReminderHubTab('note')">📝 یادداشت</button>
 <button type="button" data-type="reminder" class="${t==="reminder"?"active":""}" onclick="setNoteReminderHubTab('reminder')">🔔 یادآوری</button>
 </div>
 <div class="form" id="nrHubBody">${t==="note"?noteFormInner(null):reminderFormInner(null)}</div>`);
}
function setNoteReminderHubTab(type){
 const t=type==="reminder"?"reminder":"note";
 document.querySelectorAll("#nrHubTabs button").forEach(b=>b.classList.toggle("active",b.dataset.type===t));
 if($("nrHubTitle"))$("nrHubTitle").textContent=t==="note"?"📝 یادداشت جدید":"🔔 یادآوری جدید";
 const body=$("nrHubBody");
 if(body){body.innerHTML=t==="note"?noteFormInner(null):reminderFormInner(null);bindAmountInputs(body)}
}
function moveReminder(id,dir){
 const sorted=data.reminders.filter(r=>!r.sourceNoteId).sort((a,b)=>(a.order??0)-(b.order??0));
 const pos=sorted.findIndex(r=>r.id===id); if(pos<0)return;
 const swapPos=pos+dir; if(swapPos<0||swapPos>=sorted.length)return;
 const a=sorted[pos],b=sorted[swapPos]; const tmp=a.order??pos; a.order=b.order??swapPos; b.order=tmp;
 touch(a);touch(b); markDirty("reminders",a.id,false,a,a.updatedAt); markDirty("reminders",b.id,false,b,b.updatedAt);
 save();
}
async function saveReminder(id){if(!$("rt").value||!$("rdPicker").value)return alert("عنوان و تاریخ لازم است");const o={title:$("rt").value.trim(),amount:parseMoney($("ra").value),date:pickerToISO("rdPicker","rtPicker"),repeat:$("rr").value,type:$("rb").value};if(id){const r=data.reminders.find(x=>x.id===id);Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt);save();await cancelNativeReminder(r.id);await scheduleNativeReminder(r);if((r.type||"")==="note" && (r.repeat||"once")==="once") await addToAndroidClock(r)}else{const maxOrder=data.reminders.length?Math.max(...data.reminders.map(x=>x.order??0)):-1;const nr=touch({id:uid(),order:maxOrder+1,...o});data.reminders.push(nr);markDirty("reminders",nr.id,false,nr,nr.updatedAt);save();await scheduleNativeReminder(nr);if((nr.type||"")==="note" && (nr.repeat||"once")==="once") await addToAndroidClock(nr)}logEvent(id?"ویرایش یادآوری":"ایجاد یادآوری",o.title,id?"edit":"create");closeModal()}
async function deleteReminder(id){if(confirm("این یادآوری حذف شود؟")){const r=data.reminders.find(x=>x.id===id);await cancelNativeReminder(id);removeRecord("reminders",id);logEvent("حذف یادآوری",r?.title||id,"delete");closeModal()}}
/* v3.5: دکمهٔ تاییدِ کنار هر یادآوری در «جدول هفتگی»؛ با تایید، همان‌طور که در
 * صفحه یادآوری‌ها با 🗑 حذف می‌شود، از لیست هفتگی هم حذف می‌شود (بدون باز شدن
 * مودال ویرایش). */
async function dismissWeeklyReminder(id){
  if(!confirm("این یادآوری از لیست هفتگی حذف شود؟"))return;
  const r=data.reminders.find(x=>x.id===id);
  await cancelNativeReminder(id);
  removeRecord("reminders",id);
  logEvent("حذف یادآوری",r?.title||id,"delete");
}

/* v3.10: چک‌ها حالا به یک حساب وصل می‌شوند. تا وقتی چک «نشسته» (وصول/نقد)
   علامت نخورده، هیچ اثری روی موجودی حساب یا لیست تراکنش‌ها ندارد — چون تا
   وصول نشده، پولش واقعاً جابه‌جا نشده. با زدن دکمه «نشست»، یک تراکنش واقعی
   (دریافت برای چک دریافتی، هزینه برای چک پرداختی) در همان حساب ساخته
   می‌شود و به موجودی اضافه/کم می‌گردد؛ لغوش هم همان تراکنش را برمی‌دارد.
   وقتی چک نشسته باشد، نوع/مبلغ/حساب دیگر قابل ویرایش نیستند (چون یک
   تراکنش واقعی به آن‌ها وصل است) — برای تغییرشان اول باید «لغو وصول» شود. */
function openCheck(id=null){
 const c=id&&data.checks.find(x=>x.id===id);
 const locked=!!c?.settled;
 const lockNote=locked?`<p class="hint">این چک «نشسته» است؛ نوع، مبلغ و حساب قابل ویرایش نیستند. برای تغییرشان، اول از لیست چک‌ها وضعیت را به «در انتظار» برگردان.</p>`:"";
 openModal(`<h2>${c?"ویرایش چک":"ثبت چک"}</h2><div class="form">${lockNote}<select id="ct" ${locked?"disabled":""}><option value="receive" ${c?.type==="receive"?"selected":""}>چک دریافتی</option><option value="pay" ${c?.type==="pay"?"selected":""}>چک پرداختی</option></select><input id="cn" placeholder="نام شخص" value="${esc(c?.name||"")}"><input id="cnid" inputmode="numeric" maxlength="10" placeholder="کد ملی (اختیاری)" value="${esc(c?.nationalCode||"")}"><input id="camount" type="text" inputmode="numeric" class="amt-input" placeholder="مبلغ" value="${fmtAmtValue(c?.amount)}" ${locked?"disabled":""}>${simpleDateField("cdate",jalaliInputValue(c?.date||""))}<input id="cnum" placeholder="شماره چک" value="${esc(c?.number||"")}"><input id="cbank" placeholder="بانک" value="${esc(c?.bank||"")}">${invField("حساب مرتبط","با «نشستن» چک، مبلغ از/به همین حساب کم یا زیاد و در تراکنش‌ها ثبت می‌شود",accountSelect("cacc",c?.accountID||""))}<textarea id="cnote" placeholder="توضیحات">${esc(c?.note||"")}</textarea><button class="primary" onclick="saveCheck('${c?.id||""}')">${c?"ذخیره تغییرات":"ذخیره"}</button></div>`);
 if(!data.accounts.length)setTimeout(()=>alert("برای اتصال چک به حساب، اول از بخش حساب‌ها یک حساب اضافه کن."),0);
}
function saveCheck(id){
 if(!$("cn").value.trim()||!parseMoney($("camount").value)||!$("cdate").value)return alert("نام، مبلغ و تاریخ لازم است");
 if(!$("cacc").value)return alert("حساب مرتبط را انتخاب کن");
 const existing=id&&data.checks.find(x=>x.id===id);
 const o={type:$("ct").value,name:$("cn").value.trim(),nationalCode:$("cnid").value.trim(),amount:parseMoney($("camount").value),date:jalaliToISO($("cdate").value),number:$("cnum").value.trim(),bank:$("cbank").value.trim(),accountID:$("cacc").value,note:$("cnote").value};
 if(existing?.settled){o.type=existing.type;o.amount=existing.amount;o.accountID=existing.accountID}
 let savedCheck;
 if(id){const c=data.checks.find(x=>x.id===id);Object.assign(c,o);touch(c);markDirty("checks",c.id,false,c,c.updatedAt);savedCheck=c}else{const nc=touch({id:uid(),done:false,settled:false,txId:null,...o});data.checks.push(nc);markDirty("checks",nc.id,false,nc,nc.updatedAt);savedCheck=nc}
 save();logEvent(id?"ویرایش چک":"ثبت چک",`${o.name} • ${money(o.amount)}`,id?"edit":"create");closeModal();
 upsertReminderForCheck(savedCheck).catch(console.error)
}
function toggleCheckSettled(id){
 const c=data.checks.find(x=>x.id===id);if(!c)return;
 if(!c.settled){
  if(!c.accountID)return alert("اول از «ویرایش چک» یک حساب برای آن انتخاب کن.");
  const isReceive=c.type==="receive";
  const nt=touch({id:uid(),title:(isReceive?"وصول چک دریافتی":"نقد شدن چک پرداختی")+" - "+c.name,amount:c.amount,type:isReceive?"income":"expense",category:isReceive?"چک دریافتی":"چک پرداختی",accountID:c.accountID,date:new Date().toISOString(),source:"check-settle",checkId:c.id});
  data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);
  c.settled=true;c.txId=nt.id;touch(c);markDirty("checks",c.id,false,c,c.updatedAt);
  save();
  logEvent(isReceive?"وصول چک":"نقد شدن چک",`${c.name} • ${money(c.amount)} • ${data.accounts.find(a=>a.id===c.accountID)?.name||""}`,"payment");
  removeReminderForCheck(c.id).catch(console.error);
 }else{
  if(c.txId)removeRecord("transactions",c.txId);
  c.settled=false;c.txId=null;touch(c);markDirty("checks",c.id,false,c,c.updatedAt);
  save();
  logEvent("لغو وضعیت چک",c.name,"edit");
  upsertReminderForCheck(c).catch(console.error);
 }
}
function deleteCheck(id){
 if(confirm("این چک حذف شود؟")){
  const c=data.checks.find(x=>x.id===id);
  if(c)pushToTrash("checks",c);
  if(c?.txId)removeRecord("transactions",c.txId);
  removeReminderForCheck(id);
  removeRecord("checks",id);
  logEvent("حذف چک",c?.name||id,"delete")
 }
}
/* ---- v3.11: هشدار سررسید چک + یادآوری خودکار ----
 * دقیقاً مثل هشدار «موجودی کم» که کالاهای رو به اتمام را بالای لیست کالا
 * می‌آورد، اینجا چک‌هایی که سررسیدشان نزدیک است (یا گذشته) بالای لیست چک‌ها
 * می‌آیند و علامت هشدار می‌گیرند. علاوه بر آن، برای هر چک «در انتظار» یک
 * یادآوری واقعی (همان موتور یادآوری‌های برنامه، با اعلان واقعی) چند روز
 * قبل از سررسید ساخته می‌شود — دقیقاً به همان روشی که یادداشت‌ها به
 * یادآوری وصل می‌شوند (upsertReminderForNote). با نشستن/لغو/حذف چک، همان
 * یادآوری هم به‌روزرسانی یا حذف می‌شود تا اعلان‌های قدیمی و بی‌ربط نماند. */
const CHECK_ALERT_DAYS=5; // چند روز مانده به سررسید، چک را «نزدیک به سررسید» حساب کن
const CHECK_REMINDER_DAYS_BEFORE=3; // چند روز قبل از سررسید یادآوری بزن
function checkDueDays(c){const d=localDateFromInput(c?.date);if(!d)return null;return Math.ceil((d.setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/86400000)}
function isCheckDueSoon(c){if(!c||c.settled)return false;const dd=checkDueDays(c);return dd!==null&&dd<=CHECK_ALERT_DAYS}
function checkDueBadge(c){if(c.settled)return"";const dd=checkDueDays(c);if(dd===null)return"";if(dd<0)return`⚠️ ${fa(Math.abs(dd))} روز از سررسید گذشته`;if(dd===0)return"⚠️ امروز سررسید است";if(dd<=CHECK_ALERT_DAYS)return`⏰ ${fa(dd)} روز تا سررسید`;return""}
async function upsertReminderForCheck(check,renderAfter=true){
 if(!check?.id)return;
 const linked=(data.reminders||[]).filter(x=>x.sourceCheckId===check.id);
 let r=linked[0];
 for(const dup of linked.slice(1)){await cancelNativeReminder(dup.id);removeRecordSilent("reminders",dup.id)}
 if(check.settled||!check.date){if(r){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);if(renderAfter)save();else{persistLocal();syncSave()}}return}
 const due=localDateFromInput(check.date);
 if(!due)return;
 const alertAt=new Date(due.getTime()-CHECK_REMINDER_DAYS_BEFORE*86400000);
 const useDate=(alertAt>new Date()?alertAt:due).toISOString();
 const o={title:`⚠️ سررسید چک ${check.type==="receive"?"دریافتی":"پرداختی"}: ${check.name}`,amount:check.amount||0,date:useDate,repeat:"once",type:"check",sourceCheckId:check.id,body:`مبلغ: ${money(check.amount||0)} • سررسید: ${jalaliLabel(check.date)}`};
 if(r){Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{r=touch({id:uid(),...o});data.reminders.push(r);markDirty("reminders",r.id,false,r,r.updatedAt)}
 if(renderAfter)save();else{persistLocal();syncSave()}
 await cancelNativeReminder(r.id);await scheduleNativeReminder(r);
}
async function removeReminderForCheck(checkId){const matches=(data.reminders||[]).filter(r=>r.sourceCheckId===checkId);for(const r of matches){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id)}if(matches.length)save()}
async function syncAllChecksToReminders(){let changed=false;const checkIds=new Set((data.checks||[]).map(c=>c.id));for(const c of data.checks||[]){const before=(data.reminders||[]).length;await upsertReminderForCheck(c,false);if((data.reminders||[]).length!==before)changed=true}for(const r of [...(data.reminders||[])]){if(r.sourceCheckId&&!checkIds.has(r.sourceCheckId)){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);changed=true}}if(changed){persistLocal();syncSave();render()}}

/* ---- v2.7.2: سررسید بدهکار/بستانکار → یادآوری واقعی + جدول هفتگی ----
 * دقیقاً همان الگوی چک‌ها/یادداشت‌ها: هر شخص (بدهکار یا بستانکار) با سررسید
 * تنظیم‌شده یک یادآوری واقعی (اعلان روی گوشی) می‌گیرد. اگر قسطی باشد، هر
 * قسطِ پرداخت‌نشده سررسید ماهانه‌ی خودش را دارد (چون generateInstallments از
 * قبل هر قسط را یک ماه بعد از قسط قبلی می‌گذارد) و برای هر کدام یک یادآوری
 * جدا ساخته می‌شود؛ اگر قسطی نباشد، همان یک سررسید کلی خبر می‌دهد. با
 * پرداخت هر قسط (یا تسویه‌ی کامل)، یادآوری همان مورد به‌خودی‌خود حذف می‌شود. */
function personDueDateISO(dateStr){const d=localDateFromInput(dateStr);if(!d)return null;d.setHours(9,0,0,0);return d.toISOString()}
async function upsertRemindersForPerson(p,renderAfter=true){
 if(!p?.id)return;
 const linked=(data.reminders||[]).filter(x=>x.sourcePersonId===p.id);
 const dueLabel=p.type==="credit"?"سررسید واریز":"سررسید پرداخت";
 const icon=p.type==="credit"?"💰":"⚠️";
 let wanted=[];
 if(p.installments?.items?.length){
  wanted=p.installments.items.filter(it=>!it.paid&&it.due).map(it=>({key:it.id,date:it.due,amount:it.amount}));
 }else if(p.due){
  const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));
  if(remaining>0)wanted=[{key:"",date:p.due,amount:remaining}];
 }
 const wantedKeys=new Set(wanted.map(w=>w.key));
 for(const r of linked){if(!wantedKeys.has(r.sourceInstallmentId||"")){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id)}}
 for(const w of wanted){
  const iso=personDueDateISO(w.date);if(!iso)continue;
  let r=linked.find(x=>(x.sourceInstallmentId||"")===w.key);
  const o={title:`${icon} ${dueLabel}: ${p.name}`,amount:w.amount,date:iso,repeat:"once",type:p.type==="credit"?"income":"expense",sourcePersonId:p.id,sourceInstallmentId:w.key,body:`مبلغ: ${money(w.amount)} • ${dueLabel}: ${jalaliLabel(w.date)}`};
  if(r){Object.assign(r,o);touch(r);markDirty("reminders",r.id,false,r,r.updatedAt)}else{r=touch({id:uid(),...o});data.reminders.push(r);markDirty("reminders",r.id,false,r,r.updatedAt)}
  await cancelNativeReminder(r.id);await scheduleNativeReminder(r);
 }
 if(renderAfter)save();else{persistLocal();syncSave()}
}
async function removeRemindersForPerson(personId){const matches=(data.reminders||[]).filter(r=>r.sourcePersonId===personId);for(const r of matches){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id)}if(matches.length)save()}
async function syncAllPeopleToReminders(){let changed=false;const peopleIds=new Set((data.people||[]).map(p=>p.id));for(const p of data.people||[]){const before=(data.reminders||[]).length;await upsertRemindersForPerson(p,false);if((data.reminders||[]).length!==before)changed=true}for(const r of [...(data.reminders||[])]){if(r.sourcePersonId&&!peopleIds.has(r.sourcePersonId)){await cancelNativeReminder(r.id);removeRecordSilent("reminders",r.id);changed=true}}if(changed){persistLocal();syncSave();render()}}
/* هر سررسید فعال یک شخص (کلی یا هر قسط) که در یک روز مشخص از هفته می‌افتد؛
 * دقیقاً شبیه noteOccursOnDay اما مستقیم از data.people خوانده می‌شود تا در
 * جدول هفتگی، مثل یادداشت‌ها و یادآوری‌های مستقل، ردیف جدا نشان داده شود. */
function openWeeklyPerson(id){
 const p=data.people.find(x=>x.id===id);if(!p)return;
 /* From the weekly list, installment-based people open directly in the
    installment management screen instead of the add/edit person form. */
 if(p.installments?.items?.length){openInstallments(id);return;}
 openPerson(id);
}
function personDueItemsOnDay(day){
 const y=day.getFullYear(),m=day.getMonth(),d=day.getDate();
 const out=[];
 for(const p of data.people||[]){
  const wanted=[];
  if(p.installments?.items?.length){for(const it of p.installments.items){if(!it.paid&&it.due)wanted.push({due:it.due,amount:it.amount})}}
  else if(p.due){const remaining=Math.max(0,(Number(p.amount)||0)-(Number(p.paid)||0));if(remaining>0)wanted.push({due:p.due,amount:remaining})}
  for(const w of wanted){const dd=new Date(w.due);if(Number.isNaN(dd.getTime()))continue;if(dd.getFullYear()===y&&dd.getMonth()===m&&dd.getDate()===d)out.push({id:p.id,title:`${p.name} • ${money(w.amount)}`,type:p.type})}
 }
 return out;
}


function openSmartNote(){alert("یادداشت هوشمند تا زمان آماده شدن Backend امن غیرفعال است.");}

/* v3.4: قابلیت «بروزرسانی از GitHub» به‌طور کامل حذف شد (چک‌کردن مخزن،
 * ورودی نام مخزن و اعلان نسخه جدید). به‌روزرسانی سرویس‌ورکر (فایل‌های خود
 * همین گوشی) و پشتیبان خودکار هر ۶ ساعت هنوز کار می‌کنند. */
async function updateServiceWorkerNow(){try{if(!('serviceWorker' in navigator))return; const reg=await navigator.serviceWorker.getRegistration(); if(reg){await reg.update();}}catch(e){console.warn("service worker update",e)}}
function startUpdateChecker(){setTimeout(()=>{updateServiceWorkerNow()},2500);setInterval(()=>{updateServiceWorkerNow()},AUTO_BACKUP_MS);setInterval(purgeOldTrash,AUTO_BACKUP_MS)}
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
  row.innerHTML=`<div class="quick-fields"><input class="quick-title" placeholder="${quickTxType==="expense"?"نام هزینه":"نام دریافتی"}" value="${esc(pref.title||"")}"><input class="quick-amount amt-input" type="text" inputmode="numeric" placeholder="مبلغ" value="${fmtAmtValue(pref.amount)}"><select class="quick-cat">${cats.map(c=>`<option value="${esc(c.name)}" ${pref.category===c.name?"selected":""}>${esc(c.name)}</option>`).join("")}</select><select class="quick-account">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===(pref.accountID||data.accounts[0]?.id)?"selected":""}>${esc(a.name)}</option>`).join("")}</select></div><button type="button" class="danger-icon quick-remove" onclick="this.parentElement.remove()">🗑</button>`;
  box.appendChild(row);
  bindAmountInputs(row);
}
function saveQuickRows(){
  const rows=[...document.querySelectorAll("#quickRows .quick-row")];if(!rows.length)return alert("حداقل یک مورد اضافه کن");
  let count=0;
  for(const row of rows){const amount=parseMoney(row.querySelector(".quick-amount")?.value);if(!amount)continue;const category=row.querySelector(".quick-cat")?.value||"سایر";const title=row.querySelector(".quick-title")?.value.trim()||category;const accountID=row.querySelector(".quick-account")?.value||data.accounts[0]?.id;if(!accountID)continue;const nt=touch({id:uid(),title,amount,type:quickTxType,category,accountID,date:new Date().toISOString(),source:"quick"});data.transactions.unshift(nt);markDirty("transactions",nt.id,false,nt,nt.updatedAt);logEvent(quickTxType==="expense"?"ثبت هزینه سریع":"ثبت دریافتی سریع",`${title} • ${money(amount)} • ${data.accounts.find(a=>a.id===accountID)?.name||""}`,"create");count++}
  if(!count)return alert("مبلغ حداقل یک مورد را وارد کن");save();closeModal();render();
}
function accountBalance(id){
 let a=data.accounts.find(x=>x.id===id),v=Number(a?.balance)||0;
 data.transactions.forEach(t=>{
  // Bug fix (pro1): a single malformed/legacy transaction record used to be
  // able to throw here (or be silently skipped by an earlier bail-out),
  // which meant it dropped out of the balance calculation entirely even
  // though it still existed in the data. Each record is now evaluated in
  // isolation so one bad record can never affect the others.
  try{
   if(!t||typeof t!=="object")return;
   const amt=Number(t.amount)||0;
   if(t.type==="income"&&t.accountID===id)v+=amt;
   if(t.type==="expense"&&t.accountID===id)v-=amt;
   if(t.type==="transfer"){
    // Backward compatibility: older transfers used accountID as the source.
    const fromId=t.from||t.accountID||"";
    const toId=t.to||"";
    if(fromId===id)v-=amt;
    if(t.destinationType!=="other"&&toId===id)v+=amt;
   }
  }catch(e){console.warn("accountBalance: skipped a malformed transaction",t?.id,e)}
 });
 return v;
}
function actionButtons(editFn,deleteFn,id){return `<div class="actions"><button type="button" title="ویرایش" onclick="${editFn}(\'${id}\')">✏️</button><button type="button" class="danger-icon" title="حذف" onclick="${deleteFn}(\'${id}\')">🗑</button></div>`}
/* v3.11: transfer row markup pulled into its own function so it can be
   reused both in the transactions list (txHTML) and in a dedicated list
   inside «انتقال بین حساب‌ها» — before, that section only had a "+" button
   and no record of past transfers at all. */
function transferItemHTML(t){
 let destLabel;
 if(t.destinationType==="other"){
  const methodLabel=t.otherMethod==="sheba"?`🏦 شبا: ${esc(t.otherSheba||"")}`:`💳 کارت: ${esc(t.otherCard||"")}`;
  destLabel=`👤 ${esc(t.otherName||"حساب دیگران")} • ${methodLabel}`;
 }else{
  destLabel=`🏦 ${esc(data.accounts.find(a=>a.id===t.to)?.name||"")}`;
 }
 return `<div class="item"><div><b>↔ ${esc(t.title)}</b><div class="meta">از ${esc(data.accounts.find(a=>a.id===(t.from||t.accountID))?.name||"")} ← ${destLabel}</div><div class="meta">${jalaliDateTimeInput(t.date)}</div></div><div><strong>${money(t.amount)}</strong>${actionButtons("openTransfer","deleteTx",t.id)}</div></div>`;
}
function txImagesOf(t){return (t?.images&&t.images.length)?t.images:(t?.image?[t.image]:[])}
/* Bug fix (pro1): render every transaction row independently. Previously
   `data.transactions.map(txHTML).join("")` ran as a single expression, so if
   ANY one record in the array had a shape that made txHTML/transferItemHTML
   throw (e.g. a legacy/partial record from an older version or an
   interrupted sync), the whole assignment failed and the transactions list
   silently kept showing its old, stale content — making it look like a
   whole batch of transactions had "disappeared" and, because the render
   never got that far, related totals looked out of sync too. safeTxHTML
   isolates each row so one bad record just gets skipped (with a console
   warning) instead of hiding every transaction after it. */
function safeTxHTML(t){try{return txHTML(t)}catch(e){console.warn("txHTML: skipped a malformed transaction",t?.id,e);return ""}}
/* v1.4 fix: لیست تراکنش‌ها (هم «اخیر» در داشبورد و هم صفحه‌ی «تراکنش‌ها») قبلاً
 * فقط به ترتیب افزوده‌شدن به آرایه نمایش داده می‌شد، نه به ترتیب تاریخ. وقتی یک
 * تراکنش تکرارشونده برای تاریخی در گذشته ساخته می‌شد یا هنگام همگام‌سازی بین دو
 * گوشی ترتیب افزودن با ترتیب تاریخ یکی نبود، تراکنش‌ها در لیست نامرتب و
 * تاریخ‌هایشان به‌نظر جابه‌جا/درهم می‌آمدند. حالا هر دو لیست همیشه بر اساس
 * تاریخ (نزولی، جدیدترین بالا) مرتب می‌شوند. */
function txSortKey(t){const d=new Date(t?.date);return Number.isNaN(d.getTime())?0:d.getTime()}
function sortedTransactions(){return [...data.transactions].sort((a,b)=>txSortKey(b)-txSortKey(a))}
function txHTML(t){if(t.type==="transfer")return transferItemHTML(t);let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";const recurBadge=t.recurring&&t.recurring!=="none"?` • 🔁 ${t.recurring==="monthly"?"ماهانه":"هفتگی"}`:t.source==="recurring"?" • 🔁 خودکار":"";const imgs=txImagesOf(t);const thumb=imgs.length?`<div class="tx-thumb-wrap" onclick="viewImage('${t.id}')"><img class="tx-thumb" src="${imgs[0]}" alt="پیوست">${imgs.length>1?`<span class="tx-thumb-count">${fa(imgs.length)}</span>`:""}</div>`:"";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||"")} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":t.source==="recurring"?"تکرارشونده":"دستی"}${recurBadge}</div><div class="meta">${jalaliDateTimeInput(t.date)}</div>${thumb}</div><div><strong class="${t.type}">${sign}${money(t.amount)}</strong>${actionButtons("openTx","deleteTx",t.id)}</div></div>`}
let imageViewerState={imgs:[],index:0,scale:1,x:0,y:0,startDist:0,startScale:1,startX:0,startY:0,dragX:0,dragY:0};
function imageViewerRender(){
 const img=$("imageViewerImg"),count=$("imageViewerCount"); if(!img)return;
 const src=imageViewerState.imgs[imageViewerState.index]; img.src=src; imageViewerReset(false);
 if(count)count.textContent=`${fa(imageViewerState.index+1)} / ${fa(imageViewerState.imgs.length)}`;
 const prev=$("imageViewerPrev"),next=$("imageViewerNext"); if(prev)prev.disabled=imageViewerState.index===0; if(next)next.disabled=imageViewerState.index===imageViewerState.imgs.length-1;
}
function imageViewerApply(){const img=$("imageViewerImg");if(img)img.style.transform=`translate3d(${imageViewerState.x}px,${imageViewerState.y}px,0) scale(${imageViewerState.scale})`;const z=$("imageViewerZoomLabel");if(z)z.textContent=`${Math.round(imageViewerState.scale*100)}٪`;}
function imageViewerReset(){imageViewerState.scale=1;imageViewerState.x=0;imageViewerState.y=0;imageViewerApply()}
function imageViewerZoom(delta){imageViewerState.scale=Math.max(1,Math.min(5,imageViewerState.scale+delta));if(imageViewerState.scale===1){imageViewerState.x=0;imageViewerState.y=0}imageViewerApply()}
function imageViewerPan(dx,dy){if(imageViewerState.scale<=1)return;imageViewerState.x+=dx;imageViewerState.y+=dy;imageViewerApply()}
function imageViewerPrev(){if(imageViewerState.index>0){imageViewerState.index--;imageViewerRender()}}
function imageViewerNext(){if(imageViewerState.index<imageViewerState.imgs.length-1){imageViewerState.index++;imageViewerRender()}}
function imageViewerOpen(imgs,index=0){
 imageViewerState={imgs,index,scale:1,x:0,y:0,startDist:0,startScale:1,startX:0,startY:0,dragX:0,dragY:0};
 openModal(`<div class="image-viewer"><div class="image-viewer-head"><b>📎 مشاهده عکس</b><span id="imageViewerCount"></span></div><div id="imageViewerStage" class="image-viewer-stage"><img id="imageViewerImg" alt="پیوست" draggable="false"></div><div class="image-viewer-tools"><button type="button" onclick="imageViewerZoom(-0.25)">−</button><span id="imageViewerZoomLabel">100٪</span><button type="button" onclick="imageViewerZoom(0.25)">＋</button><button type="button" onclick="imageViewerReset()">↺</button><button type="button" onclick="downloadViewedImage()">⬇️ ذخیره عکس</button></div><div class="image-viewer-nav"><button id="imageViewerPrev" type="button" onclick="imageViewerPrev()">‹ قبلی</button><button id="imageViewerNext" type="button" onclick="imageViewerNext()">بعدی ›</button></div><p class="hint image-viewer-hint">با دو انگشت زوم کن و با یک انگشتِ عکسِ زوم‌شده را جابه‌جا کن.</p></div>`);
 imageViewerRender();
 const stage=$("imageViewerStage"); if(stage){
  stage.style.touchAction="none";
  const pointers=new Map();
  let lastPinchDistance=0;
  let pinchActive=false;
  stage.addEventListener("wheel",e=>{e.preventDefault();imageViewerZoom(e.deltaY<0?.2:-.2)},{passive:false});
  stage.addEventListener("pointerdown",e=>{
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   stage.setPointerCapture?.(e.pointerId);
   if(pointers.size===2){
    const pts=[...pointers.values()];
    lastPinchDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    pinchActive=true;
   }else if(pointers.size===1){
    imageViewerState.dragX=e.clientX;imageViewerState.dragY=e.clientY;
   }
  });
  stage.addEventListener("pointermove",e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size>=2){
    const pts=[...pointers.values()];
    const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    if(lastPinchDistance>0){
     const factor=dist/lastPinchDistance;
     const next=Math.max(1,Math.min(5,imageViewerState.scale*factor));
     imageViewerState.scale=next;
     if(next===1){imageViewerState.x=0;imageViewerState.y=0}
     imageViewerApply();
    }
    lastPinchDistance=dist;
    pinchActive=true;
    return;
   }
   if(pointers.size===1 && !pinchActive && e.buttons===1){
    const dx=e.clientX-imageViewerState.dragX,dy=e.clientY-imageViewerState.dragY;
    imageViewerState.dragX=e.clientX;imageViewerState.dragY=e.clientY;imageViewerPan(dx,dy);
   }
  });
  const endPointer=e=>{
   pointers.delete(e.pointerId);
   if(pointers.size<2)lastPinchDistance=0;
   if(pointers.size===0)pinchActive=false;
   try{stage.releasePointerCapture?.(e.pointerId)}catch(_){ }
   if(pointers.size===1){const p=[...pointers.values()][0];imageViewerState.dragX=p.x;imageViewerState.dragY=p.y;pinchActive=false;}
  };
  stage.addEventListener("pointerup",endPointer);stage.addEventListener("pointercancel",endPointer);stage.addEventListener("pointerleave",()=>{});
 }
}
async function downloadViewedImage(){
 const src=imageViewerState.imgs[imageViewerState.index]; if(!src)return;
 const filename=`hesabdar-image-${Date.now()}.jpg`;
 try{
  const fs=filesystemPlugin();
  if(fs && src.startsWith("data:")){
   const base64=src.split(",")[1];
   await fs.writeFile({path:`Download/حسابداری/عکس‌ها/${filename}`,data:base64,directory:AUTO_BACKUP_DIRECTORY,recursive:true});
   alert("عکس با موفقیت در پوشه Download/حسابداری/عکس‌ها ذخیره شد."); return;
  }
 }catch(e){console.warn("native image save failed",e)}
 try{
  const a=document.createElement("a");a.href=src;a.download=filename;a.target="_blank";document.body.appendChild(a);a.click();a.remove();
  alert("عکس برای ذخیره/دانلود آماده شد. در آیفون در صورت نمایش عکس، گزینه Share > Save Image را بزن.");
 }catch(e){alert("ذخیره عکس انجام نشد.")}
}
function viewImage(id){const t=data.transactions.find(x=>x.id===id);const imgs=txImagesOf(t);if(!imgs.length)return;imageViewerOpen(imgs,0)}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}

function invoiceDateLabel(v){return jalaliLabel(v)}
function invField(label,hint,inner){return `<div class="field"><span class="field-cap">${esc(label)}</span>${inner}${hint?`<small class="field-hint">${esc(hint)}</small>`:""}</div>`}
function invoiceRowHTML(item,i){return `<div class="invoice-row"><input type="hidden" class="inv-product" value="${esc(item?.productId||"")}"><div class="inv-desc-wrap"><input class="inv-desc" autocomplete="off" placeholder="نام کالا یا خدمت (تایپ کن تا از انبار پیشنهاد بیاید)" value="${esc(item?.desc||"")}" oninput="onInvDescInput(this)" onfocus="onInvDescInput(this)" onblur="hideInvSuggestions(this)"><div class="inv-suggest"></div></div><input class="inv-qty num-input" data-decimal="1" oninput="normalizeNumInputEl(this);updateInvoiceLiveTotal()" type="text" inputmode="decimal" min="0" placeholder="تعداد" value="${Number(item?.qty)||""}"><input class="inv-price amt-input" oninput="this.dataset.userEdited='1';updateInvoiceLiveTotal()" type="text" inputmode="numeric" placeholder="قیمت هر واحد" value="${fmtAmtValue(item?.price)}"><button type="button" class="danger-icon" title="حذف ردیف" onclick="this.parentElement.remove();updateInvoiceLiveTotal()">🗑</button></div>`}
function addInvoiceRow(pref={}){const box=$("invoiceRows");if(!box)return;const div=document.createElement("div");div.innerHTML=invoiceRowHTML(pref,box.children.length);const el=div.firstElementChild;box.appendChild(el);bindAmountInputs(el)}
/* v3.3: جایگزین select کالا شد با سرچ زنده روی همون فیلد «توضیحات» —
 * هرچی تایپ کنی، لیست کالاهای انبار (از طریق <datalist>) فیلتر و پیشنهاد
 * می‌شود؛ با زدن روی یک پیشنهاد، قیمت واحد و productId (برای کسر از
 * موجودی انبار هنگام ذخیره) خودکار پر می‌شود. اگر متن تایپ‌شده دقیقاً با
 * هیچ کالایی مطابق نباشد (مثلاً یک خدمت دلخواه)، فقط همان توضیح متنی ساده
 * ذخیره می‌شود، بدون اتصال به انبار. */
/* v3.4: به‌جای <datalist> مرورگر (که داخل اپ روی گوشی خیلی وقت‌ها اصلاً
 * چیزی نشون نمی‌داد یا کلیک روش درست کار نمی‌کرد)، یک لیست پیشنهاد خودمون
 * زیر همین اینپوت رسم می‌کنیم که هم موقع تایپ زیرش دیده می‌شود و هم با
 * کلیک روی هرکدوم مقدار داخل اینپوت جایگزین می‌شود. */
function onInvDescInput(input){
 const row=input.closest(".invoice-row");if(!row)return;
 const val=input.value.trim().toLowerCase();
 const hidden=row.querySelector(".inv-product");
 const p=val?data.products.find(x=>(x.name||"").trim().toLowerCase()===val):null;
 if(p){hidden.value=p.id;const priceEl=row.querySelector(".inv-price");if(priceEl&&!priceEl.dataset.userEdited)priceEl.value=p.price||0}
 else hidden.value="";
 const box=row.querySelector(".inv-suggest");
 if(box){
  const matches=val?data.products.filter(x=>(x.name||"").toLowerCase().includes(val)).slice(0,8):[];
  box.innerHTML=matches.map(m=>`<button type="button" onmousedown="event.preventDefault()" onclick="pickInvSuggestion(this,'${m.id}')">${esc(m.name)} <small>موجودی ${fa(m.stock||0)}</small></button>`).join("");
 }
 updateInvoiceLiveTotal();
}
function pickInvSuggestion(btn,productId){
 const row=btn.closest(".invoice-row");if(!row)return;
 const p=data.products.find(x=>x.id===productId);if(!p)return;
 const input=row.querySelector(".inv-desc"),hidden=row.querySelector(".inv-product"),priceEl=row.querySelector(".inv-price"),box=row.querySelector(".inv-suggest");
 if(input)input.value=p.name;
 if(hidden)hidden.value=p.id;
 if(priceEl&&!priceEl.dataset.userEdited)priceEl.value=p.price||0;
 if(box)box.innerHTML="";
 updateInvoiceLiveTotal();
 input?.focus();
}
function hideInvSuggestions(input){
 const row=input.closest(".invoice-row");const box=row?.querySelector(".inv-suggest");
 setTimeout(()=>{if(box)box.innerHTML=""},150);
}
/* v3.3: انتخاب مشتری از لیست پرونده‌ها → نام/تلفن/آدرس فاکتور خودکار از
 * همان پرونده‌ی مشتری پر می‌شود تا لازم نباشد دوباره تایپ کنی. */
function invoiceCustomerPick(sel){
 const c=data.customers.find(x=>x.id===sel.value);
 if(!c)return;
 const nameEl=$("invCustomerName"),phoneEl=$("invPhone"),addrEl=$("invAddress");
 if(nameEl)nameEl.value=c.name||"";
 if(phoneEl)phoneEl.value=c.phone||"";
 if(addrEl)addrEl.value=c.address||"";
}
/* v3.5: درست مثل سرچ کالا داخل ردیف‌های فاکتور، اسم مشتری هم همین‌طور
 * سرچ زنده می‌شود؛ تا حروف تایپ می‌شود از لیست پرونده‌های مشتری فیلتر و
 * پیشنهاد می‌آید و با کلیک روی هرکدوم، نام/تلفن/آدرس همان مشتری خودکار
 * پر می‌شود و به پرونده‌اش هم وصل می‌شود (بدون نیاز به select جداگانه). */
function onInvCustomerNameInput(input){
 const val=input.value.trim().toLowerCase();
 const box=$("invCustomerSuggest");
 const sel=$("invCustomer");
 if(sel && !(val && data.customers.some(c=>(c.name||"").trim().toLowerCase()===val)))sel.value="";
 if(!box)return;
 const matches=val?data.customers.filter(c=>(c.name||"").toLowerCase().includes(val)).slice(0,8):[];
 box.innerHTML=matches.map(c=>`<button type="button" onmousedown="event.preventDefault()" onclick="pickInvCustomerSuggestion('${c.id}')">${esc(c.name)}${c.phone?` <small>${esc(c.phone)}</small>`:""}</button>`).join("");
}
function hideInvCustomerSuggestions(){
 setTimeout(()=>{const box=$("invCustomerSuggest");if(box)box.innerHTML=""},150);
}
function pickInvCustomerSuggestion(customerId){
 const c=data.customers.find(x=>x.id===customerId);if(!c)return;
 const nameEl=$("invCustomerName"),phoneEl=$("invPhone"),addrEl=$("invAddress"),sel=$("invCustomer"),box=$("invCustomerSuggest");
 if(nameEl)nameEl.value=c.name||"";
 if(phoneEl)phoneEl.value=c.phone||"";
 if(addrEl && !addrEl.value.trim())addrEl.value=c.address||"";
 if(sel)sel.value=c.id;
 if(box)box.innerHTML="";
 nameEl?.focus();
}

function openInvoice(id=null){
 const inv=id&&data.invoices.find(x=>x.id===id);
 const items=inv?.items?.length?inv.items:[{desc:"",qty:1,price:""}];
 const cust=inv?.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 const defAcc=inv?.settleAccountId||data.accounts.find(a=>a.default)?.id||data.accounts[0]?.id||"";
 const invType=inv?(inv.type==="daily"?"daily":"customer"):"daily";
 const hideDaily=invType==="daily"?"display:none":"";
 openModal(`<h2>🧾 ${inv?"ویرایش فاکتور":"ساخت فاکتور جدید"}</h2><div class="form invoice-form">
 <div class="tabs inv-type-tabs" id="invTypeTabs">
 <button type="button" data-type="customer" class="${invType==="customer"?"active":""}" onclick="setInvoiceType('customer')">🧾 فاکتور مشتری</button>
 <button type="button" data-type="daily" class="${invType==="daily"?"active":""}" onclick="setInvoiceType('daily')">🗓 فاکتور روزانه</button>
 </div>
 <input type="hidden" id="invType" value="${invType}">
 <div class="inv-hide-daily" style="${hideDaily}">
 ${invField("عنوان فاکتور","برای پیدا کردن آسان‌تر در صندوق فاکتور، مثلاً: فاکتور فروش موبایل",`<input id="invName" placeholder="مثلاً: فاکتور فروش شهریور" value="${esc(inv?.name||"")}">`)}
 ${invField("نام فروشنده / فروشگاه","اسمی که بالای فاکتور چاپ می‌شود",`<input id="invSeller" placeholder="نام فروشگاه یا کسب‌وکار شما" value="${esc(inv?.seller||(inv?"":data.branding?.storeName||""))}">`)}
 </div>
 <div class="two-fields">
 ${invField("نام مشتری","اسم کسی که فاکتور برایش صادر می‌شود؛ تایپ کن تا از لیست مشتری‌ها پیشنهاد بیاید",`<div class="inv-desc-wrap"><input id="invCustomerName" autocomplete="off" placeholder="نام و نام خانوادگی مشتری" value="${esc(inv?.customerName||cust?.name||"")}" oninput="onInvCustomerNameInput(this)" onfocus="onInvCustomerNameInput(this)" onblur="hideInvCustomerSuggestions(this)"><div class="inv-suggest" id="invCustomerSuggest"></div></div>`)}
 ${invField("شماره تماس","شماره تماس مشتری برای این فاکتور",`<input id="invPhone" inputmode="tel" placeholder="مثلاً: ۰۹۱۲xxxxxxx" value="${esc(inv?.phone||cust?.phone||"")}">`)}
 </div>
 <div class="inv-hide-daily" style="${hideDaily}">
 ${invField("انتخاب از لیست مشتری‌ها","اختیاری؛ با انتخاب مشتری، نام/تلفن/آدرس از پرونده‌اش خودکار پر می‌شود",`<select id="invCustomer" onchange="invoiceCustomerPick(this)"><option value="">بدون اتصال به پرونده مشتری</option>${data.customers.map(c=>`<option value="${c.id}" ${c.id===inv?.customerId?"selected":""}>${esc(c.name)}${c.phone?" • "+esc(c.phone):""}</option>`).join("")}</select>`)}
 </div>
 <div class="inv-hide-daily" style="${hideDaily}">
 <div class="two-fields">
 ${invField("تاریخ فاکتور","تاریخ صدور به تقویم شمسی",simpleDateField("invDate",jalaliInputValue(inv?.date)||todayJalali()))}
 ${invField("شماره فاکتور","اختیاری؛ بعد از اولین فاکتور، خودش یکی یکی بالا می‌رود",`<input id="invNo" placeholder="مثلاً: ۱۰۰۱" value="${esc(inv?(inv.number||""):nextInvoiceNumber())}">`)}
 </div>
 <div class="two-fields">
 ${invField("وضعیت پرداخت","بر اساس مبلغ دریافتی به‌صورت خودکار هم به‌روزرسانی می‌شود",`<select id="invStatus"><option value="unpaid" ${inv?.status!=="paid"&&inv?.status!=="partial"?"selected":""}>🔴 پرداخت نشده</option><option value="partial" ${inv?.status==="partial"?"selected":""}>🟡 پرداخت بخشی</option><option value="paid" ${inv?.status==="paid"?"selected":""}>🟢 پرداخت کامل</option></select>`)}
 ${invField("مبلغ دریافت‌شده","تا امروز از مشتری چقدر گرفته‌ای (تومان)",`<input id="invPaid" oninput="updateInvoiceLiveTotal()" type="text" inputmode="numeric" class="amt-input" placeholder="۰" value="${fmtAmtValue(inv?.paid)}">`)}
 </div>
 </div>
 ${invField("تسویه به حساب",invType==="daily"?"مبلغ فاکتور تسویه‌شده در نظر گرفته می‌شود و در این حساب ثبت می‌شود":"این مبلغ دریافتی در این حساب ثبت می‌شود و به تراکنش‌ها اضافه می‌گردد",accountSelect("invSettleAccount",defAcc))}
 <div class="inv-hide-daily" style="${hideDaily}">
 <div class="two-fields">
 ${invField("تخفیف مبلغی","مبلغ ثابتی که از جمع کل کم می‌شود (تومان)",`<input id="invDiscount" oninput="updateInvoiceLiveTotal()" type="text" inputmode="numeric" class="amt-input" placeholder="۰" value="${fmtAmtValue(inv?.discount)}">`)}
 ${invField("تخفیف درصدی","درصدی که بعد از تخفیف مبلغی کم می‌شود (٪)",`<input id="invDiscountPercent" class="num-input" inputmode="numeric" oninput="normalizeNumInputEl(this);updateInvoiceLiveTotal()" type="text" min="0" max="100" placeholder="۰" value="${Number(inv?.discountPercent)||0}">`)}
 </div>
 ${invField("مالیات بر ارزش‌افزوده","درصدی که بعد از کسر تخفیف به قیمت اضافه می‌شود (٪)",`<input id="invTax" class="num-input" inputmode="numeric" oninput="normalizeNumInputEl(this);updateInvoiceLiveTotal()" type="text" min="0" placeholder="۰" value="${Number(inv?.taxRate)||0}">`)}
 </div>
 ${invField("آدرس","اختیاری؛ آدرس مشتری",`<textarea id="invAddress" placeholder="مثلاً: تهران، خیابان ...">${esc(inv?.address||cust?.address||"")}</textarea>`)}
 <div class="invoice-table-head"><span>توضیحات / نام کالا</span><span>تعداد</span><span>مبلغ واحد</span><span></span></div>
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
 rows.forEach(r=>sub+=(Number(r.querySelector(".inv-qty")?.value)||0)*(parseMoney(r.querySelector(".inv-price")?.value)));
 const da=Math.min(sub,Math.max(0,parseMoney($("invDiscount")?.value))),dp=Math.min(100,Math.max(0,Number($("invDiscountPercent")?.value)||0)),dpAmt=Math.min(sub-da,Math.round((sub-da)*dp/100)),dis=da+dpAmt,tax=Math.max(0,Math.round((sub-dis)*(Number($("invTax")?.value)||0)/100)),total=Math.max(0,sub-dis+tax);
 if($("invLiveSubtotal"))$("invLiveSubtotal").textContent=money(sub);if($("invLiveAdjust"))$("invLiveAdjust").textContent=money(tax-dis);if($("invLiveTotal"))$("invLiveTotal").textContent=money(total)
}
/* --- تغییر نوع فاکتور بین «فاکتور مشتری» و «فاکتور روزانه» ---
 * در حالت فاکتور روزانه فقط نام، شماره تماس و آدرس مشتری به‌همراه
 * ردیف‌های کالا و جمع کل نمایش داده می‌شود؛ بقیه‌ی فیلدها (عنوان،
 * فروشنده، تاریخ/شماره، وضعیت پرداخت، تسویه حساب، تخفیف و مالیات)
 * با مقادیر پیش‌فرضشان در فرم می‌مانند ولی مخفی می‌شوند. */
function setInvoiceType(type){
 const t=type==="daily"?"daily":"customer";
 if($("invType"))$("invType").value=t;
 document.querySelectorAll("#invTypeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.type===t));
 document.querySelectorAll(".inv-hide-daily").forEach(el=>el.style.display=t==="daily"?"none":"");
}
/* v3.5: شماره فاکتور فاکتور جدید خودکار محاسبه می‌شود: اولین فاکتوری که
 * کاربر خودش دستی شماره‌گذاری کرده، مبنا قرار می‌گیرد و از فاکتور بعدی
 * به بعد، یکی یکی بالا می‌رود (بر اساس بزرگ‌ترین شماره‌ی عددیِ ثبت‌شده
 * تا الان، +۱). اگر تا حالا هیچ فاکتوری شماره نداشته، خالی می‌ماند تا
 * کاربر اولین شماره را خودش تعیین کند. */
function nextInvoiceNumber(){
 let max=0,found=false;
 (data.invoices||[]).forEach(x=>{
  const n=parseInt(toEnDigits(String(x.number||"")).replace(/[^\d]/g,""),10);
  if(!isNaN(n)){found=true;if(n>max)max=n}
 });
 return found?String(max+1):"";
}
function saveInvoice(id){
 const type=$("invType")?.value==="daily"?"daily":"customer";
 const name=$("invName").value.trim()||(type==="daily"?"فاکتور روزانه":"فاکتور جدید"), seller=$("invSeller").value.trim(),date=jalaliToISO($("invDate").value)||new Date().toISOString().slice(0,10),number=$("invNo").value.trim();
 const items=[...document.querySelectorAll("#invoiceRows .invoice-row")].map(r=>({productId:r.querySelector(".inv-product")?.value||"",desc:r.querySelector(".inv-desc")?.value.trim()||"",qty:Number(r.querySelector(".inv-qty")?.value)||0,price:parseMoney(r.querySelector(".inv-price")?.value)})).filter(x=>x.desc||x.qty||x.price);
 if(!items.length)return alert("حداقل یک ردیف فاکتور وارد کن");
 if(items.some(x=>!(x.qty>0)))return alert("تعداد هر ردیف کالا/خدمت باید بزرگ‌تر از صفر باشد");
 /* v1.2.8: قیمت خرید هر کالا در لحظه‌ی فروش snapshot می‌شود (costPriceAtSale)
    تا گزارش سودآوری بعداً با تغییر قیمت خرید فعلی کالا دستکاری نشود. */
 for(const it of items){if(it.productId){const pr=data.products.find(x=>x.id===it.productId);it.costPriceAtSale=Number(pr?.buyPrice)||0}}
 /* کمبود موجودی مانع ثبت فاکتور نمی‌شود، ولی باید به کاربر هشدار داده شود. */
 const shortages=items.filter(it=>{if(!it.productId)return false;const pr=data.products.find(x=>x.id===it.productId);if(!pr)return false;const already=id?(data.invoices.find(v=>v.id===id)?.items||[]).filter(x=>x.productId===it.productId).reduce((s,x)=>s+(Number(x.qty)||0),0):0;return Number(it.qty||0)>Number(pr.stock||0)+already});
 if(shortages.length&&!confirm(`موجودی این کالاها کافی نیست: ${shortages.map(x=>x.desc).join("، ")}. با این حال فاکتور ثبت شود؟`))return;
 let discount,discountPercent,taxRate,paid;
 try{discount=nonNegativeMoney($("invDiscount").value||0,"تخفیف");discountPercent=validPercent($("invDiscountPercent").value||0,"درصد تخفیف");taxRate=validPercent($("invTax").value||0,"مالیات");paid=nonNegativeMoney($("invPaid").value||0,"مبلغ پرداختی");}catch(e){return alert(e.message)}
 const subtotal=items.reduce((sum,it)=>sum+(Number(it.qty)*Number(it.price)),0);
 if(discount>subtotal)return alert("تخفیف مبلغی بیشتر از جمع جزء نیست");
 const provisional=Math.max(0,Math.round((subtotal-discount)-((subtotal-discount)*discountPercent/100)));
 const provisionalTotal=Math.round(provisional+(provisional*taxRate/100));
 if(paid>provisionalTotal)return alert("مبلغ پرداختی بیشتر از مبلغ فاکتور است");
 const customerName=$("invCustomerName")?.value.trim()||"";
 const phone=$("invPhone")?.value.trim()||"";
 const settleAccountId=$("invSettleAccount")?.value||"";
 const o={type,name,seller,date,number,items,customerId:$("invCustomer")?.value||"",customerName,phone,address:$("invAddress").value.trim(),discount,discountPercent,taxRate,paid,settleAccountId,status:$("invStatus").value,total:0};o.total=invoiceTotal(o);
 /* فاکتور روزانه (ساده) فیلد جدا برای وضعیت پرداخت/مبلغ دریافتی ندارد؛
    چون این نوع فاکتور برای فروش نقدی و همان‌لحظه است، کل مبلغ به‌صورت
    خودکار «تسویه‌شده» در نظر گرفته می‌شود تا انتخاب «تسویه به حساب» واقعاً
    یک تراکنش در همان حساب ثبت کند. */
 if(type==="daily")o.paid=o.total;
 if(o.status==="paid")o.paid=o.total;if(o.paid>=o.total&&o.total>0)o.status="paid";else if(o.paid>0)o.status="partial";else o.status="unpaid";
 let x;
 if(id){x=data.invoices.find(v=>v.id===id);if(x){adjustStockForInvoice(x,+1);Object.assign(x,o);touch(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}}else{x=touch({id:uid(),...o});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);adjustStockForInvoice(x,-1)}
 if(x){syncPersonForInvoice(x);syncTransactionForInvoice(x)}
 save();logEvent(id?"ویرایش فاکتور":"ساخت فاکتور",`${name} • ${money(o.total)}`,id?"edit":"create");closeModal()
}
/* --- ثبت خودکار تراکنش تسویه فاکتور در حساب انتخاب‌شده --- */
function syncTransactionForInvoice(inv){
 if(!inv)return;
 const paid=Number(inv.paid)||0;
 if(paid>0&&inv.settleAccountId){
  let t=inv.settleTxId?data.transactions.find(x=>x.id===inv.settleTxId):null;
  const title=`تسویه فاکتور: ${inv.name||"فاکتور"}`;
  if(!t){
   t=touch({id:uid(),title,amount:paid,type:"income",category:"تسویه فاکتور",accountID:inv.settleAccountId,date:new Date().toISOString(),source:"invoice-settle",invoiceId:inv.id});
   data.transactions.unshift(t);
   inv.settleTxId=t.id;
  }else{
   t.title=title;t.amount=paid;t.accountID=inv.settleAccountId;touch(t);
  }
  markDirty("transactions",t.id,false,t,t.updatedAt);
  touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 }else if(inv.settleTxId){
  removeRecordSilent("transactions",inv.settleTxId);
  inv.settleTxId="";
  touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 }
}
/* --- اتصال فاکتورهای مانده‌دار/تسویه‌نشده به بخش طلبکاران و همگام‌سازی برگشتی با تراکنش‌ها --- */
function syncPersonForInvoice(inv){
 if(!inv)return;
 const remaining=invoiceRemaining(inv);
 const custName=invoiceCustomerLabel(inv)||inv.name||"مشتری فاکتور";
 if(remaining>0){
  let p=inv.personId?data.people.find(x=>x.id===inv.personId):null;
  if(!p){
   p=touch({id:uid(),type:"credit",name:custName,amount:0,paid:0,note:"",source:"invoice",invoiceId:inv.id});
   data.people.push(p);
   inv.personId=p.id;
  }
  p.name=custName;
  p.amount=invoiceTotal(inv);
  p.paid=Number(inv.paid)||0;
  p.note=`فاکتور: ${inv.name||""}${inv.number?" • شماره "+inv.number:""}`;
  touch(p);markDirty("people",p.id,false,p,p.updatedAt);
  touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 }else if(inv.personId){
  removeRecordSilent("people",inv.personId);
  inv.personId="";
  touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 }
}
function syncInvoiceFromPerson(p){
 if(!p||!p.invoiceId)return;
 const inv=data.invoices.find(x=>x.id===p.invoiceId);
 if(!inv)return;
 const total=invoiceTotal(inv);
 inv.paid=Math.min(total,Number(p.paid)||0);
 if(inv.paid>=total&&total>0)inv.status="paid";else if(inv.paid>0)inv.status="partial";else inv.status="unpaid";
 touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 if(inv.paid>=total&&total>0){
  removeRecordSilent("people",p.id);
  inv.personId="";
  touch(inv);markDirty("invoices",inv.id,false,inv,inv.updatedAt);
 }
}
function duplicateInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;const x=touch({...JSON.parse(JSON.stringify(inv)),id:uid(),number:"",date:new Date().toISOString().slice(0,10),status:"unpaid",paid:0,personId:"",settleTxId:""});data.invoices.unshift(x);markDirty("invoices",x.id,false,x,x.updatedAt);save();logEvent("تکرار فاکتور",x.name,"create")}
function deleteInvoice(id){if(!confirm("این فاکتور حذف شود؟"))return;const x=data.invoices.find(v=>v.id===id);if(x)pushToTrash("invoices",x);adjustStockForInvoice(x,+1);if(x?.personId)removeRecordSilent("people",x.personId);if(x?.settleTxId)removeRecordSilent("transactions",x.settleTxId);removeRecord("invoices",id);logEvent("حذف فاکتور",x?.name||id,"delete")}
function invoiceCustomerLabel(inv){if(inv.customerName)return inv.customerName;const c=inv.customerId?data.customers.find(x=>x.id===inv.customerId):null;return c?.name||""}
function invoiceHTML(inv){
 const total=invoiceTotal(inv);
 const custName=invoiceCustomerLabel(inv);
 const accName=inv.settleAccountId?data.accounts.find(a=>a.id===inv.settleAccountId)?.name:"";
 const settleMeta=(Number(inv.paid)>0&&accName)?` • واریز به: ${esc(accName)}`:"";
 const dailyBadge=inv.type==="daily"?`<span class="daily-badge">روزانه</span>`:"";
 return `<div class="item invoice-item"><div><b>🧾 ${esc(inv.name||"فاکتور")}</b>${dailyBadge}<div class="meta">${esc(inv.seller||"فروشنده ثبت نشده")}${custName?" • مشتری: "+esc(custName):""} • ${invoiceDateLabel(inv.date)}${inv.number?" • شماره "+esc(inv.number):""}</div><div class="meta">جمع کل: ${money(total)} • ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}${settleMeta}</div></div><div class="actions"><button onclick="openInvoice('${inv.id}')">✏️</button><button onclick="previewInvoice('${inv.id}')">👁</button><button onclick="duplicateInvoice('${inv.id}')">📄</button><button onclick="shareInvoice('${inv.id}')">📤</button><button onclick="shareInvoiceImage('${inv.id}')">🖼</button><button class="danger-icon" onclick="deleteInvoice('${inv.id}')">🗑</button></div></div>`
}
function previewInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return; const cust=inv.customerId?data.customers.find(c=>c.id===inv.customerId):null;
 const b=data.branding||{};
 const rows=(inv.items||[]).map(x=>`<div class="preview-inv-row"><span>${esc(x.desc)}</span><span>${fa(x.qty)}</span><span>${money(x.price)}</span><span>${money((Number(x.qty)||0)*(Number(x.price)||0))}</span></div>`).join("");
 const signRow=(b.stamp||b.signature)?`<div class="invoice-sign-row">${b.stamp?`<div class="invoice-sign-box"><img class="invoice-brand-stamp" src="${b.stamp}" alt="مهر فروشگاه"><small>مهر</small></div>`:"<div></div>"}${b.signature?`<div class="invoice-sign-box"><img class="invoice-brand-signature" src="${b.signature}" alt="امضا"><small>امضا</small></div>`:""}</div>`:"";
 const custName=invoiceCustomerLabel(inv);
 const accName=inv.settleAccountId?data.accounts.find(a=>a.id===inv.settleAccountId)?.name:"";
 const settleLine=(Number(inv.paid)>0&&accName)?` • تسویه به حساب: ${esc(accName)}`:"";
 const phoneVal=inv.phone||cust?.phone||"";
 openModal(`<div id="invoicePreview" class="invoice-preview"><div class="invoice-head"><div>${b.logo?`<img class="invoice-brand-logo" src="${b.logo}" alt="لوگو">`:""}<h2>${inv.type==="daily"?"فاکتور روزانه":"فاکتور"}</h2><b>${esc(inv.seller||b.storeName||"")}</b></div><div>شماره: ${esc(inv.number||"—")}<br>تاریخ: ${invoiceDateLabel(inv.date)}</div></div><h3>${esc(inv.name||"فاکتور")}</h3>${custName?`<div class="meta">مشتری: ${esc(custName)}${phoneVal?" • "+esc(phoneVal):""}</div>`:""}${inv.address?`<div class="meta">آدرس: ${esc(inv.address)}</div>`:""}<div class="meta">وضعیت: ${inv.status==="paid"?"🟢 پرداخت کامل":inv.status==="partial"?"🟡 پرداخت بخشی":"🔴 پرداخت نشده"} • مانده: ${money(invoiceRemaining(inv))}${settleLine}</div><div class="preview-inv-row head"><b>توضیحات</b><b>تعداد</b><b>مبلغ واحد</b><b>مبلغ</b></div>${rows}<div class="preview-total">جمع کل: <strong>${money(invoiceTotal(inv))}</strong></div>${signRow}</div><div class="actions invoice-preview-actions"><button class="primary" onclick="printInvoice('${inv.id}')">🖨 چاپ / PDF</button><button class="primary" onclick="shareInvoice('${inv.id}')">📤 ارسال PDF</button><button class="primary" onclick="shareInvoiceImage('${inv.id}')">🖼 ارسال عکس</button></div>`)
}
function loadImg(src){return new Promise(resolve=>{if(!src)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src})}
async function drawInvoiceCanvas(inv,scale=1){
 const b=data.branding||{};
 const W=794, rowH=58, H=Math.max(1123,560+(inv.items||[]).length*rowH);
 const [logoImg,stampImg,signImg]=await Promise.all([loadImg(b.logo),loadImg(b.stamp),loadImg(b.signature)]);
 const c=document.createElement("canvas");c.width=W*scale;c.height=H*scale;const x=c.getContext("2d");
 x.scale(scale,scale);
 x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#17352b";x.textAlign="right";x.direction="rtl";
 if(logoImg)try{x.drawImage(logoImg,55,25,90,70)}catch(e){}
 x.font="bold 34px sans-serif";x.fillText(inv.type==="daily"?"فاکتور روزانه":"فاکتور",W-45,55);
 x.font="bold 22px sans-serif";x.fillText(inv.seller||b.storeName||"فروشگاه / فروشنده",W-45,95);
 x.font="17px sans-serif";x.fillStyle="#56645f";x.fillText("شماره: "+(inv.number||"—"),W-45,130);x.fillText("تاریخ: "+invoiceDateLabel(inv.date),W-245,130);
 x.fillStyle="#17352b";x.font="bold 21px sans-serif";x.fillText(inv.name||"فاکتور",W-45,180);
 const custLabel=invoiceCustomerLabel(inv);
 const custPhone=inv.phone||(inv.customerId?data.customers.find(c=>c.id===inv.customerId)?.phone:"")||"";
 if(custLabel){x.font="16px sans-serif";x.fillStyle="#56645f";x.fillText("مشتری: "+custLabel+(custPhone?" • "+custPhone:""),W-45,208)}
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
/* ---- v2.3 fix: real PDF generation for invoice print/share -----------
 * Previously "چاپ / PDF" called window.print(), which has no effect
 * inside the native Capacitor app (no print bridge is registered, and
 * there was no @media print rule anyway so it would have printed the
 * whole app UI, not just the invoice). And "ارسال فاکتور" only ever
 * shared a JPEG photo of the invoice, never an actual PDF; if
 * navigator.share failed for any non-cancel reason it silently fell
 * back to an <a download> blob link, which does not reliably trigger a
 * download inside the native WebView (same reason the auto-backup
 * feature needed its own native Filesystem fallback, see above).
 *
 * canvasToPdfBytes() below builds a real, spec-valid one-page PDF by
 * embedding the already-rendered invoice canvas as a JPEG image inside
 * a minimal hand-written PDF structure. No external library or network
 * request is needed (kept fully offline, and avoids depending on a CDN
 * that may be filtered — see the gstatic/Firebase note above), and all
 * the Persian text is already rasterized into the image so there is no
 * font-embedding problem. */
function uint8ToBase64(bytes){
 let binary="";const chunk=0x8000;
 for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
 return btoa(binary)
}
function canvasToPdfBytes(canvas,quality=0.92){
 const dataUrl=canvas.toDataURL("image/jpeg",quality);
 const bin=atob(dataUrl.split(",")[1]);
 const jpeg=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)jpeg[i]=bin.charCodeAt(i);
 const W=+(canvas.width*0.75).toFixed(2), H=+(canvas.height*0.75).toFixed(2);
 const enc=s=>{const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&0xff;return a};
 const parts=[];let offset=0;const off=[0];
 const push=b=>{parts.push(b);offset+=b.length};
 push(enc("%PDF-1.3\n"));
 off[1]=offset;push(enc("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
 off[2]=offset;push(enc("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
 off[3]=offset;push(enc(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`));
 const content=`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
 off[4]=offset;push(enc(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`));
 off[5]=offset;push(enc(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`));
 push(jpeg);
 push(enc("\nendstream\nendobj\n"));
 const xrefOffset=offset;
 let xref="xref\n0 6\n0000000000 65535 f \n";
 for(let i=1;i<=5;i++)xref+=String(off[i]).padStart(10,"0")+" 00000 n \n";
 push(enc(xref));
 push(enc(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
 const total=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);let p=0;
 for(const part of parts){out.set(part,p);p+=part.length}
 return out;
}
function isNativeApp(){try{return !!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==="function"&&window.Capacitor.isNativePlatform())}catch(e){return false}}
const INVOICE_PDF_FOLDER="Download/حسابداری/فاکتورها";
async function buildInvoicePdf(inv){
 const c=await drawInvoiceCanvas(inv);
 const bytes=canvasToPdfBytes(c);
 const filename=`${(inv.name||"فاکتور").replace(/[\\/:*?"<>|]/g,"_")}.pdf`;
 return {bytes,filename,blob:new Blob([bytes],{type:"application/pdf"})};
}
/* v3.2: ارسال فاکتور به‌صورت عکس (علاوه بر PDF) — همان طرح فاکتور که برای
 * PDF رسم می‌شود این‌بار با کیفیت دو برابر (drawInvoiceCanvas(inv,2)) به
 * فایل PNG بدون افت کیفیت تبدیل می‌شود تا متن و لوگو/مهر/امضا تیز و
 * خوانا بمانند؛ کاملاً آفلاین، بدون کتابخانه یا سرویس خارجی. */
async function buildInvoiceImage(inv){
 const c=await drawInvoiceCanvas(inv,2);
 const filename=`${(inv.name||"فاکتور").replace(/[\\/:*?"<>|]/g,"_")}.png`;
 const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
 return {filename,blob};
}
async function shareOrSaveInvoiceImage(inv,{announceAs="فاکتور"}={}){
 const {blob,filename}=await buildInvoiceImage(inv);
 const file=new File([blob],filename,{type:"image/png"});
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({title:inv.name||"فاکتور",text:`${inv.name||"فاکتور"} • ${money(invoiceTotal(inv))}`,files:[file]});
   return true;
  }
 }catch(e){if(e?.name==="AbortError")return false}
 const fs=filesystemPlugin();
 if(fs){
  try{
   const buf=await blob.arrayBuffer();
   await fs.writeFile({path:`${INVOICE_PDF_FOLDER}/${filename}`,data:uint8ToBase64(new Uint8Array(buf)),directory:AUTO_BACKUP_DIRECTORY,recursive:true});
   alert(`${announceAs} به‌صورت عکس ذخیره شد:\nDownload/حسابداری/فاکتورها/${filename}\nاز اپ فایل‌های گوشی می‌توانی آن را باز، ارسال یا چاپ کنی.`);
   return true;
  }catch(e){console.warn("invoice image native save failed",e)}
 }
 try{
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  alert(`فایل عکس ${announceAs} آماده دانلود شد.`);
  return true;
 }catch(e){console.warn("invoice image download failed",e);alert("ساخت فایل عکس فاکتور با خطا مواجه شد.");return false}
}
async function shareInvoiceImage(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return;
 await shareOrSaveInvoiceImage(inv,{announceAs:"فاکتور"});
}
/* Tries, in order: native share sheet (works for both "print" via the
 * system Print service and sending to another app) -> native Filesystem
 * save (Capacitor build without share support) -> plain browser download
 * (normal browser/PWA). */
async function shareOrSaveInvoicePdf(inv,{announceAs="فاکتور"}={}){
 const {bytes,filename,blob}=await buildInvoicePdf(inv);
 const file=new File([blob],filename,{type:"application/pdf"});
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({title:inv.name||"فاکتور",text:`${inv.name||"فاکتور"} • ${money(invoiceTotal(inv))}`,files:[file]});
   return true;
  }
 }catch(e){if(e?.name==="AbortError")return false}
 const fs=filesystemPlugin();
 if(fs){
  try{
   await fs.writeFile({path:`${INVOICE_PDF_FOLDER}/${filename}`,data:uint8ToBase64(bytes),directory:AUTO_BACKUP_DIRECTORY,recursive:true});
   alert(`${announceAs} به‌صورت PDF ذخیره شد:\nDownload/حسابداری/فاکتورها/${filename}\nاز اپ فایل‌های گوشی می‌توانی آن را باز، ارسال یا چاپ کنی.`);
   return true;
  }catch(e){console.warn("invoice pdf native save failed",e)}
 }
 try{
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  alert(`فایل PDF ${announceAs} آماده دانلود شد.`);
  return true;
 }catch(e){console.warn("invoice pdf download failed",e);alert("ساخت فایل PDF فاکتور با خطا مواجه شد.");return false}
}
async function shareInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return;
 await shareOrSaveInvoicePdf(inv,{announceAs:"فاکتور"});
}
async function printInvoice(id){
 const inv=data.invoices.find(x=>x.id===id);if(!inv)return;
 if(isNativeApp()){
  await shareOrSaveInvoicePdf(inv,{announceAs:"فاکتور"});
  return;
 }
 previewInvoice(id);setTimeout(()=>window.print(),250);
}
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
  if(!el.classList.contains("open")){const head=el.querySelector(".accordion-head");if(head)toggleAccordion(head)}
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
function renderTopBarDate(){
 const el=$("topBarDate");if(!el)return;
 const t=new Date();
 const j=gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate());
 const wd=jalaliWeekdayIndex(j[0],j[1],j[2]);
 el.textContent=`${PERSIAN_WEEKDAY_NAMES[wd]} ${toFaDigits(j[2])} ${PERSIAN_MONTHS[j[1]-1]} ${toFaDigits(j[0])}`;
}
function render(){
 renderTopBarDate();
 /* v2.2 fix: this used to show base(=sum of accounts' starting balance)+net(=income-expense)
    which ignores "انتقال به دیگران" (transfer to an external person/card). That amount leaves
    an account (accountBalance() subtracts it) but was never subtracted here, so the total on
    the dashboard could sit higher than the real sum of all accounts even though every single
    transaction and every per-account balance was correct. Now it sums the same accountBalance()
    used everywhere else, so the total always matches. */
 const now = new Date();
 const currentMonth = now.getMonth();
 const currentYear = now.getFullYear();
 const currentMonthTransactions = data.transactions.filter(t => {
  if (!t || t.type === "transfer") return false;
  const date = new Date(t.date);
  return !Number.isNaN(date.getTime()) &&
   date.getMonth() === currentMonth &&
   date.getFullYear() === currentYear;
 });
 const inc = currentMonthTransactions
  .filter(t => t.type === "income")
  .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
 const exp = currentMonthTransactions
  .filter(t => t.type === "expense")
  .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
 const totalBalance = data.accounts
  .reduce((sum, account) => sum + accountBalance(account.id), 0);
 if($("balance"))$("balance").textContent=money(totalBalance);if($("income"))$("income").textContent=money(inc);if($("expense"))$("expense").textContent=money(exp);
 if($("recent"))$("recent").innerHTML=sortedTransactions().slice(0,6).map(safeTxHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 if($("accountList")&&pageActive("accounts"))$("accountList").innerHTML=data.accounts.map(a=>`<div class="item account-item"><div class="account-main"><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}${a.sender?" • فرستنده: "+esc(a.sender):""}</div>${cardActions(a)}</div><div><strong>${money(accountBalance(a.id))}</strong>${actionButtons("openAccount","deleteAccount",a.id)}<button type="button" title="گزارش Excel" onclick="exportAccountExcel('${a.id}')">📊</button></div></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 if($("transferList")&&pageActive("accounts"))$("transferList").innerHTML=sortedTransactions().filter(t=>t.type==="transfer").map(t=>{try{return transferItemHTML(t)}catch(e){console.warn("transferItemHTML: skipped a malformed transfer",t?.id,e);return ""}}).join("")||empty("هنوز انتقالی ثبت نشده");
 if($("productList")&&pageActive("products"))renderProducts();
 const q=$("search")?.value?.trim()||"",ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("reportAccount")&&pageActive("reports")){const rv=$("reportAccount").value;$("reportAccount").innerHTML='<option value="">همه حساب‌ها</option>'+data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");$("reportAccount").value=rv;}
 if($("filterCat")&&pageActive("transactions")){let opts='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("filterCat").innerHTML=opts;$("filterCat").value=fc}
 if($("txList")&&pageActive("transactions"))$("txList").innerHTML=sortedTransactions().filter(t=>(!q||String(t.title).includes(q)||String(t.category||"").includes(q)||String(t.otherName||"").includes(q)||(t.type==="transfer"&&String(data.accounts.find(a=>a.id===t.from)?.name||"").includes(q))||(t.type==="transfer"&&String(data.accounts.find(a=>a.id===t.to)?.name||"").includes(q)))&&(!ft||t.type===ft)&&(!fc||t.category===fc||String(t.category||"").startsWith(fc+" - "))).map(safeTxHTML).join("")||empty("تراکنشی پیدا نشد");
 if($("customerList")&&pageActive("customers"))renderCustomers();
 if($("peopleList")&&pageActive("people"))$("peopleList").innerHTML=data.people.filter(p=>(p.type||"debt")===peopleMode).map(p=>{const total=Number(p.amount)||0,paid=Math.min(Number(p.paid)||0,total),remaining=Math.max(0,total-paid);const inst=p.installments;const instMeta=inst?`<div class="meta">🧾 اقساط: ${fa(inst.items.filter(x=>x.paid).length)} از ${fa(inst.count)} پرداخت‌شده</div>`:"";const instBtn=inst?`<button type="button" onclick="openInstallments('${p.id}')">اقساط</button>`:`<button type="button" onclick="payPerson('${p.id}')">تسویه</button>`;const invBadge=p.source==="invoice"?`<div class="meta">🧾 مانده فاکتور</div>`:"";const dueLabel=p.type==="credit"?"سررسید واریز":"سررسید پرداخت";return `<div class="item"><div><b>${esc(p.name)}</b>${invBadge}<div class="meta">${p.due?dueLabel+": "+p.due:""}${p.note?" • "+esc(p.note):""}</div><div class="meta">کل: ${money(total)} • تسویه: ${money(paid)}</div>${instMeta}</div><div><strong>${money(remaining)}</strong><div class="actions">${instBtn}${actionButtons("openPerson","deletePerson",p.id)}</div></div></div>`}).join("")||empty(peopleMode==="debt"?"هنوز بدهکاری ثبت نشده":"هنوز طلبی ثبت نشده");
 if($("reminderList")&&pageActive("reminders")){const normalReminders=data.reminders.filter(r=>!r.sourceNoteId&&!r.sourcePersonId).sort((a,b)=>(a.order??0)-(b.order??0)); const noteAlarms=data.reminders.filter(r=>r.sourceNoteId); const peopleAlarms=data.reminders.filter(r=>r.sourcePersonId); const normal=normalReminders.map((r,i)=>{const accId="rem-"+r.id;const isOpen=openAccordions.has(accId);return `<div class="item accordion-card${isOpen?' open':''}" data-acc-id="${accId}"><button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span>🔔 <b>${esc(r.title)}</b></span><span>⌄</span></button><div class="accordion-body"><div class="meta">${jalaliLabel(r.date)} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div><div class="accordion-actions"><strong>${r.amount?money(r.amount):""}</strong><div class="reorder-btns"><button type="button" title="انتقال به بالا" ${i===0?"disabled":""} onclick="event.stopPropagation();moveReminder('${r.id}',-1)">▲</button><button type="button" title="انتقال به پایین" ${i===normalReminders.length-1?"disabled":""} onclick="event.stopPropagation();moveReminder('${r.id}',1)">▼</button></div>${actionButtons("openReminder","deleteReminder",r.id)}</div></div></div>`}).join(""); $("reminderList").innerHTML=`<div class="section-label">🔔 یادآوری‌های مستقل</div>${normal||empty("یادآوری مستقلی ندارید")}${noteAlarms.length?`<div class="section-label">📝⏰ آلارم یادداشت‌ها</div>`+noteAlarms.map(r=>{const accId="remnote-"+r.id;const isOpen=openAccordions.has(accId);return `<div class="item accordion-card${isOpen?' open':''}" data-acc-id="${accId}"><button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="toggleAccordion(this,event)"><span>📝 <b>${esc(r.title)}</b></span><span>⌄</span></button><div class="accordion-body"><div class="meta">${jalaliLabel(r.date)} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div></div></div>`}).join(""):``}${peopleAlarms.length?`<div class="section-label">👤 سررسید بدهکار/بستانکار</div>`+peopleAlarms.map(r=>{const accId="remperson-"+r.id;const isOpen=openAccordions.has(accId);return `<div class="item accordion-card${isOpen?' open':''}" data-acc-id="${accId}"><button class="accordion-head" type="button" aria-expanded="${isOpen}" onclick="event.stopPropagation();openPerson('${r.sourcePersonId}')"><span>${r.type==="income"?"💰":"⚠️"} <b>${esc(r.title)}</b></span><span>⌄</span></button><div class="accordion-body"><div class="meta">${jalaliLabel(r.date)}${r.amount?" • "+money(r.amount):""}</div></div></div>`}).join(""):``}`;}
 if($("noteList")&&pageActive("notes")){
   document.querySelectorAll("#notesModeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===notesMode));
   if(notesMode==="table"){
     $("noteList").style.display="none";
     if($("notesTableView")){$("notesTableView").style.display="";$("notesTableView").innerHTML=notesWeekTableHTML();}
   }else{
     $("noteList").style.display="";
     if($("notesTableView")){$("notesTableView").style.display="none";$("notesTableView").innerHTML="";}
     const sortedNotes=[...data.notes].sort((a,b)=>(a.order??0)-(b.order??0));$("noteList").innerHTML=sortedNotes.map((n,i)=>noteHTML(n,{i,total:sortedNotes.length})).join("")||empty("یادداشتی ندارید");
   }
 }
 if($("invoiceList")&&pageActive("invoices"))$("invoiceList").innerHTML=data.invoices.map(invoiceHTML).join("")||empty("هنوز فاکتوری ساخته نشده است");
 if($("checkList")&&pageActive("checks")){
   const sortedChecks=[...data.checks].sort((a,b)=>{const da=isCheckDueSoon(a)?0:1,db=isCheckDueSoon(b)?0:1;if(da!==db)return da-db;const ta=localDateFromInput(a.date)?.getTime()||0,tb=localDateFromInput(b.date)?.getTime()||0;return ta-tb});
   $("checkList").innerHTML=sortedChecks.map(c=>{const accName=data.accounts.find(a=>a.id===c.accountID)?.name;const dueSoon=isCheckDueSoon(c);const badge=checkDueBadge(c);const cDueLabel=c.type==="receive"?"سررسید واریز":"سررسید پرداخت";return `<div class="item check-row${c.settled?" check-settled":""}${dueSoon?" item-low check-duesoon":""}"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${cDueLabel}: ${jalaliLabel(c.date)}${c.bank?" • "+esc(c.bank):""}${c.nationalCode?" • کد ملی "+esc(c.nationalCode):""}</div><div class="meta">${accName?"🏦 "+esc(accName):"⚠️ بدون حساب متصل"} • ${c.settled?"✅ نشسته":"⏳ در انتظار"}${badge?" • "+badge:""}</div></div><div class="check-row-side"><strong class="${c.type==="receive"?"income":"expense"}">${money(c.amount)}</strong><button type="button" class="check-settle-btn${c.settled?" is-settled":""}" onclick="toggleCheckSettled('${c.id}')">${c.settled?"↩️ لغو نشستن":"✅ ثبت نشستن"}</button>${actionButtons("openCheck","deleteCheck",c.id)}</div></div>`}).join("")||empty("چکی ثبت نشده");
 }
 if(pageActive("reports")){
   const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+((Number(p.amount)||0)-(Number(p.paid)||0)),0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+((Number(p.amount)||0)-(Number(p.paid)||0)),0);
   if($("totalDebt"))$("totalDebt").textContent=money(debt);if($("totalCredit"))$("totalCredit").textContent=money(credit);
   if($("reportStats")){const now=new Date(),m=now.getMonth(),y=now.getFullYear();const mt=data.transactions.filter(t=>{const d=new Date(t.date);return !isNaN(d)&&d.getMonth()===m&&d.getFullYear()===y});const mi=mt.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0),me=mt.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);const cats={};mt.filter(t=>t.type==="expense").forEach(t=>cats[t.category||"سایر"]=(cats[t.category||"سایر"]||0)+Number(t.amount||0));const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);$("reportStats").innerHTML=`<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>${fa(data.transactions.length)}</b></div><div class="card"><span>تعداد چک</span><b>${fa(data.checks.length)}</b></div><div class="card"><span>درآمد این ماه</span><b class="income">${money(mi)}</b></div><div class="card"><span>هزینه این ماه</span><b class="expense">${money(me)}</b></div></div><div class="card report-card"><h3>📊 بیشترین دسته‌های هزینه این ماه</h3>${top.map((x,i)=>`<div class="report-row"><span>${fa(i+1)}. ${esc(x[0])}</span><strong>${money(x[1])}</strong></div>`).join("")||`<p class="hint">هنوز هزینه‌ای در این ماه ثبت نشده.</p>`}</div><div class="card report-card"><h3>🏦 مانده حساب‌ها</h3>${data.accounts.map(a=>`<div class="report-row"><span>${esc(a.name)}</span><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||`<p class="hint">حسابی ثبت نشده.</p>`}</div>`;}
   drawChart(inc,exp);renderAudit();renderAdvancedReport();renderBudgets();renderProductProfit();
 }
 renderYearSettlement();renderDueSoon();if($("settings" )?.classList.contains("active"))renderBrandingInSettings();if(pageActive("trash"))renderTrash()}
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
function drawChart(inc,exp){const c=$("chart");if(!c)return;const x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);const max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{const bh=v[0]/max*170;x.fillStyle=i?"#C1483A":"#2F9E5B";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#5B564A";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
/* ---- v3.11: گزارش سودآوری کالا ----
 * چون هر کالا از قبل قیمت خرید (buyPrice) و قیمت فروش دارد، و هر ردیف
 * فاکتور (invoice.items) شامل productId/qty/price است، سود واقعیِ هر
 * کالا را می‌شود مستقیم از فروش‌های ثبت‌شده حساب کرد — بدون نیاز به هیچ
 * داده‌ی تازه‌ای. اینجا برای هر کالا مجموع فروش، تعداد فروخته‌شده، سود
 * کل و درصد سود حساب و مرتب می‌شود؛ اگر کالایی هنوز در هیچ فاکتوری
 * فروخته نشده، در این گزارش نمی‌آید (چیزی برای سنجیدن ندارد). */
function productProfitData(){
 const stats=new Map();
 for(const inv of data.invoices){
  for(const it of inv.items||[]){
   if(!it.productId)continue;
   const p=data.products.find(x=>x.id===it.productId);if(!p)continue;
   const qty=Number(it.qty)||0,revenue=qty*(Number(it.price)||0),unitCost=Number(it.costPriceAtSale)||Number(p.buyPrice)||0,cost=qty*unitCost;
   const s=stats.get(p.id)||{name:p.name,qty:0,revenue:0,cost:0};
   s.qty+=qty;s.revenue+=revenue;s.cost+=cost;
   stats.set(p.id,s);
  }
 }
 return [...stats.values()].map(s=>({...s,profit:s.revenue-s.cost,margin:s.revenue>0?(s.revenue-s.cost)/s.revenue*100:0}));
}
function renderProductProfit(){
 const box=$("productProfitReport"),card=$("productProfitCard");if(!box||!card)return;
 const rows=productProfitData();
 if(!rows.length){card.style.display="none";return}
 card.style.display="";
 const bySoldDesc=[...rows].sort((a,b)=>b.profit-a.profit);
 const top=bySoldDesc.slice(0,5),bottom=[...bySoldDesc].reverse().slice(0,5);
 const rowHTML=r=>`<div class="report-row"><span>${esc(r.name)}<small>${fa(r.qty)} فروش • حاشیه سود ${fa(Math.round(r.margin))}٪</small></span><strong class="${r.profit>=0?"income":"expense"}">${money(r.profit)}</strong></div>`;
 box.innerHTML=`<div class="report-sub-title">🥇 پرسودترین کالاها</div>${top.map(rowHTML).join("")}<div class="report-sub-title">🥶 کم‌سودترین کالاها</div>${bottom.map(rowHTML).join("")}`;
}
function backupPayload(){return {format:"hesabdar-backup-data",version:1,appVersion:APP_VERSION,createdAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(data))}}
/* v1.2.8: رمزنگاری بکاپ — بکاپ خروجی (که قرار است بین گوشی‌ها منتقل شود)
 * با AES-GCM رمزنگاری می‌شود؛ کلید با PBKDF2/SHA-256 از رمز عبور بکاپ
 * ساخته می‌شود و هرگز خودِ رمز یا کلید ذخیره نمی‌شود، فقط salt/iv/متن
 * رمزشده داخل فایل می‌ماند. */
async function deriveAesKey(password,saltB64){
 const salt=saltB64?b64ToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));
 const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
 return {key,salt:bytesToB64(salt)};
}
async function encryptBackupPayload(payload,password){
 const {key,salt}=await deriveAesKey(password);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=new TextEncoder().encode(JSON.stringify(payload));
 const cipherBuf=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);
 return {format:"hesabdar-encrypted-backup",version:1,appVersion:APP_VERSION,createdAt:new Date().toISOString(),salt,iv:bytesToB64(iv),ciphertext:bytesToB64(cipherBuf)};
}
async function decryptBackupPayload(container,password){
 const {key}=await deriveAesKey(password,container.salt);
 const iv=b64ToBytes(container.iv),cipherBytes=b64ToBytes(container.ciphertext);
 const plainBuf=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipherBytes);
 return JSON.parse(new TextDecoder().decode(plainBuf));
}
/* Bug fix: this used to only do the browser <a download> trick, which
 * relies on the WebView actually handing the click off to Android's
 * download manager. On a Capacitor native build that hand-off is
 * unreliable — on many devices/WebView versions the click fires with no
 * error and the "بازیابی با موفقیت..." alert form ("فایل ساخته شد")
 * still shows, but no file ever actually lands in Downloads, so a
 * restore later fails with "file not found". The auto-backup routine
 * already solved this correctly (native Filesystem plugin first, browser
 * download only as a fallback) — manual backup now goes through the same
 * path so the button either genuinely saves a file, or clearly reports
 * failure instead of lying about success. */
async function exportData(){
 const password=prompt("این بکاپ حاوی اطلاعات مالی شماست. یک رمز عبور برای رمزنگاری فایل تعیین کن (حداقل ۸ کاراکتر؛ این رمز فقط پیش خودت می‌ماند و بدون آن فایل قابل بازیابی نیست):");
 if(password===null)return;
 if(password.trim().length<8)return alert("رمز عبور بکاپ باید حداقل ۸ کاراکتر باشد.");
 let payload;
 try{payload=await encryptBackupPayload(backupPayload(),password.trim())}
 catch(e){console.warn("backup encrypt",e);return alert("رمزنگاری بکاپ انجام نشد. دوباره تلاش کن.")}
 const res=await writeAutoBackupFile(payload);
 if(res?.ok){
  logEvent("پشتیبان‌گیری","فایل پشتیبان رمزنگاری‌شده صادر شد • "+res.filename,"settings");
  markBackupDone();
  const where=res.method==="filesystem"?`در پوشه ${res.where} با نام ${res.filename} `:"";
  alert(`فایل پشتیبان رمزنگاری‌شده ${where}ساخته شد. آن را به گوشی دیگر منتقل کن و هنگام بازیابی، همین رمز عبور را وارد کن. این رمز را حتماً جایی یادداشت کن؛ بدون آن بازیابی ممکن نیست.`);
 }else{
  alert("پشتیبان‌گیری انجام نشد. دوباره تلاش کن.");
 }
}
function stripBom(s){return s&&s.charCodeAt(0)===0xFEFF?s.slice(1):s}
async function readBackupFile(file){
 if(!file)throw new Error("no-file");
 // Android content:// files (received via Telegram/WhatsApp/Bluetooth/Drive etc.) sometimes
 // fail silently with FileReader.readAsText on certain OEM WebViews, or come back with a
 // byte-order-mark that breaks JSON.parse. Try several read strategies before giving up.
 try{const text=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error||new Error("FileReader failed"));r.readAsText(file,"utf-8")});const t=stripBom(text);if(t.trim())return t}catch(e){console.warn("FileReader backup read failed",e)}
 try{if(typeof file.text==="function"){const text=await file.text();const t=stripBom(String(text||""));if(t.trim())return t}}catch(e){console.warn("file.text() backup read failed",e)}
 try{const buf=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("FileReader arrayBuffer failed"));r.readAsArrayBuffer(file)});const t=stripBom(new TextDecoder("utf-8").decode(buf));if(t.trim())return t}catch(e){console.warn("ArrayBuffer backup read failed",e)}
 throw new Error("empty-backup");
}
async function replaceCloudAfterRestore(){
 if(!sync.user||!sync.db)return;
 const restoreAt=new Date().toISOString();
 const ks=["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats","audit"];
 // A file restore is authoritative. Give every restored record a fresh timestamp so
 // an older pending change on the other phone cannot win the timestamp merge later.
 for(const k of ks){for(const r of (data[k]||[])){r.updatedAt=restoreAt;r.updatedBy=sync.user.uid}}
 data._sync??={tombstones:{}};data._sync.tombstones??={};
 for(const k of ks){for(const id of Object.keys(data._sync.tombstones?.[k]||{}))data._sync.tombstones[k][id]=restoreAt}
 persistLocal();
 const col=recordsCollection(),snap=await col.get(),localMap=new Map(recordsFromLocal().map(x=>[x.id,x]));
 for(let i=0;i<snap.docs.length;i+=450){const batch=sync.db.batch();for(const d of snap.docs.slice(i,i+450)){if(!localMap.has(d.id))batch.delete(d.ref)}await batch.commit()}
 const all=recordsFromLocal();sync.dirty.clear();await commitChunks(all);
 await sync.db.collection("users").doc(sync.user.uid).set({appVersion:APP_VERSION,lastRestoreAt:restoreAt,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
}
async function importData(e){
 const input=e?.target,file=input?.files?.[0];if(!file)return;const finish=()=>{if(input)input.value=""};
 try{
  const raw=await readBackupFile(file),parsed=JSON.parse(raw);
  let restored;
  if(parsed?.format==="hesabdar-encrypted-backup"&&parsed.salt&&parsed.iv&&parsed.ciphertext){
   let decrypted=null;
   for(let attempt=0;attempt<3&&!decrypted;attempt++){
    const pass=prompt(attempt===0?"این بکاپ رمزنگاری‌شده است. رمز عبور بکاپ را وارد کن:":"رمز عبور اشتباه بود؛ دوباره تلاش کن:");
    if(pass===null){finish();return}
    try{const inner=await decryptBackupPayload(parsed,pass.trim());decrypted=inner?.data&&typeof inner.data==="object"?inner.data:inner}catch(e){decrypted=null}
   }
   if(!decrypted)throw new Error("wrong-password");
   restored=decrypted;
  }else{
   restored=parsed?.format==="hesabdar-backup"&&parsed.data&&typeof parsed.data==="object"?parsed.data:parsed;
   if(!confirm("این فایل پشتیبان رمزنگاری‌نشده است (نسخه قدیمی). ادامه می‌دهی؟"))return finish();
  }
  if(!restored||typeof restored!=="object"||Array.isArray(restored))throw new Error("invalid-backup");
  const previousLock={pin:data.pin,pinHash:data.pinHash,pinSalt:data.pinSalt,patternHash:data.patternHash,patternSalt:data.patternSalt,lockMethod:data.lockMethod,biometricEnabled:data.biometricEnabled,webauthnCredId:data.webauthnCredId};
  const wasHydrating=sync.hydrating;sync.hydrating=true;
  try{
   data=JSON.parse(JSON.stringify(restored));data=migrateData(data);normalizeData();Object.assign(data,previousLock);data.audit??=[];data.notes??=[];
   // Mark the restore as a complete replacement locally before any async work.
   persistLocal();render();
   if(sync.unsubscribe){sync.unsubscribe();sync.unsubscribe=null}
   sync.dirty.clear();
   if(sync.user&&sync.db)await replaceCloudAfterRestore();
   // Verify the exact restored collections, not just two arrays.
   for(const k of ["accounts","transactions","people","customers","products","reminders","notes","checks","invoices","expenseCats","incomeCats"]){if(!Array.isArray(data?.[k]))throw new Error("storage-verification-failed:"+k)}
   normalizeData();render();persistLocal();
   logEvent("بازیابی اطلاعات","پشتیبان وارد شد و اطلاعات روی این گوشی جایگزین شد","settings");persistLocal();
  }finally{
   sync.hydrating=wasHydrating;
   if(sync.user&&sync.db&&!sync.unsubscribe){sync.unsubscribe=recordsCollection().onSnapshot(snap=>{if(sync.hydrating)return;const remote=snap.docs.map(d=>d.data());if(mergeCloud(remote)){persistLocal();render();syncSave()}setSyncStatus("☁️ آنلاین • همگام‌سازی لحظه‌ای")},err=>setSyncStatus("⚠️ همگام‌سازی: "+(err.code||err.message)))}
  }
  finish();alert("بازیابی با موفقیت انجام شد. اطلاعات فایل پشتیبان روی این گوشی جایگزین شد.");
 }catch(err){finish();console.error("backup restore",err);
  const msg=err&&err.message==="empty-backup"?"بازیابی انجام نشد: فایل انتخاب‌شده خوانده نشد (خالی بود). اگر فایل از تلگرام/بلوتوث دریافت شده، اول آن را دانلود کن (نه فقط پیش‌نمایش) و از پوشه Download انتخابش کن.":err&&err.message==="wrong-password"?"بازیابی انجام نشد: رمز عبور بکاپ اشتباه بود.":"بازیابی انجام نشد: فایل پشتیبان خوانده یا معتبر نیست. فایل JSON اصلی را دوباره انتخاب کن.";
  alert(msg)}
}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){const pin=data.pin,pinHash=data.pinHash,pinSalt=data.pinSalt,patternHash=data.patternHash,patternSalt=data.patternSalt,lockMethod=data.lockMethod,biometricEnabled=data.biometricEnabled,webauthnCredId=data.webauthnCredId,lang=data.lang;data=blankData();data.pin=pin;data.pinHash=pinHash;data.pinSalt=pinSalt;data.patternHash=patternHash;data.patternSalt=patternSalt;data.lockMethod=lockMethod;data.biometricEnabled=biometricEnabled;data.webauthnCredId=webauthnCredId;data.lang=lang;save();logEvent("پاک کردن اطلاعات","اطلاعات برنامه پاک شد","delete");}}
(async function initApp(){
  if(globalThis.HesabYarStorage){
    try{
      const stored=await HesabYarStorage.hydrate(null);
      if(stored){
        /* IndexedDB همیشه مرجع است؛ نسخه‌ی قدیمی localStorage (اگر مانده) هرگز جایش را نمی‌گیرد. */
        data=migrateData(stored)||stored;
        normalizeData();
      }else{
        /* اولین اجرا روی IndexedDB: داده‌ی فعلی (از localStorage قدیمی یا خالی) نوشته می‌شود و فقط بعد از
           تأیید خواندن‌مجدد، نسخه‌ی قدیمی پاک می‌شود. اگر داده‌ی قدیمی خراب بود، دست‌نخورده می‌ماند. */
        normalizeData();
        await HesabYarStorage.saveSnapshot(data);
        if(legacyLoaded&&!legacyCorrupt&&await HesabYarStorage.verifySnapshot(data)){
          try{localStorage.removeItem(KEY);for(const k of LEGACY_KEYS)localStorage.removeItem(k)}catch(e){}
        }
      }
      HesabYarStorage.requestPersistence();
    }catch(e){
      console.warn("IndexedDB unavailable; falling back to localStorage",e);
      storageMode="localStorage";
      if(legacyCorrupt)alert("⚠️ اطلاعات قبلی روی این دستگاه خوانده نشد. تا زمانی که پشتیبان نگرفته‌ای برنامه را پاک یا حذف نکن.");
    }
  }
  storageReady=true;
  normalizeData();ensureCashAccount();
  if(_persistDeferred){_persistDeferred=false;persistLocal()}
  normalizeData();purgeOldTrash();setupReminderNotificationActions();applyAccentThemeOnLoad();await migratePinSecurity();showLock();render();applyDashboardConfig();applyAppMode();renderBrandingInSettings();try{const rid=new URLSearchParams(location.search).get("reminder");if(rid)setTimeout(()=>{const rr=(data.reminders||[]).find(x=>x.id===rid);if(rr?.sourcePersonId)openPerson(rr.sourcePersonId);else if(rr)openReminder(rr.id)},500)}catch(e){}renderSettingsFeatures();applyLanguage();maybeBackupReminder();processRecurringTransactions();logEvent("اجرای برنامه","برنامه حسابدار اجرا شد","system");await initSync();if(!sync.auth){[4000,12000,30000].forEach(ms=>setTimeout(()=>{if(!sync.auth)initSync()},ms))}syncAllNotesToReminders().catch(console.error);syncAllChecksToReminders().catch(console.error);syncAllPeopleToReminders().catch(console.error);rescheduleAllNativeReminders().catch(console.error);startUpdateChecker();startReminderChecker();if(!hasLockCode())setTimeout(showWhatsNewOnce,320);})();

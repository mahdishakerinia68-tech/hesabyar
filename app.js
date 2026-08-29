const KEY="hesabdar-v11";
const SYNC_KEY="hesabdar-firebase-config-v1";
const SYNC_META_KEY="hesabdar-sync-meta-v1";
let sync={app:null,auth:null,db:null,user:null,unsubscribe:null,ready:false,saving:false,queued:false};
function syncConfig(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||"null")}catch{return null}}
function syncMeta(){try{return JSON.parse(localStorage.getItem(SYNC_META_KEY)||"{}")}catch{return {}}}
function setSyncStatus(t){const e=$("syncStatus");if(e)e.textContent=t||""}

const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
const money=n=>fa(n)+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const uid=()=>{try{if(globalThis.crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID()}catch(e){}return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2)};
const blankData=()=>({accounts:[],transactions:[],people:[],reminders:[],checks:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name})),pin:""});
window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});

let data;
try{data=JSON.parse(localStorage.getItem(KEY)||"null")}catch{data=null}
data=data||blankData();
data.accounts??=[];data.transactions??=[];data.people??=[];data.reminders??=[];data.checks??=[];data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name}));data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name}));data.pin=typeof data.pin==="string"?data.pin:"";
let peopleMode="debt";
function save(){localStorage.setItem(KEY,JSON.stringify(data));render(); syncSave()}
async function initSync(){
  const cfg=syncConfig();
  if(!cfg||!window.firebase)return;
  try{
    if(!sync.app)sync.app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
    sync.auth=firebase.auth(); sync.db=firebase.firestore();
    sync.auth.onAuthStateChanged(async user=>{
      sync.user=user;
      fillSettingsSyncEmail();
      if(sync.unsubscribe){sync.unsubscribe();sync.unsubscribe=null}
      if(!user){sync.ready=false;setSyncStatus("☁️ اتصال تنظیم شده؛ وارد حساب همگام‌سازی شو.");return}
      sync.ready=true;
      const ref=sync.db.collection("users").doc(user.uid);
      sync.unsubscribe=ref.onSnapshot(s=>{
        if(!s.exists){ref.set({data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});setSyncStatus("☁️ آماده همگام‌سازی");return}
        const remote=s.data()?.data;
        if(remote&&typeof remote==="object"&&!sync.saving){data={...blankData(),...remote};localStorage.setItem(KEY,JSON.stringify(data));render()}
        setSyncStatus("☁️ همگام‌سازی فعال است");
      },err=>setSyncStatus("⚠️ خطای همگام‌سازی: "+err.message));
    });
  }catch(e){console.error(e);setSyncStatus("⚠️ تنظیمات Firebase نامعتبر است") }
}
async function syncSave(){
  if(!sync.ready||!sync.user||!sync.db)return;
  sync.queued=true;
  if(sync.saving)return;
  sync.saving=true;
  while(sync.queued){
    sync.queued=false;
    try{
      await sync.db.collection("users").doc(sync.user.uid).set({data:JSON.parse(JSON.stringify(data)),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){console.error(e);setSyncStatus("⚠️ ذخیره ابری انجام نشد: "+e.message)}
  }
  sync.saving=false;
}
function openSyncSettings(){
 const c=syncConfig()||{};
 openModal(`<h2>☁️ اتصال دو گوشی</h2><div class="form">
 <p class="hint">این بخش فقط تنظیمات اتصال را روی همین دستگاه ذخیره می‌کند. اطلاعات Firebase را از Project settings کپی کن.</p>
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
function fillSettingsSyncEmail(){
 const e=$("settingsSyncEmail");
 if(e&&sync.user)e.value=sync.user.email||"";
}
async function loginFromSettings(){
 const email=$("settingsSyncEmail")?.value.trim(), pass=$("settingsSyncPass")?.value;
 if(!email||!pass)return alert("ایمیل و رمز را وارد کن");
 if(!await ensureSyncReady())return;
 try{await sync.auth.signInWithEmailAndPassword(email,pass);alert("ورود با موفقیت انجام شد؛ همگام‌سازی فعال شد");$("settingsSyncPass").value="";setSyncStatus("☁️ همگام‌سازی فعال است")}
 catch(e){alert("ورود ناموفق: "+(e.message||e))}
}
async function createFromSettings(){
 const email=$("settingsSyncEmail")?.value.trim(), pass=$("settingsSyncPass")?.value;
 if(!email||!pass)return alert("ایمیل و رمز را وارد کن");
 if(pass.length<6)return alert("رمز باید حداقل ۶ کاراکتر باشد");
 if(!await ensureSyncReady())return;
 try{await sync.auth.createUserWithEmailAndPassword(email,pass);alert("حساب ساخته شد و همگام‌سازی فعال است. همین ایمیل و رمز را روی گوشی دوم وارد کن.");$("settingsSyncPass").value="";setSyncStatus("☁️ همگام‌سازی فعال است")}
 catch(e){alert("ساخت حساب ناموفق: "+(e.message||e))}
}
async function logoutSync(){try{await sync.auth?.signOut();alert("از حساب همگام‌سازی خارج شد")}catch(e){alert(e.message)}}

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
 data.pin=p;save();alert("رمز با موفقیت ذخیره شد");
}
function removePin(){
 if(!data.pin)return alert("هنوز رمزی فعال نیست");
 const p=prompt("رمز فعلی را وارد کن:");
 if(p!==data.pin)return alert("رمز فعلی اشتباه است");
 data.pin="";save();alert("رمز حذف شد");
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
}));
$("theme").onclick=()=>document.body.classList.toggle("dark");
$("menuBtn").onclick=()=>$("menuModal").classList.remove("hidden");
function closeMenu(){$("menuModal").classList.add("hidden")}
$("menuModal").addEventListener("click",e=>{if(e.target.id==="menuModal")closeMenu()});

const modal=$("modal"),modalBody=$("modalBody");
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}

function accountSelect(id="acc"){return `<select id="${id}">${data.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}${a.bank?" • "+esc(a.bank):""}</option>`).join("")}</select>`}
function openAccount(){openModal(`<h2>افزودن حساب</h2><div class="form"><input id="an" placeholder="نام حساب"><input id="bank" placeholder="نام بانک"><input id="sender" placeholder="شماره فرستنده پیامک بانک"><input id="card" placeholder="شماره کارت (اختیاری)"><input id="ab" type="number" placeholder="موجودی اولیه"><button class="primary" onclick="addAccount()">ذخیره</button></div>`)}
function addAccount(){if(!an.value.trim())return alert("نام حساب را وارد کن");data.accounts.push({id:uid(),name:an.value.trim(),bank:bank.value.trim(),sender:sender.value.trim(),card:card.value.trim(),balance:Number(ab.value)||0});save();closeModal()}

function categoryButtons(type){
 const arr=type==="expense"?data.expenseCats:data.incomeCats;
 return `<div class="category-window">${arr.map(c=>`<button type="button" class="cat-btn" onclick="pickCategory('${type}','${esc(c.id)}')">${esc(c.name)}</button>`).join("")}</div>`;
}
function openTx(){
 if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کن");
 openModal(`<h2>ثبت تراکنش</h2><div class="form">
 <div class="type-switch"><button type="button" id="expBtn" class="chosen" onclick="txType('expense')">💸 هزینه</button><button type="button" id="incBtn" onclick="txType('income')">💰 دریافت</button></div>
 <input id="txKind" type="hidden" value="expense"><input id="title" placeholder="عنوان هزینه">
 <div id="expensePanel"><b id="catLabel">دسته هزینه را انتخاب کن</b>${categoryButtons("expense")}<input id="cat" type="hidden"></div>
 <div id="incomePanel" style="display:none"><b id="incatLabel">دریافت برای چه بوده؟</b>${categoryButtons("income")}<input id="incat" type="hidden"></div>
 ${accountSelect("acc")}<button class="primary" onclick="addTx()">ثبت</button></div>`);
}
function txType(t){$("txKind").value=t;$("expBtn").classList.toggle("chosen",t==="expense");$("incBtn").classList.toggle("chosen",t==="income");$("expensePanel").style.display=t==="expense"?"block":"none";$("incomePanel").style.display=t==="income"?"block":"none";$("title").placeholder=t==="expense"?"عنوان هزینه (اختیاری)":"توضیح دریافت (اختیاری)"}
function pickCategory(type,id){const arr=type==="expense"?data.expenseCats:data.incomeCats,c=arr.find(x=>x.id===id);if(!c)return;if(type==="expense"){$("cat").value=c.name;$("catLabel").textContent="دسته هزینه: "+c.name}else{$("incat").value=c.name;$("incatLabel").textContent="نوع دریافت: "+c.name}}
function addTx(){
 const amount=parseMoney($("amount")?.value||0); // amount is created below if missing
 if(!amount)return alert("مبلغ را وارد کن");
 const t=$("txKind").value,cat=t==="expense"?$("cat").value:$("incat").value;if(!cat)return alert(t==="expense"?"دسته هزینه را انتخاب کن":"نوع دریافت را انتخاب کن");
 data.transactions.unshift({id:uid(),title:$("title").value.trim()||cat,amount,type:t,category:cat,accountID:$("acc").value,date:new Date().toISOString(),source:"manual"});save();closeModal()
}
// Amount input is inserted when opening a transaction; patch the generated form safely.
const _oldOpenTx=openTx;
openTx=function(){
 if(!data.accounts.length)return alert("اول از بخش حساب‌ها یک حساب اضافه کن");
 _oldOpenTx();
 const f=$("title"); if(f){const amount=document.createElement("input");amount.id="amount";amount.type="number";amount.placeholder="مبلغ";f.insertAdjacentElement("afterend",amount)}
}

function openBankMessage(){
 if(!data.accounts.length)return alert("اول یک حساب اضافه کن");
 openModal(`<h2>پیامک بانک</h2><div class="form"><textarea id="sms" placeholder="متن کامل پیامک بانک را Paste کن"></textarea>${accountSelect("ba")}<button class="primary" onclick="parseSMS()">تشخیص تراکنش</button></div><p class="hint">اگر مبلغ با + شروع شود دریافت و اگر با - شروع شود برداشت ثبت می‌شود. در نبود علامت، از متن پیامک تشخیص داده می‌شود.</p>`)
}
function parseSMSAmount(text){
 const s=normalize(text);
 const signed=[...s.matchAll(/([+-])\s*(\d[\d,\.]*)/g)];
 if(signed.length){const m=signed[0];return {amount:parseMoney(m[2]),type:m[1]==="-"?"expense":"income",reason:"علامت + / - مبلغ"}}
 const nums=[...s.matchAll(/\d[\d,\.]{2,}/g)].map(x=>parseMoney(x[0])).filter(Boolean);
 const ex=/(برداشت|خرید|پرداخت|کسر|برداشت از|debit|purchase|withdraw)/i.test(s);
 const inc=/(واریز|دریافت|افزایش|بستانکار|credit|deposit|received)/i.test(s);
 return {amount:nums[0]||0,type:ex&&!inc?"expense":inc&&!ex?"income":"",reason:"عبارات پیامک"};
}
function parseSMS(){
 const r=parseSMSAmount($("sms").value);
 if(!r.amount||!r.type)return alert("نوع تراکنش مشخص نشد. در پیامک از + برای دریافت یا - برای برداشت استفاده کن، یا متن واریز/برداشت را داشته باشد.");
 const cats=r.type==="income"?data.incomeCats:data.expenseCats;
 openModal(`<h2>تأیید پیامک</h2><div class="card sms-preview"><p>نوع: <b>${r.type==="income"?"💰 دریافت / واریز":"💸 برداشت / هزینه"}</b></p><p>مبلغ: <b>${r.type==="income"?"+":"−"}${money(r.amount)}</b></p><p>روش تشخیص: ${esc(r.reason)}</p></div><div class="form"><input id="bt" value="${r.type==="income"?"دریافت بانکی":"برداشت بانکی"}"><select id="bc">${cats.map(c=>`<option>${esc(c.name)}</option>`).join("")}</select><button class="primary" onclick="saveBankTx('${r.type}',${r.amount},'${esc($("ba").value)}')">تأیید و ثبت</button></div>`)
}
function saveBankTx(type,amount,accountID){data.transactions.unshift({id:uid(),title:$("bt").value.trim()||"تراکنش بانکی",amount,type,category:$("bc").value,accountID,date:new Date().toISOString(),source:"bank"});save();closeModal()}

function openTransfer(){
 if(data.accounts.length<2)return alert("برای انتقال حداقل دو حساب لازم است");
 openModal(`<h2>انتقال بین حساب‌ها</h2><div class="form">${accountSelect("from")}<span style="text-align:center">↓</span>${accountSelect("to")}<input id="tam" type="number" placeholder="مبلغ"><input id="tnote" placeholder="توضیحات"><button class="primary" onclick="addTransfer()">انتقال</button></div>`);
}
function addTransfer(){if($("from").value===$("to").value)return alert("مبدأ و مقصد باید متفاوت باشند");let a=parseMoney($("tam").value);if(!a)return alert("مبلغ را وارد کن");data.transactions.unshift({id:uid(),title:$("tnote").value||"انتقال بین حساب‌ها",amount:a,type:"transfer",from:$("from").value,to:$("to").value,date:new Date().toISOString(),source:"transfer"});save();closeModal()}

function openCategory(){
 openModal(`<h2>دسته‌بندی‌ها</h2><div class="section-head"><b>دسته‌های هزینه</b><button onclick="addCatPrompt('expense')">＋</button></div><div class="category-window">${data.expenseCats.map(c=>`<button class="cat-btn">${esc(c.name)}</button>`).join("")}</div><div class="section-head"><b>نوع‌های دریافت</b><button onclick="addCatPrompt('income')">＋</button></div><div class="category-window">${data.incomeCats.map(c=>`<button class="cat-btn">${esc(c.name)}</button>`).join("")}</div>`)
}
function addCatPrompt(type){let n=prompt(type==="expense"?"نام دسته هزینه:":"نام نوع دریافت:");if(!n?.trim())return;let arr=type==="expense"?data.expenseCats:data.incomeCats;arr.push({id:uid(),name:n.trim()});save();openCategory()}

function openPerson(){openModal(`<h2>بدهکار / بستانکار</h2><div class="form"><select id="pt"><option value="debt">من بدهکارم</option><option value="credit">من طلبکارم</option></select><input id="pn" placeholder="نام شخص"><input id="pa" type="number" placeholder="مبلغ"><input id="pd" type="date"><textarea id="pnote" placeholder="توضیحات"></textarea><button class="primary" onclick="addPerson()">ذخیره</button></div>`)}
function addPerson(){if(!$("pn").value.trim()||!parseMoney($("pa").value))return alert("نام و مبلغ را وارد کن");data.people.push({id:uid(),type:$("pt").value,name:$("pn").value.trim(),amount:parseMoney($("pa").value),paid:0,due:$("pd").value,note:$("pnote").value});save();closeModal()}
function payPerson(id){let p=data.people.find(x=>x.id===id);let v=prompt("مبلغ تسویه:",String(p.amount-p.paid));if(v!==null){p.paid=Math.min(p.amount,p.paid+parseMoney(v));save()}}

function openReminder(){openModal(`<h2>یادآوری</h2><div class="form"><input id="rt" placeholder="عنوان"><input id="ra" type="number" placeholder="مبلغ"><input id="rd" type="datetime-local"><select id="rr"><option value="once">یک‌بار</option><option value="monthly">ماهانه</option><option value="weekly">هفتگی</option></select><select id="rb"><option value="expense">پرداخت</option><option value="income">دریافت</option></select><button class="primary" onclick="addReminder()">ذخیره</button></div>`)}
function addReminder(){if(!$("rt").value||!$("rd").value)return alert("عنوان و تاریخ لازم است");data.reminders.push({id:uid(),title:$("rt").value,amount:parseMoney($("ra").value),date:$("rd").value,repeat:$("rr").value,type:$("rb").value});save();closeModal()}
function openCheck(){openModal(`<h2>ثبت چک</h2><div class="form"><select id="ct"><option value="receive">چک دریافتی</option><option value="pay">چک پرداختی</option></select><input id="cn" placeholder="نام شخص"><input id="camount" type="number" placeholder="مبلغ"><input id="cdate" type="date"><input id="cnum" placeholder="شماره چک"><input id="cbank" placeholder="بانک"><textarea id="cnote" placeholder="توضیحات"></textarea><button class="primary" onclick="addCheck()">ذخیره</button></div>`)}
function addCheck(){if(!$("cn").value||!parseMoney($("camount").value)||!$("cdate").value)return alert("نام، مبلغ و تاریخ لازم است");data.checks.push({id:uid(),type:$("ct").value,name:$("cn").value,amount:parseMoney($("camount").value),date:$("cdate").value,number:$("cnum").value,bank:$("cbank").value,note:$("cnote").value,done:false});save();closeModal()}
function requestNotifications(){if(!("Notification"in window))return alert("اعلان در این مرورگر در دسترس نیست");Notification.requestPermission().then(p=>alert(p==="granted"?"اعلان فعال شد":"اجازه اعلان داده نشد"))}

function accountBalance(id){let a=data.accounts.find(x=>x.id===id),v=Number(a?.balance)||0;data.transactions.forEach(t=>{if(t.type==="income"&&t.accountID===id)v+=t.amount;if(t.type==="expense"&&t.accountID===id)v-=t.amount;if(t.type==="transfer"){if(t.from===id)v-=t.amount;if(t.to===id)v+=t.amount}});return v}
function txHTML(t){if(t.type==="transfer")return `<div class="item"><div><b>↔ ${esc(t.title)}</b><div class="meta">${esc(data.accounts.find(a=>a.id===t.from)?.name||"")} ← ${esc(data.accounts.find(a=>a.id===t.to)?.name||"")}</div></div><strong>${money(t.amount)}</strong></div>`;let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||"")} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":"دستی"}</div></div><strong class="${t.type}">${sign}${money(t.amount)}</strong></div>`}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}
function render(){
 const inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),base=data.accounts.reduce((s,a)=>s+(Number(a.balance)||0),0),net=inc-exp;
 if($("balance"))$("balance").textContent=money(base+net);if($("income"))$("income").textContent=money(inc);if($("expense"))$("expense").textContent=money(exp);
 if($("recent"))$("recent").innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 if($("accountList"))$("accountList").innerHTML=data.accounts.map(a=>`<div class="item"><div><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}${a.sender?" • فرستنده: "+esc(a.sender):""}</div></div><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 const q=$("search")?.value?.trim()||"",ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("filterCat")){let opts='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("filterCat").innerHTML=opts;$("filterCat").value=fc}
 if($("txList"))$("txList").innerHTML=data.transactions.filter(t=>(!q||String(t.title).includes(q)||String(t.category||"").includes(q))&&(!ft||t.type===ft)&&(!fc||t.category===fc)).map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 if($("peopleList"))$("peopleList").innerHTML=data.people.filter(p=>p.type===peopleMode).map(p=>`<div class="item"><div><b>${esc(p.name)}</b><div class="meta">${p.due?"سررسید: "+p.due:""} ${p.note?"• "+esc(p.note):""}</div></div><div><strong>${money(p.amount-p.paid)}</strong><button onclick="payPerson('${p.id}')">تسویه</button></div></div>`).join("")||empty("موردی ثبت نشده");
 if($("reminderList"))$("reminderList").innerHTML=data.reminders.map(r=>`<div class="item"><div><b>${esc(r.title)}</b><div class="meta">${new Date(r.date).toLocaleString("fa-IR")} • ${r.repeat==="once"?"یک‌بار":r.repeat==="weekly"?"هفتگی":"ماهانه"}</div></div><strong>${r.amount?money(r.amount):""}</strong></div>`).join("")||empty("یادآوری ندارید");
 if($("checkList"))$("checkList").innerHTML=data.checks.map(c=>`<div class="item"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${c.date}${c.bank?" • "+esc(c.bank):""}</div></div><strong>${money(c.amount)}</strong></div>`).join("")||empty("چکی ثبت نشده");
 if($("categoryList"))$("categoryList").innerHTML='<div class="card"><b>هزینه‌ها</b><p>'+data.expenseCats.map(c=>esc(c.name)).join(" • ")+'</p><b>دریافت‌ها</b><p>'+data.incomeCats.map(c=>esc(c.name)).join(" • ")+'</p></div>';
 const debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+p.amount-p.paid,0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+p.amount-p.paid,0);
 if($("totalDebt"))$("totalDebt").textContent=money(debt);if($("totalCredit"))$("totalCredit").textContent=money(credit);
 if($("reportStats"))$("reportStats").innerHTML='<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>'+fa(data.transactions.length)+'</b></div><div class="card"><span>تعداد چک</span><b>'+fa(data.checks.length)+'</b></div></div>';
 drawChart(inc,exp)
}
function drawChart(inc,exp){const c=$("chart");if(!c)return;const x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);const max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{const bh=v[0]/max*170;x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#374151";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
function exportData(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabdar-backup.json";a.click()}
function importData(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);save();showLock();alert("بازیابی شد")}catch{alert("فایل نامعتبر است")}};r.readAsText(file)}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){const pin=data.pin;data=blankData();data.pin=pin;save();}}
showLock();render();initSync();

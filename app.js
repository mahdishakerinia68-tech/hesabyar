const KEY="hesabdar-v5";
const defaultsExpense=["بنزین","غذا و رستوران","خرید خانه","خرید روزانه","قبض","اینترنت و شارژ","حمل‌ونقل","پوشاک","درمان","تفریح","هدیه","سایر"];
const defaultsIncome=["حقوق","پاداش","واریز","فروش","دریافت از شخص","سایر"];
let data=JSON.parse(localStorage.getItem(KEY)||"null")||{accounts:[],transactions:[],people:[],reminders:[],checks:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name})),pin:"123456"};
data.accounts??=[];data.transactions??=[];data.people??=[];data.reminders??=[];data.checks??=[];
data.expenseCats??=defaultsExpense.map((name,i)=>({id:"e"+i,name}));
data.incomeCats??=defaultsIncome.map((name,i)=>({id:"i"+i,name}));
data.pin??="123456";if(data.pin==="")data.pin="123456";
const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
const money=n=>fa(n)+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const save=()=>{localStorage.setItem(KEY,JSON.stringify(data));render()};
function normalize(s){
  return String(s||"").replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٬،]/g,",").replace(/\s+/g," ").trim();
}
function parseMoneyText(v){
  return Number(String(v).replace(/[^\d]/g,""))||0;
}
function parseSMSAmount(text){
  const s=normalize(text);
  // Explicit signed amount. Handles +1,000,000 / - 1,000,000 and Persian digits.
  const signed=[...s.matchAll(/([+-])\s*([\d][\d,\.]*)/g)];
  if(signed.length){
    // Prefer a signed number near words like مبلغ/واریز/برداشت, otherwise first signed number.
    let m=signed.find(x=>/مبلغ|واریز|برداشت|خرید|پرداخت|amount|deposit|withdraw/i.test(s.slice(Math.max(0,x.index-30),x.index)))||signed[0];
    return {amount:parseMoneyText(m[2]),type:m[1]==="-"?"expense":"income",reason:"علامت مبلغ"};
  }
  // Common bank formats without explicit sign.
  const nums=[...s.matchAll(/\d[\d,\.]{2,}/g)].map(x=>parseMoneyText(x[0])).filter(n=>n>0);
  const expense=/برداشت|خرید|پرداخت|کسر|برداشت از|debit|purchase|withdraw/i.test(s);
  const income=/واریز|دریافت|افزایش|بستانکار|credit|deposit|received/i.test(s);
  return {amount:nums[0]||0,type:expense&&!income?"expense":income&&!expense?"income":"","reason":expense&&!income?"کلمات پیامک":"کلمات پیامک"};
}
function ensurePin(){if(data.pin){lock.classList.remove("hidden");app.style.display="none"}else{lock.classList.add("hidden");app.style.display="block"}}
function unlock(){if(!data.pin)return setPin(true);if(pinInput.value===data.pin){lock.classList.add("hidden");app.style.display="block";pinInput.value=""}else alert("رمز اشتباه است")}
function setPin(first=false){let p=prompt(first?"برای حسابدار یک رمز ۴ تا ۸ رقمی تعیین کن":"رمز جدید ۴ تا ۸ رقمی:");if(p===null)return;if(!/^\d{4,8}$/.test(p))return alert("رمز باید ۴ تا ۸ رقم باشد");data.pin=p;save();ensurePin();alert("رمز با موفقیت فعال شد")}
function resetPin(){setPin(false)}
function clearPin(){if(confirm("رمز ورود حذف شود؟")){data.pin="";save();ensurePin()}}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(b.dataset.page).classList.add("active");render()});
$("theme").onclick=()=>document.body.classList.toggle("dark");

function openAccount(){modalBody.innerHTML='<h2>حساب / بانک</h2><div class="form"><input id="an" placeholder="نام حساب"><input id="bank" placeholder="نام بانک"><input id="sender" placeholder="شماره فرستنده پیامک بانک"><input id="card" placeholder="شماره کارت (اختیاری)"><input id="ab" type="number" placeholder="موجودی اولیه"><button class="primary" onclick="addAccount()">ذخیره</button></div>';modal.classList.remove("hidden")}
function addAccount(){if(!an.value.trim())return alert("نام حساب را وارد کن");data.accounts.push({id:crypto.randomUUID(),name:an.value.trim(),bank:bank.value.trim(),sender:sender.value.trim(),card:card.value.trim(),balance:Number(ab.value)||0});save();closeModal()}
function accountSelect(id="acc"){return '<select id="'+id+'">'+data.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")+'</select>'}

function categoryButtons(type){
  const arr=type==="expense"?data.expenseCats:data.incomeCats;
  return '<div class="category-window">'+arr.map(c=>`<button type="button" class="cat-btn" onclick="pickCategory('${type}','${c.id}')">${esc(c.name)}</button>`).join("")+'</div>';
}
function pickCategory(type,id){
  const arr=type==="expense"?data.expenseCats:data.incomeCats,c=arr.find(x=>x.id===id);
  if(type==="expense"){$("cat").value=c.name;$("catLabel").textContent="دسته هزینه: "+c.name}
  else {$("incat").value=c.name;$("incatLabel").textContent="نوع دریافت: "+c.name}
}
function openTx(){
 if(!data.accounts.length)return alert("اول یک حساب بساز");
 modalBody.innerHTML='<h2>ثبت تراکنش</h2><div class="form"><div class="type-switch"><button id="expBtn" class="chosen" onclick="txType("expense")">💸 هزینه</button><button id="incBtn" onclick="txType("income")">💰 دریافت</button></div><input id="txKind" type="hidden" value="expense"><input id="title" placeholder="عنوان یا توضیح"><input id="amount" type="number" placeholder="مبلغ"><div id="expensePanel"><b id="catLabel">دسته هزینه را انتخاب کن</b>'+categoryButtons("expense")+'<input id="cat" type="hidden"></div><div id="incomePanel" style="display:none"><b id="incatLabel">دریافت برای چه بوده؟</b>'+categoryButtons("income")+'<input id="incat" type="hidden"></div>'+accountSelect()+"<button class="primary" onclick="addTx()">ثبت</button></div>';modal.classList.remove("hidden")
}
function txType(t){
 txKind.value=t;
 expBtn.classList.toggle("chosen",t==="expense");incBtn.classList.toggle("chosen",t==="income");
 expensePanel.style.display=t==="expense"?"block":"none";incomePanel.style.display=t==="income"?"block":"none";
 title.placeholder=t==="expense"?"عنوان هزینه (اختیاری)":"توضیح دریافت (اختیاری)";
}
function addTx(){
 let n=Number(amount.value);if(!n)return alert("مبلغ را وارد کن");
 let t=txKind.value,catName=t==="expense"?cat.value:incat.value;if(!catName)return alert(t==="expense"?"یک دسته هزینه انتخاب کن":"نوع دریافت را انتخاب کن");
 data.transactions.unshift({id:crypto.randomUUID(),title:title.value||catName,amount:n,type:t,category:catName,accountID:acc.value,date:new Date().toISOString(),source:"manual"});save();closeModal()
}

function openBankMessage(){
 if(!data.accounts.length)return alert("اول یک حساب بانکی اضافه کن");
 modalBody.innerHTML='<h2>تشخیص پیامک بانک</h2><div class="form"><textarea id="sms" placeholder="متن کامل پیامک بانک را Paste کن..."></textarea>'+accountSelect("ba")+'<button class="primary" onclick="parseSMS()">تشخیص پیامک</button></div>';modal.classList.remove("hidden")
}
function parseSMS(){
 let raw=sms.value||"",r=parseSMSAmount(raw);
 if(!r.amount||!r.type)return alert("نتوانستم نوع تراکنش را تشخیص بدهم. پیامک باید علامت + یا - داشته باشد یا عبارت واریز/برداشت در آن باشد.");
 let label=r.type==="income"?"💰 دریافت / واریز":"💸 برداشت / هزینه", sign=r.type==="income"?"+":"−";
 let suggested=r.type==="income"?data.incomeCats[0]?.name:data.expenseCats[0]?.name;
 modalBody.innerHTML=`<h2>تأیید پیامک</h2><div class="card sms-preview"><p>نوع: <b class="${r.type==="income"?"ok":"bad"}">${label}</b></p><p>مبلغ: <b>${sign}${money(r.amount)}</b></p><p>تشخیص: <b>${esc(r.reason)}</b></p><p>حساب: <b>${esc(data.accounts.find(a=>a.id===ba.value)?.name||"")}</b></p></div><div class="form"><input id="bt" value="${r.type==="income"?"دریافت بانکی":"برداشت بانکی"}"><select id="bc">${(r.type==="income"?data.incomeCats:data.expenseCats).map(c=>`<option ${c.name===suggested?"selected":""}>${esc(c.name)}</option>`).join("")}</select><button class="primary" onclick="saveBankTx('${r.type}',${r.amount},'${ba.value}')">تأیید و ثبت</button></div>`; 
}
function saveBankTx(type,amount,accountID){
 let cat=bc.value;if(data.transactions.some(t=>t.source==="bank"&&t.amount===amount&&t.accountID===accountID&&Date.now()-new Date(t.date)<86400000))return alert("احتمالاً این تراکنش قبلاً ثبت شده است");
 data.transactions.unshift({id:crypto.randomUUID(),title:bt.value,amount,type,category:cat,accountID,date:new Date().toISOString(),source:"bank"});save();closeModal()
}

function openCategory(){
 modalBody.innerHTML='<h2>مدیریت دسته‌بندی‌ها</h2><p>هزینه‌ها و دریافت‌ها جدا هستند.</p><div class="section-head"><b>دسته‌های هزینه</b><button onclick="addCatPrompt('expense')">＋</button></div><div class="category-window">'+data.expenseCats.map(c=>`<button class="cat-btn">${esc(c.name)}</button>`).join("")+'</div><div class="section-head"><b>دسته‌های دریافت</b><button onclick="addCatPrompt('income')">＋</button></div><div class="category-window">'+data.incomeCats.map(c=>`<button class="cat-btn">${esc(c.name)}</button>`).join("")+'</div>';modal.classList.remove("hidden")
}
function addCatPrompt(type){let n=prompt(type==="expense"?"نام دسته هزینه:":"نام نوع دریافت:");if(!n)return;let arr=type==="expense"?data.expenseCats:data.incomeCats;arr.push({id:crypto.randomUUID(),name:n.trim()});save();openCategory()}

function openPerson(){modalBody.innerHTML='<h2>بدهکار / بستانکار</h2><div class="form"><select id="pt"><option value="debt">من بدهکارم</option><option value="credit">من طلبکارم</option></select><input id="pn" placeholder="نام شخص"><input id="pa" type="number" placeholder="مبلغ"><input id="pd" type="date"><textarea id="pnote" placeholder="توضیحات"></textarea><button class="primary" onclick="addPerson()">ذخیره</button></div>';modal.classList.remove("hidden")}
function addPerson(){if(!pn.value||!Number(pa.value))return alert("نام و مبلغ را وارد کن");data.people.push({id:crypto.randomUUID(),type:pt.value,name:pn.value,amount:Number(pa.value),paid:0,due:pd.value,note:pnote.value});save();closeModal()}
function payPerson(id){let p=data.people.find(x=>x.id===id),v=prompt("مبلغ تسویه:",String(p.amount-p.paid));if(v!==null){p.paid=Math.min(p.amount,p.paid+(Number(v)||0));save()}}

function openReminder(){modalBody.innerHTML='<h2>یادآوری</h2><div class="form"><input id="rt" placeholder="عنوان"><input id="ra" type="number" placeholder="مبلغ"><input id="rd" type="datetime-local"><select id="rr"><option value="once">یک‌بار</option><option value="monthly">ماهانه</option><option value="weekly">هفتگی</option></select><select id="rb"><option>پرداخت</option><option>دریافت</option></select><button class="primary" onclick="addReminder()">ذخیره</button></div>';modal.classList.remove("hidden")}
function addReminder(){if(!rt.value||!rd.value)return alert("عنوان و تاریخ لازم است");data.reminders.push({id:crypto.randomUUID(),title:rt.value,amount:Number(ra.value)||0,date:rd.value,repeat:rr.value,type:rb.value});save();closeModal()}
function openCheck(){modalBody.innerHTML='<h2>ثبت چک</h2><div class="form"><select id="ct"><option value="receive">چک دریافتی</option><option value="pay">چک پرداختی</option></select><input id="cn" placeholder="نام شخص"><input id="camount" type="number" placeholder="مبلغ"><input id="cdate" type="date"><input id="cnum" placeholder="شماره چک"><input id="cbank" placeholder="بانک"><textarea id="cnote" placeholder="توضیحات"></textarea><button class="primary" onclick="addCheck()">ذخیره</button></div>';modal.classList.remove("hidden")}
function addCheck(){if(!cn.value||!Number(camount.value)||!cdate.value)return alert("نام، مبلغ و تاریخ لازم است");data.checks.push({id:crypto.randomUUID(),type:ct.value,name:cn.value,amount:Number(camount.value),date:cdate.value,number:cnum.value,bank:cbank.value,note:cnote.value,done:false});save();closeModal()}
function requestNotifications(){if(!("Notification"in window))return alert("اعلان در این مرورگر در دسترس نیست");Notification.requestPermission().then(p=>alert(p==="granted"?"اعلان فعال شد":"اجازه اعلان داده نشد"))}

function render(){
 let inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),base=data.accounts.reduce((s,a)=>s+a.balance,0);
 let net=data.transactions.filter(t=>t.type==="income"||t.type==="expense").reduce((s,t)=>s+(t.type==="income"?t.amount:-t.amount),0);
 $("balance").textContent=money(base+net);$("income").textContent=money(inc);$("expense").textContent=money(exp);
 $("recent").innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 $("accountList").innerHTML=data.accounts.map(a=>`<div class="item"><div><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")} ${a.sender?"• فرستنده: "+esc(a.sender):""}</div></div><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 let q=($("search")?.value||"").trim(),ft=$("filterType")?.value||"",fc=$("filterCat")?.value||"";
 if($("filterCat"))$("filterCat").innerHTML='<option value="">همه دسته‌ها</option>'+[...data.expenseCats,...data.incomeCats].map(c=>`<option ${fc===c.name?"selected":""}>${esc(c.name)}</option>`).join("");
 $("txList").innerHTML=data.transactions.filter(t=>t.type!=="transfer"&&(!q||t.title.includes(q)||t.category.includes(q))&&(!ft||t.type===ft)&&(!fc||t.category===fc)).map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 $("peopleList").innerHTML=data.people.filter(p=>p.type===peopleMode).map(p=>`<div class="item"><div><b>${esc(p.name)}</b><div class="meta">${p.due?"سررسید: "+p.due:""}</div></div><div><strong>${money(p.amount-p.paid)}</strong><button onclick="payPerson('${p.id}')">تسویه</button></div></div>`).join("")||empty("موردی ثبت نشده");
 $("reminderList").innerHTML=data.reminders.map(r=>`<div class="item"><div><b>${esc(r.title)}</b><div class="meta">${new Date(r.date).toLocaleString("fa-IR")} • ${r.repeat}</div></div><strong>${r.amount?money(r.amount):""}</strong></div>`).join("")||empty("یادآوری ندارید");
 $("checkList").innerHTML=data.checks.map(c=>`<div class="item"><div><b>${c.type==="receive"?"دریافتی":"پرداختی"} • ${esc(c.name)}</b><div class="meta">${c.date} ${c.bank?"• "+esc(c.bank):""}</div></div><strong>${money(c.amount)}</strong></div>`).join("")||empty("چکی ثبت نشده");
 $("categoryList").innerHTML='<div class="card"><b>هزینه‌ها</b><p>'+data.expenseCats.map(c=>esc(c.name)).join(" • ")+'</p><b>دریافت‌ها</b><p>'+data.incomeCats.map(c=>esc(c.name)).join(" • ")+'</p></div>';
 let debt=data.people.filter(p=>p.type==="debt").reduce((s,p)=>s+p.amount-p.paid,0),credit=data.people.filter(p=>p.type==="credit").reduce((s,p)=>s+p.amount-p.paid,0);$("totalDebt").textContent=money(debt);$("totalCredit").textContent=money(credit);$("reportStats").innerHTML='<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>'+fa(data.transactions.length)+'</b></div><div class="card"><span>تعداد چک</span><b>'+fa(data.checks.length)+'</b></div></div>';
 drawChart(inc,exp)
}
function accountBalance(id){let a=data.accounts.find(x=>x.id===id),v=a?.balance||0;data.transactions.filter(t=>t.accountID===id).forEach(t=>v+=t.type==="income"?t.amount:t.type==="expense"?-t.amount:0);data.transactions.filter(t=>t.type==="transfer").forEach(t=>{if(t.from===id)v-=t.amount;if(t.to===id)v+=t.amount});return v}
function txHTML(t){let a=data.accounts.find(x=>x.id===t.accountID),sign=t.type==="income"?"+":"−";return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category)} • ${a?esc(a.name):""} • ${t.source==="bank"?"بانکی":"دستی"}</div></div><strong class="${t.type}">${sign}${money(t.amount)}</strong></div>`}
function empty(s){return `<div class="card" style="text-align:center">${s}</div>`}
function drawChart(inc,exp){let c=$("chart");if(!c)return;let x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);let max=Math.max(inc,exp,1);[[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{let bh=v[0]/max*170;x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,90,bh);x.fillStyle="#374151";x.font="20px sans-serif";x.fillText(v[1],155+i*190,h-12)})}
function exportData(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabdar-backup.json";a.click()}
function importData(e){let r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);save();ensurePin();alert("بازیابی شد")}catch{alert("فایل نامعتبر است")}};r.readAsText(e.target.files[0])}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){let pin=data.pin;data={accounts:[],transactions:[],people:[],reminders:[],checks:[],expenseCats:defaultsExpense.map((name,i)=>({id:"e"+i,name})),incomeCats:defaultsIncome.map((name,i)=>({id:"i"+i,name})),pin};save()}}
function closeModal(){$("modal").classList.add("hidden")}
ensurePin();render();

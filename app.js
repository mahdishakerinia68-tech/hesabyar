const KEY="hesabyar-v1";
let data=JSON.parse(localStorage.getItem(KEY)||'{"accounts":[],"transactions":[]}');

const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n)||0);
const money=n=>fa(n)+" تومان";
const save=()=>{localStorage.setItem(KEY,JSON.stringify(data));render()};

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 document.getElementById(b.dataset.page).classList.add("active");render();
});
document.getElementById("theme").onclick=()=>document.body.classList.toggle("dark");

function openAccount(){
 modalBody.innerHTML=`<h2>حساب جدید</h2><div class="form">
<input id="an" placeholder="نام حساب (مثلاً بانک ملت)">
<input id="bank" placeholder="نام بانک">
<input id="ab" type="number" placeholder="موجودی اولیه">
<button class="primary" onclick="addAccount()">ذخیره حساب</button></div>`;
 modal.classList.remove("hidden");
}
function addAccount(){
 let name=an.value.trim(); if(!name)return alert("نام حساب را وارد کنید");
 data.accounts.push({id:crypto.randomUUID(),name,bank:bank.value.trim(),balance:Number(ab.value)||0});
 save();closeModal();
}
function openTx(){
 if(!data.accounts.length)return alert("اول یک حساب اضافه کن");
 modalBody.innerHTML=`<h2>ثبت تراکنش</h2><div class="form">
<select id="tt"><option value="expense">هزینه</option><option value="income">درآمد</option></select>
<input id="title" placeholder="عنوان">
<input id="amount" type="number" placeholder="مبلغ به تومان">
<input id="cat" placeholder="دسته‌بندی (مثلاً خرید)">
<select id="acc">${data.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}</select>
<button class="primary" onclick="addTx()">ثبت تراکنش</button></div>`;
 modal.classList.remove("hidden");
}
function addTx(){
 let n=Number(amount.value);if(!n||!title.value)return alert("عنوان و مبلغ را وارد کن");
 data.transactions.unshift({id:crypto.randomUUID(),title:title.value,amount:n,type:tt.value,category:cat.value||"سایر",accountID:acc.value,date:new Date().toISOString()});
 save();closeModal();
}
function closeModal(){modal.classList.add("hidden")}
function render(){
 let inc=data.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
 let exp=data.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
 let base=data.accounts.reduce((s,a)=>s+a.balance,0);
 balance.textContent=money(base+inc-exp);income.textContent=money(inc);expense.textContent=money(exp);
 recent.innerHTML=data.transactions.slice(0,6).map(txHTML).join("")||empty("هنوز تراکنشی ثبت نشده");
 accountList.innerHTML=data.accounts.map(a=>`<div class="item"><div><b>${esc(a.name)}</b><div class="meta">${esc(a.bank||"حساب شخصی")}</div></div><strong>${money(accountBalance(a.id))}</strong></div>`).join("")||empty("هنوز حسابی اضافه نشده");
 let q=(document.getElementById("search")?.value||"").trim();
 let list=data.transactions.filter(t=>!q||t.title.includes(q)||t.category.includes(q));
 txList.innerHTML=list.map(txHTML).join("")||empty("تراکنشی پیدا نشد");
 drawChart(inc,exp);reportStats.innerHTML=`<div class="grid"><div class="card"><span>تعداد تراکنش</span><b>${fa(data.transactions.length)}</b></div><div class="card"><span>تعداد حساب</span><b>${fa(data.accounts.length)}</b></div></div>`;
}
function accountBalance(id){
 let a=data.accounts.find(x=>x.id===id);let v=a?.balance||0;
 data.transactions.filter(t=>t.accountID===id).forEach(t=>v+=t.type==="income"?t.amount:-t.amount);return v;
}
function txHTML(t){
 let a=data.accounts.find(x=>x.id===t.accountID);let sign=t.type==="income"?"+":"−";
 return `<div class="item"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category)} • ${a?esc(a.name):"حذف شده"}</div></div><strong class="${t.type}">${sign}${money(t.amount)}</strong></div>`;
}
function empty(s){return `<div class="card" style="text-align:center;color:#6b7280">${s}</div>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function drawChart(inc,exp){
 let c=document.getElementById("chart");if(!c)return;let x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);
 let max=Math.max(inc,exp,1), bw=90;
 [[inc,"درآمد"],[exp,"هزینه"]].forEach((v,i)=>{let bh=(v[0]/max)*170; x.fillStyle=i?"#ef4444":"#22c55e";x.fillRect(150+i*190,h-45-bh,bw,bh);x.fillStyle="#374151";x.font="28px sans-serif";x.fillText(fa(v[0]),145+i*190,h-55-bh);x.font="20px sans-serif";x.fillText(v[1],160+i*190,h-12)});
}
function exportData(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="hesabyar-backup.json";a.click()}
function importData(e){let r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);save()}catch{alert("فایل نامعتبر است")}};r.readAsText(e.target.files[0])}
function clearData(){if(confirm("همه اطلاعات حذف شود؟")){data={accounts:[],transactions:[]};save()}}
render();
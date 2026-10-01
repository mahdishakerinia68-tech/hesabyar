/* حساب‌یار V4 — بخش‌های مالی جدید: بودجه، اهداف، پس‌انداز، دارایی‌ها، هم‌خرج، تقویم مالی + فیلتر چک‌ها
 * هر بخش یک «پیکربندی» دارد و موتور مشترک لیست/فیلتر/فرم/Excel را به کار می‌برد. */
(function (root) {
  'use strict';
  var V = root.V4, E = V.esc, M = V.money, FA = V.fa;
  var UI = root.V4UI = root.V4UI || {};
  var state = {};                       // وضعیت فیلتر هر بخش
  var calState = { jy: 0, jm: 0, sel: '' };
  var $ = function (id) { return document.getElementById(id); };
  var D = function () { return V.getData(); };

  var SORTS = [['date-desc', 'جدیدترین'], ['date-asc', 'قدیمی‌ترین'], ['amount-desc', 'مبلغ: زیاد به کم'], ['amount-asc', 'مبلغ: کم به زیاد'], ['name-asc', 'نام (الفبا)']];
  var STATUS_FA = { ok: 'عادی', warn: 'نزدیک سقف', over: 'از سقف گذشته', active: 'در حال انجام', done: 'تکمیل‌شده', late: 'گذشته از مهلت', has: 'دارای موجودی', empty: 'خالی', profit: 'سود', loss: 'زیان', flat: 'بدون تغییر', open: 'تسویه‌نشده', settled: 'تسویه‌شده', pending: 'در انتظار', overdue: 'سررسید گذشته', todo: 'پیش رو' };
  var KINDS = ['طلا و سکه', 'ملک', 'خودرو', 'ارز', 'سهام و صندوق', 'رمزارز', 'سایر'];

  /* ---------- کمکی‌های تاریخ ---------- */
  var ymd = V.ymd;
  function jl(iso) { return iso ? FA0(root.jalaliLabel ? root.jalaliLabel(iso) : iso) : '—'; }
  function FA0(s) { return String(s).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function nowJ() { return root.jalaliInputValue ? root.jalaliInputValue(new Date().toISOString()) : ''; }
  function dateField(id, iso) { return root.simpleDateField(id, iso ? root.jalaliInputValue(iso) : ''); }
  function readDate(id, label, optional) {
    var v = ($(id) || {}).value || '';
    if (!String(v).trim()) { if (optional) return ''; throw new Error(label + ' را وارد کن'); }
    var iso = root.jalaliToISO(v);
    if (!iso) throw new Error(label + ' نامعتبر است (نمونه: ۱۴۰۵/۰۶/۰۸)');
    return iso;
  }
  function accOpts(sel, withAll, allLabel) {
    return (withAll ? '<option value="">' + E(allLabel || 'همه حساب‌ها') + '</option>' : '') + (D().accounts || []).map(function (a) { return '<option value="' + E(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + E(a.name) + '</option>'; }).join('');
  }
  function accName(id) { var a = (D().accounts || []).find(function (x) { return x.id === id; }); return a ? a.name : ''; }
  function field(label, html) { return '<label class="v4-field"><span>' + label + '</span>' + html + '</label>'; }
  function bar(pct, status) { return '<div class="v4-bar"><i class="' + (status || '') + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>'; }
  function badge(st) { return '<span class="v4-badge ' + st + '">' + E(STATUS_FA[st] || st) + '</span>'; }
  function actionBtn(label, js, cls) { return '<button type="button" class="v4-btn ' + (cls || '') + '" onclick="event.stopPropagation();' + js + '">' + label + '</button>'; }
  function flash(msg) {
    var n = document.createElement('div'); n.className = 'v4-flash'; n.textContent = msg; document.body.appendChild(n);
    setTimeout(function () { n.classList.add('out'); }, 1800); setTimeout(function () { n.remove(); }, 2300);
  }
  UI.flash = flash;
  function log(a, d, k) { try { if (root.logEvent) root.logEvent(a, d, k || 'info'); } catch (e) { /* ignore */ } }

  /* ---------- رویدادهای تقویم (از همه‌ی بخش‌ها) ---------- */
  V.collectEvents = function (d) {
    d = d || D(); var ev = [], today = ymd(new Date().toISOString());
    (d.checks || []).forEach(function (c) {
      if (!c.date) return;
      var day = ymd(c.date), st = c.settled ? 'settled' : (day < today ? 'overdue' : 'pending');
      ev.push({ day: day, title: (c.type === 'receive' ? 'چک دریافتی ' : 'چک پرداختی ') + (c.name || ''), kind: c.type === 'receive' ? 'check-in' : 'check-out', sourceType: 'check', sourceId: c.id, at: c.date, amount: Number(c.amount) || 0, status: st, icon: '🧾', person: c.name || '', account: c.accountID || '' });
    });
    (d.reminders || []).forEach(function (r) {
      if (!r.date) return;
      var linkedType = r.sourcePersonId ? 'person' : (r.sourceNoteId ? 'note' : 'reminder');
      ev.push({ day: ymd(r.date), title: r.title || 'یادآوری', kind: 'reminder', sourceType: linkedType, sourceId: r.sourcePersonId || r.sourceNoteId || r.id, reminderId: r.id, at: r.date, sourcePersonId: r.sourcePersonId || '', sourceInstallmentId: r.sourceInstallmentId || '', sourceNoteId: r.sourceNoteId || '', amount: Number(r.amount) || 0, status: r.done ? 'settled' : (ymd(r.date) < today ? 'overdue' : 'pending'), icon: '🔔', person: '', account: '' });
    });
    V.list('goals').forEach(function (g) { if (g.deadline) { var gi = V.goalInfo(g); ev.push({ day: ymd(g.deadline), title: 'مهلت هدف: ' + g.name, kind: 'goal', sourceType: 'goal', sourceId: g.id, at: g.deadline, amount: gi.remaining, status: gi.status === 'done' ? 'settled' : (ymd(g.deadline) < today ? 'overdue' : 'pending'), icon: '🎯', person: '', account: '' }); } });
    V.list('budgets').forEach(function (b) {
      var mk = b.monthKey, y = Math.floor(mk / 100), m = mk % 100; if (!mk || !root.jalaliMonthLength) return;
      var last = root.jalaliToGregorian(y, m, root.jalaliMonthLength(y, m)), day = last[0] + '-' + String(last[1]).padStart(2, '0') + '-' + String(last[2]).padStart(2, '0');
      var bi = V.budgetInfo(b, d); ev.push({ day: day, title: 'پایان بودجه: ' + b.name, kind: 'budget', sourceType: 'budget', sourceId: b.id, at: day, amount: bi.remaining, status: bi.status === 'over' ? 'overdue' : (day < today ? 'settled' : 'pending'), icon: '💰', person: '', account: b.accountID || '' });
    });
    V.list('shared').forEach(function (x) { var si = V.sharedInfo(x); ev.push({ day: ymd(x.date), title: 'هم‌خرج: ' + x.title, kind: 'shared', sourceType: 'shared', sourceId: x.id, at: x.date, amount: si.owedTotal, status: si.status === 'settled' ? 'settled' : 'pending', icon: '🤝', person: (x.participants || []).map(function (p) { return p.name; }).join('، '), account: '' }); });
    V.list('events').forEach(function (e) { ev.push({ day: ymd(e.date), title: e.title, kind: 'custom-' + (e.kind || 'note'), sourceType: 'event', sourceId: e.id, at: e.date, amount: Number(e.amount) || 0, status: e.done ? 'settled' : (ymd(e.date) < today ? 'overdue' : 'pending'), icon: e.kind === 'income' ? '⬇️' : e.kind === 'expense' ? '⬆️' : '📌', person: '', account: '', id: e.id }); });
    return ev.filter(function (e) { return e.day; });
  };

  /* ---------- پیکربندی بخش‌ها ---------- */
  var C = {};

  C.budgets = {
    title: 'بودجه', icon: '💰', addLabel: '＋ بودجه جدید',
    filters: ['status', 'account', 'date', 'amount'], statuses: ['ok', 'warn', 'over'],
    text: function (r) { return r.name + ' ' + (r.category || '') + ' ' + (r.note || ''); },
    date: function (r) { return r.startDate || r.createdAt || ''; }, amount: function (r) { return Number(r.limit) || 0; },
    status: function (r) { return V.budgetInfo(r).status; }, account: function (r) { return r.accountID || ''; },
    summary: function (rows) { var t = rows.reduce(function (s, r) { var i = V.budgetInfo(r); s.l += i.limit; s.s += i.spent; return s; }, { l: 0, s: 0 }); return [['سقف کل', M(t.l)], ['هزینه‌شده', M(t.s)], ['باقی‌مانده', M(t.l - t.s)]]; },
    row: function (r) {
      var i = V.budgetInfo(r), y = Math.floor(r.monthKey / 100), m = r.monthKey % 100;
      return '<div class="v4-card ' + i.status + '"><div class="v4-head"><b>' + E(r.name) + '</b>' + badge(i.status) + '</div><div class="v4-meta">' + (r.category ? 'دسته: ' + E(r.category) : 'همه‌ی هزینه‌ها') + ' • ' + E(V.months()[m - 1] || '') + ' ' + FA(y) + (r.accountID ? ' • ' + E(accName(r.accountID)) : '') + '</div>' + bar(i.pct, i.status) +
        '<div class="v4-nums"><span>هزینه‌شده: <b>' + M(i.spent) + '</b></span><span>سقف: <b>' + M(i.limit) + '</b></span><span>' + (i.remaining >= 0 ? 'باقی‌مانده' : 'مازاد') + ': <b class="' + (i.remaining >= 0 ? 'pos' : 'neg') + '">' + M(Math.abs(i.remaining)) + '</b></span></div>';
    },
    actions: function (r) { return [['➕ ثبت هزینه', "V4UI.modal('budgets','spend','" + r.id + "')"]]; },
    form: function (r) {
      var cats = (D().expenseCats || []).map(function (c) { return '<option value="' + E(c.name) + '"' + (r && r.category === c.name ? ' selected' : '') + '>' + E(c.name) + '</option>'; }).join('');
      return field('نام بودجه', '<input id="v4-name" maxlength="80" value="' + E(r ? r.name : '') + '" placeholder="مثلاً خوراک و مواد غذایی">') +
        field('دسته‌ی هزینه', '<select id="v4-cat"><option value="">همه‌ی هزینه‌ها</option>' + cats + '</select>') +
        field('سقف بودجه (تومان)', '<input id="v4-limit" class="amt-input" inputmode="numeric" value="' + (r ? r.limit : '') + '">') +
        field('ماه بودجه (یک روز از آن ماه)', dateField('v4-date', r ? r.startDate : new Date().toISOString())) +
        field('فقط حساب (اختیاری)', '<select id="v4-acc">' + accOpts(r && r.accountID, true, 'همه‌ی حساب‌ها') + '</select>');
    },
    collect: function (old) {
      var iso = readDate('v4-date', 'ماه بودجه'), mk = V.monthKeyOf(iso);
      return { name: V.cleanText($('v4-name').value, 'نام بودجه', 80, true), category: $('v4-cat').value, limit: V.amount($('v4-limit').value, 'سقف بودجه'), startDate: iso, monthKey: mk, accountID: $('v4-acc').value || '' };
    },
    detail: function (rows) { return null; },
    exportHeaders: ['نام بودجه', 'دسته', 'ماه', 'سقف بودجه', 'هزینه‌شده', 'باقی‌مانده', 'درصد مصرف', 'وضعیت', 'حساب'],
    exportRow: function (r) { var i = V.budgetInfo(r), m = r.monthKey % 100; return [r.name, r.category || 'همه', V.months()[m - 1] + ' ' + FA(Math.floor(r.monthKey / 100)), i.limit, i.spent, i.remaining, FA(i.pct) + '٪', STATUS_FA[i.status], accName(r.accountID)]; }
  };

  C.goals = {
    title: 'اهداف مالی', icon: '🎯', addLabel: '＋ هدف جدید',
    filters: ['status', 'date', 'amount'], statuses: ['active', 'done', 'late'],
    text: function (r) { return r.name + ' ' + (r.note || ''); }, date: function (r) { return r.deadline || r.createdAt || ''; },
    amount: function (r) { return Number(r.target) || 0; }, status: function (r) { return V.goalInfo(r).status; },
    summary: function (rows) { var t = rows.reduce(function (s, r) { var i = V.goalInfo(r); s.t += i.target; s.s += i.saved; return s; }, { t: 0, s: 0 }); return [['مجموع اهداف', M(t.t)], ['پس‌انداز شده', M(t.s)], ['باقی‌مانده', M(Math.max(0, t.t - t.s))]]; },
    row: function (r) {
      var i = V.goalInfo(r), dep = (r.deposits || []).slice().reverse().slice(0, 4).map(function (x) { return '<li>' + jl(x.date) + ' — ' + M(x.amount) + (x.note ? ' • ' + E(x.note) : '') + '</li>'; }).join('');
      return '<div class="v4-card ' + i.status + '"><div class="v4-head"><b>' + E(r.name) + '</b>' + badge(i.status) + '</div><div class="v4-meta">هدف: ' + M(i.target) + (r.deadline ? ' • مهلت: ' + jl(r.deadline) : '') + '</div>' + bar(i.pct, i.status === 'late' ? 'warn' : 'ok') +
        '<div class="v4-nums"><span>پس‌انداز: <b>' + M(i.saved) + '</b></span><span>' + FA(i.pct) + '٪</span><span>مانده: <b>' + M(i.remaining) + '</b></span></div>' + (dep ? '<details class="v4-more"><summary>آخرین واریزها (' + FA((r.deposits || []).length) + ')</summary><ul>' + dep + '</ul></details>' : '');
    },
    actions: function (r) { return [['➕ واریز به هدف', "V4UI.modal('goals','deposit','" + r.id + "')"]]; },
    form: function (r) {
      return field('نام هدف', '<input id="v4-name" maxlength="80" value="' + E(r ? r.name : '') + '" placeholder="مثلاً خرید خودرو">') +
        field('مبلغ هدف (تومان)', '<input id="v4-target" class="amt-input" inputmode="numeric" value="' + (r ? r.target : '') + '">') +
        field('مهلت رسیدن (اختیاری)', dateField('v4-date', r && r.deadline)) + field('توضیح', '<input id="v4-note" maxlength="200" value="' + E(r ? r.note || '' : '') + '">');
    },
    collect: function () { return { name: V.cleanText($('v4-name').value, 'نام هدف', 80, true), target: V.amount($('v4-target').value, 'مبلغ هدف'), deadline: readDate('v4-date', 'مهلت', true), note: V.cleanText($('v4-note').value, 'توضیح', 200) }; },
    detail: function (rows) { var out = []; rows.forEach(function (r) { (r.deposits || []).forEach(function (x) { out.push([r.name, jl(x.date), x.amount, x.note || '']); }); }); return { name: 'واریزها', headers: ['هدف', 'تاریخ', 'مبلغ', 'توضیح'], rows: out }; },
    exportHeaders: ['نام هدف', 'مبلغ هدف', 'پس‌انداز شده', 'باقی‌مانده', 'درصد پیشرفت', 'مهلت', 'وضعیت', 'تعداد واریز'],
    exportRow: function (r) { var i = V.goalInfo(r); return [r.name, i.target, i.saved, i.remaining, FA(i.pct) + '٪', r.deadline ? jl(r.deadline) : '', STATUS_FA[i.status], (r.deposits || []).length]; }
  };

  C.savings = {
    title: 'صندوق پس‌انداز', icon: '🐷', addLabel: '＋ صندوق جدید',
    filters: ['status', 'date', 'amount'], statuses: ['has', 'empty'],
    text: function (r) { return r.name + ' ' + (r.note || ''); }, date: function (r) { return r.createdAt || ''; },
    amount: function (r) { return V.savingBalance(r); }, status: function (r) { return V.savingBalance(r) > 0 ? 'has' : 'empty'; },
    summary: function (rows) { var t = rows.reduce(function (s, r) { return s + V.savingBalance(r); }, 0); return [['مجموع پس‌انداز', M(t)], ['تعداد صندوق', FA(rows.length)]]; },
    row: function (r) {
      var b = V.savingBalance(r), mv = (r.movements || []).slice().reverse().slice(0, 5).map(function (x) { return '<li>' + jl(x.date) + ' — ' + (x.type === 'deposit' ? '⬇️ واریز ' : '⬆️ برداشت ') + M(x.amount) + (x.note ? ' • ' + E(x.note) : '') + '</li>'; }).join('');
      return '<div class="v4-card"><div class="v4-head"><b>' + E(r.name) + '</b><strong class="pos">' + M(b) + '</strong></div>' + (r.note ? '<div class="v4-meta">' + E(r.note) + '</div>' : '') + (mv ? '<details class="v4-more"><summary>گردش صندوق (' + FA((r.movements || []).length) + ')</summary><ul>' + mv + '</ul></details>' : '');
    },
    actions: function (r) { return [['⬇️ واریز', "V4UI.modal('savings','deposit','" + r.id + "')"], ['⬆️ برداشت', "V4UI.modal('savings','withdraw','" + r.id + "')"]]; },
    form: function (r) { return field('نام صندوق', '<input id="v4-name" maxlength="80" value="' + E(r ? r.name : '') + '" placeholder="مثلاً صندوق اضطراری">') + field('توضیح', '<input id="v4-note" maxlength="200" value="' + E(r ? r.note || '' : '') + '">'); },
    collect: function () { return { name: V.cleanText($('v4-name').value, 'نام صندوق', 80, true), note: V.cleanText($('v4-note').value, 'توضیح', 200) }; },
    detail: function (rows) { var out = []; rows.forEach(function (r) { (r.movements || []).forEach(function (x) { out.push([r.name, jl(x.date), x.type === 'deposit' ? 'واریز' : 'برداشت', x.amount, x.note || '']); }); }); return { name: 'گردش', headers: ['صندوق', 'تاریخ', 'نوع', 'مبلغ', 'توضیح'], rows: out }; },
    exportHeaders: ['نام صندوق', 'موجودی', 'مجموع واریز', 'مجموع برداشت', 'توضیح'],
    exportRow: function (r) { var dep = V.sumMoves(r.movements, 'deposit', null), wd = -V.sumMoves(r.movements, null, 'withdraw'); return [r.name, V.savingBalance(r), dep, wd, r.note || '']; }
  };

  C.assets = {
    title: 'دارایی‌ها', icon: '🏦', addLabel: '＋ دارایی جدید',
    filters: ['status', 'type', 'date', 'amount'], statuses: ['profit', 'loss', 'flat'],
    text: function (r) { return r.name + ' ' + (r.kind || '') + ' ' + (r.note || ''); }, date: function (r) { return r.buyDate || r.createdAt || ''; },
    amount: function (r) { return Number(r.value) || 0; }, type: function (r) { return r.kind || ''; },
    status: function (r) { var d = V.assetInfo(r).diff; return d > 0 ? 'profit' : d < 0 ? 'loss' : 'flat'; },
    typeOptions: KINDS,
    summary: function (rows) { var t = rows.reduce(function (s, r) { var i = V.assetInfo(r); s.v += i.value; s.c += i.cost; return s; }, { v: 0, c: 0 }); return [['ارزش کل', M(t.v)], ['بهای خرید', M(t.c)], ['سود/زیان', M(t.v - t.c)]]; },
    row: function (r) {
      var i = V.assetInfo(r), h = (r.history || []).slice().reverse().slice(0, 5).map(function (x) { return '<li>' + jl(x.date) + ' — ' + M(x.value) + (x.note ? ' • ' + E(x.note) : '') + '</li>'; }).join('');
      return '<div class="v4-card"><div class="v4-head"><b>' + E(r.name) + '</b><span class="v4-tag">' + E(r.kind || 'سایر') + '</span></div><div class="v4-meta">خرید: ' + M(i.cost) + (r.buyDate ? ' • ' + jl(r.buyDate) : '') + '</div><div class="v4-nums"><span>ارزش فعلی: <b>' + M(i.value) + '</b></span><span class="' + (i.diff >= 0 ? 'pos' : 'neg') + '">' + (i.diff >= 0 ? '▲ ' : '▼ ') + M(Math.abs(i.diff)) + ' (' + FA(Math.abs(i.pct)) + '٪)</span></div>' + (h ? '<details class="v4-more"><summary>تاریخچه‌ی ارزش (' + FA((r.history || []).length) + ')</summary><ul>' + h + '</ul></details>' : '');
    },
    actions: function (r) { return [['📈 ثبت تغییر ارزش', "V4UI.modal('assets','revalue','" + r.id + "')"]]; },
    form: function (r) {
      return field('نام دارایی', '<input id="v4-name" maxlength="80" value="' + E(r ? r.name : '') + '" placeholder="مثلاً ۵ سکه تمام">') +
        field('نوع', '<select id="v4-kind">' + KINDS.map(function (k) { return '<option' + (r && r.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>') +
        field('بهای خرید (تومان)', '<input id="v4-cost" class="amt-input" inputmode="numeric" value="' + (r ? r.buyPrice : '') + '">') +
        field('ارزش فعلی (تومان)', '<input id="v4-value" class="amt-input" inputmode="numeric" value="' + (r ? r.value : '') + '">') +
        field('تاریخ خرید', dateField('v4-date', r ? r.buyDate : new Date().toISOString())) + field('توضیح', '<input id="v4-note" maxlength="200" value="' + E(r ? r.note || '' : '') + '">');
    },
    collect: function (old) {
      var cost = V.amount($('v4-cost').value, 'بهای خرید', { allowZero: true }), val = V.amount($('v4-value').value, 'ارزش فعلی', { allowZero: true });
      var p = { name: V.cleanText($('v4-name').value, 'نام دارایی', 80, true), kind: $('v4-kind').value, buyPrice: cost, value: val, buyDate: readDate('v4-date', 'تاریخ خرید'), note: V.cleanText($('v4-note').value, 'توضیح', 200) };
      p.history = old ? (old.history || []).slice() : [{ id: V.uid(), date: p.buyDate, value: val, note: 'ثبت اولیه' }];
      return p;
    },
    detail: function (rows) { var out = []; rows.forEach(function (r) { (r.history || []).forEach(function (x) { out.push([r.name, jl(x.date), x.value, x.note || '']); }); }); return { name: 'تاریخچه ارزش', headers: ['دارایی', 'تاریخ', 'ارزش', 'توضیح'], rows: out }; },
    exportHeaders: ['نام دارایی', 'نوع', 'تاریخ خرید', 'بهای خرید', 'ارزش فعلی', 'سود/زیان', 'درصد', 'توضیح'],
    exportRow: function (r) { var i = V.assetInfo(r); return [r.name, r.kind || '', r.buyDate ? jl(r.buyDate) : '', i.cost, i.value, i.diff, FA(i.pct) + '٪', r.note || '']; }
  };

  C.shared = {
    title: 'هزینه‌ی هم‌خرج', icon: '🤝', addLabel: '＋ هزینه‌ی مشترک',
    filters: ['status', 'person', 'date', 'amount'], statuses: ['open', 'settled'],
    text: function (r) { return r.title + ' ' + r.payer + ' ' + (r.participants || []).map(function (p) { return p.name; }).join(' ') + ' ' + (r.note || ''); },
    date: function (r) { return r.date || ''; }, amount: function (r) { return Number(r.total) || 0; },
    status: function (r) { return V.sharedInfo(r).status; },
    person: function (r) { return r.payer + ' ' + (r.participants || []).map(function (p) { return p.name; }).join(' '); },
    summary: function (rows) { var t = rows.reduce(function (s, r) { s.t += Number(r.total) || 0; s.o += V.sharedInfo(r).owedTotal; return s; }, { t: 0, o: 0 }); return [['مجموع هزینه‌ها', M(t.t)], ['مانده‌ی تسویه‌نشده', M(t.o)]]; },
    row: function (r) {
      var i = V.sharedInfo(r);
      var lines = i.rows.map(function (x) { return '<li>' + E(x.name) + (x.isPayer ? ' <small>(پرداخت‌کننده)</small>' : '') + ' — سهم ' + M(x.share) + (x.isPayer ? '' : ' • پرداخت ' + M(x.paid) + ' • <b class="' + (x.owed ? 'neg' : 'pos') + '">' + (x.owed ? 'بدهکار ' + M(x.owed) : 'تسویه') + '</b>') + '</li>'; }).join('');
      return '<div class="v4-card ' + (i.status === 'settled' ? 'done' : '') + '"><div class="v4-head"><b>' + E(r.title) + '</b>' + badge(i.status) + '</div><div class="v4-meta">' + jl(r.date) + ' • پرداخت‌کننده: ' + E(r.payer) + ' • جمع: ' + M(r.total) + '</div><ul class="v4-list">' + lines + '</ul>';
    },
    actions: function (r) { return V.sharedInfo(r).status === 'open' ? [['💳 ثبت تسویه', "V4UI.modal('shared','settle','" + r.id + "')"]] : []; },
    form: function (r) {
      var txt = r ? (r.participants || []).map(function (p) { return p.name + (p.custom ? ': ' + p.share : ''); }).join('\n') : '';
      return field('عنوان هزینه', '<input id="v4-name" maxlength="80" value="' + E(r ? r.title : '') + '" placeholder="مثلاً شام دوستانه">') +
        field('مبلغ کل (تومان)', '<input id="v4-total" class="amt-input" inputmode="numeric" value="' + (r ? r.total : '') + '">') +
        field('پرداخت‌کننده', '<input id="v4-payer" maxlength="60" value="' + E(r ? r.payer : 'من') + '">') +
        field('شرکت‌کننده‌ها (هر نفر یک خط؛ برای سهم دلخواه «نام: مبلغ»)', '<textarea id="v4-parts" rows="4" placeholder="علی\nمریم: 200000">' + E(txt) + '</textarea>') +
        field('تاریخ', dateField('v4-date', r ? r.date : new Date().toISOString())) + field('توضیح', '<input id="v4-note" maxlength="200" value="' + E(r ? r.note || '' : '') + '">');
    },
    collect: function (old) {
      var total = V.amount($('v4-total').value, 'مبلغ کل'), payer = V.cleanText($('v4-payer').value, 'پرداخت‌کننده', 60, true), parts = [], seen = {};
      String($('v4-parts').value || '').split(/\n+/).forEach(function (line) {
        var m = line.split(/[:：]/), name = V.cleanText(m[0], 'نام شرکت‌کننده', 60); if (!name) return;
        if (seen[name]) throw new Error('نام «' + name + '» تکراری است'); seen[name] = 1;
        var custom = m.length > 1 && String(m[1]).trim() !== ''; parts.push({ name: name, custom: custom, share: custom ? V.amount(m[1], 'سهم ' + name, { allowZero: true }) : 0 });
      });
      if (!seen[payer]) parts.unshift({ name: payer, custom: false, share: 0 });
      if (parts.length < 2) throw new Error('حداقل یک شرکت‌کننده‌ی دیگر لازم است');
      var cs = parts.filter(function (p) { return p.custom; });
      if (cs.length) { if (cs.length !== parts.length) throw new Error('یا برای همه سهم دلخواه بنویس، یا برای هیچ‌کس'); var sum = cs.reduce(function (s, p) { return s + p.share; }, 0); if (sum !== total) throw new Error('جمع سهم‌ها (' + FA(sum) + ') با مبلغ کل (' + FA(total) + ') برابر نیست'); }
      return { title: V.cleanText($('v4-name').value, 'عنوان', 80, true), total: total, payer: payer, participants: parts, date: readDate('v4-date', 'تاریخ'), note: V.cleanText($('v4-note').value, 'توضیح', 200), settlements: old ? old.settlements || [] : [] };
    },
    detail: function (rows) { var out = []; rows.forEach(function (r) { V.sharedInfo(r).rows.forEach(function (x) { out.push([r.title, x.name, x.share, x.paid, x.owed, x.isPayer ? 'پرداخت‌کننده' : x.owed ? 'بدهکار' : 'تسویه']); }); }); return { name: 'سهم افراد', headers: ['هزینه', 'نام', 'سهم', 'پرداخت‌شده', 'مانده', 'وضعیت'], rows: out }; },
    exportHeaders: ['عنوان', 'تاریخ', 'مبلغ کل', 'پرداخت‌کننده', 'شرکت‌کننده‌ها', 'مانده‌ی تسویه‌نشده', 'وضعیت'],
    exportRow: function (r) { var i = V.sharedInfo(r); return [r.title, jl(r.date), Number(r.total) || 0, r.payer, (r.participants || []).map(function (p) { return p.name; }).join('، '), i.owedTotal, STATUS_FA[i.status]]; }
  };

  /* تقویم: رکوردهای «رویداد دلخواه» (events) + نمای ماهانه */
  C.events = {
    title: 'رویداد دلخواه', icon: '📌', addLabel: '＋ رویداد',
    text: function (r) { return r.title; }, date: function (r) { return r.date; }, amount: function (r) { return Number(r.amount) || 0; },
    form: function (r) {
      return field('عنوان', '<input id="v4-name" maxlength="80" value="' + E(r ? r.title : '') + '">') + field('نوع', '<select id="v4-kind"><option value="note"' + (r && r.kind === 'note' ? ' selected' : '') + '>یادآوری</option><option value="income"' + (r && r.kind === 'income' ? ' selected' : '') + '>دریافت مورد انتظار</option><option value="expense"' + (r && r.kind === 'expense' ? ' selected' : '') + '>پرداخت برنامه‌ریزی‌شده</option></select>') +
        field('مبلغ (اختیاری)', '<input id="v4-amount" class="amt-input" inputmode="numeric" value="' + (r && r.amount ? r.amount : '') + '">') + field('تاریخ', dateField('v4-date', r ? r.date : new Date().toISOString()));
    },
    collect: function (old) { return { title: V.cleanText($('v4-name').value, 'عنوان', 80, true), kind: $('v4-kind').value, amount: V.amount($('v4-amount').value, 'مبلغ', { optional: true }), date: readDate('v4-date', 'تاریخ'), done: old ? !!old.done : false }; }
  };

  /* ---------- چک‌ها (بخش قدیمی): فیلتر و Excel ---------- */
  var checkCfg = {
    text: function (c) { return [c.name, c.number, c.bank, c.note, c.nationalCode].join(' '); },
    date: function (c) { return c.date; }, amount: function (c) { return Number(c.amount) || 0; },
    status: function (c) { return c.settled ? 'settled' : (ymd(c.date) < ymd(new Date().toISOString()) ? 'overdue' : 'pending'); },
    account: function (c) { return c.accountID || ''; }, person: function (c) { return c.name || ''; }, type: function (c) { return c.type; }
  };
  UI.checks = function (list, origCmp) {
    var f = state.checks; if (!f || !Object.keys(f).some(function (k) { return f[k] !== '' && f[k] != null && k !== 'sort'; })) { return f && f.sort ? V.applyFilters(list, { sort: f.sort }, checkCfg) : list.sort(origCmp); }
    return V.applyFilters(list, f, checkCfg);
  };
  function checksExport(rows) {
    return [{ name: 'چک‌ها', headers: ['نوع', 'نام شخص', 'کد ملی', 'شماره چک', 'بانک', 'مبلغ', 'سررسید', 'حساب', 'وضعیت', 'توضیحات'], rows: rows.map(function (c) { return [c.type === 'receive' ? 'دریافتی' : 'پرداختی', c.name || '', c.nationalCode || '', c.number || '', c.bank || '', Number(c.amount) || 0, jl(c.date), accName(c.accountID), STATUS_FA[checkCfg.status(c)], c.note || '']; }) }];
  }

  /* ---------- موتور مشترک UI ---------- */
  var PAGE_KEYS = ['budgets', 'goals', 'savings', 'assets', 'shared', 'calendar'];
  UI.PAGE_KEYS = PAGE_KEYS;
  function sel(id, options, cur, allLabel) { return '<select id="' + id + '"><option value="">' + allLabel + '</option>' + options.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + E(v) + '"' + (v === cur ? ' selected' : '') + '>' + E(l) + '</option>'; }).join('') + '</select>'; }
  function filterPanel(key, cfg) {
    var f = state[key] || {}, p = 'v4f-' + key + '-', fl = cfg.filters || [], h = '';
    h += '<div class="v4-search"><input id="' + p + 'q" type="search" placeholder="🔎 جستجوی سریع..." value="' + E(f.q || '') + '" oninput="V4UI.applyFilter(\'' + key + '\')"></div>';
    h += '<details class="v4-filter"><summary>فیلتر و مرتب‌سازی</summary><div class="v4-grid2">';
    if (fl.indexOf('date') >= 0) h += field('از تاریخ', root.simpleDateField(p + 'from', f.fromText || '')) + field('تا تاریخ', root.simpleDateField(p + 'to', f.toText || ''));
    if (fl.indexOf('amount') >= 0) h += field('حداقل مبلغ', '<input id="' + p + 'min" class="amt-input" inputmode="numeric" value="' + E(f.min || '') + '">') + field('حداکثر مبلغ', '<input id="' + p + 'max" class="amt-input" inputmode="numeric" value="' + E(f.max || '') + '">');
    if (fl.indexOf('status') >= 0) h += field('وضعیت', sel(p + 'status', (cfg.statuses || []).map(function (s) { return [s, STATUS_FA[s]]; }), f.status, 'همه'));
    if (fl.indexOf('account') >= 0) h += field('حساب', '<select id="' + p + 'account">' + accOpts(f.account, true) + '</select>');
    if (fl.indexOf('person') >= 0) h += field('شخص', '<input id="' + p + 'person" maxlength="60" value="' + E(f.person || '') + '" placeholder="نام شخص">');
    if (fl.indexOf('type') >= 0) h += field('نوع', sel(p + 'type', cfg.typeOptions || [], f.type, 'همه'));
    h += field('مرتب‌سازی', '<select id="' + p + 'sort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + ((f.sort || 'date-desc') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>');
    h += '</div><div class="v4-row"><button class="v4-btn primary" type="button" onclick="V4UI.applyFilter(\'' + key + '\')">اعمال</button><button class="v4-btn" type="button" onclick="V4UI.clearFilter(\'' + key + '\')">پاک‌کردن فیلترها</button></div><div id="' + p + 'msg" class="v4-err"></div></details>';
    return h;
  }
  function checksPanel() {
    var cfg = { filters: ['date', 'amount', 'status', 'account', 'person', 'type'], statuses: ['pending', 'overdue', 'settled'], typeOptions: [['receive', 'دریافتی'], ['pay', 'پرداختی']] };
    return filterPanel('checks', cfg).replace('class="v4-filter"', 'class="v4-filter" id="v4-checks-details"');
  }
  function readFilter(key) {
    var p = 'v4f-' + key + '-', g = function (n) { var e = $(p + n); return e ? e.value : ''; }, f = { q: g('q').trim(), min: g('min'), max: g('max'), status: g('status'), account: g('account'), person: g('person').trim(), type: g('type'), sort: g('sort') || 'date-desc', fromText: g('from'), toText: g('to') }, msg = '';
    if (f.fromText) { f.from = root.jalaliToISO(f.fromText); if (!f.from) msg = 'تاریخ «از» نامعتبر است'; }
    if (f.toText) { f.to = root.jalaliToISO(f.toText); if (!f.to) msg = 'تاریخ «تا» نامعتبر است'; }
    if (f.from && f.to && f.from > f.to) msg = 'تاریخ شروع بعد از تاریخ پایان است';
    if (f.min && f.max && V.num(f.min) > V.num(f.max)) msg = 'حداقل مبلغ از حداکثر بیشتر است';
    var m = $(p + 'msg'); if (m) m.textContent = msg;
    return msg ? null : f;
  }
  UI.applyFilter = function (key) { var f = readFilter(key); if (!f) return; state[key] = f; if (key === 'checks') { if (root.render) root.render(); } else UI.renderPage(key); };
  UI.clearFilter = function (key) { state[key] = {}; if (key === 'checks') { UI.mountChecks(true); if (root.render) root.render(); } else UI.renderPage(key, true); };

  function filteredRows(key) { var cfg = C[key]; return V.applyFilters(V.list(key).slice(), state[key] || {}, cfg); }

  UI.renderPage = function (key, rebuild) {
    if (key === 'calendar') return renderCalendar(rebuild);
    var page = $('v4-' + key); if (!page) return; var cfg = C[key];
    if (!page.dataset.built || rebuild) {
      page.innerHTML = '<div class="section-head"><h2>' + cfg.icon + ' ' + cfg.title + '</h2><div class="v4-head-btns"><button class="v4-btn v4-icon-action" type="button" onclick="V4UI.exportSection(\'' + key + '\')" title="خروجی Excel" aria-label="خروجی Excel">📊</button><button class="v4-btn v4-icon-action v4-add-action" type="button" onclick="V4UI.modal(\'' + key + '\',\'edit\')" title="' + cfg.addLabel.replace('＋ ','') + '" aria-label="' + cfg.addLabel.replace('＋ ','') + '">＋</button></div></div><div class="v4-panel" data-built="1">' + filterPanel(key, cfg) + '</div><div id="v4-sum-' + key + '" class="v4-sum"></div><div id="v4-list-' + key + '"></div>';
      page.dataset.built = '1';
    }
    var rows = filteredRows(key), total = V.list(key).length, sm = cfg.summary ? cfg.summary(rows) : [];
    $('v4-sum-' + key).innerHTML = sm.map(function (s) { return '<div class="v4-sumcard"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>'; }).join('');
    $('v4-list-' + key).innerHTML = rows.length ? rows.map(function (r) {
      var acts = (cfg.actions ? cfg.actions(r) : []).map(function (a) { return actionBtn(a[0], a[1], 'accent'); }).join('');
      return '<div class="v4-wrap">' + cfg.row(r) + '<div class="v4-actions">' + acts + actionBtn('✏️ ویرایش', "V4UI.modal('" + key + "','edit','" + r.id + "')") + actionBtn('🗑 حذف', "V4UI.del('" + key + "','" + r.id + "')", 'danger') + '</div></div></div>';
    }).join('') : '<div class="v4-empty">' + (total ? 'نتیجه‌ای با این فیلترها پیدا نشد.' : 'هنوز چیزی ثبت نشده. با دکمه‌ی بالا شروع کن.') + '</div>';
  };

  /* ---------- مدال‌ها ---------- */
  var subForms = {
    'budgets.spend': function (r) {
      var cats = (D().expenseCats || []).map(function (c) { return '<option value="' + E(c.name) + '"' + (r.category === c.name ? ' selected' : '') + '>' + E(c.name) + '</option>'; }).join('');
      return '<h2>➕ ثبت هزینه برای «' + E(r.name) + '»</h2><div class="form">' + field('شرح', '<input id="v4-s-title" maxlength="80" value="' + E(r.name) + '">') + field('مبلغ (تومان)', '<input id="v4-s-amount" class="amt-input" inputmode="numeric">') + field('دسته', r.category ? '<input id="v4-s-cat" value="' + E(r.category) + '" readonly>' : '<select id="v4-s-cat">' + cats + '</select>') + field('از حساب', '<select id="v4-s-acc">' + accOpts(r.accountID) + '</select>') + '<p class="hint">این هزینه به‌صورت یک تراکنش واقعی ثبت می‌شود و از موجودی حساب و باقی‌مانده‌ی بودجه کم می‌شود.</p><button class="primary" type="button" onclick="V4UI.submit(\'budgets\',\'spend\',\'' + r.id + '\')">ثبت هزینه</button></div>';
    },
    'goals.deposit': function (r) { return '<h2>➕ واریز به «' + E(r.name) + '»</h2><div class="form">' + field('مبلغ (تومان)', '<input id="v4-s-amount" class="amt-input" inputmode="numeric">') + field('تاریخ', dateField('v4-s-date', new Date().toISOString())) + field('توضیح', '<input id="v4-s-note" maxlength="120">') + '<button class="primary" type="button" onclick="V4UI.submit(\'goals\',\'deposit\',\'' + r.id + '\')">ثبت واریز</button></div>'; },
    'savings.deposit': function (r) { return moneyForm(r, 'deposit', '⬇️ واریز به'); },
    'savings.withdraw': function (r) { return moneyForm(r, 'withdraw', '⬆️ برداشت از') + ''; },
    'assets.revalue': function (r) { return '<h2>📈 تغییر ارزش «' + E(r.name) + '»</h2><div class="form"><p class="hint">ارزش فعلی: ' + M(r.value) + '</p>' + field('ارزش جدید (تومان)', '<input id="v4-s-amount" class="amt-input" inputmode="numeric">') + field('تاریخ', dateField('v4-s-date', new Date().toISOString())) + field('توضیح', '<input id="v4-s-note" maxlength="120">') + '<button class="primary" type="button" onclick="V4UI.submit(\'assets\',\'revalue\',\'' + r.id + '\')">ثبت ارزش جدید</button></div>'; },
    'shared.settle': function (r) {
      var owers = V.sharedInfo(r).rows.filter(function (x) { return x.owed > 0; });
      return '<h2>💳 تسویه‌ی «' + E(r.title) + '»</h2><div class="form">' + field('چه کسی پرداخت کرد؟', '<select id="v4-s-who">' + owers.map(function (x) { return '<option value="' + E(x.name) + '">' + E(x.name) + ' — مانده ' + M(x.owed) + '</option>'; }).join('') + '</select>') + field('مبلغ (تومان)', '<input id="v4-s-amount" class="amt-input" inputmode="numeric" value="' + (owers[0] ? owers[0].owed : '') + '">') + field('تاریخ', dateField('v4-s-date', new Date().toISOString())) + '<button class="primary" type="button" onclick="V4UI.submit(\'shared\',\'settle\',\'' + r.id + '\')">ثبت تسویه</button></div>';
    }
  };
  function moneyForm(r, kind, title) {
    return '<h2>' + title + ' «' + E(r.name) + '»</h2><div class="form"><p class="hint">موجودی فعلی: ' + M(V.savingBalance(r)) + '</p>' + field('مبلغ (تومان)', '<input id="v4-s-amount" class="amt-input" inputmode="numeric">') + field('تاریخ', dateField('v4-s-date', new Date().toISOString())) + field('توضیح', '<input id="v4-s-note" maxlength="120">') + '<button class="primary" type="button" onclick="V4UI.submit(\'savings\',\'' + kind + '\',\'' + r.id + '\')">ثبت</button></div>';
  }
  UI.modal = function (key, mode, id) {
    var rec = id ? V.find(key, id) : null;
    if (id && !rec) return alert('این مورد دیگر وجود ندارد');
    if (mode === 'edit') {
      root.openModal('<h2>' + (rec ? 'ویرایش ' : 'افزودن ') + C[key].title + '</h2><div class="form v4-form">' + C[key].form(rec) + '<button class="primary" type="button" onclick="V4UI.save(\'' + key + '\',' + (id ? "'" + id + "'" : 'null') + ')">ذخیره</button></div>');
    } else {
      var f = subForms[key + '.' + mode]; if (!f) return;
      if (key === 'savings' && mode === 'withdraw' && V.savingBalance(rec) <= 0) return alert('موجودی این صندوق صفر است');
      if (key === 'budgets' && mode === 'spend' && !(D().accounts || []).length) return alert('اول از بخش حساب‌ها یک حساب بساز');
      root.openModal(f(rec));
    }
  };
  UI.save = function (key, id) {
    try {
      var old = id ? V.find(key, id) : null, patch = C[key].collect(old), rec = Object.assign({}, old || { id: V.uid(), createdAt: new Date().toISOString() }, patch);
      V.upsert(key, rec); V.commit(); log(id ? 'ویرایش ' + C[key].title : 'ثبت ' + C[key].title, rec.name || rec.title || '', id ? 'edit' : 'create'); root.closeModal(); flash('ذخیره شد ✓');
    } catch (e) { alert(e.message || 'خطا در ذخیره'); }
  };
  UI.del = function (key, id) {
    var r = V.find(key, id); if (!r) return;
    if (!confirm('«' + (r.name || r.title) + '» حذف شود؟ این کار قابل بازگشت نیست (جز با Restore).')) return;
    V.remove(key, id); V.commit(); log('حذف ' + C[key].title, r.name || r.title || '', 'delete'); flash('حذف شد');
  };
  UI.submit = function (key, mode, id) {
    try {
      var r = V.find(key, id); if (!r) throw new Error('مورد پیدا نشد');
      var amt = function (label, opts) { return V.amount($('v4-s-amount').value, label || 'مبلغ', opts); }, note = function () { return $('v4-s-note') ? V.cleanText($('v4-s-note').value, 'توضیح', 120) : ''; };
      if (key === 'budgets' && mode === 'spend') {
        var a = amt(), acc = $('v4-s-acc').value, cat = $('v4-s-cat').value;
        if (!acc) throw new Error('حساب را انتخاب کن'); if (!cat) throw new Error('دسته را انتخاب کن');
        var t = { id: V.uid(), title: V.cleanText($('v4-s-title').value, 'شرح', 80) || cat, amount: a, type: 'expense', category: cat, accountID: acc, date: new Date().toISOString(), source: 'v4-budget' };
        V.touch(t); D().transactions.unshift(t); if (root.markDirty) root.markDirty('transactions', t.id, false, t, t.updatedAt);
        log('ثبت هزینه از بودجه', r.name + ' • ' + M(a), 'create');
      } else if (key === 'goals' && mode === 'deposit') {
        var ga = amt(); r.deposits = r.deposits || []; r.deposits.push({ id: V.uid(), amount: ga, date: readDate('v4-s-date', 'تاریخ'), note: note() }); V.touch(r);
        log('واریز به هدف', r.name + ' • ' + M(ga), 'payment');
      } else if (key === 'savings') {
        var sa = amt(), dt = readDate('v4-s-date', 'تاریخ');
        if (mode === 'withdraw' && sa > V.savingBalance(r)) throw new Error('مبلغ برداشت از موجودی صندوق (' + M(V.savingBalance(r)) + ') بیشتر است');
        r.movements = r.movements || []; r.movements.push({ id: V.uid(), type: mode, amount: sa, date: dt, note: note() }); V.touch(r);
        log(mode === 'deposit' ? 'واریز به صندوق' : 'برداشت از صندوق', r.name + ' • ' + M(sa), 'payment');
      } else if (key === 'assets' && mode === 'revalue') {
        var nv = amt('ارزش جدید', { allowZero: true }); r.history = r.history || []; r.history.push({ id: V.uid(), date: readDate('v4-s-date', 'تاریخ'), value: nv, note: note() }); r.value = nv; V.touch(r);
        log('تغییر ارزش دارایی', r.name + ' • ' + M(nv), 'edit');
      } else if (key === 'shared' && mode === 'settle') {
        var who = $('v4-s-who').value, sa2 = amt(), row = V.sharedInfo(r).rows.find(function (x) { return x.name === who; });
        if (!row) throw new Error('فرد انتخاب‌شده معتبر نیست'); if (sa2 > row.owed) throw new Error('مبلغ از مانده‌ی ' + who + ' (' + M(row.owed) + ') بیشتر است');
        r.settlements = r.settlements || []; r.settlements.push({ id: V.uid(), from: who, amount: sa2, date: readDate('v4-s-date', 'تاریخ') }); V.touch(r);
        log('تسویه‌ی هم‌خرج', r.title + ' • ' + who + ' • ' + M(sa2), 'payment');
      }
      V.commit(); root.closeModal(); flash('ثبت شد ✓');
    } catch (e) { alert(e.message || 'خطا'); }
  };

  /* ---------- Excel ---------- */
  UI.sheetsFor = function (key, rows) {
    if (key === 'checks') return checksExport(rows);
    var cfg = C[key], out = [{ name: cfg.title, headers: cfg.exportHeaders, rows: rows.map(cfg.exportRow) }], d = cfg.detail && cfg.detail(rows);
    if (d && d.rows.length) out.push(d); return out;
  };
  UI.exportSection = function (key) {
    var rows = key === 'checks' ? V.applyFilters((D().checks || []).slice(), state.checks || {}, checkCfg) : filteredRows(key);
    if (!rows.length) return alert('داده‌ای برای خروجی Excel وجود ندارد');
    V.exportXlsx('حساب‌یار-' + (key === 'checks' ? 'چک‌ها' : C[key].title), UI.sheetsFor(key, rows)); log('خروجی Excel', key === 'checks' ? 'چک‌ها' : C[key].title, 'info');
  };
  UI.exportCalendar = function () {
    var rows = calendarRows(); if (!rows.length) return alert('رویدادی برای خروجی وجود ندارد');
    V.exportXlsx('حساب‌یار-تقویم-مالی', [{ name: 'تقویم مالی', headers: ['تاریخ', 'عنوان', 'نوع', 'مبلغ', 'وضعیت'], rows: rows.map(function (e) { return [jl(e.day), e.title, KIND_FA(e.kind), e.amount, STATUS_FA[e.status] || e.status]; }) }]);
  };
  UI.exportAll = function () {
    var sheets = []; ['budgets', 'goals', 'savings', 'assets', 'shared'].forEach(function (k) { var rows = V.list(k); if (rows.length) sheets = sheets.concat(UI.sheetsFor(k, rows)); });
    if ((D().checks || []).length) sheets = sheets.concat(checksExport(D().checks));
    var ev = V.collectEvents(); if (ev.length) sheets.push({ name: 'تقویم مالی', headers: ['تاریخ', 'عنوان', 'نوع', 'مبلغ', 'وضعیت'], rows: ev.sort(function (a, b) { return a.day < b.day ? -1 : 1; }).map(function (e) { return [jl(e.day), e.title, KIND_FA(e.kind), e.amount, STATUS_FA[e.status] || e.status]; }) });
    if (!sheets.length) return alert('هنوز داده‌ای برای خروجی وجود ندارد');
    V.exportXlsx('حساب‌یار-همه-بخش‌ها', sheets);
  };
  function KIND_FA(k) { return ({ 'check-in': 'چک دریافتی', 'check-out': 'چک پرداختی', reminder: 'یادآوری', goal: 'مهلت هدف', budget: 'پایان بودجه', shared: 'هم‌خرج', 'custom-note': 'یادآوری', 'custom-income': 'دریافت', 'custom-expense': 'پرداخت' })[k] || k; }

  /* ---------- تقویم مالی ---------- */
  function eventTimeInfo(e) {
    var raw = String(e && e.at || '');
    /* تاریخ‌های بدون ساعت نباید به‌صورت ۱۲:۰۰ نمایش داده شوند. */
    var hasTime = /(?:T|\s)\d{1,2}:\d{2}/.test(raw);
    if (!hasTime) return { has: false, mins: Infinity, label: '' };
    var d = typeof root.localDateFromInput === 'function' ? root.localDateFromInput(raw) : new Date(raw);
    if (!d || isNaN(d.getTime())) return { has: false, mins: Infinity, label: '' };
    var mins = d.getHours() * 60 + d.getMinutes();
    return { has: true, mins: mins, label: FA0(String(d.getHours()).padStart(2, '0')) + ':' + FA0(String(d.getMinutes()).padStart(2, '0')) };
  }
  function calendarEventSort(a, b) {
    var dayA = String(a.day || ''), dayB = String(b.day || '');
    if (dayA !== dayB) return dayA < dayB ? -1 : 1;
    var ta = eventTimeInfo(a), tb = eventTimeInfo(b);
    if (ta.mins !== tb.mins) return ta.mins - tb.mins;
    return String(a.title || '').localeCompare(String(b.title || ''), 'fa');
  }
  function calendarRows() {
    var f = state.calendar || {}, rows = V.collectEvents(), y = calState.jy, m = calState.jm;
    var cfg = { text: function (e) { return e.title + ' ' + e.person; }, date: function (e) { return e.day; }, amount: function (e) { return e.amount; }, status: function (e) { return e.status; }, account: function (e) { return e.account; }, person: function (e) { return e.person; }, type: function (e) { return e.kind; } };
    var hasRange = f.from || f.to;
    if (!hasRange && !f.q) { var a = root.jalaliToGregorian(y, m, 1), len = root.jalaliMonthLength(y, m), b = root.jalaliToGregorian(y, m, len); f = Object.assign({}, f, { from: a[0] + '-' + String(a[1]).padStart(2, '0') + '-' + String(a[2]).padStart(2, '0'), to: b[0] + '-' + String(b[1]).padStart(2, '0') + '-' + String(b[2]).padStart(2, '0') }); }
    return V.applyFilters(rows, Object.assign({}, f, { sort: f.sort || 'date-asc' }), cfg);
  }
  function renderCalendar(rebuild) {
    var page = $('v4-calendar'); if (!page) return;
    if (!calState.jy) { var t = new Date(), j = root.gregorianToJalali(t.getFullYear(), t.getMonth() + 1, t.getDate()); calState.jy = j[0]; calState.jm = j[1]; calState.sel = ymd(t.toISOString()); }
    var cfg = { filters: ['status', 'person', 'amount', 'date'], statuses: ['pending', 'overdue', 'settled'] };
    if (!page.dataset.built || rebuild) {
      page.innerHTML = '<div class="section-head"><h2>📅 تقویم مالی</h2><div class="v4-head-btns"><button class="v4-btn v4-icon-action" type="button" onclick="V4UI.exportCalendar()" title="خروجی Excel" aria-label="خروجی Excel">📊</button><button class="v4-btn v4-icon-action v4-add-action" type="button" onclick="V4UI.addCalendarItem()" title="افزودن یادداشت یا یادآوری" aria-label="افزودن یادداشت یا یادآوری">＋</button></div></div><div class="v4-panel" data-built="1">' + filterPanel('calendar', cfg) + '</div><div id="v4-cal-body"></div>';
      page.dataset.built = '1';
    }
    var y = calState.jy, m = calState.jm, len = root.jalaliMonthLength(y, m), off = root.jalaliWeekdayIndex(y, m, 1), all = V.collectEvents(), by = {};
    all.forEach(function (e) { (by[e.day] = by[e.day] || []).push(e); });
    var cells = ''; for (var i = 0; i < off; i++) cells += '<i class="v4-cal-empty"></i>';
    var todayK = ymd(new Date().toISOString());
    for (var d = 1; d <= len; d++) {
      var g = root.jalaliToGregorian(y, m, d), k = g[0] + '-' + String(g[1]).padStart(2, '0') + '-' + String(g[2]).padStart(2, '0'), es = by[k] || [], over = es.some(function (e) { return e.status === 'overdue'; });
      cells += '<button type="button" class="v4-day' + (k === todayK ? ' today' : '') + (k === calState.sel ? ' sel' : '') + '" onclick="V4UI.pickDay(\'' + k + '\')">' + FA(d) + (es.length ? '<em class="' + (over ? 'red' : '') + '">' + FA(es.length) + '</em>' : '') + '</button>';
    }
    var selEs = (by[calState.sel] || []).slice().sort(calendarEventSort), rowsF = calendarRows().slice().sort(calendarEventSort);
    var filteredView = !!(state.calendar && (state.calendar.q || state.calendar.from || state.calendar.to || state.calendar.status || state.calendar.person || state.calendar.min || state.calendar.max));
    var listRows = filteredView ? rowsF : selEs;
    var head = filteredView ? 'نتایج فیلتر (' + FA(rowsF.length) + ')' : 'رویدادهای ' + jl(calState.sel);
    $('v4-cal-body').innerHTML = '<div class="v4-calnav"><button type="button" class="v4-btn" onclick="V4UI.calMove(1)">›</button><b>' + E(V.months()[m - 1]) + ' ' + FA(y) + '</b><button type="button" class="v4-btn" onclick="V4UI.calMove(-1)">‹</button></div><div class="v4-calhead">' + V.weekdays().map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="v4-calgrid">' + cells + '</div><h3 class="v4-h3">' + head + '</h3>' +
      (listRows.length ? listRows.map(function (e) { var openJs = "V4UI.openCalendarEvent('" + (e.sourceType || '') + "','" + (e.sourceId || '') + "','" + (e.reminderId || '') + "','" + (e.sourceInstallmentId || '') + "')"; var custom = e.sourceType === 'event'; return '<div class="v4-ev ' + e.status + '" role="button" tabindex="0" onclick="' + openJs + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + openJs + '}"><span>' + e.icon + '</span><div class="v4-ev-main"><b>' + E(e.title) + '</b><small>' + jl(e.day) + (eventTimeInfo(e).has ? ' • ⏰ ' + eventTimeInfo(e).label : '') + (e.amount ? ' • ' + M(e.amount) : '') + '</small></div>' + badge(e.status) + '<div class="v4-evact">' + (custom ? actionBtn('✔', "V4UI.doneEvent('" + e.sourceId + "')") : '') + actionBtn('↗', openJs, 'accent') + '</div></div>'; }).join('') : '<div class="v4-empty">رویدادی ثبت نشده است.</div>');
  }
  UI.addCalendarItem = function () {
    var dayLabel = calState.sel ? jl(calState.sel) : 'روز انتخاب‌شده';
    root.openModal('<h2>➕ افزودن به تقویم مالی</h2><p class="hint">برای ' + E(dayLabel) + ' یکی از گزینه‌های قدیمی برنامه را انتخاب کن.</p><div class="calendar-add-choices"><button type="button" class="v4-btn primary" onclick="closeModal();openNote()">📝 یادداشت</button><button type="button" class="v4-btn primary" onclick="closeModal();openReminder()">🔔 یادآوری</button></div>');
  };
  UI.openCalendarEvent = function (sourceType, sourceId, reminderId, sourceInstallmentId) {
    try {
      if (sourceType === 'check' && sourceId && typeof root.openCheck === 'function') return root.openCheck(sourceId);
      if (sourceType === 'person' && sourceId) {
        /* اقساطِ سررسید باید مستقیم وارد مدیریت اقساط شوند، نه فرم پروفایل شخص. */
        if (sourceInstallmentId && typeof root.openInstallmentFromCalendar === 'function') return root.openInstallmentFromCalendar(sourceId, sourceInstallmentId);
        if (reminderId && root.data && Array.isArray(root.data.reminders)) {
          var rr = root.data.reminders.find(function (x) { return x.id === reminderId; });
          if (rr && rr.sourceInstallmentId && typeof root.openInstallmentFromCalendar === 'function') return root.openInstallmentFromCalendar(sourceId, rr.sourceInstallmentId);
        }
        if (typeof root.openPerson === 'function') return root.openPerson(sourceId);
      }
      if (sourceType === 'note' && sourceId && typeof root.openNote === 'function') return root.openNote(sourceId);
      if (sourceType === 'reminder' && (reminderId || sourceId) && typeof root.openReminder === 'function') return root.openReminder(reminderId || sourceId);
      if (sourceType === 'goal' && sourceId) return UI.modal('goals', 'edit', sourceId);
      if (sourceType === 'budget' && sourceId) return UI.modal('budgets', 'edit', sourceId);
      if (sourceType === 'shared' && sourceId) return UI.modal('shared', 'edit', sourceId);
      if (sourceType === 'event' && sourceId) return UI.modal('events', 'edit', sourceId);
      if (reminderId && typeof root.openReminder === 'function') return root.openReminder(reminderId);
      flash('این رویداد دیگر وجود ندارد.');
    } catch (e) { console.error('calendar event open', e); alert(e.message || 'باز کردن رویداد ممکن نشد'); }
  };
  UI.pickDay = function (k) { calState.sel = k; renderCalendar(); };
  UI.calMove = function (dir) { calState.jm += dir; if (calState.jm > 12) { calState.jm = 1; calState.jy++; } if (calState.jm < 1) { calState.jm = 12; calState.jy--; } var g = root.jalaliToGregorian(calState.jy, calState.jm, 1); calState.sel = g[0] + '-' + String(g[1]).padStart(2, '0') + '-' + String(g[2]).padStart(2, '0'); renderCalendar(); };
  UI.doneEvent = function (id) { var e = V.find('events', id); if (!e) return; e.done = !e.done; V.touch(e); V.commit(); };
  UI.cfg = C; UI.state = state; UI.STATUS_FA = STATUS_FA;

  /* ---------- نوار فیلتر بخش چک‌ها ---------- */
  UI.mountChecks = function (force) {
    var page = $('checks'), list = $('checkList'); if (!page || !list) return;
    var bar = $('v4-checks-bar');
    if (bar && !force) return;
    if (!bar) { bar = document.createElement('div'); bar.id = 'v4-checks-bar'; list.parentNode.insertBefore(bar, list); }
    bar.innerHTML = '<div class="v4-checks-tools"><button class="v4-btn v4-icon-action" type="button" onclick="V4UI.exportSection(\'checks\')" title="خروجی Excel چک‌ها" aria-label="خروجی Excel چک‌ها">📊</button></div>' + checksPanel();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

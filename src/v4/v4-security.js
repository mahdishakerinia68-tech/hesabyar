/* حساب‌یار V4 — امنیت اطلاعات: بررسی سلامت داده، ترمیم، قفل خودکار نشست */
(function (root) {
  'use strict';
  var V = root.V4, S = root.V4Security = {};
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'hesabdar-v4-autolock-min';

  /* ---------- سلامت داده ---------- */
  var NUM = { transactions: ['amount'], checks: ['amount'], budgets: ['limit'], goals: ['target'], assets: ['value', 'buyPrice'], shared: ['total'] };
  S.integrity = function (d) {
    var issues = [];
    if (!d || typeof d !== 'object') return [{ where: 'data', msg: 'ساختار داده نامعتبر است' }];
    var coll = function (k) { return NUM[k] && (['budgets', 'goals', 'assets', 'shared'].indexOf(k) >= 0 ? (d.v4 && d.v4[k]) : d[k]); };
    Object.keys(NUM).forEach(function (k) {
      var arr = coll(k); if (arr == null) return;
      if (!Array.isArray(arr)) { issues.push({ where: k, msg: 'لیست نیست' }); return; }
      var ids = {};
      arr.forEach(function (r, i) {
        if (!r || typeof r !== 'object') { issues.push({ where: k, idx: i, msg: 'رکورد نامعتبر', fix: 'drop' }); return; }
        if (r.id && ids[r.id]) issues.push({ where: k, idx: i, msg: 'شناسه‌ی تکراری' }); else if (r.id) ids[r.id] = 1;
        NUM[k].forEach(function (f) { var v = r[f]; if (v != null && (typeof v !== 'number' || !isFinite(v) || v < 0)) issues.push({ where: k, idx: i, msg: 'مبلغ نامعتبر در «' + f + '»', field: f, fix: 'zero' }); });
      });
    });
    return issues;
  };
  /* ترمیم فقط برای داده‌های V4 (رکورد غیرشیء حذف، مبلغ نامعتبر صفر) */
  S.repairV4 = function (d) {
    var n = 0; if (!d || !d.v4) return 0;
    ['budgets', 'goals', 'assets', 'shared', 'savings', 'events'].forEach(function (k) {
      var arr = d.v4[k]; if (!Array.isArray(arr)) { d.v4[k] = []; n++; return; }
      d.v4[k] = arr.filter(function (r) { if (!r || typeof r !== 'object') { n++; return false; } return true; });
      d.v4[k].forEach(function (r) { (NUM[k] || []).forEach(function (f) { if (r[f] != null && (typeof r[f] !== 'number' || !isFinite(r[f]) || r[f] < 0)) { r[f] = 0; n++; } }); });
    });
    return n;
  };

  /* ---------- قفل خودکار نشست ---------- */
  S.minutes = function () { var v = null; try { v = localStorage.getItem(KEY); } catch (e) { /* ignore */ } return v == null ? 10 : Math.max(0, Number(v) || 0); };
  S.setMinutes = function (m) { try { localStorage.setItem(KEY, String(Math.max(0, Number(m) || 0))); } catch (e) { /* ignore */ } };
  var last = Date.now(), hiddenAt = 0, timer = null;
  S.lockedNow = function () { return !!$('lock'); };
  S.hasLock = function () { return typeof root.hasLockCode === 'function' && root.hasLockCode(); };
  S.lockNow = function () { if (S.hasLock() && !S.lockedNow() && typeof root.showLock === 'function') { try { root.closeModal && root.closeModal(); } catch (e) { /* ignore */ } root.showLock(); return true; } return false; };
  S.tick = function (now) {
    var m = S.minutes(); if (!m || !S.hasLock() || S.lockedNow()) return false;
    if ((now || Date.now()) - last >= m * 60000) return S.lockNow();
    return false;
  };
  S.init = function () {
    if (S._inited || typeof document === 'undefined') return; S._inited = true;
    ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { last = Date.now(); }, { passive: true, capture: true }); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else { var m = S.minutes(); if (hiddenAt && m && Date.now() - hiddenAt >= m * 60000) S.lockNow(); hiddenAt = 0; last = Date.now(); }
    });
    timer = setInterval(function () { S.tick(); }, 15000);
  };

  /* ---------- رابط ---------- */
  S.open = function () {
    var d = V.getData(), issues = S.integrity(d), m = S.minutes(), lock = S.hasLock();
    var backupAt = root.getAutoBackupInfo ? root.getAutoBackupInfo() : null, days = backupAt ? Math.floor((Date.now() - backupAt.getTime()) / 86400000) : null;
    var row = function (ok, t) { return '<div class="v4-sec-row ' + (ok ? 'ok' : 'bad') + '"><span>' + (ok ? '✅' : '⚠️') + '</span><span>' + t + '</span></div>'; };
    root.openModal('<h2>🛡 امنیت اطلاعات</h2><div class="form v4-form">' +
      row(lock, lock ? 'قفل برنامه فعال است' : 'قفل برنامه فعال نیست — از تنظیمات رمز/الگو بگذار') +
      row(days != null && days <= 7, days == null ? 'هنوز Backup نگرفته‌ای' : 'آخرین Backup: ' + V.fa(days) + ' روز پیش') +
      row(!issues.length, issues.length ? V.fa(issues.length) + ' مورد داده‌ی مشکوک پیدا شد' : 'داده‌ها سالم‌اند (مبلغ منفی/نامعتبر یا رکورد خراب نیست)') +
      '<label class="v4-field"><span>قفل خودکار پس از بی‌فعالیتی</span><select id="v4-autolock">' + [[0, 'خاموش'], [1, '۱ دقیقه'], [5, '۵ دقیقه'], [10, '۱۰ دقیقه'], [30, '۳۰ دقیقه']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === m ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<button class="primary" type="button" onclick="V4Security.saveSettings()">ذخیره‌ی تنظیم قفل خودکار</button>' +
      (issues.length ? '<div class="hint">' + issues.slice(0, 4).map(function (i) { return V.esc(i.where + ': ' + i.msg); }).join('<br>') + '</div><button class="v4-btn danger" type="button" onclick="V4Security.repair()">ترمیم داده‌های V4 (با تأیید)</button>' : '') +
      '<p class="hint">نکته‌ها: اطلاعات در حافظه‌ی IndexedDB همین دستگاه ذخیره می‌شود، نه به‌صورت متن ساده در localStorage. Backupها رمزنگاری‌شده‌اند. رمز پین/الگو فقط به‌صورت هش ذخیره می‌شود. همگام‌سازی Firebase فقط با ورود کاربر و قوانین Firestore محدودشده کار می‌کند.</p></div>');
  };
  S.saveSettings = function () { S.setMinutes($('v4-autolock').value); last = Date.now(); root.closeModal(); if (root.V4UI) root.V4UI.flash('ذخیره شد ✓'); };
  S.repair = function () {
    if (!confirm('موارد نامعتبر در داده‌های بخش‌های جدید اصلاح می‌شود (رکورد خراب حذف، مبلغ نامعتبر صفر). قبلش نسخه‌ی ایمنی گرفته می‌شود. ادامه؟')) return;
    (root.V4Backup ? root.V4Backup.Safety.save(V.getData(), 'manual') : Promise.resolve()).then(function () { var n = S.repairV4(V.getData()); root.save(); root.closeModal(); alert(V.fa(n) + ' مورد اصلاح شد.'); });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

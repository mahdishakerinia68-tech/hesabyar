/* حساب‌یار V4 — پشتیبان‌گیری و بازیابی پیشرفته
 * - Backup انتخابی و رمزنگاری‌شده (AES-GCM با تابع‌های موجود برنامه)
 * - Restore با پیش‌نمایش، انتخاب بخش‌ها، حالت «ادغام» (پیش‌فرض، بدون حذف) یا «جایگزینی»، و تأییدیه
 * - «نسخه‌ی ایمنی» خودکار از اطلاعات فعلی قبل از Restore و قبل از Migration (IndexedDB جداگانه) */
(function (root) {
  'use strict';
  var V = root.V4, E = V.esc, B = root.V4Backup = {};
  var $ = function (id) { return document.getElementById(id); };
  var D = function () { return V.getData(); };

  var CORE = [['accounts', 'حساب‌ها'], ['transactions', 'تراکنش‌ها'], ['expenseCats', 'دسته‌های هزینه'], ['incomeCats', 'دسته‌های درآمد'], ['people', 'بدهکار/طلبکار'], ['customers', 'مشتری‌ها'], ['products', 'کالا و انبار'], ['invoices', 'فاکتورها'], ['checks', 'چک‌ها'], ['notes', 'یادداشت‌ها'], ['reminders', 'یادآورها']];
  var NEW = [['budgets', 'بودجه‌ها'], ['goals', 'اهداف مالی'], ['savings', 'صندوق‌های پس‌انداز'], ['assets', 'دارایی‌ها'], ['shared', 'هزینه‌های هم‌خرج'], ['events', 'رویدادهای تقویم']];
  var SYNCED = ['accounts', 'transactions', 'people', 'customers', 'products', 'reminders', 'notes', 'checks', 'invoices', 'expenseCats', 'incomeCats'];
  B.CORE = CORE; B.NEW = NEW;
  var isNew = function (k) { return NEW.some(function (x) { return x[0] === k; }); };
  var label = function (k) { var x = CORE.concat(NEW).find(function (y) { return y[0] === k; }); return x ? x[1] : k; };
  var getList = function (d, k) { return isNew(k) ? ((d.v4 && d.v4[k]) || []) : (d[k] || []); };

  /* ---------- نسخه‌های ایمنی (IndexedDB جدا از دیتابیس اصلی) ---------- */
  var Safety = B.Safety = {
    DB: 'hesabdar-v4-safety', STORE: 'snaps', KEEP: 5,
    open: function () {
      return new Promise(function (res, rej) {
        if (!root.indexedDB) return rej(new Error('IndexedDB در دسترس نیست'));
        var r = root.indexedDB.open(Safety.DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(Safety.STORE, { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
    },
    tx: function (mode, fn) {
      return Safety.open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(Safety.STORE, mode), st = t.objectStore(Safety.STORE), out = fn(st);
          t.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { db.close(); rej(t.error); };
        });
      });
    },
    save: function (dataObj, reason) {
      var snap = { id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), reason: reason || 'manual', json: JSON.stringify(dataObj) };
      return Safety.tx('readwrite', function (st) { st.put(snap); }).then(function () { return Safety.prune(); }).then(function () { return snap.id; });
    },
    list: function () { return Safety.tx('readonly', function (st) { return st.getAll(); }).then(function (a) { return (a || []).map(function (s) { return { id: s.id, at: s.at, reason: s.reason, size: s.json.length }; }).sort(function (x, y) { return x.at < y.at ? 1 : -1; }); }); },
    get: function (id) { return Safety.tx('readonly', function (st) { return st.get(id); }); },
    prune: function () { return Safety.list().then(function (l) { return Promise.all(l.slice(Safety.KEEP).map(function (s) { return Safety.tx('readwrite', function (st) { st.delete(s.id); }); })); }); }
  };
  B.preMigration = function (stored) { return Safety.save(stored, 'pre-migration-v5').catch(function (e) { console.warn('pre-migration backup failed', e); return null; }); };

  /* ---------- ساخت payload ---------- */
  var REASON_FA = { 'pre-migration-v5': 'قبل از ارتقا به V4', 'pre-restore': 'قبل از Restore', 'pre-snapshot-restore': 'قبل از بازگردانی نسخه‌ی ایمنی', manual: 'دستی' };
  B.buildPayload = function (keys) {
    var d = D(), parts = {};
    keys.forEach(function (k) { parts[k] = JSON.parse(JSON.stringify(getList(d, k))); });
    return { format: 'hesabdar-selective-backup', version: 2, appVersion: V.appVersion(), schemaVersion: V.SCHEMA, createdAt: new Date().toISOString(), includes: keys.slice(), parts: parts };
  };

  /* ---------- اعتبارسنجی فایل بکاپ ---------- */
  var AMOUNT_FIELDS = ['amount', 'limit', 'target', 'value', 'buyPrice', 'total', 'paid', 'balance'];
  B.validateParts = function (parts) {
    var errs = [];
    if (!parts || typeof parts !== 'object' || Array.isArray(parts)) return ['ساختار فایل پشتیبان نامعتبر است'];
    Object.keys(parts).forEach(function (k) {
      var arr = parts[k];
      if (!CORE.concat(NEW).some(function (x) { return x[0] === k; })) return;
      if (!Array.isArray(arr)) { errs.push('«' + label(k) + '» باید لیست باشد'); return; }
      var ids = {};
      arr.forEach(function (r, i) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) { errs.push('«' + label(k) + '» ردیف ' + (i + 1) + ': رکورد نامعتبر'); return; }
        if (!r.id || typeof r.id !== 'string') errs.push('«' + label(k) + '» ردیف ' + (i + 1) + ': شناسه ندارد');
        else if (ids[r.id]) errs.push('«' + label(k) + '»: شناسه‌ی تکراری ' + r.id); else ids[r.id] = 1;
        AMOUNT_FIELDS.forEach(function (f) { if (r[f] != null && r[f] !== '' && (typeof r[f] !== 'number' || !isFinite(r[f]) || (f !== 'balance' && r[f] < 0))) errs.push('«' + label(k) + '» ردیف ' + (i + 1) + ': مقدار «' + f + '» نامعتبر'); });
      });
    });
    return errs;
  };
  /* هر قالب قدیمی یا جدید را به {key: [..]} تبدیل می‌کند */
  B.normalizeToParts = function (inner) {
    if (inner && inner.format === 'hesabdar-selective-backup' && inner.parts) return inner.parts;
    var src = inner && inner.data && typeof inner.data === 'object' ? inner.data : inner, parts = {};
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    CORE.forEach(function (x) { if (src[x[0]] !== undefined) parts[x[0]] = src[x[0]]; });
    NEW.forEach(function (x) { if (src.v4 && src.v4[x[0]] !== undefined) parts[x[0]] = src.v4[x[0]]; });
    return Object.keys(parts).length ? parts : null;
  };

  /* ---------- اعمال Restore ---------- */
  B.applyParts = function (d, parts, keys, mode) {
    var report = {};
    V.ensure(d);
    keys.forEach(function (k) {
      var incoming = parts[k]; if (!Array.isArray(incoming)) return;
      var target = isNew(k) ? d.v4 : d, cur = target[k] || [], added = 0, skipped = 0, replaced = 0;
      if (mode === 'replace') { replaced = cur.length; target[k] = JSON.parse(JSON.stringify(incoming)); added = incoming.length; }
      else {
        var have = {}; cur.forEach(function (r) { have[r.id] = 1; });
        incoming.forEach(function (r) { if (have[r.id]) skipped++; else { cur.push(JSON.parse(JSON.stringify(r))); added++; } });
        target[k] = cur;
      }
      report[k] = { added: added, skipped: skipped, replaced: replaced };
    });
    return report;
  };

  B.backupKeys = function () { var k = []; $('v4b-keys') && $('v4b-keys').querySelectorAll('input:checked').forEach(function (i) { k.push(i.value); }); return k; };
  B.toggleAll = function (on) { $('v4b-keys').querySelectorAll('input').forEach(function (i) { i.checked = on; }); };

  B.makeBackup = function () {
    var keys = B.backupKeys(), pw = ($('v4b-pass') || {}).value || '', pw2 = ($('v4b-pass2') || {}).value || '';
    if (!keys.length) return alert('حداقل یک بخش را برای پشتیبان‌گیری انتخاب کن');
    if (pw.length < 8) return alert('رمز پشتیبان باید حداقل ۸ نویسه باشد');
    if (pw !== pw2) return alert('رمز و تکرار رمز یکسان نیستند');
    var payload = B.buildPayload(keys);
    root.encryptBackupPayload(payload, pw).then(function (container) {
      var name = 'hesabdar-backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
      var done = function (where) { try { root.markBackupDone && root.markBackupDone(); root.logEvent && root.logEvent('تهیه Backup', keys.length + ' بخش', 'settings'); } catch (e) { /* ignore */ } alert('پشتیبان رمزنگاری‌شده ساخته شد' + (where ? ' (' + where + ')' : '') + '. رمز را در جای امن نگه دار؛ بدون آن بازیابی ممکن نیست.'); };
      if (typeof root.writeAutoBackupFile === 'function') return root.writeAutoBackupFile(container).then(function (res) { if (res && res.ok) done(res.filename || name); else throw new Error('write'); });
      V.downloadBytes(new TextEncoder().encode(JSON.stringify(container)), name, 'application/json'); done(name);
    }).catch(function (e) { console.warn(e); alert('ساخت پشتیبان ناموفق بود. دوباره تلاش کن.'); });
  };

  /* ---------- Restore ---------- */
  var pending = null;
  B.restoreFromInput = function (ev) {
    var input = ev && ev.target, file = input && input.files && input.files[0]; if (!file) return;
    var finish = function () { if (input) input.value = ''; };
    var readP = typeof root.readBackupFile === 'function' ? root.readBackupFile(file) : file.text();
    readP.then(function (raw) {
      var parsed; try { parsed = JSON.parse(raw); } catch (e) { throw new Error('فایل پشتیبان خراب یا ناقص است (JSON نامعتبر)'); }
      if (parsed && parsed.format === 'hesabdar-encrypted-backup' && parsed.salt && parsed.iv && parsed.ciphertext) return askPassword(parsed, 0);
      return parsed;
    }).then(function (inner) {
      if (!inner) { finish(); return; }
      var parts = B.normalizeToParts(inner); if (!parts) throw new Error('این فایل، پشتیبان حساب‌یار نیست یا اطلاعاتی ندارد');
      var errs = B.validateParts(parts);
      if (errs.length) throw new Error('فایل پشتیبان داده‌ی نامعتبر دارد و بازیابی انجام نشد:\n• ' + errs.slice(0, 5).join('\n• ') + (errs.length > 5 ? '\n… و ' + (errs.length - 5) + ' مورد دیگر' : ''));
      pending = { parts: parts, at: inner.createdAt || '' }; finish(); B.openPreview();
    }).catch(function (e) { finish(); alert(e && e.message ? e.message : 'بازیابی ناموفق بود'); });
  };
  function askPassword(container, attempt) {
    if (attempt >= 3) throw new Error('رمز اشتباه است. بازیابی انجام نشد.');
    var pass = prompt(attempt === 0 ? 'این پشتیبان رمزنگاری‌شده است. رمز پشتیبان را وارد کن:' : 'رمز اشتباه بود. دوباره وارد کن:');
    if (pass === null) return null;
    return root.decryptBackupPayload(container, pass.trim()).catch(function () { return askPassword(container, attempt + 1); });
  }
  B.openPreview = function () {
    var d = D(), parts = pending.parts, rows = CORE.concat(NEW).filter(function (x) { return Array.isArray(parts[x[0]]); }).map(function (x) {
      var k = x[0], cur = getList(d, k).length, inc = parts[k].length;
      return '<label class="v4b-row"><input type="checkbox" value="' + k + '" checked><span>' + E(x[1]) + '</span><small>در فایل: ' + V.fa(inc) + ' • فعلی: ' + V.fa(cur) + '</small></label>';
    }).join('');
    root.openModal('<h2>♻️ بازیابی اطلاعات</h2><div class="form v4-form"><p class="hint">فایل پشتیبان' + (pending.at ? ' (' + E(root.jalaliLabel ? root.jalaliLabel(pending.at) : pending.at) + ')' : '') + ' خوانده شد. بخش‌هایی را که می‌خواهی بازیابی شوند انتخاب کن.</p><div id="v4r-keys">' + rows + '</div>' +
      '<div class="v4-field"><span>روش بازیابی</span><label class="v4b-row"><input type="radio" name="v4r-mode" value="merge" checked><span>افزودن موارد جدید (امن؛ چیزی حذف یا بازنویسی نمی‌شود)</span></label><label class="v4b-row"><input type="radio" name="v4r-mode" value="replace"><span>جایگزینی کامل بخش‌های انتخابی (اطلاعات فعلی همان بخش‌ها پاک می‌شود)</span></label></div>' +
      '<p class="hint">پیش از اعمال، یک «نسخه‌ی ایمنی» از اطلاعات فعلی گرفته می‌شود تا در صورت لزوم برگردانده شود. قفل برنامه و تنظیمات امنیتی تغییر نمی‌کنند.</p><button class="primary" type="button" onclick="V4Backup.confirmRestore()">ادامه</button></div>');
  };
  B.confirmRestore = function () {
    var keys = []; document.querySelectorAll('#v4r-keys input:checked').forEach(function (i) { keys.push(i.value); });
    if (!keys.length) return alert('حداقل یک بخش را انتخاب کن');
    var mode = (document.querySelector('input[name="v4r-mode"]:checked') || {}).value || 'merge', d = D();
    var summary = keys.map(function (k) { return '• ' + label(k) + ': ' + V.fa(pending.parts[k].length) + ' مورد از فایل'; }).join('\n');
    var msg = mode === 'replace' ? '⚠️ جایگزینی کامل\n\nاطلاعات فعلی این بخش‌ها حذف و با فایل جایگزین می‌شود:\n' + summary + '\n\nمطمئنی؟' : 'موارد جدید فایل به اطلاعات فعلی اضافه می‌شود (بدون حذف):\n' + summary + '\n\nتأیید می‌کنی؟';
    if (!confirm(msg)) return;
    if (mode === 'replace' && !confirm('تأیید نهایی: جایگزینی قابل بازگشت است فقط با «نسخه‌ی ایمنی». ادامه بدهم؟')) return;
    Safety.save(d, 'pre-restore').catch(function (e) { console.warn('safety snapshot failed', e); return null; }).then(function (sid) {
      if (!sid && !confirm('ساخت نسخه‌ی ایمنی ناموفق بود. بدون آن ادامه بدهم؟')) return;
      var report = B.applyParts(d, pending.parts, keys, mode);
      if (typeof root.normalizeData === 'function') root.normalizeData();
      if (root.markDirty && mode === 'merge') keys.forEach(function (k) { if (SYNCED.indexOf(k) >= 0) (d[k] || []).forEach(function (r) { root.markDirty(k, r.id, false, r, r.updatedAt); }); });
      if (typeof root.save === 'function') root.save();
      var cloud = mode === 'replace' && V.sync() && V.sync().user && typeof root.replaceCloudAfterRestore === 'function' ? root.replaceCloudAfterRestore() : Promise.resolve();
      return Promise.resolve(cloud).catch(function (e) { console.warn('cloud replace failed', e); }).then(function () {
        try { root.logEvent && root.logEvent('بازیابی اطلاعات', keys.length + ' بخش • ' + (mode === 'replace' ? 'جایگزینی' : 'ادغام'), 'settings'); } catch (e) { /* ignore */ }
        pending = null; root.closeModal();
        alert('بازیابی انجام شد:\n' + keys.map(function (k) { var r = report[k] || {}; return '• ' + label(k) + ': ' + V.fa(r.added || 0) + ' مورد افزوده' + (r.skipped ? '، ' + V.fa(r.skipped) + ' تکراری نادیده گرفته شد' : ''); }).join('\n'));
      });
    });
  };

  B.restoreSnapshot = function (id) {
    if (!confirm('کل اطلاعات برنامه با این نسخه‌ی ایمنی جایگزین می‌شود. قبلش از وضعیت فعلی هم یک نسخه‌ی ایمنی گرفته می‌شود. ادامه؟')) return;
    Safety.get(id).then(function (s) {
      if (!s) throw new Error('نسخه‌ی ایمنی پیدا نشد');
      var snap = JSON.parse(s.json), lock = {}; ['pin', 'pinHash', 'pinSalt', 'patternHash', 'patternSalt', 'lockMethod', 'biometricEnabled', 'webauthnCredId'].forEach(function (k) { lock[k] = D()[k]; });
      return Safety.save(D(), 'pre-snapshot-restore').then(function () {
        V.setData(root.migrateData ? root.migrateData(snap) : snap); Object.assign(D(), lock);
        if (root.normalizeData) root.normalizeData(); V.ensure(D()); if (root.save) root.save(); root.closeModal(); alert('نسخه‌ی ایمنی بازگردانی شد.');
      });
    }).catch(function (e) { alert(e.message || 'بازگردانی ناموفق بود'); });
  };
  B.downloadSnapshot = function (id) { Safety.get(id).then(function (s) { if (s) V.downloadBytes(new TextEncoder().encode(s.json), 'hesabdar-safety-' + s.at.slice(0, 10) + '.json', 'application/json'); }); };

  /* ---------- رابط تنظیمات ---------- */
  B.settingsHTML = function () {
    var d = D(), box = function (x) { return '<label class="v4b-row"><input type="checkbox" value="' + x[0] + '" checked><span>' + E(x[1]) + '</span><small>' + V.fa(getList(d, x[0]).length) + ' مورد</small></label>'; };
    return '<div class="v4-settings-backup"><h3 class="v4-h3">💾 پشتیبان‌گیری و بازیابی</h3><p class="hint">همان پشتیبان‌گیری پیشرفته‌ی امکانات جامع مالی؛ بخش‌ها را انتخاب کن، فایل را با رمزنگاری ذخیره کن و در صورت نیاز با پیش‌نمایش و تأییدیه بازیابی کن.</p><div class="v4-row"><button class="v4-btn" type="button" onclick="V4Backup.toggleAll(true)">انتخاب همه</button><button class="v4-btn" type="button" onclick="V4Backup.toggleAll(false)">هیچ‌کدام</button></div><div id="v4b-keys">' + CORE.concat(NEW).map(box).join('') + '</div><div class="v4-row v4-backup-passwords"><input id="v4b-pass" type="password" autocomplete="new-password" placeholder="رمز پشتیبان (حداقل ۸ نویسه)"><input id="v4b-pass2" type="password" autocomplete="new-password" placeholder="تکرار رمز"></div><button class="primary v4-btn" type="button" onclick="V4Backup.makeBackup()">⬇️ تهیه و دانلود Backup</button><hr><h3 class="v4-h3">♻️ بازیابی</h3><p class="hint">قبل از اعمال، پیش‌نمایش و تأییدیه می‌گیریم و نسخه‌ی ایمنی از اطلاعات فعلی ساخته می‌شود.</p><label class="v4-btn" style="text-align:center;display:block">📂 انتخاب فایل پشتیبان<input type="file" accept=".json,application/json" style="display:none" onchange="V4Backup.restoreFromInput(event)"></label><hr><h3 class="v4-h3">🛡 نسخه‌های ایمنی</h3><div id="v4b-snaps" class="hint">در حال بارگذاری…</div></div>';
  };
  B.mountSettings = function () {
    var box = $('v4SettingsBackup'); if (!box) return;
    box.innerHTML = B.settingsHTML();
    Safety.list().then(function (l) {
      var el = $('v4b-snaps'); if (!el) return;
      el.innerHTML = l.length ? l.map(function (s) { return '<div class="v4b-snap"><span>' + E(root.jalaliDateTimeInput ? root.jalaliDateTimeInput(s.at) : s.at) + ' — ' + E(REASON_FA[s.reason] || s.reason) + '</span><span><button class="v4-btn" type="button" onclick="V4Backup.downloadSnapshot(\'' + s.id + '\')">⬇️</button><button class="v4-btn danger" type="button" onclick="V4Backup.restoreSnapshot(\'' + s.id + '\')">بازگردانی</button></span></div>'; }).join('') : 'هنوز نسخه‌ی ایمنی ساخته نشده است.';
    }).catch(function () { var el = $('v4b-snaps'); if (el) el.textContent = 'نسخه‌ی ایمنی در این مرورگر در دسترس نیست.'; });
  };

  /* ---------- رابط ---------- */
  B.open = function () {
    var d = D(), box = function (x) { return '<label class="v4b-row"><input type="checkbox" value="' + x[0] + '" checked><span>' + E(x[1]) + '</span><small>' + V.fa(getList(d, x[0]).length) + ' مورد</small></label>'; };
    root.openModal('<h2>💾 پشتیبان‌گیری و بازیابی</h2><div class="form v4-form"><h3 class="v4-h3">تهیه‌ی Backup</h3><p class="hint">بخش‌هایی را که می‌خواهی در فایل باشند انتخاب کن. فایل با رمز خودت رمزنگاری می‌شود.</p><div class="v4-row"><button class="v4-btn" type="button" onclick="V4Backup.toggleAll(true)">انتخاب همه</button><button class="v4-btn" type="button" onclick="V4Backup.toggleAll(false)">هیچ‌کدام</button></div><div id="v4b-keys">' + CORE.concat(NEW).map(box).join('') + '</div><input id="v4b-pass" type="password" autocomplete="new-password" placeholder="رمز پشتیبان (حداقل ۸ نویسه)"><input id="v4b-pass2" type="password" autocomplete="new-password" placeholder="تکرار رمز"><button class="primary" type="button" onclick="V4Backup.makeBackup()">⬇️ تهیه و دانلود Backup</button>' +
      '<h3 class="v4-h3">بازیابی (Restore)</h3><p class="hint">قبل از هر بازیابی پیش‌نمایش و تأییدیه می‌گیریم و اطلاعات فعلی حذف نمی‌شود مگر خودت «جایگزینی» را انتخاب کنی.</p><label class="v4-btn" style="text-align:center;display:block">📂 انتخاب فایل پشتیبان<input type="file" accept=".json,application/json" style="display:none" onchange="V4Backup.restoreFromInput(event)"></label>' +
      '<h3 class="v4-h3">نسخه‌های ایمنی</h3><div id="v4b-snaps" class="hint">در حال بارگذاری…</div></div>');
    Safety.list().then(function (l) {
      var el = $('v4b-snaps'); if (!el) return;
      el.innerHTML = l.length ? l.map(function (s) { return '<div class="v4b-snap"><span>' + E(root.jalaliDateTimeInput ? root.jalaliDateTimeInput(s.at) : s.at) + ' — ' + E(REASON_FA[s.reason] || s.reason) + '</span><span><button class="v4-btn" type="button" onclick="V4Backup.downloadSnapshot(\'' + s.id + '\')">⬇️</button><button class="v4-btn danger" type="button" onclick="V4Backup.restoreSnapshot(\'' + s.id + '\')">بازگردانی</button></span></div>'; }).join('') : 'هنوز نسخه‌ی ایمنی ساخته نشده است.';
    }).catch(function () { var el = $('v4b-snaps'); if (el) el.textContent = 'نسخه‌ی ایمنی در این مرورگر در دسترس نیست.'; });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* حساب‌یار V4 — هسته (اعتبارسنجی، ذخیره‌ی داده، فیلتر، خروجی Excel)
 * کلاسیک (بدون import) تا مثل app.js با <script> بارگذاری شود و در Node هم قابل تست باشد. */
(function (root) {
  'use strict';
  var V4 = root.V4 = root.V4 || {};
  V4.VERSION = 'pro1.10.0';
  V4.SCHEMA = 5;
  V4.SECTIONS = ['budgets', 'goals', 'savings', 'assets', 'shared', 'events'];

  var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  V4.toEn = function (s) {
    return String(s == null ? '' : s).replace(/[۰-۹٠-٩]/g, function (d) {
      var i = FA.indexOf(d); return i >= 0 ? String(i) : String(AR.indexOf(d));
    });
  };
  V4.num = function (v) {
    var t = V4.toEn(v).replace(/[,٬\s]/g, '').replace(/تومان|ریال/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;   // حروف یا نویسه‌ی اضافه = نامعتبر (نه حذف بی‌صدا)
    var n = Number(t);
    return isFinite(n) ? n : NaN;
  };
  V4.fa = function (n) { try { return new Intl.NumberFormat('fa-IR').format(Number(n) || 0); } catch (e) { return String(n); } };
  V4.money = function (n) { return V4.fa(Math.round(Number(n) || 0)) + ' تومان'; };
  V4.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
  };
  V4.uid = function () {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) { /* ignore */ }
    return 'v4-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };

  /* تاریخ محلی به شکل YYYY-MM-DD (برای مقایسه‌ی امن بدون اثر منطقه‌ی زمانی) */
  V4.ymd = function (iso) {
    var s = String(iso || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var d = new Date(s); if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /* ---------- اعتبارسنجی ورودی ---------- */
  V4.MAX_AMOUNT = 1e15;
  V4.cleanText = function (v, label, max, required) {
    var s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (required && !s) throw new Error(label + ' را وارد کن');
    if (s.length > (max || 120)) throw new Error(label + ' بیش از حد طولانی است');
    return s;
  };
  V4.amount = function (v, label, opts) {
    opts = opts || {};
    var raw = String(v == null ? '' : v).trim();
    if (!raw) { if (opts.optional) return 0; throw new Error((label || 'مبلغ') + ' را وارد کن'); }
    var n = V4.num(raw);
    if (!isFinite(n)) throw new Error((label || 'مبلغ') + ' نامعتبر است');
    if (n < 0) throw new Error((label || 'مبلغ') + ' نمی‌تواند منفی باشد');
    if (n === 0 && !opts.allowZero && !opts.optional) throw new Error((label || 'مبلغ') + ' باید بیشتر از صفر باشد');
    if (n > V4.MAX_AMOUNT) throw new Error((label || 'مبلغ') + ' بیش از حد بزرگ است');
    return Math.round(n);
  };
  V4.isoDate = function (v, label, optional) {
    if (v == null || v === '') { if (optional) return ''; throw new Error((label || 'تاریخ') + ' را وارد کن'); }
    var d = new Date(v);
    if (isNaN(d.getTime())) throw new Error((label || 'تاریخ') + ' نامعتبر است');
    return String(v).length <= 10 ? String(v) : d.toISOString();
  };

  /* ---------- ذخیره‌ی داده: data.v4 ---------- */
  /* app.js متغیرهای data / APP_VERSION / PERSIAN_MONTHS / sync را با let/const می‌سازد (روی window نیستند)؛
   * این کلاسیک‌اسکریپت‌ها از طریق نام ساده‌ی همان محدوده‌ی سراسری به آن‌ها دسترسی دارند. */
  V4.getData = function () { try { return typeof data !== 'undefined' ? data : root.data; } catch (e) { return root.data; } };
  V4.setData = function (v) { try { data = v; } catch (e) { root.data = v; } };
  V4.appVersion = function () { try { return typeof APP_VERSION !== 'undefined' ? APP_VERSION : V4.VERSION; } catch (e) { return V4.VERSION; } };
  var FALLBACK_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  V4.months = function () { try { if (typeof PERSIAN_MONTHS !== 'undefined') return PERSIAN_MONTHS; } catch (e) { /* ignore */ } return FALLBACK_MONTHS; };
  V4.weekdays = function () { try { if (typeof PERSIAN_WEEKDAYS !== 'undefined') return PERSIAN_WEEKDAYS; } catch (e) { /* ignore */ } return ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; };
  V4.sync = function () { try { return typeof sync !== 'undefined' ? sync : null; } catch (e) { return null; } };
  V4.ensure = function (d) {
    d = d || V4.getData();
    if (!d || typeof d !== 'object') return null;
    if (!d.v4 || typeof d.v4 !== 'object' || Array.isArray(d.v4)) d.v4 = {};
    d.v4.version = d.v4.version || 1;
    if ((Number(d.schemaVersion) || 1) < V4.SCHEMA) d.schemaVersion = V4.SCHEMA;
    V4.SECTIONS.forEach(function (k) { if (!Array.isArray(d.v4[k])) d.v4[k] = []; });
    return d.v4;
  };
  V4.touch = function (r) {
    if (typeof root.touch === 'function') { try { return root.touch(r); } catch (e) { /* fall through */ } }
    r.revision = Math.max(0, Number(r.revision) || 0) + 1; r.updatedAt = new Date().toISOString(); return r;
  };
  V4.commit = function () { if (typeof root.save === 'function') root.save(); };
  V4.list = function (sec) { var s = V4.ensure(); return s ? s[sec] : []; };
  V4.find = function (sec, id) { return V4.list(sec).find(function (x) { return x.id === id; }); };
  V4.upsert = function (sec, rec) {
    var list = V4.list(sec), i = list.findIndex(function (x) { return x.id === rec.id; });
    V4.touch(rec);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    return rec;
  };
  V4.remove = function (sec, id) {
    var list = V4.list(sec), i = list.findIndex(function (x) { return x.id === id; });
    if (i < 0) return null;
    return list.splice(i, 1)[0];
  };

  /* ---------- محاسبات مالی ---------- */
  V4.monthKeyOf = function (iso) {
    if (typeof root.jalaliMonthKey === 'function') return root.jalaliMonthKey(iso);
    var d = new Date(iso); return isNaN(d.getTime()) ? null : d.getFullYear() * 100 + d.getMonth() + 1;
  };
  V4.curMonthKey = function () { return typeof root.currentJalaliMonthKey === 'function' ? root.currentJalaliMonthKey() : V4.monthKeyOf(new Date()); };

  /* بودجه: هزینه‌ی واقعیِ تراکنش‌های «هزینه» در همان ماه/دسته */
  V4.budgetSpent = function (b, d) {
    d = d || V4.getData();
    var mk = b.monthKey || V4.curMonthKey();
    return ((d && d.transactions) || []).reduce(function (s, t) {
      if (!t || t.type !== 'expense') return s;
      if (b.category && t.category !== b.category) return s;
      if (b.accountID && t.accountID !== b.accountID) return s;
      return V4.monthKeyOf(t.date) === mk ? s + (Number(t.amount) || 0) : s;
    }, 0);
  };
  V4.budgetInfo = function (b, d) {
    var spent = V4.budgetSpent(b, d), limit = Number(b.limit) || 0, pct = limit ? Math.round(spent / limit * 100) : 0;
    return { spent: spent, limit: limit, remaining: limit - spent, pct: pct, status: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
  };
  V4.sumMoves = function (arr, plus, minus) {
    return (arr || []).reduce(function (s, m) { return s + (m.type === plus ? Number(m.amount) || 0 : m.type === minus ? -(Number(m.amount) || 0) : 0); }, 0);
  };
  V4.goalInfo = function (g) {
    var saved = (g.deposits || []).reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0), target = Number(g.target) || 0;
    var pct = target ? Math.min(100, Math.round(saved / target * 100)) : 0;
    var status = saved >= target && target > 0 ? 'done' : (g.deadline && new Date(g.deadline).getTime() < Date.now() ? 'late' : 'active');
    return { saved: saved, target: target, remaining: Math.max(0, target - saved), pct: pct, status: status };
  };
  V4.savingBalance = function (s) { return V4.sumMoves(s.movements, 'deposit', 'withdraw'); };
  V4.assetInfo = function (a) {
    var cost = Number(a.buyPrice) || 0, val = Number(a.value) || 0;
    return { cost: cost, value: val, diff: val - cost, pct: cost ? Math.round((val - cost) / cost * 1000) / 10 : 0 };
  };
  /* هم‌خرج: سهم هر نفر، پرداخت‌شده، مانده */
  V4.sharedInfo = function (x) {
    var parts = x.participants || [], total = Number(x.total) || 0;
    var customSum = parts.reduce(function (s, p) { return s + (Number(p.share) || 0); }, 0);
    var rows = parts.map(function (p) {
      var share = customSum > 0 ? Number(p.share) || 0 : Math.round(total / Math.max(1, parts.length));
      var paid = (x.settlements || []).reduce(function (s, st) { return st.from === p.name ? s + (Number(st.amount) || 0) : s; }, 0);
      var isPayer = p.name === x.payer;
      var owed = isPayer ? 0 : Math.max(0, share - paid);
      return { name: p.name, share: share, paid: paid, owed: owed, isPayer: isPayer };
    });
    var owedTotal = rows.reduce(function (s, r) { return s + r.owed; }, 0);
    return { rows: rows, owedTotal: owedTotal, status: owedTotal === 0 ? 'settled' : 'open' };
  };

  /* ---------- موتور جستجو/فیلتر/مرتب‌سازی ---------- */
  /* f: {q, from, to (ISO), min, max, status, sort, account, person, type}
   * cfg: {text(r), date(r), amount(r), status(r), account(r), person(r), type(r)} */
  V4.applyFilters = function (rows, f, cfg) {
    f = f || {}; cfg = cfg || {};
    var q = V4.toEn(f.q || '').trim().toLowerCase();
    var from = f.from ? V4.ymd(f.from) : null, to = f.to ? V4.ymd(f.to) : null;
    var min = f.min !== '' && f.min != null ? V4.num(f.min) : null, max = f.max !== '' && f.max != null ? V4.num(f.max) : null;
    var out = rows.filter(function (r) {
      if (q && V4.toEn(cfg.text ? cfg.text(r) : JSON.stringify(r)).toLowerCase().indexOf(q) < 0) return false;
      if (from != null || to != null) {
        var t = cfg.date ? V4.ymd(cfg.date(r)) : '';
        if (!t) return false;
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      if (min != null && isFinite(min) && (cfg.amount ? cfg.amount(r) : 0) < min) return false;
      if (max != null && isFinite(max) && (cfg.amount ? cfg.amount(r) : 0) > max) return false;
      if (f.status && cfg.status && cfg.status(r) !== f.status) return false;
      if (f.account && cfg.account && cfg.account(r) !== f.account) return false;
      if (f.person && cfg.person && String(cfg.person(r) || '').toLowerCase().indexOf(String(f.person).toLowerCase()) < 0) return false;
      if (f.type && cfg.type && cfg.type(r) !== f.type) return false;
      return true;
    });
    var s = f.sort || 'date-desc';
    var keyFn = s.indexOf('amount') === 0 ? function (r) { return cfg.amount ? cfg.amount(r) : 0; }
      : s.indexOf('name') === 0 ? function (r) { return String(cfg.text ? cfg.text(r) : ''); }
      : function (r) { var t = cfg.date ? new Date(cfg.date(r)).getTime() : 0; return isNaN(t) ? 0 : t; };
    var dir = /-asc$/.test(s) ? 1 : -1;
    return out.sort(function (a, b) {
      var x = keyFn(a), y = keyFn(b);
      var c = typeof x === 'string' ? x.localeCompare(y, 'fa') : x - y;
      return c * dir;
    });
  };

  /* ---------- خروجی Excel واقعی (.xlsx) بدون کتابخانه ---------- */
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zipStore(files) {
    var chunks = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + name.length + data.length;
    });
    var cdStart = offset, cdSize = 0;
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
      chunks.push(new Uint8Array(h), c.name); cdSize += h.length + c.name.length;
    });
    chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0), out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }
  function xesc(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /* sheets: [{name, headers:[], rows:[[]]}] — شیت راست‌به‌چپ، سرستون پررنگ، ستون‌ها عریض */
  V4.buildXlsx = function (sheets) {
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView rightToLeft="1"/></bookViews><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + xesc(String(s.name).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6F5C"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D0D0"/></left><right style="thin"><color rgb="FFD0D0D0"/></right><top style="thin"><color rgb="FFD0D0D0"/></top><bottom style="thin"><color rgb="FFD0D0D0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf></cellXfs></styleSheet>' });
    sheets.forEach(function (s, si) {
      var widths = s.headers.map(function (h, ci) {
        var w = String(h).length; s.rows.forEach(function (r) { w = Math.max(w, String(r[ci] == null ? '' : r[ci]).length); });
        return Math.min(48, Math.max(10, w + 3));
      });
      var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      function cell(r, c, v, style) {
        var ref = colName(c) + r;
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="2"><v>' + v + '</v></c>';
        return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
      }
      xml += '<row r="1" ht="22" customHeight="1">' + s.headers.map(function (h, c) { return '<c r="' + colName(c) + '1" s="1" t="inlineStr"><is><t>' + xesc(h) + '</t></is></c>'; }).join('') + '</row>';
      s.rows.forEach(function (row, ri) { xml += '<row r="' + (ri + 2) + '">' + s.headers.map(function (h, c) { return cell(ri + 2, c, row[c], 0); }).join('') + '</row>'; });
      xml += '</sheetData></worksheet>';
      files.push({ name: 'xl/worksheets/sheet' + (si + 1) + '.xml', data: xml });
    });
    return zipStore(files);
  };
  V4.downloadBytes = function (bytes, filename, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  V4.exportXlsx = function (filename, sheets) {
    var bytes = V4.buildXlsx(sheets);
    V4.downloadBytes(bytes, filename.replace(/\.xlsx$/i, '') + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return bytes;
  };

  /* ---------- مایگریشن ساختار v4 (idempotent) ---------- */
  V4.migrate = function (d) {
    if (!d || typeof d !== 'object') return d;
    V4.ensure(d);
    d.schemaVersion = Math.max(Number(d.schemaVersion) || 1, V4.SCHEMA);
    return d;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

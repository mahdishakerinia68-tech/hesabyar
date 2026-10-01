// تست مرورگریِ واقعی برای ۲۰ مورد چک‌لیست نسخه‌ی تست V4 (با داده‌ی آزمایشی).
// اجرا:  npm i -D playwright && npx playwright install chromium && npm run test:v4
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './helpers/static-server.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Playwright نصب نیست: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await startStaticServer(root);
const browser = await chromium.launch({ headless: true });
const tmp = mkdtempSync(join(tmpdir(), 'v4-'));
const results = [];
const jsErrors = [];

async function freshPage(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, locale: 'fa-IR' });
  await ctx.route('**/*', r => (r.request().url().startsWith(server.url) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.on('pageerror', e => jsErrors.push(String(e)));
  await page.addInitScript(() => {
    window.__alerts = []; window.alert = m => { window.__alerts.push(String(m)); };
    window.confirm = () => true; window.prompt = () => 'Test-Pass-123';
  });
  await page.goto(server.url + '/index.html');
  await page.waitForFunction(() => typeof V4UI !== 'undefined' && typeof data !== 'undefined' && typeof HesabYarStorage !== 'undefined');
  await page.waitForTimeout(400);
  return { page, ctx };
}
const setv = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); if (!e) throw new Error('no element #' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const lastAlert = page => page.evaluate(() => window.__alerts[window.__alerts.length - 1] || '');
const todayJ = page => page.evaluate(() => jalaliInputValue(new Date().toISOString()));
async function test(n, title, fn) {
  try { await fn(); results.push([n, title, true]); console.log(`  ✓ ${n}. ${title}`); }
  catch (e) { results.push([n, title, false, e]); console.log(`  ✗ ${n}. ${title}\n      ${String(e.message).split('\n')[0]}`); }
}

const { page, ctx } = await freshPage();
const tj = await todayJ(page);
const state = {};

console.log('V4 browser tests');
await test(1, 'ساخت چک', async () => {
  await page.evaluate(() => openCheck());
  await setv(page, 'ct', 'receive'); await setv(page, 'cn', 'آقای تست'); await setv(page, 'camount', '2500000');
  await setv(page, 'cdate', tj); await setv(page, 'cnum', '123456'); await setv(page, 'cbank', 'ملی');
  await page.evaluate(() => { const a = document.getElementById('cacc'); a.value = a.options[0].value; });
  await page.evaluate(() => saveCheck());
  const c = await page.evaluate(() => data.checks.map(x => ({ id: x.id, name: x.name, amount: x.amount, settled: x.settled })));
  assert.equal(c.length, 1); assert.equal(c[0].amount, 2500000); assert.equal(c[0].settled, false); state.checkId = c[0].id;
});
await test(2, 'تغییر وضعیت چک', async () => {
  const before = await page.evaluate(() => data.transactions.length);
  await page.evaluate(id => toggleCheckSettled(id), state.checkId);
  const after = await page.evaluate(id => ({ s: data.checks.find(c => c.id === id).settled, n: data.transactions.length }), state.checkId);
  assert.equal(after.s, true); assert.ok(after.n >= before);
  await page.evaluate(id => toggleCheckSettled(id), state.checkId);
  assert.equal(await page.evaluate(id => data.checks.find(c => c.id === id).settled, state.checkId), false);
});
await test(3, 'ساخت بودجه', async () => {
  await page.evaluate(() => V4UI.modal('budgets', 'edit'));
  await setv(page, 'v4-name', 'خوراک'); await setv(page, 'v4-cat', await page.evaluate(() => data.expenseCats[0].name));
  await setv(page, 'v4-limit', '۱,۰۰۰,۰۰۰'); await setv(page, 'v4-date', tj);
  await page.evaluate(() => V4UI.save('budgets', null));
  const b = await page.evaluate(() => V4.list('budgets')); assert.equal(b.length, 1); assert.equal(b[0].limit, 1000000); state.budgetId = b[0].id; state.cat = b[0].category;
});
await test(4, 'ثبت هزینه و کاهش بودجه', async () => {
  await page.evaluate(id => V4UI.modal('budgets', 'spend', id), state.budgetId);
  await setv(page, 'v4-s-amount', '300000');
  await page.evaluate(() => { const a = document.getElementById('v4-s-acc'); a.value = a.options[0].value; });
  const bal0 = await page.evaluate(() => accountBalance(data.accounts[0].id));
  await page.evaluate(id => V4UI.submit('budgets', 'spend', id), state.budgetId);
  const i = await page.evaluate(id => V4.budgetInfo(V4.find('budgets', id)), state.budgetId);
  assert.equal(i.spent, 300000); assert.equal(i.remaining, 700000); assert.equal(i.pct, 30);
  assert.equal(await page.evaluate(() => accountBalance(data.accounts[0].id)), bal0 - 300000);
  const nTx = await page.evaluate(() => data.transactions.length);
  await page.evaluate(id => V4UI.modal('budgets', 'spend', id), state.budgetId);
  await page.evaluate(() => { document.getElementById('v4-s-amount').value = '-5'; });
  await page.evaluate(id => V4UI.submit('budgets', 'spend', id), state.budgetId);
  assert.match(await lastAlert(page), /منفی|نامعتبر/); assert.equal(await page.evaluate(() => data.transactions.length), nTx, 'invalid expense must not be saved');
});
await test(5, 'ساخت هدف مالی', async () => {
  await page.evaluate(() => V4UI.modal('goals', 'edit')); await setv(page, 'v4-name', 'خرید خودرو'); await setv(page, 'v4-target', '10000000');
  await page.evaluate(() => V4UI.save('goals', null));
  const g = await page.evaluate(() => V4.list('goals')); assert.equal(g.length, 1); state.goalId = g[0].id;
});
await test(6, 'واریز به هدف', async () => {
  await page.evaluate(id => V4UI.modal('goals', 'deposit', id), state.goalId); await setv(page, 'v4-s-amount', '2500000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('goals', 'deposit', id), state.goalId);
  const i = await page.evaluate(id => V4.goalInfo(V4.find('goals', id)), state.goalId); assert.equal(i.saved, 2500000); assert.equal(i.pct, 25); assert.equal(i.status, 'active');
});
await test(7, 'ساخت صندوق پس‌انداز', async () => {
  await page.evaluate(() => V4UI.modal('savings', 'edit')); await setv(page, 'v4-name', 'اضطراری'); await page.evaluate(() => V4UI.save('savings', null));
  const s = await page.evaluate(() => V4.list('savings')); assert.equal(s.length, 1); state.savId = s[0].id;
});
await test(8, 'واریز و برداشت (و رد برداشت بیش از موجودی)', async () => {
  await page.evaluate(id => V4UI.modal('savings', 'deposit', id), state.savId); await setv(page, 'v4-s-amount', '1000000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('savings', 'deposit', id), state.savId);
  await page.evaluate(id => V4UI.modal('savings', 'withdraw', id), state.savId); await setv(page, 'v4-s-amount', '400000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('savings', 'withdraw', id), state.savId);
  assert.equal(await page.evaluate(id => V4.savingBalance(V4.find('savings', id)), state.savId), 600000);
  await page.evaluate(id => V4UI.modal('savings', 'withdraw', id), state.savId); await setv(page, 'v4-s-amount', '900000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('savings', 'withdraw', id), state.savId);
  assert.match(await lastAlert(page), /بیشتر/); assert.equal(await page.evaluate(id => V4.savingBalance(V4.find('savings', id)), state.savId), 600000);
});
await test(9, 'ساخت دارایی', async () => {
  await page.evaluate(() => V4UI.modal('assets', 'edit')); await setv(page, 'v4-name', 'سکه'); await setv(page, 'v4-cost', '50000000'); await setv(page, 'v4-value', '55000000'); await setv(page, 'v4-date', tj);
  await page.evaluate(() => V4UI.save('assets', null));
  const a = await page.evaluate(() => V4.list('assets')); assert.equal(a.length, 1); state.assetId = a[0].id;
});
await test(10, 'ثبت تغییر ارزش دارایی', async () => {
  await page.evaluate(id => V4UI.modal('assets', 'revalue', id), state.assetId); await setv(page, 'v4-s-amount', '60000000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('assets', 'revalue', id), state.assetId);
  const a = await page.evaluate(id => V4.find('assets', id), state.assetId); assert.equal(a.value, 60000000); assert.equal(a.history.length, 2);
  assert.equal(await page.evaluate(id => V4.assetInfo(V4.find('assets', id)).diff, state.assetId), 10000000);
});
await test(11, 'ساخت هزینه هم‌خرج', async () => {
  await page.evaluate(() => V4UI.modal('shared', 'edit')); await setv(page, 'v4-name', 'شام'); await setv(page, 'v4-total', '900000'); await setv(page, 'v4-payer', 'من'); await setv(page, 'v4-parts', 'علی\nمریم'); await setv(page, 'v4-date', tj);
  await page.evaluate(() => V4UI.save('shared', null));
  const s = await page.evaluate(() => V4.list('shared')); assert.equal(s.length, 1); state.sharedId = s[0].id;
  const i = await page.evaluate(id => V4.sharedInfo(V4.find('shared', id)), state.sharedId); assert.equal(i.owedTotal, 600000); assert.equal(i.status, 'open');
});
await test(12, 'ثبت تسویه', async () => {
  await page.evaluate(id => V4UI.modal('shared', 'settle', id), state.sharedId); await setv(page, 'v4-s-who', 'علی'); await setv(page, 'v4-s-amount', '300000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('shared', 'settle', id), state.sharedId);
  assert.equal(await page.evaluate(id => V4.sharedInfo(V4.find('shared', id)).owedTotal, state.sharedId), 300000);
  await page.evaluate(id => V4UI.modal('shared', 'settle', id), state.sharedId); await setv(page, 'v4-s-who', 'مریم'); await setv(page, 'v4-s-amount', '999999'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('shared', 'settle', id), state.sharedId);
  assert.match(await lastAlert(page), /بیشتر/);
  await page.evaluate(id => V4UI.modal('shared', 'settle', id), state.sharedId); await setv(page, 'v4-s-who', 'مریم'); await setv(page, 'v4-s-amount', '300000'); await setv(page, 'v4-s-date', tj);
  await page.evaluate(id => V4UI.submit('shared', 'settle', id), state.sharedId);
  assert.equal(await page.evaluate(id => V4.sharedInfo(V4.find('shared', id)).status, state.sharedId), 'settled');
});
await test(13, 'نمایش رویداد در تقویم', async () => {
  await page.evaluate(() => V4UI.modal('events', 'edit')); await setv(page, 'v4-name', 'قسط وام'); await setv(page, 'v4-amount', '1200000'); await setv(page, 'v4-date', tj);
  await page.evaluate(() => V4UI.save('events', null));
  await page.evaluate(() => goToPage('v4-calendar'));
  await page.waitForSelector('#v4-calendar .v4-day');
  const txt = await page.evaluate(() => { const k = V4.ymd(new Date().toISOString()); V4UI.pickDay(k); return document.getElementById('v4-cal-body').innerText; });
  assert.match(txt, /قسط وام/); assert.match(txt, /چک دریافتی/);
  assert.ok(await page.evaluate(() => document.querySelectorAll('#v4-calendar .v4-day em').length) >= 1);
});
await test(14, 'نمایش اطلاعات در داشبورد', async () => {
  await page.evaluate(() => goToPage('home'));
  const t = await page.evaluate(() => document.getElementById('v4Dash').innerText);
  assert.match(t, /بودجه/); assert.match(t, /اهداف/); assert.match(t, /پس‌انداز/); assert.match(t, /دارایی/); assert.match(t, /هم‌خرج/);
  assert.match(t, /۶۰٬۰۰۰٬۰۰۰|۶۰,۰۰۰,۰۰۰/);
});
await test(15, 'خروجی Excel (واقعی .xlsx، فارسی و RTL)', async () => {
  for (const [key, expect] of [['budgets', 'خوراک'], ['goals', 'خرید خودرو'], ['savings', 'اضطراری'], ['assets', 'سکه'], ['shared', 'شام'], ['checks', 'آقای تست']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(k => V4UI.exportSection(k), key)]);
    const f = join(tmp, key + '.xlsx'); await dl.saveAs(f);
    const sheet = execFileSync('unzip', ['-p', f, 'xl/worksheets/sheet1.xml']).toString('utf8');
    assert.ok(sheet.includes('rightToLeft="1"'), key + ' not RTL'); assert.ok(sheet.includes(expect), key + ' missing ' + expect);
    assert.equal(execFileSync('unzip', ['-tq', f]).toString().includes('No errors'), true, key + ' zip invalid');
    assert.ok(readFileSync(f).subarray(0, 2).toString() === 'PK');
  }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => V4UI.exportCalendar())]); await dl.saveAs(join(tmp, 'cal.xlsx'));
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => V4UI.exportAll())]); await dl2.saveAs(join(tmp, 'all.xlsx'));
  const wb = execFileSync('unzip', ['-p', join(tmp, 'all.xlsx'), 'xl/workbook.xml']).toString('utf8'); assert.ok((wb.match(/<sheet /g) || []).length >= 6);
});
let backupFile;
await test(16, 'Backup (انتخابی + رمزنگاری‌شده)', async () => {
  await page.evaluate(() => V4Backup.open());
  await setv(page, 'v4b-pass', 'Test-Pass-123'); await setv(page, 'v4b-pass2', 'Test-Pass-123');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => V4Backup.makeBackup())]);
  backupFile = join(tmp, 'backup.json'); await dl.saveAs(backupFile);
  const c = JSON.parse(readFileSync(backupFile, 'utf8')); assert.equal(c.format, 'hesabdar-encrypted-backup'); assert.ok(c.ciphertext && c.salt && c.iv);
  assert.ok(!readFileSync(backupFile, 'utf8').includes('خرید خودرو'), 'backup is not encrypted');
  await page.evaluate(() => V4Backup.open()); await setv(page, 'v4b-pass', 'short'); await setv(page, 'v4b-pass2', 'short');
  await page.evaluate(() => V4Backup.makeBackup()); assert.match(await lastAlert(page), /۸ نویسه/);
});
await test(17, 'Restore با پیش‌نمایش/تأییدیه و بدون حذف اطلاعات فعلی', async () => {
  // تغییر وضعیت: یک هدف را پاک و یک هدف تازه اضافه می‌کنیم
  await page.evaluate(id => { V4.remove('goals', id); V4.upsert('goals', { id: 'keep-me', name: 'هدف فعلی', target: 5, deposits: [] }); save(); }, state.goalId);
  await page.evaluate(() => V4Backup.open()); // مدال را می‌بندیم تا ورودی فایل جدا تست شود
  await page.evaluate(() => closeModal());
  let confirms = 0; await page.evaluate(() => { window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return true; }; });
  await page.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.id = 'v4-test-file'; document.body.appendChild(i); i.addEventListener('change', V4Backup.restoreFromInput); });
  await page.setInputFiles('#v4-test-file', backupFile);
  await page.waitForSelector('#v4r-keys input');
  const prev = await page.evaluate(() => document.getElementById('v4r-keys').innerText); assert.match(prev, /اهداف مالی/); assert.match(prev, /فعلی/);
  await page.evaluate(() => document.querySelectorAll('#v4r-keys input').forEach(i => { i.checked = i.value === 'goals'; }));
  await page.evaluate(() => V4Backup.confirmRestore());
  await page.waitForFunction(() => window.__alerts.some(a => a.includes('بازیابی انجام شد')));
  const names = await page.evaluate(() => V4.list('goals').map(g => g.name).sort());
  assert.deepEqual(names, ['خرید خودرو', 'هدف فعلی'].sort()); // حالت ادغام: هدف فعلی حذف نشد، هدف پاک‌شده برگشت
  assert.ok((await page.evaluate(() => window.__confirms.length)) >= 1, 'confirmation was not requested');
  const snaps = await page.evaluate(() => V4Backup.Safety.list()); assert.ok(snaps.some(s => s.reason === 'pre-restore'), 'no safety snapshot');
  // فایل خراب و رمز اشتباه
  writeFileSync(join(tmp, 'bad.json'), '{not json'); await page.setInputFiles('#v4-test-file', join(tmp, 'bad.json'));
  await page.waitForFunction(() => window.__alerts.some(a => a.includes('خراب')));
  const evil = JSON.parse(readFileSync(backupFile, 'utf8')); writeFileSync(join(tmp, 'plain-bad.json'), JSON.stringify({ format: 'hesabdar-selective-backup', parts: { goals: [{ id: 'x', name: 'y', target: -5 }] } }));
  await page.setInputFiles('#v4-test-file', join(tmp, 'plain-bad.json'));
  await page.waitForFunction(() => window.__alerts.some(a => a.includes('نامعتبر')));
  assert.equal(await page.evaluate(() => V4.list('goals').length), 2);
});
await test(18, 'کارکرد صحیح در موبایل (بدون اسکرول افقی، روشن و تاریک)', async () => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const dark of [false, true]) {
      await page.evaluate(d => document.body.classList.toggle('dark', d), dark);
      for (const p of ['home', 'v4-budgets', 'v4-goals', 'v4-savings', 'v4-assets', 'v4-shared', 'v4-calendar', 'checks']) {
        await page.evaluate(n => goToPage(n), p); await page.waitForTimeout(60);
        const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(o <= 1, `overflow ${o}px on ${p} @${width}${dark ? ' dark' : ''}`);
      }
    }
  }
  await page.evaluate(() => document.body.classList.remove('dark')); await page.setViewportSize({ width: 390, height: 844 });
});
await test(19, 'کارکرد صحیح در حالت RTL', async () => {
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  await page.evaluate(() => goToPage('v4-budgets'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('v4-list-budgets')).direction), 'rtl');
  const x = await page.evaluate(() => { const a = document.querySelector('#v4-budgets .v4-head b').getBoundingClientRect(), b = document.querySelector('#v4-budgets .v4-head .v4-badge').getBoundingClientRect(); return a.left > b.left; });
  assert.ok(x, 'title should be to the right of badge in RTL');
});
await test(20, 'عدم خراب شدن امکانات قبلی (تراکنش، حساب، گزارش، فیلترها، حذف با تأیید)', async () => {
  await page.evaluate(() => openTx());
  await setv(page, 'amount', '50000'); await page.evaluate(() => { const k = document.getElementById('txKind'); k.value = 'expense'; k.dispatchEvent(new Event('change')); });
  await setv(page, 'cat', await page.evaluate(() => data.expenseCats[0].name)); await setv(page, 'title', 'تست قدیمی');
  const n0 = await page.evaluate(() => data.transactions.length); await page.evaluate(() => saveTx());
  assert.equal(await page.evaluate(() => data.transactions.length), n0 + 1);
  for (const p of ['accounts', 'transactions', 'people', 'reports', 'reminders', 'notes', 'invoices', 'settings']) { await page.evaluate(n => goToPage(n), p); assert.ok(await page.evaluate(n => document.getElementById(n).classList.contains('active'), p), p); }
  // فیلتر چک‌ها
  await page.evaluate(() => goToPage('checks')); await setv(page, 'v4f-checks-q', 'آقای تست');
  assert.match(await page.evaluate(() => document.getElementById('checkList').innerText), /آقای تست/);
  await setv(page, 'v4f-checks-q', 'نامی که وجود ندارد'); assert.ok(!(await page.evaluate(() => document.getElementById('checkList').innerText)).includes('آقای تست'));
  await page.evaluate(() => V4UI.clearFilter('checks'));
  assert.match(await page.evaluate(() => document.getElementById('checkList').innerText), /آقای تست/);
  // فیلتر بودجه (جستجو/مبلغ/وضعیت/مرتب‌سازی) و حذف با تأیید
  await page.evaluate(() => goToPage('v4-budgets')); await setv(page, 'v4f-budgets-q', 'خوراک'); assert.match(await page.evaluate(() => document.getElementById('v4-list-budgets').innerText), /خوراک/);
  await setv(page, 'v4f-budgets-q', ''); await setv(page, 'v4f-budgets-min', '5000000'); await page.evaluate(() => V4UI.applyFilter('budgets'));
  assert.match(await page.evaluate(() => document.getElementById('v4-list-budgets').innerText), /نتیجه‌ای/);
  await page.evaluate(() => V4UI.clearFilter('budgets'));
  await page.evaluate(() => { window.__c = 0; window.confirm = () => { window.__c++; return false; }; });
  await page.evaluate(id => V4UI.del('budgets', id), state.budgetId);
  assert.equal(await page.evaluate(() => V4.list('budgets').length), 1, 'delete without confirm must not delete');
  await page.evaluate(() => { window.confirm = () => true; }); await page.evaluate(id => V4UI.del('budgets', id), state.budgetId);
  assert.equal(await page.evaluate(() => V4.list('budgets').length), 0);
});
await test(21, 'مایگریشن: داده‌ی قدیمی حفظ می‌شود و قبلش نسخه‌ی ایمنی ساخته می‌شود', async () => {
  const { page: p2, ctx: c2 } = await freshPage();
  await p2.evaluate(async () => { // شبیه‌سازی دیتابیس نسخه‌ی قبلی (schema 4، بدون v4)
    const d = JSON.parse(JSON.stringify(data)); delete d.v4; d.schemaVersion = 4; d.people.push({ id: 'p-old', name: 'قدیمی', type: 'debt', amount: 1000, paid: 0 });
    await HesabYarStorage.saveSnapshot(d);
  });
  await p2.reload(); await p2.waitForFunction(() => typeof V4 !== 'undefined' && data && data.v4);
  await p2.waitForTimeout(500);
  const r = await p2.evaluate(async () => ({ v: data.schemaVersion, old: data.people.some(p => p.id === 'p-old'), v4: Object.keys(data.v4).sort(), snaps: (await V4Backup.Safety.list()).map(s => s.reason) }));
  assert.equal(r.v, 5); assert.ok(r.old, 'old data lost'); assert.deepEqual(r.v4, ['assets', 'budgets', 'events', 'goals', 'savings', 'shared', 'version']); assert.ok(r.snaps.includes('pre-migration-v5'));
  await c2.close();
});
await test(22, 'داده‌ی V4 بعد از بستن و بازکردن برنامه می‌ماند', async () => {
  await page.evaluate(() => flushPersist()); await page.reload(); await page.waitForFunction(() => typeof V4 !== 'undefined' && data && data.v4);
  await page.waitForTimeout(400);
  const c = await page.evaluate(() => ({ g: V4.list('goals').length, a: V4.list('assets').length, s: V4.list('savings').length, sh: V4.list('shared').length }));
  assert.deepEqual(c, { g: 2, a: 1, s: 1, sh: 1 });
});

await ctx.close(); await browser.close(); await server.close();
const failed = results.filter(r => !r[2]);
const ownErrors = jsErrors.filter(e => !/firebase|gstatic/i.test(e));
if (ownErrors.length) { console.log('JS errors:', ownErrors.slice(0, 5)); }
console.log(`\nv4-browser: ${results.length - failed.length}/${results.length} passed${ownErrors.length ? `, ${ownErrors.length} JS error(s)` : ', no JS errors'}`);
process.exit(failed.length || ownErrors.length ? 1 : 0);

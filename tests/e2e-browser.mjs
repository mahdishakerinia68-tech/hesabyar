// Real browser end-to-end test: drives the shipped app (index.html + app.js) in headless Chromium.
//
//   npm i -D playwright && npx playwright install chromium   # once, optional dev tool
//   npm run test:browser
//
// The app itself has no dependencies; Playwright is only needed to run this file.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './helpers/static-server.mjs';
import { invoiceTotal } from '../src/modules/invoices.js';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  console.error('e2e-browser: Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await startStaticServer(root);
const browser = await chromium.launch({ headless: true });
const results = [];

// External hosts (Google Fonts, Firebase SDK) are intentionally unreachable in tests.
const IGNORED_LOG = [/fonts\.googleapis/, /gstatic/, /Content Security Policy/, /ERR_FAILED/, /net::ERR/, /firebase sdk load failed/, /status of (403|404)/];
const enDigits = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,\s]/g, '');

async function openApp({ seedLocal = null, context, initScript = null } = {}) {
  const ctx = context || await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fa-IR', acceptDownloads: true });
  const page = await ctx.newPage();
  const state = { ctx, page, errors: [], dialogs: [], answers: [] };
  await page.route(u => !u.href.startsWith(server.url), r => r.abort());
  page.on('pageerror', e => state.errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (IGNORED_LOG.some(re => re.test(m.text()))) return;
    state.errors.push('console: ' + m.text().slice(0, 300));
  });
  page.on('dialog', async d => {
    state.dialogs.push({ type: d.type(), message: d.message() });
    if (d.type() === 'prompt') await d.accept(state.answers.length ? state.answers.shift() : '');
    else await d.accept();
  });
  if (initScript) await page.addInitScript(initScript);
  if (seedLocal) await page.addInitScript(seed => { if (!localStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); } }, seedLocal);
  await gotoApp(state);
  return state;
}
async function gotoApp(state, { reload = false } = {}) {
  if (reload) await state.page.reload(); else await state.page.goto(server.url + '/index.html');
  await state.page.waitForFunction(() => typeof data === 'object' && document.querySelector('#balance') && globalThis.__hesabReady !== false);
  await state.page.waitForFunction(() => document.querySelector('#versionPill')?.textContent.trim() === 't1');
  await state.page.waitForTimeout(400);
  await state.page.evaluate(() => { try { closeModal(); } catch { /* no modal */ } });
}
const idbFlush = page => page.evaluate(() => flushPersist());
async function fillAmount(page, sel, v) { await page.fill(sel, String(v)); }

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`  ✓ ${name} (${Date.now() - t0}ms)`); }
  catch (e) { results.push({ name, ok: false, e }); console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`); }
}
function noErrors(app, label = '') { assert.deepEqual(app.errors, [], `unexpected browser errors ${label}`); }

console.log('HesabYar browser E2E');

await test('boot: no errors, no stray alerts, IndexedDB snapshot written, cash account present', async () => {
  const app = await openApp();
  noErrors(app);
  assert.deepEqual(app.dialogs, [], 'fresh install must not raise any alert');
  await idbFlush(app.page);
  assert.equal(await app.page.evaluate(() => HesabYarStorage.hasSnapshot()), true);
  const names = await app.page.evaluate(() => data.accounts.map(a => a.name));
  assert.deepEqual(names, ['کیف پول نقدی']);
  assert.equal(await app.page.evaluate(() => document.documentElement.lang), 'fa');
  assert.equal(await app.page.evaluate(() => document.documentElement.dir), 'rtl');
  await app.ctx.close();
});

await test('every page and every modal opens without errors', async () => {
  const app = await openApp();
  for (const pg of ['home', 'accounts', 'transactions', 'products', 'customers', 'people', 'reminders', 'notes', 'checks', 'reports', 'invoices', 'trash', 'settings']) {
    await app.page.evaluate(p => goToPage(p), pg);
    assert.equal(await app.page.evaluate(p => document.getElementById(p).classList.contains('active'), pg), true, `page ${pg} not active`);
  }
  for (const fn of ['openAccount', 'openTx', 'openProduct', 'openCustomer', 'openPerson', 'openNote', 'openReminder', 'openCheck', 'openInvoice', 'openTransfer', 'openCalculator', 'openQuickTx', 'openCategory', 'openGlobalSearch', 'openDashboardCustomize', 'openAppModeSheet', 'openNoteReminderHub', 'openNotesWeekTable', 'openStockAdjust', 'openBankMessage']) {
    await app.page.evaluate(f => globalThis[f](), fn);
    await app.page.evaluate(() => closeModal());
  }
  noErrors(app);
  await app.ctx.close();
});

await test('accounts + transactions: data entry through the real UI, exact balance, survives reload', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => openAccount());
  await page.fill('#an', 'بانک ملی'); await fillAmount(page, '#ab', '1000000');
  await page.click('button[onclick^="saveAccount"]');
  await page.evaluate(() => openTx());
  await page.selectOption('#acc', { label: 'بانک ملی' });
  await page.fill('#title', 'خرید'); await fillAmount(page, '#amount', '250000');
  await page.click('#expenseCatButtons button >> nth=0');
  await page.click('button[onclick^="saveTx"]');
  await page.evaluate(() => openTx());
  await page.click('#incBtn');
  await page.selectOption('#acc', { label: 'بانک ملی' });
  await page.fill('#title', 'حقوق'); await fillAmount(page, '#amount', '400000');
  await page.click('#incomeCatButtons button >> nth=0');
  await page.click('button[onclick^="saveTx"]');
  assert.equal(await page.evaluate(() => data.transactions.length), 2);
  assert.equal(enDigits(await page.textContent('#balance')).replace(/\D/g, ''), '1150000');
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.transactions.length), 2);
  assert.equal(await page.evaluate(() => data.accounts.filter(a => a.name === 'کیف پول نقدی').length), 1, 'cash account duplicated after reload');
  assert.equal(enDigits(await page.textContent('#balance')).replace(/\D/g, ''), '1150000');
  noErrors(app);
  await app.ctx.close();
});

await test('reload never overwrites saved data (init-order race), even with rapid reloads', async () => {
  const app = await openApp(); const { page } = app;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(i => { data.notes.push({ id: 'n' + i, title: 'یادداشت ' + i, items: [], order: i, updatedAt: new Date().toISOString() }); save(); }, i);
  }
  await idbFlush(page);
  for (let i = 0; i < 4; i++) { await page.reload(); await page.waitForFunction(() => typeof data === 'object' && document.querySelector('#versionPill')?.textContent.trim() === 't1'); }
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => data.notes.length), 3);
  noErrors(app);
  await app.ctx.close();
});

await test('a save requested before hydration finishes can never overwrite stored data', async () => {
  const first = await openApp();
  for (let i = 0; i < 3; i++) await first.page.evaluate(i => { data.notes.push({ id: 'g' + i, title: 'گیت ' + i, items: [], order: i, updatedAt: new Date().toISOString() }); save(); }, i);
  await idbFlush(first.page);
  await first.page.close();
  // Second launch: reading from IndexedDB is slowed down while something keeps asking to save.
  const initScript = () => {
    Object.defineProperty(globalThis, 'HesabYarStorage', {
      configurable: true,
      set(v) {
        const original = v.hydrate;
        v.hydrate = fallback => new Promise(r => setTimeout(r, 400)).then(() => original(fallback));
        Object.defineProperty(globalThis, 'HesabYarStorage', { value: v, writable: true, configurable: true });
      }
    });
    const iv = setInterval(() => { if (typeof persistLocal === 'function') { try { persistLocal(); } catch { /* not ready */ } } }, 5);
    setTimeout(() => clearInterval(iv), 1200);
  };
  const second = await openApp({ context: first.ctx, initScript });
  await second.page.waitForTimeout(1500);
  assert.equal(await second.page.evaluate(() => data.notes.length), 3, 'stored notes were lost');
  await first.ctx.close();
});

await test('products + invoice: stock decreases, cost snapshot saved, totals match', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => openProduct());
  await page.fill('#prdName', 'کالای تست'); await fillAmount(page, '#prdBuy', '60'); await fillAmount(page, '#prdPrice', '100'); await fillAmount(page, '#prdStock', '10'); await fillAmount(page, '#prdMin', '2');
  await page.click('button[onclick^="saveProduct"]');
  await page.evaluate(() => openInvoice());
  await page.fill('#invCustomerName', 'مشتری آزمایشی');
  await page.fill('.inv-desc >> nth=0', 'کالای');
  await page.locator('.inv-suggest > * >> nth=0').click();
  assert.equal(await page.evaluate(() => document.querySelector('.inv-product').value), await page.evaluate(() => data.products[0].id), 'product suggestion must link the row to the product');
  await page.fill('.inv-qty >> nth=0', '2');
  await page.fill('.inv-price >> nth=0', '100');
  await page.click('button[onclick^="saveInvoice"]');
  await page.waitForTimeout(300);
  const inv = await page.evaluate(() => ({ n: data.invoices.length, stock: data.products[0].stock, item: data.invoices[0]?.items?.[0] }));
  assert.equal(inv.n, 1, 'invoice not saved; dialogs: ' + JSON.stringify(app.dialogs));
  assert.equal(inv.stock, 8);
  assert.equal(Number(inv.item.qty), 2);
  assert.equal(Number(inv.item.costPriceAtSale), 60);
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.products[0].stock), 8);
  noErrors(app);
  await app.ctx.close();
});

await test('people, checks, notes, reminders can be created and persist', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => openPerson());
  await page.selectOption('#pt', 'debt'); await page.fill('#pn', 'علی'); await fillAmount(page, '#pa', '500000');
  await page.click('button[onclick^="savePerson"]');
  await page.evaluate(() => openCheck());
  await page.fill('#cn', 'رضا'); await fillAmount(page, '#camount', '750000'); await page.fill('#cnum', '123456'); await page.fill('#cdate', '1405/06/28'); await page.selectOption('#cacc', { index: 0 });
  await page.click('button[onclick^="saveCheck"]');
  await page.evaluate(() => openNote());
  await page.fill('#ntitle', 'یادداشت آزمایشی'); await page.fill('#ntext', 'متن');
  await page.click('button[onclick^="saveNote"]');
  await page.evaluate(() => openReminder());
  await page.fill('#rt', 'یادآوری آزمایشی');
  await page.click('button[onclick^="saveReminder"]');
  await page.waitForTimeout(400);
  const counts = await page.evaluate(() => ({ people: data.people.length, checks: data.checks.length, notes: data.notes.length, reminders: data.reminders.length }));
  assert.equal(counts.people, 1, JSON.stringify({ counts, d: app.dialogs }));
  assert.equal(counts.checks, 1, JSON.stringify({ counts, d: app.dialogs }));
  assert.equal(counts.notes >= 1, true, JSON.stringify({ counts, d: app.dialogs }));
  assert.equal(counts.reminders >= 1, true, JSON.stringify({ counts, d: app.dialogs }));
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  const after = await page.evaluate(() => ({ people: data.people.length, checks: data.checks.length }));
  assert.deepEqual(after, { people: 1, checks: 1 });
  noErrors(app);
  await app.ctx.close();
});

await test('trash: delete → persists across reload → restore (trash entries have no "id" field)', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => openTx());
  await page.fill('#title', 'حذفی'); await fillAmount(page, '#amount', '1000');
  await page.click('#expenseCatButtons button >> nth=0');
  await page.click('button[onclick^="saveTx"]');
  const id = await page.evaluate(() => data.transactions.find(t => t.title === 'حذفی').id);
  await page.evaluate(id => deleteTx(id), id);
  assert.equal(await page.evaluate(() => [data.transactions.length, data.trash.length]).then(x => x.join()), '0,1');
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.trash.length), 1, 'trash entry lost on reload');
  await page.evaluate(() => restoreFromTrash(data.trash[0].trashId));
  assert.equal(await page.evaluate(() => [data.transactions.length, data.trash.length]).then(x => x.join()), '1,0');
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.transactions.some(t => t.title === 'حذفی')), true);
  noErrors(app);
  await app.ctx.close();
});

await test('settings survive reload: PIN lock, language, branding (regression: they were not persisted)', async () => {
  const app = await openApp(); const { page } = app;
  app.answers.push('4321', '4321');
  await page.evaluate(() => setPin());
  await page.waitForFunction(() => data.pinHash && data.pinHash.length > 10);
  await page.evaluate(() => { data.branding.storeName = 'فروشگاه آزمایشی'; data.yearSettlements = { '1404': { done: true } }; save(); });
  await idbFlush(page);
  await page.reload();
  await page.waitForSelector('#lock');
  await page.fill('#pinInput', '9999'); await page.click('#unlockBtn');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#lock').count(), 1, 'wrong PIN must not unlock');
  await page.fill('#pinInput', '4321'); await page.click('#unlockBtn');
  await page.waitForSelector('#lock', { state: 'detached' });
  assert.equal(await page.evaluate(() => data.branding.storeName), 'فروشگاه آزمایشی');
  assert.deepEqual(await page.evaluate(() => data.yearSettlements), { '1404': { done: true } });
  assert.equal(await page.evaluate(() => data.pin), '', 'plain PIN must never be stored');
  noErrors(app);
  await app.ctx.close();
});

await test('encrypted backup round-trip: export → wipe → import restores everything', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => { data.notes.push({ id: 'nb', title: 'برای بکاپ', items: [], order: 0, updatedAt: new Date().toISOString() }); save(); });
  app.answers.push('Password-12345');
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportData())]);
  const dir = mkdtempSync(join(tmpdir(), 'hesabyar-'));
  const file = join(dir, download.suggestedFilename());
  await download.saveAs(file);
  const container = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(container.format, 'hesabdar-encrypted-backup');
  assert.equal(JSON.stringify(container).includes('برای بکاپ'), false, 'backup must not contain plaintext data');
  assert.equal(await page.evaluate(() => !!getAutoBackupInfo()), true, 'last-backup time should be recorded');
  app.answers.length = 0;
  await page.evaluate(() => clearData());
  await page.waitForFunction(() => data.notes.length === 0);
  app.answers.push('wrong-password-1', 'Password-12345');
  await page.setInputFiles('#import', file);
  await page.waitForFunction(() => data.notes.some(n => n.title === 'برای بکاپ'), null, { timeout: 15000 });
  await idbFlush(page);
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.notes.some(n => n.title === 'برای بکاپ')), true);
  noErrors(app);
  await app.ctx.close();
});

await test('legacy localStorage data migrates to IndexedDB safely (old copy removed only after verification)', async () => {
  const legacy = { schemaVersion: 1, accounts: [{ id: 'a1', name: 'کیف پول نقدی', balance: 500 }, { id: 'a2', name: 'قدیمی', balance: 0 }], transactions: [{ id: 't1', type: 'income', amount: 700, category: 'حقوق', accountID: 'a1', date: new Date().toISOString(), title: 'قدیمی' }], lang: 'fa', pinHash: '', branding: { storeName: 'مغازه قدیمی', logo: '', stamp: '', signature: '' } };
  const app = await openApp({ seedLocal: { 'hesabdar-v35': JSON.stringify(legacy) } });
  const { page } = app;
  assert.equal(await page.evaluate(() => data.transactions.length), 1);
  assert.equal(await page.evaluate(() => data.branding.storeName), 'مغازه قدیمی');
  assert.equal(await page.evaluate(() => localStorage.getItem('hesabdar-v35')), null, 'legacy copy should be removed after verified migration');
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.transactions.length), 1);
  assert.equal(await page.evaluate(() => data.branding.storeName), 'مغازه قدیمی');
  noErrors(app);
  await app.ctx.close();
});

await test('corrupt legacy data is never deleted', async () => {
  const app = await openApp({ seedLocal: { 'hesabdar-v35': '{this is not json' } });
  assert.equal(await app.page.evaluate(() => localStorage.getItem('hesabdar-v35')), '{this is not json');
  await app.ctx.close();
});

await test('offline: PWA shell and data load with the network cut', async () => {
  const app = await openApp(); const { page, ctx } = app;
  await page.evaluate(() => { data.notes.push({ id: 'off', title: 'آفلاین', items: [], order: 0, updatedAt: new Date().toISOString() }); save(); });
  await idbFlush(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); await page.waitForTimeout(800);
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return (await c.keys()).map(r => new URL(r.url).pathname); });
  assert.equal(cached.includes('/src/core/storage-runtime.js'), true, 'storage runtime must be cached for offline start: ' + cached.join(','));
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => typeof data === 'object' && document.querySelector('#versionPill')?.textContent.trim() === 't1', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => data.notes.some(n => n.title === 'آفلاین')), true);
  await ctx.setOffline(false);
  await app.ctx.close();
});

await test('transfers, edits and installments keep balances exact', async () => {
  const app = await openApp(); const { page } = app;
  await page.evaluate(() => openAccount());
  await page.fill('#an', 'بانک'); await fillAmount(page, '#ab', '1000000');
  await page.click('button[onclick^="saveAccount"]');
  await page.evaluate(() => openTransfer());
  await page.selectOption('#from', { label: 'بانک' }); await page.selectOption('#to', { label: 'کیف پول نقدی' });
  await fillAmount(page, '#tam', '300000');
  await page.click('button[onclick^="saveTransfer"]');
  const bal = () => page.evaluate(() => Object.fromEntries(data.accounts.map(a => [a.name, accountBalance(a.id)])));
  assert.deepEqual(await bal(), { 'کیف پول نقدی': 300000, 'بانک': 700000 });
  await page.evaluate(() => openTx());
  await page.selectOption('#acc', { label: 'بانک' }); await fillAmount(page, '#amount', '50000');
  await page.click('#expenseCatButtons button >> nth=0');
  await page.click('button[onclick^="saveTx"]');
  assert.equal((await bal())['بانک'], 650000);
  await page.evaluate(() => openTx(data.transactions.find(t => t.type === 'expense').id));
  await fillAmount(page, '#amount', '60000');
  await page.click('button[onclick^="saveTx"]');
  assert.equal((await bal())['بانک'], 640000, 'editing a transaction must re-balance the account');
  await page.evaluate(() => openPerson());
  await page.selectOption('#pt', 'debt'); await page.fill('#pn', 'علی'); await fillAmount(page, '#pa', '600000'); await page.fill('#pInstCount', '3');
  await page.click('button[onclick^="savePerson"]');
  const inst = await page.evaluate(() => data.people[0].installments.items.map(i => i.amount));
  assert.equal(inst.length, 3);
  assert.equal(inst.reduce((a, b) => a + b, 0), 600000);
  noErrors(app);
  await app.ctx.close();
});

await test('invoice math in app.js equals the reference implementation on 500 random invoices', async () => {
  const app = await openApp(); const { page } = app;
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const invs = Array.from({ length: 500 }, () => ({
    items: Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ qty: Math.round(rnd() * 20 * 100) / 100 + 0.01, price: Math.floor(rnd() * 5000000) })),
    discount: rnd() < 0.5 ? Math.floor(rnd() * 100000) : 0,
    discountPercent: rnd() < 0.5 ? Math.round(rnd() * 100 * 10) / 10 : 0,
    taxRate: rnd() < 0.5 ? Math.round(rnd() * 25 * 10) / 10 : 0,
    paid: Math.floor(rnd() * 1000)
  }));
  const fromApp = await page.evaluate(list => list.map(i => [invoiceSubtotal(i), invoiceTotal(i), invoiceRemaining(i)]), invs);
  invs.forEach((inv, i) => assert.deepEqual(fromApp[i].slice(1, 2), [invoiceTotal(inv)], `invoice #${i} ${JSON.stringify(inv)}`));
  await app.ctx.close();
});

await test('IndexedDB unavailable: app falls back to localStorage and keeps data across reloads', async () => {
  const app = await openApp({ initScript: () => { Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true }); } });
  const { page } = app;
  await page.evaluate(() => { data.notes.push({ id: 'fb', title: 'بدون IndexedDB', items: [], order: 0, updatedAt: new Date().toISOString() }); save(); });
  assert.equal(await page.evaluate(() => storageMode), 'localStorage');
  await gotoApp(app, { reload: true });
  assert.equal(await page.evaluate(() => data.notes.some(n => n.title === 'بدون IndexedDB')), true);
  assert.deepEqual(app.dialogs.filter(d => d.type === 'alert' && /ذخیره/.test(d.message)), [], 'no false storage alerts');
  await app.ctx.close();
});

await test('layout: no horizontal overflow on any page at 320 / 390 / 768 px, light and dark', async () => {
  const app = await openApp(); const { page } = app;
  for (const dark of [false, true]) {
    if (dark) await page.evaluate(() => document.getElementById('theme').click());
    for (const w of [320, 390, 768]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const pg of ['home', 'accounts', 'transactions', 'products', 'customers', 'people', 'reminders', 'notes', 'checks', 'reports', 'invoices', 'trash', 'settings']) {
        await page.evaluate(p => goToPage(p), pg);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(over <= 1, `horizontal overflow ${over}px on ${pg} at ${w}px (dark=${dark})`);
      }
    }
  }
  noErrors(app);
  await app.ctx.close();
});

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok);
console.log(`\ne2e-browser: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { positiveMoney, nonNegativeMoney, validPercent, validateInvoice } from '../src/core/validation.js';
import { migrateData, CURRENT_SCHEMA_VERSION } from '../src/core/migrations.js';
import { invoiceSubtotal, invoiceTotal, invoiceRemaining } from '../src/modules/invoices.js';
import { calculateStockDifference } from '../src/modules/inventory.js';
import { productProfit } from '../src/reports/inventory-profit.js';
import { compareRecords } from '../src/sync/conflict-resolution.js';
assert.equal(positiveMoney('۱۲۳'),123); assert.equal(nonNegativeMoney('0'),0); assert.equal(validPercent(100),100); assert.throws(()=>positiveMoney('-1'));
const inv={items:[{qty:2,price:100},{qty:1,price:50}],discount:20,discountPercent:10,taxRate:10,paid:50};assert.equal(invoiceSubtotal(inv),250);assert.equal(invoiceTotal(inv),228);assert.equal(invoiceRemaining(inv),178);
assert.throws(()=>validateInvoice({...inv,paid:999}));
const migrated=migrateData({schemaVersion:1,accounts:null});assert.equal(migrated.schemaVersion,CURRENT_SCHEMA_VERSION);assert.deepEqual(migrated.accounts,[]);
const diff=calculateStockDifference({items:[{productId:'p',qty:5}]},{items:[{productId:'p',qty:7}]});assert.equal(diff.get('p'),-2);
assert.equal(productProfit([{items:[{productId:'p',qty:2,price:100,costPriceAtSale:60}]}])[0].profit,80);
assert.equal(compareRecords({revision:2,updatedAt:'2026-01-01',deviceId:'a'},{revision:1}),1);

// One release label everywhere.
const V = 'pro1.1';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
// Transaction display order must be date-descending, not insertion-order.
const appSource = read('app.js');
assert.match(appSource, /function transactionDateMs\(/);
assert.match(appSource, /transactionsByDateDesc\(data\.transactions\)\.slice\(0,6\)/);
assert.match(appSource, /transactionsByDateDesc\(data\.transactions\.filter/);
assert.match(read('app.js'), new RegExp(`APP_VERSION="${V}"`));
assert.match(read('index.html'), new RegExp(`id="versionPill">${V}<`));
assert.match(read('index.html'), new RegExp(`id="appVersionText">${V}<`));
assert.match(read('sw.js'), new RegExp(`hesabdar-${V}-offline`));
assert.match(read('src/core/storage-runtime.js'), new RegExp(`APP_VERSION = '${V}'`));
assert.match(read('src/core/state.js'), new RegExp(`APP_VERSION='${V}'`));
assert.equal(JSON.parse(read('manifest.json')).version, V);
assert.match(JSON.parse(read('package.json')).version, new RegExp(`-${V}$`));
assert.equal(JSON.parse(read('package-lock.json')).version, JSON.parse(read('package.json')).version);
assert.match(read('src/security/backup-crypto.js'), /appVersion='pro1.1'/);
assert.doesNotMatch(read('BUILD-STATUS.md'), /\bt1\b/);
console.log('tests: PASS (core financial/security/migration/conflict suite + version consistency)');

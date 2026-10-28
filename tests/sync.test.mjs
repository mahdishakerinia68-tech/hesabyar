// pro1.12: تست همگام‌سازی تلگرام — دو «گوشی» (vm جدا) + Worker واقعی با KV شبیه‌سازی‌شده
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import worker from '../server/worker.js';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const grab = (from, to) => { const a = app.indexOf(from); const b = app.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return app.slice(a, b); };

// ---- KV mock
function makeKV() {
  const m = new Map();
  return {
    async get(k, t) { const e = m.get(k); if (!e) return null; return t === 'json' ? JSON.parse(e) : e; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { keys: [...m.keys()].filter(x => x.startsWith(prefix)).map(name => ({ name })) }; },
    _m: m,
  };
}
const env = { DB: makeKV(), ADMIN_ID: '111', ADMIN_KEY: 'k', BOT_TOKEN: 't', WEBHOOK_SECRET: 's', ALLOWED_ORIGIN: 'https://x.github.io' };
await env.DB.put('user:111', JSON.stringify({ id: '111', name: 'Mahdi', username: '', status: 'approved', created: 1 }));
const SERVER = 'https://sync.test.workers.dev';
const workerFetch = (url, init) => worker.fetch(new Request(url, init), env);

// ---- one "phone"
function makePhone(name) {
  const store = new Map();
  const ctx = {
    console, crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, Date, JSON, Math, Map, Set, Promise, URL, AbortController,
    setTimeout, clearTimeout, setInterval, clearInterval, Uint8Array,
    navigator: { onLine: true, userAgent: 'Android' },
    document: { hidden: false, activeElement: null, addEventListener() {} },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch: (url, init) => workerFetch(url, init),
    alert() {}, $: () => null, fa: n => String(n), toEnDigits: s => String(s), uid: () => 'u' + Math.random().toString(36).slice(2),
    render() {}, persistLocal() {}, logEvent() {}, DEVICE_ID_KEY: 'dev-id', setSyncStatus(t) { ctx.status = t; },
    syncAllNotesToReminders: async () => {}, syncAllPeopleToReminders: async () => {}, rescheduleAllNativeReminders: async () => {},
    status: '',
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const code = [
    'const SYNC_STATE_KEY="hesabdar-tgsync-v1";const SYNC_PASS_KEY="hesabdar-tgsync-pass-v1";const SYNC_POLL_MS=20000;const SYNC_PUSH_DELAY_MS=15000;',
    'let sync={user:null,ready:false,busy:false,rerun:false,hydrating:false,saving:false,timer:null,pushTimer:null,listeners:false,version:0,lastErrorCode:"",dirty:new Map()};',
    'let data={accounts:[],transactions:[],people:[],customers:[],products:[],reminders:[],notes:[],checks:[],invoices:[],expenseCats:[],incomeCats:[],audit:[],_sync:{tombstones:{}}};',
    'function bytesToB64(bytes){let s="";for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s)}',
    'function b64ToBytes(s){const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}',
    'function deviceId(){let id=localStorage.getItem(DEVICE_ID_KEY);if(!id){id=uid();localStorage.setItem(DEVICE_ID_KEY,id)}return id}',
    'function dataSummary(d){return "x"}',
    grab('function recordDocId', 'function dataSummary'),
    'function touch(r){r.revision=Math.max(0,Number(r.revision)||0)+1;r.updatedAt=new Date().toISOString();r.updatedBy=sync.user?.uid||deviceId();r.deviceId=deviceId();return r}',
    grab('function markDeleted', '\n'),
    grab('async function replaceCloudAfterRestore', 'async function importData'),
    'function addRec(type,rec){data[type].push(rec);touch(rec);markDirty(type,rec.id,false,rec,rec.updatedAt)}',
    'function delRec(type,id){const i=data[type].findIndex(r=>r.id===id);data[type].splice(i,1);markDeleted(type,id)}',
    'function editRec(type,id,patch){const r=data[type].find(x=>x.id===id);Object.assign(r,patch);touch(r);markDirty(type,id,false,r,r.updatedAt)}',
    'globalThis.api={sync,get data(){return data},set data(v){data=v},addRec,delRec,editRec,syncTick,hydrateSync,initSync,pushRest,pullRest,connectFromSettings,logoutSync,replaceCloudAfterRestore,syncState,SYNC_KEYS};',
  ].join('\n');
  vm.runInContext(code, ctx);
  ctx.api = vm.runInContext('globalThis.api', ctx);
  ctx.name = name;
  return ctx;
}
// markDeleted is defined on one app.js line; grab() with '\n' end returns just that line start..newline
const sleepless = async () => {};

async function pair(phone, code, pass) {
  // simulate the settings form values
  phone.$ = id => ({ settingsSyncServer: { value: SERVER }, settingsSyncCode: { value: code }, settingsSyncPass: { value: pass } }[id] || null);
  vm.runInContext('0', phone);
  await phone.api.connectFromSettings();
}
const rec = (id, extra = {}) => ({ id, ...extra });
const ids = (p, t) => Array.from(p.api.data[t], r => r.id).sort();

// ===== 1) pairing: bad code, then good code
const A = makePhone('A'), B = makePhone('B');
await env.DB.put('code:123456', '111');
await pair(A, '000000', 'password-1');
assert.equal(A.api.syncState().token || '', '', 'bad code must not connect');
await pair(A, '123456', 'password-1');
assert.ok(A.api.syncState().token, 'A connected');
assert.equal(A.api.syncState().tgId, '111');
assert.equal(await env.DB.get('code:123456'), null, 'code is single-use');

// ===== 2) A adds records, pushes; B pairs with same TG id and receives them
A.api.addRec('transactions', rec('t1', { amount: 100 }));
A.api.addRec('people', rec('p1', { name: 'Ali' }));
await A.api.syncTick();
await env.DB.put('code:222222', '111');
await pair(B, '222222', 'password-1');
assert.deepEqual(ids(B, 'transactions'), ['t1']);
assert.deepEqual(ids(B, 'people'), ['p1']);

// ===== 3) wrong sync password on second phone is rejected and phone is disconnected
const C = makePhone('C');
await env.DB.put('code:333333', '111');
await pair(C, '333333', 'WRONG-password');
assert.equal(C.api.syncState().token || '', '', 'wrong password disconnects');
assert.equal(C.api.sync.user, null);

// ===== 4) two-way: B adds, A receives (poll); A edits, B receives
B.api.addRec('transactions', rec('t2', { amount: 50 }));
await B.api.syncTick();
await A.api.syncTick();
assert.deepEqual(ids(A, 'transactions'), ['t1', 't2']);
await new Promise(r => setTimeout(r, 5));
A.api.editRec('transactions', 't1', { amount: 999 });
await A.api.syncTick();
await B.api.syncTick();
assert.equal(B.api.data.transactions.find(r => r.id === 't1').amount, 999);

// ===== 5) no ping-pong: idle ticks must not bump the server version
const metaV = async () => JSON.parse(await env.DB.get('meta:111')).version;
const v0 = await metaV();
for (let i = 0; i < 3; i++) { await A.api.syncTick(); await B.api.syncTick(); }
assert.equal(await metaV(), v0, 'idle ticks must not write');

// ===== 6) simultaneous changes (conflict 409) both survive, no duplicates
A.api.addRec('notes', rec('nA', { text: 'from A' }));
B.api.addRec('notes', rec('nB', { text: 'from B' }));
await A.api.syncTick();            // A wins the race
await B.api.syncTick();            // B gets 409, merges, re-pushes
await A.api.syncTick();
assert.deepEqual(ids(A, 'notes'), ['nA', 'nB']);
assert.deepEqual(ids(B, 'notes'), ['nA', 'nB']);

// ===== 7) deletion propagates and is not resurrected
A.api.delRec('transactions', 't2');
await A.api.syncTick();
await B.api.syncTick();
assert.deepEqual(ids(B, 'transactions'), ['t1']);
await B.api.syncTick(); await A.api.syncTick();
assert.deepEqual(ids(A, 'transactions'), ['t1']);

// ===== 8) offline: changes queue, nothing lost, flushes after reconnect
B.navigator.onLine = false;
B.api.addRec('people', rec('p2', { name: 'Offline' }));
await B.api.syncTick();
assert.ok(B.api.sync.dirty.size >= 1, 'queued while offline');
assert.match(B.status, /در انتظار ارسال/);
B.navigator.onLine = true;
await B.api.syncTick();
await A.api.syncTick();
assert.deepEqual(ids(A, 'people'), ['p1', 'p2']);

// ===== 9) restore-from-file on A replaces everything; B drops stale records
await new Promise(r => setTimeout(r, 5));
const restored = vm.runInContext('({accounts:[],transactions:[],people:[],customers:[],products:[],reminders:[],notes:[],checks:[],invoices:[],expenseCats:[],incomeCats:[],audit:[],_sync:{tombstones:{}}})', A);
restored.transactions.push({ id: 'r1', amount: 1, revision: 1, updatedAt: '2020-01-01T00:00:00.000Z' });
A.api.data = restored;
await A.api.replaceCloudAfterRestore();
await B.api.syncTick();
assert.deepEqual(ids(B, 'transactions'), ['r1']);
assert.deepEqual(ids(B, 'people'), []);
assert.deepEqual(ids(B, 'notes'), []);

// ===== 10) revoked device is cut off locally
for (const k of [...env.DB._m.keys()]) if (k.startsWith('dev:111:')) env.DB._m.delete(k);
await A.api.syncTick();
assert.equal(A.api.syncState().token || '', '');
assert.equal(A.api.sync.user, null);

// ===== 11) server never sees plaintext
const stored = await env.DB.get('data:111');
assert.ok(!/Offline|from A|Ali/.test(stored), 'blob must be encrypted');
console.log('sync tests: PASS (pairing, wrong password, two-way, conflict, delete, offline, restore epoch, revoke, encryption)');
process.exit(0);

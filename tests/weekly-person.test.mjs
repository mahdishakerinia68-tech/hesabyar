// pro1.13: بدهی‌ها/اقساط با هر قالب تاریخی باید در جدول هفتگی بیایند
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const names = ['div','jalaliToGregorian','toEnDigits','localDateFromInput','dueToDate','dueHasTime','personDueItemsOnDay'];
const ctx = { data: { people: [] }, money: (n) => String(n) };
vm.createContext(ctx);
vm.runInContext(names.map(grab).join('\n'), ctx);
const on = (y, m, d) => JSON.parse(vm.runInContext(`JSON.stringify(personDueItemsOnDay(new Date(${y},${m - 1},${d})))`, ctx));
ctx.data.people = [
  { id: 'a', name: 'الف', type: 'debt', amount: 100, paid: 0, due: '2026-09-26' },
  { id: 'b', name: 'ب', type: 'debt', amount: 100, paid: 0, due: '1405/07/04' },            // شمسی = 2026-09-26
  { id: 'c', name: 'ج', type: 'debt', amount: 100, paid: 0, due: '۱۴۰۵/۰۷/۰۴ 14:30' },      // ارقام فارسی + ساعت
  { id: 'd', name: 'د', type: 'credit', amount: 100, paid: 0, due: '2026-09-26T08:15:00' },
  { id: 'e', name: 'ه', type: 'debt', amount: 100, paid: 0, due: '2026-09-01', installments: { count: 2, frequency: 'monthly', items: [{ id: 'i1', amount: 50, due: '2026-09-26', paid: false }, { id: 'i2', amount: 50, due: '', paid: false }, { id: 'i3', amount: 5, due: '2026-09-26', paid: true }] } },
  { id: 'f', name: 'و', type: 'debt', amount: 100, paid: 100, due: '2026-09-26' }              // تسویه‌شده
];
const r = on(2026, 9, 26);
assert.deepEqual(r.map(x => x.id).sort(), ['a', 'b', 'c', 'd', 'e']);
assert.equal(r.find(x => x.id === 'c').date, '2026-09-26T14:30');
assert.equal(r.find(x => x.id === 'd').date, '2026-09-26T08:15');
assert.equal(r.find(x => x.id === 'a').date, null);
assert.equal(on(2026, 9, 1).map(x => x.id).join(), 'e'); // قسط بدون تاریخ از تاریخ کلی استفاده می‌کند
console.log('weekly-person tests: PASS');

// pro1.11: تکرار سالانه + محاسبه‌ی تکرار بدون لغزش (از روی تاریخ پایه)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function grab(name) {
  const re = new RegExp('function ' + name + '\\s*\\(');
  const i = app.search(re); assert.ok(i >= 0, name + ' not found');
  let j = app.indexOf('{', i), depth = 0, k = j;
  for (; k < app.length; k++) { const c = app[k]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return app.slice(i, k + 1);
}
const names = ['addMonthsSafe', 'repeatStepDate', 'repeatLabelFa', 'localDateFromInput', 'nextReminderDate', 'lastOccurrenceDue', 'repeatDayMatch', 'noteOccursOnDay', 'reminderOccursOnDay', 'repeatSchedule', 'noteRepeatLabel'];
const ctx = vm.createContext({});
vm.runInContext(names.map(grab).join('\n') + '\nthis.f={addMonthsSafe,repeatStepDate,repeatLabelFa,localDateFromInput,nextReminderDate,lastOccurrenceDue,noteOccursOnDay,reminderOccursOnDay,repeatSchedule,noteRepeatLabel};', ctx);
const f = ctx.f;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 1) سالانه
const r = { date: '2026-03-10T09:00', repeat: 'yearly' };
assert.equal(ymd(f.nextReminderDate(r, new Date(2026, 5, 1))), '2027-03-10');
assert.equal(ymd(f.nextReminderDate(r, new Date(2027, 2, 10, 9, 0, 1))), '2028-03-10');
assert.equal(ymd(f.nextReminderDate({ date: '2026-03-10T09:00', repeat: 'yearly' }, new Date(2020, 0, 1))), '2026-03-10');
assert.equal(ymd(f.lastOccurrenceDue(r, new Date(2028, 5, 1))), '2028-03-10');
assert.deepEqual(JSON.parse(JSON.stringify(f.repeatSchedule('yearly'))), { repeats: true, every: 'year' });
assert.equal(f.noteRepeatLabel('yearly'), 'سالانه'); assert.equal(f.repeatLabelFa('yearly'), 'سالانه');
assert.equal(f.repeatLabelFa('daily'), 'روزانه'); assert.equal(f.repeatLabelFa('once'), 'یک‌بار');

// 2) ۲۹ فوریه: در سال کبیسه برمی‌گردد (لغزش نداشته باشد)
const leap = { date: '2028-02-29T08:00', repeat: 'yearly' };
assert.equal(ymd(f.nextReminderDate(leap, new Date(2028, 2, 5))), '2029-02-28');
assert.equal(ymd(f.nextReminderDate(leap, new Date(2030, 0, 1))), '2030-02-28');
assert.equal(ymd(f.nextReminderDate(leap, new Date(2031, 5, 1))), '2032-02-29');

// 3) ماهانه: ۳۱ ام از ماه کوتاه به ۳۱ ماه بعد برمی‌گردد
const m31 = { date: '2026-01-31T10:00', repeat: 'monthly' };
assert.equal(ymd(f.nextReminderDate(m31, new Date(2026, 1, 1))), '2026-02-28');
assert.equal(ymd(f.nextReminderDate(m31, new Date(2026, 2, 1))), '2026-03-31');
assert.equal(ymd(f.nextReminderDate(m31, new Date(2026, 3, 1))), '2026-04-30');
assert.equal(ymd(f.lastOccurrenceDue(m31, new Date(2026, 4, 15))), '2026-04-30');

// 4) هفتگی/روزانه/یک‌بار و مقدار ناشناخته
assert.equal(ymd(f.nextReminderDate({ date: '2026-03-10T09:00', repeat: 'weekly' }, new Date(2026, 2, 11))), '2026-03-17');
assert.equal(ymd(f.nextReminderDate({ date: '2026-03-10T09:00', repeat: 'daily' }, new Date(2026, 2, 10, 10))), '2026-03-11');
assert.equal(f.nextReminderDate({ date: '2026-03-10T09:00', repeat: 'once' }, new Date(2026, 2, 11)), null);
assert.equal(f.nextReminderDate({ date: '2026-03-10T09:00', repeat: 'bogus' }, new Date(2026, 2, 11)), null);

// 5) جدول هفتگی: سالانه فقط همان ماه و روز؛ ماهانه روی آخر ماه
const day = (y, m, d) => new Date(y, m - 1, d);
assert.equal(f.reminderOccursOnDay(r, day(2029, 3, 10)), true);
assert.equal(f.reminderOccursOnDay(r, day(2029, 4, 10)), false);
assert.equal(f.reminderOccursOnDay(r, day(2025, 3, 10)), false);
assert.equal(f.noteOccursOnDay({ date: '2026-03-10T09:00', repeat: 'yearly' }, day(2027, 3, 10)), true);
assert.equal(f.noteOccursOnDay({ date: '2026-03-10T09:00', repeat: 'yearly' }, day(2027, 3, 11)), false);
assert.equal(f.reminderOccursOnDay(m31, day(2026, 2, 28)), true);
assert.equal(f.reminderOccursOnDay(m31, day(2026, 2, 27)), false);
assert.equal(f.reminderOccursOnDay(leap, day(2029, 2, 28)), true);

// 6) گزینه‌ی «سالانه» در هر دو فرم و همه‌ی برچسب‌ها
assert.match(app, /<option value="yearly" \$\{r\?\.repeat==="yearly"\?"selected":""\}>سالانه<\/option>/);
assert.match(app, /<option value="yearly" \$\{n\?\.repeat==="yearly"\?"selected":""\}>سالانه<\/option>/);
console.log('repeat tests: PASS (سالانه / ماهانه / هفتگی، بدون لغزش تاریخ)');

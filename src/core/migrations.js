export const CURRENT_SCHEMA_VERSION = 5;
const ARRAYS = ['accounts','transactions','invoices','customers','products','people','checks','notes','reminders','audit','attachments','trash','expenseCats','incomeCats'];
export function blankData() { return { schemaVersion: CURRENT_SCHEMA_VERSION, accounts: [], transactions: [], invoices: [], customers: [], products: [], people: [], checks: [], notes: [], reminders: [], audit: [], attachments: [], trash: [], expenseCats: [], incomeCats: [], _sync: { tombstones: {} }, v4: { version: 1, budgets: [], goals: [], savings: [], assets: [], shared: [], events: [] } }; }
export function migrateV1ToV2(data) { const d = data; d.attachments ??= []; return d; }
export function migrateV2ToV3(data) { const d = data; d._sync ??= { tombstones: {} }; d._sync.tombstones ??= {}; return d; }
export function migrateV3ToV4(data) { const d = data; d.schemaVersion = 4; return d; }
export const V4_SECTIONS = ['budgets','goals','savings','assets','shared','events'];
export function migrateV4ToV5(data) { const d = data; if (!d.v4 || typeof d.v4 !== 'object' || Array.isArray(d.v4)) d.v4 = {}; d.v4.version ??= 1; for (const k of V4_SECTIONS) if (!Array.isArray(d.v4[k])) d.v4[k] = []; d.schemaVersion = 5; return d; }
export function migrateData(input) {
  let data = structuredClone(input || blankData());
  let version = Number(data.schemaVersion || 1);
  if (version < 2) data = migrateV1ToV2(data);
  if (version < 3) data = migrateV2ToV3(data);
  if (version < 4) data = migrateV3ToV4(data);
  if (version < 5) data = migrateV4ToV5(data);
  for (const key of ARRAYS) if (!Array.isArray(data[key])) data[key] = [];
  data._sync ??= { tombstones: {} }; data._sync.tombstones ??= {};
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

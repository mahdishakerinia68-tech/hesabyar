export const CURRENT_SCHEMA_VERSION = 4;
const ARRAYS = ['accounts','transactions','invoices','customers','products','people','checks','notes','reminders','audit','attachments','trash','expenseCats','incomeCats'];
export function blankData() { return { schemaVersion: CURRENT_SCHEMA_VERSION, accounts: [], transactions: [], invoices: [], customers: [], products: [], people: [], checks: [], notes: [], reminders: [], audit: [], attachments: [], trash: [], expenseCats: [], incomeCats: [], _sync: { tombstones: {} } }; }
export function migrateV1ToV2(data) { const d = data; d.attachments ??= []; return d; }
export function migrateV2ToV3(data) { const d = data; d._sync ??= { tombstones: {} }; d._sync.tombstones ??= {}; return d; }
export function migrateV3ToV4(data) { const d = data; d.schemaVersion = 4; return d; }
export function migrateData(input) {
  let data = structuredClone(input || blankData());
  let version = Number(data.schemaVersion || 1);
  if (version < 2) data = migrateV1ToV2(data);
  if (version < 3) data = migrateV2ToV3(data);
  if (version < 4) data = migrateV3ToV4(data);
  for (const key of ARRAYS) if (!Array.isArray(data[key])) data[key] = [];
  data._sync ??= { tombstones: {} }; data._sync.tombstones ??= {};
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Files that must never be part of a release folder.
const forbiddenNames = new Set(['app.js.bak', '.env']);
const forbiddenExt = /\.(zip|apk|aab|keystore|jks)$/i;
const forbidden = [/sk-[A-Za-z0-9_-]{12,}/, new RegExp('ANTH' + 'ROPIC_KEY_STORAGE')];

function walk(dir) {
  let out = [];
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.git'].includes(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out = out.concat(walk(p)); else out.push(p);
  }
  return out;
}

const files = walk('.');
for (const f of files) {
  const base = f.split('/').pop();
  if (forbiddenNames.has(base) || forbiddenExt.test(base)) throw new Error(`forbidden release file: ${f}`);
  if (!/\.(js|html|json|mjs|ts|css|md|yml)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  for (const re of forbidden) if (re.test(s)) throw new Error(`security check failed: ${re} in ${f}`);
}
// Main data lives in IndexedDB. The only allowed write of the whole data object to localStorage is the
// last-resort fallback used when IndexedDB itself is unavailable (guarded by storageMode).
const app = readFileSync('app.js', 'utf8');
const writes = app.split('\n').filter(l => /localStorage\.setItem\(KEY\b/.test(l));
if (writes.length > 1 || (writes.length === 1 && !/storageMode/.test(app.slice(app.indexOf(writes[0]) - 200, app.indexOf(writes[0]))))) {
  throw new Error('security check failed: app data must not be written to localStorage outside the IndexedDB-unavailable fallback');
}
console.log('security-check: PASS');

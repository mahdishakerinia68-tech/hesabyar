import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenNames = new Set([
  'app.js.bak',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development'
]);
const forbiddenExt = /\.(zip|apk|aab|keystore|jks|bak)$/i;
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/i,
  /\banthropic(?:[_-]?(?:api|secret)[_-]?key)?\b/i,
  /\bANTHROPIC_API_KEY\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
  /\b(?:client_secret|private_key|service_account|access_token|refresh_token)\s*[:=]/i
];
const textExt = /\.(js|html|json|mjs|ts|css|md|yml|yaml|rules|txt)$/i;

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.git', 'android'].includes(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk('.');
for (const file of files) {
  const base = file.split(/[\\/]/).pop();
  if (forbiddenNames.has(base) || forbiddenExt.test(base)) {
    throw new Error(`forbidden release file: ${file}`);
  }
  if (!textExt.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) throw new Error(`security check failed: suspicious secret pattern ${pattern} in ${file}`);
  }
}

// Application data must only be written to localStorage inside the explicit
// IndexedDB-unavailable fallback. Small UI/config values are allowed in localStorage.
const app = readFileSync('app.js', 'utf8');
const dataWrite = /localStorage\.setItem\(KEY\s*,/g;
const dataWrites = [...app.matchAll(dataWrite)];
if (dataWrites.length !== 1) throw new Error('security check failed: expected exactly one fallback localStorage data write');
const writePos = dataWrites[0].index;
const functionStart = app.lastIndexOf('function persistLocal', writePos);
const functionEnd = app.indexOf('\n}', writePos);
const context = app.slice(functionStart, functionEnd > writePos ? functionEnd : writePos + 300);
if (!/storageMode\s*===\s*"localStorage"/.test(context)) {
  throw new Error('security check failed: app data must not be written to localStorage outside the IndexedDB-unavailable fallback');
}

// Guard against new direct writes of the whole data object under another key.
if (/localStorage\.setItem\([^,]+,\s*JSON\.stringify\(data\)\)/.test(app.replace(dataWrite, ''))) {
  throw new Error('security check failed: direct whole-data localStorage write detected');
}

console.log(`security-check: PASS (${files.length} files scanned)`);

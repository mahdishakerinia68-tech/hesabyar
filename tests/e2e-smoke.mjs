// Fast static checks (no browser). The real behaviour is covered by tests/e2e-browser.mjs.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

assert.match(index, /sw\.js\?v=pro1\.1/);
assert.doesNotMatch(index, /maximum-scale=1/);
assert.match(sw, /hesabdar-pro1\.1-offline-v\d+/);
assert.match(app, /APP_VERSION="pro1.1"/);
assert.doesNotMatch(app, /saveAnthropicKey|clearAnthropicKey/);

// Every local script/style referenced by index.html must be pre-cached so the app starts offline.
const assets = [...sw.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]);
const referenced = [
  ...[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]),
  ...[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1])
].filter(u => !/^https?:/.test(u));
for (const file of referenced) {
  assert.ok(existsSync(file), `index.html references a missing file: ${file}`);
  assert.ok(assets.includes(file), `sw.js does not pre-cache ${file}`);
}
for (const icon of manifest.icons) assert.ok(existsSync(icon.src), `manifest icon missing: ${icon.src}`);
assert.match(index, /<html lang="fa" dir="rtl">/);
assert.match(index, /viewport-fit=cover/);
console.log('e2e-smoke: PASS (static PWA/security/startup checks)');

// HesabYar Sync — Cloudflare Worker (single file)
// Bindings:  KV namespace  -> DB
// Secrets:   BOT_TOKEN, ADMIN_KEY, WEBHOOK_SECRET
// Variables: ADMIN_ID (your numeric Telegram id), ALLOWED_ORIGIN (comma separated),
//            MAX_DEVICES (optional, default 5)

const MAX_BLOB = 5 * 1024 * 1024; // 5 MB of encrypted backup text

export default {
  async fetch(req, env) {
    try {
      return await route(req, env);
    } catch (e) {
      return json({ error: 'server_error' }, 500, req, env);
    }
  },
};

/* ---------- helpers ---------- */

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, req, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      corsHeaders(req, env)
    ),
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = '';
  a.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function tg(env, method, body) {
  const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}

function say(env, chatId, text, extra) {
  return tg(env, 'sendMessage', Object.assign({ chat_id: chatId, text: text, parse_mode: 'HTML' }, extra || {}));
}

/* ---------- routing ---------- */

async function route(req, env) {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;

  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });

  if (p === '/tg' && m === 'POST') return telegram(req, env);

  if (p === '/api/pair' && m === 'POST') return pair(req, env);
  if (p === '/api/meta' && m === 'GET') return getMeta(req, env);
  if (p === '/api/sync' && m === 'GET') return getSync(req, env);
  if (p === '/api/sync' && m === 'PUT') return putSync(req, env);
  if (p === '/api/logout' && m === 'POST') return logout(req, env);

  if (p === '/admin' && m === 'GET') {
    return new Response(ADMIN_HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }
  if (p.startsWith('/admin/api/')) return admin(req, env, url);

  if (p === '/') return new Response('HesabYar Sync is running');
  return json({ error: 'not_found' }, 404, req, env);
}

/* ---------- telegram bot ---------- */

async function telegram(req, env) {
  if (!safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.WEBHOOK_SECRET)) {
    return new Response('forbidden', { status: 403 });
  }
  const upd = await req.json();
  if (upd.callback_query) await onCallback(upd.callback_query, env);
  else if (upd.message) await onMessage(upd.message, env);
  return new Response('ok');
}

async function onMessage(msg, env) {
  if (!msg.chat || msg.chat.type !== 'private' || !msg.from) return;
  const id = String(msg.from.id);
  const text = String(msg.text || '').trim();
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || id;

  let user = await env.DB.get('user:' + id, 'json');
  if (!user) {
    user = {
      id: id,
      name: name,
      username: msg.from.username || '',
      status: id === String(env.ADMIN_ID) ? 'approved' : 'pending',
      created: Date.now(),
    };
    await env.DB.put('user:' + id, JSON.stringify(user));
    if (user.status === 'pending' && env.ADMIN_ID) {
      await say(
        env,
        env.ADMIN_ID,
        'درخواست دسترسی جدید\n<b>' + esc(name) + '</b>' + (user.username ? ' (@' + esc(user.username) + ')' : '') + '\nشناسه: <code>' + id + '</code>',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ تایید', callback_data: 'ok:' + id },
              { text: '⛔ رد', callback_data: 'no:' + id },
            ]],
          },
        }
      );
    }
  }

  if (user.status === 'blocked') return say(env, id, 'دسترسی شما مسدود است.');
  if (user.status === 'pending') return say(env, id, 'درخواست شما برای مدیر ارسال شد. بعد از تایید، دوباره /start بزنید.');

  if (cmd === '/devices') {
    const list = await listDevices(env, id);
    if (!list.length) return say(env, id, 'هنوز هیچ گوشی‌ای وصل نشده است.');
    const lines = list.map((d, i) => i + 1 + '. ' + esc(d.name) + ' — ' + new Date(d.created).toISOString().slice(0, 10));
    return say(env, id, '<b>گوشی‌های متصل</b>\n' + lines.join('\n') + '\n\nبرای قطع دسترسی: /revoke شماره');
  }

  if (cmd === '/revoke') {
    const n = parseInt(text.split(/\s+/)[1], 10);
    const list = await listDevices(env, id);
    if (!n || n < 1 || n > list.length) return say(env, id, 'شماره درست نیست. اول /devices را بزنید.');
    await env.DB.delete('dev:' + id + ':' + list[n - 1].h);
    return say(env, id, 'دسترسی گوشی «' + esc(list[n - 1].name) + '» قطع شد.');
  }

  // /start, /code and anything else -> new pairing code
  const code = await newCode(env, id);
  return say(
    env,
    id,
    'کد اتصال شما: <code>' + code + '</code>\nاین کد ۵ دقیقه اعتبار دارد و فقط یک‌بار قابل استفاده است. آن را در حساب‌یار ← تنظیمات ← همگام‌سازی وارد کنید.\n\n/devices — گوشی‌های متصل\n/code — کد جدید'
  );
}

async function onCallback(cb, env) {
  if (String(cb.from.id) !== String(env.ADMIN_ID)) {
    return tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'اجازه ندارید' });
  }
  const parts = String(cb.data || '').split(':');
  const id = parts[1];
  const user = await env.DB.get('user:' + id, 'json');
  if (!user) return tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'کاربر پیدا نشد' });
  user.status = parts[0] === 'ok' ? 'approved' : 'blocked';
  await env.DB.put('user:' + id, JSON.stringify(user));
  await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id });
  if (cb.message) {
    await tg(env, 'editMessageText', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: (user.status === 'approved' ? '✅ تایید شد: ' : '⛔ رد شد: ') + user.name + ' (' + id + ')',
    });
  }
  await say(env, id, user.status === 'approved' ? 'دسترسی شما تایید شد. برای گرفتن کد اتصال /start را بزنید.' : 'درخواست شما رد شد.');
}

async function newCode(env, id) {
  for (let i = 0; i < 5; i++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const code = String(n).padStart(6, '0');
    if (!(await env.DB.get('code:' + code))) {
      await env.DB.put('code:' + code, id, { expirationTtl: 300 });
      return code;
    }
  }
  throw new Error('code');
}

async function listDevices(env, id) {
  const res = await env.DB.list({ prefix: 'dev:' + id + ':' });
  const out = [];
  for (const k of res.keys) {
    const v = await env.DB.get(k.name, 'json');
    if (v) out.push({ h: k.name.split(':')[2], name: v.name, created: v.created });
  }
  return out.sort((a, b) => a.created - b.created);
}

/* ---------- device API ---------- */

async function authDevice(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (\d+)\.([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const id = m[1];
  const h = await sha256(m[2]);
  const dev = await env.DB.get('dev:' + id + ':' + h, 'json');
  if (!dev) return null;
  const user = await env.DB.get('user:' + id, 'json');
  if (!user || user.status !== 'approved') return null;
  return { id: id, h: h, dev: dev, user: user };
}

async function pair(req, env) {
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  const rlKey = 'rl:' + ip;
  const tries = parseInt((await env.DB.get(rlKey)) || '0', 10);
  if (tries >= 8) return json({ error: 'too_many_attempts' }, 429, req, env);

  let body = {};
  try { body = await req.json(); } catch (e) {}
  const code = String(body.code || '').replace(/\D/g, '');
  const id = code.length === 6 ? await env.DB.get('code:' + code) : null;
  if (!id) {
    await env.DB.put(rlKey, String(tries + 1), { expirationTtl: 600 });
    return json({ error: 'bad_code' }, 400, req, env);
  }
  await env.DB.delete('code:' + code);

  const user = await env.DB.get('user:' + id, 'json');
  if (!user || user.status !== 'approved') return json({ error: 'not_allowed' }, 403, req, env);

  const max = parseInt(env.MAX_DEVICES || '5', 10);
  const devs = await env.DB.list({ prefix: 'dev:' + id + ':' });
  if (devs.keys.length >= max) return json({ error: 'device_limit' }, 403, req, env);

  const secret = randomToken(24);
  const h = await sha256(secret);
  const devName = String(body.deviceName || 'گوشی').slice(0, 40);
  await env.DB.put('dev:' + id + ':' + h, JSON.stringify({ name: devName, created: Date.now() }));
  return json({ token: id + '.' + secret, id: id, name: user.name }, 200, req, env);
}

async function getMeta(req, env) {
  const a = await authDevice(req, env);
  if (!a) return json({ error: 'unauthorized' }, 401, req, env);
  const meta = (await env.DB.get('meta:' + a.id, 'json')) || { version: 0, updatedAt: 0, size: 0 };
  return json(meta, 200, req, env);
}

async function getSync(req, env) {
  const a = await authDevice(req, env);
  if (!a) return json({ error: 'unauthorized' }, 401, req, env);
  const meta = (await env.DB.get('meta:' + a.id, 'json')) || { version: 0, updatedAt: 0, size: 0 };
  const blob = meta.version ? await env.DB.get('data:' + a.id) : null;
  return json({ version: meta.version, updatedAt: meta.updatedAt, blob: blob }, 200, req, env);
}

async function putSync(req, env) {
  const a = await authDevice(req, env);
  if (!a) return json({ error: 'unauthorized' }, 401, req, env);

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400, req, env); }
  if (typeof body.blob !== 'string' || !body.blob) return json({ error: 'bad_blob' }, 400, req, env);
  if (body.blob.length > MAX_BLOB) return json({ error: 'too_large' }, 413, req, env);

  const meta = (await env.DB.get('meta:' + a.id, 'json')) || { version: 0, updatedAt: 0, size: 0 };
  if (Number(body.baseVersion || 0) !== meta.version) {
    // another phone pushed first: send its copy so this phone can merge and retry
    const blob = meta.version ? await env.DB.get('data:' + a.id) : null;
    return json({ error: 'conflict', version: meta.version, updatedAt: meta.updatedAt, blob: blob }, 409, req, env);
  }

  const next = { version: meta.version + 1, updatedAt: Date.now(), size: body.blob.length, device: a.dev.name };
  await env.DB.put('data:' + a.id, body.blob);
  await env.DB.put('meta:' + a.id, JSON.stringify(next));
  return json({ version: next.version, updatedAt: next.updatedAt }, 200, req, env);
}

async function logout(req, env) {
  const a = await authDevice(req, env);
  if (!a) return json({ ok: true }, 200, req, env);
  await env.DB.delete('dev:' + a.id + ':' + a.h);
  return json({ ok: true }, 200, req, env);
}

/* ---------- admin API ---------- */

async function admin(req, env, url) {
  const ok = env.ADMIN_KEY && safeEqual(req.headers.get('X-Admin-Key'), env.ADMIN_KEY);
  const reply = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  if (!ok) return reply({ error: 'unauthorized' }, 401);

  const parts = url.pathname.replace('/admin/api/', '').split('/');
  const m = req.method;

  if (parts[0] === 'users' && m === 'GET') {
    const res = await env.DB.list({ prefix: 'user:' });
    const users = [];
    for (const k of res.keys) {
      const u = await env.DB.get(k.name, 'json');
      if (!u) continue;
      const devs = await env.DB.list({ prefix: 'dev:' + u.id + ':' });
      u.devices = devs.keys.length;
      u.meta = await env.DB.get('meta:' + u.id, 'json');
      users.push(u);
    }
    users.sort((a, b) => b.created - a.created);
    return reply({ users: users });
  }

  if (parts[0] === 'setup' && m === 'POST') {
    const hook = await tg(env, 'setWebhook', {
      url: url.origin + '/tg',
      secret_token: env.WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    await tg(env, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'گرفتن کد اتصال' },
        { command: 'devices', description: 'گوشی‌های متصل' },
        { command: 'revoke', description: 'قطع دسترسی یک گوشی' },
      ],
    });
    const info = await tg(env, 'getWebhookInfo');
    return reply({ set: hook.ok === true, description: hook.description || '', url: info.result && info.result.url });
  }

  if (parts[0] === 'user' && /^\d+$/.test(parts[1] || '')) {
    const id = parts[1];
    const user = await env.DB.get('user:' + id, 'json');
    if (!user) return reply({ error: 'not_found' }, 404);

    if (parts[2] === 'devices' && m === 'GET') return reply({ devices: await listDevices(env, id) });

    if (parts[2] === 'status' && m === 'POST') {
      const body = await req.json();
      if (body.status !== 'approved' && body.status !== 'blocked') return reply({ error: 'bad_status' }, 400);
      user.status = body.status;
      await env.DB.put('user:' + id, JSON.stringify(user));
      if (body.status === 'blocked') await wipeDevices(env, id);
      return reply({ ok: true });
    }

    if (parts[2] === 'revoke' && m === 'POST') {
      const body = await req.json();
      if (!/^[a-f0-9]{64}$/.test(String(body.h || ''))) return reply({ error: 'bad_device' }, 400);
      await env.DB.delete('dev:' + id + ':' + body.h);
      return reply({ ok: true });
    }

    if (parts[2] === 'data' && m === 'DELETE') {
      await env.DB.delete('data:' + id);
      await env.DB.delete('meta:' + id);
      return reply({ ok: true });
    }

    if (parts.length === 2 && m === 'DELETE') {
      await wipeDevices(env, id);
      await env.DB.delete('data:' + id);
      await env.DB.delete('meta:' + id);
      await env.DB.delete('user:' + id);
      return reply({ ok: true });
    }
  }

  return reply({ error: 'not_found' }, 404);
}

async function wipeDevices(env, id) {
  const devs = await env.DB.list({ prefix: 'dev:' + id + ':' });
  for (const k of devs.keys) await env.DB.delete(k.name);
}

/* ---------- admin panel page ---------- */
// NOTE: the page script below must not contain backticks, dollar-brace or backslashes.

const ADMIN_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>پنل حساب‌یار</title>
<style>
:root{--bg:#0B1418;--panel:#12201f;--line:#1f3532;--tx:#e6f0ee;--mut:#86a29d;--ok:#46d19b;--warn:#f0b64a;--bad:#ee6a5f;--ac:#38c4b0}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;color:var(--tx);font:15px/1.7 Tahoma,"Segoe UI",system-ui,sans-serif;padding:16px;max-width:880px;margin-inline:auto}
h1{font-size:20px;margin:6px 0 2px}
.sub{color:var(--mut);margin:0 0 18px;font-size:13px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
button,input{font:inherit;color:var(--tx);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 12px}
button{cursor:pointer}
button:hover{border-color:var(--ac)}
button:focus-visible,input:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
button.primary{background:var(--ac);color:#06201c;border-color:var(--ac);font-weight:700}
button.danger{color:var(--bad)}
input{width:100%}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.stat b{display:block;font-size:22px}
.stat span{color:var(--mut);font-size:12px}
.user{border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--panel)}
.row{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.name{font-weight:700}
.meta{color:var(--mut);font-size:12px;direction:ltr;text-align:right}
.info{color:var(--mut);font-size:13px;margin:6px 0}
.badge{font-size:12px;padding:1px 9px;border-radius:99px;border:1px solid}
.approved{color:var(--ok)}.pending{color:var(--warn)}.blocked{color:var(--bad)}
.acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.acts button{padding:5px 10px;font-size:13px}
.devs{margin-top:8px;border-top:1px dashed var(--line);padding-top:8px}
.dev{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0;font-size:13px}
#msg{min-height:22px;color:var(--mut);font-size:13px;margin-bottom:8px}
.login{max-width:360px;margin:40px auto}
.hide{display:none}
</style>
</head>
<body>
<div id="login" class="login">
  <h1>پنل حساب‌یار</h1>
  <p class="sub">کلید مدیر را وارد کنید.</p>
  <input id="key" type="password" autocomplete="off" placeholder="ADMIN_KEY">
  <div class="bar" style="margin-top:10px"><button class="primary" id="enter">ورود</button></div>
  <div id="lmsg" class="sub"></div>
</div>
<div id="app" class="hide">
  <h1>پنل حساب‌یار</h1>
  <p class="sub">مدیریت کاربران و گوشی‌های همگام‌شده</p>
  <div class="bar">
    <button id="refresh">به‌روزرسانی</button>
    <button id="hook">اتصال ربات (Webhook)</button>
    <button id="out">خروج</button>
  </div>
  <div id="msg"></div>
  <div class="stats" id="stats"></div>
  <div id="list"></div>
</div>
<script>
var KEY = sessionStorage.getItem('hk') || '';
function $(i){return document.getElementById(i)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
function say(t){$('msg').textContent=t||''}
function fmtSize(n){if(!n)return '0';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
function fmtDate(t){return t?new Date(t).toLocaleString('fa-IR'):'—'}
function api(path,method,body){
  return fetch('/admin/api/'+path,{method:method||'GET',headers:{'X-Admin-Key':KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
  .then(function(r){if(r.status===401){logout();throw new Error('unauthorized')}return r.json()});
}
function logout(){KEY='';sessionStorage.removeItem('hk');$('app').classList.add('hide');$('login').classList.remove('hide')}
function enter(){
  KEY=$('key').value.trim();
  if(!KEY)return;
  api('users').then(function(d){
    sessionStorage.setItem('hk',KEY);
    $('login').classList.add('hide');$('app').classList.remove('hide');render(d.users||[]);
  }).catch(function(){$('lmsg').textContent='کلید درست نیست.'});
}
function load(){say('در حال دریافت…');api('users').then(function(d){say('');render(d.users||[])}).catch(function(){say('خطا در دریافت اطلاعات.')})}
var LABEL={approved:'تایید‌شده',pending:'در انتظار',blocked:'مسدود'};
function stat(label,val){var s=el('div','stat');s.appendChild(el('b','',String(val)));s.appendChild(el('span','',label));return s}
function render(users){
  var st=$('stats');st.textContent='';
  var total=0,ap=0,pe=0,dv=0;
  users.forEach(function(u){if(u.status==='approved')ap++;if(u.status==='pending')pe++;dv+=u.devices||0;total+=(u.meta&&u.meta.size)||0});
  st.appendChild(stat('کاربر تایید‌شده',ap));st.appendChild(stat('در انتظار تایید',pe));st.appendChild(stat('گوشی متصل',dv));st.appendChild(stat('حجم داده',fmtSize(total)));
  var list=$('list');list.textContent='';
  if(!users.length){list.appendChild(el('p','sub','هنوز کسی به ربات پیام نداده است. از تلگرام به ربات /start بفرستید.'));return}
  users.forEach(function(u){list.appendChild(card(u))});
}
function btn(text,cls,fn){var b=el('button',cls||'',text);b.addEventListener('click',fn);return b}
function card(u){
  var c=el('div','user');
  var r=el('div','row');
  var left=el('div');
  left.appendChild(el('span','name',u.name||u.id));
  left.appendChild(document.createTextNode(' '));
  left.appendChild(el('span','badge '+u.status,LABEL[u.status]||u.status));
  r.appendChild(left);
  r.appendChild(el('span','meta',u.id+(u.username?'  @'+u.username:'')));
  c.appendChild(r);
  var m=u.meta;
  c.appendChild(el('div','info','گوشی‌ها: '+(u.devices||0)+' | آخرین همگام‌سازی: '+(m?fmtDate(m.updatedAt)+(m.device?' ('+m.device+')':''):'—')+' | حجم: '+fmtSize(m&&m.size)+' | نسخه: '+(m?m.version:0)));
  var acts=el('div','acts');
  if(u.status!=='approved')acts.appendChild(btn('تایید','primary',function(){setStatus(u.id,'approved')}));
  if(u.status!=='blocked')acts.appendChild(btn('مسدود',null,function(){if(confirm('این کاربر مسدود و همه گوشی‌هایش قطع شوند؟'))setStatus(u.id,'blocked')}));
  var devBox=el('div','devs hide');
  acts.appendChild(btn('گوشی‌ها',null,function(){toggleDevs(u.id,devBox)}));
  acts.appendChild(btn('پاک‌کردن داده','danger',function(){if(confirm('داده همگام‌شده این کاربر از سرور پاک شود؟ (گوشی‌ها نگه‌داشته می‌شوند)'))call('user/'+u.id+'/data','DELETE')}));
  acts.appendChild(btn('حذف کاربر','danger',function(){if(confirm('کاربر، گوشی‌ها و داده‌اش کامل حذف شود؟'))call('user/'+u.id,'DELETE')}));
  c.appendChild(acts);c.appendChild(devBox);
  return c;
}
function call(path,method,body){api(path,method,body).then(function(){load()}).catch(function(){say('عملیات انجام نشد.')})}
function setStatus(id,s){call('user/'+id+'/status','POST',{status:s})}
function toggleDevs(id,box){
  if(!box.classList.contains('hide')){box.classList.add('hide');return}
  box.textContent='در حال دریافت…';box.classList.remove('hide');
  api('user/'+id+'/devices').then(function(d){
    box.textContent='';
    var list=d.devices||[];
    if(!list.length){box.appendChild(el('div','info','گوشی‌ای وصل نیست.'));return}
    list.forEach(function(x){
      var row=el('div','dev');
      row.appendChild(el('span','',x.name+' — '+fmtDate(x.created)));
      row.appendChild(btn('قطع دسترسی','danger',function(){if(confirm('دسترسی این گوشی قطع شود؟'))api('user/'+id+'/revoke','POST',{h:x.h}).then(function(){toggleDevs(id,box);toggleDevs(id,box);load()})}));
      box.appendChild(row);
    });
  });
}
$('enter').addEventListener('click',enter);
$('key').addEventListener('keydown',function(e){if(e.key==='Enter')enter()});
$('refresh').addEventListener('click',load);
$('out').addEventListener('click',logout);
$('hook').addEventListener('click',function(){
  say('در حال اتصال ربات…');
  api('setup','POST').then(function(d){say(d.set?'ربات وصل شد.':('خطا: '+(d.description||'نامشخص')))}).catch(function(){say('اتصال ربات انجام نشد.')});
});
if(KEY){api('users').then(function(d){$('login').classList.add('hide');$('app').classList.remove('hide');render(d.users||[])}).catch(function(){})}
</script>
</body>
</html>`;

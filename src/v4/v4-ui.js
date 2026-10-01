/* حساب‌یار V4 — راه‌اندازی رابط: صفحه‌ها، منوی «امکانات مالی»، کارت داشبورد، اتصال به render() */
(function (root) {
  'use strict';
  var V = root.V4, UI = root.V4UI, $ = function (id) { return document.getElementById(id); };
  var PAGES = [['budgets', '💰', 'بودجه'], ['goals', '🎯', 'اهداف مالی'], ['savings', '🐷', 'صندوق پس‌انداز'], ['assets', '🏦', 'دارایی‌ها'], ['shared', '🤝', 'هزینه‌ی هم‌خرج'], ['calendar', '📅', 'تقویم مالی']];
  UI.PAGES = PAGES;

  function mountPages() {
    var main = document.querySelector('main'); if (!main) return;
    PAGES.forEach(function (p) {
      if ($('v4-' + p[0])) return;
      var s = document.createElement('section'); s.id = 'v4-' + p[0]; s.className = 'page v4-page'; main.appendChild(s);
    });
  }
  function mountMenu() {
    var g = $('menuGroups'); if (!g || $('v4MenuGroup')) return;
    var grp = document.createElement('div'); grp.className = 'menu-group v4-menu-group'; grp.id = 'v4MenuGroup';
    grp.innerHTML = '<div class="menu-group-title">امکانات جامع مالی <span class="menu-group-arrow">▾</span></div><div class="menu-grid">' +
      PAGES.map(function (p) { return '<button class="nav" data-page="v4-' + p[0] + '" onclick="event.preventDefault();goToPage(\'v4-' + p[0] + '\',true)">' + p[1] + '<span>' + p[2] + '</span></button>'; }).join('') +
      '</div>';
    var other = g.querySelectorAll('.menu-group'); g.insertBefore(grp, other[other.length - 1] || null);
    grp.querySelector('.menu-group-title').addEventListener('click', function () { grp.classList.toggle('open'); });
  }
  function mountSettings() {
    var st = document.querySelector('#settings .settings-page'); if (!st) return;
    if (!$('v4SettingsCard')) {
      var c = document.createElement('div'); c.id = 'v4SettingsCard'; c.className = 'card v4-settings-card';
      c.innerHTML = '<b>🧰 امکانات جامع مالی در تنظیمات</b><p class="hint">خروجی Excel، پشتیبان‌گیری و امنیت اطلاعات از منوی امکانات جامع مالی به اینجا منتقل شده‌اند.</p>';
      st.appendChild(c);
    }
    if (root.V4Backup && root.V4Backup.mountSettings) root.V4Backup.mountSettings();
  }
  function mountDash() {
    var home = $('home'); if (!home) return;
    var el = $('v4Dash');
    if (!el) { el = document.createElement('div'); el.id = 'v4Dash'; el.className = 'v4-dash dash-widget'; el.dataset.widget = 'v4Financial'; var stats = home.querySelector('[data-widget="stats"]'); if (stats && stats.parentNode) stats.parentNode.insertBefore(el, stats.nextSibling); else home.appendChild(el); }
    return el;
  }
  UI.renderDash = function () {
    var el = mountDash(); if (!el || !V.getData()) return;
    var d = V.getData(), today = V.ymd(new Date().toISOString()), in7 = V.ymd(new Date(Date.now() + 7 * 86400000).toISOString());
    var checks = (d.checks || []).filter(function (c) { return !c.settled && c.date && V.ymd(c.date) <= in7; }), checkSum = checks.reduce(function (s, c) { return s + (Number(c.amount) || 0); }, 0);
    var bud = V.list('budgets').map(function (b) { return V.budgetInfo(b, d); }), budWarn = bud.filter(function (b) { return b.status !== 'ok'; }).length;
    var goals = V.list('goals').map(V.goalInfo), goalPct = goals.length ? Math.round(goals.reduce(function (s, g) { return s + g.pct; }, 0) / goals.length) : 0;
    var sav = V.list('savings').reduce(function (s, x) { return s + V.savingBalance(x); }, 0), assets = V.list('assets').reduce(function (s, a) { return s + (Number(a.value) || 0); }, 0);
    var owed = V.list('shared').reduce(function (s, x) { return s + V.sharedInfo(x).owedTotal; }, 0), evs = V.collectEvents(d).filter(function (e) { return e.status !== 'settled' && e.day >= today && e.day <= in7; }).length;
    var tile = function (page, icon, title, val, sub, warn) { return '<button type="button" class="v4-tile' + (warn ? ' warn' : '') + '" onclick="goToPage(\'v4-' + page + '\')"><span>' + icon + ' ' + title + '</span><b>' + val + '</b><small>' + sub + '</small></button>'; };
    el.innerHTML = '<div class="v4-dash-title">🧭 نمای مالی</div><div class="v4-tiles">' +
      tile('budgets', '💰', 'بودجه', V.fa(bud.length), budWarn ? V.fa(budWarn) + ' مورد نزدیک/بالای سقف' : 'همه در محدوده', budWarn) +
      tile('goals', '🎯', 'اهداف', V.fa(goals.length), goals.length ? 'میانگین پیشرفت ' + V.fa(goalPct) + '٪' : 'هدفی ثبت نشده') +
      tile('savings', '🐷', 'پس‌انداز', V.money(sav), V.fa(V.list('savings').length) + ' صندوق') +
      tile('assets', '🏦', 'دارایی‌ها', V.money(assets), V.fa(V.list('assets').length) + ' دارایی') +
      tile('shared', '🤝', 'هم‌خرج', V.money(owed), owed ? 'مانده‌ی تسویه‌نشده' : 'همه تسویه') +
      tile('calendar', '📅', 'تقویم مالی', V.fa(evs), evs ? 'رویداد تا ۷ روز آینده' : 'رویدادی نیست') + '</div>' +
      (checks.length ? '<div class="v4-alert">🧾 ' + V.fa(checks.length) + ' چک تا ۷ روز آینده سررسید دارد (' + V.money(checkSum) + ')</div>' : '');
  };

  var _render = root.render, rendering = false;
  function hook() {
    if (typeof root.render !== 'function' || root.render.__v4) return;
    _render = root.render;
    var wrapped = function () {
      _render.apply(this, arguments);
      if (rendering || !V.getData()) return; rendering = true;
      try {
        V.ensure(V.getData()); mountPages(); UI.mountChecks(); mountSettings();
        UI.PAGE_KEYS.forEach(function (k) { if (root.pageActive('v4-' + k)) UI.renderPage(k); });
        UI.renderDash();
      } catch (e) { console.error('V4 render', e); } finally { rendering = false; }
    };
    wrapped.__v4 = true; root.render = wrapped;
  }

  UI.init = function () {
    hook(); mountPages(); mountMenu();
    if (root.V4Security) root.V4Security.init();
    if (V.getData()) { V.ensure(V.getData()); try { root.V4Security.repairV4(V.getData()); } catch (e) { /* ignore */ } }
  };
  hook(); /* v4-ui.js بعد از app.js بارگذاری می‌شود؛ render() همین‌جا قلاب می‌شود تا رندر اول هم V4 را ببیند */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', UI.init); else UI.init();
})(typeof globalThis !== 'undefined' ? globalThis : this);

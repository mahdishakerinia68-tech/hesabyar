/* HesabYar storage runtime (pro2)
 *
 * The one and only persistence layer used by app.js. Loaded as a classic
 * <script> before app.js and exposed as globalThis.HesabYarStorage.
 *
 * Layout (IndexedDB "hesabdar-v4"):
 *   - one object store per record collection (accounts, transactions, ...)
 *   - meta/root          -> { schemaVersion, appVersion, savedAt }
 *   - meta/settings      -> every other top-level field of the app data
 *                           (lock hashes, language, branding, settlements ...)
 *   - syncMetadata/root  -> { value: data._sync }
 *
 * A save is ONE readwrite transaction (clear + put), so it is atomic: either
 * the whole snapshot is written or nothing changes.
 */
(function (root) {
  'use strict';

  var DB_NAME = 'hesabdar-v4';
  var DB_VERSION = 1;
  var APP_VERSION = 'pro1.1';
  var MAX_SNAPSHOT_BYTES = 9 * 1024 * 1024;
  var RECORD_STORES = [
    'accounts', 'transactions', 'invoices', 'customers', 'products', 'people',
    'checks', 'notes', 'reminders', 'audit', 'attachments', 'trash',
    'expenseCats', 'incomeCats'
  ];
  var STORES = RECORD_STORES.concat(['syncMetadata', 'meta']);
  var RESERVED_KEYS = RECORD_STORES.concat(['_sync', 'schemaVersion']);
  var dbPromise = null;

  function fallbackId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    if (!root.indexedDB) {
      return Promise.reject(new Error('IndexedDB در این دستگاه در دسترس نیست'));
    }
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = root.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = function () {
        var db = req.result;
        // Another tab upgraded/deleted the DB: drop our handle so the next call reopens it.
        db.onversionchange = function () { try { db.close(); } catch (e) { /* ignore */ } dbPromise = null; };
        db.onclose = function () { dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error('IndexedDB unavailable')); };
      req.onblocked = function () { /* an older tab holds the DB; the request completes once it closes */ };
    }).catch(function (err) { dbPromise = null; throw err; });
    return dbPromise;
  }

  function reqToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function getAll(db, store) {
    return reqToPromise(db.transaction(store).objectStore(store).getAll()).then(function (r) { return r || []; });
  }

  function getOne(db, store, id) {
    return reqToPromise(db.transaction(store).objectStore(store).get(id));
  }

  /* Read everything into the same shape app.js keeps in memory. */
  function exportDatabaseSnapshot() {
    return openDatabase().then(function (db) {
      var out = {};
      return Promise.all(RECORD_STORES.map(function (s) {
        return getAll(db, s).then(function (rows) { out[s] = rows; });
      })).then(function () {
        return Promise.all([getOne(db, 'syncMetadata', 'root'), getOne(db, 'meta', 'settings'), getOne(db, 'meta', 'root')]);
      }).then(function (parts) {
        var sync = parts[0], settings = parts[1], meta = parts[2];
        var extra = (settings && settings.value) || {};
        Object.keys(extra).forEach(function (k) { if (RESERVED_KEYS.indexOf(k) === -1) out[k] = extra[k]; });
        out._sync = (sync && sync.value) || { tombstones: {} };
        if (meta && meta.schemaVersion) out.schemaVersion = meta.schemaVersion;
        return out;
      });
    });
  }

  /* Replace the stored snapshot atomically. */
  function saveSnapshot(data) {
    if (!data || typeof data !== 'object') return Promise.reject(new Error('invalid-snapshot'));
    try {
      var serialized = JSON.stringify(data);
      if (serialized.length > MAX_SNAPSHOT_BYTES) return Promise.reject(new DOMException('snapshot-too-large', 'QuotaExceededError'));
    } catch (e) { return Promise.reject(new Error('invalid-snapshot')); }
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(STORES, 'readwrite');
          STORES.forEach(function (s) { tx.objectStore(s).clear(); });
          RECORD_STORES.forEach(function (s) {
            var rows = Array.isArray(data[s]) ? data[s] : [];
            rows.forEach(function (rec) {
              if (!rec || typeof rec !== 'object') return;
              if (rec.id === undefined || rec.id === null || rec.id === '') rec.id = fallbackId();
              tx.objectStore(s).put(rec);
            });
          });
          var settings = {};
          Object.keys(data).forEach(function (k) { if (RESERVED_KEYS.indexOf(k) === -1) settings[k] = data[k]; });
          tx.objectStore('meta').put({ id: 'settings', value: settings });
          tx.objectStore('meta').put({
            id: 'root',
            schemaVersion: data.schemaVersion || 4,
            appVersion: APP_VERSION,
            savedAt: new Date().toISOString()
          });
          tx.objectStore('syncMetadata').put({ id: 'root', value: data._sync || { tombstones: {} } });
        } catch (e) {
          try { if (tx) tx.abort(); } catch (ignored) { /* already finished */ }
          reject(e);
          return;
        }
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
      });
    });
  }

  /* Is there a committed snapshot at all? (meta/root is written in the same
   * transaction as the records, so its presence proves a complete save.) */
  function hasSnapshot() {
    return openDatabase().then(function (db) { return getOne(db, 'meta', 'root'); }).then(function (m) { return !!m; });
  }

  /* Returns the stored data, or `fallback` when nothing has been saved yet.
   * A stored snapshot always wins, even if every collection is empty, so
   * intentionally deleting all data is never "undone" by an old copy. */
  function hydrate(fallback) {
    return hasSnapshot().then(function (has) {
      return has ? exportDatabaseSnapshot() : fallback;
    });
  }

  /* Read-back check used before a legacy localStorage copy is deleted. */
  function verifySnapshot(data) {
    return exportDatabaseSnapshot().then(function (snap) {
      for (var i = 0; i < RECORD_STORES.length; i++) {
        var s = RECORD_STORES[i];
        var expected = (Array.isArray(data[s]) ? data[s] : []).filter(function (r) { return r && typeof r === 'object'; }).length;
        if ((snap[s] || []).length !== expected) return false;
        var expectedIds = new Set((Array.isArray(data[s]) ? data[s] : []).filter(function (r) { return r && typeof r === 'object' && r.id != null; }).map(function (r) { return String(r.id); }));
        for (var j = 0; j < (snap[s] || []).length; j++) if (!expectedIds.has(String(snap[s][j].id))) return false;
      }
      return true;
    });
  }

  /* Ask the browser not to evict our data under storage pressure. */
  function requestPersistence() {
    try {
      if (root.navigator && root.navigator.storage && root.navigator.storage.persist) {
        return root.navigator.storage.persist().catch(function () { return false; });
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  root.HesabYarStorage = {
    openDatabase: openDatabase,
    saveSnapshot: saveSnapshot,
    exportDatabaseSnapshot: exportDatabaseSnapshot,
    hydrate: hydrate,
    hasSnapshot: hasSnapshot,
    verifySnapshot: verifySnapshot,
    requestPersistence: requestPersistence,
    RECORD_STORES: RECORD_STORES
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

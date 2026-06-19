/* =====================================================================
 * videodb.js — 영상(Blob) 저장소 (IndexedDB)
 *
 * localStorage 는 용량이 작아 영상 파일을 담을 수 없으므로,
 * 관찰 영상의 실제 데이터는 IndexedDB 에 저장한다.
 * (관찰 메타데이터·행동 이벤트 등 '데이터'는 store.js / localStorage 에 보관)
 * ===================================================================== */
(function (global) {
  'use strict';

  var DB_NAME = 'ichild-media';
  var STORE = 'videos';
  var VERSION = 1;
  var _dbP = null;

  function openDB() {
    if (_dbP) return _dbP;
    _dbP = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB 미지원 환경')); return; }
      var rq = global.indexedDB.open(DB_NAME, VERSION);
      rq.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error); };
    });
    return _dbP;
  }

  function put(key, blob) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, key);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function get(key) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }

  function del(key) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function available() { return !!global.indexedDB; }

  global.VideoDB = { put: put, get: get, del: del, available: available };
})(window);

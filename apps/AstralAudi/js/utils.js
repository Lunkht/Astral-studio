(function (global) {
  'use strict';

  function uid(prefix) {
    return (prefix || 'o') + Math.random().toString(36).slice(2, 9);
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function round(v, p) {
    var f = Math.pow(10, p == null ? 2 : p);
    return Math.round(v * f) / f;
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function timecode(sec, fps) {
    fps = fps || 30;
    var s = Math.max(0, sec || 0);
    var total = Math.round(s * fps);
    var f = total % fps;
    var totalSec = Math.floor(total / fps);
    var ss = totalSec % 60;
    var mm = Math.floor(totalSec / 60) % 60;
    var hh = Math.floor(totalSec / 3600);
    return pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss) + ':' + pad2(f);
  }

  function formatClock(sec) {
    var s = Math.max(0, sec || 0);
    var total = Math.floor(s);
    var ss = total % 60;
    var mm = Math.floor(total / 60) % 60;
    var hh = Math.floor(total / 3600);
    return (hh ? hh + ':' + pad2(mm) : mm) + ':' + pad2(ss);
  }

  function formatTime(sec) {
    var s = Math.max(0, sec || 0);
    var ms = Math.floor((s - Math.floor(s)) * 1000);
    var total = Math.floor(s);
    var ss = total % 60;
    var mm = Math.floor(total / 60) % 60;
    var hh = Math.floor(total / 3600);
    var base = (hh ? hh + ':' + pad2(mm) : String(mm)) + ':' + pad2(ss);
    return base + '.' + (ms < 10 ? '00' : ms < 100 ? '0' : '') + ms;
  }

  function dbToGain(db) {
    return Math.pow(10, (db || 0) / 20);
  }

  function gainToDb(g) {
    return 20 * Math.log10(Math.max(1e-6, g || 0));
  }

  global.Utils = {
    uid: uid,
    clamp: clamp,
    lerp: lerp,
    round: round,
    deepClone: deepClone,
    isNum: isNum,
    timecode: timecode,
    formatClock: formatClock,
    formatTime: formatTime,
    dbToGain: dbToGain,
    gainToDb: gainToDb
  };
})(window);

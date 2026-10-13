(function (global) {
  'use strict';

  function uid(prefix) {
    return (prefix || 'o') + Math.random().toString(36).slice(2, 9);
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function round(v, p) {
    var f = Math.pow(10, p == null ? 2 : p);
    return Math.round(v * f) / f;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function snap(value, targets, threshold) {
    var best = value, bestD = threshold;
    for (var i = 0; i < targets.length; i++) {
      var d = Math.abs(targets[i] - value);
      if (d < bestD) { bestD = d; best = targets[i]; }
    }
    return best;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function timecode(sec, fps) {
    fps = fps || 24;
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

  global.Utils = {
    uid: uid,
    clamp: clamp,
    round: round,
    lerp: lerp,
    deepClone: deepClone,
    isNum: isNum,
    overlaps: overlaps,
    snap: snap,
    timecode: timecode,
    formatClock: formatClock
  };
})(window);

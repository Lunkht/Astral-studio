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

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  global.Utils = {
    uid: uid,
    clamp: clamp,
    lerp: lerp,
    round: round,
    deg2rad: deg2rad,
    rad2deg: rad2deg,
    deepClone: deepClone
  };
})(window);

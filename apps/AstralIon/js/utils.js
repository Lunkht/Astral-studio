(function (global) {
  'use strict';

  var EPS = 1e-6;

  function uid(prefix) {
    return (prefix || 'o') + Math.random().toString(36).slice(2, 9);
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function toRad(d) { return (d * Math.PI) / 180; }

  function round(v, p) {
    var f = Math.pow(10, p == null ? 2 : p);
    return Math.round(v * f) / f;
  }

  function rotatePoint(x, y, cx, cy, a) {
    var c = Math.cos(a), s = Math.sin(a);
    var dx = x - cx, dy = y - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < EPS) return dist(px, py, x1, y1);
    var t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function snapAngle(rad, stepDeg) {
    var step = toRad(stepDeg == null ? 15 : stepDeg);
    return Math.round(rad / step) * step;
  }

  var UNITS = { px: 1, pt: 96 / 72, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  var UNIT_LABEL = { px: 'px', pt: 'pt', mm: 'mm', cm: 'cm', in: 'in' };

  function toUnit(px, unit) { return px / (UNITS[unit] || 1); }
  function fromUnit(v, unit) { return v * (UNITS[unit] || 1); }
  function formatUnit(px, unit) {
    var v = toUnit(px, unit);
    var dec = (UNITS[unit] || 1) >= 1 ? 1 : 2;
    return round(v, dec);
  }

  global.Utils = {
    EPS: EPS,
    uid: uid,
    clamp: clamp,
    toRad: toRad,
    round: round,
    rotatePoint: rotatePoint,
    dist: dist,
    pointSegmentDistance: pointSegmentDistance,
    deepClone: deepClone,
    snapAngle: snapAngle,
    UNITS: UNITS,
    UNIT_LABEL: UNIT_LABEL,
    toUnit: toUnit,
    fromUnit: fromUnit,
    formatUnit: formatUnit
  };
})(window);

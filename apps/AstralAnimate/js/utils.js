(function (global) {
  'use strict';

  var EPS = 1e-6;

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

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < EPS) return dist(px, py, x1, y1);
    var t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeIn(t) {
    return t * t * t;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  global.Utils = {
    EPS: EPS,
    uid: uid,
    clamp: clamp,
    round: round,
    dist: dist,
    lerp: lerp,
    deepClone: deepClone,
    pointSegmentDistance: pointSegmentDistance,
    pointInRect: pointInRect,
    easeInOut: easeInOut,
    easeOut: easeOut,
    easeIn: easeIn,
    roundRectPath: roundRectPath
  };
})(window);

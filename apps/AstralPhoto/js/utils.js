(function (global) {
  'use strict';

  var EPS = 1e-6;

  function uid(prefix) {
    return (prefix || 'l') + Math.random().toString(36).slice(2, 9);
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

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < EPS) return dist(px, py, x1, y1);
    var t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function pointInPolygon(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      var intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /* ---- colors ---- */
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    var m = hex.trim().replace(/^#/, '');
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
    var n = parseInt(m, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    var n = (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);
    return '#' + ('000000' + n.toString(16)).slice(-6);
  }

  function parseColor(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim();
    if (s[0] === '#') return hexToRgb(s);
    var m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function rgbaStr(c, a) {
    if (a == null) a = 1;
    return 'rgba(' + clamp255(c.r) + ',' + clamp255(c.g) + ',' + clamp255(c.b) + ',' + round(a, 3) + ')';
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d > EPS) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToRgb(h, s, l) {
    var r, g, b;
    if (s < EPS) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

  var UNITS = { px: 1, pt: 96 / 72, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

  function toUnit(px, unit) { return px / (UNITS[unit] || 1); }
  function fromUnit(v, unit) { return v * (UNITS[unit] || 1); }

  global.Utils = {
    EPS: EPS,
    uid: uid,
    clamp: clamp,
    round: round,
    lerp: lerp,
    deepClone: deepClone,
    dist: dist,
    pointSegmentDistance: pointSegmentDistance,
    pointInPolygon: pointInPolygon,
    clamp255: clamp255,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    parseColor: parseColor,
    rgbaStr: rgbaStr,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    UNITS: UNITS,
    toUnit: toUnit,
    fromUnit: fromUnit,
    toRad: toRad,
    toDeg: toDeg
  };
})(typeof window !== 'undefined' ? window : this);

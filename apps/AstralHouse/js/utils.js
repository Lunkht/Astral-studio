(function (global) {
  'use strict';

  var _uid = 0;

  var Utils = {
    clamp: function (v, min, max) { return v < min ? min : (v > max ? max : v); },

    lerp: function (a, b, t) { return a + (b - a) * t; },

    round: function (v, d) {
      var f = Math.pow(10, d == null ? 2 : d);
      return Math.round(v * f) / f;
    },

    deg2rad: function (d) { return d * Math.PI / 180; },
    rad2deg: function (r) { return r * 180 / Math.PI; },

    almost: function (a, b, eps) { return Math.abs(a - b) < (eps == null ? 1e-9 : eps); },

    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },

    normAngle: function (a) {
      var t = a % (Math.PI * 2);
      return t < 0 ? t + Math.PI * 2 : t;
    },

    angleDelta: function (a, b) {
      var d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    deepClone: function (o) { return JSON.parse(JSON.stringify(o)); },

    uid: function (prefix) {
      _uid += 1;
      return (prefix || 'id') + '_' + _uid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    },

    fmt: function (v, d) {
      if (v == null || isNaN(v)) return '0';
      return String(Utils.round(v, d == null ? 3 : d));
    },

    parseNumber: function (s, fallback) {
      var v = parseFloat(s);
      return isNaN(v) ? (fallback == null ? 0 : fallback) : v;
    }
  };

  global.Utils = Utils;
})(window);

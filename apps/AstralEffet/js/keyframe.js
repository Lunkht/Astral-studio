(function (global) {
  'use strict';

  var EPS = 1e-4;

  var EASES = {
    linear: function (t) { return t; },
    easeIn: function (t) { return t * t; },
    easeOut: function (t) { return t * (2 - t); },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    hold: function () { return 0; }
  };

  function ease(name, t) {
    var fn = EASES[name] || EASES.linear;
    return fn(t);
  }

  function prop(value) {
    return { value: value == null ? 0 : value, keys: [] };
  }

  function isProp(p) {
    return !!p && typeof p === 'object' && 'value' in p && Array.isArray(p.keys);
  }

  function hasKeys(p) {
    return isProp(p) && p.keys.length > 0;
  }

  function sorted(p) {
    return p.keys.slice().sort(function (a, b) { return a.t - b.t; });
  }

  function keyAt(p, t, eps) {
    if (!isProp(p)) return null;
    eps = eps == null ? EPS : eps;
    for (var i = 0; i < p.keys.length; i++) {
      if (Math.abs(p.keys[i].t - t) <= eps) return p.keys[i];
    }
    return null;
  }

  function setKey(p, t, value, easeName) {
    var existing = keyAt(p, t);
    if (existing) {
      existing.value = value;
      if (easeName) existing.ease = easeName;
      return existing;
    }
    var k = { t: t, value: value, ease: easeName || 'linear' };
    p.keys.push(k);
    p.keys.sort(function (a, b) { return a.t - b.t; });
    return k;
  }

  function removeKey(p, t) {
    var k = keyAt(p, t);
    if (!k) return false;
    p.keys.splice(p.keys.indexOf(k), 1);
    return true;
  }

  function clearKeys(p) {
    p.keys.length = 0;
  }

  function toggleKeyAt(p, t, value) {
    if (keyAt(p, t)) { removeKey(p, t); return false; }
    setKey(p, t, value == null ? p.value : value);
    return true;
  }

  function valueAt(p, t) {
    if (!isProp(p)) return 0;
    if (!p.keys.length) return p.value;
    var ks = sorted(p);
    if (t <= ks[0].t) return ks[0].value;
    var last = ks[ks.length - 1];
    if (t >= last.t) return last.value;
    for (var i = 0; i < ks.length - 1; i++) {
      var k0 = ks[i], k1 = ks[i + 1];
      if (t >= k0.t && t <= k1.t) {
        var span = k1.t - k0.t;
        var f = span <= 0 ? 1 : (t - k0.t) / span;
        return k0.value + (k1.value - k0.value) * ease(k0.ease, f);
      }
    }
    return last.value;
  }

  global.Keyframe = {
    EPS: EPS,
    EASES: EASES,
    ease: ease,
    prop: prop,
    isProp: isProp,
    hasKeys: hasKeys,
    sorted: sorted,
    keyAt: keyAt,
    setKey: setKey,
    removeKey: removeKey,
    clearKeys: clearKeys,
    toggleKeyAt: toggleKeyAt,
    valueAt: valueAt
  };
})(window);

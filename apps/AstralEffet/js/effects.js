(function (global) {
  'use strict';

  var U = global.Utils;
  var K = global.Keyframe;

  var REGISTRY = {
    blur: { name: 'Flou', params: { radius: { label: 'Rayon', def: 8, min: 0, max: 100, step: 1 } } },
    brightness: { name: 'Luminosite', params: { amount: { label: 'Quantite', def: 0, min: -100, max: 100, step: 1 } } },
    contrast: { name: 'Contraste', params: { amount: { label: 'Quantite', def: 0, min: -100, max: 100, step: 1 } } },
    saturate: { name: 'Saturation', params: { amount: { label: 'Quantite', def: 100, min: 0, max: 300, step: 1 } } },
    hue: { name: 'Teinte', params: { degrees: { label: 'Angle', def: 0, min: -180, max: 180, step: 1 } } },
    grayscale: { name: 'Noir et blanc', params: { amount: { label: 'Quantite', def: 100, min: 0, max: 100, step: 1 } } },
    sepia: { name: 'Sepia', params: { amount: { label: 'Quantite', def: 100, min: 0, max: 100, step: 1 } } },
    invert: { name: 'Negatif', params: { amount: { label: 'Quantite', def: 100, min: 0, max: 100, step: 1 } } }
  };

  function list() {
    var out = [];
    for (var type in REGISTRY) {
      if (Object.prototype.hasOwnProperty.call(REGISTRY, type)) {
        out.push({ type: type, name: REGISTRY[type].name });
      }
    }
    return out;
  }

  function def(type) {
    return REGISTRY[type] || null;
  }

  function create(type) {
    var d = REGISTRY[type];
    if (!d) return null;
    var params = {};
    for (var key in d.params) {
      if (Object.prototype.hasOwnProperty.call(d.params, key)) {
        params[key] = K.prop(d.params[key].def);
      }
    }
    return { id: U.uid('fx'), type: type, enabled: true, params: params };
  }

  function param(effect, key, t) {
    var p = effect.params ? effect.params[key] : null;
    return p ? K.valueAt(p, t) : 0;
  }

  function filterString(effect, t) {
    var v = function (k) { return param(effect, k, t); };
    switch (effect.type) {
      case 'blur': return 'blur(' + U.round(Math.max(0, v('radius')), 2) + 'px)';
      case 'brightness': return 'brightness(' + U.round(1 + v('amount') / 100, 4) + ')';
      case 'contrast': return 'contrast(' + U.round(1 + v('amount') / 100, 4) + ')';
      case 'saturate': return 'saturate(' + U.round(Math.max(0, v('amount')) / 100, 4) + ')';
      case 'hue': return 'hue-rotate(' + U.round(v('degrees'), 2) + 'deg)';
      case 'grayscale': return 'grayscale(' + U.round(U.clamp(v('amount'), 0, 100) / 100, 4) + ')';
      case 'sepia': return 'sepia(' + U.round(U.clamp(v('amount'), 0, 100) / 100, 4) + ')';
      case 'invert': return 'invert(' + U.round(U.clamp(v('amount'), 0, 100) / 100, 4) + ')';
      default: return '';
    }
  }

  function combinedFilter(effects, t) {
    if (!effects || !effects.length) return 'none';
    var parts = [];
    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      if (e && e.enabled) {
        var s = filterString(e, t);
        if (s) parts.push(s);
      }
    }
    return parts.length ? parts.join(' ') : 'none';
  }

  function hasKeys(effect) {
    for (var key in effect.params) {
      if (Object.prototype.hasOwnProperty.call(effect.params, key) && K.hasKeys(effect.params[key])) return true;
    }
    return false;
  }

  global.Effects = {
    REGISTRY: REGISTRY,
    list: list,
    def: def,
    create: create,
    param: param,
    filterString: filterString,
    combinedFilter: combinedFilter,
    hasKeys: hasKeys
  };
})(window);

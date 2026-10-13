(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;

  function create(name) {
    return {
      id: U.uid('l'),
      name: name || 'Calque',
      visible: true,
      locked: false,
      keys: []
    };
  }

  function sortKeys(layer) {
    layer.keys.sort(function (a, b) { return a.frame - b.frame; });
    return layer.keys;
  }

  function keyAt(layer, frame) {
    for (var i = 0; i < layer.keys.length; i++) {
      if (layer.keys[i].frame === frame) return layer.keys[i];
    }
    return null;
  }

  function setKey(layer, frame, shapes) {
    var k = keyAt(layer, frame);
    if (k) {
      k.shapes = shapes || [];
    } else {
      k = { frame: frame, shapes: shapes || [] };
      layer.keys.push(k);
      sortKeys(layer);
    }
    return k;
  }

  function removeKey(layer, frame) {
    for (var i = 0; i < layer.keys.length; i++) {
      if (layer.keys[i].frame === frame) { layer.keys.splice(i, 1); return true; }
    }
    return false;
  }

  function prevKey(layer, frame) {
    var best = null;
    for (var i = 0; i < layer.keys.length; i++) {
      if (layer.keys[i].frame <= frame && (!best || layer.keys[i].frame > best.frame)) best = layer.keys[i];
    }
    return best;
  }

  function nextKey(layer, frame) {
    var best = null;
    for (var i = 0; i < layer.keys.length; i++) {
      if (layer.keys[i].frame >= frame && (!best || layer.keys[i].frame < best.frame)) best = layer.keys[i];
    }
    return best;
  }

  function renderAt(layer, frame, easeFn) {
    var exact = keyAt(layer, frame);
    if (exact) return U.deepClone(exact.shapes);
    var a = prevKey(layer, frame);
    var b = nextKey(layer, frame);
    if (!a && !b) return [];
    if (!a) return U.deepClone(b.shapes);
    if (!b) return U.deepClone(a.shapes);
    var span = b.frame - a.frame;
    if (span <= 0) return U.deepClone(a.shapes);
    var t = (frame - a.frame) / span;
    t = (easeFn || U.easeInOut)(U.clamp(t, 0, 1));
    return S.interpolateAll(a.shapes, b.shapes, t);
  }

  function keyFrames(layer) {
    return layer.keys.map(function (k) { return k.frame; });
  }

  global.Layer = {
    create: create,
    sortKeys: sortKeys,
    keyAt: keyAt,
    setKey: setKey,
    removeKey: removeKey,
    prevKey: prevKey,
    nextKey: nextKey,
    renderAt: renderAt,
    keyFrames: keyFrames
  };
})(window);

(function (global) {
  'use strict';

  var U = global.Utils;

  function create(opts) {
    opts = opts || {};
    return {
      id: U.uid('comp'),
      name: opts.name || 'Composition',
      width: U.isNum(opts.width) ? opts.width : 1280,
      height: U.isNum(opts.height) ? opts.height : 720,
      fps: U.isNum(opts.fps) ? opts.fps : 30,
      duration: U.isNum(opts.duration) ? opts.duration : 5,
      background: opts.background || '#000000',
      layers: []
    };
  }

  function layerById(comp, id) {
    for (var i = 0; i < comp.layers.length; i++) {
      if (comp.layers[i].id === id) return comp.layers[i];
    }
    return null;
  }

  function indexOf(comp, id) {
    for (var i = 0; i < comp.layers.length; i++) {
      if (comp.layers[i].id === id) return i;
    }
    return -1;
  }

  function addLayer(comp, layer, index) {
    if (index == null || index < 0 || index > comp.layers.length) {
      comp.layers.push(layer);
    } else {
      comp.layers.splice(index, 0, layer);
    }
    return layer;
  }

  function removeLayer(comp, id) {
    var i = indexOf(comp, id);
    if (i < 0) return false;
    comp.layers.splice(i, 1);
    return true;
  }

  function moveLayer(comp, id, delta) {
    var i = indexOf(comp, id);
    if (i < 0 || !delta) return false;
    var j = U.clamp(i + delta, 0, comp.layers.length - 1);
    if (j === i) return false;
    var l = comp.layers.splice(i, 1)[0];
    comp.layers.splice(j, 0, l);
    return true;
  }

  function topDown(comp) {
    return comp.layers.slice().reverse();
  }

  function maxEnd(comp) {
    return comp.duration;
  }

  global.Comp = {
    create: create,
    layerById: layerById,
    indexOf: indexOf,
    addLayer: addLayer,
    removeLayer: removeLayer,
    moveLayer: moveLayer,
    topDown: topDown,
    maxEnd: maxEnd
  };
})(window);

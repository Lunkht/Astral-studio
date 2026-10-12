(function (global) {
  'use strict';

  var U = global.Utils;

  var BLEND_MODES = [
    { id: 'source-over', label: 'Normal' },
    { id: 'multiply', label: 'Produit' },
    { id: 'screen', label: 'Écran' },
    { id: 'overlay', label: 'Incrustation' },
    { id: 'darken', label: 'Obscurcir' },
    { id: 'lighten', label: 'Éclaircir' },
    { id: 'color-dodge', label: 'Densité couleur -' },
    { id: 'color-burn', label: 'Densité couleur +' },
    { id: 'hard-light', label: 'Lumière crue' },
    { id: 'soft-light', label: 'Lumière tamisée' },
    { id: 'difference', label: 'Différence' },
    { id: 'exclusion', label: 'Exclusion' }
  ];

  function newCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w || 1));
    c.height = Math.max(1, Math.round(h || 1));
    return c;
  }

  function context(canvas) {
    return canvas.getContext('2d');
  }

  function cloneCanvas(src) {
    var c = newCanvas(src.width, src.height);
    var ctx = c.getContext('2d');
    if (ctx && ctx.drawImage) ctx.drawImage(src, 0, 0);
    return c;
  }

  function clearCanvas(canvas) {
    var ctx = context(canvas);
    if (ctx && ctx.clearRect) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function create(opts) {
    opts = opts || {};
    var w = opts.width || 1, h = opts.height || 1;
    return {
      id: opts.id || U.uid('layer'),
      type: 'raster',
      name: opts.name || 'Calque',
      visible: opts.visible !== false,
      locked: !!opts.locked,
      opacity: opts.opacity == null ? 1 : opts.opacity,
      blend: opts.blend || 'source-over',
      canvas: opts.canvas || newCanvas(w, h)
    };
  }

  function dims(layer) {
    return { w: layer.canvas.width, h: layer.canvas.height };
  }

  function clone(layer, name) {
    var copy = create({
      name: name || (layer.name + ' copie'),
      width: layer.canvas.width,
      height: layer.canvas.height,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blend: layer.blend,
      canvas: cloneCanvas(layer.canvas)
    });
    return copy;
  }

  function reseat(layer, w, h) {
    var c = newCanvas(w, h);
    if (layer.canvas && layer.canvas.width) c.getContext('2d').drawImage(layer.canvas, 0, 0);
    layer.canvas = c;
    return layer;
  }

  function blendLabel(id) {
    for (var i = 0; i < BLEND_MODES.length; i++) if (BLEND_MODES[i].id === id) return BLEND_MODES[i].label;
    return 'Normal';
  }

  global.Layer = {
    BLEND_MODES: BLEND_MODES,
    newCanvas: newCanvas,
    context: context,
    cloneCanvas: cloneCanvas,
    clearCanvas: clearCanvas,
    create: create,
    dims: dims,
    clone: clone,
    reseat: reseat,
    blendLabel: blendLabel
  };
})(typeof window !== 'undefined' ? window : this);

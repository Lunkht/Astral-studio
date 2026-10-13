(function (global) {
  'use strict';

  var U = global.Utils;
  var K = global.Keyframe;
  var Effects = global.Effects;

  var TYPES = ['solid', 'text', 'shape', 'image', 'video'];

  function transformDefaults(opts) {
    var tr = opts.transform || {};
    return {
      x: K.prop(U.isNum(tr.x) ? tr.x : 0),
      y: K.prop(U.isNum(tr.y) ? tr.y : 0),
      scale: K.prop(U.isNum(tr.scale) ? tr.scale : 100),
      rotation: K.prop(U.isNum(tr.rotation) ? tr.rotation : 0),
      opacity: K.prop(U.isNum(tr.opacity) ? tr.opacity : 100)
    };
  }

  function create(opts) {
    opts = opts || {};
    var type = TYPES.indexOf(opts.type) >= 0 ? opts.type : 'solid';
    var sh = opts.shape || {};
    return {
      id: U.uid('layer'),
      type: type,
      name: opts.name || defaultName(type),
      visible: opts.visible !== false,
      locked: !!opts.locked,
      color: opts.color || defaultColor(type),
      text: opts.text || 'Texte',
      fontSize: opts.fontSize || 72,
      fontFamily: opts.fontFamily || 'sans-serif',
      stroke: opts.stroke || null,
      strokeWidth: U.isNum(opts.strokeWidth) ? opts.strokeWidth : 0,
      shape: {
        kind: sh.kind || (type === 'solid' ? 'rect' : 'rect'),
        w: U.isNum(sh.w) ? sh.w : 200,
        h: U.isNum(sh.h) ? sh.h : 200,
        radius: U.isNum(sh.radius) ? sh.radius : 0,
        points: U.isNum(sh.points) ? sh.points : 5,
        inner: U.isNum(sh.inner) ? sh.inner : 0.45
      },
      assetId: opts.assetId || null,
      blend: opts.blend || 'normal',
      transform: transformDefaults(opts),
      effects: []
    };
  }

  function defaultName(type) {
    if (type === 'solid') return 'Solide';
    if (type === 'text') return 'Texte';
    if (type === 'shape') return 'Forme';
    if (type === 'video') return 'Video';
    return 'Image';
  }

  function defaultColor(type) {
    return type === 'solid' ? '#3a7bd5' : '#ffffff';
  }

  function evaluate(layer, t) {
    var tr = layer.transform;
    return {
      x: K.valueAt(tr.x, t),
      y: K.valueAt(tr.y, t),
      scale: K.valueAt(tr.scale, t),
      rotation: K.valueAt(tr.rotation, t),
      opacity: U.clamp(K.valueAt(tr.opacity, t), 0, 100)
    };
  }

  function bounds(layer, assets) {
    var s = layer.shape;
    if (layer.type === 'text') {
      var lines = String(layer.text).split('\n');
      var longest = 1;
      for (var i = 0; i < lines.length; i++) longest = Math.max(longest, lines[i].length);
      return { w: Math.max(20, longest * layer.fontSize * 0.58), h: Math.max(20, lines.length * layer.fontSize * 1.2) };
    }
    if (layer.type === 'image' || layer.type === 'video') {
      var a = assets && assets.byId ? assets.byId[layer.assetId] : null;
      var w = a && a.width ? a.width : 400;
      var h = a && a.height ? a.height : 300;
      return { w: w, h: h };
    }
    return { w: s.w, h: s.h };
  }

  function polygonStar(ctx, cx, cy, outer, inner, points, rotation) {
    var n = Math.max(3, Math.round(points)) * 2;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var rad = (i % 2 === 0) ? outer : inner;
      var ang = -Math.PI / 2 + rotation + (Math.PI * i) / (n / 2);
      var x = cx + Math.cos(ang) * rad;
      var y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  function drawContent(ctx, layer, assets) {
    var s = layer.shape;
    var b = bounds(layer, assets);
    ctx.save();
    if (layer.type === 'solid') {
      ctx.fillStyle = layer.color;
      if (s.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.abs(b.w) / 2, Math.abs(b.h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
    } else if (layer.type === 'shape') {
      ctx.fillStyle = layer.color;
      if (s.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.abs(b.w) / 2, Math.abs(b.h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.kind === 'star') {
        polygonStar(ctx, 0, 0, Math.abs(b.w) / 2, Math.abs(b.w) / 2 * U.clamp(s.inner, 0.05, 0.95), s.points, 0);
        ctx.fill();
      } else {
        roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, s.radius);
        ctx.fill();
      }
    } else if (layer.type === 'text') {
      ctx.fillStyle = layer.color;
      ctx.font = layer.fontSize + 'px ' + layer.fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var lines = String(layer.text).split('\n');
      var lh = layer.fontSize * 1.2;
      var y0 = -(lines.length - 1) * lh / 2;
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, y0 + i * lh);
      }
      if (layer.stroke && layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeText(layer.text, 0, y0);
      }
    } else if (layer.type === 'image' || layer.type === 'video') {
      var a = assets && assets.byId ? assets.byId[layer.assetId] : null;
      var el = a ? a.element : null;
      if (el && a.ready) {
        try { ctx.drawImage(el, -b.w / 2, -b.h / 2, b.w, b.h); } catch (e) { /* not ready */ }
      } else {
        ctx.fillStyle = 'rgba(120,120,120,0.35)';
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
    }
    ctx.restore();
  }

  function transformCtx(ctx, r) {
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rotation * Math.PI / 180);
    ctx.scale(r.scale / 100, r.scale / 100);
  }

  function addEffect(layer, type) {
    var fx = Effects.create(type);
    if (!fx) return null;
    layer.effects.push(fx);
    return fx;
  }

  function removeEffect(layer, id) {
    for (var i = 0; i < layer.effects.length; i++) {
      if (layer.effects[i].id === id) { layer.effects.splice(i, 1); return true; }
    }
    return false;
  }

  function hasKeys(layer) {
    for (var key in layer.transform) {
      if (Object.prototype.hasOwnProperty.call(layer.transform, key) && K.hasKeys(layer.transform[key])) return true;
    }
    for (var i = 0; i < layer.effects.length; i++) {
      if (Effects.hasKeys(layer.effects[i])) return true;
    }
    return false;
  }

  global.Layer = {
    TYPES: TYPES,
    create: create,
    evaluate: evaluate,
    bounds: bounds,
    drawContent: drawContent,
    transformCtx: transformCtx,
    addEffect: addEffect,
    removeEffect: removeEffect,
    hasKeys: hasKeys
  };
})(window);

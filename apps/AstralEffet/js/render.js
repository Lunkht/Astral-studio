(function (global) {
  'use strict';

  var App = global.App;
  var Layer = global.Layer;
  var Effects = global.Effects;

  var HANDLE = 6;

  var BLENDS = [
    { id: 'normal', name: 'Normal', op: 'source-over' },
    { id: 'multiply', name: 'Produit', op: 'multiply' },
    { id: 'screen', name: 'Superposition', op: 'screen' },
    { id: 'overlay', name: 'Incrustation', op: 'overlay' },
    { id: 'lighter', name: 'Eclaircir', op: 'lighter' },
    { id: 'difference', name: 'Difference', op: 'difference' }
  ];

  function opFor(id) {
    for (var i = 0; i < BLENDS.length; i++) if (BLENDS[i].id === id) return BLENDS[i].op;
    return 'source-over';
  }

  var Renderer = {
    canvas: null,
    ctx: null
  };

  Renderer.init = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    return this.ctx;
  };

  Renderer.resize = function () {
    if (!this.canvas) return;
    var w = this.canvas.clientWidth || 800;
    var h = this.canvas.clientHeight || 500;
    this.canvas.width = w;
    this.canvas.height = h;
  };

  Renderer.view = function () {
    var cw = this.canvas ? this.canvas.width : 800;
    var ch = this.canvas ? this.canvas.height : 500;
    var comp = App.comp;
    if (!comp) return { fit: 1, ox: 0, oy: 0 };
    var pad = 40;
    var fit = Math.min((cw - pad) / comp.width, (ch - pad) / comp.height);
    if (!isFinite(fit) || fit <= 0) fit = 1;
    fit *= App.camera.zoom;
    return {
      fit: fit,
      ox: (cw - comp.width * fit) / 2 + App.camera.x,
      oy: (ch - comp.height * fit) / 2 + App.camera.y
    };
  };

  Renderer.compToScreen = function (cx, cy) {
    var v = this.view();
    return { x: v.ox + cx * v.fit, y: v.oy + cy * v.fit };
  };

  Renderer.screenToComp = function (sx, sy) {
    var v = this.view();
    return { x: (sx - v.ox) / v.fit, y: (sy - v.oy) / v.fit };
  };

  Renderer.draw = function () {
    var ctx = this.ctx;
    if (!ctx || !App.comp) return;
    var comp = App.comp;
    var v = this.view();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.fit, v.fit);
    ctx.beginPath();
    ctx.rect(0, 0, comp.width, comp.height);
    ctx.fillStyle = comp.background;
    ctx.fill();
    ctx.clip();
    var t = App.time;
    for (var i = 0; i < comp.layers.length; i++) {
      var layer = comp.layers[i];
      if (!layer.visible) continue;
      var r = Layer.evaluate(layer, t);
      ctx.save();
      ctx.globalAlpha = r.opacity / 100;
      ctx.globalCompositeOperation = opFor(layer.blend);
      ctx.filter = Effects.combinedFilter(layer.effects, t);
      Layer.transformCtx(ctx, r);
      Layer.drawContent(ctx, layer, App.assets);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  };

  Renderer.layerCorners = function (layer, t) {
    var r = Layer.evaluate(layer, t);
    var b = Layer.bounds(layer, App.assets);
    var hw = b.w / 2, hh = b.h / 2;
    var s = r.scale / 100;
    var rot = r.rotation * Math.PI / 180;
    var cos = Math.cos(rot), sin = Math.sin(rot);
    var pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i][0] * s, y = pts[i][1] * s;
      out.push({ x: r.x + x * cos - y * sin, y: r.y + x * sin + y * cos });
    }
    return out;
  };

  Renderer.layerScreenCorners = function (layer, t) {
    var corners = this.layerCorners(layer, t);
    var self = this;
    return corners.map(function (p) { return self.compToScreen(p.x, p.y); });
  };

  Renderer.hitTest = function (sx, sy) {
    var p = this.screenToComp(sx, sy);
    var comp = App.comp;
    if (!comp) return null;
    for (var i = comp.layers.length - 1; i >= 0; i--) {
      var layer = comp.layers[i];
      if (!layer.visible || layer.locked) continue;
      var r = Layer.evaluate(layer, App.time);
      var b = Layer.bounds(layer, App.assets);
      var dx = p.x - r.x, dy = p.y - r.y;
      var rot = -r.rotation * Math.PI / 180;
      var lx = dx * Math.cos(rot) - dy * Math.sin(rot);
      var ly = dx * Math.sin(rot) + dy * Math.cos(rot);
      var s = r.scale / 100 || 1;
      lx /= s; ly /= s;
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return layer;
    }
    return null;
  };

  Renderer.drawOverlay = function () {
    var ctx = this.ctx;
    if (!ctx || !App.comp) return;
    var comp = App.comp;
    var v = this.view();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.ox, v.oy, comp.width * v.fit, comp.height * v.fit);

    var sel = App.selectedLayers();
    for (var i = 0; i < sel.length; i++) {
      var layer = sel[i];
      var pts = this.layerScreenCorners(layer, App.time);
      ctx.strokeStyle = '#4aa3ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
      ctx.closePath();
      ctx.stroke();

      if (layer.locked) continue;
      ctx.fillStyle = '#4aa3ff';
      for (var k = 0; k < pts.length; k++) {
        ctx.fillRect(pts[k].x - HANDLE / 2, pts[k].y - HANDLE / 2, HANDLE, HANDLE);
      }
      var topMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      var bottomMid = { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2 };
      var dirx = topMid.x - bottomMid.x, diry = topMid.y - bottomMid.y;
      var len = Math.hypot(dirx, diry) || 1;
      var rotHandle = { x: topMid.x + dirx / len * 24, y: topMid.y + diry / len * 24 };
      ctx.beginPath();
      ctx.moveTo(topMid.x, topMid.y);
      ctx.lineTo(rotHandle.x, rotHandle.y);
      ctx.strokeStyle = '#4aa3ff';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rotHandle.x, rotHandle.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.handleAt = function (sx, sy) {
    var sel = App.selectedLayers();
    if (sel.length !== 1) return null;
    var layer = sel[0];
    if (layer.locked) return null;
    var pts = this.layerScreenCorners(layer, App.time);
    var names = ['nw', 'ne', 'se', 'sw'];
    for (var i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].x - sx) <= HANDLE && Math.abs(pts[i].y - sy) <= HANDLE) {
        return { kind: 'scale', corner: names[i], layerId: layer.id };
      }
    }
    var topMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    var bottomMid = { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2 };
    var dirx = topMid.x - bottomMid.x, diry = topMid.y - bottomMid.y;
    var len = Math.hypot(dirx, diry) || 1;
    var rotHandle = { x: topMid.x + dirx / len * 24, y: topMid.y + diry / len * 24 };
    if (Math.hypot(rotHandle.x - sx, rotHandle.y - sy) <= HANDLE + 2) {
      return { kind: 'rotate', layerId: layer.id, cx: pts[0].x, cy: pts[0].y };
    }
    return null;
  };

  global.Renderer = Renderer;
})(window);

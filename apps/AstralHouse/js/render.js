(function (global) {
  'use strict';

  var G = global.Geom;
  var U = global.Utils;
  var Entities = global.Entities;
  var Drawing = global.Drawing;
  var Tools = global.Tools;
  var App = global.App;

  var DASH = {
    continuous: [],
    dashed: [8, 5],
    dotted: [1, 4],
    dashdot: [10, 4, 2, 4],
    center: [16, 5, 4, 5]
  };

  function hexToRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function fade(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  var Renderer = {
    canvas: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
    },

    resize: function () {
      if (!this.canvas) return;
      var parent = this.canvas.parentElement;
      var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
      var w = Math.max(1, Math.round((rect && rect.width) || this.canvas.clientWidth || 800));
      var h = Math.max(1, Math.round((rect && rect.height) || this.canvas.clientHeight || 600));
      this.dpr = global.devicePixelRatio || 1;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.w = w;
      this.h = h;
      this.draw();
    },

    sp: function (p) { return App.worldToScreen(p); },

    setDash: function (ctx, linetype) {
      var d = DASH[linetype] || [];
      if (d.length && ctx.setLineDash) ctx.setLineDash(d);
      else if (ctx.setLineDash) ctx.setLineDash([]);
    },

    /* ---- main ---- */
    draw: function () {
      if (!this.ctx || !App.drawing) return;
      var ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, this.w, this.h);

      if (App.showGrid) this.drawGrid(ctx);

      var list = Drawing.visibleEntities(App.drawing);
      for (var i = 0; i < list.length; i++) this.drawEntity(ctx, list[i], null, 0);

      for (var s = 0; s < list.length; s++) {
        if (App.selection[list[s].id]) this.drawEntity(ctx, list[s], '#e0b060', 1.5);
      }

      this.drawPreview(ctx);
      this.drawMeasure(ctx);
      this.drawSnap(ctx);
      this.drawCrosshair(ctx);
    },

    /* ---- grid / axes ---- */
    drawGrid: function (ctx) {
      var rect = App.visibleWorldRect();
      var scale = App.viewport.scale;
      var step = App.drawing.gridSize || 10;
      while (step * scale < 6) step *= 5;
      var majorEvery = 5;

      var k0 = Math.floor(rect.min.x / step) - 1;
      var k1 = Math.ceil(rect.max.x / step) + 1;
      var j0 = Math.floor(rect.min.y / step) - 1;
      var j1 = Math.ceil(rect.max.y / step) + 1;
      var k, j, x, y;

      ctx.lineWidth = 1;
      for (k = k0; k <= k1; k++) {
        x = k * step;
        ctx.strokeStyle = (k % majorEvery === 0) ? '#2e2e2e' : '#222222';
        var a = this.sp({ x: x, y: rect.min.y });
        var b = this.sp({ x: x, y: rect.max.y });
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (j = j0; j <= j1; j++) {
        y = j * step;
        ctx.strokeStyle = (j % majorEvery === 0) ? '#2e2e2e' : '#222222';
        var c = this.sp({ x: rect.min.x, y: y });
        var d = this.sp({ x: rect.max.x, y: y });
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }

      if (App.showAxes) {
        var o = this.sp({ x: 0, y: 0 });
        var x2 = this.sp({ x: rect.max.x, y: 0 });
        var x1 = this.sp({ x: rect.min.x, y: 0 });
        var y1 = this.sp({ x: 0, y: rect.min.y });
        var y2 = this.sp({ x: 0, y: rect.max.y });
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#8a4a4a';
        ctx.beginPath(); ctx.moveTo(x1.x, x1.y); ctx.lineTo(x2.x, x2.y); ctx.stroke();
        ctx.strokeStyle = '#4a8a4a';
        ctx.beginPath(); ctx.moveTo(y1.x, y1.y); ctx.lineTo(y2.x, y2.y); ctx.stroke();
      }
    },

    /* ---- entities ---- */
    pathPoints: function (ctx, pts, closed) {
      if (!pts.length) return;
      var p0 = this.sp(pts[0]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < pts.length; i++) {
        var p = this.sp(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (closed) ctx.closePath();
    },

    drawEntity: function (ctx, e, overrideColor, widthBump) {
      var color = overrideColor || App.effectiveColor(e);
      var scale = App.viewport.scale;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = App.effectiveLineweight(e) + (widthBump || 0);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      this.setDash(ctx, overrideColor ? 'continuous' : App.effectiveLinetype(e));

      switch (e.type) {
        case 'line':
          this.pathPoints(ctx, [e.p1, e.p2], false);
          ctx.stroke();
          break;
        case 'polyline':
          this.pathPoints(ctx, e.points, e.closed);
          ctx.stroke();
          break;
        case 'rectangle':
          this.pathPoints(ctx, Entities.rectPoints(e), true);
          ctx.stroke();
          break;
        case 'circle': {
          var c = this.sp(e.center);
          var r = Math.max(0.5, e.radius * scale);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'arc':
          this.pathPoints(ctx, Entities.points(e), false);
          ctx.stroke();
          break;
        case 'hatch':
          this.pathPoints(ctx, e.boundary, true);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineWidth = Math.max(0.5, App.effectiveLineweight(e) * 0.5);
          ctx.globalAlpha = 0.6;
          var hs = Entities.hatchSegments(e);
          for (var i = 0; i < hs.length; i++) {
            var a = this.sp(hs[i][0]), b = this.sp(hs[i][1]);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        case 'text':
          this.drawText(ctx, e, color);
          break;
        case 'dimension':
          this.drawDimension(ctx, e, color);
          break;
      }
      ctx.restore();
    },

    drawText: function (ctx, e, color) {
      var scale = App.viewport.scale;
      var size = Math.max(6, e.height * scale);
      var p = this.sp(e.position);
      ctx.save();
      ctx.setLineDash([]);
      ctx.translate(p.x, p.y);
      ctx.rotate(-(e.rotation || 0));
      ctx.fillStyle = color;
      ctx.font = size + 'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.text, 0, 0);
      ctx.restore();
    },

    drawDimension: function (ctx, e, color) {
      var o = Entities.dimOffsetPoints(e);
      var scale = App.viewport.scale;
      var pts = Entities.points(e);
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1, App.effectiveLineweight(e));
      this.pathPoints(ctx, pts, false);
      ctx.stroke();

      var d = G.normalize(G.sub(e.p2, e.p1));
      var n = G.perp(d);
      var arrow = Math.max(3, 8 / scale);
      var mid = G.mid(o.a, o.b);
      [o.a, o.b].forEach(function (base) {
        var tip = G.sub(base, G.scale(d, e.offset >= 0 ? arrow : -arrow));
        var l = G.add(base, G.scale(n, arrow * 0.4));
        var r = G.sub(base, G.scale(n, arrow * 0.4));
        var st = App.worldToScreen(tip), sl = App.worldToScreen(l), sr = App.worldToScreen(r);
        ctx.beginPath();
        ctx.moveTo(st.x, st.y); ctx.lineTo(sl.x, sl.y); ctx.lineTo(sr.x, sr.y);
        ctx.closePath(); ctx.fill();
      });

      var value = G.dist(e.p1, e.p2);
      var label = U.fmt(value) + (App.drawing.units ? ' ' + App.drawing.units : '');
      var tp = App.worldToScreen(G.add(mid, G.scale(n, e.offset >= 0 ? arrow * 1.4 : -arrow * 1.4)));
      ctx.fillStyle = color;
      ctx.font = Math.max(9, 11) + 'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tp.x, tp.y);
    },

    /* ---- preview ---- */
    drawPreview: function (ctx) {
      var t = App.tool;
      if (t === 'select') return;
      if (!App.pending.length) return;

      var scale = App.viewport.scale;
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(224,176,96,0.9)';
      ctx.fillStyle = 'rgba(224,176,96,0.9)';
      ctx.lineWidth = 1;

      for (var i = 0; i < App.pending.length; i++) {
        var s = this.sp(App.pending[i]);
        ctx.beginPath();
        ctx.rect(s.x - 2.5, s.y - 2.5, 5, 5);
        ctx.fill();
      }

      var preview = App.snapHit ? App.snapHit.point : App.cursor;
      if (!preview) { ctx.restore(); return; }

      var last = App.pending[App.pending.length - 1];
      var a = this.sp(last), b = this.sp(preview);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

      var ghost = null;
      if (t === 'polyline') {
        ctx.beginPath();
        var p0 = this.sp(App.pending[0]);
        ctx.moveTo(p0.x, p0.y);
        for (var k = 1; k < App.pending.length; k++) {
          var pk = this.sp(App.pending[k]); ctx.lineTo(pk.x, pk.y);
        }
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (t === 'hatch') {
        var pts = App.pending.concat([preview]);
        var g = Entities.hatch(pts, Math.PI / 4, App.drawing.gridSize || 5);
        ghost = g;
      } else {
        var need = Tools.steps(t);
        var list = App.pending.concat([preview]);
        if (list.length >= need) ghost = Tools.buildFromPoints(t, list.slice(0, need));
      }

      if (ghost) {
        ctx.globalAlpha = 0.7;
        this.drawEntity(ctx, ghost, 'rgba(224,176,96,0.9)', 0);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },

    drawMeasure: function (ctx) {
      if (!App.measure) return;
      var m = App.measure;
      var a = this.sp(m.a), b = this.sp(m.b);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#60c0a0';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#60c0a0';
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(U.fmt(m.distance) + (App.drawing.units ? ' ' + App.drawing.units : ''), (a.x + b.x) / 2, (a.y + b.y) / 2 - 6);
      ctx.restore();
    },

    drawSnap: function (ctx) {
      if (!App.snapHit) return;
      var p = this.sp(App.snapHit.point);
      var type = App.snapHit.type;
      ctx.save();
      ctx.strokeStyle = '#40d0a0';
      ctx.fillStyle = '#40d0a0';
      ctx.lineWidth = 1.4;
      var s = 5;
      if (type === 'endpoint' || type === 'ortho') {
        ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2);
      } else if (type === 'midpoint') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.lineTo(p.x - s, p.y + s);
        ctx.closePath(); ctx.stroke();
      } else if (type === 'center') {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
      } else if (type === 'intersection') {
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
        ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s);
        ctx.stroke();
      } else if (type === 'grid') {
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },

    drawCrosshair: function (ctx) {
      if (!App.showCrosshair || !App.cursor) return;
      var s = this.sp(App.cursor);
      ctx.save();
      ctx.strokeStyle = 'rgba(200,200,200,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + 10, s.y);
      ctx.moveTo(s.x, s.y - 10); ctx.lineTo(s.x, s.y + 10);
      ctx.stroke();
      ctx.restore();
    },

    /* ---- picking ---- */
    pick: function (sp, tolPx) {
      if (!App.drawing) return null;
      var world = App.screenToWorld(sp);
      var tol = (tolPx || 6) / App.viewport.scale;
      var list = Drawing.visibleEntities(App.drawing);
      var best = null;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (Drawing.isLayerLocked(App.drawing, e)) continue;
        if (Entities.hitTest(e, world, tol)) best = e;
      }
      return best ? best.id : null;
    }
  };

  global.Renderer = Renderer;
})(window);

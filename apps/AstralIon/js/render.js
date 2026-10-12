(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;
  var App = global.App;

  var HANDLE_SIZE = 8;
  var ROT_RADIUS = 5;
  var ACCENT = '#9a9a9a';
  var ACCENT_SOFT = 'rgba(255,255,255,0.7)';

  var Renderer = {
    canvas: null,
    ctx: null,
    rulerTop: null,
    rulerLeft: null,
    dpr: 1,
    cssW: 0,
    cssH: 0,

    init: function (canvas, rulerTop, rulerLeft) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rulerTop = rulerTop;
      this.rulerLeft = rulerLeft;
      this.resize();
    },

    resize: function () {
      var c = this.canvas;
      var rect = c.getBoundingClientRect();
      this.dpr = window.devicePixelRatio || 1;
      this.cssW = rect.width;
      this.cssH = rect.height;
      c.width = Math.max(1, Math.round(rect.width * this.dpr));
      c.height = Math.max(1, Math.round(rect.height * this.dpr));
      this.draw();
    },

    worldToScreen: function (x, y) { return App.worldToScreen(x, y); },
    screenToWorld: function (x, y) { return App.screenToWorld(x, y); },

    draw: function () {
      var ctx = this.ctx;
      if (!ctx) return;
      var dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);

      this.drawBackdrop(ctx);
      this.drawArtboard(ctx);

      var cam = App.camera;
      ctx.save();
      ctx.translate(cam.pan.x, cam.pan.y);
      ctx.scale(cam.zoom, cam.zoom);
      for (var i = 0; i < App.shapes.length; i++) {
        var s = App.shapes[i];
        if (s.visible) this.drawShape(ctx, s);
      }
      if (App.preview) {
        ctx.globalAlpha = 0.75;
        this.drawShape(ctx, App.preview);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (this.showAnchors()) this.drawDirect(ctx);
      else this.drawSelection(ctx);
      this.drawMarquee(ctx);
      this.drawPen(ctx);
      this.drawPencil(ctx);
      this.drawTextEdit(ctx);

      if (App.rulers) this.drawRulers();
    },

    showAnchors: function () {
      return App.tool === 'direct' || App.tool === 'addAnchor' || App.tool === 'delAnchor';
    },

    drawBackdrop: function (ctx) {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      var step = 40 * App.camera.zoom;
      if (step >= 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        var ox = App.camera.pan.x % step;
        var oy = App.camera.pan.y % step;
        for (var x = ox; x < this.cssW; x += step) {
          for (var y = oy; y < this.cssH; y += step) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    },

    drawArtboard: function (ctx) {
      var a = App.artboard;
      var tl = this.worldToScreen(a.x, a.y);
      var br = this.worldToScreen(a.x + a.w, a.y + a.h);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    },

    drawShape: function (ctx, s) {
      var c = S.center(s);
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.translate(c.x, c.y);
      ctx.rotate(s.rotation);
      ctx.translate(-c.x, -c.y);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = s.strokeWidth;

      var filled = s.fill && s.fill !== 'none';
      var stroke = s.strokeWidth > 0 && s.stroke && s.stroke !== 'none';

      if (s.type === 'line') {
        var p = S.linePoints(s);
        ctx.beginPath();
        ctx.moveTo(p.a.x, p.a.y);
        ctx.lineTo(p.b.x, p.b.y);
        if (stroke) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
      } else if (s.type === 'text') {
        this.drawTextShape(ctx, s, filled, stroke);
      } else if (s.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, Math.max(Math.abs(s.w) / 2, 0.01), Math.max(Math.abs(s.h) / 2, 0.01), 0, 0, Math.PI * 2);
        if (filled) { ctx.fillStyle = s.fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
      } else {
        ctx.beginPath();
        this.traceGeometry(ctx, s);
        if (filled) {
          ctx.fillStyle = s.fill;
          ctx.fill(s.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
        }
        if (stroke) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
      }
      ctx.restore();
    },

    traceGeometry: function (ctx, s) {
      if (s.type === 'roundrect') {
        var r = Math.min(s.radius || 0, Math.min(Math.abs(s.w), Math.abs(s.h)) / 2);
        if (r <= 0) { ctx.rect(s.x, s.y, s.w, s.h); return; }
        var x = s.x, y = s.y, w = s.w, h = s.h;
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
      } else if (s.type === 'polygon') {
        vertsPath(ctx, S.polygonVertices(s));
      } else if (s.type === 'star') {
        vertsPath(ctx, S.starVertices(s));
      } else if (s.type === 'path') {
        S.tracePath(ctx, s);
      } else {
        ctx.rect(s.x, s.y, s.w, s.h);
      }
    },

    drawTextShape: function (ctx, s, filled, stroke) {
      var fontSize = s.fontSize || 48;
      var lh = s.lineHeight || fontSize * 1.2;
      ctx.font = (s.fontWeight || 400) + ' ' + fontSize + 'px ' + (s.fontFamily || 'sans-serif');
      ctx.textBaseline = 'top';
      var lines = String(s.text == null ? '' : s.text).split('\n');
      for (var i = 0; i < lines.length; i++) {
        var y = s.y + i * lh;
        if (filled) { ctx.fillStyle = s.fill; ctx.fillText(lines[i], s.x, y); }
        if (stroke) { ctx.strokeStyle = s.stroke; ctx.strokeText(lines[i], s.x, y); }
      }
    },

    drawSelection: function (ctx) {
      var sel = App.selected();
      if (!sel.length) return;

      if (sel.length === 1) {
        var s = sel[0];
        var pts = S.worldCorners(s);
        this.strokePolygon(ctx, pts, ACCENT, 1.2, 0);
        var h = S.handlePositions(s, App.camera.zoom);
        var top = this.worldToScreen(h.n.x, h.n.y);
        var rs = this.worldToScreen(h.rot.x, h.rot.y);
        ctx.strokeStyle = ACCENT_SOFT;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(rs.x, rs.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rs.x, rs.y, ROT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = ACCENT;
        ctx.stroke();
        S.HANDLE_KEYS.forEach(function (k) {
          var sp = App.worldToScreen(h[k].x, h[k].y);
          drawHandle(ctx, sp.x, sp.y);
        });
      } else {
        var box = S.unionAabb(sel);
        var tl = this.worldToScreen(box.x, box.y);
        var br = this.worldToScreen(box.x + box.w, box.y + box.h);
        ctx.save();
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.restore();
        sel.forEach(function (s2) {
          this.strokePolygon(ctx, S.worldCorners(s2), ACCENT_SOFT, 1, [3, 2]);
        }, this);
      }
    },

    drawDirect: function (ctx) {
      var sel = App.selected();
      if (!sel.length) return;
      var edit = App.edit;

      sel.forEach(function (s) {
        if (s.type !== 'path') return;
        S.subpathsOf(s).forEach(function (sp) {
          if (!sp.points || sp.points.length < 2) return;
          var line = S.samplePoints(sp.points, sp.closed, 14, s.x, s.y);
          this.strokePolyline(ctx, line, ACCENT_SOFT, 1, [3, 2]);
        }, this);

        var active = edit && edit.shapeId === s.id;
        S.anchorRefs(s).forEach(function (ref) {
          var pt = S.subpathPoints(s, ref.sub)[ref.i];
          var aw = S.anchorWorld(s, ref.sub, ref.i);
          var sp = this.worldToScreen(aw.x, aw.y);
          var key = ref.sub + ':' + ref.i;

          if (active && edit.anchors && edit.anchors[key]) {
            ['in', 'out'].forEach(function (which) {
              if (Math.abs(pt[which].x) < 0.001 && Math.abs(pt[which].y) < 0.001) return;
              var hw = S.handleWorld(s, ref.sub, ref.i, which);
              var hp = this.worldToScreen(hw.x, hw.y);
              ctx.save();
              ctx.strokeStyle = ACCENT_SOFT;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(sp.x, sp.y);
              ctx.lineTo(hp.x, hp.y);
              ctx.stroke();
              ctx.fillStyle = ACCENT;
              ctx.beginPath();
              ctx.arc(hp.x, hp.y, 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }, this);
          }

          var selected = active && edit.anchors && edit.anchors[key];
          ctx.save();
          ctx.fillStyle = selected ? ACCENT : '#ffffff';
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.rect(sp.x - 3.4, sp.y - 3.4, 6.8, 6.8);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }, this);
      }, this);
    },

    strokePolyline: function (ctx, pts, color, lw, dash) {
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var sp = this.worldToScreen(pts[i].x, pts[i].y);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
      ctx.restore();
    },

    strokePolygon: function (ctx, pts, color, lw, dash) {
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var sp = this.worldToScreen(pts[i].x, pts[i].y);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },

    drawMarquee: function (ctx) {
      var m = global.Interaction && global.Interaction.marquee;
      if (!m) return;
      var tl = this.worldToScreen(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1));
      var br = this.worldToScreen(Math.max(m.x0, m.x1), Math.max(m.y0, m.y1));
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = ACCENT;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    },

    drawPen: function (ctx) {
      var pen = App.pen;
      if (!pen || !pen.points || !pen.points.length) return;
      var cam = App.camera;

      ctx.save();
      ctx.translate(cam.pan.x, cam.pan.y);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.4 / cam.zoom;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      S.tracePoints(ctx, pen.points, pen.closed, 0, 0);
      ctx.stroke();
      if (pen.hover && !pen.dragging && !pen.closed) {
        var last = pen.points[pen.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.bezierCurveTo(
          last.x + last.out.x, last.y + last.out.y,
          pen.hover.x, pen.hover.y, pen.hover.x, pen.hover.y
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
      }
      ctx.restore();

      pen.points.forEach(function (p, idx) {
        var sp = App.worldToScreen(p.x, p.y);
        var hasIn = p.in.x !== 0 || p.in.y !== 0;
        var hasOut = p.out.x !== 0 || p.out.y !== 0;
        if (hasIn || hasOut) {
          ctx.save();
          ctx.strokeStyle = ACCENT_SOFT;
          ctx.lineWidth = 1;
          if (hasIn) {
            var ip = App.worldToScreen(p.x + p.in.x, p.y + p.in.y);
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ip.x, ip.y); ctx.stroke();
            ctx.fillStyle = ACCENT; dot(ctx, ip.x, ip.y);
          }
          if (hasOut) {
            var op = App.worldToScreen(p.x + p.out.x, p.y + p.out.y);
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(op.x, op.y); ctx.stroke();
            ctx.fillStyle = ACCENT; dot(ctx, op.x, op.y);
          }
          ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = idx === 0 ? '#ffffff' : ACCENT;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.rect(sp.x - 3.4, sp.y - 3.4, 6.8, 6.8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    },

    drawPencil: function (ctx) {
      var p = global.Interaction && global.Interaction.pencil;
      if (!p || !p.points || p.points.length < 2) return;
      var cam = App.camera;
      ctx.save();
      ctx.translate(cam.pan.x, cam.pan.y);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.4 / cam.zoom;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (var i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
      ctx.stroke();
      ctx.restore();
    },

    drawTextEdit: function (ctx) {
      var te = App.textEdit;
      if (!te) return;
      var s = App.shapeById(te.shapeId);
      if (!s) return;
      var tl = this.worldToScreen(s.x, s.y);
      var br = this.worldToScreen(s.x + s.w, s.y + s.h);
      var blink = (Math.floor(Date.now() / 500) % 2) === 0;
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x - 1, tl.y - 1, br.x - tl.x + 2, br.y - tl.y + 2);
      if (blink) {
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(br.x + 1, tl.y);
        ctx.lineTo(br.x + 1, br.y);
        ctx.stroke();
      }
      ctx.restore();
    },

    /* ---------- rulers ---------- */
    drawRulers: function () {
      this.drawRulerH();
      this.drawRulerV();
    },

    niceUnitStep: function (zoom, factor) {
      var steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
      for (var i = 0; i < steps.length; i++) if (steps[i] * factor * zoom >= 60) return steps[i];
      return steps[steps.length - 1];
    },

    stepDecimals: function (stepU) {
      if (stepU >= 10) return 0;
      if (stepU >= 1) return (stepU % 1 === 0) ? 0 : 1;
      return 2;
    },

    drawRulerH: function () {
      var cv = this.rulerTop;
      if (!cv) return;
      var dpr = this.dpr;
      var w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#2b2b2b';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1c1c1c';
      c.beginPath(); c.moveTo(0, h - 0.5); c.lineTo(w, h - 0.5); c.stroke();

      var cam = App.camera;
      var factor = U.UNITS[App.unit] || 1;
      var stepU = this.niceUnitStep(cam.zoom, factor);
      var worldStep = stepU * factor;
      var minor = worldStep / 5;
      var dec = this.stepDecimals(stepU);
      var startWorld = -cam.pan.x / cam.zoom;
      var endWorld = (w - cam.pan.x) / cam.zoom;
      c.fillStyle = '#c8c8c8';
      c.strokeStyle = '#8a8a8a';
      c.font = '9px Segoe UI, Arial, sans-serif';
      c.textBaseline = 'top';
      var first = Math.floor(startWorld / minor) * minor;
      for (var x = first; x <= endWorld; x += minor) {
        var sx = x * cam.zoom + cam.pan.x;
        var isMajor = Math.abs(x / worldStep - Math.round(x / worldStep)) < 1e-6;
        c.beginPath();
        c.moveTo(Math.round(sx) + 0.5, isMajor ? h - 10 : h - 5);
        c.lineTo(Math.round(sx) + 0.5, h);
        c.stroke();
        if (isMajor) c.fillText(U.round(x / factor, dec).toFixed(dec), Math.round(sx) + 2, 2);
      }
      var selBox = App.hasSelection() ? S.unionAabb(App.selected()) : null;
      if (selBox) {
        var a = selBox.x * cam.zoom + cam.pan.x;
        var b = (selBox.x + selBox.w) * cam.zoom + cam.pan.x;
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(a, h - 4, b - a, 4);
      }
    },

    drawRulerV: function () {
      var cv = this.rulerLeft;
      if (!cv) return;
      var dpr = this.dpr;
      var w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#2b2b2b';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1c1c1c';
      c.beginPath(); c.moveTo(w - 0.5, 0); c.lineTo(w - 0.5, h); c.stroke();

      var cam = App.camera;
      var factor = U.UNITS[App.unit] || 1;
      var stepU = this.niceUnitStep(cam.zoom, factor);
      var worldStep = stepU * factor;
      var minor = worldStep / 5;
      var dec = this.stepDecimals(stepU);
      var startWorld = -cam.pan.y / cam.zoom;
      var endWorld = (h - cam.pan.y) / cam.zoom;
      c.fillStyle = '#c8c8c8';
      c.strokeStyle = '#8a8a8a';
      c.font = '9px Segoe UI, Arial, sans-serif';
      c.textBaseline = 'top';
      var first = Math.floor(startWorld / minor) * minor;
      for (var y = first; y <= endWorld; y += minor) {
        var sy = y * cam.zoom + cam.pan.y;
        var isMajor = Math.abs(y / worldStep - Math.round(y / worldStep)) < 1e-6;
        c.beginPath();
        c.moveTo(isMajor ? w - 10 : w - 5, Math.round(sy) + 0.5);
        c.lineTo(w, Math.round(sy) + 0.5);
        c.stroke();
        if (isMajor) {
          var label = U.round(y / factor, dec).toFixed(dec);
          c.save();
          c.translate(2, Math.round(sy) + 2);
          c.rotate(-Math.PI / 2);
          c.fillText(label, -label.length * 5, 0);
          c.restore();
        }
      }
      var selBox = App.hasSelection() ? S.unionAabb(App.selected()) : null;
      if (selBox) {
        var a = selBox.y * cam.zoom + cam.pan.y;
        var b = (selBox.y + selBox.h) * cam.zoom + cam.pan.y;
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(w - 4, a, 4, b - a);
      }
    }
  };

  function vertsPath(ctx, verts) {
    if (!verts.length) return;
    ctx.moveTo(verts[0].x, verts[0].y);
    for (var i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
  }

  function drawHandle(ctx, x, y) {
    var hs = HANDLE_SIZE;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(x - hs / 2, y - hs / 2, hs, hs);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  global.Renderer = Renderer;
})(window);

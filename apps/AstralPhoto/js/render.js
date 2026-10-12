(function (global) {
  'use strict';

  var App = global.App;
  var Layer = global.Layer;
  var Selection = global.Selection;

  var Renderer = {
    canvas: null,
    ctx: null,
    docCanvas: null,
    docCtx: null,
    dpr: 1,
    cssW: 0,
    cssH: 0,
    viewW: 600,
    viewH: 400,
    mouse: null,
    antsOffset: 0,
    _raf: 0,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = global.devicePixelRatio || 1;
      this.resize();
    },

    resize: function () {
      if (!this.canvas) return;
      var parent = this.canvas.parentElement || {};
      var w = this.canvas.clientWidth || parent.clientWidth || 600;
      var h = this.canvas.clientHeight || parent.clientHeight || 400;
      this.viewW = w; this.viewH = h;
      this.dpr = global.devicePixelRatio || 1;
      var bw = Math.max(1, Math.round(w * this.dpr));
      var bh = Math.max(1, Math.round(h * this.dpr));
      if (this.canvas.width !== bw || this.canvas.height !== bh) {
        this.canvas.width = bw;
        this.canvas.height = bh;
      }
      this.draw();
    },

    ensureDocCanvas: function () {
      var doc = App.doc;
      if (!doc) return null;
      var w = doc.width, h = doc.height;
      if (!this.docCanvas || this.docCanvas.width !== w || this.docCanvas.height !== h) {
        this.docCanvas = Layer.newCanvas(w, h);
        this.docCtx = this.docCanvas.getContext('2d');
      }
      return this.docCanvas;
    },

    setMouse: function (screen) { this.mouse = screen; },

    screenToWorld: function (sx, sy) { return App.screenToWorld(sx, sy); },

    draw: function () {
      var ctx = this.ctx;
      if (!ctx || !App.doc) return;
      var doc = App.doc;
      var dpr = this.dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      var tl = App.worldToScreen(0, 0);
      var sw = doc.width * App.camera.zoom;
      var sh = doc.height * App.camera.zoom;

      this.drawCheckerboard(ctx, tl.x * dpr, tl.y * dpr, sw * dpr, sh * dpr);

      var composite = this.ensureDocCanvas();
      if (composite && this.docCtx) {
        this.docCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.docCtx.clearRect(0, 0, doc.width, doc.height);
        App.compositeLayers(this.docCtx, doc.width, doc.height);
        ctx.imageSmoothingEnabled = App.camera.zoom < 3;
        ctx.drawImage(composite, tl.x * dpr, tl.y * dpr, sw * dpr, sh * dpr);
      }

      this.drawGrid(ctx);
      this.drawDocBorder(ctx, tl, sw, sh);
      this.drawSelection(ctx);
      this.drawCrop(ctx);
      this.drawPreview(ctx);
      this.drawBrushCursor(ctx);
    },

    drawCheckerboard: function (ctx, x, y, w, h) {
      if (w <= 0 || h <= 0) return;
      var size = 10 * this.dpr;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#cfcfcf';
      var cols = Math.ceil(w / size);
      var rows = Math.ceil(h / size);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if ((r + c) % 2 === 0) ctx.fillRect(x + c * size, y + r * size, size, size);
        }
      }
      ctx.restore();
    },

    drawGrid: function (ctx) {
      if (!App.showGrid) return;
      var doc = App.doc;
      var step = 50;
      ctx.save();
      this.applyWorld(ctx);
      ctx.lineWidth = 1 / App.camera.zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      for (var x = 0; x <= doc.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, doc.height); }
      for (var y = 0; y <= doc.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(doc.width, y); }
      ctx.stroke();
      ctx.restore();
    },

    drawDocBorder: function (ctx, tl, sw, sh) {
      var dpr = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x * dpr + 0.5, tl.y * dpr + 0.5, sw * dpr, sh * dpr);
    },

    applyWorld: function (ctx) {
      var dpr = this.dpr, cam = App.camera;
      ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * cam.pan.x, dpr * cam.pan.y);
    },

    drawSelection: function (ctx) {
      var sel = App.selection;
      if (Selection.isEmpty(sel)) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var dpr = this.dpr, z = App.camera.zoom;
      ctx.save();
      ctx.beginPath();
      this.traceScreenSelection(ctx, sel, dpr, z);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.antsOffset;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.lineDashOffset = -this.antsOffset + 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    },

    traceScreenSelection: function (ctx, sel, dpr, z) {
      var p0 = App.worldToScreen(sel.x, sel.y);
      if (sel.shape === 'ellipse') {
        ctx.ellipse((p0.x + (sel.w * z) / 2) * dpr, (p0.y + (sel.h * z) / 2) * dpr, (sel.w * z) / 2 * dpr, (sel.h * z) / 2 * dpr, 0, 0, Math.PI * 2);
      } else if (sel.shape === 'lasso' && sel.points.length) {
        var f = sel.points[0];
        var s0 = App.worldToScreen(f.x, f.y);
        ctx.moveTo(s0.x * dpr, s0.y * dpr);
        for (var i = 1; i < sel.points.length; i++) {
          var s = App.worldToScreen(sel.points[i].x, sel.points[i].y);
          ctx.lineTo(s.x * dpr, s.y * dpr);
        }
        ctx.closePath();
      } else {
        ctx.rect(p0.x * dpr, p0.y * dpr, sel.w * z * dpr, sel.h * z * dpr);
      }
    },

    drawCrop: function (ctx) {
      var c = App.cropRect;
      if (!c) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var dpr = this.dpr, z = App.camera.zoom;
      var p = App.worldToScreen(c.x, c.y);
      var x = p.x * dpr, y = p.y * dpr, w = c.w * z * dpr, h = c.h * z * dpr;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.rect(0, 0, this.canvas.width, this.canvas.height);
      ctx.rect(x, y, w, h);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      for (var i = 1; i < 3; i++) {
        ctx.moveTo(x + (w * i) / 3, y); ctx.lineTo(x + (w * i) / 3, y + h);
        ctx.moveTo(x, y + (h * i) / 3); ctx.lineTo(x + w, y + (h * i) / 3);
      }
      ctx.stroke();
      ctx.restore();
    },

    drawPreview: function (ctx) {
      var p = App.preview;
      if (!p) return;
      ctx.save();
      this.applyWorld(ctx);
      ctx.fillStyle = 'rgba(120,170,255,0.25)';
      ctx.strokeStyle = 'rgba(120,170,255,0.9)';
      ctx.lineWidth = 1 / App.camera.zoom;
      if (p.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, Math.abs(p.w) / 2, Math.abs(p.h) / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
      ctx.restore();
    },

    drawBrushCursor: function (ctx) {
      if (!this.mouse) return;
      var t = App.tool;
      if (t !== 'brush' && t !== 'eraser' && t !== 'pencil' && t !== 'clone') return;
      var dpr = this.dpr;
      var r = (App.brush.size / 2) * App.camera.zoom * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.mouse.x * dpr, this.mouse.y * dpr, Math.max(1, r), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },

    tick: function () {
      this.antsOffset = (this.antsOffset + 0.5) % 8;
      if (!Selection.isEmpty(App.selection) || App.cropRect) this.draw();
    },

    startAnim: function () {
      var self = this;
      if (this._raf && global.cancelAnimationFrame) global.cancelAnimationFrame(this._raf);
      function loop() {
        self.tick();
        self._raf = global.requestAnimationFrame ? global.requestAnimationFrame(loop) : 0;
      }
      if (global.requestAnimationFrame) this._raf = global.requestAnimationFrame(loop);
    }
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);

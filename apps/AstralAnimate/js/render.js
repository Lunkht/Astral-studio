(function (global) {
  'use strict';

  var S = global.Shapes;
  var L = global.Layer;
  var App = global.App;

  function drawGrid(ctx, doc, zoom) {
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = 'rgba(120,120,120,0.22)';
    ctx.beginPath();
    var step = 20;
    for (var x = 0; x <= doc.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, doc.height); }
    for (var y = 0; y <= doc.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(doc.width, y); }
    ctx.stroke();
    ctx.restore();
  }

  function drawOnion(ctx, doc) {
    var offsets = [-2, -1, 1, 2];
    for (var o = 0; o < offsets.length; o++) {
      var d = offsets[o];
      var f = App.currentFrame + d;
      if (f < 0 || f >= doc.frameCount) continue;
      var alpha = 0.22 / Math.abs(d);
      for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (!layer.visible) continue;
        var shapes = L.renderAt(layer, f);
        for (var j = 0; j < shapes.length; j++) S.draw(ctx, shapes[j], { alpha: alpha });
      }
    }
  }

  function drawSelection(ctx, zoom) {
    var shapes = App.selectedShapes();
    if (!shapes.length) return;
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#9ad0ff';
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    for (var i = 0; i < shapes.length; i++) {
      var b = S.bounds(shapes[i]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
      var h = 4 / zoom;
      ctx.fillStyle = '#9ad0ff';
      var corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
      for (var c = 0; c < corners.length; c++) {
        ctx.fillRect(corners[c][0] - h / 2, corners[c][1] - h / 2, h, h);
      }
      ctx.setLineDash([4 / zoom, 3 / zoom]);
    }
    ctx.restore();
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

    draw: function () {
      if (!this.ctx || !App.doc) return;
      var ctx = this.ctx;
      var doc = App.doc;
      var cam = App.camera;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#202020';
      ctx.fillRect(0, 0, this.w, this.h);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      ctx.fillStyle = doc.background;
      ctx.fillRect(0, 0, doc.width, doc.height);

      if (App.grid) drawGrid(ctx, doc, cam.zoom);
      if (App.onion) drawOnion(ctx, doc);

      for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (!layer.visible) continue;
        var shapes = L.renderAt(layer, App.currentFrame);
        for (var j = 0; j < shapes.length; j++) S.draw(ctx, shapes[j]);
      }

      if (global.Interaction && global.Interaction.preview) {
        S.draw(ctx, global.Interaction.preview, { alpha: 0.7 });
      }

      drawSelection(ctx, cam.zoom);

      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(cam.x + 0.5, cam.y + 0.5, doc.width * cam.zoom - 1, doc.height * cam.zoom - 1);
      ctx.restore();
    }
  };

  global.Renderer = Renderer;
})(window);

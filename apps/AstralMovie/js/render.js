(function (global) {
  'use strict';

  var App = global.App;
  var P = global.Project;
  var U = global.Utils;

  var Renderer = {
    canvas: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,
    comp: { x: 0, y: 0, w: 0, h: 0, scale: 1 },

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
    },

    resize: function () {
      if (!this.canvas) return;
      var parent = this.canvas.parentElement;
      var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
      var w = Math.max(1, Math.round((rect && rect.width) || this.canvas.clientWidth || 640));
      var h = Math.max(1, Math.round((rect && rect.height) || this.canvas.clientHeight || 360));
      this.dpr = global.devicePixelRatio || 1;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.w = w;
      this.h = h;
      this.draw();
    },

    computeComp: function () {
      if (!App.project) return;
      var W = App.project.width, H = App.project.height;
      var margin = 24;
      var scale = Math.min((this.w - margin * 2) / W, (this.h - margin * 2) / H);
      scale = Math.max(0.01, scale);
      var cw = W * scale, ch = H * scale;
      this.comp = { x: (this.w - cw) / 2, y: (this.h - ch) / 2, w: cw, h: ch, scale: scale };
    },

    draw: function () {
      if (!this.ctx || !App.project) return;
      var ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, this.w, this.h);

      this.computeComp();
      var c = this.comp;
      var W = App.project.width, H = App.project.height;

      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.clip();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);

      ctx.fillStyle = App.project.background || '#000000';
      ctx.fillRect(0, 0, W, H);

      var visuals = P.visualClipsAt(App.project, App.playhead);
      if (!visuals.length) this.drawEmpty(ctx, W, H);
      for (var i = 0; i < visuals.length; i++) this.drawClip(ctx, visuals[i].clip, W, H);

      ctx.restore();

      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

      ctx.fillStyle = '#8a8a8a';
      ctx.font = '11px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(U.timecode(App.playhead, App.project.fps), 8, 8);
    },

    drawEmpty: function (ctx, W, H) {
      ctx.fillStyle = '#4a4a4a';
      ctx.font = Math.round(H * 0.045) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Aucun média à cette position', W / 2, H / 2);
    },

    drawClip: function (ctx, clip, W, H) {
      if (clip.type === 'title') { this.drawTitle(ctx, clip, W, H); return; }
      var asset = App.assetById(clip.assetId);
      var el = asset && asset.element;
      if (!el) return;
      var iw = el.videoWidth || el.naturalWidth || asset.width || 0;
      var ih = el.videoHeight || el.naturalHeight || asset.height || 0;
      if (!iw || !ih) return;
      if (clip.type === 'video' && el.readyState !== undefined && el.readyState < 2) return;
      var s = Math.min(W / iw, H / ih);
      var dw = iw * s, dh = ih * s;
      ctx.save();
      ctx.globalAlpha = U.clamp(clip.opacity, 0, 1);
      try { ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { /* ignore */ }
      ctx.restore();
    },

    drawTitle: function (ctx, clip, W, H) {
      ctx.save();
      ctx.globalAlpha = U.clamp(clip.opacity, 0, 1);
      ctx.fillStyle = clip.color;
      ctx.font = '600 ' + clip.fontSize + 'px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = clip.align || 'center';
      ctx.textBaseline = 'middle';
      var x = clip.align === 'left' ? W * 0.08 : clip.align === 'right' ? W * 0.92 : W / 2;
      ctx.fillText(clip.text, x, H / 2);
      ctx.restore();
    },

    toComp: function (sx, sy) {
      var c = this.comp;
      if (!c.scale) return { x: 0, y: 0 };
      return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale };
    }
  };

  global.Renderer = Renderer;
})(window);

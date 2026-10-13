(function (global) {
  'use strict';

  var U = global.Utils;
  var App = global.App;
  var Track = global.Track;
  var Clip = global.Clip;

  var RULER_H = 24;

  var Renderer = {
    canvas: null,
    ctx: null,
    scrollX: 0
  };

  Renderer.init = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    return this;
  };

  Renderer.resize = function () {
    if (!this.canvas) return;
    var w = this.canvas.clientWidth || 900;
    var h = this.canvas.clientHeight || 400;
    if (w > 0) this.canvas.width = w;
    if (h > 0) this.canvas.height = h;
  };

  Renderer.x = function (t) {
    return t * App.zoom - this.scrollX;
  };

  Renderer.timeAt = function (px) {
    return (px + this.scrollX) / App.zoom;
  };

  Renderer.trackTops = function () {
    var out = [];
    var y = RULER_H;
    var tracks = App.project ? App.project.tracks : [];
    for (var i = 0; i < tracks.length; i++) {
      out.push({ track: tracks[i], y: y, h: tracks[i].height });
      y += tracks[i].height;
    }
    return out;
  };

  Renderer.trackAtY = function (py) {
    var tops = this.trackTops();
    for (var i = 0; i < tops.length; i++) {
      if (py >= tops[i].y && py < tops[i].y + tops[i].h) return tops[i].track;
    }
    return null;
  };

  Renderer.niceStep = function () {
    var cands = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] * App.zoom >= 64) return cands[i];
    }
    return 600;
  };

  function peaksRange(data, s0, s1, buckets) {
    var out = new Array(buckets);
    if (!data || !data.length) {
      for (var b = 0; b < buckets; b++) out[b] = [0, 0];
      return out;
    }
    s0 = U.clamp(Math.round(s0), 0, data.length);
    s1 = U.clamp(Math.round(s1), 0, data.length);
    var span = Math.max(1, s1 - s0);
    var ratio = span / buckets;
    for (var i = 0; i < buckets; i++) {
      var a = s0 + Math.floor(i * ratio);
      var z = s0 + Math.floor((i + 1) * ratio);
      if (z <= a) z = a + 1;
      if (z > s1) z = s1;
      var mn = 1e9, mx = -1e9;
      for (var c = 0; c < data.channels.length; c++) {
        var ch = data.channels[c];
        for (var k = a; k < z; k++) {
          var v = ch[k];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }
      if (mn > mx) { mn = 0; mx = 0; }
      out[i] = [mn, mx];
    }
    return out;
  }

  Renderer.draw = function () {
    var ctx = this.ctx;
    if (!ctx || !App.project) return;
    var w = this.canvas.width, h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, w, h);

    var tops = this.trackTops();
    this.drawGrid(ctx, w, h);

    for (var i = 0; i < tops.length; i++) {
      this.drawTrack(ctx, tops[i], w);
    }

    this.drawRegion(ctx, tops);
    this.drawPlayhead(ctx, h);
  };

  Renderer.drawGrid = function (ctx, w, h) {
    var step = this.niceStep();
    var duration = Math.max(App.duration(), this.timeAt(w));
    var start = Math.floor(this.timeAt(0) / step) * step;
    ctx.strokeStyle = '#2a2a2a';
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
    for (var t = start; t <= this.timeAt(w) + step; t += step) {
      if (t < 0) continue;
      var px = Math.round(this.x(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, RULER_H);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.fillText(U.formatTime(t), px + 3, 15);
    }
    ctx.strokeStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(0, RULER_H + 0.5);
    ctx.lineTo(w, RULER_H + 0.5);
    ctx.stroke();
    void duration;
  };

  Renderer.drawTrack = function (ctx, top, w) {
    var track = top.track;
    ctx.fillStyle = track === App.currentTrack() ? '#242a30' : '#202020';
    ctx.fillRect(0, top.y, w, top.h);
    ctx.strokeStyle = '#2f2f2f';
    ctx.beginPath();
    ctx.moveTo(0, top.y + top.h - 0.5);
    ctx.lineTo(w, top.y + top.h - 0.5);
    ctx.stroke();

    var clips = Track.sortedClips(track);
    for (var i = 0; i < clips.length; i++) this.drawClip(ctx, top, clips[i]);
  };

  Renderer.drawClip = function (ctx, top, clip) {
    var asset = App.assetById(clip.assetId);
    var x0 = this.x(clip.start);
    var x1 = this.x(Clip.end(clip));
    if (x1 < 0 || x0 > this.canvas.width) return;
    var pad = 3;
    var y = top.y + pad;
    var hh = top.h - pad * 2;
    var selected = App.selectedClipId === clip.id;

    ctx.fillStyle = selected ? '#3d5a7d' : '#31465e';
    ctx.fillRect(x0, y, Math.max(1, x1 - x0), hh);
    ctx.strokeStyle = selected ? '#4aa3ff' : '#456a8f';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y + 0.5, Math.max(0, x1 - x0 - 1), hh - 1);

    if (asset && asset.data) {
      var mid = y + hh / 2;
      var buckets = Math.max(1, Math.round(x1 - x0));
      var sr = asset.data.sampleRate;
      var s0 = clip.offset * sr;
      var s1 = (clip.offset + clip.duration) * sr;
      var pk = peaksRange(asset.data, s0, s1, buckets);
      ctx.strokeStyle = '#9ec3e6';
      ctx.beginPath();
      for (var b = 0; b < buckets; b++) {
        var px = x0 + b;
        var amp = hh / 2 - 2;
        ctx.moveTo(px + 0.5, mid - pk[b][1] * amp);
        ctx.lineTo(px + 0.5, mid - pk[b][0] * amp);
      }
      ctx.stroke();
      ctx.strokeStyle = '#5c86ad';
      ctx.beginPath();
      ctx.moveTo(x0, mid + 0.5);
      ctx.lineTo(x1, mid + 0.5);
      ctx.stroke();
    }

    if (clip.fadeIn > 0) {
      var fw = clip.fadeIn * App.zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + fw, y);
      ctx.lineTo(x0, y + hh);
      ctx.closePath();
      ctx.fill();
    }
    if (clip.fadeOut > 0) {
      var fw2 = clip.fadeOut * App.zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 - fw2, y);
      ctx.lineTo(x1, y + hh);
      ctx.closePath();
      ctx.fill();
    }
  };

  Renderer.drawRegion = function (ctx, tops) {
    var sel = App.selection;
    if (!sel.active || sel.t1 <= sel.t0) return;
    var track = App.trackById(sel.trackId) || App.currentTrack();
    var top = null;
    for (var i = 0; i < tops.length; i++) if (tops[i].track === track) top = tops[i];
    if (!top) return;
    var x0 = this.x(sel.t0), x1 = this.x(sel.t1);
    ctx.fillStyle = 'rgba(74,163,255,0.18)';
    ctx.fillRect(x0, top.y, x1 - x0, top.h);
    ctx.strokeStyle = 'rgba(74,163,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, top.y + 0.5, x1 - x0 - 1, top.h - 1);
  };

  Renderer.drawPlayhead = function (ctx, h) {
    var px = Math.round(this.x(App.time)) + 0.5;
    ctx.strokeStyle = '#4aa3ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 8);
    ctx.closePath();
    ctx.fill();
  };

  Renderer.RULER_H = RULER_H;
  global.Renderer = Renderer;
})(window);

(function (global) {
  'use strict';

  var App = global.App;
  var Layer = global.Layer;
  var Effects = global.Effects;

  var Export = {};

  function opFor(id) {
    var map = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay', lighter: 'lighter', difference: 'difference' };
    return map[id] || 'source-over';
  }

  Export.renderComp = function (ctx, comp, t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, comp.width, comp.height);
    ctx.fillStyle = comp.background;
    ctx.fillRect(0, 0, comp.width, comp.height);
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
  };

  Export.renderCanvas = function (t) {
    var comp = App.comp;
    var canvas = document.createElement('canvas');
    canvas.width = comp.width;
    canvas.height = comp.height;
    var ctx = canvas.getContext('2d');
    this.renderComp(ctx, comp, t == null ? App.time : t);
    return canvas;
  };

  Export.download = function (name, url) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  Export.framePNG = function (opts) {
    opts = opts || {};
    if (!App.comp) return null;
    var canvas = this.renderCanvas(App.time);
    var url = canvas.toDataURL('image/png');
    if (opts.download !== false) this.download(opts.name || (App.comp.name + '.png'), url);
    return url;
  };

  Export.projectJSON = function (opts) {
    opts = opts || {};
    if (!App.comp) return null;
    var assets = App.assets.list.map(function (a) {
      return { id: a.id, name: a.name, kind: a.kind, width: a.width, height: a.height, duration: a.duration };
    });
    var data = { version: 1, comp: App.comp, assets: assets };
    var json = JSON.stringify(data, null, 2);
    if (opts.download) {
      var blob = new global.Blob([json], { type: 'application/json' });
      this.download(opts.name || (App.comp.name + '.json'), global.URL.createObjectURL(blob));
    }
    return json;
  };

  Export.canRecord = function () {
    return !!(global.MediaRecorder && global.HTMLCanvasElement && global.HTMLCanvasElement.prototype.captureStream);
  };

  Export.pickMime = function () {
    if (!global.MediaRecorder || !global.MediaRecorder.isTypeSupported) return '';
    var cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < cands.length; i++) {
      if (global.MediaRecorder.isTypeSupported(cands[i])) return cands[i];
    }
    return '';
  };

  Export.video = function (opts) {
    opts = opts || {};
    var comp = App.comp;
    if (!comp || !comp.layers.length) return false;
    if (!this.canRecord()) return false;

    var canvas = document.createElement('canvas');
    canvas.width = comp.width;
    canvas.height = comp.height;
    var ctx = canvas.getContext('2d');
    var self = this;
    var stream = canvas.captureStream(comp.fps);
    var mime = this.pickMime();
    var rec;
    try { rec = new global.MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
    catch (e) { return false; }

    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var blob = new global.Blob(chunks, { type: mime || 'video/webm' });
      if (opts.onDone) opts.onDone(blob);
    };

    var prevTime = App.time, wasPlaying = App.playing;
    App.playing = false;
    var t0 = global.performance ? global.performance.now() : Date.now();
    rec.start();

    function frame(now) {
      now = now || (global.performance ? global.performance.now() : Date.now());
      var t = (now - t0) / 1000;
      if (t >= comp.duration) {
        self.renderComp(ctx, comp, comp.duration);
        try { rec.stop(); } catch (e) { /* ignore */ }
        App.time = prevTime;
        App.playing = wasPlaying;
        App.emit('change');
        return;
      }
      self.renderComp(ctx, comp, t);
      if (opts.onProgress) opts.onProgress(t / comp.duration);
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
    return true;
  };

  global.Export = Export;
})(window);

(function (global) {
  'use strict';

  var App = global.App;
  var Player = global.Player;
  var Renderer = global.Renderer;
  var U = global.Utils;

  function download(filename, href) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    if (document.body && document.body.appendChild) document.body.appendChild(a);
    if (a.click) a.click();
    if (document.body && document.body.removeChild) document.body.removeChild(a);
  }

  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    var list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }

  var Export = {
    projectJSON: function () {
      var data = {
        app: 'AstralMovie',
        version: 1,
        project: App.project,
        assets: App.assets.map(function (a) {
          return { id: a.id, kind: a.kind, name: a.name, duration: U.round(a.duration, 3), width: a.width, height: a.height };
        })
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      download('AstralMovie.json', URL.createObjectURL(blob));
    },

    framePNG: function () {
      if (!Renderer.canvas || !Renderer.canvas.toDataURL) return;
      var name = 'AstralMovie_' + U.timecode(App.playhead, App.project.fps).replace(/:/g, '-') + '.png';
      download(name, Renderer.canvas.toDataURL('image/png'));
    },

    canRecord: function () {
      return typeof MediaRecorder !== 'undefined' && Renderer.canvas && !!Renderer.canvas.captureStream;
    },

    video: function (onDone) {
      if (!this.canRecord() || !App.project.clips.length) {
        if (onDone) onDone(false);
        return false;
      }
      if (App.playing) Player.pause();
      if (App.playhead >= App.totalDuration()) App.setPlayhead(0);

      var canvas = Renderer.canvas;
      var stream = canvas.captureStream(App.project.fps || 30);
      var mime = pickMime();
      var rec;
      try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
      catch (e) { if (onDone) onDone(false); return false; }

      var chunks = [];
      var stopped = false;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: 'video/webm' });
        download('AstralMovie.webm', URL.createObjectURL(blob));
        if (onDone) onDone(true);
      };

      var onPlaying = function () {
        if (!App.playing && !stopped) {
          stopped = true;
          setTimeout(function () { try { rec.stop(); } catch (e) { /* ignore */ } }, 250);
        }
      };
      App.on('playing', onPlaying);

      App.setPlayhead(0);
      rec.start();
      setTimeout(function () { Player.play(); }, 120);
      return true;
    }
  };

  global.Export = Export;
})(window);

(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Track = global.Track;

  var Interaction = {
    canvas: null,
    mode: 'idle',
    _start: null
  };

  function pos(canvas, e) {
    var r = canvas.getBoundingClientRect();
    var sx = canvas.width / (r.width || 1);
    var sy = canvas.height / (r.height || 1);
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function isTyping(e) {
    var el = e.target;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  Interaction.init = function (canvas) {
    this.canvas = canvas;
    var self = this;
    canvas.addEventListener('pointerdown', function (e) { self.onDown(e); });
    canvas.addEventListener('pointermove', function (e) { self.onMove(e); });
    global.addEventListener('pointerup', function (e) { self.onUp(e); });
    canvas.addEventListener('wheel', function (e) { self.onWheel(e); }, { passive: false });
    document.addEventListener('keydown', function (e) { self.onKey(e); });
    return this;
  };

  Interaction.onDown = function (e) {
    var p = pos(this.canvas, e);
    if (e.button === 1) { this.mode = 'pan'; this._start = { x: p.x, scrollX: Renderer.scrollX }; return; }
    if (p.y < Renderer.RULER_H) {
      this.mode = 'scrub';
      App.seek(Renderer.timeAt(p.x));
      return;
    }
    var track = Renderer.trackAtY(p.y);
    if (!track) { this.mode = 'idle'; return; }
    var t = Math.max(0, Renderer.timeAt(p.x));
    this.mode = 'region';
    this._start = { t: t, trackId: track.id, x: p.x };
    App.selection.trackId = track.id;
    var clip = Track.clipAt(track, t);
    if (clip) App.selectedClipId = clip.id;
    else App.selectedClipId = null;
    App.setRegion(track.id, t, t);
    App.emit('change');
  };

  Interaction.onMove = function (e) {
    if (this.mode === 'idle' || !this._start) return;
    var p = pos(this.canvas, e);
    if (this.mode === 'pan') {
      Renderer.scrollX = this._start.scrollX - (p.x - this._start.x);
      App.emit('change');
      return;
    }
    if (this.mode === 'scrub') {
      App.seek(Renderer.timeAt(p.x));
      return;
    }
    if (this.mode === 'region') {
      var t = Math.max(0, Renderer.timeAt(p.x));
      App.setRegion(this._start.trackId, this._start.t, t);
    }
  };

  Interaction.onUp = function (e) {
    if (this.mode === 'region' && this._start) {
      var p = pos(this.canvas, e);
      if (Math.abs(p.x - this._start.x) < 3) {
        App.clearRegion();
      }
    }
    this.mode = 'idle';
    this._start = null;
    App.emit('change');
  };

  Interaction.onWheel = function (e) {
    e.preventDefault();
    var p = pos(this.canvas, e);
    if (e.shiftKey) {
      Renderer.scrollX = Math.max(0, Renderer.scrollX + e.deltaY / App.zoom * App.zoom);
      App.emit('change');
      return;
    }
    var t = Renderer.timeAt(p.x);
    var factor = e.deltaY < 0 ? 1.15 : 0.87;
    var nz = Math.min(1200, Math.max(4, App.zoom * factor));
    App.zoom = nz;
    Renderer.scrollX = Math.max(0, t * nz - p.x);
    App.emit('change');
  };

  Interaction.onKey = function (e) {
    if (isTyping(e)) return;
    var ctrl = e.ctrlKey || e.metaKey;
    var shift = e.shiftKey;
    var key = e.key;

    if (ctrl) {
      if (key === 'z' || key === 'Z') { e.preventDefault(); if (shift) App.redo(); else App.undo(); return; }
      if (key === 'y' || key === 'Y') { e.preventDefault(); App.redo(); return; }
      if (key === 'c' || key === 'C') { e.preventDefault(); App.regionCopy(); return; }
      if (key === 'x' || key === 'X') { e.preventDefault(); App.regionCut(); return; }
      if (key === 'v' || key === 'V') { e.preventDefault(); App.paste(); return; }
      return;
    }

    if (key === ' ') { e.preventDefault(); App.togglePlay(); return; }
    if (key === 'ArrowRight') { e.preventDefault(); App.stepFrame(shift ? 10 : 1); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); App.stepFrame(shift ? -10 : -1); return; }
    if (key === 'Home') { e.preventDefault(); App.goStart(); return; }
    if (key === 'End') { e.preventDefault(); App.goEnd(); return; }
    if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); if (App.selection.active) App.regionDelete(); else App.deleteSelectedClip(); return; }
    if (key === 'i' || key === 'I') { App.insertSilence(1); return; }
    if (key === 'm' || key === 'M') { var t = App.currentTrack(); if (t) App.toggleMute(t.id); return; }
    if (key === 's' || key === 'S') { var t2 = App.currentTrack(); if (t2) App.toggleSolo(t2.id); return; }
    if (key === '+') { App.zoomBy(1.25); return; }
    if (key === '-') { App.zoomBy(0.8); return; }
  };

  global.Interaction = Interaction;
})(window);

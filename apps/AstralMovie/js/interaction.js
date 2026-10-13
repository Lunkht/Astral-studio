(function (global) {
  'use strict';

  var App = global.App;
  var Player = global.Player;

  var Interaction = {
    canvas: null,

    init: function (canvas) {
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('click', function () { App.togglePlay(); });
      global.addEventListener('keydown', function (e) { self.key(e); });
    },

    key: function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (!App.project) return;
      var ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        var k = e.key.toLowerCase();
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); return; }
        if (k === 'y') { e.preventDefault(); App.redo(); return; }
        if (k === 'd') { e.preventDefault(); App.duplicateSelection(); return; }
        if (k === '0') { e.preventDefault(); App.setZoom(90); return; }
        if (k === '=' || k === '+') { e.preventDefault(); App.zoomBy(1.25); return; }
        if (k === '-') { e.preventDefault(); App.zoomBy(0.8); return; }
        return;
      }

      if (e.key === ' ') { e.preventDefault(); App.togglePlay(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); App.deleteSelection(); return; }
      if (e.key === 'Home') { e.preventDefault(); App.goStart(); return; }
      if (e.key === 'End') { e.preventDefault(); App.goEnd(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); App.stepFrame(e.shiftKey ? -10 : -1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); App.stepFrame(e.shiftKey ? 10 : 1); return; }
      var key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); App.splitAtPlayhead(); return; }
      if (key === 't') { e.preventDefault(); App.addTitle('Titre'); return; }
      if (key === 'l') { e.preventDefault(); Player.toggle(); return; }
      if (e.key === '[') { e.preventDefault(); App.setPlayhead(App.playhead - 1); return; }
      if (e.key === ']') { e.preventDefault(); App.setPlayhead(App.playhead + 1); return; }
    }
  };

  global.Interaction = Interaction;
})(window);

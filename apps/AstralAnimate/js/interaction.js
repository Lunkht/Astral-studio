(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;
  var L = global.Layer;
  var App = global.App;
  var Tools = global.Tools;
  var Renderer = global.Renderer;

  var Interaction = {
    canvas: null,
    preview: null,
    _drag: null,
    _start: null,
    _points: null,

    init: function (canvas) {
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('pointerdown', function (e) { self.down(e); });
      canvas.addEventListener('pointermove', function (e) { self.move(e); });
      canvas.addEventListener('pointerup', function (e) { self.up(e); });
      canvas.addEventListener('pointerleave', function (e) { if (self._drag) self.up(e); });
      canvas.addEventListener('wheel', function (e) { self.wheel(e); }, { passive: false });
      global.addEventListener('keydown', function (e) { self.key(e); });
    },

    _local: function (e) {
      var r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    down: function (e) {
      if (!App.doc) return;
      this.canvas.focus();
      var p = this._local(e);
      var world = App.toWorld(p.x, p.y);
      this._start = world;
      this._downScreen = p;
      var tool = App.tool;

      if (e.button === 1 || tool === 'hand') {
        this._drag = { mode: 'pan', sx: p.x, sy: p.y, cx: App.camera.x, cy: App.camera.y };
        this.preview = null;
        return;
      }

      if (tool === 'select') {
        var layer = App.activeLayer();
        var hit = null;
        if (layer) {
          var key = L.keyAt(layer, App.currentFrame);
          var shapes = key ? key.shapes : [];
          var tol = 4 / App.camera.zoom;
          for (var i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].locked) continue;
            if (S.hitTest(shapes[i], world.x, world.y, tol)) { hit = shapes[i]; break; }
          }
        }
        if (hit) {
          if (e.shiftKey) App.select(hit.id, true);
          else if (!App.selection[hit.id]) App.select(hit.id);
          this._drag = { mode: 'move', shapes: this._snapshotSelected() };
        } else {
          App.clearSelection();
          this._drag = null;
        }
        return;
      }

      if (tool === 'rect' || tool === 'ellipse') {
        this.preview = Tools.fromDrag(tool, world.x, world.y, world.x, world.y, App.style);
        this._drag = { mode: 'draw' };
        return;
      }

      if (tool === 'line') {
        this.preview = Tools.line(world.x, world.y, world.x, world.y, App.style);
        this._drag = { mode: 'draw' };
        return;
      }

      if (tool === 'pencil') {
        this._points = [{ x: world.x, y: world.y }];
        this.preview = Tools.pencil(this._points, App.style);
        this._drag = { mode: 'pencil' };
        return;
      }

      if (tool === 'text') {
        var str = global.prompt ? global.prompt('Texte :', '') : null;
        if (str) {
          App.addShape(Tools.text(world.x, world.y, str, App.style));
          Renderer.draw();
        }
        return;
      }

      if (tool === 'zoom') {
        App.zoomAt(p.x, p.y, e.altKey ? 0.8 : 1.25);
        Renderer.draw();
      }
    },

    _snapshotSelected: function () {
      var shapes = App.selectedShapes();
      return shapes.map(function (s) {
        return {
          ref: s,
          ox: s.x, oy: s.y,
          points: s.points ? s.points.map(function (p) { return { x: p.x, y: p.y }; }) : null
        };
      });
    },

    move: function (e) {
      if (!App.doc) return;
      var p = this._local(e);
      var world = App.toWorld(p.x, p.y);
      if (global.UI && global.UI.setCoords) global.UI.setCoords(world.x, world.y);
      if (!this._drag) return;

      if (this._drag.mode === 'pan') {
        App.camera.x = this._drag.cx + (p.x - this._drag.sx);
        App.camera.y = this._drag.cy + (p.y - this._drag.sy);
        App.emit('change');
        return;
      }

      if (this._drag.mode === 'move') {
        var dx = world.x - this._start.x;
        var dy = world.y - this._start.y;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        for (var i = 0; i < this._drag.shapes.length; i++) {
          var snap = this._drag.shapes[i];
          snap.ref.x = snap.ox + dx;
          snap.ref.y = snap.oy + dy;
          if (snap.points) {
            for (var j = 0; j < snap.points.length; j++) {
              snap.ref.points[j].x = snap.points[j].x + dx;
              snap.ref.points[j].y = snap.points[j].y + dy;
            }
          }
        }
        App.emit('change');
        return;
      }

      if (this._drag.mode === 'draw' && this.preview) {
        if (this.preview.points) {
          this.preview.points = [{ x: this._start.x, y: this._start.y }, { x: world.x, y: world.y }];
          this.preview.x = this._start.x;
          this.preview.y = this._start.y;
        } else {
          this.preview.x = Math.min(this._start.x, world.x);
          this.preview.y = Math.min(this._start.y, world.y);
          this.preview.w = Math.abs(world.x - this._start.x);
          this.preview.h = Math.abs(world.y - this._start.y);
          this.preview.type = App.tool === 'ellipse' ? 'ellipse' : 'rect';
        }
        Renderer.draw();
        return;
      }

      if (this._drag.mode === 'pencil') {
        var last = this._points[this._points.length - 1];
        if (U.dist(last.x, last.y, world.x, world.y) > 2 / App.camera.zoom) {
          this._points.push({ x: world.x, y: world.y });
          this.preview.points = this._points.slice();
          Renderer.draw();
        }
      }
    },

    up: function () {
      if (!this._drag) { this.preview = null; return; }
      var mode = this._drag.mode;

      if (mode === 'draw' && this.preview) {
        var pv = this.preview;
        var big = pv.points ? pv.points.length > 1 && (pv.points[0].x !== pv.points[1].x || pv.points[0].y !== pv.points[1].y)
          : (pv.w > 1 || pv.h > 1);
        if (big) App.addShape(pv);
      } else if (mode === 'pencil' && this._points && this._points.length > 1) {
        App.addShape(Tools.pencil(this._points, App.style));
      } else if (mode === 'move') {
        App.commit('Déplacer');
      }

      this._drag = null;
      this.preview = null;
      this._points = null;
      Renderer.draw();
    },

    wheel: function (e) {
      if (!App.doc) return;
      e.preventDefault();
      var p = this._local(e);
      App.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.1 : 0.9);
      Renderer.draw();
    },

    key: function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (!App.doc) return;
      var ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        var k = e.key.toLowerCase();
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); Renderer.draw(); if (global.UI) global.UI.render(); return; }
        if (k === 'y') { e.preventDefault(); App.redo(); Renderer.draw(); if (global.UI) global.UI.render(); return; }
        if (k === '0') { e.preventDefault(); this.fit(); return; }
        if (k === '+' || k === '=') { e.preventDefault(); App.zoomAt(Renderer.w / 2, Renderer.h / 2, 1.25); Renderer.draw(); return; }
        if (k === '-') { e.preventDefault(); App.zoomAt(Renderer.w / 2, Renderer.h / 2, 0.8); Renderer.draw(); return; }
        if (k === 'd') { e.preventDefault(); if (global.UI) global.UI.duplicate(); return; }
        return;
      }

      var toolKeys = { v: 'select', r: 'rect', o: 'ellipse', l: 'line', p: 'pencil', t: 'text', h: 'hand', z: 'zoom' };
      if (toolKeys[e.key.toLowerCase()] && !e.altKey) {
        if (global.UI) global.UI.setTool(toolKeys[e.key.toLowerCase()]);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        App.deleteSelection();
        Renderer.draw();
        if (global.UI) global.UI.render();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        var step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') App.moveSelection(-step, 0);
        if (e.key === 'ArrowRight') App.moveSelection(step, 0);
        if (e.key === 'ArrowUp') App.moveSelection(0, -step);
        if (e.key === 'ArrowDown') App.moveSelection(0, step);
        App.commit('Déplacer');
        Renderer.draw();
        return;
      }
      if (e.key === ',') { App.prevFrame(); Renderer.draw(); if (global.UI) global.UI.render(); return; }
      if (e.key === '.') { App.nextFrame(); Renderer.draw(); if (global.UI) global.UI.render(); return; }
      if (e.key === 'Enter') { e.preventDefault(); global.Timeline.toggle(); return; }
      if (e.key === ' ') { e.preventDefault(); global.Timeline.toggle(); return; }
      if (e.key === 'F6') {
        e.preventDefault();
        if (e.shiftKey) App.removeKey(); else App.addKey();
        Renderer.draw();
        if (global.UI) global.UI.render();
      }
    },

    fit: function () {
      App.fit(Renderer.w, Renderer.h);
      Renderer.draw();
      if (global.UI) global.UI.render();
    }
  };

  global.Interaction = Interaction;
})(window);

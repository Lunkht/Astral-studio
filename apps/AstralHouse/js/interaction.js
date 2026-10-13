(function (global) {
  'use strict';

  var G = global.Geom;
  var App = global.App;
  var Renderer = global.Renderer;
  var Tools = global.Tools;

  var SNAP_PX = 11;

  var Interaction = {
    canvas: null,
    _drag: null,
    _space: false,

    init: function (canvas) {
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('pointerdown', function (e) { self.down(e); });
      canvas.addEventListener('pointermove', function (e) { self.move(e); });
      canvas.addEventListener('pointerup', function (e) { self.up(e); });
      canvas.addEventListener('pointerleave', function (e) { if (self._drag) self.up(e); });
      canvas.addEventListener('dblclick', function (e) { self.dblclick(e); });
      canvas.addEventListener('wheel', function (e) { self.wheel(e); }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      global.addEventListener('keydown', function (e) { self.key(e); });
      global.addEventListener('keyup', function (e) { self.keyup(e); });
    },

    _local: function (e) {
      var r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    _tolWorld: function () { return SNAP_PX / App.viewport.scale; },

    _rectFrom: function (a, b) {
      return {
        min: G.v(Math.min(a.x, b.x), Math.min(a.y, b.y)),
        max: G.v(Math.max(a.x, b.x), Math.max(a.y, b.y))
      };
    },

    down: function (e) {
      if (!App.drawing) return;
      this.canvas.focus();
      var p = this._local(e);
      var world = App.screenToWorld(p);
      App.cursor = world;

      if (e.button === 1 || App.tool === 'pan' || this._space) {
        this._drag = { mode: 'pan', sx: p.x, sy: p.y };
        return;
      }
      if (e.button === 2) {
        App.cancel();
        return;
      }

      if (App.tool === 'select') {
        var id = Renderer.pick(p, 6);
        if (id) {
          if (e.shiftKey) App.toggleSelect(id);
          else if (!App.selection[id]) App.select(id);
          this._drag = { mode: 'move', base: world, applied: G.v(0, 0) };
        } else {
          if (!e.shiftKey) App.clearSelection();
          this._drag = { mode: 'box', start: world, cur: world, additive: e.shiftKey };
        }
        return;
      }

      var resolved = App.resolveInput(world, this._tolWorld());
      App.click(resolved.point);
      if (App.tool === 'text') this.askText();
    },

    move: function (e) {
      if (!App.drawing) return;
      var p = this._local(e);
      var world = App.screenToWorld(p);

      if (this._drag) {
        if (this._drag.mode === 'pan') {
          App.panBy(p.x - this._drag.sx, p.y - this._drag.sy);
          this._drag.sx = p.x;
          this._drag.sy = p.y;
          return;
        }
        if (this._drag.mode === 'move') {
          var dx = world.x - this._drag.base.x - this._drag.applied.x;
          var dy = world.y - this._drag.base.y - this._drag.applied.y;
          App.moveSelection(dx, dy);
          this._drag.applied.x += dx;
          this._drag.applied.y += dy;
          return;
        }
        if (this._drag.mode === 'box') {
          this._drag.cur = world;
          App.cursor = world;
          App.emit('change');
          return;
        }
      }

      App.cursor = world;
      if (App.tool === 'select') {
        App.snapHit = null;
      } else {
        App.resolveInput(world, this._tolWorld());
      }
      App.emit('change');
    },

    up: function (e) {
      var drag = this._drag;
      this._drag = null;
      if (!drag) return;
      if (drag.mode === 'move') {
        App.commit();
        App.emit('change');
      } else if (drag.mode === 'box') {
        var rect = this._rectFrom(drag.start, drag.cur);
        if (Math.abs(rect.max.x - rect.min.x) > 1e-6 || Math.abs(rect.max.y - rect.min.y) > 1e-6) {
          App.selectInRect(rect, drag.additive);
        }
      }
    },

    dblclick: function () {
      if (App.tool === 'polyline' || App.tool === 'hatch') App.finish();
    },

    wheel: function (e) {
      if (!App.drawing) return;
      e.preventDefault();
      App.zoomAt(this._local(e), e.deltaY < 0 ? 1.12 : 0.89);
    },

    askText: function () {
      if (App.tool !== 'text' || !App.pending.length) return;
      var val = global.prompt ? global.prompt('Texte :', 'Texte') : null;
      if (val != null && val !== '') App.placeText(val);
      else { App.pending = []; App.emit('change'); }
    },

    keyup: function (e) {
      if (e.key === ' ') this._space = false;
    },

    key: function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (!App.drawing) return;

      if (e.key === ' ') { this._space = true; if (t && t.tagName === 'BODY') e.preventDefault(); }

      var ctrl = e.ctrlKey || e.metaKey;
      var lower = (e.key || '').toLowerCase();

      if (ctrl) {
        if (lower === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); return; }
        if (lower === 'y') { e.preventDefault(); App.redo(); return; }
        if (lower === 'a') { e.preventDefault(); App.selectAll(); return; }
        if (lower === 'n') { e.preventDefault(); App.newDrawing(); App.zoomExtents(); return; }
        return;
      }

      if (e.key === 'Escape') { e.preventDefault(); App.cancel(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (App.tool === 'text') this.askText(); else App.finish(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); App.deleteSelection(); return; }
      if (e.key === 'F7') { e.preventDefault(); App.showGrid = !App.showGrid; App.emit('change'); return; }
      if (e.key === 'F8') { e.preventDefault(); App.ortho = !App.ortho; App.emit('change'); return; }
      if (e.key === 'F9') { e.preventDefault(); App.showSnap = !App.showSnap; App.emit('change'); return; }
      if (e.key === 'Home' || e.key === '0') { e.preventDefault(); App.zoomExtents(); return; }
      if (e.key === '+' || e.key === '=') { App.zoomAt({ x: Renderer.w / 2, y: Renderer.h / 2 }, 1.2); return; }
      if (e.key === '-' || e.key === '_') { App.zoomAt({ x: Renderer.w / 2, y: Renderer.h / 2 }, 0.83); return; }

      var tool = Tools.keyFor(e.key);
      if (tool && global.UI) global.UI.setTool(tool);
      else if (tool) App.setTool(tool);
    }
  };

  global.Interaction = Interaction;
})(window);

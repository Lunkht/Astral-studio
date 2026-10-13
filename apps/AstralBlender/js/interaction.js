(function (global) {
  'use strict';

  var V = global.Vec3;
  var M = global.Mat4;
  var App = global.App;
  var Renderer = global.Renderer;

  var Interaction = {
    canvas: null,
    _drag: null,

    init: function (canvas) {
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('pointerdown', function (e) { self.down(e); });
      canvas.addEventListener('pointermove', function (e) { self.move(e); });
      canvas.addEventListener('pointerup', function (e) { self.up(e); });
      canvas.addEventListener('pointerleave', function (e) { if (self._drag) self.up(e); });
      canvas.addEventListener('wheel', function (e) { self.wheel(e); }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      global.addEventListener('keydown', function (e) { self.key(e); });
    },

    _local: function (e) {
      var r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    _basis: function () {
      var view = M.lookAt(App.eye(), App.camera.target, V.v(0, 1, 0));
      return {
        right: V.v(view[0], view[4], view[8]),
        up: V.v(view[1], view[5], view[9])
      };
    },

    _worldScale: function () {
      var h = Renderer.h || 600;
      return (2 * Math.tan(App.camera.fov / 2) * App.camera.distance) / h;
    },

    down: function (e) {
      if (!App.scene) return;
      this.canvas.focus();
      var p = this._local(e);
      var cam = App.camera;

      if (e.button === 1 || (e.altKey && e.button === 0) || App.tool === 'orbit') {
        this._drag = { mode: e.shiftKey ? 'pan' : 'orbit', sx: p.x, sy: p.y, yaw: cam.yaw, pitch: cam.pitch, target: V.v(cam.target.x, cam.target.y, cam.target.z) };
        return;
      }
      if (App.tool === 'pan') {
        this._drag = { mode: 'pan', sx: p.x, sy: p.y, target: V.v(cam.target.x, cam.target.y, cam.target.z) };
        return;
      }
      if (App.tool === 'zoom' || e.button === 2) {
        cam.distance = Math.max(0.5, cam.distance * (e.button === 2 ? 1.15 : 0.85));
        App.emit('change');
        return;
      }

      var id = Renderer.pick(p.x, p.y);
      if (id) {
        if (e.shiftKey) App.toggleSelect(id);
        else if (!App.selection[id]) App.select(id);
        var snap = App.selected().map(function (o) {
          return { ref: o, ox: o.position.x, oy: o.position.y, oz: o.position.z };
        });
        this._drag = { mode: 'move', sx: p.x, sy: p.y, objects: snap };
      } else {
        App.clearSelection();
        this._drag = { mode: 'orbit', sx: p.x, sy: p.y, yaw: cam.yaw, pitch: cam.pitch };
      }
    },

    move: function (e) {
      if (!this._drag) return;
      var p = this._local(e);
      var dx = p.x - this._drag.sx;
      var dy = p.y - this._drag.sy;
      var cam = App.camera;

      if (this._drag.mode === 'orbit') {
        cam.yaw = this._drag.yaw - dx * 0.01;
        cam.pitch = Math.max(-1.5, Math.min(1.5, this._drag.pitch + dy * 0.01));
        App.emit('change');
        return;
      }
      if (this._drag.mode === 'pan') {
        var b = this._basis();
        var s = this._worldScale();
        var delta = V.sub(V.scale(b.right, dx * s), V.scale(b.up, dy * s));
        cam.target = V.sub(this._drag.target, delta);
        App.emit('change');
        return;
      }
      if (this._drag.mode === 'move') {
        var bb = this._basis();
        var ss = this._worldScale();
        var d = V.sub(V.scale(bb.right, dx * ss), V.scale(bb.up, dy * ss));
        for (var i = 0; i < this._drag.objects.length; i++) {
          var o = this._drag.objects[i];
          o.ref.position.x = o.ox + d.x;
          o.ref.position.y = o.oy + d.y;
          o.ref.position.z = o.oz + d.z;
        }
        App.emit('change');
      }
    },

    up: function () {
      if (this._drag && this._drag.mode === 'move') App.commit('Déplacer');
      this._drag = null;
    },

    wheel: function (e) {
      if (!App.scene) return;
      e.preventDefault();
      App.camera.distance = Math.max(0.5, Math.min(320, App.camera.distance * (e.deltaY < 0 ? 0.9 : 1.1)));
      App.emit('change');
    },

    key: function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (!App.scene) return;
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        var k = e.key.toLowerCase();
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); return; }
        if (k === 'y') { e.preventDefault(); App.redo(); return; }
        if (k === 'd') { e.preventDefault(); App.duplicateSelection(); return; }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); App.deleteSelection(); return; }
      if (e.key === 'Tab') { e.preventDefault(); App.setView('cam'); return; }
      if (e.key === 'Home' || e.key === '0') { e.preventDefault(); App.frame(); return; }
      if (e.key === '1') { App.setView('front'); return; }
      if (e.key === '3') { App.setView('side'); return; }
      if (e.key === '7') { App.setView('top'); return; }
      if (e.key === '5') { App.setView('cam'); return; }
      var step = e.shiftKey ? 2 : 0.5;
      if (e.key === 'ArrowLeft') { e.preventDefault(); App.translateSelection(-step, 0, 0); App.commit('Déplacer'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); App.translateSelection(step, 0, 0); App.commit('Déplacer'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); App.translateSelection(0, 0, -step); App.commit('Déplacer'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); App.translateSelection(0, 0, step); App.commit('Déplacer'); return; }
      if (e.key === '[') { e.preventDefault(); App.translateSelection(0, -step, 0); App.commit('Déplacer'); return; }
      if (e.key === ']') { e.preventDefault(); App.translateSelection(0, step, 0); App.commit('Déplacer'); return; }
      var toolKeys = { v: 'select', g: 'move', o: 'orbit', h: 'pan', z: 'zoom' };
      var tk = toolKeys[e.key.toLowerCase()];
      if (tk && global.UI) global.UI.setTool(tk);
    }
  };

  global.Interaction = Interaction;
})(window);

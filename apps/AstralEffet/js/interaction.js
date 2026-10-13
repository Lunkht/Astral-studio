(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Player = global.Player;
  var Comp = global.Comp;

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
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', function (e) { self.onKey(e); });
    return this;
  };

  Interaction.onDown = function (e) {
    var p = pos(this.canvas, e);
    this._start = { x: p.x, y: p.y, camx: App.camera.x, camy: App.camera.y };

    if (e.button === 1 || App.tool === 'hand') {
      this.mode = 'pan';
      return;
    }

    var handle = Renderer.handleAt(p.x, p.y);
    if (handle && handle.kind === 'scale') {
      var layer = App.layerById(handle.layerId);
      var r = global.Layer.evaluate(layer, App.time);
      var center = Renderer.compToScreen(r.x, r.y);
      this.mode = 'scale';
      this._start.layerId = handle.layerId;
      this._start.center = center;
      this._start.distance = Math.max(1, Math.hypot(p.x - center.x, p.y - center.y));
      this._start.scale = r.scale;
      return;
    }
    if (handle && handle.kind === 'rotate') {
      var l2 = App.layerById(handle.layerId);
      var r2 = global.Layer.evaluate(l2, App.time);
      var c2 = Renderer.compToScreen(r2.x, r2.y);
      this.mode = 'rotate';
      this._start.layerId = handle.layerId;
      this._start.center = c2;
      this._start.angle = Math.atan2(p.y - c2.y, p.x - c2.x);
      this._start.rotation = r2.rotation;
      return;
    }

    var hit = Renderer.hitTest(p.x, p.y);
    if (hit) {
      if (!App.isSelected(hit.id) || e.shiftKey) App.select(hit.id, e.shiftKey);
      var r3 = global.Layer.evaluate(hit, App.time);
      this.mode = 'move';
      this._start.layerId = hit.id;
      this._start.comp = Renderer.screenToComp(p.x, p.y);
      this._start.x = r3.x;
      this._start.y = r3.y;
    } else {
      if (!e.shiftKey) App.select(null);
      this.mode = 'idle';
    }
  };

  Interaction.onMove = function (e) {
    if (this.mode === 'idle' || !this._start) return;
    var p = pos(this.canvas, e);
    if (this.mode === 'pan') {
      App.setCamera(this._start.camx + (p.x - this._start.x), this._start.camy + (p.y - this._start.y));
      return;
    }
    if (this.mode === 'move') {
      var c = Renderer.screenToComp(p.x, p.y);
      var nx = this._start.x + (c.x - this._start.comp.x);
      var ny = this._start.y + (c.y - this._start.comp.y);
      App.setTransform(this._start.layerId, 'x', nx, true);
      App.setTransform(this._start.layerId, 'y', ny, true);
      return;
    }
    if (this.mode === 'scale') {
      var d = Math.hypot(p.x - this._start.center.x, p.y - this._start.center.y);
      var factor = d / this._start.distance;
      App.setTransform(this._start.layerId, 'scale', Math.max(1, this._start.scale * factor), true);
      return;
    }
    if (this.mode === 'rotate') {
      var ang = Math.atan2(p.y - this._start.center.y, p.x - this._start.center.x);
      var deltaDeg = (ang - this._start.angle) * 180 / Math.PI;
      App.setTransform(this._start.layerId, 'rotation', this._start.rotation + deltaDeg, true);
    }
  };

  Interaction.onUp = function () {
    if (this.mode === 'move' || this.mode === 'scale' || this.mode === 'rotate') {
      App.commit();
    }
    this.mode = 'idle';
    this._start = null;
    App.emit('change');
  };

  Interaction.onWheel = function (e) {
    e.preventDefault();
    var p = pos(this.canvas, e);
    var comp = App.comp;
    if (!comp) return;
    var before = Renderer.screenToComp(p.x, p.y);
    var zoom = App.camera.zoom * (e.deltaY < 0 ? 1.12 : 0.89);
    zoom = Math.min(8, Math.max(0.1, zoom));
    App.camera.zoom = zoom;

    var cw = this.canvas.width, ch = this.canvas.height;
    var pad = 40;
    var bf = Math.min((cw - pad) / comp.width, (ch - pad) / comp.height);
    var fit = bf * zoom;
    App.camera.x = p.x - before.x * fit - (cw - comp.width * fit) / 2;
    App.camera.y = p.y - before.y * fit - (ch - comp.height * fit) / 2;
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
      if (key === 'd' || key === 'D') { e.preventDefault(); App.duplicateSelected(); return; }
      if (key === 'a' || key === 'A') { e.preventDefault(); App.selectAll(); return; }
      return;
    }

    if (key === ' ') { e.preventDefault(); Player.toggle(); return; }
    if (key === 'ArrowRight') { e.preventDefault(); App.stepFrame(shift ? 10 : 1); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); App.stepFrame(shift ? -10 : -1); return; }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      var layers = App.selectedLayers();
      var dy = (key === 'ArrowUp' ? -1 : 1) * (shift ? 10 : 1);
      layers.forEach(function (l) {
        var r = global.Layer.evaluate(l, App.time);
        App.setTransform(l.id, 'y', r.y + dy, true);
      });
      if (layers.length) App.commit();
      return;
    }
    if (key === 'Home') { e.preventDefault(); App.goStart(); return; }
    if (key === 'End') { e.preventDefault(); App.goEnd(); return; }
    if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); App.removeSelected(); return; }
    if (key === 'v' || key === 'V') { App.tool = 'select'; App.emit('change'); return; }
    if (key === 'h' || key === 'H') { App.tool = 'hand'; App.emit('change'); return; }
    if (key === 't' || key === 'T') { e.preventDefault(); App.addText(); return; }
    if (key === 's' || key === 'S') { App.addSolid(); return; }
    if (key === 'e' || key === 'E') { App.addShape({ kind: 'ellipse' }); return; }
    if (key === 'r' || key === 'R') { App.addShape({ kind: 'rect' }); return; }
    if (key === 'y' || key === 'Y') { App.addShape({ kind: 'star' }); return; }
    if (key === 'p' || key === 'P') { var l1 = App.firstSelected(); if (l1) { App.toggleTransformKey(l1.id, 'x'); App.toggleTransformKey(l1.id, 'y'); } return; }
    if (key === 'o' || key === 'O') { var l2 = App.firstSelected(); if (l2) App.toggleTransformKey(l2.id, 'opacity'); return; }
    if (key === 'n' || key === 'N') { var l3 = App.firstSelected(); if (l3) App.toggleTransformKey(l3.id, 'rotation'); return; }
  };

  global.Interaction = Interaction;
})(window);

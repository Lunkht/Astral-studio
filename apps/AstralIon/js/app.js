(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;

  var App = {
    shapes: [],
    selection: {},
    camera: { pan: { x: 0, y: 0 }, zoom: 1 },
    artboard: { x: 0, y: 0, w: 1920, h: 1080 },
    tool: 'select',
    spaceDown: false,
    preview: null,
    pen: null,
    edit: null,           // { shapeId } for direct selection
    textEdit: null,       // { shapeId }
    activeSwatch: 'fill', // 'fill' | 'stroke'
    rulers: true,
    unit: 'px',
    style: { fill: '#c9d7f0', stroke: '#2b3a55', strokeWidth: 1, opacity: 1 },
    _pending: null,
    _listeners: {},

    /* ---- events ---- */
    on: function (evt, fn) {
      (this._listeners[evt] || (this._listeners[evt] = [])).push(fn);
    },
    emit: function (evt) {
      (this._listeners[evt] || []).forEach(function (fn) { fn(); });
    },

    /* ---- queries ---- */
    shapeById: function (id) {
      for (var i = 0; i < this.shapes.length; i++) if (this.shapes[i].id === id) return this.shapes[i];
      return null;
    },
    selectionIds: function () { return Object.keys(this.selection); },
    hasSelection: function () { return this.selectionIds().length > 0; },
    selected: function () {
      var self = this;
      return this.selectionIds().map(function (id) { return self.shapeById(id); }).filter(Boolean);
    },
    topmostAt: function (wx, wy, tol) {
      for (var i = this.shapes.length - 1; i >= 0; i--) {
        var s = this.shapes[i];
        if (s.visible && !s.locked && S.hitTest(s, wx, wy, tol)) return s;
      }
      return null;
    },

    /* ---- selection ---- */
    select: function (ids, additive) {
      if (!additive) this.selection = {};
      var arr = Array.isArray(ids) ? ids : (ids ? [ids] : []);
      var self = this;
      arr.forEach(function (id) { if (id) self.selection[id] = true; });
      this.emit('selection');
    },
    toggleSelect: function (id) {
      if (this.selection[id]) delete this.selection[id]; else this.selection[id] = true;
      this.emit('selection');
    },
    clearSelection: function () { this.selection = {}; this.emit('selection'); },
    pruneSelection: function () {
      var self = this;
      this.selectionIds().forEach(function (id) { if (!self.shapeById(id)) delete self.selection[id]; });
    },

    /* ---- style ---- */
    applyStyle: function (shape) {
      shape.fill = this.style.fill;
      shape.stroke = this.style.stroke;
      shape.strokeWidth = this.style.strokeWidth;
      shape.opacity = this.style.opacity;
      return shape;
    },
    setStyle: function (partial) {
      for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) this.style[k] = partial[k];
    },

    addShape: function (shape, selectIt) {
      this.shapes.push(shape);
      if (selectIt !== false) { this.selection = {}; this.selection[shape.id] = true; }
      this.emit('change');
      this.emit('selection');
    },

    /* ---- history ---- */
    history: { past: [], future: [] },
    _nudgeTimer: null,
    beginChange: function () { this.flushNudge(); this._pending = U.deepClone(this.shapes); },
    endChange: function () {
      if (this._pending && JSON.stringify(this._pending) !== JSON.stringify(this.shapes)) {
        this.history.past.push(this._pending);
        if (this.history.past.length > 200) this.history.past.shift();
        this.history.future.length = 0;
      }
      this._pending = null;
      this.emit('change');
    },
    flushNudge: function () {
      if (this._nudgeTimer) {
        global.clearTimeout(this._nudgeTimer);
        this._nudgeTimer = null;
        this.endChange();
      }
    },
    nudge: function (dx, dy) {
      var self = this;
      if (!this._nudgeTimer) this.beginChange();
      else global.clearTimeout(this._nudgeTimer);
      this.selected().forEach(function (s) { s.x += dx; s.y += dy; });
      this.emit('change');
      this._nudgeTimer = global.setTimeout(function () {
        self._nudgeTimer = null;
        self.endChange();
      }, 500);
    },
    undo: function () {
      this.flushNudge();
      if (!this.history.past.length) return;
      this.history.future.push(U.deepClone(this.shapes));
      this.shapes = this.history.past.pop();
      this.pruneSelection();
      this.emit('change'); this.emit('selection');
    },
    redo: function () {
      this.flushNudge();
      if (!this.history.future.length) return;
      this.history.past.push(U.deepClone(this.shapes));
      this.shapes = this.history.future.pop();
      this.pruneSelection();
      this.emit('change'); this.emit('selection');
    },

    /* ---- new document ---- */
    newDocument: function () {
      if (this._nudgeTimer) { global.clearTimeout(this._nudgeTimer); this._nudgeTimer = null; }
      this._pending = null;
      this.shapes = [];
      this.selection = {};
      this.pen = null; this.edit = null; this.textEdit = null;
      this.history.past = []; this.history.future = [];
      this.emit('change'); this.emit('selection');
    },

    /* ---- z-order ---- */
    reorder: function (dir) {
      var ids = this.selectionIds();
      if (!ids.length) return;
      this.beginChange();
      var shapes = this.shapes;
      if (dir === 'front' || dir === 'back') {
        var selected = shapes.filter(function (s) { return ids.indexOf(s.id) >= 0; });
        var others = shapes.filter(function (s) { return ids.indexOf(s.id) < 0; });
        this.shapes = dir === 'front' ? others.concat(selected) : selected.concat(others);
      } else {
        var indices = ids.map(function (id) { return shapes.findIndex(function (s) { return s.id === id; }); }).sort(function (a, b) { return a - b; });
        if (dir === 'up') indices.reverse();
        indices.forEach(function (i) {
          var j = dir === 'up' ? i + 1 : i - 1;
          if (j < 0 || j >= shapes.length) return;
          var t = shapes[i]; shapes[i] = shapes[j]; shapes[j] = t;
        });
      }
      this.endChange();
    },

    /* ---- view ---- */
    zoomAt: function (screenX, screenY, factor) {
      var cam = this.camera;
      var before = this.screenToWorld(screenX, screenY);
      cam.zoom = U.clamp(cam.zoom * factor, 0.02, 64);
      var after = this.screenToWorld(screenX, screenY);
      cam.pan.x += (after.x - before.x) * cam.zoom;
      cam.pan.y += (after.y - before.y) * cam.zoom;
      this.emit('view');
    },
    setZoom: function (z, screenX, screenY) {
      var cam = this.camera;
      screenX = screenX == null ? 0 : screenX; screenY = screenY == null ? 0 : screenY;
      var before = this.screenToWorld(screenX, screenY);
      cam.zoom = U.clamp(z, 0.02, 64);
      var after = this.screenToWorld(screenX, screenY);
      cam.pan.x += (after.x - before.x) * cam.zoom;
      cam.pan.y += (after.y - before.y) * cam.zoom;
      this.emit('view');
    },
    screenToWorld: function (sx, sy) {
      var cam = this.camera;
      return { x: (sx - cam.pan.x) / cam.zoom, y: (sy - cam.pan.y) / cam.zoom };
    },
    worldToScreen: function (wx, wy) {
      var cam = this.camera;
      return { x: wx * cam.zoom + cam.pan.x, y: wy * cam.zoom + cam.pan.y };
    },
    fitToView: function (viewW, viewH) {
      var a = this.artboard, pad = 70;
      var z = U.clamp(Math.min((viewW - pad * 2) / a.w, (viewH - pad * 2) / a.h), 0.02, 64);
      this.camera.zoom = z;
      this.camera.pan.x = viewW / 2 - (a.x + a.w / 2) * z;
      this.camera.pan.y = viewH / 2 - (a.y + a.h / 2) * z;
      this.emit('view');
    }
  };

  global.App = App;
})(window);

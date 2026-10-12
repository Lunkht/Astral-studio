(function (global) {
  'use strict';

  var U = global.Utils;
  var Layer = global.Layer;
  var Selection = global.Selection;

  var HISTORY_LIMIT = 30;

  function defaultBrush() {
    return { size: 24, hardness: 0.8, opacity: 1, smoothing: 0.5 };
  }

  var App = {
    doc: null,
    tool: 'move',
    camera: { pan: { x: 0, y: 0 }, zoom: 1 },
    selection: Selection.none(),
    fg: '#000000',
    bg: '#ffffff',
    brush: defaultBrush(),
    text: { family: 'Inter, Arial, sans-serif', size: 48, bold: false, italic: false },
    shape: { fill: true, stroke: false, radius: 0 },
    tolerance: 32,
    gradient: { type: 'linear' },
    cropRect: null,
    preview: null,
    lasso: null,
    textEdit: null,
    spaceDown: false,
    shiftDown: false,
    altDown: false,
    activeSwatch: 'fg',
    showGrid: false,
    rulers: true,
    _pending: null,
    _dirty: false,
    _listeners: {},
    history: { past: [], future: [] },

    /* ---- events ---- */
    on: function (evt, fn) {
      (this._listeners[evt] || (this._listeners[evt] = [])).push(fn);
      return fn;
    },
    emit: function (evt, data) {
      var list = this._listeners[evt];
      if (!list) return;
      for (var i = 0; i < list.length; i++) list[i](data);
    },

    /* ---- layer queries ---- */
    layerById: function (id) {
      var ls = this.doc ? this.doc.layers : [];
      for (var i = 0; i < ls.length; i++) if (ls[i].id === id) return ls[i];
      return null;
    },
    layerIndex: function (id) {
      var ls = this.doc ? this.doc.layers : [];
      for (var i = 0; i < ls.length; i++) if (ls[i].id === id) return i;
      return -1;
    },
    activeLayer: function () {
      return this.doc ? this.layerById(this.doc.activeId) : null;
    },
    setActive: function (id) {
      if (!this.doc) return;
      this.doc.activeId = id;
      this.emit('layers');
      this.emit('change');
    },

    addLayer: function (opts) {
      opts = opts || {};
      var self = this;
      var layer = Layer.create(Object.assign({
        width: this.doc.width,
        height: this.doc.height,
        name: opts.name || ('Calque ' + (this.doc.layers.length + 1))
      }, opts));
      this.commit('Nouveau calque', function () {
        var idx = self.layerIndex(self.doc.activeId);
        self.doc.layers.splice(idx < 0 ? self.doc.layers.length : idx + 1, 0, layer);
        self.doc.activeId = layer.id;
      });
      return layer;
    },
    removeLayer: function (id) {
      if (!this.doc || this.doc.layers.length <= 1) return;
      var idx = this.layerIndex(id);
      if (idx < 0) return;
      var self = this;
      this.commit('Supprimer le calque', function () {
        self.doc.layers.splice(idx, 1);
        if (self.doc.activeId === id) {
          var next = self.doc.layers[Math.min(idx, self.doc.layers.length - 1)];
          self.doc.activeId = next.id;
        }
      });
    },
    duplicateLayer: function (id) {
      var src = this.layerById(id) || this.activeLayer();
      if (!src) return;
      var copy = Layer.clone(src, src.name + ' copie');
      var self = this;
      this.commit('Dupliquer le calque', function () {
        var idx = self.layerIndex(src.id);
        self.doc.layers.splice(idx + 1, 0, copy);
        self.doc.activeId = copy.id;
      });
      return copy;
    },
    moveLayer: function (id, dir) {
      var idx = this.layerIndex(id);
      if (idx < 0) return;
      var to = dir === 'up' ? idx + 1 : dir === 'down' ? idx - 1 : dir === 'top' ? this.doc.layers.length - 1 : 0;
      to = U.clamp(to, 0, this.doc.layers.length - 1);
      if (to === idx) return;
      var self = this;
      this.commit('Réorganiser le calque', function () {
        var l = self.doc.layers.splice(idx, 1)[0];
        self.doc.layers.splice(to, 0, l);
      });
    },
    mergeDown: function () {
      var idx = this.layerIndex(this.doc.activeId);
      if (idx <= 0) return;
      var self = this;
      this.commit('Fusionner vers le bas', function () {
        var top = self.doc.layers[idx], below = self.doc.layers[idx - 1];
        var ctx = Layer.context(below.canvas);
        ctx.save();
        ctx.globalAlpha = top.opacity;
        ctx.globalCompositeOperation = top.blend;
        if (top.visible) ctx.drawImage(top.canvas, 0, 0);
        ctx.restore();
        self.doc.layers.splice(idx, 1);
        self.doc.activeId = below.id;
      });
    },
    flatten: function () {
      var w = this.doc.width, h = this.doc.height;
      var c = Layer.newCanvas(w, h);
      var ctx = Layer.context(c);
      this.compositeLayers(ctx, w, h);
      this.commit('Aplatir', function () {
        App.doc.layers = [Layer.create({ width: w, height: h, name: 'Arrière-plan', canvas: c })];
        App.doc.activeId = App.doc.layers[0].id;
      });
    },
    compositeLayers: function (ctx, w, h) {
      var ls = this.doc.layers;
      for (var i = 0; i < ls.length; i++) {
        var l = ls[i];
        if (!l.visible) continue;
        ctx.globalAlpha = l.opacity;
        ctx.globalCompositeOperation = l.blend;
        ctx.drawImage(l.canvas, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },

    /* ---- selection ---- */
    hasSelection: function () { return !Selection.isEmpty(this.selection); },
    setSelection: function (sel) { this.selection = sel || Selection.none(); this.emit('selection'); this.emit('change'); },
    clearSelection: function () { this.selection = Selection.none(); this.emit('selection'); this.emit('change'); },
    selectAll: function () {
      if (!this.doc) return;
      this.selection = Selection.rect(0, 0, this.doc.width, this.doc.height);
      this.emit('selection'); this.emit('change');
    },

    /* ---- colors ---- */
    setFg: function (hex) { this.fg = hex; this.emit('color'); },
    setBg: function (hex) { this.bg = hex; this.emit('color'); },
    swapColors: function () { var t = this.fg; this.fg = this.bg; this.bg = t; this.emit('color'); },
    resetColors: function () { this.fg = '#000000'; this.bg = '#ffffff'; this.emit('color'); },

    /* ---- tool ---- */
    setTool: function (t) { this.tool = t; this.emit('tool'); },

    /* ---- document lifecycle ---- */
    newDocument: function (opts) {
      opts = opts || {};
      var w = Math.max(1, Math.round(opts.width || 1000));
      var h = Math.max(1, Math.round(opts.height || 700));
      var name = opts.name || 'Sans titre';
      var background = opts.background || '#ffffff';
      var layerName = opts.layerName || 'Arrière-plan';
      var base = Layer.create({ width: w, height: h, name: layerName });
      if (background && background !== 'transparent') {
        var ctx = Layer.context(base.canvas);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }
      this.doc = { name: name, width: w, height: h, background: background, layers: [base], activeId: base.id };
      this.selection = Selection.none();
      this.history = { past: [], future: [] };
      this._pending = null;
      this._dirty = false;
      this.preview = null; this.lasso = null; this.cropRect = null; this.textEdit = null;
      this.emit('doc');
      this.emit('layers');
      this.emit('selection');
      this.emit('history');
      this.emit('change');
      return this.doc;
    },
    resizeDocument: function (w, h, anchorFill) {
      if (!this.doc) return;
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      var self = this;
      this.commit('Taille de l\'image', function () {
        self.doc.layers.forEach(function (l) {
          var c = Layer.newCanvas(w, h);
          if (anchorFill) {
            var cx = Layer.context(c);
            cx.fillStyle = anchorFill;
            cx.fillRect(0, 0, w, h);
          }
          Layer.context(c).drawImage(l.canvas, 0, 0);
          l.canvas = c;
        });
        self.doc.width = w; self.doc.height = h;
      });
      this.emit('doc');
      this.emit('layers');
      this.emit('change');
    },
    crop: function (rect) {
      if (!this.doc || !rect || rect.w < 1 || rect.h < 1) return;
      var x = Math.round(rect.x), y = Math.round(rect.y);
      var w = Math.round(rect.w), h = Math.round(rect.h);
      var self = this;
      this.commit('Recadrage', function () {
        self.doc.layers.forEach(function (l) {
          var c = Layer.newCanvas(w, h);
          Layer.context(c).drawImage(l.canvas, -x, -y);
          l.canvas = c;
        });
        self.doc.width = w; self.doc.height = h;
      });
      this.emit('doc');
      this.emit('layers');
      this.emit('change');
    },

    /* ---- history ---- */
    snapshot: function () {
      if (!this.doc) return null;
      return {
        name: this.doc.name,
        width: this.doc.width,
        height: this.doc.height,
        background: this.doc.background,
        activeId: this.doc.activeId,
        layers: this.doc.layers.map(function (l) {
          return {
            id: l.id, name: l.name, visible: l.visible, locked: l.locked,
            opacity: l.opacity, blend: l.blend, canvas: Layer.cloneCanvas(l.canvas)
          };
        })
      };
    },
    restore: function (snap) {
      var layers = snap.layers.map(function (l) {
        return Layer.create({
          id: l.id, name: l.name, visible: l.visible, locked: l.locked,
          opacity: l.opacity, blend: l.blend,
          width: snap.width, height: snap.height, canvas: Layer.cloneCanvas(l.canvas)
        });
      });
      this.doc = {
        name: snap.name, width: snap.width, height: snap.height,
        background: snap.background, layers: layers, activeId: snap.activeId
      };
    },
    beginChange: function () {
      if (this._pending) return;
      this._pending = this.snapshot();
      this._dirty = false;
    },
    touch: function () {
      this._dirty = true;
      this.emit('change');
    },
    endChange: function () {
      if (!this._pending) return;
      if (this._dirty) {
        this.history.past.push(this._pending);
        if (this.history.past.length > HISTORY_LIMIT) this.history.past.shift();
        this.history.future.length = 0;
        this.emit('history');
      }
      this._pending = null;
      this._dirty = false;
      this.emit('layers');
      this.emit('change');
    },
    commit: function (label, fn) {
      this.beginChange();
      fn();
      this._dirty = true;
      this.endChange();
    },
    undo: function () {
      if (!this.history.past.length) return;
      this.history.future.push(this.snapshot());
      this.restore(this.history.past.pop());
      this.reconcile();
      this.emit('history'); this.emit('layers'); this.emit('doc'); this.emit('change');
    },
    redo: function () {
      if (!this.history.future.length) return;
      this.history.past.push(this.snapshot());
      this.restore(this.history.future.pop());
      this.reconcile();
      this.emit('history'); this.emit('layers'); this.emit('doc'); this.emit('change');
    },
    reconcile: function () {
      if (!this.layerById(this.doc.activeId)) {
        this.doc.activeId = this.doc.layers.length ? this.doc.layers[this.doc.layers.length - 1].id : null;
      }
    },

    /* ---- camera ---- */
    screenToWorld: function (sx, sy) {
      var cam = this.camera;
      return { x: (sx - cam.pan.x) / cam.zoom, y: (sy - cam.pan.y) / cam.zoom };
    },
    worldToScreen: function (wx, wy) {
      var cam = this.camera;
      return { x: wx * cam.zoom + cam.pan.x, y: wy * cam.zoom + cam.pan.y };
    },
    zoomAt: function (screenX, screenY, factor) {
      var cam = this.camera;
      var before = this.screenToWorld(screenX, screenY);
      cam.zoom = U.clamp(cam.zoom * factor, 0.02, 64);
      var after = this.screenToWorld(screenX, screenY);
      cam.pan.x += (after.x - before.x) * cam.zoom;
      cam.pan.y += (after.y - before.y) * cam.zoom;
      this.emit('view');
    },
    setZoom: function (z, cx, cy) {
      var cam = this.camera;
      cx = cx == null ? 0 : cx; cy = cy == null ? 0 : cy;
      var before = this.screenToWorld(cx, cy);
      cam.zoom = U.clamp(z, 0.02, 64);
      var after = this.screenToWorld(cx, cy);
      cam.pan.x += (after.x - before.x) * cam.zoom;
      cam.pan.y += (after.y - before.y) * cam.zoom;
      this.emit('view');
    },
    panBy: function (dx, dy) {
      this.camera.pan.x += dx;
      this.camera.pan.y += dy;
      this.emit('view');
    },
    fitToView: function (viewW, viewH) {
      if (!this.doc) return;
      var pad = 60;
      var z = U.clamp(Math.min((viewW - pad * 2) / this.doc.width, (viewH - pad * 2) / this.doc.height), 0.02, 64);
      this.camera.zoom = z;
      this.camera.pan.x = viewW / 2 - (this.doc.width / 2) * z;
      this.camera.pan.y = viewH / 2 - (this.doc.height / 2) * z;
      this.emit('view');
    }
  };

  App.defaultBrush = defaultBrush;
  global.App = App;
})(typeof window !== 'undefined' ? window : this);

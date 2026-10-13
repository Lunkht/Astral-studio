(function (global) {
  'use strict';

  var U = global.Utils;
  var L = global.Layer;

  var App = {
    doc: null,
    tool: 'select',
    selection: {},
    style: { fill: '#c9d7f0', stroke: '#2b3a55', strokeWidth: 2, opacity: 1 },
    camera: { x: 0, y: 0, zoom: 1 },
    currentFrame: 0,
    playing: false,
    onion: false,
    grid: false,
    activeLayerId: null,
    _history: [],
    _redo: [],
    _listeners: {},

    /* ---- events ---- */
    on: function (evt, fn) {
      (this._listeners[evt] || (this._listeners[evt] = [])).push(fn);
    },
    emit: function (evt) {
      var list = this._listeners[evt] || [];
      for (var i = 0; i < list.length; i++) list[i]();
    },

    /* ---- document ---- */
    newDocument: function (opts) {
      opts = opts || {};
      this.doc = {
        name: opts.name || 'Sans titre',
        width: opts.width || 800,
        height: opts.height || 600,
        fps: opts.fps || 12,
        frameCount: opts.frameCount || 24,
        background: opts.background || '#ffffff',
        layers: []
      };
      var layer = L.create('Calque 1');
      this.doc.layers.push(layer);
      this.activeLayerId = layer.id;
      this.currentFrame = 0;
      this.playing = false;
      this.selection = {};
      this._history = [JSON.stringify(this.doc)];
      this._redo = [];
      this.emit('doc');
      this.emit('change');
    },

    layerById: function (id) {
      for (var i = 0; i < this.doc.layers.length; i++) {
        if (this.doc.layers[i].id === id) return this.doc.layers[i];
      }
      return null;
    },
    activeLayer: function () {
      return this.layerById(this.activeLayerId) || this.doc.layers[0] || null;
    },
    setActiveLayer: function (id) {
      this.activeLayerId = id;
      this.selection = {};
      this.emit('change');
    },
    addLayer: function (name) {
      var layer = L.create(name || ('Calque ' + (this.doc.layers.length + 1)));
      this.doc.layers.push(layer);
      this.activeLayerId = layer.id;
      this.commit('Nouveau calque');
      return layer;
    },
    removeLayer: function (id) {
      if (this.doc.layers.length <= 1) return;
      for (var i = 0; i < this.doc.layers.length; i++) {
        if (this.doc.layers[i].id === id) { this.doc.layers.splice(i, 1); break; }
      }
      if (this.activeLayerId === id) this.activeLayerId = this.doc.layers[0].id;
      this.selection = {};
      this.commit('Supprimer le calque');
    },
    moveLayer: function (id, delta) {
      var layers = this.doc.layers;
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].id === id) {
          var j = U.clamp(i + delta, 0, layers.length - 1);
          if (j === i) return;
          var tmp = layers.splice(i, 1)[0];
          layers.splice(j, 0, tmp);
          this.commit('Reordonner');
          return;
        }
      }
    },

    /* ---- frames / keys ---- */
    setFrame: function (f) {
      var max = this.doc.frameCount - 1;
      this.currentFrame = U.clamp(f, 0, max);
      this.emit('frame');
      this.emit('change');
    },
    nextFrame: function () { this.setFrame(this.currentFrame + 1); },
    prevFrame: function () { this.setFrame(this.currentFrame - 1); },
    shapesAt: function (layer, frame) {
      return L.renderAt(layer, frame);
    },
    hasKey: function (layer, frame) {
      return !!L.keyAt(layer, frame);
    },
    addKey: function (frame) {
      var layer = this.activeLayer();
      if (!layer) return;
      frame = frame == null ? this.currentFrame : frame;
      var shapes = L.renderAt(layer, frame);
      L.setKey(layer, frame, shapes);
      this.commit('Image cle');
    },
    removeKey: function (frame) {
      var layer = this.activeLayer();
      if (!layer) return;
      frame = frame == null ? this.currentFrame : frame;
      if (L.removeKey(layer, frame)) this.commit('Supprimer l\'image cle');
    },

    /* ---- shapes ---- */
    editableKey: function () {
      var layer = this.activeLayer();
      if (!layer) return null;
      var key = L.keyAt(layer, this.currentFrame);
      if (!key) key = L.setKey(layer, this.currentFrame, L.renderAt(layer, this.currentFrame));
      return key;
    },
    addShape: function (shape) {
      var key = this.editableKey();
      if (!key) return null;
      key.shapes.push(shape);
      this.selection = {};
      this.selection[shape.id] = true;
      this.commit('Ajouter une forme');
      return shape;
    },
    selectedIds: function () { return Object.keys(this.selection); },
    hasSelection: function () { return this.selectedIds().length > 0; },
    select: function (ids, additive) {
      if (!additive) this.selection = {};
      var arr = Array.isArray(ids) ? ids : (ids ? [ids] : []);
      for (var i = 0; i < arr.length; i++) if (arr[i]) this.selection[arr[i]] = true;
      this.emit('selection');
      this.emit('change');
    },
    selectedShapes: function () {
      var layer = this.activeLayer();
      if (!layer) return [];
      var key = L.keyAt(layer, this.currentFrame);
      var shapes = key ? key.shapes : [];
      var out = [];
      for (var i = 0; i < shapes.length; i++) {
        if (this.selection[shapes[i].id]) out.push(shapes[i]);
      }
      return out;
    },
    clearSelection: function () {
      this.selection = {};
      this.emit('selection');
      this.emit('change');
    },
    deleteSelection: function () {
      var layer = this.activeLayer();
      if (!layer) return;
      var key = L.keyAt(layer, this.currentFrame);
      if (!key) return;
      key.shapes = key.shapes.filter((function (self) {
        return function (s) { return !self.selection[s.id]; };
      })(this));
      this.selection = {};
      this.commit('Supprimer');
    },
    moveSelection: function (dx, dy) {
      var shapes = this.selectedShapes();
      if (!shapes.length) return;
      for (var i = 0; i < shapes.length; i++) {
        shapes[i].x += dx;
        shapes[i].y += dy;
        if (shapes[i].points) {
          for (var j = 0; j < shapes[i].points.length; j++) {
            shapes[i].points[j].x += dx;
            shapes[i].points[j].y += dy;
          }
        }
      }
      this.emit('change');
    },

    /* ---- camera ---- */
    fit: function (vw, vh) {
      var margin = 48;
      var z = Math.min((vw - margin) / this.doc.width, (vh - margin) / this.doc.height);
      this.camera.zoom = U.clamp(z, 0.05, 8);
      this.camera.x = (vw - this.doc.width * this.camera.zoom) / 2;
      this.camera.y = (vh - this.doc.height * this.camera.zoom) / 2;
      this.emit('change');
    },
    toWorld: function (sx, sy) {
      return { x: (sx - this.camera.x) / this.camera.zoom, y: (sy - this.camera.y) / this.camera.zoom };
    },
    toScreen: function (wx, wy) {
      return { x: wx * this.camera.zoom + this.camera.x, y: wy * this.camera.zoom + this.camera.y };
    },
    zoomAt: function (sx, sy, factor) {
      var before = this.toWorld(sx, sy);
      this.camera.zoom = U.clamp(this.camera.zoom * factor, 0.05, 8);
      var after = this.toWorld(sx, sy);
      this.camera.x += (after.x - before.x) * this.camera.zoom;
      this.camera.y += (after.y - before.y) * this.camera.zoom;
      this.emit('change');
    },

    /* ---- history ---- */
    commit: function () {
      this._history.push(JSON.stringify(this.doc));
      if (this._history.length > 60) this._history.shift();
      this._redo = [];
      this.emit('change');
    },
    undo: function () {
      if (this._history.length <= 1) return;
      this._redo.push(this._history.pop());
      this.doc = JSON.parse(this._history[this._history.length - 1]);
      if (!this.layerById(this.activeLayerId)) this.activeLayerId = this.doc.layers[0].id;
      this.selection = {};
      this.currentFrame = U.clamp(this.currentFrame, 0, this.doc.frameCount - 1);
      this.emit('change');
    },
    redo: function () {
      if (!this._redo.length) return;
      var s = this._redo.pop();
      this._history.push(s);
      this.doc = JSON.parse(s);
      if (!this.layerById(this.activeLayerId)) this.activeLayerId = this.doc.layers[0].id;
      this.selection = {};
      this.currentFrame = U.clamp(this.currentFrame, 0, this.doc.frameCount - 1);
      this.emit('change');
    },
    canUndo: function () { return this._history.length > 1; },
    canRedo: function () { return this._redo.length > 0; }
  };

  global.App = App;
})(window);

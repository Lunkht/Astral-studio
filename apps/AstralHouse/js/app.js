(function (global) {
  'use strict';

  var G = global.Geom;
  var U = global.Utils;
  var Entities = global.Entities;
  var Drawing = global.Drawing;
  var Layers = global.Layers;
  var Snap = global.Snap;
  var Tools = global.Tools;

  var App = {
    drawing: null,
    selection: {},
    tool: 'select',
    viewport: { x: 0, y: 0, scale: 2 },
    pending: [],
    cursor: null,
    snapHit: null,
    measure: null,
    showGrid: true,
    showAxes: true,
    showSnap: true,
    showCrosshair: true,
    ortho: false,
    polar: false,
    snapModes: null,
    history: [],
    redoStack: [],
    listeners: {},

    on: function (evt, fn) {
      (this._l[evt] || (this._l[evt] = [])).push(fn);
    },

    _l: {},

    emit: function (evt) {
      var list = this._l[evt] || [];
      for (var i = 0; i < list.length; i++) list[i]();
    },

    /* ---- lifecycle ---- */
    newDrawing: function (opts) {
      this.drawing = Drawing.create(opts);
      this.selection = {};
      this.pending = [];
      this.measure = null;
      this.snapModes = Snap.defaultModes();
      this.history = [Drawing.serialize(this.drawing)];
      this.redoStack = [];
      this.emit('scene');
      this.emit('layers');
      this.emit('change');
      return this.drawing;
    },

    addSample: function () {
      var d = this.drawing;
      var wall = Entities.rectangle(G.v(0, 0), G.v(400, 300));
      wall.layer = 'Murs';
      var inner = Entities.rectangle(G.v(30, 30), G.v(370, 270));
      inner.layer = 'Murs';
      var circle = Entities.circle(G.v(200, 150), 60);
      var dim = Entities.dimension(G.v(0, -40), G.v(400, -40), -25);
      dim.layer = 'Cotation';
      var axis = Entities.line(G.v(200, -60), G.v(200, 360));
      axis.layer = 'Axes';
      var text = Entities.text(G.v(160, 150), 'Séjour', 20);
      Drawing.addAll(d, [wall, inner, circle, dim, axis, text]);
      this.commit();
      this.emit('scene');
      return d;
    },

    /* ---- history ---- */
    commit: function () {
      this.history.push(Drawing.serialize(this.drawing));
      if (this.history.length > 80) this.history.shift();
      this.redoStack = [];
      this.emit('change');
    },

    undo: function () {
      if (this.history.length <= 1) return;
      this.redoStack.push(this.history.pop());
      this.drawing = Drawing.deserialize(this.history[this.history.length - 1]);
      this.pruneSelection();
      this.emit('scene');
      this.emit('layers');
      this.emit('change');
    },

    redo: function () {
      if (!this.redoStack.length) return;
      var s = this.redoStack.pop();
      this.history.push(s);
      this.drawing = Drawing.deserialize(s);
      this.pruneSelection();
      this.emit('scene');
      this.emit('layers');
      this.emit('change');
    },

    pruneSelection: function () {
      var self = this;
      this.selectedIds().forEach(function (id) {
        if (!Drawing.byId(self.drawing, id)) delete self.selection[id];
      });
    },

    canUndo: function () { return this.history.length > 1; },
    canRedo: function () { return this.redoStack.length > 0; },

    /* ---- viewport ---- */
    size: function () {
      var r = global.Renderer;
      return { w: (r && r.w) || 800, h: (r && r.h) || 600 };
    },

    worldToScreen: function (p) {
      var v = this.viewport;
      return { x: v.x + p.x * v.scale, y: v.y - p.y * v.scale };
    },

    screenToWorld: function (s) {
      var v = this.viewport;
      return { x: (s.x - v.x) / v.scale, y: (v.y - s.y) / v.scale };
    },

    zoomAt: function (screenPt, factor) {
      var v = this.viewport;
      var before = this.screenToWorld(screenPt);
      var next = U.clamp(v.scale * factor, 0.001, 100000);
      var d = next - v.scale;
      v.scale = next;
      v.x -= before.x * d;
      v.y += before.y * d;
      this.emit('view');
      this.emit('change');
    },

    setZoom: function (scale, screenAnchor) {
      var anchor = screenAnchor || { x: this.size().w / 2, y: this.size().h / 2 };
      this.zoomAt(anchor, scale / this.viewport.scale);
    },

    panBy: function (dx, dy) {
      this.viewport.x += dx;
      this.viewport.y += dy;
      this.emit('view');
      this.emit('change');
    },

    zoomExtents: function () {
      var b = Drawing.bounds(this.drawing);
      var s = this.size();
      var w = Math.max(1, s.w), h = Math.max(1, s.h);
      var bw = Math.max(1e-6, b.max.x - b.min.x);
      var bh = Math.max(1e-6, b.max.y - b.min.y);
      var scale = U.clamp(Math.min(w / bw, h / bh) * 0.9, 0.001, 100000);
      this.viewport.scale = scale;
      var cx = (b.min.x + b.max.x) / 2;
      var cy = (b.min.y + b.max.y) / 2;
      this.viewport.x = w / 2 - cx * scale;
      this.viewport.y = h / 2 + cy * scale;
      this.emit('view');
      this.emit('change');
    },

    visibleWorldRect: function () {
      var s = this.size();
      var a = this.screenToWorld({ x: 0, y: 0 });
      var c = this.screenToWorld({ x: s.w, y: s.h });
      return {
        min: G.v(Math.min(a.x, c.x), Math.min(a.y, c.y)),
        max: G.v(Math.max(a.x, c.x), Math.max(a.y, c.y))
      };
    },

    /* ---- entity helpers ---- */
    entityById: function (id) { return Drawing.byId(this.drawing, id); },

    effectiveColor: function (e) {
      if (e.color) return e.color;
      var l = Drawing.layerOf(this.drawing, e);
      return (l && l.color) || '#e8e8e8';
    },

    effectiveLinetype: function (e) {
      if (e.linetype && e.linetype !== 'bylayer') return e.linetype;
      var l = Drawing.layerOf(this.drawing, e);
      return (l && l.linetype) || 'continuous';
    },

    effectiveLineweight: function (e) {
      var l = Drawing.layerOf(this.drawing, e);
      return e.lineweight || (l && l.lineweight) || 1;
    },

    addEntity: function (e, opts) {
      if (e.layer == null || (e.layer === '0' && opts && opts.forceLayer)) {
        e.layer = this.drawing.currentLayer;
      }
      Drawing.addEntity(this.drawing, e);
      if (opts && opts.select) {
        this.selection = {};
        this.selection[e.id] = true;
      }
      return e;
    },

    /* ---- selection ---- */
    selected: function () {
      var out = [];
      for (var i = 0; i < this.drawing.entities.length; i++) {
        var e = this.drawing.entities[i];
        if (this.selection[e.id]) out.push(e);
      }
      return out;
    },

    selectedIds: function () { return Object.keys(this.selection); },
    hasSelection: function () { return this.selectedIds().length > 0; },

    select: function (id, additive) {
      if (!additive) this.selection = {};
      if (id) this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },

    toggleSelect: function (id) {
      if (this.selection[id]) delete this.selection[id];
      else this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },

    clearSelection: function () {
      this.selection = {};
      this.emit('selection');
      this.emit('change');
    },

    selectAll: function () {
      var list = Drawing.visibleEntities(this.drawing);
      this.selection = {};
      for (var i = 0; i < list.length; i++) {
        if (!Drawing.isLayerLocked(this.drawing, list[i])) this.selection[list[i].id] = true;
      }
      this.emit('selection');
      this.emit('change');
    },

    selectInRect: function (rect, additive) {
      if (!additive) this.selection = {};
      var list = Drawing.visibleEntities(this.drawing);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (Drawing.isLayerLocked(this.drawing, e)) continue;
        var b = Entities.bounds(e);
        if (b.min.x >= rect.min.x && b.min.y >= rect.min.y && b.max.x <= rect.max.x && b.max.y <= rect.max.y) {
          this.selection[e.id] = true;
        }
      }
      this.emit('selection');
      this.emit('change');
    },

    deleteSelection: function () {
      var ids = this.selectedIds();
      if (!ids.length) return;
      for (var i = 0; i < ids.length; i++) Drawing.removeEntity(this.drawing, ids[i]);
      this.selection = {};
      this.commit();
      this.emit('selection');
      this.emit('scene');
    },

    moveSelection: function (dx, dy) {
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) {
        if (Drawing.isLayerLocked(this.drawing, sel[i])) continue;
        Entities.translate(sel[i], dx || 0, dy || 0);
      }
      this.emit('change');
    },

    applyToSelection: function (fn) {
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) fn(sel[i]);
      this.emit('change');
    },

    /* ---- tools / input ---- */
    setTool: function (key) {
      if (!Tools.def(key)) return;
      this.tool = key;
      this.pending = [];
      this.measure = null;
      this.emit('tool');
      this.emit('change');
    },

    resolveInput: function (wp, tolWorld) {
      var snap = null;
      if (this.showSnap) {
        var modes = this.snapModes || Snap.defaultModes();
        snap = Snap.find(wp, this.drawing, {
          modes: modes,
          tol: tolWorld,
          gridSize: modes.grid ? this.drawing.gridSize : 0
        });
      }
      var pt = snap ? snap.point : G.v(wp.x, wp.y);
      var type = snap ? snap.type : null;

      var base = this.pending.length ? this.pending[this.pending.length - 1] : null;
      if (this.ortho && base) {
        var d = G.sub(pt, base);
        if (Math.abs(d.x) >= Math.abs(d.y)) pt = G.v(pt.x, base.y);
        else pt = G.v(base.x, pt.y);
        type = 'ortho';
      }
      this.snapHit = type ? { point: pt, type: type } : null;
      return { point: pt, snap: this.snapHit };
    },

    hover: function (wp) {
      this.cursor = wp;
      this.emit('change');
    },

    click: function (wp) {
      var t = this.tool;
      if (t === 'select') return null;

      if (t === 'move') {
        if (!this.pending.length) { this.pending = [wp]; this.emit('change'); return null; }
        var from = this.pending[0];
        this.moveSelection(wp.x - from.x, wp.y - from.y);
        this.pending = [];
        this.commit();
        return null;
      }

      if (t === 'measure') {
        if (!this.pending.length) { this.pending = [wp]; this.emit('change'); return null; }
        this.measure = Tools.buildFromPoints('measure', [this.pending[0], wp]);
        this.pending = [];
        this.emit('measure');
        this.emit('change');
        return this.measure;
      }

      if (t === 'text') {
        if (!this.pending.length) { this.pending = [wp]; this.emit('change'); }
        return null;
      }

      this.pending.push(wp);
      var steps = Tools.steps(t);
      if (steps && this.pending.length >= steps) {
        var ent = Tools.buildFromPoints(t, this.pending.slice());
        if (ent) this.stamp(ent);
        this.pending = [];
        this.commit();
      } else {
        this.emit('change');
      }
      return null;
    },

    stamp: function (ent) {
      ent.layer = this.drawing.currentLayer;
      Drawing.addEntity(this.drawing, ent);
      this.emit('scene');
      return ent;
    },

    placeText: function (text) {
      if (this.tool !== 'text' || !this.pending.length) return null;
      var ent = Tools.buildFromPoints('text', [this.pending[0]], { text: text });
      this.stamp(ent);
      this.pending = [];
      this.commit();
      return ent;
    },

    finish: function () {
      var t = this.tool;
      if (t === 'polyline' && this.pending.length >= 2) {
        var pl = Tools.buildFromPoints('polyline', this.pending.slice());
        this.stamp(pl);
        this.pending = [];
        this.commit();
        return pl;
      }
      if (t === 'hatch' && this.pending.length >= 3) {
        var h = Tools.buildFromPoints('hatch', this.pending.slice());
        this.stamp(h);
        this.pending = [];
        this.commit();
        return h;
      }
      this.pending = [];
      this.emit('change');
      return null;
    },

    cancel: function () {
      if (this.pending.length || this.measure) {
        this.pending = [];
        this.measure = null;
        this.emit('change');
        return true;
      }
      if (this.hasSelection()) {
        this.clearSelection();
        return true;
      }
      return false;
    },

    /* ---- settings ---- */
    setGridSize: function (v) {
      this.drawing.gridSize = Math.max(0.01, v || 1);
      this.commit();
    },

    toggleSnapMode: function (mode) {
      if (!this.snapModes) this.snapModes = Snap.defaultModes();
      this.snapModes[mode] = !this.snapModes[mode];
      this.emit('snap');
      this.emit('change');
    },

    addLayer: function (name, color) {
      var l = Layers.create(name || ('Calque' + (this.drawing.layers.length)), color || Layers.COLORS[this.drawing.layers.length % Layers.COLORS.length]);
      Layers.add(this.drawing.layers, l);
      this.drawing.currentLayer = l.name;
      this.commit();
      this.emit('layers');
      this.emit('change');
      return l;
    },

    removeLayer: function (name) {
      if (Layers.remove(this.drawing.layers, name)) {
        var moved = Drawing.entitiesOn(this.drawing, name);
        for (var i = 0; i < moved.length; i++) moved[i].layer = '0';
        if (this.drawing.currentLayer === name) this.drawing.currentLayer = '0';
        this.commit();
        this.emit('layers');
        this.emit('change');
        return true;
      }
      return false;
    },

    setLayerFlag: function (name, flag, value) {
      var l = Layers.byName(this.drawing.layers, name);
      if (!l) return;
      l[flag] = value;
      this.emit('layers');
      this.emit('change');
    },

    setCurrentLayer: function (name) {
      if (Layers.byName(this.drawing.layers, name)) {
        this.drawing.currentLayer = name;
        this.emit('layers');
        this.emit('change');
      }
    },

    setSelectionLayer: function (name) {
      this.applyToSelection(function (e) { e.layer = name; });
      this.commit();
    }
  };

  global.App = App;
})(window);

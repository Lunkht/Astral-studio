(function (global) {
  'use strict';

  var U = global.Utils;
  var K = global.Keyframe;
  var Layer = global.Layer;
  var Comp = global.Comp;
  var Effects = global.Effects;
  var Asset = global.Asset;

  var App = {
    comp: null,
    assets: { byId: {}, list: [] },
    time: 0,
    playing: false,
    selection: [],
    tool: 'select',
    autoKey: false,
    snapEnabled: true,
    camera: { x: 0, y: 0, zoom: 1 },
    _undo: [],
    _redo: [],
    _listeners: {}
  };

  App.on = function (evt, fn) {
    (this._listeners[evt] = this._listeners[evt] || []).push(fn);
    return fn;
  };

  App.off = function (evt, fn) {
    var l = this._listeners[evt];
    if (!l) return;
    var i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  };

  App.emit = function (evt) {
    var l = this._listeners[evt];
    if (!l) return;
    for (var i = 0; i < l.length; i++) l[i]();
  };

  App.newComp = function (opts) {
    this.comp = Comp.create(opts);
    this.time = 0;
    this.playing = false;
    this.selection = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this._undo = [];
    this._redo = [];
    this._last = U.deepClone(this.comp);
    this.emit('change');
    this.emit('time');
  };

  App.addAsset = function (asset) {
    this.assets.byId[asset.id] = asset;
    this.assets.list.push(asset);
    return asset;
  };

  App.importFile = function (file, onReady) {
    var kind = file.type && file.type.indexOf('video') === 0 ? 'video' : 'image';
    var asset = Asset.create({ name: file.name, kind: kind, url: URL.createObjectURL(file) });
    this.addAsset(asset);
    var self = this;
    Asset.probe(asset, function () {
      self.emit('change');
      if (onReady) onReady(asset);
    });
    return asset;
  };

  App.layerById = function (id) {
    return this.comp ? Comp.layerById(this.comp, id) : null;
  };

  App.selectedLayers = function () {
    var out = [], self = this;
    this.selection.forEach(function (id) {
      var l = self.layerById(id);
      if (l) out.push(l);
    });
    return out;
  };

  App.firstSelected = function () {
    var l = this.selectedLayers();
    return l.length ? l[0] : null;
  };

  App.isSelected = function (id) {
    return this.selection.indexOf(id) >= 0;
  };

  App.select = function (id, additive) {
    if (id == null) {
      this.selection = [];
    } else if (additive) {
      var i = this.selection.indexOf(id);
      if (i >= 0) this.selection.splice(i, 1);
      else this.selection.push(id);
    } else {
      this.selection = [id];
    }
    this.emit('change');
  };

  App.selectAll = function () {
    this.selection = (this.comp ? this.comp.layers : []).map(function (l) { return l.id; });
    this.emit('change');
  };

  App.uniqueName = function (base) {
    var n = 0, name;
    var taken = {};
    this.comp.layers.forEach(function (l) { taken[l.name] = true; });
    do { n++; name = base + ' ' + n; } while (taken[name]);
    return name;
  };

  App.addLayerObject = function (layer, noCommit) {
    var c = { x: this.comp.width / 2, y: this.comp.height / 2 };
    if (!K.hasKeys(layer.transform.x)) layer.transform.x.value = c.x;
    if (!K.hasKeys(layer.transform.y)) layer.transform.y.value = c.y;
    layer.name = this.uniqueName(layer.type === 'text' ? (layer.text || 'Texte') : layer.name);
    Comp.addLayer(this.comp, layer);
    this.selection = [layer.id];
    if (!noCommit) this.commit();
    this.emit('change');
    return layer;
  };

  App.addSolid = function (opts) {
    opts = opts || {};
    var layer = Layer.create({
      type: 'solid',
      name: 'Solide',
      color: opts.color || '#3a7bd5',
      shape: { kind: 'rect', w: opts.w || 400, h: opts.h || 400 }
    });
    return this.addLayerObject(layer);
  };

  App.addShape = function (opts) {
    opts = opts || {};
    var layer = Layer.create({
      type: 'shape',
      name: 'Forme',
      color: opts.color || '#d98b3a',
      shape: { kind: opts.kind || 'ellipse', w: opts.w || 320, h: opts.h || 320, radius: 24, points: 5, inner: 0.45 }
    });
    return this.addLayerObject(layer);
  };

  App.addText = function (text) {
    var layer = Layer.create({
      type: 'text',
      name: 'Texte',
      text: text || 'Texte',
      color: '#ffffff',
      fontSize: 96
    });
    return this.addLayerObject(layer);
  };

  App.addMediaLayer = function (assetId) {
    var a = this.assets.byId[assetId];
    if (!a) return null;
    var layer = Layer.create({
      type: a.kind === 'video' ? 'video' : 'image',
      name: a.name,
      assetId: assetId
    });
    return this.addLayerObject(layer);
  };

  App.removeSelected = function () {
    if (!this.selection.length) return;
    var self = this;
    this.selection.forEach(function (id) { Comp.removeLayer(self.comp, id); });
    this.selection = [];
    this.commit();
    this.emit('change');
  };

  App.duplicateSelected = function () {
    var newIds = [];
    var layers = this.selectedLayers();
    for (var i = 0; i < layers.length; i++) {
      var clone = U.deepClone(layers[i]);
      clone.id = U.uid('layer');
      clone.name = this.uniqueName(layers[i].name.replace(/ \d+$/, ''));
      clone.transform.x.value += 32;
      clone.transform.y.value += 32;
      Comp.addLayer(this.comp, clone);
      newIds.push(clone.id);
    }
    if (newIds.length) {
      this.selection = newIds;
      this.commit();
      this.emit('change');
    }
  };

  App.moveSelected = function (delta) {
    if (!this.selection.length) return;
    var ids = this.selection.slice();
    var self = this;
    ids.forEach(function (id) { Comp.moveLayer(self.comp, id, delta); });
    this.commit();
    this.emit('change');
  };

  App.setTime = function (t) {
    this.time = U.clamp(t, 0, this.comp ? this.comp.duration : 0);
    this.emit('time');
    this.emit('change');
  };

  App.stepFrame = function (n) {
    var fps = this.comp ? this.comp.fps : 30;
    this.setTime(this.time + n / fps);
  };

  App.goStart = function () { this.setTime(0); };
  App.goEnd = function () { this.setTime(this.comp ? this.comp.duration : 0); };
  App.togglePlay = function () {
    this.playing = !this.playing;
    this.emit('playing');
    this.emit('change');
  };

  App.setStaticValue = function (prop, value) {
    if (this.autoKey || K.hasKeys(prop)) K.setKey(prop, this.time, value);
    else prop.value = value;
  };

  App.setTransform = function (layerId, name, value, noCommit) {
    var l = this.layerById(layerId);
    if (!l || !l.transform[name]) return;
    this.setStaticValue(l.transform[name], value);
    if (!noCommit) this.commit();
    this.emit('change');
  };

  App.toggleTransformKey = function (layerId, name) {
    var l = this.layerById(layerId);
    if (!l || !l.transform[name]) return;
    var p = l.transform[name];
    K.toggleKeyAt(p, this.time, K.valueAt(p, this.time));
    this.commit();
    this.emit('change');
  };

  App.setEffectParam = function (layerId, fxId, key, value, noCommit) {
    var l = this.layerById(layerId);
    if (!l) return;
    var fx = null;
    l.effects.forEach(function (e) { if (e.id === fxId) fx = e; });
    if (!fx || !fx.params[key]) return;
    this.setStaticValue(fx.params[key], value);
    if (!noCommit) this.commit();
    this.emit('change');
  };

  App.toggleEffectKey = function (layerId, fxId, key) {
    var l = this.layerById(layerId);
    if (!l) return;
    var fx = null;
    l.effects.forEach(function (e) { if (e.id === fxId) fx = e; });
    if (!fx || !fx.params[key]) return;
    var p = fx.params[key];
    K.toggleKeyAt(p, this.time, K.valueAt(p, this.time));
    this.commit();
    this.emit('change');
  };

  App.addEffectToSelection = function (type) {
    var layers = this.selectedLayers();
    if (!layers.length) return;
    var self = this;
    layers.forEach(function (l) { Layer.addEffect(l, type); });
    self.commit();
    self.emit('change');
  };

  App.removeEffect = function (layerId, fxId) {
    var l = this.layerById(layerId);
    if (!l) return;
    Layer.removeEffect(l, fxId);
    this.commit();
    this.emit('change');
  };

  App.toggleEffectEnabled = function (layerId, fxId) {
    var l = this.layerById(layerId);
    if (!l) return;
    l.effects.forEach(function (e) { if (e.id === fxId) e.enabled = !e.enabled; });
    this.commit();
    this.emit('change');
  };

  App.toggleVisibility = function (layerId) {
    var l = this.layerById(layerId);
    if (!l) return;
    l.visible = !l.visible;
    this.commit();
    this.emit('change');
  };

  App.toggleLocked = function (layerId) {
    var l = this.layerById(layerId);
    if (!l) return;
    l.locked = !l.locked;
    this.commit();
    this.emit('change');
  };

  App.setCamera = function (x, y, zoom) {
    this.camera.x = x;
    this.camera.y = y;
    if (U.isNum(zoom)) this.camera.zoom = U.clamp(zoom, 0.1, 8);
    this.emit('change');
  };

  App.zoomBy = function (factor) {
    this.setCamera(this.camera.x, this.camera.y, this.camera.zoom * factor);
  };

  App.commit = function () {
    if (this._last) this._undo.push(this._last);
    if (this._undo.length > 100) this._undo.shift();
    this._redo.length = 0;
    this._last = U.deepClone(this.comp);
    this.emit('history');
  };

  App.canUndo = function () { return this._undo.length > 0; };
  App.canRedo = function () { return this._redo.length > 0; };

  App.undo = function () {
    if (!this._undo.length) return;
    this._redo.push(U.deepClone(this.comp));
    this.comp = this._undo.pop();
    this._last = U.deepClone(this.comp);
    this.cleanSelection();
    this.emit('change');
    this.emit('history');
  };

  App.redo = function () {
    if (!this._redo.length) return;
    this._undo.push(U.deepClone(this.comp));
    this.comp = this._redo.pop();
    this._last = U.deepClone(this.comp);
    this.cleanSelection();
    this.emit('change');
    this.emit('history');
  };

  App.cleanSelection = function () {
    var self = this;
    this.selection = this.selection.filter(function (id) { return !!self.layerById(id); });
    if (this.time > this.comp.duration) this.time = this.comp.duration;
    this.emit('time');
  };

  global.App = App;
})(window);

(function (global) {
  'use strict';

  var V = global.Vec3;
  var M = global.Mat4;
  var Mesh = global.Mesh;
  var Scene = global.Scene;
  var Tools = global.Tools;
  var U = global.Utils;

  var App = {
    scene: null,
    selection: {},
    tool: 'select',
    shading: 'solid',
    showEdges: true,
    showGrid: true,
    showAxes: true,
    camera: {
      target: V.v(0, 1, 0),
      yaw: 0.7,
      pitch: 0.5,
      distance: 8,
      fov: U.deg2rad(50),
      near: 0.1,
      far: 400
    },
    _history: [],
    _redo: [],
    _colorIndex: 0,
    _listeners: {},

    on: function (evt, fn) {
      (this._listeners[evt] || (this._listeners[evt] = [])).push(fn);
    },
    emit: function (evt) {
      var list = this._listeners[evt] || [];
      for (var i = 0; i < list.length; i++) list[i]();
    },

    /* ---- scene ---- */
    newScene: function () {
      this.scene = { objects: [] };
      this.selection = {};
      this._colorIndex = 0;
      var obj = this.makeObject('cube', { name: 'Cube' });
      obj.position.y = Tools.restHeight(obj.mesh);
      Scene.add(this.scene, obj);
      this._history = [JSON.stringify(this.scene)];
      this._redo = [];
      this.frame();
      this.emit('scene');
      this.emit('change');
    },

    makeObject: function (kind, opts) {
      var mesh = Tools.meshFor(kind);
      var color = Tools.COLORS[this._colorIndex % Tools.COLORS.length];
      this._colorIndex++;
      var obj = Scene.createObject(kind, mesh, { name: (opts && opts.name) || mesh.name, color: color });
      obj.position.y = Tools.restHeight(mesh);
      return obj;
    },

    addPrimitive: function (kind) {
      var obj = this.makeObject(kind);
      Scene.add(this.scene, obj);
      this.selection = {};
      this.selection[obj.id] = true;
      this.commit('Ajouter ' + obj.type);
      return obj;
    },

    objectById: function (id) { return Scene.byId(this.scene, id); },
    selectedIds: function () { return Object.keys(this.selection); },
    hasSelection: function () { return this.selectedIds().length > 0; },
    selected: function () {
      var out = [];
      for (var i = 0; i < this.scene.objects.length; i++) {
        if (this.selection[this.scene.objects[i].id]) out.push(this.scene.objects[i]);
      }
      return out;
    },
    select: function (id, additive) {
      if (!additive) this.selection = {};
      if (id) this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },
    clearSelection: function () {
      this.selection = {};
      this.emit('selection');
      this.emit('change');
    },
    toggleSelect: function (id) {
      if (this.selection[id]) delete this.selection[id]; else this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },
    deleteSelection: function () {
      var ids = this.selectedIds();
      if (!ids.length) return;
      for (var i = 0; i < ids.length; i++) Scene.remove(this.scene, ids[i]);
      this.selection = {};
      this.commit('Supprimer');
    },
    duplicateSelection: function () {
      var sel = this.selected();
      if (!sel.length) return;
      var newSel = {};
      for (var i = 0; i < sel.length; i++) {
        var c = U.deepClone(sel[i]);
        c.id = U.uid('obj');
        c.name = sel[i].name + '.001';
        c.position.x += 2;
        Scene.add(this.scene, c);
        newSel[c.id] = true;
      }
      this.selection = newSel;
      this.commit('Dupliquer');
    },

    translateSelection: function (dx, dy, dz) {
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) {
        if (sel[i].locked) continue;
        sel[i].position.x += dx || 0;
        sel[i].position.y += dy || 0;
        sel[i].position.z += dz || 0;
      }
      this.emit('change');
    },
    updateSelected: function (fn) {
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) fn(sel[i]);
      this.emit('change');
    },

    /* ---- camera ---- */
    eye: function () {
      var c = this.camera;
      var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      return V.add(c.target, V.scale(V.v(cp * Math.sin(c.yaw), sp, cp * Math.cos(c.yaw)), c.distance));
    },
    worldBounds: function () {
      var min = V.v(Infinity, Infinity, Infinity);
      var max = V.v(-Infinity, -Infinity, -Infinity);
      var any = false;
      for (var i = 0; i < this.scene.objects.length; i++) {
        var obj = this.scene.objects[i];
        if (!obj.visible) continue;
        var matrix = M.compose(obj.position, obj.rotation, obj.scale);
        for (var j = 0; j < obj.mesh.vertices.length; j++) {
          var p = M.transformPoint(matrix, obj.mesh.vertices[j]);
          min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
          max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
          any = true;
        }
      }
      if (!any) return { min: V.v(-1, -1, -1), max: V.v(1, 1, 1) };
      return { min: min, max: max };
    },
    frame: function () {
      var b = this.worldBounds();
      this.camera.target = V.scale(V.add(b.min, b.max), 0.5);
      var radius = Math.max(1, V.length(V.sub(b.max, b.min)) / 2);
      this.camera.distance = U.clamp(radius / Math.tan(this.camera.fov / 2) * 1.7, 1, 300);
      this.emit('camera');
      this.emit('change');
    },
    setView: function (name) {
      if (name === 'front') { this.camera.yaw = 0; this.camera.pitch = 0; }
      else if (name === 'side') { this.camera.yaw = Math.PI / 2; this.camera.pitch = 0; }
      else if (name === 'top') { this.camera.yaw = 0; this.camera.pitch = Math.PI / 2 - 0.001; }
      else { this.camera.yaw = 0.7; this.camera.pitch = 0.5; }
      this.emit('camera');
      this.emit('change');
    },

    /* ---- history ---- */
    commit: function () {
      this._history.push(JSON.stringify(this.scene));
      if (this._history.length > 60) this._history.shift();
      this._redo = [];
      this.emit('change');
    },
    undo: function () {
      if (this._history.length <= 1) return;
      this._redo.push(this._history.pop());
      this.scene = JSON.parse(this._history[this._history.length - 1]);
      this.pruneSelection();
      this.emit('change');
    },
    redo: function () {
      if (!this._redo.length) return;
      var s = this._redo.pop();
      this._history.push(s);
      this.scene = JSON.parse(s);
      this.pruneSelection();
      this.emit('change');
    },
    pruneSelection: function () {
      var self = this;
      this.selectedIds().forEach(function (id) { if (!Scene.byId(self.scene, id)) delete self.selection[id]; });
    },
    canUndo: function () { return this._history.length > 1; },
    canRedo: function () { return this._redo.length > 0; }
  };

  global.App = App;
})(window);

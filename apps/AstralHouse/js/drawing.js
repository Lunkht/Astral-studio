(function (global) {
  'use strict';

  var Layers = global.Layers;
  var Entities = global.Entities;
  var G = global.Geom;

  var Drawing = {
    create: function (opts) {
      var o = opts || {};
      return {
        name: o.name || 'Dessin1',
        units: o.units || 'mm',
        scale: o.scale || 1,
        gridSize: o.gridSize || 10,
        gridMajor: o.gridMajor || 5,
        entities: [],
        layers: Layers.defaults(),
        currentLayer: '0'
      };
    },

    addEntity: function (d, e) { d.entities.push(e); return e; },

    addAll: function (d, list) {
      for (var i = 0; i < list.length; i++) d.entities.push(list[i]);
      return d;
    },

    removeEntity: function (d, id) {
      for (var i = 0; i < d.entities.length; i++) {
        if (d.entities[i].id === id) { d.entities.splice(i, 1); return true; }
      }
      return false;
    },

    byId: function (d, id) {
      for (var i = 0; i < d.entities.length; i++) {
        if (d.entities[i].id === id) return d.entities[i];
      }
      return null;
    },

    layerByName: function (d, name) { return Layers.byName(d.layers, name); },

    layerOf: function (d, e) {
      return Layers.byName(d.layers, e.layer) || Layers.byName(d.layers, '0') || d.layers[0];
    },

    isLayerVisible: function (d, e) {
      var l = Drawing.layerOf(d, e);
      return !!l && l.visible !== false;
    },

    isLayerLocked: function (d, e) {
      var l = Drawing.layerOf(d, e);
      return !!l && !!l.locked;
    },

    entitiesOn: function (d, name) {
      return d.entities.filter(function (e) { return e.layer === name; });
    },

    visibleEntities: function (d) {
      return d.entities.filter(function (e) { return e.visible !== false && Drawing.isLayerVisible(d, e); });
    },

    bounds: function (d) {
      var min = G.v(Infinity, Infinity), max = G.v(-Infinity, -Infinity);
      var any = false;
      var list = Drawing.visibleEntities(d);
      for (var i = 0; i < list.length; i++) {
        var b = Entities.bounds(list[i]);
        min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y);
        max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y);
        any = true;
      }
      if (!any) return { min: G.v(-50, -50), max: G.v(50, 50) };
      if (min.x === max.x) { min.x -= 5; max.x += 5; }
      if (min.y === max.y) { min.y -= 5; max.y += 5; }
      return { min: min, max: max };
    },

    count: function (d) { return d.entities.length; },

    serialize: function (d) { return JSON.stringify(d); },

    deserialize: function (text) {
      var d = typeof text === 'string' ? JSON.parse(text) : text;
      if (!d.layers || !d.layers.length) d.layers = Layers.defaults();
      if (!d.entities) d.entities = [];
      if (!d.currentLayer) d.currentLayer = '0';
      return d;
    }
  };

  global.Drawing = Drawing;
})(window);

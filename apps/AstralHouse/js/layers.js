(function (global) {
  'use strict';

  var U = global.Utils;

  function layer(name, color, opts) {
    var o = opts || {};
    return {
      name: name,
      color: color,
      linetype: o.linetype || 'continuous',
      lineweight: o.lineweight || 1,
      visible: o.visible !== false,
      locked: !!o.locked
    };
  }

  var Layers = {
    COLORS: ['#e8e8e8', '#d0a060', '#60c0a0', '#7aa2f7', '#e06c75', '#c678dd', '#98c379', '#e5c07b'],

    LINETYPES: ['continuous', 'dashed', 'dotted', 'dashdot', 'center'],

    defaults: function () {
      return [
        layer('0', '#e8e8e8'),
        layer('Murs', '#d0a060', { lineweight: 2 }),
        layer('Cotation', '#60c0a0'),
        layer('Hachures', '#808080', { linetype: 'dashed' }),
        layer('Axes', '#7aa2f7', { linetype: 'center' })
      ];
    },

    create: layer,

    add: function (layers, l) { layers.push(l); return l; },

    byName: function (layers, name) {
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === name) return layers[i];
      }
      return null;
    },

    indexOf: function (layers, name) {
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === name) return i;
      }
      return -1;
    },

    remove: function (layers, name) {
      var i = Layers.indexOf(layers, name);
      if (i < 0 || name === '0') return false;
      layers.splice(i, 1);
      return true;
    },

    names: function (layers) {
      return layers.map(function (l) { return l.name; });
    },

    visibleNames: function (layers) {
      return layers.filter(function (l) { return l.visible; }).map(function (l) { return l.name; });
    }
  };

  global.Layers = Layers;
})(window);

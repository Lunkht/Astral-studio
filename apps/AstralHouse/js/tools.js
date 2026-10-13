(function (global) {
  'use strict';

  var G = global.Geom;
  var Utils = global.Utils;
  var Entities = global.Entities;

  var LIST = [
    { key: 'select', title: 'Selection', key2: 'V', steps: 0, hint: 'Clic : selectionner · glisser : fenetre de selection' },
    { key: 'line', title: 'Ligne', key2: 'L', steps: 2, hint: 'Point de depart puis point d\'arrivee' },
    { key: 'polyline', title: 'Polyligne', key2: 'P', steps: 0, hint: 'Clics successifs · Entree pour terminer' },
    { key: 'rectangle', title: 'Rectangle', key2: 'R', steps: 2, hint: 'Premier coin puis coin oppose' },
    { key: 'circle', title: 'Cercle', key2: 'C', steps: 2, hint: 'Centre puis rayon' },
    { key: 'arc', title: 'Arc (3 points)', key2: 'A', steps: 3, hint: 'Debut, point de passage, fin' },
    { key: 'dimension', title: 'Cotation', key2: 'D', steps: 3, hint: 'Point 1, point 2, position de la ligne' },
    { key: 'hatch', title: 'Hachure', key2: 'H', steps: 0, hint: 'Contour par clics · Entree pour terminer' },
    { key: 'text', title: 'Texte', key2: 'T', steps: 1, hint: 'Point d\'insertion' },
    { key: 'move', title: 'Deplacer', key2: 'M', steps: 2, hint: 'Point de base puis destination' },
    { key: 'measure', title: 'Mesurer', key2: 'K', steps: 2, hint: 'Point 1 puis point 2' }
  ];

  var byKey = {};
  for (var i = 0; i < LIST.length; i++) byKey[LIST[i].key] = LIST[i];

  var Tools = {
    LIST: LIST,

    def: function (key) { return byKey[key] || null; },

    isDrawing: function (key) {
      var d = byKey[key];
      return !!d && ['line', 'polyline', 'rectangle', 'circle', 'arc', 'dimension', 'hatch', 'text'].indexOf(key) >= 0;
    },

    steps: function (key) {
      var d = byKey[key];
      return d ? d.steps : 0;
    },

    keyFor: function (letter) {
      var up = String(letter || '').toUpperCase();
      for (var i = 0; i < LIST.length; i++) {
        if (LIST[i].key2 === up) return LIST[i].key;
      }
      return null;
    },

    /* Builds an entity (or a measure/move result) from collected world points. */
    buildFromPoints: function (key, points, opts) {
      var o = opts || {};
      var p = points || [];
      switch (key) {
        case 'line':
          if (p.length < 2) return null;
          return Entities.line(p[0], p[1]);

        case 'rectangle':
          if (p.length < 2) return null;
          return Entities.rectangle(p[0], p[1]);

        case 'circle': {
          if (p.length < 2) return null;
          var r = G.dist(p[0], p[1]);
          if (r < 1e-9) return null;
          return Entities.circle(p[0], r);
        }

        case 'arc': {
          if (p.length < 3) return null;
          var c = G.circumcenter(p[0], p[1], p[2]);
          if (!c) return null;
          var radius = G.dist(c, p[0]);
          var a0 = G.angle(G.sub(p[0], c));
          var a2 = G.angle(G.sub(p[2], c));
          var ccw = G.cross(G.sub(p[1], p[0]), G.sub(p[2], p[0])) > 0;
          return Entities.arc(c, radius, a0, a2, ccw);
        }

        case 'dimension': {
          if (p.length < 3) return null;
          var offset = G.lineDist(p[2], p[0], p[1]);
          return Entities.dimension(p[0], p[1], offset);
        }

        case 'polyline':
          if (p.length < 2) return null;
          return Entities.polyline(p, !!o.closed);

        case 'hatch': {
          if (p.length < 3) return null;
          return Entities.hatch(p, o.angle || Math.PI / 4, o.spacing || 5);
        }

        case 'text':
          if (p.length < 1) return null;
          return Entities.text(p[0], o.text == null ? 'Texte' : o.text, o.height || 12, o.rotation || 0);

        case 'measure': {
          if (p.length < 2) return null;
          return {
            type: 'measure',
            a: G.v(p[0].x, p[0].y),
            b: G.v(p[1].x, p[1].y),
            distance: G.dist(p[0], p[1]),
            angle: G.angle(G.sub(p[1], p[0]))
          };
        }

        case 'move': {
          if (p.length < 2) return null;
          return { type: 'move', from: p[0], to: p[1], dx: p[1].x - p[0].x, dy: p[1].y - p[0].y };
        }
      }
      return null;
    }
  };

  global.Tools = Tools;
})(window);

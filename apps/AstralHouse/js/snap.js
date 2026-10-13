(function (global) {
  'use strict';

  var G = global.Geom;
  var Entities = global.Entities;
  var Drawing = global.Drawing;

  var RANK = {
    endpoint: 1,
    midpoint: 2,
    center: 3,
    quadrant: 4,
    intersection: 5,
    nearest: 6,
    grid: 7
  };

  var Snap = {
    MODES: ['endpoint', 'midpoint', 'center', 'intersection', 'nearest', 'grid'],

    RANK: RANK,

    defaultModes: function () {
      return { endpoint: true, midpoint: true, center: true, intersection: true, nearest: false, grid: false };
    },

    /* opts: { modes, tol (world), gridSize, excludeId } */
    find: function (p, drawing, opts) {
      var o = opts || {};
      var modes = o.modes || Snap.defaultModes();
      var tol = o.tol == null ? 1 : o.tol;
      var tol2 = tol * tol;
      var best = null;

      function consider(point, type) {
        if (!modes[type]) return;
        var d2 = G.dist2(p, point);
        if (d2 > tol2) return;
        var rank = RANK[type] || 9;
        var cand = { point: point, type: type, dist: Math.sqrt(d2), rank: rank };
        if (!best || rank < best.rank || (rank === best.rank && cand.dist < best.dist)) best = cand;
      }

      var list = Drawing.visibleEntities(drawing);
      var byId = {};

      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (Drawing.isLayerLocked(drawing, e)) continue;
        byId[e.id] = e;
        var anchors = Entities.anchors(e);
        for (var a = 0; a < anchors.length; a++) {
          var an = anchors[a];
          if (an.type === 'quadrant' && !modes.center) { /* quadrant is a circle feature */ }
          consider(G.v(an.x, an.y), an.type === 'quadrant' ? 'center' : an.type);
        }
      }

      if (modes.intersection || modes.nearest) {
        for (var m = 0; m < list.length; m++) {
          var em = list[m];
          if (Drawing.isLayerLocked(drawing, em)) continue;
          var msegs = Entities.segments(em);
          for (var n = 0; n < msegs.length; n++) {
            if (modes.nearest) {
              var cp = G.closestOnSeg(p, msegs[n][0], msegs[n][1]);
              consider(cp, 'nearest');
            }
            if (modes.intersection) {
              for (var k = m; k < list.length; k++) {
                var ek = list[k];
                if (Drawing.isLayerLocked(drawing, ek)) continue;
                var ksegs = Entities.segments(ek);
                for (var s = 0; s < ksegs.length; s++) {
                  if (m === k && n >= s) continue;
                  var hit = G.segIntersect(msegs[n][0], msegs[n][1], ksegs[s][0], ksegs[s][1]);
                  if (hit) consider(hit, 'intersection');
                }
              }
            }
          }
        }
      }

      if (modes.grid && o.gridSize) {
        var gx = Math.round(p.x / o.gridSize) * o.gridSize;
        var gy = Math.round(p.y / o.gridSize) * o.gridSize;
        consider(G.v(gx, gy), 'grid');
      }

      return best;
    }
  };

  global.Snap = Snap;
})(window);

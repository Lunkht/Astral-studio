(function (global) {
  'use strict';

  var U = global.Utils;

  function v(x, y) { return { x: x || 0, y: y || 0 }; }

  var Geom = {
    v: v,

    add: function (a, b) { return v(a.x + b.x, a.y + b.y); },
    sub: function (a, b) { return v(a.x - b.x, a.y - b.y); },
    scale: function (a, s) { return v(a.x * s, a.y * s); },
    dot: function (a, b) { return a.x * b.x + a.y * b.y; },
    cross: function (a, b) { return a.x * b.y - a.y * b.x; },

    len: function (a) { return Math.sqrt(a.x * a.x + a.y * a.y); },
    dist2: function (a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; },
    dist: function (a, b) { return Math.sqrt(Geom.dist2(a, b)); },

    normalize: function (a) {
      var l = Geom.len(a);
      return l < 1e-12 ? v(0, 0) : v(a.x / l, a.y / l);
    },

    angle: function (a) { return Math.atan2(a.y, a.x); },

    rotate: function (p, ang, origin) {
      var o = origin || v(0, 0);
      var c = Math.cos(ang), s = Math.sin(ang);
      var dx = p.x - o.x, dy = p.y - o.y;
      return v(o.x + dx * c - dy * s, o.y + dx * s + dy * c);
    },

    lerp: function (a, b, t) { return v(U.lerp(a.x, b.x, t), U.lerp(a.y, b.y, t)); },

    mid: function (a, b) { return v((a.x + b.x) / 2, (a.y + b.y) / 2); },

    perp: function (a) { return v(-a.y, a.x); },

    /* signed distance from p to the infinite line (a->b) */
    lineDist: function (p, a, b) {
      var ab = Geom.sub(b, a);
      var l = Geom.len(ab);
      if (l < 1e-12) return Geom.dist(p, a);
      return Geom.cross(ab, Geom.sub(p, a)) / l;
    },

    /* closest point on segment a-b to p */
    closestOnSeg: function (p, a, b) {
      var ab = Geom.sub(b, a);
      var l2 = Geom.dot(ab, ab);
      if (l2 < 1e-12) return v(a.x, a.y);
      var t = U.clamp(Geom.dot(Geom.sub(p, a), ab) / l2, 0, 1);
      return v(a.x + ab.x * t, a.y + ab.y * t);
    },

    pointSegDist: function (p, a, b) {
      return Geom.dist(p, Geom.closestOnSeg(p, a, b));
    },

    /* intersection of segments a-b and c-d, or null */
    segIntersect: function (a, b, c, d) {
      var r = Geom.sub(b, a);
      var s = Geom.sub(d, c);
      var denom = Geom.cross(r, s);
      if (Math.abs(denom) < 1e-12) return null;
      var t = Geom.cross(Geom.sub(c, a), s) / denom;
      var u = Geom.cross(Geom.sub(c, a), r) / denom;
      if (t < 0 || t > 1 || u < 0 || u > 1) return null;
      return v(a.x + r.x * t, a.y + r.y * t);
    },

    /* intersections of infinite line a-b with circle (center, r): array of points */
    lineCircle: function (a, b, center, r) {
      var d = Geom.sub(b, a);
      var f = Geom.sub(a, center);
      var A = Geom.dot(d, d);
      if (A < 1e-12) return [];
      var B = 2 * Geom.dot(f, d);
      var C = Geom.dot(f, f) - r * r;
      var disc = B * B - 4 * A * C;
      if (disc < 0) return [];
      var sq = Math.sqrt(disc);
      var out = [];
      out.push(v(a.x + d.x * (-B - sq) / (2 * A), a.y + d.y * (-B - sq) / (2 * A)));
      if (sq > 1e-12) out.push(v(a.x + d.x * (-B + sq) / (2 * A), a.y + d.y * (-B + sq) / (2 * A)));
      return out;
    },

    circumcenter: function (a, b, c) {
      var d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-9) return null;
      var a2 = a.x * a.x + a.y * a.y;
      var b2 = b.x * b.x + b.y * b.y;
      var c2 = c.x * c.x + c.y * c.y;
      return v(
        (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
        (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
      );
    },

    pointInPolygon: function (p, poly) {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i].x, yi = poly[i].y;
        var xj = poly[j].x, yj = poly[j].y;
        var hit = ((yi > p.y) !== (yj > p.y)) &&
          (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (hit) inside = !inside;
      }
      return inside;
    },

    polygonArea: function (poly) {
      var s = 0;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        s += (poly[j].x * poly[i].y) - (poly[i].x * poly[j].y);
      }
      return s / 2;
    },

    pointsBounds: function (pts) {
      if (!pts || !pts.length) return { min: v(0, 0), max: v(0, 0) };
      var min = v(pts[0].x, pts[0].y), max = v(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) {
        min.x = Math.min(min.x, pts[i].x); min.y = Math.min(min.y, pts[i].y);
        max.x = Math.max(max.x, pts[i].x); max.y = Math.max(max.y, pts[i].y);
      }
      return { min: min, max: max };
    },

    polylineLength: function (pts, closed) {
      var total = 0;
      for (var i = 1; i < pts.length; i++) total += Geom.dist(pts[i - 1], pts[i]);
      if (closed && pts.length > 1) total += Geom.dist(pts[pts.length - 1], pts[0]);
      return total;
    }
  };

  global.Geom = Geom;
})(window);

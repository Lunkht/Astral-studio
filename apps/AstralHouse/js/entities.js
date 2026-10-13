(function (global) {
  'use strict';

  var U = global.Utils;
  var G = global.Geom;

  var CIRCLE_SEGMENTS = 72;

  function base(type, props) {
    var e = {
      id: U.uid('e'),
      type: type,
      layer: '0',
      color: null,
      linetype: 'bylayer',
      lineweight: 1,
      visible: true,
      locked: false
    };
    if (props) {
      for (var k in props) {
        if (Object.prototype.hasOwnProperty.call(props, k)) e[k] = props[k];
      }
    }
    return e;
  }

  var Entities = {
    TYPES: ['line', 'polyline', 'rectangle', 'circle', 'arc', 'text', 'dimension', 'hatch'],

    /* ---- factories ---- */
    create: base,

    line: function (a, b, props) {
      return base('line', { p1: G.v(a.x, a.y), p2: G.v(b.x, b.y) });
    },

    polyline: function (points, closed, props) {
      var pts = points.map(function (p) { return G.v(p.x, p.y); });
      return base('polyline', { points: pts, closed: !!closed });
    },

    rectangle: function (a, b, props) {
      return base('rectangle', { p1: G.v(a.x, a.y), p2: G.v(b.x, b.y) });
    },

    circle: function (center, radius, props) {
      return base('circle', { center: G.v(center.x, center.y), radius: Math.abs(radius) });
    },

    arc: function (center, radius, startAngle, endAngle, ccw, props) {
      return base('arc', {
        center: G.v(center.x, center.y),
        radius: Math.abs(radius),
        startAngle: startAngle,
        endAngle: endAngle,
        ccw: ccw !== false
      });
    },

    text: function (position, text, height, rotation, props) {
      return base('text', {
        position: G.v(position.x, position.y),
        text: text == null ? 'Texte' : String(text),
        height: height || 12,
        rotation: rotation || 0
      });
    },

    dimension: function (a, b, offset, props) {
      return base('dimension', {
        p1: G.v(a.x, a.y),
        p2: G.v(b.x, b.y),
        offset: offset || 0
      });
    },

    hatch: function (boundary, angle, spacing, props) {
      return base('hatch', {
        boundary: boundary.map(function (p) { return G.v(p.x, p.y); }),
        angle: angle || 0,
        spacing: spacing || 5,
        pattern: 'ANSI31'
      });
    },

    /* ---- geometry ---- */
    arcSweep: function (e) {
      var twoPi = Math.PI * 2;
      if (e.ccw) {
        var s = (e.endAngle - e.startAngle) % twoPi;
        return s < 0 ? s + twoPi : s;
      }
      var n = (e.startAngle - e.endAngle) % twoPi;
      return n < 0 ? n + twoPi : -n;
    },

    arcContainsAngle: function (e, ang) {
      var sweep = Entities.arcSweep(e);
      var rel = U.angleDelta(e.startAngle, ang);
      if (sweep >= 0) return rel >= -1e-9 && rel <= sweep + 1e-9;
      return rel <= 1e-9 && rel >= sweep - 1e-9;
    },

    rectPoints: function (e) {
      var x1 = Math.min(e.p1.x, e.p2.x), x2 = Math.max(e.p1.x, e.p2.x);
      var y1 = Math.min(e.p1.y, e.p2.y), y2 = Math.max(e.p1.y, e.p2.y);
      return [G.v(x1, y1), G.v(x2, y1), G.v(x2, y2), G.v(x1, y2)];
    },

    points: function (e) {
      switch (e.type) {
        case 'line': return [G.v(e.p1.x, e.p1.y), G.v(e.p2.x, e.p2.y)];
        case 'polyline': return e.points.map(function (p) { return G.v(p.x, p.y); });
        case 'rectangle': return Entities.rectPoints(e);
        case 'circle': {
          var out = [];
          for (var i = 0; i < CIRCLE_SEGMENTS; i++) {
            var a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            out.push(G.v(e.center.x + Math.cos(a) * e.radius, e.center.y + Math.sin(a) * e.radius));
          }
          return out;
        }
        case 'arc': {
          var sweep = Entities.arcSweep(e);
          var n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
          var pts = [];
          for (var k = 0; k <= n; k++) {
            var ang = e.startAngle + sweep * (k / n);
            pts.push(G.v(e.center.x + Math.cos(ang) * e.radius, e.center.y + Math.sin(ang) * e.radius));
          }
          return pts;
        }
        case 'hatch': return e.boundary.map(function (p) { return G.v(p.x, p.y); });
        case 'text': return [G.v(e.position.x, e.position.y)];
        case 'dimension': {
          var o = Entities.dimOffsetPoints(e);
          return [G.v(e.p1.x, e.p1.y), G.v(e.p2.x, e.p2.y), o.a, o.b];
        }
        default: return [];
      }
    },

    dimOffsetPoints: function (e) {
      var d = G.normalize(G.sub(e.p2, e.p1));
      var n = G.perp(d);
      return {
        a: G.add(e.p1, G.scale(n, e.offset)),
        b: G.add(e.p2, G.scale(n, e.offset))
      };
    },

    segments: function (e) {
      var pts = Entities.points(e);
      var segs = [];
      var closed = e.type === 'rectangle' || e.type === 'circle' || e.type === 'hatch' || (e.type === 'polyline' && e.closed);
      if (e.type === 'dimension') {
        var o = Entities.dimOffsetPoints(e);
        segs.push([G.v(e.p1.x, e.p1.y), o.a]);
        segs.push([G.v(e.p2.x, e.p2.y), o.b]);
        segs.push([o.a, o.b]);
        return segs;
      }
      for (var i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
      if (closed && pts.length > 1) segs.push([pts[pts.length - 1], pts[0]]);
      return segs;
    },

    anchors: function (e) {
      var out = [];
      switch (e.type) {
        case 'line':
          out.push({ x: e.p1.x, y: e.p1.y, type: 'endpoint' });
          out.push({ x: e.p2.x, y: e.p2.y, type: 'endpoint' });
          out.push({ x: (e.p1.x + e.p2.x) / 2, y: (e.p1.y + e.p2.y) / 2, type: 'midpoint' });
          break;
        case 'polyline':
          for (var i = 0; i < e.points.length; i++) {
            out.push({ x: e.points[i].x, y: e.points[i].y, type: 'endpoint' });
          }
          for (var j = 1; j < e.points.length; j++) {
            out.push({
              x: (e.points[j - 1].x + e.points[j].x) / 2,
              y: (e.points[j - 1].y + e.points[j].y) / 2,
              type: 'midpoint'
            });
          }
          break;
        case 'rectangle': {
          var rp = Entities.rectPoints(e);
          for (var r = 0; r < rp.length; r++) out.push({ x: rp[r].x, y: rp[r].y, type: 'endpoint' });
          out.push({ x: (e.p1.x + e.p2.x) / 2, y: (e.p1.y + e.p2.y) / 2, type: 'center' });
          break;
        }
        case 'circle':
          out.push({ x: e.center.x, y: e.center.y, type: 'center' });
          for (var q = 0; q < 4; q++) {
            var qa = q * Math.PI / 2;
            out.push({
              x: e.center.x + Math.cos(qa) * e.radius,
              y: e.center.y + Math.sin(qa) * e.radius,
              type: 'quadrant'
            });
          }
          break;
        case 'arc': {
          out.push({ x: e.center.x, y: e.center.y, type: 'center' });
          var sweep = Entities.arcSweep(e);
          out.push({
            x: e.center.x + Math.cos(e.startAngle) * e.radius,
            y: e.center.y + Math.sin(e.startAngle) * e.radius,
            type: 'endpoint'
          });
          var endA = e.startAngle + sweep;
          out.push({
            x: e.center.x + Math.cos(endA) * e.radius,
            y: e.center.y + Math.sin(endA) * e.radius,
            type: 'endpoint'
          });
          var midA = e.startAngle + sweep / 2;
          out.push({
            x: e.center.x + Math.cos(midA) * e.radius,
            y: e.center.y + Math.sin(midA) * e.radius,
            type: 'midpoint'
          });
          break;
        }
        case 'hatch':
          for (var h = 0; h < e.boundary.length; h++) {
            out.push({ x: e.boundary[h].x, y: e.boundary[h].y, type: 'endpoint' });
          }
          break;
        case 'text':
          out.push({ x: e.position.x, y: e.position.y, type: 'endpoint' });
          break;
        case 'dimension':
          out.push({ x: e.p1.x, y: e.p1.y, type: 'endpoint' });
          out.push({ x: e.p2.x, y: e.p2.y, type: 'endpoint' });
          break;
      }
      return out;
    },

    center: function (e) {
      if (e.type === 'circle' || e.type === 'arc') return G.v(e.center.x, e.center.y);
      return null;
    },

    bounds: function (e) {
      switch (e.type) {
        case 'circle':
          return {
            min: G.v(e.center.x - e.radius, e.center.y - e.radius),
            max: G.v(e.center.x + e.radius, e.center.y + e.radius)
          };
        case 'text': {
          var w = e.text.length * e.height * 0.62;
          var corners = [
            e.position,
            G.v(e.position.x + w, e.position.y),
            G.v(e.position.x + w, e.position.y + e.height),
            G.v(e.position.x, e.position.y + e.height)
          ];
          if (e.rotation) {
            corners = corners.map(function (c) { return G.rotate(c, e.rotation, e.position); });
          }
          return G.pointsBounds(corners);
        }
        default:
          return G.pointsBounds(Entities.points(e));
      }
    },

    hitTest: function (e, p, tol) {
      if (e.type === 'circle') {
        return Math.abs(G.dist(p, e.center) - e.radius) <= tol;
      }
      if (e.type === 'arc') {
        if (Math.abs(G.dist(p, e.center) - e.radius) > tol) return false;
        return Entities.arcContainsAngle(e, G.angle(G.sub(p, e.center)));
      }
      if (e.type === 'hatch') {
        return G.pointInPolygon(p, e.boundary);
      }
      var segs = Entities.segments(e);
      for (var i = 0; i < segs.length; i++) {
        if (G.pointSegDist(p, segs[i][0], segs[i][1]) <= tol) return true;
      }
      return false;
    },

    /* ---- hatch fill line generation ---- */
    hatchSegments: function (e) {
      var poly = e.boundary;
      if (!poly || poly.length < 3) return [];
      var angle = e.angle || 0;
      var spacing = Math.max(0.1, e.spacing || 5);
      var origin = poly[0];
      var rot = poly.map(function (p) { return G.rotate(p, -angle, origin); });
      var bb = G.pointsBounds(rot);
      var segs = [];
      var y = bb.min.y + spacing * 0.5;
      var guard = 0;
      while (y < bb.max.y && guard < 100000) {
        guard++;
        var xs = [];
        for (var i = 0, j = rot.length - 1; i < rot.length; j = i++) {
          var yi = rot[i].y, yj = rot[j].y;
          if ((yi > y) !== (yj > y)) {
            var x = rot[i].x + (y - yi) * (rot[j].x - rot[i].x) / (yj - yi);
            xs.push(x);
          }
        }
        xs.sort(function (a, b) { return a - b; });
        for (var k = 0; k + 1 < xs.length; k += 2) {
          var a = G.rotate(G.v(xs[k], y), angle, origin);
          var b = G.rotate(G.v(xs[k + 1], y), angle, origin);
          segs.push([a, b]);
        }
        y += spacing;
      }
      return segs;
    },

    /* ---- edits ---- */
    translate: function (e, dx, dy) {
      function move(p) { p.x += dx; p.y += dy; }
      switch (e.type) {
        case 'line': case 'rectangle': case 'dimension': move(e.p1); move(e.p2); break;
        case 'polyline': case 'hatch':
          var arr = e.type === 'polyline' ? e.points : e.boundary;
          for (var i = 0; i < arr.length; i++) move(arr[i]);
          break;
        case 'circle': case 'arc': move(e.center); break;
        case 'text': move(e.position); break;
      }
      return e;
    },

    rotate: function (e, ang, origin) {
      var o = origin || G.v(0, 0);
      function rot(p) { var r = G.rotate(p, ang, o); p.x = r.x; p.y = r.y; }
      switch (e.type) {
        case 'line': case 'rectangle': case 'dimension': rot(e.p1); rot(e.p2); break;
        case 'polyline': case 'hatch':
          var arr = e.type === 'polyline' ? e.points : e.boundary;
          for (var i = 0; i < arr.length; i++) rot(arr[i]);
          break;
        case 'circle': rot(e.center); break;
        case 'arc':
          rot(e.center);
          e.startAngle += ang;
          e.endAngle += ang;
          break;
        case 'text': rot(e.position); e.rotation += ang; break;
      }
      return e;
    },

    clone: function (e) {
      var c = U.deepClone(e);
      c.id = U.uid('e');
      return c;
    },

    length: function (e) {
      if (e.type === 'line') return G.dist(e.p1, e.p2);
      if (e.type === 'polyline') return G.polylineLength(e.points, e.closed);
      if (e.type === 'circle') return 2 * Math.PI * e.radius;
      if (e.type === 'arc') return Math.abs(Entities.arcSweep(e)) * e.radius;
      if (e.type === 'rectangle') {
        return 2 * (Math.abs(e.p2.x - e.p1.x) + Math.abs(e.p2.y - e.p1.y));
      }
      return 0;
    },

    area: function (e) {
      if (e.type === 'circle') return Math.PI * e.radius * e.radius;
      if (e.type === 'rectangle') return Math.abs((e.p2.x - e.p1.x) * (e.p2.y - e.p1.y));
      if (e.type === 'polyline' && e.closed) return Math.abs(G.polygonArea(e.points));
      if (e.type === 'hatch') return Math.abs(G.polygonArea(e.boundary));
      return 0;
    },

    label: function (e) {
      switch (e.type) {
        case 'line': return U.fmt(Entities.length(e));
        case 'circle': return 'R' + U.fmt(e.radius);
        case 'arc': return 'R' + U.fmt(e.radius);
        case 'text': return e.text;
        case 'dimension': return U.fmt(G.dist(e.p1, e.p2));
        default: return e.type;
      }
    }
  };

  global.Entities = Entities;
})(window);

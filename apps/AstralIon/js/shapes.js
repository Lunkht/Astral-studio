(function (global) {
  'use strict';

  var U = global.Utils;

  var DEFAULTS = {
    fill: '#c9d7f0',
    stroke: '#2b3a55',
    strokeWidth: 1,
    opacity: 1,
    rotation: 0
  };

  var NAMES = {
    rect: 'Rectangle', roundrect: 'Rectangle arrondi', ellipse: 'Ellipse',
    line: 'Segment', polygon: 'Polygone', star: 'Étoile', path: 'Tracé', text: 'Texte'
  };

  function create(type, props) {
    var s = {
      id: U.uid(),
      type: type,
      name: NAMES[type] || 'Forme',
      x: 0, y: 0, w: 100, h: 100,
      rotation: 0,
      fill: DEFAULTS.fill,
      stroke: DEFAULTS.stroke,
      strokeWidth: DEFAULTS.strokeWidth,
      opacity: DEFAULTS.opacity,
      visible: true,
      locked: false
    };
    if (type === 'line') { s.p1 = { x: 0, y: 0 }; s.p2 = { x: 1, y: 1 }; s.fill = 'none'; }
    if (type === 'roundrect') { s.radius = 16; }
    if (type === 'polygon') { s.sides = 6; }
    if (type === 'star') { s.points = 5; s.innerRatio = 0.5; }
    if (type === 'path') { s.points = []; s.closed = false; s.fill = 'none'; s.fillRule = 'nonzero'; }
    if (type === 'text') { s.text = 'Texte'; s.fontSize = 48; s.fontFamily = 'Segoe UI, Arial, sans-serif'; s.fontWeight = 400; }
    if (props) {
      for (var k in props) {
        if (Object.prototype.hasOwnProperty.call(props, k)) s[k] = props[k];
      }
    }
    return s;
  }

  function center(s) { return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; }

  function linePoints(s) {
    return {
      a: { x: s.x + s.p1.x * s.w, y: s.y + s.p1.y * s.h },
      b: { x: s.x + s.p2.x * s.w, y: s.y + s.p2.y * s.h }
    };
  }

  /* ---------- Bezier helpers ---------- */
  function cubicPoint(u, p0, c1, c2, p1) {
    var mu = 1 - u;
    var a = mu * mu * mu, b = 3 * mu * mu * u, c = 3 * mu * u * u, d = u * u * u;
    return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y };
  }

  function tracePoints(ctx, pts, closed, ox, oy) {
    if (!pts || !pts.length) return;
    ox = ox || 0; oy = oy || 0;
    ctx.moveTo(ox + pts[0].x, oy + pts[0].y);
    var n = pts.length;
    var segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % n];
      ctx.bezierCurveTo(
        ox + a.x + a.out.x, oy + a.y + a.out.y,
        ox + b.x + b.in.x, oy + b.y + b.in.y,
        ox + b.x, oy + b.y
      );
    }
    if (closed) ctx.closePath();
  }

  function samplePoints(pts, closed, steps, ox, oy) {
    steps = steps || 12;
    ox = ox || 0; oy = oy || 0;
    var out = [];
    if (!pts || !pts.length) return out;
    var n = pts.length;
    var segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % n];
      var p0 = { x: ox + a.x, y: oy + a.y };
      var c1 = { x: ox + a.x + a.out.x, y: oy + a.y + a.out.y };
      var c2 = { x: ox + b.x + b.in.x, y: oy + b.y + b.in.y };
      var p1 = { x: ox + b.x, y: oy + b.y };
      for (var t = 0; t < steps; t++) out.push(cubicPoint(t / steps, p0, c1, c2, p1));
    }
    if (!closed) out.push({ x: ox + pts[n - 1].x, y: oy + pts[n - 1].y });
    return out;
  }

  function pointInPolygon(px, py, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------- path subpaths ---------- */
  function subpathsOf(s) {
    if (s.subpaths && s.subpaths.length) return s.subpaths;
    return [{ points: s.points || [], closed: !!s.closed }];
  }

  function tracePath(ctx, s) {
    subpathsOf(s).forEach(function (sp) { tracePoints(ctx, sp.points, sp.closed, s.x, s.y); });
  }

  /* ---------- primitive outlines (absolute, unrotated) ---------- */
  function corners(s) {
    return [
      { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
      { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }
    ];
  }

  function polygonVertices(s) {
    var cx = s.x + s.w / 2, cy = s.y + s.h / 2, rx = s.w / 2, ry = s.h / 2;
    var n = Math.max(3, s.sides || 3);
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      out.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return out;
  }

  function starVertices(s) {
    var cx = s.x + s.w / 2, cy = s.y + s.h / 2, rx = s.w / 2, ry = s.h / 2;
    var n = Math.max(3, s.points || 5);
    var ratio = s.innerRatio == null ? 0.5 : s.innerRatio;
    var total = n * 2;
    var out = [];
    for (var i = 0; i < total; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / n;
      var r = i % 2 === 0 ? 1 : ratio;
      out.push({ x: cx + rx * r * Math.cos(a), y: cy + ry * r * Math.sin(a) });
    }
    return out;
  }

  function ellipseOutline(s, steps) {
    steps = steps || 32;
    var cx = s.x + s.w / 2, cy = s.y + s.h / 2, rx = Math.max(s.w / 2, 0.01), ry = Math.max(s.h / 2, 0.01);
    var out = [];
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      out.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return out;
  }

  function roundRectOutline(s) {
    var r = Math.min(s.radius || 0, Math.min(Math.abs(s.w), Math.abs(s.h)) / 2);
    if (r <= 0) return corners(s);
    var x = s.x, y = s.y, w = s.w, h = s.h, steps = 6, out = [];
    function arc(cx, cy, a0, a1) {
      for (var i = 0; i <= steps; i++) {
        var a = a0 + (a1 - a0) * (i / steps);
        out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
    }
    arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    arc(x + w - r, y + r, Math.PI * 1.5, Math.PI * 2);
    arc(x + w - r, y + h - r, 0, Math.PI * 0.5);
    arc(x + r, y + h - r, Math.PI * 0.5, Math.PI);
    return out;
  }

  function pathOutline(s, steps) {
    var out = [];
    subpathsOf(s).forEach(function (sp) {
      var pts = samplePoints(sp.points, sp.closed, steps, s.x, s.y);
      if (pts.length) out = out.concat(pts);
    });
    return out;
  }

  function shapeOutline(s, steps) {
    switch (s.type) {
      case 'rect': return corners(s);
      case 'roundrect': return roundRectOutline(s);
      case 'ellipse': return ellipseOutline(s, Math.max(24, steps || 32));
      case 'line': var p = linePoints(s); return [p.a, p.b];
      case 'polygon': return polygonVertices(s);
      case 'star': return starVertices(s);
      case 'path': return pathOutline(s, steps || 12);
      default: return corners(s);
    }
  }

  function worldCorners(s) {
    var c = center(s);
    return corners(s).map(function (p) { return U.rotatePoint(p.x, p.y, c.x, c.y, s.rotation); });
  }

  function aabb(s) {
    var pts = worldCorners(s);
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
  }

  function unionAabb(shapes) {
    if (!shapes.length) return { x: 0, y: 0, w: 0, h: 0 };
    var boxes = shapes.map(aabb);
    var x1 = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
    var y1 = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
    var x2 = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; }));
    var y2 = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function hitTest(s, wx, wy, tol) {
    tol = tol || 0;
    var c = center(s);
    var lp = U.rotatePoint(wx, wy, c.x, c.y, -s.rotation);
    var reach = s.strokeWidth / 2 + Math.max(tol, 3);
    var filled = s.fill && s.fill !== 'none';

    if (s.type === 'path') {
      var subs = subpathsOf(s);
      var anyFill = false;
      for (var k = 0; k < subs.length; k++) {
        var sp = subs[k];
        var pts = samplePoints(sp.points, sp.closed, 12, s.x, s.y);
        if (pts.length < 2) continue;
        for (var j = 0; j < pts.length - 1; j++) {
          if (U.pointSegmentDistance(lp.x, lp.y, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) <= reach) return true;
        }
        if (sp.closed && U.pointSegmentDistance(lp.x, lp.y, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y) <= reach) return true;
        if (filled && pointInPolygon(lp.x, lp.y, pts)) anyFill = true;
      }
      return filled && anyFill;
    }

    var poly = shapeOutline(s, 24);
    if (poly.length < 2) return false;
    for (var i = 0; i < poly.length - 1; i++) {
      if (U.pointSegmentDistance(lp.x, lp.y, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y) <= reach) return true;
    }
    if (filled && pointInPolygon(lp.x, lp.y, poly)) return true;
    return false;
  }

  var HANDLE_KEYS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function handlePositions(s, zoom) {
    var c = center(s);
    var hw = s.w / 2, hh = s.h / 2;
    var local = {
      nw: [-hw, -hh], n: [0, -hh], ne: [hw, -hh], e: [hw, 0],
      se: [hw, hh], s: [0, hh], sw: [-hw, hh], w: [-hw, 0]
    };
    var out = {};
    HANDLE_KEYS.forEach(function (k) {
      var l = local[k];
      out[k] = U.rotatePoint(c.x + l[0], c.y + l[1], c.x, c.y, s.rotation);
    });
    var gap = 26 / (zoom || 1);
    out.rot = U.rotatePoint(c.x, c.y - hh - gap, c.x, c.y, s.rotation);
    return out;
  }

  /* ---------- path editing helpers (subpath aware) ---------- */
  function subpathPoints(s, sub) {
    var subs = subpathsOf(s);
    return (subs[sub] && subs[sub].points) || null;
  }
  function subpathClosed(s, sub) {
    var subs = subpathsOf(s);
    return subs[sub] ? !!subs[sub].closed : false;
  }
  function anchorRefs(s) {
    var out = [];
    subpathsOf(s).forEach(function (sp, si) {
      (sp.points || []).forEach(function (p, i) { out.push({ sub: si, i: i }); });
    });
    return out;
  }
  function anchorWorld(s, sub, i) {
    var arr = subpathPoints(s, sub), c = center(s);
    var p = arr && arr[i];
    if (!p) return { x: s.x, y: s.y };
    return U.rotatePoint(s.x + p.x, s.y + p.y, c.x, c.y, s.rotation);
  }
  function handleWorld(s, sub, i, which) {
    var arr = subpathPoints(s, sub), c = center(s);
    var p = arr && arr[i];
    if (!p) return { x: s.x, y: s.y };
    var h = which === 'in' ? p.in : p.out;
    return U.rotatePoint(s.x + p.x + h.x, s.y + p.y + h.y, c.x, c.y, s.rotation);
  }
  function worldToLocal(s, wx, wy) {
    var c = center(s);
    var lp = U.rotatePoint(wx, wy, c.x, c.y, -s.rotation);
    return { x: lp.x - s.x, y: lp.y - s.y };
  }

  function normalizePath(s) {
    if (s.type !== 'path') return;
    var subs = subpathsOf(s);
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    subs.forEach(function (sp) {
      var samples = samplePoints(sp.points, sp.closed, 8);
      samples.forEach(function (p) {
        if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
      });
    });
    if (!isFinite(minx)) return;
    subs.forEach(function (sp) {
      (sp.points || []).forEach(function (p) { p.x -= minx; p.y -= miny; });
    });
    s.x += minx; s.y += miny;
    s.w = maxx - minx; s.h = maxy - miny;
  }

  global.Shapes = {
    create: create, center: center, linePoints: linePoints,
    corners: corners, worldCorners: worldCorners, aabb: aabb, unionAabb: unionAabb,
    hitTest: hitTest, handlePositions: handlePositions, HANDLE_KEYS: HANDLE_KEYS,
    cubicPoint: cubicPoint, tracePoints: tracePoints, samplePoints: samplePoints,
    pointInPolygon: pointInPolygon,
    subpathsOf: subpathsOf, tracePath: tracePath, pathOutline: pathOutline,
    polygonVertices: polygonVertices, starVertices: starVertices, shapeOutline: shapeOutline,
    anchorWorld: anchorWorld, handleWorld: handleWorld, worldToLocal: worldToLocal,
    subpathPoints: subpathPoints, subpathClosed: subpathClosed, anchorRefs: anchorRefs,
    normalizePath: normalizePath,
    DEFAULTS: DEFAULTS, NAMES: NAMES
  };
})(window);

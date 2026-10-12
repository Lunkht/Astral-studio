(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;

  var _measCtx = null;
  function measureCtx() {
    if (_measCtx) return _measCtx;
    try { _measCtx = document.createElement('canvas').getContext('2d'); }
    catch (e) { _measCtx = null; }
    return _measCtx;
  }

  var Tools = {
    MIN_SIZE: 2,

    /* Build a preview shape from a drag between two world points. */
    buildShape: function (type, start, cur, mods) {
      mods = mods || {};
      var x0 = start.x, y0 = start.y, x1 = cur.x, y1 = cur.y;

      if (type === 'line') {
        var shape = S.create('line');
        var minx = Math.min(x0, x1), miny = Math.min(y0, y1);
        var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
        shape.x = minx; shape.y = miny; shape.w = w; shape.h = h;
        shape.p1 = { x: w ? (x0 - minx) / w : 0, y: h ? (y0 - miny) / h : 0 };
        shape.p2 = { x: w ? (x1 - minx) / w : 0, y: h ? (y1 - miny) / h : 0 };
        if (mods.shift) {
          var ang = Math.atan2(y1 - y0, x1 - x0);
          ang = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
          var len = Math.hypot(x1 - x0, y1 - y0);
          x1 = x0 + Math.cos(ang) * len; y1 = y0 + Math.sin(ang) * len;
          minx = Math.min(x0, x1); miny = Math.min(y0, y1);
          w = Math.abs(x1 - x0); h = Math.abs(y1 - y0);
          shape.x = minx; shape.y = miny; shape.w = w; shape.h = h;
          shape.p1 = { x: w ? (x0 - minx) / w : 0, y: h ? (y0 - miny) / h : 0 };
          shape.p2 = { x: w ? (x1 - minx) / w : 0, y: h ? (y1 - miny) / h : 0 };
        }
        return shape;
      }

      var dx = x1 - x0, dy = y1 - y0;
      var shape2 = S.create(type);
      if (mods.shift) {
        var m = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m;
        x1 = x0 + dx; y1 = y0 + dy;
      }
      if (mods.alt) {
        shape2.x = x0 - Math.abs(dx); shape2.y = y0 - Math.abs(dy);
        shape2.w = Math.abs(dx) * 2; shape2.h = Math.abs(dy) * 2;
      } else {
        shape2.x = Math.min(x0, x1); shape2.y = Math.min(y0, y1);
        shape2.w = Math.abs(dx); shape2.h = Math.abs(dy);
      }
      return shape2;
    },

    isMeaningful: function (shape) {
      if (!shape) return false;
      if (shape.type === 'line') return shape.w > Tools.MIN_SIZE || shape.h > Tools.MIN_SIZE;
      return shape.w > Tools.MIN_SIZE && shape.h > Tools.MIN_SIZE;
    },

    /* Build a path shape from absolute pen/pencil points; converts to local coords. */
    buildPathShape: function (points, closed) {
      var samples = S.samplePoints(points, closed, 20);
      var b = boundsOfPointArrays([samples]);
      var shape = S.create('path');
      shape.x = b.x; shape.y = b.y; shape.w = b.w; shape.h = b.h;
      shape.closed = !!closed;
      shape.points = points.map(function (p) {
        return {
          x: p.x - b.x, y: p.y - b.y,
          in: { x: p.in.x, y: p.in.y }, out: { x: p.out.x, y: p.out.y }
        };
      });
      return shape;
    },

    /* Freehand pencil: simplify + smooth into bezier handles. */
    pencilToPath: function (rawPoints, tol) {
      var pts = simplify(rawPoints, tol == null ? 2.5 : tol);
      if (pts.length < 2) return null;
      var smooth = smoothHandles(pts);
      return Tools.buildPathShape(smooth, false);
    },

    measureText: function (shape) {
      var fontSize = shape.fontSize || 48;
      var lines = String(shape.text == null ? '' : shape.text).split('\n');
      var lineHeight = fontSize * 1.2;
      var width = 0;
      var ctx = measureCtx();
      if (ctx) {
        try {
          ctx.font = (shape.fontWeight || 400) + ' ' + fontSize + 'px ' + (shape.fontFamily || 'sans-serif');
          lines.forEach(function (l) { width = Math.max(width, ctx.measureText(l).width); });
        } catch (e) { width = 0; }
      }
      if (!width) {
        var maxLen = 0;
        lines.forEach(function (l) { maxLen = Math.max(maxLen, l.length); });
        width = Math.max(1, maxLen * fontSize * 0.58);
      }
      return { w: Math.max(width, 1), h: Math.max(lines.length * lineHeight, 1), lineHeight: lineHeight };
    },

    syncTextBounds: function (shape) {
      var m = Tools.measureText(shape);
      shape.w = m.w; shape.h = m.h; shape.lineHeight = m.lineHeight;
      return shape;
    },

    /* Convert any shape outline (with rotation applied) into absolute anchor points. */
    shapeToAnchorPoints: function (s) {
      var outline = S.shapeOutline(s, 20);
      var c = S.center(s);
      return outline.map(function (p) {
        var rp = U.rotatePoint(p.x, p.y, c.x, c.y, s.rotation);
        return { x: rp.x, y: rp.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } };
      });
    },

    /* Apply a resize handle drag to a single shape (rotation aware). */
    resizeShape: function (original, handle, worldPoint, mods) {
      mods = mods || {};
      var a = original.rotation;
      var c0 = S.center(original);
      var lp = U.rotatePoint(worldPoint.x, worldPoint.y, c0.x, c0.y, -a);
      var lx = lp.x - c0.x, ly = lp.y - c0.y;

      var left = -original.w / 2, right = original.w / 2;
      var top = -original.h / 2, bottom = original.h / 2;

      if (handle.indexOf('w') >= 0) left = lx;
      if (handle.indexOf('e') >= 0) right = lx;
      if (handle.indexOf('n') >= 0) top = ly;
      if (handle.indexOf('s') >= 0) bottom = ly;

      if (mods.shift && handle.length === 2) {
        var target = Math.max(Math.abs(right - left), Math.abs(bottom - top));
        if (handle.indexOf('w') >= 0) left = right - (right - left < 0 ? -target : target);
        else if (handle.indexOf('e') >= 0) right = left + (right - left < 0 ? -target : target);
        if (handle.indexOf('n') >= 0) top = bottom - (bottom - top < 0 ? -target : target);
        else if (handle.indexOf('s') >= 0) bottom = top + (bottom - top < 0 ? -target : target);
      }

      if (right < left) { var t = left; left = right; right = t; }
      if (bottom < top) { var t2 = top; top = bottom; bottom = t2; }

      var newW = right - left, newH = bottom - top;
      var midLocal = { x: (left + right) / 2, y: (top + bottom) / 2 };
      var newCenter = U.rotatePoint(c0.x + midLocal.x, c0.y + midLocal.y, c0.x, c0.y, a);

      if (original.type === 'path') {
        var sx = original.w ? newW / original.w : 1;
        var sy = original.h ? newH / original.h : 1;
        S.subpathsOf(original).forEach(function (sp) {
          (sp.points || []).forEach(function (p) {
            p.x *= sx; p.y *= sy; p.in.x *= sx; p.in.y *= sy; p.out.x *= sx; p.out.y *= sy;
          });
        });
      } else if (original.type === 'text') {
        // scale font with height
        if (original.h) original.fontSize = Math.max(4, (original.fontSize || 48) * (newH / original.h));
      }

      original.w = newW; original.h = newH;
      original.x = newCenter.x - newW / 2;
      original.y = newCenter.y - newH / 2;
    }
  };

  /* ---------- helpers ---------- */
  function boundsOfPointArrays(arrs) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    arrs.forEach(function (arr) {
      arr.forEach(function (p) {
        if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
      });
    });
    if (!isFinite(minx)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }

  function simplify(points, tol) {
    var out = [];
    var last = null;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!last || U.dist(last.x, last.y, p.x, p.y) >= tol) { out.push(p); last = p; }
    }
    if (out.length < 2 && points.length >= 2) out = [points[0], points[points.length - 1]];
    return out;
  }

  function smoothHandles(pts) {
    var n = pts.length;
    return pts.map(function (p, i) {
      var prev = pts[i - 1] || pts[i];
      var next = pts[i + 1] || pts[i];
      var dx = (next.x - prev.x) / 6, dy = (next.y - prev.y) / 6;
      return { x: p.x, y: p.y, in: { x: -dx, y: -dy }, out: { x: dx, y: dy } };
    });
  }

  global.Tools = Tools;
})(window);

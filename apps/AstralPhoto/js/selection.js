(function (global) {
  'use strict';

  var U = global.Utils;

  function none() {
    return { active: false, shape: 'rect', x: 0, y: 0, w: 0, h: 0, points: [] };
  }

  function rect(x, y, w, h) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return { active: w > 0 && h > 0, shape: 'rect', x: x, y: y, w: w, h: h, points: [] };
  }

  function ellipse(x, y, w, h) {
    return Object.assign(rect(x, y, w, h), { shape: 'ellipse' });
  }

  function lasso(points) {
    var b = pointsBounds(points);
    return { active: points.length >= 3 && b.w > 0 && b.h > 0, shape: 'lasso', x: b.x, y: b.y, w: b.w, h: b.h, points: points };
  }

  function pointsBounds(points) {
    if (!points || !points.length) return { x: 0, y: 0, w: 0, h: 0 };
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i].x < minX) minX = points[i].x;
      if (points[i].y < minY) minY = points[i].y;
      if (points[i].x > maxX) maxX = points[i].x;
      if (points[i].y > maxY) maxY = points[i].y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function bounds(sel) {
    if (!sel || !sel.active) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
  }

  function isEmpty(sel) {
    return !sel || !sel.active || sel.w <= 0 || sel.h <= 0;
  }

  function contains(sel, x, y) {
    if (isEmpty(sel)) return true;
    if (x < sel.x || y < sel.y || x > sel.x + sel.w || y > sel.y + sel.h) return false;
    if (sel.shape === 'ellipse') {
      var cx = sel.x + sel.w / 2, cy = sel.y + sel.h / 2;
      var nx = (x - cx) / (sel.w / 2), ny = (y - cy) / (sel.h / 2);
      return nx * nx + ny * ny <= 1;
    }
    if (sel.shape === 'lasso') return U.pointInPolygon(x, y, sel.points);
    return true;
  }

  function tracePath(ctx, sel) {
    if (sel.shape === 'ellipse') {
      ctx.ellipse(sel.x + sel.w / 2, sel.y + sel.h / 2, sel.w / 2, sel.h / 2, 0, 0, Math.PI * 2);
    } else if (sel.shape === 'lasso' && sel.points.length) {
      ctx.moveTo(sel.points[0].x, sel.points[0].y);
      for (var i = 1; i < sel.points.length; i++) ctx.lineTo(sel.points[i].x, sel.points[i].y);
      ctx.closePath();
    } else {
      ctx.rect(sel.x, sel.y, sel.w, sel.h);
    }
  }

  /* Applies the selection as a clip on ctx. Returns true when a clip was set. */
  function clip(ctx, sel) {
    if (isEmpty(sel)) return false;
    ctx.beginPath();
    tracePath(ctx, sel);
    ctx.clip();
    return true;
  }

  function maskFn(sel) {
    if (isEmpty(sel)) return null;
    return function (x, y) { return contains(sel, x, y); };
  }

  global.Selection = {
    none: none,
    rect: rect,
    ellipse: ellipse,
    lasso: lasso,
    pointsBounds: pointsBounds,
    bounds: bounds,
    isEmpty: isEmpty,
    contains: contains,
    tracePath: tracePath,
    clip: clip,
    maskFn: maskFn
  };
})(typeof window !== 'undefined' ? window : this);

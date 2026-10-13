(function (global) {
  'use strict';

  var U = global.Utils;

  function create(type, props) {
    var s = {
      id: U.uid('s'),
      type: type || 'rect',
      name: type || 'rect',
      x: 0, y: 0, w: 0, h: 0,
      rotation: 0, scale: 1, opacity: 1,
      fill: '#c9d7f0', stroke: '#2b3a55', strokeWidth: 2,
      visible: true, locked: false,
      points: null, closed: false,
      text: '', fontSize: 48, fontFamily: 'Inter, Arial, sans-serif'
    };
    if (props) {
      for (var k in props) {
        if (Object.prototype.hasOwnProperty.call(props, k)) s[k] = props[k];
      }
    }
    return s;
  }

  function isPath(s) {
    return !!(s.points && s.points.length);
  }

  function bounds(s) {
    if (isPath(s)) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < s.points.length; i++) {
        var p = s.points[i];
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return { x: s.x, y: s.y, w: s.w, h: s.h };
  }

  function hitTest(s, x, y, tol) {
    tol = tol || 0;
    if (isPath(s)) {
      var pad = s.strokeWidth / 2 + tol + 2;
      for (var i = 0; i < s.points.length - 1; i++) {
        if (U.pointSegmentDistance(x, y, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y) <= pad) return true;
      }
      if (s.closed && s.points.length > 2) {
        var a = s.points[s.points.length - 1], b = s.points[0];
        if (U.pointSegmentDistance(x, y, a.x, a.y, b.x, b.y) <= pad) return true;
      }
      return false;
    }
    if (s.type === 'ellipse') {
      var cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      var rx = Math.abs(s.w) / 2 + tol, ry = Math.abs(s.h) / 2 + tol;
      if (rx < U.EPS || ry < U.EPS) return false;
      var nx = (x - cx) / rx, ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }
    var b = bounds(s);
    return U.pointInRect(x, y, b.x - tol, b.y - tol, b.w + 2 * tol, b.h + 2 * tol);
  }

  function tracePath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (var i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    if (s.closed) ctx.closePath();
  }

  function draw(ctx, s, opts) {
    if (s.visible === false) return;
    opts = opts || {};
    ctx.save();
    ctx.globalAlpha = (s.opacity == null ? 1 : s.opacity) * (opts.alpha == null ? 1 : opts.alpha);

    if (s.type === 'text') {
      if (s.text) {
        ctx.fillStyle = s.fill && s.fill !== 'none' ? s.fill : '#000000';
        ctx.font = (s.fontWeight ? s.fontWeight + ' ' : '') + s.fontSize + 'px ' + s.fontFamily;
        ctx.textBaseline = 'top';
        ctx.fillText(s.text, s.x, s.y);
      }
      ctx.restore();
      return;
    }

    if (isPath(s)) {
      if (s.points.length < 2) { ctx.restore(); return; }
      tracePath(ctx, s);
      if (s.closed && s.fill !== 'none') { ctx.fillStyle = s.fill; ctx.fill(); }
      if (s.strokeWidth > 0 && s.stroke !== 'none') {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.beginPath();
    if (s.type === 'rect') {
      ctx.rect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'roundrect') {
      U.roundRectPath(ctx, s.x, s.y, s.w, s.h, s.radius == null ? 12 : s.radius);
    } else if (s.type === 'ellipse') {
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w) / 2, Math.abs(s.h) / 2, 0, 0, Math.PI * 2);
    } else if (s.type === 'line') {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
    }
    if (s.fill && s.fill !== 'none' && s.type !== 'line') { ctx.fillStyle = s.fill; ctx.fill(); }
    if (s.strokeWidth > 0 && s.stroke && s.stroke !== 'none') {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  function interpolate(a, b, t) {
    var out = U.deepClone(a);
    out.x = U.lerp(a.x, b.x, t);
    out.y = U.lerp(a.y, b.y, t);
    out.w = U.lerp(a.w, b.w, t);
    out.h = U.lerp(a.h, b.h, t);
    out.rotation = U.lerp(a.rotation || 0, b.rotation || 0, t);
    out.scale = U.lerp(a.scale == null ? 1 : a.scale, b.scale == null ? 1 : b.scale, t);
    out.opacity = U.lerp(a.opacity == null ? 1 : a.opacity, b.opacity == null ? 1 : b.opacity, t);
    if (isPath(a) && isPath(b)) {
      var n = Math.min(a.points.length, b.points.length);
      out.points = [];
      for (var i = 0; i < n; i++) {
        out.points.push({ x: U.lerp(a.points[i].x, b.points[i].x, t), y: U.lerp(a.points[i].y, b.points[i].y, t) });
      }
    }
    return out;
  }

  function interpolateAll(a, b, t) {
    var n = Math.min(a.length, b.length);
    var out = [];
    for (var i = 0; i < n; i++) out.push(interpolate(a[i], b[i], t));
    return out;
  }

  global.Shapes = {
    create: create,
    isPath: isPath,
    bounds: bounds,
    hitTest: hitTest,
    draw: draw,
    interpolate: interpolate,
    interpolateAll: interpolateAll
  };
})(window);

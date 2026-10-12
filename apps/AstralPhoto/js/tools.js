(function (global) {
  'use strict';

  var U = global.Utils;
  var Pixels = global.Pixels;
  var Selection = global.Selection;

  function stamp(ctx, x, y, o) {
    var r = o.size / 2;
    if (r <= 0) return;
    var hard = o.hardness == null ? 1 : o.hardness;
    ctx.save();
    if (o.erase) ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = o.opacity == null ? 1 : o.opacity;
    var rgb = U.parseColor(o.color) || { r: 0, g: 0, b: 0 };
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (hard >= 0.99 || o.erase) {
      ctx.fillStyle = U.rgbaStr(rgb, 1);
    } else {
      var inner = Math.max(0, r * hard);
      var g = ctx.createRadialGradient(x, y, inner, x, y, r);
      g.addColorStop(0, U.rgbaStr(rgb, 1));
      g.addColorStop(1, U.rgbaStr(rgb, 0));
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.restore();
  }

  function line(ctx, x0, y0, x1, y1, o) {
    var dist = Math.hypot(x1 - x0, y1 - y0);
    var spacing = Math.max(1, o.size * 0.18);
    var steps = Math.max(1, Math.ceil(dist / spacing));
    if (dist === 0) { stamp(ctx, x1, y1, o); return; }
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      stamp(ctx, U.lerp(x0, x1, t), U.lerp(y0, y1, t), o);
    }
  }

  function paintBucket(layerCanvas, x, y, colorHex, tolerance, sel) {
    var ctx = layerCanvas.getContext('2d');
    var img = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
    var rgb = U.parseColor(colorHex) || { r: 0, g: 0, b: 0 };
    var col = { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 };
    var changed = Pixels.floodFill(img, x, y, col, tolerance, Selection.maskFn(sel));
    if (changed) ctx.putImageData(img, 0, 0);
    return changed;
  }

  function pickColor(compositeCanvas, x, y) {
    if (!compositeCanvas) return null;
    var ctx = compositeCanvas.getContext('2d');
    x = Math.max(0, Math.min(compositeCanvas.width - 1, Math.floor(x)));
    y = Math.max(0, Math.min(compositeCanvas.height - 1, Math.floor(y)));
    var d = ctx.getImageData(x, y, 1, 1).data;
    return U.rgbToHex(d[0], d[1], d[2]);
  }

  function fill(ctx, colorHex, sel, w, h, alpha) {
    var rgb = U.parseColor(colorHex) || { r: 0, g: 0, b: 0 };
    ctx.save();
    if (Selection.clip(ctx, sel)) {
      var b = Selection.bounds(sel);
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = U.rgbaStr(rgb, 1);
      ctx.fillRect(b.x, b.y, b.w, b.h);
    } else {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = U.rgbaStr(rgb, 1);
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function gradient(ctx, p0, p1, c0, c1, sel, w, h) {
    var a = U.parseColor(c0) || { r: 0, g: 0, b: 0 };
    var b = U.parseColor(c1) || { r: 255, g: 255, b: 255 };
    var g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    g.addColorStop(0, U.rgbaStr(a, 1));
    g.addColorStop(1, U.rgbaStr(b, 1));
    ctx.save();
    if (Selection.clip(ctx, sel)) {
      var bb = Selection.bounds(sel);
      ctx.fillStyle = g;
      ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    } else {
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function shape(ctx, kind, r, colorHex, radius) {
    var rgb = U.parseColor(colorHex) || { r: 0, g: 0, b: 0 };
    ctx.save();
    ctx.fillStyle = U.rgbaStr(rgb, 1);
    ctx.beginPath();
    if (kind === 'ellipse') {
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.abs(r.w) / 2, Math.abs(r.h) / 2, 0, 0, Math.PI * 2);
    } else if (kind === 'roundrect' && radius > 0) {
      roundedRect(ctx, r, radius);
    } else {
      ctx.rect(r.x, r.y, r.w, r.h);
    }
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(ctx, r, radius) {
    var x = r.x, y = r.y, w = r.w, h = r.h;
    var rad = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function drawText(ctx, text, x, y, opts) {
    opts = opts || {};
    var size = opts.size || 48;
    var bold = opts.bold ? 'bold ' : '';
    var italic = opts.italic ? 'italic ' : '';
    ctx.save();
    ctx.font = italic + bold + size + 'px ' + (opts.family || 'sans-serif');
    ctx.textBaseline = 'top';
    ctx.fillStyle = opts.color || '#000000';
    var lines = String(text).split('\n');
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * size * 1.2);
    ctx.restore();
  }

  function applyFilterToLayer(layer, fn) {
    var ctx = layer.canvas.getContext('2d');
    var img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    var out = fn(img);
    if (out) ctx.putImageData(new ImageCtor(ctx, out), 0, 0);
    return out;
  }

  function ImageCtor(ctx, img) {
    try {
      if (global.ImageData) return new global.ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
      var d = ctx.createImageData(img.width, img.height);
      d.data.set(img.data);
      return d;
    } catch (e) {
      return img;
    }
  }

  global.Tools = {
    stamp: stamp,
    line: line,
    paintBucket: paintBucket,
    pickColor: pickColor,
    fill: fill,
    gradient: gradient,
    shape: shape,
    roundedRect: roundedRect,
    drawText: drawText,
    applyFilterToLayer: applyFilterToLayer
  };
})(typeof window !== 'undefined' ? window : this);

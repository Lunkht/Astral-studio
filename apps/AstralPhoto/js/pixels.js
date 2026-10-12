(function (global) {
  'use strict';

  var U = global.Utils;

  function create(w, h, fill) {
    var data = new Uint8ClampedArray(w * h * 4);
    if (fill) {
      for (var i = 0; i < data.length; i += 4) {
        data[i] = fill.r; data[i + 1] = fill.g; data[i + 2] = fill.b; data[i + 3] = fill.a == null ? 255 : fill.a;
      }
    }
    return { width: w, height: h, data: data };
  }

  function get(img, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return { r: 0, g: 0, b: 0, a: 0 };
    var i = (y * img.width + x) * 4;
    return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
  }

  function set(img, x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    var i = (y * img.width + x) * 4;
    img.data[i] = c.r; img.data[i + 1] = c.g; img.data[i + 2] = c.b; img.data[i + 3] = c.a == null ? 255 : c.a;
  }

  function blendPixel(img, x, y, c, alpha) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    var a = (alpha == null ? 1 : alpha) * ((c.a == null ? 255 : c.a) / 255);
    if (a <= 0) return;
    var i = (y * img.width + x) * 4;
    img.data[i] = c.r * a + img.data[i] * (1 - a);
    img.data[i + 1] = c.g * a + img.data[i + 1] * (1 - a);
    img.data[i + 2] = c.b * a + img.data[i + 2] * (1 - a);
    img.data[i + 3] = 255 * a + img.data[i + 3] * (1 - a);
  }

  function colorDistance(a, b) {
    var dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b, da = (a.a || 0) - (b.a || 0);
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
  }

  /* Flood fill. mask(x,y) -> bool (optional). tolerance 0..255*2. Returns pixels changed. */
  function floodFill(img, startX, startY, color, tolerance, mask) {
    startX |= 0; startY |= 0;
    if (startX < 0 || startY < 0 || startX >= img.width || startY >= img.height) return 0;
    var target = get(img, startX, startY);
    var tol = tolerance == null ? 0 : tolerance;
    var visit = new Uint8Array(img.width * img.height);
    var stack = [startX, startY];
    var changed = 0;
    while (stack.length) {
      var y = stack.pop();
      var x = stack.pop();
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      var vi = y * img.width + x;
      if (visit[vi]) continue;
      visit[vi] = 1;
      if (mask && !mask(x, y)) continue;
      var cur = get(img, x, y);
      if (colorDistance(cur, target) > tol) continue;
      blendPixel(img, x, y, color, 1);
      changed++;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    return changed;
  }

  function fillRect(img, x, y, w, h, color, alpha) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var x0 = Math.max(0, x), y0 = Math.max(0, y);
    var x1 = Math.min(img.width, x + w), y1 = Math.min(img.height, y + h);
    for (var yy = y0; yy < y1; yy++) {
      for (var xx = x0; xx < x1; xx++) blendPixel(img, xx, yy, color, alpha);
    }
  }

  global.Pixels = {
    create: create,
    get: get,
    set: set,
    blendPixel: blendPixel,
    colorDistance: colorDistance,
    floodFill: floodFill,
    fillRect: fillRect
  };
})(typeof window !== 'undefined' ? window : this);

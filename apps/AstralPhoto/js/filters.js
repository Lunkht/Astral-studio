(function (global) {
  'use strict';

  var U = global.Utils;

  function clone(img) {
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  }

  function each(img, fn) {
    var d = img.data, len = d.length;
    for (var i = 0; i < len; i += 4) fn(d, i);
  }

  function brightnessContrast(img, opts) {
    opts = opts || {};
    var b = (opts.brightness || 0) * 2.55;
    var c = (opts.contrast || 0) / 100;
    var f = (1 + c) / (1 - c);
    var out = clone(img);
    each(out, function (d, i) {
      d[i] = f * (d[i] - 128) + 128 + b;
      d[i + 1] = f * (d[i + 1] - 128) + 128 + b;
      d[i + 2] = f * (d[i + 2] - 128) + 128 + b;
    });
    return out;
  }

  function hueSaturation(img, opts) {
    opts = opts || {};
    var hue = (opts.hue || 0) / 360;
    var sat = (opts.saturation || 0) / 100;
    var light = (opts.lightness || 0) / 100;
    var out = clone(img);
    each(out, function (d, i) {
      var hsl = U.rgbToHsl(d[i], d[i + 1], d[i + 2]);
      hsl.h = (hsl.h + hue + 1) % 1;
      hsl.s = U.clamp(hsl.s + sat * (sat > 0 ? (1 - hsl.s) : hsl.s), 0, 1);
      hsl.l = U.clamp(hsl.l + light * (light > 0 ? (1 - hsl.l) : hsl.l), 0, 1);
      var rgb = U.hslToRgb(hsl.h, hsl.s, hsl.l);
      d[i] = rgb.r; d[i + 1] = rgb.g; d[i + 2] = rgb.b;
    });
    return out;
  }

  function grayscale(img) {
    var out = clone(img);
    each(out, function (d, i) {
      var g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    });
    return out;
  }

  function invert(img) {
    var out = clone(img);
    each(out, function (d, i) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; });
    return out;
  }

  function sepia(img) {
    var out = clone(img);
    each(out, function (d, i) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = r * 0.393 + g * 0.769 + b * 0.189;
      d[i + 1] = r * 0.349 + g * 0.686 + b * 0.168;
      d[i + 2] = r * 0.272 + g * 0.534 + b * 0.131;
    });
    return out;
  }

  function threshold(img, level) {
    var t = level == null ? 128 : level;
    var out = clone(img);
    each(out, function (d, i) {
      var g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      var v = g >= t ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    });
    return out;
  }

  function posterize(img, levels) {
    var n = Math.max(2, levels || 4);
    var step = 255 / (n - 1);
    var out = clone(img);
    each(out, function (d, i) {
      d[i] = Math.round(Math.round(d[i] / step) * step);
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    });
    return out;
  }

  function boxPass(src, dst, w, h, radius, horizontal) {
    var span = radius * 2 + 1;
    var line = horizontal ? w : h;
    var other = horizontal ? h : w;
    for (var o = 0; o < other; o++) {
      var acc = [0, 0, 0, 0];
      for (var k = -radius; k <= radius; k++) {
        var i = horizontal ? (o * w + U.clamp(k, 0, w - 1)) * 4 : (U.clamp(k, 0, h - 1) * w + o) * 4;
        acc[0] += src.data[i]; acc[1] += src.data[i + 1]; acc[2] += src.data[i + 2]; acc[3] += src.data[i + 3];
      }
      for (var p = 0; p < line; p++) {
        var di = horizontal ? (o * w + p) * 4 : (p * w + o) * 4;
        dst.data[di] = acc[0] / span; dst.data[di + 1] = acc[1] / span;
        dst.data[di + 2] = acc[2] / span; dst.data[di + 3] = acc[3] / span;
        var xOut = horizontal ? p - radius : o;
        var yOut = horizontal ? o : p - radius;
        var xIn = horizontal ? p + radius + 1 : o;
        var yIn = horizontal ? o : p + radius + 1;
        var oi = (U.clamp(yOut, 0, h - 1) * w + U.clamp(xOut, 0, w - 1)) * 4;
        var ii = (U.clamp(yIn, 0, h - 1) * w + U.clamp(xIn, 0, w - 1)) * 4;
        acc[0] += src.data[ii] - src.data[oi];
        acc[1] += src.data[ii + 1] - src.data[oi + 1];
        acc[2] += src.data[ii + 2] - src.data[oi + 2];
        acc[3] += src.data[ii + 3] - src.data[oi + 3];
      }
    }
  }

  function boxBlur(img, radius) {
    radius = Math.max(0, Math.round(radius || 0));
    if (radius < 1) return clone(img);
    var tmp = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.length) };
    var out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.length) };
    boxPass(img, tmp, img.width, img.height, radius, true);
    boxPass(tmp, out, img.width, img.height, radius, false);
    return out;
  }

  function gaussianBlur(img, radius) {
    var r = Math.max(0, Math.round(radius || 0));
    if (r < 1) return clone(img);
    var out = img;
    var passes = 3;
    var step = Math.max(1, Math.round(r / passes));
    for (var i = 0; i < passes; i++) out = boxBlur(out, step);
    return out;
  }

  function convolve(img, kernel, divisor, offset) {
    var w = img.width, h = img.height, src = img.data;
    var out = clone(img), dst = out.data;
    var k = Math.sqrt(kernel.length);
    var half = Math.floor(k / 2);
    divisor = divisor || 1;
    offset = offset || 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var r = 0, g = 0, b = 0;
        for (var ky = 0; ky < k; ky++) {
          for (var kx = 0; kx < k; kx++) {
            var sy = U.clamp(y + ky - half, 0, h - 1);
            var sx = U.clamp(x + kx - half, 0, w - 1);
            var si = (sy * w + sx) * 4;
            var kv = kernel[ky * k + kx];
            r += src[si] * kv; g += src[si + 1] * kv; b += src[si + 2] * kv;
          }
        }
        var di = (y * w + x) * 4;
        dst[di] = r / divisor + offset;
        dst[di + 1] = g / divisor + offset;
        dst[di + 2] = b / divisor + offset;
      }
    }
    return out;
  }

  function sharpen(img, amount) {
    var a = amount == null ? 1 : amount;
    var kernel = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
    return convolve(img, kernel, 1, 0);
  }

  function edgeDetect(img) {
    return convolve(img, [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1, 0);
  }

  function emboss(img) {
    return convolve(img, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128);
  }

  global.Filters = {
    clone: clone,
    brightnessContrast: brightnessContrast,
    hueSaturation: hueSaturation,
    grayscale: grayscale,
    invert: invert,
    sepia: sepia,
    threshold: threshold,
    posterize: posterize,
    boxBlur: boxBlur,
    gaussianBlur: gaussianBlur,
    convolve: convolve,
    sharpen: sharpen,
    edgeDetect: edgeDetect,
    emboss: emboss
  };
})(typeof window !== 'undefined' ? window : this);

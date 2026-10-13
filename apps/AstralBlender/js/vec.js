(function (global) {
  'use strict';

  function v(x, y, z) {
    return { x: x || 0, y: y || 0, z: z || 0 };
  }

  function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
  function scale(a, s) { return v(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function length(a) { return Math.hypot(a.x, a.y, a.z); }

  function normalize(a) {
    var l = length(a) || 1;
    return scale(a, 1 / l);
  }

  function lerp(a, b, t) {
    return v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  }

  function dotXY(a, b) { return a.x * b.x + a.y * b.y; }

  global.Vec3 = {
    v: v,
    add: add,
    sub: sub,
    scale: scale,
    dot: dot,
    cross: cross,
    length: length,
    normalize: normalize,
    lerp: lerp,
    dotXY: dotXY
  };
})(window);

(function (global) {
  'use strict';

  var V = global.Vec3;

  function identity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function multiply(a, b) {
    var out = new Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
        out[i * 4 + j] = s;
      }
    }
    return out;
  }

  function transformPoint(m, p) {
    return {
      x: m[0] * p.x + m[1] * p.y + m[2] * p.z + m[3],
      y: m[4] * p.x + m[5] * p.y + m[6] * p.z + m[7],
      z: m[8] * p.x + m[9] * p.y + m[10] * p.z + m[11],
      w: m[12] * p.x + m[13] * p.y + m[14] * p.z + m[15]
    };
  }

  function transformDir(m, p) {
    return {
      x: m[0] * p.x + m[1] * p.y + m[2] * p.z,
      y: m[4] * p.x + m[5] * p.y + m[6] * p.z,
      z: m[8] * p.x + m[9] * p.y + m[10] * p.z
    };
  }

  function translation(t) {
    return [1, 0, 0, t.x, 0, 1, 0, t.y, 0, 0, 1, t.z, 0, 0, 0, 1];
  }

  function scaling(s) {
    return [s.x, 0, 0, 0, 0, s.y, 0, 0, 0, 0, s.z, 0, 0, 0, 0, 1];
  }

  function rotationX(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  }

  function rotationY(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  }

  function rotationZ(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, 2 * far * near * nf,
      0, 0, -1, 0
    ];
  }

  function lookAt(eye, center, up) {
    var z = V.normalize(V.sub(eye, center));
    var x = V.normalize(V.cross(up, z));
    var y = V.cross(z, x);
    return [
      x.x, x.y, x.z, -V.dot(x, eye),
      y.x, y.y, y.z, -V.dot(y, eye),
      z.x, z.y, z.z, -V.dot(z, eye),
      0, 0, 0, 1
    ];
  }

  function compose(position, rotation, scale) {
    var r = multiply(multiply(rotationZ(rotation.z), rotationY(rotation.y)), rotationX(rotation.x));
    return multiply(multiply(translation(position), r), scaling(scale));
  }

  global.Mat4 = {
    identity: identity,
    multiply: multiply,
    transformPoint: transformPoint,
    transformDir: transformDir,
    translation: translation,
    scaling: scaling,
    rotationX: rotationX,
    rotationY: rotationY,
    rotationZ: rotationZ,
    perspective: perspective,
    lookAt: lookAt,
    compose: compose
  };
})(window);

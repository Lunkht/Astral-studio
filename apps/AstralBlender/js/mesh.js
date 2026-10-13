(function (global) {
  'use strict';

  var V = global.Vec3;

  function make(name, vertices, faces) {
    return { name: name, vertices: vertices, faces: faces, edges: edgesFromFaces(faces) };
  }

  function edgesFromFaces(faces) {
    var seen = {};
    var edges = [];
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      for (var i = 0; i < face.length; i++) {
        var a = face[i];
        var b = face[(i + 1) % face.length];
        var key = a < b ? a + ':' + b : b + ':' + a;
        if (!seen[key]) { seen[key] = true; edges.push([a, b]); }
      }
    }
    return edges;
  }

  function cube(size) {
    var h = (size || 2) / 2;
    var vertices = [
      V.v(-h, -h, -h), V.v(h, -h, -h), V.v(h, h, -h), V.v(-h, h, -h),
      V.v(-h, -h, h), V.v(h, -h, h), V.v(h, h, h), V.v(-h, h, h)
    ];
    var faces = [
      [4, 5, 6, 7], [1, 0, 3, 2], [0, 4, 7, 3],
      [5, 1, 2, 6], [7, 6, 2, 3], [0, 1, 5, 4]
    ];
    return make('Cube', vertices, faces);
  }

  function plane(size) {
    var h = (size || 2) / 2;
    var vertices = [V.v(-h, 0, -h), V.v(h, 0, -h), V.v(h, 0, h), V.v(-h, 0, h)];
    return make('Plan', vertices, [[0, 1, 2, 3]]);
  }

  function sphere(radius, segU, segV) {
    var r = radius || 1;
    segU = Math.max(3, segU || 16);
    segV = Math.max(2, segV || 8);
    var vertices = [V.v(0, r, 0)];
    var rings = [];
    for (var v = 1; v < segV; v++) {
      var theta = Math.PI * v / segV;
      var y = r * Math.cos(theta);
      var rr = r * Math.sin(theta);
      var row = [];
      for (var u = 0; u < segU; u++) {
        var phi = 2 * Math.PI * u / segU;
        row.push(vertices.push(V.v(rr * Math.cos(phi), y, rr * Math.sin(phi))) - 1);
      }
      rings.push(row);
    }
    var south = vertices.push(V.v(0, -r, 0)) - 1;
    var faces = [];
    for (var t = 0; t < segU; t++) faces.push([0, rings[0][t], rings[0][(t + 1) % segU]]);
    for (var rI = 0; rI < rings.length - 1; rI++) {
      for (var uI = 0; uI < segU; uI++) {
        faces.push([
          rings[rI][uI], rings[rI][(uI + 1) % segU],
          rings[rI + 1][(uI + 1) % segU], rings[rI + 1][uI]
        ]);
      }
    }
    var last = rings[rings.length - 1];
    for (var b = 0; b < segU; b++) faces.push([south, last[(b + 1) % segU], last[b]]);
    return make('Sphere', vertices, faces);
  }

  function cylinder(radius, height, seg) {
    var r = radius || 1, h = (height || 2) / 2;
    seg = Math.max(3, seg || 16);
    var vertices = [];
    var top = [], bottom = [];
    for (var i = 0; i < seg; i++) {
      var a = 2 * Math.PI * i / seg;
      top.push(vertices.push(V.v(r * Math.cos(a), h, r * Math.sin(a))) - 1);
      bottom.push(vertices.push(V.v(r * Math.cos(a), -h, r * Math.sin(a))) - 1);
    }
    var topC = vertices.push(V.v(0, h, 0)) - 1;
    var botC = vertices.push(V.v(0, -h, 0)) - 1;
    var faces = [];
    for (var j = 0; j < seg; j++) {
      var n = (j + 1) % seg;
      faces.push([top[j], bottom[j], bottom[n], top[n]]);
      faces.push([topC, top[n], top[j]]);
      faces.push([botC, bottom[j], bottom[n]]);
    }
    return make('Cylindre', vertices, faces);
  }

  function cone(radius, height, seg) {
    var r = radius || 1, h = (height || 2) / 2;
    seg = Math.max(3, seg || 16);
    var vertices = [];
    var base = [];
    for (var i = 0; i < seg; i++) {
      var a = 2 * Math.PI * i / seg;
      base.push(vertices.push(V.v(r * Math.cos(a), -h, r * Math.sin(a))) - 1);
    }
    var apex = vertices.push(V.v(0, h, 0)) - 1;
    var baseC = vertices.push(V.v(0, -h, 0)) - 1;
    var faces = [];
    for (var j = 0; j < seg; j++) {
      var n = (j + 1) % seg;
      faces.push([apex, base[j], base[n]]);
      faces.push([baseC, base[n], base[j]]);
    }
    return make('Cone', vertices, faces);
  }

  function torus(radius, tube, segU, segV) {
    var R = radius || 1, t = tube || 0.4;
    segU = Math.max(3, segU || 20);
    segV = Math.max(3, segV || 10);
    var vertices = [];
    for (var i = 0; i < segU; i++) {
      var u = 2 * Math.PI * i / segU;
      for (var j = 0; j < segV; j++) {
        var vv = 2 * Math.PI * j / segV;
        var cx = (R + t * Math.cos(vv));
        vertices.push(V.v(cx * Math.cos(u), t * Math.sin(vv), cx * Math.sin(u)));
      }
    }
    var faces = [];
    for (var a = 0; a < segU; a++) {
      for (var b = 0; b < segV; b++) {
        var i0 = a * segV + b;
        var i1 = ((a + 1) % segU) * segV + b;
        var i2 = ((a + 1) % segU) * segV + ((b + 1) % segV);
        var i3 = a * segV + ((b + 1) % segV);
        faces.push([i0, i1, i2, i3]);
      }
    }
    return make('Tore', vertices, faces);
  }

  function bounds(mesh) {
    var min = V.v(Infinity, Infinity, Infinity);
    var max = V.v(-Infinity, -Infinity, -Infinity);
    for (var i = 0; i < mesh.vertices.length; i++) {
      var p = mesh.vertices[i];
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
    }
    return { min: min, max: max };
  }

  function faceNormal(mesh, face) {
    var a = mesh.vertices[face[0]];
    var b = mesh.vertices[face[1]];
    var c = mesh.vertices[face[2]];
    return V.normalize(V.cross(V.sub(b, a), V.sub(c, a)));
  }

  global.Mesh = {
    make: make,
    edgesFromFaces: edgesFromFaces,
    cube: cube,
    plane: plane,
    sphere: sphere,
    cylinder: cylinder,
    cone: cone,
    torus: torus,
    bounds: bounds,
    faceNormal: faceNormal
  };
})(window);

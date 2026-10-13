(function (global) {
  'use strict';

  var V = global.Vec3;
  var M = global.Mat4;
  var Mesh = global.Mesh;

  var COLORS = ['#c9d7f0', '#d7c9f0', '#f0d7c9', '#c9f0d7', '#f0c9d7', '#d7f0c9'];

  function meshFor(kind) {
    switch (kind) {
      case 'cube': return Mesh.cube(2);
      case 'plane': return Mesh.plane(4);
      case 'sphere': return Mesh.sphere(1, 20, 12);
      case 'cylinder': return Mesh.cylinder(1, 2, 20);
      case 'cone': return Mesh.cone(1, 2, 20);
      case 'torus': return Mesh.torus(1, 0.4, 22, 12);
      default: return Mesh.cube(2);
    }
  }

  function restHeight(mesh) {
    return -Mesh.bounds(mesh).min.y;
  }

  global.Tools = {
    meshFor: meshFor,
    restHeight: restHeight,
    COLORS: COLORS
  };
})(window);

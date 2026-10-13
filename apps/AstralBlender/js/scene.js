(function (global) {
  'use strict';

  var V = global.Vec3;
  var U = global.Utils;

  function createObject(type, mesh, opts) {
    opts = opts || {};
    return {
      id: U.uid('obj'),
      name: opts.name || mesh.name || 'Objet',
      type: type,
      mesh: mesh,
      position: V.v(0, 0, 0),
      rotation: V.v(0, 0, 0),
      scale: V.v(1, 1, 1),
      color: opts.color || '#c9d7f0',
      visible: true,
      locked: false
    };
  }

  function add(scene, obj) {
    scene.objects.push(obj);
    return obj;
  }

  function remove(scene, id) {
    for (var i = 0; i < scene.objects.length; i++) {
      if (scene.objects[i].id === id) { scene.objects.splice(i, 1); return true; }
    }
    return false;
  }

  function byId(scene, id) {
    for (var i = 0; i < scene.objects.length; i++) {
      if (scene.objects[i].id === id) return scene.objects[i];
    }
    return null;
  }

  global.Scene = {
    createObject: createObject,
    add: add,
    remove: remove,
    byId: byId
  };
})(window);

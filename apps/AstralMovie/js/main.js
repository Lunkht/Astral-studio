(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Interaction = global.Interaction;
  var UI = global.UI;

  function boot() {
    var canvas = document.getElementById('canvas');
    var workspace = document.getElementById('workspace');

    Renderer.init(canvas);
    Interaction.init(canvas);
    UI.init();

    App.newProject({ name: 'Séquence', width: 1280, height: 720, fps: 30, background: '#000000' });
    App.setZoom(90);

    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () { Renderer.resize(); });
      ro.observe(workspace);
    } else {
      global.addEventListener('resize', function () { Renderer.resize(); });
    }

    UI.render();
    Renderer.draw();
    UI.status('Prêt');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

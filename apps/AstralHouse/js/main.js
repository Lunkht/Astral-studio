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
    App.newDrawing({ name: 'Dessin1', units: 'mm', gridSize: 10 });
    App.viewport.x = Renderer.w / 2;
    App.viewport.y = Renderer.h / 2;
    App.zoomExtents();
    Interaction.init(canvas);
    UI.init();

    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () { Renderer.resize(); });
      ro.observe(workspace);
    } else {
      global.addEventListener('resize', function () { Renderer.resize(); });
    }

    UI.setTool('select');
    UI.render();
    Renderer.draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

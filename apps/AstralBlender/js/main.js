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

    App.newScene();
    App.frame();

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

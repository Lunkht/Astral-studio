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

    App.newDocument({ name: 'Sans titre', width: 800, height: 600, fps: 12, frameCount: 24, background: '#ffffff' });

    var rect = workspace.getBoundingClientRect();
    App.fit(rect.width || Renderer.w, rect.height || Renderer.h);

    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () { Renderer.resize(); });
      ro.observe(workspace);
    } else {
      global.addEventListener('resize', function () { Renderer.resize(); });
    }

    UI.setTool('select');
    UI.render();
    Renderer.draw();

    UI.openDocDialog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

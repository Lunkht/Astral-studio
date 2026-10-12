(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Interaction = global.Interaction;
  var UI = global.UI;

  function boot() {
    var canvas = document.getElementById('canvas');
    var workspace = document.getElementById('workspace');
    var rulerTop = document.getElementById('rulerTop');
    var rulerLeft = document.getElementById('rulerLeft');

    Renderer.init(canvas, rulerTop, rulerLeft);
    Interaction.init(canvas);
    UI.init();

    var rect = workspace.getBoundingClientRect();
    App.fitToView(rect.width, rect.height);

    App.on('change', function () { Renderer.draw(); });
    App.on('selection', function () { Renderer.draw(); });
    App.on('view', function () { Renderer.draw(); });

    var ro = new ResizeObserver(function () { Renderer.resize(); });
    ro.observe(workspace);

    UI.setTool('select');
    UI.render();
    Renderer.draw();

    // Start screen: choose a document preset before the (empty) canvas
    global.DocDialog.init();
    global.DocDialog.open();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

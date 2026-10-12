(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Interaction = global.Interaction;
  var UI = global.UI;
  var DocDialog = global.DocDialog;

  function boot() {
    var canvas = document.getElementById('canvas');
    var workspace = document.getElementById('workspace');

    Renderer.init(canvas);
    Interaction.init(canvas);
    UI.init();

    App.on('change', function () { Renderer.draw(); });
    App.on('selection', function () { Renderer.draw(); });
    App.on('view', function () { Renderer.draw(); });

    if (global.ResizeObserver && workspace) {
      var ro = new ResizeObserver(function () { Renderer.resize(); });
      ro.observe(workspace);
    }

    /* default empty document behind the start screen */
    App.newDocument({ name: 'Sans titre', width: 1000, height: 700, background: '#ffffff' });
    UI.setActiveLayerDefaults && UI.setActiveLayerDefaults();
    UI.renderAll();
    Renderer.resize();

    DocDialog.init();
    DocDialog.open();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);

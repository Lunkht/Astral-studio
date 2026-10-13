(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Interaction = global.Interaction;
  var Player = global.Player;
  var UI = global.UI;

  function redraw() {
    Renderer.resize();
    Renderer.draw();
    Renderer.drawOverlay();
  }

  function boot() {
    var canvas = document.getElementById('compCanvas');
    Renderer.init(canvas);
    Interaction.init(canvas);
    UI.init();

    App.newComp({ name: 'Composition 1', width: 1280, height: 720, fps: 30, duration: 5, background: '#101010' });

    App.on('change', redraw);
    App.on('time', redraw);
    global.addEventListener('resize', function () { redraw(); });

    Player.start();

    var bg = App.addSolid({ color: '#2b2b2b', w: 1280, h: 720 });
    bg.name = 'Fond';
    var title = App.addText('AstralEffet');
    title.color = '#e8e8e8';
    title.transform.y.value = 720 / 2;
    App.select(null);
    App.commit();
    redraw();

    UI.status('Pret');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

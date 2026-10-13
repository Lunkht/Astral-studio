(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Interaction = global.Interaction;
  var UI = global.UI;
  var Engine = global.Engine;

  function draw() {
    Renderer.draw();
  }

  function loop() {
    if (App.playing) {
      var t = Engine.position();
      var dur = App.duration();
      if (t >= dur) {
        App.time = dur;
        App.stop();
      } else {
        App.time = t;
        UI.syncDynamic();
        draw();
      }
    }
    global.requestAnimationFrame(loop);
  }

  function boot() {
    var canvas = document.getElementById('tlCanvas');
    App.newProject({ name: 'Session audio' });
    Renderer.init(canvas);
    Interaction.init(canvas);
    UI.init();

    App.on('change', draw);
    App.on('time', draw);

    var demo = App.generateTone(440, 2);
    void demo;
    App.setTime(0);
    App.selection.trackId = App.project.tracks.length ? App.project.tracks[0].id : null;
    App.emit('change');

    global.addEventListener('resize', function () {
      Renderer.resize();
      draw();
    });

    var hint = document.getElementById('helpLayer');
    if (hint) hint.hidden = true;

    UI.status('Pret. Importez un audio ou generez un son.');
    global.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.AstralAudi = { boot: boot, draw: draw };
})(window);

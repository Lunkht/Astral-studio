(function (global) {
  'use strict';

  var App = global.App;

  var Player = {
    _raf: 0,
    _last: 0
  };

  Player.init = function () {
    this._last = 0;
  };

  Player.play = function () {
    if (App.playing) return;
    App.playing = true;
    this._last = 0;
    App.emit('playing');
    App.emit('change');
  };

  Player.pause = function () {
    if (!App.playing) return;
    App.playing = false;
    App.emit('playing');
    App.emit('change');
  };

  Player.toggle = function () {
    if (App.playing) this.pause(); else this.play();
  };

  Player.start = function () {
    var self = this;
    this._last = 0;
    function loop(now) {
      self.tick(now);
      self._raf = global.requestAnimationFrame(loop);
    }
    this._raf = global.requestAnimationFrame(loop);
  };

  Player.stop = function () {
    if (this._raf) global.cancelAnimationFrame(this._raf);
    this._raf = 0;
  };

  Player.tick = function (now) {
    if (!now) now = global.performance ? global.performance.now() : Date.now();
    var dt = this._last ? (now - this._last) / 1000 : 0;
    this._last = now;
    if (App.playing && App.comp) {
      var t = App.time + dt;
      if (t >= App.comp.duration) {
        t = App.comp.duration;
        App.playing = false;
        App.emit('playing');
      }
      App.time = t;
      this.syncVideos(t, true);
      App.emit('time');
    }
  };

  Player.syncVideos = function (t, playing) {
    if (!App.comp) return;
    App.comp.layers.forEach(function (l) {
      if (l.type !== 'video') return;
      var a = App.assets.byId[l.assetId];
      if (!a || !a.element) return;
      var el = a.element;
      try {
        var dur = a.duration > 0 ? a.duration : 0;
        var target = dur > 0 ? (t % dur) : 0;
        if (Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;
        if (playing && el.paused) el.play();
        if (!playing && !el.paused) el.pause();
      } catch (e) { /* ignore */ }
    });
  };

  global.Player = Player;
})(window);

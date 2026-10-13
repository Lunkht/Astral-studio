(function (global) {
  'use strict';

  var App = global.App;

  var Timeline = {
    _raf: 0,
    _last: 0,

    play: function () {
      if (!App.doc || App.playing) return;
      App.playing = true;
      this._last = 0;
      App.emit('play');
      var self = this;
      if (typeof global.requestAnimationFrame === 'function') {
        this._raf = global.requestAnimationFrame(function (t) { self._tick(t); });
      }
    },
    pause: function () {
      App.playing = false;
      if (this._raf && typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(this._raf);
      this._raf = 0;
      App.emit('play');
    },
    toggle: function () {
      if (App.playing) this.pause(); else this.play();
    },
    _tick: function (now) {
      if (!App.playing) return;
      if (!this._last) this._last = now;
      var dt = now - this._last;
      var frameMs = 1000 / (App.doc.fps || 12);
      if (dt >= frameMs) {
        this._last = now - (dt % frameMs);
        var f = App.currentFrame + 1;
        if (f >= App.doc.frameCount) f = 0;
        App.currentFrame = f;
        App.emit('frame');
        App.emit('change');
      }
      var self = this;
      this._raf = global.requestAnimationFrame(function (t) { self._tick(t); });
    }
  };

  global.Timeline = Timeline;
})(window);

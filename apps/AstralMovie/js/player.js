(function (global) {
  'use strict';

  var App = global.App;
  var P = global.Project;
  var C = global.Clip;

  function now() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  var Player = {
    _raf: 0,
    _startWall: 0,
    _startPlay: 0,
    _active: [],

    play: function () {
      if (!App.project) return;
      if (App.playing) return;
      var dur = App.totalDuration();
      if (dur > 0 && App.playhead >= dur - 1e-6) App.playhead = 0;
      this._startWall = now();
      this._startPlay = App.playhead;
      App.setPlaying(true);
      var self = this;
      this._raf = global.requestAnimationFrame(function () { self._frame(); });
    },

    pause: function () {
      if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = 0; }
      App.setPlaying(false);
      this._stopMedia();
    },

    toggle: function () {
      if (App.playing) this.pause();
      else this.play();
    },

    _frame: function () {
      if (!App.playing) return;
      var dur = App.totalDuration();
      var t = this._startPlay + (now() - this._startWall) / 1000;
      if (dur > 0 && t >= dur) {
        App.playhead = dur;
        App.emit('time');
        this.pause();
        return;
      }
      App.playhead = t;
      App.emit('time');
      this.sync(t, true);
      var self = this;
      this._raf = global.requestAnimationFrame(function () { self._frame(); });
    },

    seekMedia: function (t) {
      this.sync(t, App.playing);
    },

    sync: function (t, playing) {
      if (!App.project) return;
      var activeEls = [];

      var visuals = P.visualClipsAt(App.project, t);
      for (var i = 0; i < visuals.length; i++) {
        var clip = visuals[i].clip;
        if (clip.type !== 'video') continue;
        var asset = App.assetById(clip.assetId);
        var el = asset && asset.element;
        if (!el || el.currentTime === undefined) continue;
        var target = C.sourceTime(clip, t);
        if (Math.abs(el.currentTime - target) > 0.25) {
          try { el.currentTime = target; } catch (e) { /* ignore */ }
        }
        try {
          el.playbackRate = clip.speed;
          if (playing && el.paused) el.play();
          else if (!playing && !el.paused) el.pause();
        } catch (e) { /* ignore */ }
        activeEls.push(el);
      }

      var audios = P.audioClipsAt(App.project, t);
      for (var j = 0; j < audios.length; j++) {
        var ac = audios[j].clip;
        var aasset = App.assetById(ac.assetId);
        var ael = aasset && aasset.element;
        if (!ael || ael.currentTime === undefined) continue;
        var at = C.sourceTime(ac, t);
        if (Math.abs(ael.currentTime - at) > 0.25) {
          try { ael.currentTime = at; } catch (e) { /* ignore */ }
        }
        try {
          ael.playbackRate = ac.speed;
          if (playing && ael.paused) ael.play();
          else if (!playing && !ael.paused) ael.pause();
        } catch (e) { /* ignore */ }
        activeEls.push(ael);
      }

      for (var k = 0; k < this._active.length; k++) {
        var prev = this._active[k];
        if (activeEls.indexOf(prev) < 0) {
          try { prev.pause(); } catch (e) { /* ignore */ }
        }
      }
      this._active = activeEls;
    },

    _stopMedia: function () {
      for (var i = 0; i < this._active.length; i++) {
        try { this._active[i].pause(); } catch (e) { /* ignore */ }
      }
      this._active = [];
    }
  };

  global.Player = Player;
})(window);

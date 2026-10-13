(function (global) {
  'use strict';

  var AD = global.AudioData;
  var Clip = global.Clip;
  var Project = global.Project;

  var Engine = {
    ctx: null,
    _sources: [],
    _nodes: [],
    _buffers: {},
    _endTimer: 0,
    _startAt: 0,
    _startCtx: 0,
    _playing: false
  };

  Engine.available = function () {
    return !!(global.AudioContext || global.webkitAudioContext);
  };

  Engine.ensure = function () {
    if (!this.ctx && this.available()) {
      var Ctor = global.AudioContext || global.webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  };

  Engine.toAudioData = function (audioBuffer) {
    var channelCount = audioBuffer.numberOfChannels;
    var out = AD.create(audioBuffer.sampleRate, channelCount, audioBuffer.length);
    for (var c = 0; c < channelCount; c++) {
      var src = audioBuffer.getChannelData(c);
      out.channels[c].set(src);
    }
    return out;
  };

  Engine.decode = function (file) {
    var self = this;
    var ctx = this.ensure();
    if (!ctx) return global.Promise.reject(new Error('AudioContext indisponible'));
    var read = file.arrayBuffer ? file.arrayBuffer() : new global.Promise(function (resolve, reject) {
      var fr = new global.FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsArrayBuffer(file);
    });
    return read.then(function (buf) {
      return new global.Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(buf, function (ab) { resolve(self.toAudioData(ab)); }, reject);
        if (p && p.then) p.then(function (ab) { resolve(self.toAudioData(ab)); }, reject);
      });
    });
  };

  Engine.bufferFor = function (asset) {
    if (this._buffers[asset.id]) return this._buffers[asset.id];
    var ctx = this.ensure();
    if (!ctx) return null;
    var d = asset.data;
    var ab = ctx.createBuffer(d.channels.length, d.length, d.sampleRate);
    for (var c = 0; c < d.channels.length; c++) ab.copyToChannel(d.channels[c], c);
    this._buffers[asset.id] = ab;
    return ab;
  };

  Engine.play = function (app, fromTime) {
    var ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    this.stop();

    var project = app.project;
    if (!project) return false;
    var anySolo = Project.anySolo(project);
    var dest = ctx.destination;
    var now = ctx.currentTime;
    var startAt = fromTime || 0;
    this._startAt = startAt;
    this._startCtx = now;
    this._playing = true;
    var projectEnd = Project.duration(project);
    var total = Math.max(0.01, projectEnd - startAt);

    for (var ti = 0; ti < project.tracks.length; ti++) {
      var track = project.tracks[ti];
      if (track.mute || (anySolo && !track.solo)) continue;
      var tGain = ctx.createGain();
      tGain.gain.value = track.gain;
      var panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.value = track.pan || 0;
        tGain.connect(panner);
        panner.connect(dest);
      } else {
        tGain.connect(dest);
      }
      this._nodes.push(tGain);

      var clips = track.clips;
      for (var ci = 0; ci < clips.length; ci++) {
        var clip = clips[ci];
        var cStart = clip.start;
        var cEnd = Clip.end(clip);
        if (cEnd <= startAt) continue;
        var asset = app.assetById(clip.assetId);
        if (!asset || !asset.data) continue;
        var ab = this.bufferFor(asset);
        if (!ab) continue;
        var src = ctx.createBufferSource();
        src.buffer = ab;
        var g = ctx.createGain();
        src.connect(g);
        g.connect(tGain);

        var offsetIntoClip = Math.max(0, startAt - cStart);
        var when = now + Math.max(0, cStart - startAt);
        var offset = clip.offset + offsetIntoClip;
        var dur = cEnd - Math.max(cStart, startAt);
        if (dur <= 0) continue;

        var baseGain = clip.gain;
        this.applyFades(g.gain, when, offsetIntoClip, dur, clip, baseGain);

        try { src.start(when, offset, dur); } catch (e) { /* ignore */ }
        this._sources.push(src);
      }
    }

    var self = this;
    this._endTimer = global.setTimeout(function () {
      self._endTimer = 0;
      if (app.playing) { app.playing = false; app.emit('playing'); app.emit('change'); }
    }, total * 1000);
    return true;
  };

  Engine.applyFades = function (param, when, offsetIntoClip, dur, clip, baseGain) {
    var d = clip.duration;
    var g0 = baseGain;
    if (clip.fadeIn > 0 && offsetIntoClip < clip.fadeIn) {
      param.setValueAtTime(offsetIntoClip / clip.fadeIn * baseGain, when);
      var t = when + (clip.fadeIn - offsetIntoClip);
      param.linearRampToValueAtTime(baseGain, t);
    } else {
      param.setValueAtTime(baseGain, when);
    }
    if (clip.fadeOut > 0) {
      var fadeStart = d - clip.fadeOut;
      if (offsetIntoClip < fadeStart) {
        param.setValueAtTime(baseGain, when + (fadeStart - offsetIntoClip));
      }
      param.linearRampToValueAtTime(0, when + dur);
    }
  };

  Engine.position = function () {
    if (!this._playing || !this.ctx) return this._startAt || 0;
    return (this._startAt || 0) + (this.ctx.currentTime - this._startCtx);
  };

  Engine.stop = function () {
    this._playing = false;
    for (var i = 0; i < this._sources.length; i++) {
      try { this._sources[i].stop(0); } catch (e) { /* ignore */ }
    }
    this._sources = [];
    this._nodes = [];
    if (this._endTimer) { global.clearTimeout(this._endTimer); this._endTimer = 0; }
  };

  Engine.invalidate = function () {
    this._buffers = {};
  };

  global.Engine = Engine;
})(window);

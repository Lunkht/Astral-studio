(function (global) {
  'use strict';

  var U = global.Utils;
  var AD = global.AudioData;
  var Asset = global.Asset;
  var Clip = global.Clip;
  var Track = global.Track;
  var Project = global.Project;
  var Edits = global.Edits;

  var App = {
    project: null,
    assets: { byId: {}, list: [] },
    time: 0,
    playing: false,
    selection: { trackId: null, t0: 0, t1: 0, active: false },
    selectedClipId: null,
    clipboard: null,
    zoom: 80,
    tool: 'select',
    snap: true,
    _undo: [],
    _redo: [],
    _last: null,
    _listeners: {}
  };

  App.on = function (evt, fn) {
    (this._listeners[evt] = this._listeners[evt] || []).push(fn);
    return fn;
  };

  App.off = function (evt, fn) {
    var l = this._listeners[evt];
    if (!l) return;
    var i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  };

  App.emit = function (evt) {
    var l = this._listeners[evt];
    if (!l) return;
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < l.length; i++) l[i].apply(null, args);
  };

  App.newProject = function (opts) {
    this.project = Project.create(opts);
    this.time = 0;
    this.playing = false;
    this.selection = { trackId: null, t0: 0, t1: 0, active: false };
    this.selectedClipId = null;
    this.clipboard = null;
    this._undo = [];
    this._redo = [];
    this._last = U.deepClone(this.project);
    this.emit('change');
    this.emit('time');
  };

  App.addAsset = function (asset) {
    this.assets.byId[asset.id] = asset;
    this.assets.list.push(asset);
    return asset;
  };

  App.assetById = function (id) {
    return id ? this.assets.byId[id] : null;
  };

  App.importFile = function (file, onReady) {
    var self = this;
    var Engine = global.Engine;
    if (!Engine || !Engine.available()) { this.emit('change'); return null; }
    Engine.decode(file).then(function (data) {
      var asset = self.addAsset(Asset.create(data, file.name));
      self.emit('change');
      if (onReady) onReady(asset);
    })['catch'](function () {
      self.emit('error', 'Format audio non reconnu');
    });
    return null;
  };

  App.duration = function () {
    return this.project ? Project.duration(this.project) : 0;
  };

  App.trackById = function (id) {
    return this.project ? Project.trackById(this.project, id) : null;
  };

  App.currentTrack = function () {
    var t = this.selection.trackId ? this.trackById(this.selection.trackId) : null;
    if (!t && this.project && this.project.tracks.length) t = this.project.tracks[0];
    return t;
  };

  App.selectedClip = function () {
    if (!this.selectedClipId || !this.project) return null;
    for (var i = 0; i < this.project.tracks.length; i++) {
      var c = Track.clipById(this.project.tracks[i], this.selectedClipId);
      if (c) return c;
    }
    return null;
  };

  App.addTrack = function (name) {
    var t = Project.newTrack(this.project, name);
    this.selection.trackId = t.id;
    this.commit();
    this.emit('change');
    return t;
  };

  App.removeTrack = function (id) {
    if (this.project.tracks.length <= 1) return false;
    Project.removeTrack(this.project, id);
    if (this.selection.trackId === id) this.selection.trackId = null;
    this.commit();
    this.emit('change');
    return true;
  };

  App.addClipFromAsset = function (assetId, trackId, at) {
    var asset = this.assetById(assetId);
    if (!asset) return null;
    var track = trackId ? this.trackById(trackId) : this.currentTrack();
    if (!track) return null;
    var start = U.isNum(at) ? Math.max(0, at) : Track.end(track);
    var clip = Clip.create({ name: asset.name, assetId: assetId, start: start, offset: 0, duration: asset.duration });
    Track.addClip(track, clip);
    this.selection.trackId = track.id;
    this.selectedClipId = clip.id;
    this.commit();
    this.emit('change');
    return clip;
  };

  App.selectClip = function (id) {
    this.selectedClipId = id;
    if (id && this.project) {
      for (var i = 0; i < this.project.tracks.length; i++) {
        if (Track.clipById(this.project.tracks[i], id)) { this.selection.trackId = this.project.tracks[i].id; break; }
      }
    }
    this.emit('change');
  };

  App.setRegion = function (trackId, t0, t1) {
    var a = Math.min(t0, t1), b = Math.max(t0, t1);
    this.selection.trackId = trackId;
    this.selection.t0 = Math.max(0, a);
    this.selection.t1 = Math.max(0, b);
    this.selection.active = true;
    this.emit('change');
  };

  App.clearRegion = function () {
    this.selection.active = false;
    this.emit('change');
  };

  App.effectiveRegion = function () {
    var sel = this.selection;
    if (sel.active && sel.t1 > sel.t0) return { t0: sel.t0, t1: sel.t1 };
    var clip = this.selectedClip();
    if (clip) return { t0: clip.start, t1: Clip.end(clip) };
    return { t0: 0, t1: this.duration() };
  };

  App.setTime = function (t) {
    this.time = U.clamp(t, 0, Math.max(this.duration(), 0.01));
    this.emit('time');
  };

  App.stepFrame = function (n) {
    this.setTime(this.time + n * 0.01);
  };

  App.goStart = function () { this.setTime(0); };
  App.goEnd = function () { this.setTime(this.duration()); };

  App.play = function () {
    var Engine = global.Engine;
    if (Engine && Engine.available()) {
      Engine.play(this, this.time);
      this.playing = true;
      this.emit('playing');
      this.emit('change');
    }
  };

  App.stop = function () {
    var Engine = global.Engine;
    if (Engine) Engine.stop();
    this.playing = false;
    this.emit('playing');
    this.emit('change');
  };

  App.togglePlay = function () {
    if (this.playing) this.stop(); else this.play();
  };

  App.seek = function (t) {
    var wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    this.setTime(t);
    if (wasPlaying) this.play();
  };

  /* ---- edit operations ---- */

  App.regionDelete = function () {
    var r = this.effectiveRegion();
    var track = this.currentTrack();
    if (!track) return;
    Edits.deleteRegion(track, r.t0, r.t1);
    this.commit();
    this.emit('change');
  };

  App.regionSilence = function () {
    var r = this.effectiveRegion();
    var track = this.currentTrack();
    if (!track) return;
    Edits.silenceRegion(track, this.assets, r.t0, r.t1);
    this.commit();
    this.emit('change');
  };

  App.regionCopy = function () {
    var r = this.effectiveRegion();
    var track = this.currentTrack();
    if (!track) return;
    this.clipboard = Edits.copyRegion(track, this.assets, r.t0, r.t1);
    this.emit('change');
  };

  App.regionCut = function () {
    this.regionCopy();
    this.regionDelete();
  };

  App.paste = function () {
    if (!this.clipboard) return;
    var track = this.currentTrack();
    if (!track) return;
    Edits.insertData(track, this.assets, this.time, AD.clone(this.clipboard), 'Collage');
    this.commit();
    this.emit('change');
  };

  App.insertSilence = function (seconds) {
    var track = this.currentTrack();
    if (!track) return;
    var data = AD.silence(this.project.sampleRate, seconds, 1);
    Edits.insertData(track, this.assets, this.time, data, 'Silence');
    this.commit();
    this.emit('change');
  };

  App.applyTransform = function (fn, name) {
    var r = this.effectiveRegion();
    var track = this.currentTrack();
    if (!track) return;
    Edits.applyRegion(track, this.assets, r.t0, r.t1, fn);
    this.commit();
    this.emit('change');
  };

  App.amplify = function (factor) {
    this.applyTransform(function (d) { return Edits.amplifyData(d, factor); }, 'Amplifier');
  };

  App.normalize = function () {
    this.applyTransform(function (d) { return Edits.normalizeData(d); }, 'Normaliser');
  };

  App.reverse = function () {
    this.applyTransform(function (d) { return Edits.reverseData(d); }, 'Inverser');
  };

  App.fadeIn = function (seconds) {
    this.applyTransform(function (d) { return Edits.fadeData(d, seconds, 'in'); }, 'Fondu entrant');
  };

  App.fadeOut = function (seconds) {
    this.applyTransform(function (d) { return Edits.fadeData(d, seconds, 'out'); }, 'Fondu sortant');
  };

  App.generateTone = function (freq, seconds) {
    var track = this.currentTrack();
    if (!track) return;
    var data = Edits.generateTone(this.project.sampleRate, seconds || 1, freq || 440, 0.8);
    var asset = this.addAsset(Asset.create(data, 'Sine ' + Math.round(freq || 440) + ' Hz'));
    this.addClipFromAsset(asset.id, track.id, this.time);
  };

  App.generateNoise = function (seconds) {
    var track = this.currentTrack();
    if (!track) return;
    var data = Edits.generateNoise(this.project.sampleRate, seconds || 1, 0.5);
    var asset = this.addAsset(Asset.create(data, 'Bruit blanc'));
    this.addClipFromAsset(asset.id, track.id, this.time);
  };

  App.deleteSelectedClip = function () {
    var clip = this.selectedClip();
    if (!clip) return;
    for (var i = 0; i < this.project.tracks.length; i++) {
      if (Track.clipById(this.project.tracks[i], clip.id)) { Track.removeClip(this.project.tracks[i], clip.id); break; }
    }
    this.selectedClipId = null;
    this.commit();
    this.emit('change');
  };

  App.setClipGain = function (gain) {
    var clip = this.selectedClip();
    if (!clip) return;
    clip.gain = gain;
    this.commit();
    this.emit('change');
  };

  App.setClipFade = function (which, seconds) {
    var clip = this.selectedClip();
    if (!clip) return;
    if (which === 'in') clip.fadeIn = Math.max(0, seconds);
    else clip.fadeOut = Math.max(0, seconds);
    this.commit();
    this.emit('change');
  };

  App.toggleMute = function (trackId) {
    var t = this.trackById(trackId);
    if (!t) return;
    t.mute = !t.mute;
    this.commit();
    this.emit('change');
  };

  App.toggleSolo = function (trackId) {
    var t = this.trackById(trackId);
    if (!t) return;
    t.solo = !t.solo;
    this.commit();
    this.emit('change');
  };

  App.setTrackGain = function (trackId, gain) {
    var t = this.trackById(trackId);
    if (!t) return;
    t.gain = Math.max(0, gain);
    this.emit('change');
  };

  App.setZoom = function (pxPerSec) {
    this.zoom = U.clamp(pxPerSec, 4, 1200);
    this.emit('change');
  };

  App.zoomBy = function (factor) {
    this.setZoom(this.zoom * factor);
  };

  /* ---- history ---- */

  App.commit = function () {
    if (this._last) this._undo.push(this._last);
    if (this._undo.length > 100) this._undo.shift();
    this._redo.length = 0;
    this._last = U.deepClone(this.project);
    this.emit('history');
  };

  App.canUndo = function () { return this._undo.length > 0; };
  App.canRedo = function () { return this._redo.length > 0; };

  App.undo = function () {
    if (!this._undo.length) return;
    this._redo.push(U.deepClone(this.project));
    this.project = this._undo.pop();
    this._last = U.deepClone(this.project);
    this.selectedClipId = null;
    this.emit('change');
    this.emit('history');
  };

  App.redo = function () {
    if (!this._redo.length) return;
    this._undo.push(U.deepClone(this.project));
    this.project = this._redo.pop();
    this._last = U.deepClone(this.project);
    this.selectedClipId = null;
    this.emit('change');
    this.emit('history');
  };

  global.App = App;
})(window);

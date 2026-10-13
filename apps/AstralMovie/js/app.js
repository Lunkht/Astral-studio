(function (global) {
  'use strict';

  var U = global.Utils;
  var P = global.Project;
  var C = global.Clip;
  var Asset = global.Asset;

  var DEFAULT_IMAGE = 5;

  var App = {
    project: null,
    assets: [],
    selection: {},
    playhead: 0,
    playing: false,
    pxPerSec: 90,
    activeTrackId: null,
    _history: [],
    _redo: [],
    _listeners: {},

    on: function (evt, fn) {
      (this._listeners[evt] || (this._listeners[evt] = [])).push(fn);
    },
    emit: function (evt) {
      var list = this._listeners[evt] || [];
      for (var i = 0; i < list.length; i++) list[i]();
    },

    /* ---- project ---- */
    newProject: function (opts) {
      this.project = P.create(opts || {});
      this.assets = [];
      this.selection = {};
      this.playhead = 0;
      this.playing = false;
      var vt = P.videoTracks(this.project);
      this.activeTrackId = vt.length ? vt[0].id : this.project.tracks[0].id;
      this._history = [JSON.stringify(this.project)];
      this._redo = [];
      this.emit('doc');
      this.emit('change');
    },

    totalDuration: function () {
      return this.project ? P.duration(this.project) : 0;
    },
    timelineLength: function () {
      return Math.max(this.totalDuration(), this.playhead, 5);
    },
    activeTrack: function () {
      return P.trackById(this.project, this.activeTrackId) || this.project.tracks[0];
    },
    setActiveTrack: function (id) {
      this.activeTrackId = id;
      this.emit('change');
    },

    /* ---- assets ---- */
    assetById: function (id) {
      for (var i = 0; i < this.assets.length; i++) if (this.assets[i].id === id) return this.assets[i];
      return null;
    },
    addAsset: function (asset) {
      this.assets.push(asset);
      this.emit('assets');
      this.emit('change');
      return asset;
    },
    importFiles: function (fileList) {
      var self = this;
      var files = [];
      for (var i = 0; i < fileList.length; i++) files.push(fileList[i]);
      var jobs = files.map(function (file) {
        var kind = file.type.indexOf('audio') === 0 ? 'audio'
          : file.type.indexOf('image') === 0 ? 'image' : 'video';
        var src = global.URL && global.URL.createObjectURL ? global.URL.createObjectURL(file) : '';
        var asset = Asset.create({ kind: kind, name: file.name, src: src });
        self.addAsset(asset);
        return Asset.probe(asset).then(function (a) {
          if (!a.duration || a.duration <= 0) a.duration = a.kind === 'image' ? DEFAULT_IMAGE : DEFAULT_IMAGE;
          self.emit('assets');
          self.emit('change');
          return a;
        });
      });
      return Promise.all(jobs);
    },

    /* ---- clips ---- */
    defaultDuration: function (asset) {
      if (asset && U.isNum(asset.duration) && asset.duration > 0) return asset.duration;
      return DEFAULT_IMAGE;
    },
    insertAsset: function (assetId, trackId, time) {
      var asset = this.assetById(assetId);
      if (!asset) return null;
      var track = P.trackById(this.project, trackId) || this.activeTrack();
      var sameKind = (track.kind === 'audio') === (asset.kind === 'audio');
      if (!sameKind) {
        track = (asset.kind === 'audio' ? P.audioTracks(this.project) : P.videoTracks(this.project))[0] || track;
      }
      var start = U.isNum(time) ? time : this.playhead;
      var clip = C.create({
        name: asset.name,
        type: asset.kind,
        assetId: asset.id,
        track: track.id,
        start: start,
        inPoint: 0,
        duration: this.defaultDuration(asset),
        srcDuration: (U.isNum(asset.duration) && asset.duration > 0) ? asset.duration : null
      });
      P.addClip(this.project, clip);
      this.selection = {};
      this.selection[clip.id] = true;
      this.activeTrackId = track.id;
      this.commit('Insérer un clip');
      return clip;
    },
    addTitle: function (text) {
      var tracks = P.videoTracks(this.project);
      if (!tracks.length) return null;
      var track = this.activeTrack() && this.activeTrack().kind === 'video' ? this.activeTrack() : tracks[0];
      var clip = C.create({
        type: 'title',
        name: 'Titre',
        track: track.id,
        start: this.playhead,
        duration: 5,
        text: text || 'Titre',
        color: '#ffffff'
      });
      P.addClip(this.project, clip);
      this.selection = {};
      this.selection[clip.id] = true;
      this.commit('Ajouter un titre');
      return clip;
    },
    clipById: function (id) { return P.clipById(this.project, id); },
    selectedIds: function () { return Object.keys(this.selection); },
    selectedClips: function () {
      var out = [];
      for (var i = 0; i < this.project.clips.length; i++) {
        if (this.selection[this.project.clips[i].id]) out.push(this.project.clips[i]);
      }
      return out;
    },
    select: function (id, additive) {
      if (!additive) this.selection = {};
      if (id) this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },
    toggleSelect: function (id) {
      if (this.selection[id]) delete this.selection[id]; else this.selection[id] = true;
      this.emit('selection');
      this.emit('change');
    },
    clearSelection: function () {
      this.selection = {};
      this.emit('selection');
      this.emit('change');
    },
    deleteSelection: function () {
      var ids = this.selectedIds();
      if (!ids.length) return;
      for (var i = 0; i < ids.length; i++) P.removeClip(this.project, ids[i]);
      this.selection = {};
      this.commit('Supprimer');
    },
    duplicateSelection: function () {
      var sel = this.selectedClips();
      if (!sel.length) return;
      var newSel = {};
      for (var i = 0; i < sel.length; i++) {
        var c = U.deepClone(sel[i]);
        c.id = U.uid('clip');
        c.start = C.end(sel[i]);
        c.name = sel[i].name;
        P.addClip(this.project, c);
        newSel[c.id] = true;
      }
      this.selection = newSel;
      this.commit('Dupliquer');
    },

    moveClip: function (id, newStart) {
      var r = P.moveClip(this.project, id, newStart);
      this.emit('change');
      return r;
    },
    trimClip: function (id, edge, time) {
      var r = P.trimClip(this.project, id, edge, time);
      this.emit('change');
      return r;
    },
    splitAtPlayhead: function () {
      var made = P.splitAt(this.project, this.playhead);
      if (made.length) {
        this.selection = {};
        this.commit('Diviser');
      }
      return made;
    },

    /* ---- playhead ---- */
    setPlayhead: function (t) {
      this.playhead = U.clamp(t, 0, Math.max(0, this.timelineLength()));
      this.emit('time');
      this.emit('change');
    },
    stepFrame: function (dir) {
      this.setPlayhead(this.playhead + dir / this.project.fps);
    },
    goStart: function () { this.setPlayhead(0); },
    goEnd: function () { this.setPlayhead(this.totalDuration()); },
    setPlaying: function (v) {
      this.playing = !!v;
      this.emit('playing');
      this.emit('change');
    },
    togglePlay: function () {
      if (global.Player) global.Player.toggle();
    },

    /* ---- zoom / view ---- */
    setZoom: function (px) {
      this.pxPerSec = U.clamp(px, 8, 600);
      this.emit('change');
    },
    zoomBy: function (factor) {
      this.setZoom(this.pxPerSec * factor);
    },

    /* ---- history ---- */
    commit: function () {
      this._history.push(JSON.stringify(this.project));
      if (this._history.length > 80) this._history.shift();
      this._redo = [];
      this.emit('change');
    },
    undo: function () {
      if (this._history.length <= 1) return;
      this._redo.push(this._history.pop());
      this.project = JSON.parse(this._history[this._history.length - 1]);
      this.prune();
      this.emit('change');
    },
    redo: function () {
      if (!this._redo.length) return;
      var s = this._redo.pop();
      this._history.push(s);
      this.project = JSON.parse(s);
      this.prune();
      this.emit('change');
    },
    prune: function () {
      var self = this;
      this.selectedIds().forEach(function (id) { if (!P.clipById(self.project, id)) delete self.selection[id]; });
      if (!P.trackById(this.project, this.activeTrackId)) {
        var vt = P.videoTracks(this.project);
        this.activeTrackId = vt.length ? vt[0].id : this.project.tracks[0].id;
      }
      this.playhead = U.clamp(this.playhead, 0, Math.max(0, this.timelineLength()));
    },
    canUndo: function () { return this._history.length > 1; },
    canRedo: function () { return this._redo.length > 0; }
  };

  global.App = App;
})(window);

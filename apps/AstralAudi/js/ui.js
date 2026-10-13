(function (global) {
  'use strict';

  var U = global.Utils;
  var App = global.App;
  var Track = global.Track;
  var Project = global.Project;
  var Clip = global.Clip;
  var Renderer = global.Renderer;
  var Export = global.Export;

  var UI = { el: {}, _menuName: null };

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function clear(e) { if (e) e.innerHTML = ''; }

  UI.cache = function () {
    var ids = ['tlCanvas', 'trackList', 'inspBody', 'mediaInput', 'menuPop', 'helpLayer',
      'btnImport', 'btnTone', 'btnNoise', 'btnCut', 'btnCopy', 'btnPaste', 'btnDelete', 'btnSilence',
      'btnAmpUp', 'btnAmpDown', 'btnNorm', 'btnReverse', 'btnFadeIn', 'btnFadeOut',
      'btnUndo', 'btnRedo', 'btnZoomIn', 'btnZoomOut', 'btnFit',
      'btnStart', 'btnRew', 'btnPlay', 'btnFwd', 'btnEnd', 'timeVal',
      'btnAddTrack', 'btnRemoveTrack', 'statusText', 'statusRight'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
  };

  UI.status = function (msg) {
    if (this.el.statusText) this.el.statusText.textContent = msg;
  };

  UI.init = function () {
    this.cache();
    this.wireMenus();
    this.wireToolbar();
    this.wireTransport();
    this.wireTrackPanel();
    var self = this;
    App.on('change', function () { self.render(); });
    App.on('time', function () { self.syncDynamic(); });
    App.on('playing', function () { self.syncPlaying(); });
    App.on('error', function (msg) { self.status(msg); });
    this.render();
    return this;
  };

  function menus() {
    return {
      file: [
        { label: 'Nouveau projet', action: function () { App.newProject(); UI.status('Nouveau projet'); } },
        { label: 'Importer un audio...', action: function () { if (UI.el.mediaInput) UI.el.mediaInput.click(); } },
        { sep: true },
        { label: 'Exporter WAV', action: function () { if (Export.wavFile(App.project, App.assets)) UI.status('WAV exporte'); else UI.status('Rien a exporter'); } },
        { label: 'Exporter le projet (JSON)', action: function () { Export.projectJSON(App.project, App.assets, { download: true }); UI.status('Projet exporte'); } }
      ],
      edit: [
        { label: 'Annuler', action: function () { App.undo(); } },
        { label: 'Retablir', action: function () { App.redo(); } },
        { sep: true },
        { label: 'Couper', action: function () { App.regionCut(); } },
        { label: 'Copier', action: function () { App.regionCopy(); UI.status('Copie'); } },
        { label: 'Coller', action: function () { App.paste(); } },
        { label: 'Supprimer (silence)', action: function () { App.regionDelete(); } },
        { label: 'Silence', action: function () { App.regionSilence(); } }
      ],
      effect: [
        { label: 'Amplifier +3 dB', action: function () { App.amplify(U.dbToGain(3)); } },
        { label: 'Amplifier -3 dB', action: function () { App.amplify(U.dbToGain(-3)); } },
        { label: 'Normaliser', action: function () { App.normalize(); } },
        { label: 'Inverser (reverse)', action: function () { App.reverse(); } },
        { sep: true },
        { label: 'Fondu entrant 1 s', action: function () { App.fadeIn(1); } },
        { label: 'Fondu sortant 1 s', action: function () { App.fadeOut(1); } },
        { label: 'Inserer un silence (1 s)', action: function () { App.insertSilence(1); } }
      ],
      generate: [
        { label: 'Sinus 440 Hz (1 s)', action: function () { App.generateTone(440, 1); } },
        { label: 'Sinus 880 Hz (1 s)', action: function () { App.generateTone(880, 1); } },
        { label: 'Bruit blanc (1 s)', action: function () { App.generateNoise(1); } }
      ],
      track: [
        { label: 'Nouvelle piste', action: function () { App.addTrack(); } },
        { label: 'Supprimer la piste', action: function () { var t = App.currentTrack(); if (t) App.removeTrack(t.id); } },
        { sep: true },
        { label: 'Muet', action: function () { var t = App.currentTrack(); if (t) App.toggleMute(t.id); } },
        { label: 'Solo', action: function () { var t = App.currentTrack(); if (t) App.toggleSolo(t.id); } }
      ],
      view: [
        { label: 'Zoom avant', action: function () { App.zoomBy(1.25); } },
        { label: 'Zoom arriere', action: function () { App.zoomBy(0.8); } },
        { label: 'Ajuster', action: function () { Renderer.scrollX = 0; fitZoom(); } }
      ],
      help: [
        { label: 'Raccourcis clavier', action: function () { UI.toggleHelp(); } }
      ]
    };
  }

  function fitZoom() {
    var dur = App.duration();
    var w = UI.el.tlCanvas ? (UI.el.tlCanvas.clientWidth || 900) : 900;
    if (dur > 0) App.setZoom((w - 20) / dur);
    else App.setZoom(80);
  }

  UI.wireMenus = function () {
    var btns = document.querySelectorAll('[data-menu]');
    var self = this;
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) { e.stopPropagation(); self.openMenu(btn.getAttribute('data-menu'), btn); });
      })(btns[i]);
    }
    document.addEventListener('click', function () { self.closeMenu(); });
  };

  UI.openMenu = function (name, btn) {
    var pop = this.el.menuPop;
    if (!pop) return;
    if (this._menuName === name) { this.closeMenu(); return; }
    this._menuName = name;
    clear(pop);
    (menus()[name] || []).forEach(function (it) {
      if (it.sep) { pop.appendChild(mk('div', 'menu-sep')); return; }
      var b = mk('button', 'menu-item', it.label);
      b.addEventListener('click', function () { it.action(); UI.closeMenu(); });
      pop.appendChild(b);
    });
    var r = btn.getBoundingClientRect ? btn.getBoundingClientRect() : { left: 0, bottom: 0 };
    pop.style.left = (r.left || 0) + 'px';
    pop.style.top = ((r.bottom || 0) + 2) + 'px';
    pop.hidden = false;
  };

  UI.closeMenu = function () {
    this._menuName = null;
    if (this.el.menuPop) this.el.menuPop.hidden = true;
  };

  UI.toggleHelp = function () {
    if (this.el.helpLayer) this.el.helpLayer.hidden = !this.el.helpLayer.hidden;
  };

  UI.wireToolbar = function () {
    var el = this.el;
    function on(id, fn) { if (el[id]) el[id].addEventListener('click', fn); }
    on('btnImport', function () { if (el.mediaInput) el.mediaInput.click(); });
    on('btnTone', function () { App.generateTone(440, 1); });
    on('btnNoise', function () { App.generateNoise(1); });
    on('btnCut', function () { App.regionCut(); });
    on('btnCopy', function () { App.regionCopy(); UI.status('Copie'); });
    on('btnPaste', function () { App.paste(); });
    on('btnDelete', function () { App.regionDelete(); });
    on('btnSilence', function () { App.regionSilence(); });
    on('btnAmpUp', function () { App.amplify(U.dbToGain(3)); });
    on('btnAmpDown', function () { App.amplify(U.dbToGain(-3)); });
    on('btnNorm', function () { App.normalize(); });
    on('btnReverse', function () { App.reverse(); });
    on('btnFadeIn', function () { App.fadeIn(1); });
    on('btnFadeOut', function () { App.fadeOut(1); });
    on('btnUndo', function () { App.undo(); });
    on('btnRedo', function () { App.redo(); });
    on('btnZoomIn', function () { App.zoomBy(1.25); });
    on('btnZoomOut', function () { App.zoomBy(0.8); });
    on('btnFit', function () { fitZoom(); });
  };

  UI.wireTransport = function () {
    var el = this.el;
    function on(id, fn) { if (el[id]) el[id].addEventListener('click', fn); }
    on('btnStart', function () { App.goStart(); });
    on('btnRew', function () { App.setTime(App.time - 1); });
    on('btnPlay', function () { App.togglePlay(); });
    on('btnFwd', function () { App.setTime(App.time + 1); });
    on('btnEnd', function () { App.goEnd(); });
  };

  UI.wireTrackPanel = function () {
    var self = this;
    if (this.el.btnAddTrack) this.el.btnAddTrack.addEventListener('click', function () { App.addTrack(); });
    if (this.el.btnRemoveTrack) this.el.btnRemoveTrack.addEventListener('click', function () { var t = App.currentTrack(); if (t) App.removeTrack(t.id); });
    if (this.el.mediaInput) {
      this.el.mediaInput.addEventListener('change', function () {
        var files = self.el.mediaInput.files || [];
        for (var i = 0; i < files.length; i++) {
          App.importFile(files[i], function (asset) {
            App.addClipFromAsset(asset.id, App.currentTrack().id, App.time);
            UI.status('Importe : ' + asset.name);
          });
        }
        self.el.mediaInput.value = '';
      });
    }
  };

  UI.render = function () {
    this.syncDynamic();
    this.syncPlaying();
    this.renderTracks();
    this.renderInspector();
  };

  UI.syncDynamic = function () {
    if (this.el.timeVal) this.el.timeVal.textContent = U.formatTime(App.time);
    if (this.el.statusRight) {
      var sel = App.selection;
      var info = App.project ? (App.project.sampleRate + ' Hz  |  ' + U.formatTime(App.duration())) : '';
      if (sel.active && sel.t1 > sel.t0) info += '  |  sel ' + U.formatTime(sel.t1 - sel.t0);
      this.el.statusRight.textContent = info;
    }
  };

  UI.syncPlaying = function () {
    if (this.el.btnPlay) this.el.btnPlay.textContent = App.playing ? 'Stop' : 'Lecture';
  };

  UI.renderTracks = function () {
    var list = this.el.trackList;
    if (!list || !App.project) return;
    clear(list);
    var self = this;
    App.project.tracks.forEach(function (track, i) {
      var row = mk('div', 'track-row' + (track === App.currentTrack() ? ' sel' : ''));
      row.style.height = track.height + 'px';
      var head = mk('div', 'track-head');
      head.appendChild(mk('span', 'track-num', String(i + 1)));
      head.appendChild(mk('span', 'track-name', track.name));
      var mute = mk('button', 'track-btn' + (track.mute ? ' on' : ''), 'M');
      mute.title = 'Muet';
      mute.addEventListener('click', function () { App.toggleMute(track.id); });
      var solo = mk('button', 'track-btn' + (track.solo ? ' on' : ''), 'S');
      solo.title = 'Solo';
      solo.addEventListener('click', function () { App.toggleSolo(track.id); });
      head.appendChild(mute);
      head.appendChild(solo);
      row.appendChild(head);

      var gainWrap = mk('div', 'track-gain');
      var range = document.createElement('input');
      range.type = 'range';
      range.min = 0;
      range.max = 2;
      range.step = 0.01;
      range.value = track.gain;
      range.addEventListener('input', function () { App.setTrackGain(track.id, parseFloat(range.value)); });
      gainWrap.appendChild(mk('span', 'gain-label', 'Gain'));
      gainWrap.appendChild(range);
      row.appendChild(gainWrap);

      row.addEventListener('click', function () { App.selection.trackId = track.id; App.emit('change'); });
      list.appendChild(row);
    });
    void self;
  };

  UI.renderInspector = function () {
    var body = this.el.inspBody;
    if (!body) return;
    clear(body);
    var clip = App.selectedClip();
    var sel = App.selection;
    if (sel.active && sel.t1 > sel.t0) {
      body.appendChild(mk('div', 'info', 'Selection : ' + U.formatTime(sel.t0) + ' - ' + U.formatTime(sel.t1) + ' (' + U.formatTime(sel.t1 - sel.t0) + ')'));
    }
    if (!clip) {
      body.appendChild(mk('div', 'empty', 'Aucun clip selectionne (cliquez sur une forme d\'onde)'));
      return;
    }
    var self = this;
    var nameRow = mk('div', 'field');
    nameRow.appendChild(mk('label', 'field-label', 'Nom'));
    var nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'text';
    nameInp.value = clip.name;
    nameInp.addEventListener('change', function () { clip.name = nameInp.value; App.commit(); App.emit('change'); });
    nameRow.appendChild(nameInp);
    body.appendChild(nameRow);

    function numRow(label, value, step, onChange) {
      var row = mk('div', 'field');
      row.appendChild(mk('label', 'field-label', label));
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'num';
      inp.value = U.round(value, 2);
      inp.step = step;
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value);
        if (isFinite(v)) onChange(v);
      });
      row.appendChild(inp);
      return row;
    }

    body.appendChild(mk('div', 'section', 'Clip'));
    body.appendChild(numRow('Debut (s)', clip.start, 0.01, function (v) { App.selectClip(clip.id); clip.start = Math.max(0, v); App.commit(); App.emit('change'); }));
    body.appendChild(numRow('Duree (s)', clip.duration, 0.01, function (v) { clip.duration = Math.max(0.01, v); App.commit(); App.emit('change'); }));
    body.appendChild(numRow('Gain (dB)', U.gainToDb(clip.gain), 0.1, function (v) { App.setClipGain(U.dbToGain(v)); }));
    body.appendChild(numRow('Fondu entrant (s)', clip.fadeIn, 0.05, function (v) { App.setClipFade('in', v); }));
    body.appendChild(numRow('Fondu sortant (s)', clip.fadeOut, 0.05, function (v) { App.setClipFade('out', v); }));
    var asset = App.assetById(clip.assetId);
    var aRow = mk('div', 'field');
    aRow.appendChild(mk('label', 'field-label', 'Source'));
    aRow.appendChild(mk('span', 'field-static', asset ? asset.name : 'introuvable'));
    body.appendChild(aRow);
    void self;
  };

  void Track;
  void Project;
  void Clip;
  global.UI = UI;
})(window);

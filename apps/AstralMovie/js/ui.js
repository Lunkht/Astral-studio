(function (global) {
  'use strict';

  var App = global.App;
  var P = global.Project;
  var Clip = global.Clip;
  var Player = global.Player;
  var Renderer = global.Renderer;
  var Export = global.Export;
  var U = global.Utils;

  function $(id) { return document.getElementById(id); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function setVal(id, value, el) {
    var node = $(id);
    if (!node || document.activeElement === node) return;
    node.value = value;
  }

  var ROW_H = 30;

  var UI = {
    el: {},
    snap: true,

    init: function () {
      this.cache();
      this.wireMenus();
      this.wireActions();
      this.wireTransport();
      this.wireBin();
      this.wireInspector();
      this.wireTimelineToolbar();
      this.wireModal();
      this.cacheTimeline();

      App.on('change', function () { UI.render(); });
      App.on('time', function () { UI.updateTime(); });
      App.on('assets', function () { UI.renderAssets(); });
      App.on('playing', function () { UI.renderTransport(); });
      App.on('selection', function () { UI.renderInspector(); });
    },

    cache: function () {
      this.el = {
        docName: $('docName'),
        fpsVal: $('fpsVal'),
        timeVal: $('timeVal'),
        zoomVal: $('zoomVal'),
        tlZoomVal: $('tlZoomVal'),
        undoBtn: $('undoBtn'),
        redoBtn: $('redoBtn'),
        tlPlay: $('tlPlay'),
        assetList: $('assetList'),
        assetEmpty: $('assetEmpty'),
        fileInput: $('fileInput'),
        bin: $('bin'),
        dropHint: $('dropHint'),
        inspEmpty: $('inspEmpty'),
        inspBody: $('inspBody'),
        inspTitle: $('inspTitle'),
        insTrack: $('insTrack'),
        insStart: $('insStart'),
        insIn: $('insIn'),
        insOpacityNum: $('insOpacityNum'),
        statusLeft: $('statusLeft'),
        statusSeq: $('statusSeq'),
        statusClips: $('statusClips'),
        statusSel: $('statusSel'),
        statusTime: $('statusTime'),
        modal: $('modal'),
        modalTitle: $('modalTitle'),
        modalBody: $('modalBody'),
        modalClose: $('modalClose'),
        modalCancel: $('modalCancel'),
        modalOk: $('modalOk')
      };
    },

    cacheTimeline: function () {
      this.el.tlTrack = $('tlTrack');
      this.el.tlRuler = $('tlRuler');
      this.el.tlRows = $('tlRows');
      this.el.tlNames = $('tlNames');
      this.el.tlPlayhead = $('tlPlayhead');
    },

    /* ================= menus ================= */
    wireMenus: function () {
      var menus = document.querySelectorAll('[data-menu]');
      for (var i = 0; i < menus.length; i++) {
        (function (menu) {
          var title = menu.querySelector('.menu-title');
          if (!title) return;
          title.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = menu.classList.contains('open');
            UI.closeMenus();
            if (!open) menu.classList.add('open');
          });
        })(menus[i]);
      }
      document.addEventListener('click', function () { UI.closeMenus(); });
    },

    closeMenus: function () {
      var menus = document.querySelectorAll('[data-menu]');
      for (var i = 0; i < menus.length; i++) menus[i].classList.remove('open');
    },

    wireActions: function () {
      var actions = {
        'new': function () { App.newProject({}); UI.status('Nouvelle séquence'); },
        'import': function () { UI.openFileDialog(); },
        'export-video': function () {
          if (!Export.canRecord()) { UI.status('Export vidéo indisponible dans ce navigateur'); return; }
          UI.status('Export vidéo en cours…');
          Export.video(function (ok) { UI.status(ok ? 'Vidéo exportée (WebM)' : 'Échec de l\'export vidéo'); });
        },
        'export-png': function () { Export.framePNG(); UI.status('Image PNG exportée'); },
        'export-json': function () { Export.projectJSON(); UI.status('Projet exporté (JSON)'); },
        'undo': function () { App.undo(); },
        'redo': function () { App.redo(); },
        'duplicate': function () { App.duplicateSelection(); },
        'delete': function () { App.deleteSelection(); },
        'split': function () { if (App.splitAtPlayhead().length) UI.status('Clip divisé'); },
        'add-title': function () { App.addTitle('Titre'); },
        'add-vtrack': function () { P.addTrack(App.project, 'video'); App.commit('Nouvelle piste vidéo'); },
        'add-atrack': function () { P.addTrack(App.project, 'audio'); App.commit('Nouvelle piste audio'); },
        'zoom-in': function () { App.zoomBy(1.25); },
        'zoom-out': function () { App.zoomBy(0.8); },
        'fit': function () { App.setZoom(90); },
        'about': function () { UI.about(); }
      };
      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (!btn) return;
        var fn = actions[btn.getAttribute('data-action')];
        if (!fn) return;
        e.preventDefault();
        UI.closeMenus();
        fn();
      });
    },

    /* ================= transport ================= */
    wireTransport: function () {
      var bind = function (id, fn) { var n = $(id); if (n) n.addEventListener('click', fn); };
      bind('tlFirst', function () { App.goStart(); });
      bind('tlPrev', function () { App.stepFrame(-1); });
      bind('tlPlay', function () { App.togglePlay(); });
      bind('tlNext', function () { App.stepFrame(1); });
      bind('tlLast', function () { App.goEnd(); });
      bind('zoomIn', function () { App.zoomBy(1.25); });
      bind('zoomOut', function () { App.zoomBy(0.8); });

      if (this.el.fpsVal) {
        this.el.fpsVal.addEventListener('change', function () {
          var v = parseInt(this.value, 10);
          if (v > 0) { App.project.fps = v; App.emit('change'); }
        });
      }
      if (this.el.docName) {
        this.el.docName.addEventListener('input', function () { App.project.name = this.value; });
      }
    },

    renderTransport: function () {
      if (this.el.tlPlay) this.el.tlPlay.textContent = App.playing ? '\u2016' : '\u25B6';
      if (this.el.timeVal) this.el.timeVal.textContent = U.timecode(App.playhead, App.project.fps);
      if (this.el.statusTime) this.el.statusTime.textContent = U.timecode(App.playhead, App.project.fps);
      if (this.el.fpsVal && document.activeElement !== this.el.fpsVal) this.el.fpsVal.value = App.project.fps;
      if (this.el.docName && document.activeElement !== this.el.docName) this.el.docName.value = App.project.name;
      var z = Math.round(App.pxPerSec);
      if (this.el.zoomVal) this.el.zoomVal.textContent = z;
      if (this.el.tlZoomVal) this.el.tlZoomVal.textContent = z;
      if (this.el.undoBtn) this.el.undoBtn.disabled = !App.canUndo();
      if (this.el.redoBtn) this.el.redoBtn.disabled = !App.canRedo();
    },

    /* ================= media bin ================= */
    wireBin: function () {
      var open = function () { UI.openFileDialog(); };
      var b1 = $('importBtn'); if (b1) b1.addEventListener('click', open);
      var b2 = $('binImport'); if (b2) b2.addEventListener('click', open);
      var tb = $('titleBtn'); if (tb) tb.addEventListener('click', function () { App.addTitle('Titre'); });
      if (this.el.fileInput) {
        this.el.fileInput.addEventListener('change', function () {
          if (this.files && this.files.length) {
            App.importFiles(this.files).then(function () { UI.status('Médias importés'); });
          }
          this.value = '';
        });
      }
      var bin = this.el.bin;
      if (bin) {
        bin.addEventListener('dragover', function (e) { e.preventDefault(); bin.classList.add('dragover'); });
        bin.addEventListener('dragleave', function () { bin.classList.remove('dragover'); });
        bin.addEventListener('drop', function (e) {
          e.preventDefault();
          bin.classList.remove('dragover');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            App.importFiles(e.dataTransfer.files).then(function () { UI.status('Médias importés'); });
          }
        });
      }
    },

    openFileDialog: function () {
      if (this.el.fileInput) this.el.fileInput.click();
    },

    renderAssets: function () {
      var list = this.el.assetList;
      if (!list) return;
      if (this.el.assetEmpty) this.el.assetEmpty.style.display = App.assets.length ? 'none' : '';
      while (list.firstChild) list.removeChild(list.firstChild);
      for (var i = 0; i < App.assets.length; i++) {
        (function (asset) {
          var row = document.createElement('div');
          row.className = 'asset';
          var badge = document.createElement('span');
          badge.className = 'asset-badge k-' + asset.kind;
          badge.textContent = asset.kind === 'audio' ? 'A' : asset.kind === 'image' ? 'I' : 'V';
          var name = document.createElement('span');
          name.className = 'asset-name';
          name.textContent = asset.name;
          var meta = document.createElement('span');
          meta.className = 'asset-meta';
          meta.textContent = asset.duration ? U.formatClock(asset.duration) : '—';
          var ins = document.createElement('button');
          ins.className = 'asset-insert';
          ins.title = 'Insérer au playhead';
          ins.textContent = '+';
          ins.addEventListener('click', function (e) {
            e.stopPropagation();
            App.insertAsset(asset.id, App.activeTrackId, App.playhead);
            UI.status('Clip inséré');
          });
          var del = document.createElement('button');
          del.className = 'asset-del';
          del.title = 'Retirer';
          del.textContent = '\u00D7';
          del.addEventListener('click', function (e) {
            e.stopPropagation();
            UI.removeAsset(asset.id);
          });
          row.appendChild(badge);
          row.appendChild(name);
          row.appendChild(meta);
          row.appendChild(ins);
          row.appendChild(del);
          row.addEventListener('dblclick', function () { App.insertAsset(asset.id, App.activeTrackId, App.playhead); });
          list.appendChild(row);
        })(App.assets[i]);
      }
    },

    removeAsset: function (id) {
      for (var i = 0; i < App.assets.length; i++) {
        if (App.assets[i].id === id) {
          global.Asset.revoke(App.assets[i]);
          App.assets.splice(i, 1);
          App.emit('assets');
          App.emit('change');
          return;
        }
      }
    },

    /* ================= inspector ================= */
    wireInspector: function () {
      var self = this;
      var field = function (id, apply, liveCommit) {
        var n = $(id);
        if (!n) return;
        n.addEventListener('input', function () {
          var clips = App.selectedClips();
          if (!clips.length) return;
          for (var i = 0; i < clips.length; i++) apply(clips[i], n);
          Renderer.draw();
        });
        n.addEventListener('change', function () {
          var clips = App.selectedClips();
          if (!clips.length) return;
          for (var i = 0; i < clips.length; i++) apply(clips[i], n);
          App.commit('Propriétés');
        });
      };
      field('insName', function (c, n) { c.name = n.value; });
      field('insSpeed', function (c, n) { c.speed = Math.max(0.1, parseFloat(n.value) || 1); });
      field('insDuration', function (c, n) {
        var d = Math.max(0.04, parseFloat(n.value) || c.duration);
        var limit = Clip.maxDuration(c);
        c.duration = Math.min(d, limit === Infinity ? d : limit);
      });
      field('insOpacity', function (c, n) { c.opacity = U.clamp((parseFloat(n.value) || 0) / 100, 0, 1); });
      field('insText', function (c, n) { c.text = n.value; });
      field('insColor', function (c, n) { c.color = n.value; });
      field('insFontSize', function (c, n) { c.fontSize = Math.max(8, parseInt(n.value, 10) || 64); });

      if (this.el.insTrack) {
        this.el.insTrack.addEventListener('change', function () {
          var clips = App.selectedClips();
          if (!clips.length) return;
          var track = P.trackById(App.project, this.value);
          if (!track) return;
          for (var i = 0; i < clips.length; i++) clips[i].track = track.id;
          App.setActiveTrack(track.id);
          App.commit('Changer de piste');
        });
      }
      var sp = $('insSplit'); if (sp) sp.addEventListener('click', function () { App.splitAtPlayhead(); });
      var dl = $('insDelete'); if (dl) dl.addEventListener('click', function () { App.deleteSelection(); });
    },

    renderInspector: function () {
      var clips = App.selectedClips();
      if (this.el.inspEmpty) this.el.inspEmpty.style.display = clips.length ? 'none' : '';
      if (this.el.inspBody) this.el.inspBody.style.display = clips.length ? '' : 'none';
      if (!clips.length) return;
      var c = clips[0];
      setVal('insName', c.name);
      setVal('insSpeed', r2(c.speed));
      setVal('insDuration', r2(c.duration));
      if (this.el.insStart) this.el.insStart.textContent = U.timecode(c.start, App.project.fps);
      if (this.el.insIn) this.el.insIn.textContent = U.timecode(c.inPoint, App.project.fps);
      var op = $('insOpacity');
      if (op && document.activeElement !== op) op.value = Math.round(c.opacity * 100);
      if (this.el.insOpacityNum) this.el.insOpacityNum.textContent = Math.round(c.opacity * 100) + '%';
      if (this.el.inspTitle) this.el.inspTitle.style.display = c.type === 'title' ? '' : 'none';
      if (c.type === 'title') {
        setVal('insText', c.text);
        setVal('insColor', c.color);
        setVal('insFontSize', c.fontSize);
      }
      this.renderTrackSelect(c);
    },

    renderTrackSelect: function (clip) {
      var sel = this.el.insTrack;
      if (!sel) return;
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var kind = clip.type === 'audio' ? 'audio' : 'video';
      var tracks = kind === 'audio' ? P.audioTracks(App.project) : P.videoTracks(App.project);
      for (var i = 0; i < tracks.length; i++) {
        var opt = document.createElement('option');
        opt.value = tracks[i].id;
        opt.textContent = tracks[i].name;
        sel.appendChild(opt);
      }
      sel.value = clip.track;
    },

    /* ================= timeline toolbar ================= */
    wireTimelineToolbar: function () {
      var a = $('tlZoomIn'); if (a) a.addEventListener('click', function () { App.zoomBy(1.25); });
      var b = $('tlZoomOut'); if (b) b.addEventListener('click', function () { App.zoomBy(0.8); });
      var c = $('tlAddV'); if (c) c.addEventListener('click', function () { P.addTrack(App.project, 'video'); App.commit('Nouvelle piste vidéo'); });
      var d = $('tlAddA'); if (d) d.addEventListener('click', function () { P.addTrack(App.project, 'audio'); App.commit('Nouvelle piste audio'); });
      var s = $('snapChk'); if (s) s.addEventListener('change', function () { UI.snap = this.checked; });
    },

    /* ================= timeline ================= */
    renderTimeline: function () {
      var track = this.el.tlTrack;
      if (!track) return;
      var px = App.pxPerSec;
      var length = App.timelineLength();
      var width = Math.max(length * px + 80, track.clientWidth || 600);

      if (this.el.tlRuler) this.el.tlRuler.style.width = width + 'px';
      if (this.el.tlRows) this.el.tlRows.style.width = width + 'px';

      this.renderRuler(width, px);
      this.renderRows(width, px);
      this.renderNames();
      this.positionPlayhead();
    },

    renderRuler: function (width, px) {
      var ruler = this.el.tlRuler;
      if (!ruler) return;
      while (ruler.firstChild) ruler.removeChild(ruler.firstChild);
      var step = this.niceStep(px);
      var length = width / px;
      for (var t = 0; t <= length + 0.001; t += step) {
        var tick = document.createElement('div');
        tick.className = 'tl-tick';
        tick.style.left = (t * px) + 'px';
        var label = document.createElement('span');
        label.className = 'tl-tick-label';
        label.textContent = U.formatClock(t);
        tick.appendChild(label);
        ruler.appendChild(tick);
      }
      ruler.addEventListener('pointerdown', UI.startScrub);
    },

    niceStep: function (px) {
      var candidates = [0.25, 0.5, 1, 2, 5, 10, 15, 20, 30, 60];
      for (var i = 0; i < candidates.length; i++) if (candidates[i] * px >= 64) return candidates[i];
      return 120;
    },

    renderRows: function (width, px) {
      var rows = this.el.tlRows;
      if (!rows) return;
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      for (var i = 0; i < App.project.tracks.length; i++) {
        var track = App.project.tracks[i];
        var row = document.createElement('div');
        row.className = 'tl-row' + (track.locked ? ' locked' : '');
        row.setAttribute('data-track', track.id);
        row.style.height = ROW_H + 'px';
        row.style.width = width + 'px';
        row.addEventListener('pointerdown', UI.startScrub);

        var clips = P.clipsOnTrack(App.project, track.id);
        for (var j = 0; j < clips.length; j++) row.appendChild(this.makeClipEl(clips[j], px));
        rows.appendChild(row);
      }
    },

    makeClipEl: function (clip, px) {
      var bar = document.createElement('div');
      bar.className = 'tl-clip' + (App.selection[clip.id] ? ' selected' : '') + ' type-' + clip.type;
      bar.setAttribute('data-clip', clip.id);
      bar.style.left = (clip.start * px) + 'px';
      bar.style.width = Math.max(6, clip.duration * px) + 'px';
      var label = document.createElement('span');
      label.className = 'tl-clip-label';
      label.textContent = clip.name;
      var hl = document.createElement('div');
      hl.className = 'tl-handle left';
      var hr = document.createElement('div');
      hr.className = 'tl-handle right';
      bar.appendChild(hl);
      bar.appendChild(label);
      bar.appendChild(hr);
      bar.addEventListener('pointerdown', function (e) { UI.clipDown(e, clip); });
      return bar;
    },

    positionClipEl: function (bar, clip) {
      bar.style.left = (clip.start * App.pxPerSec) + 'px';
      bar.style.width = Math.max(6, clip.duration * App.pxPerSec) + 'px';
    },

    renderNames: function () {
      var names = this.el.tlNames;
      if (!names) return;
      while (names.firstChild) names.removeChild(names.firstChild);
      for (var i = 0; i < App.project.tracks.length; i++) {
        (function (track) {
          var row = document.createElement('div');
          row.className = 'tl-name' + (App.activeTrackId === track.id ? ' active' : '') + (track.kind === 'audio' ? ' audio' : '');
          row.style.height = ROW_H + 'px';
          var label = document.createElement('span');
          label.className = 'tl-name-label';
          label.textContent = track.name;
          var mute = document.createElement('button');
          mute.className = 'tl-nico' + (track.muted ? ' on' : '');
          mute.title = 'Muet';
          mute.textContent = track.kind === 'audio' ? '\u266A' : '\u25CB';
          mute.addEventListener('click', function (e) {
            e.stopPropagation();
            track.muted = !track.muted;
            App.commit(track.muted ? 'Muet' : 'Son');
          });
          var lock = document.createElement('button');
          lock.className = 'tl-nico' + (track.locked ? ' on' : '');
          lock.title = 'Verrouiller';
          lock.textContent = track.locked ? '\u{1F512}' : '\u{1F513}';
          lock.addEventListener('click', function (e) {
            e.stopPropagation();
            track.locked = !track.locked;
            App.commit(track.locked ? 'Verrouillé' : 'Déverrouillé');
          });
          row.appendChild(label);
          row.appendChild(mute);
          row.appendChild(lock);
          row.addEventListener('click', function () { App.setActiveTrack(track.id); });
          names.appendChild(row);
        })(App.project.tracks[i]);
      }
    },

    positionPlayhead: function () {
      if (this.el.tlPlayhead) this.el.tlPlayhead.style.left = (App.playhead * App.pxPerSec) + 'px';
    },

    /* ================= timeline interaction ================= */
    xToTime: function (clientX) {
      var track = this.el.tlTrack;
      var r = track.getBoundingClientRect();
      return Math.max(0, (clientX - r.left + track.scrollLeft) / App.pxPerSec);
    },

    startScrub: function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('tl-clip')) return;
      App.clearSelection();
      UI.scrubTo(e);
      var mv = function (ev) { UI.scrubTo(ev); };
      var up = function () {
        global.removeEventListener('pointermove', mv);
        global.removeEventListener('pointerup', up);
      };
      global.addEventListener('pointermove', mv);
      global.addEventListener('pointerup', up);
    },

    scrubTo: function (e) {
      App.setPlayhead(UI.xToTime(e.clientX));
      Player.seekMedia(App.playhead);
    },

    clipDown: function (e, clip) {
      e.stopPropagation();
      if (e.shiftKey) App.toggleSelect(clip.id);
      else App.select(clip.id);
      var bar = e.currentTarget;
      var mode = 'move';
      if (e.target && e.target.classList) {
        if (e.target.classList.contains('tl-handle')) {
          mode = e.target.classList.contains('left') ? 'start' : 'end';
        }
      }
      var track = P.trackById(App.project, clip.track);
      if (track && track.locked) return;

      var startX = e.clientX;
      var origStart = clip.start;
      var origDur = clip.duration;
      var mv = function (ev) {
        var dx = (ev.clientX - startX) / App.pxPerSec;
        if (mode === 'move') {
          var ns = Math.max(0, origStart + dx);
          clip.start = UI.applySnap(ns, clip);
        } else if (mode === 'start') {
          P.trimClip(App.project, clip.id, 'start', UI.applySnap(origStart + dx, clip));
        } else {
          P.trimClip(App.project, clip.id, 'end', UI.applySnap(origStart + origDur + dx, clip));
        }
        UI.positionClipEl(bar, clip);
      };
      var up = function () {
        global.removeEventListener('pointermove', mv);
        global.removeEventListener('pointerup', up);
        App.commit('Édition du clip');
      };
      global.addEventListener('pointermove', mv);
      global.addEventListener('pointerup', up);
    },

    applySnap: function (time, excludeClip) {
      if (!UI.snap) return time;
      var targets = [0, App.playhead];
      for (var i = 0; i < App.project.clips.length; i++) {
        var c = App.project.clips[i];
        if (c === excludeClip) continue;
        targets.push(c.start, Clip.end(c));
      }
      return U.snap(time, targets, 8 / App.pxPerSec);
    },

    /* ================= status / about ================= */
    renderStatus: function () {
      var n = App.project.clips.length;
      if (this.el.statusSeq) this.el.statusSeq.textContent = App.project.name + ' · ' + App.project.width + '×' + App.project.height + ' · ' + App.project.fps + ' i/s';
      if (this.el.statusClips) this.el.statusClips.textContent = n + (n > 1 ? ' clips' : ' clip');
      var sel = App.selectedIds().length;
      if (this.el.statusSel) this.el.statusSel.textContent = sel ? sel + ' sélectionné' + (sel > 1 ? 's' : '') : 'aucune sélection';
    },

    status: function (msg) {
      if (this.el.statusLeft) this.el.statusLeft.textContent = msg;
    },

    about: function () {
      if (!this.el.modal) return;
      this.el.modalTitle.textContent = 'À propos d\'AstralMovie';
      this.el.modalBody.innerHTML = '<p><b>AstralMovie</b> — montage vidéo léger, 100 % Canvas 2D.</p>' +
        '<p>Importez des vidéos, images et sons (API navigateur), disposez-les sur des pistes, rognez et divisez les clips, puis lisez la séquence dans le moniteur programme.</p>' +
        '<p>Ajoutez des titres, exportez l\'image courante en PNG, le projet en JSON, ou toute la séquence en vidéo WebM via <code>MediaRecorder</code>.</p>';
      if (this.el.modalOk) this.el.modalOk.style.display = 'none';
      if (this.el.modalCancel) this.el.modalCancel.textContent = 'Fermer';
      this.el.modal.classList.add('open');
    },

    /* ================= render ================= */
    render: function () {
      if (!App.project) return;
      this.renderTransport();
      this.renderAssets();
      this.renderInspector();
      this.renderTimeline();
      this.renderStatus();
      Renderer.draw();
    },

    updateTime: function () {
      if (!App.project) return;
      if (this.el.timeVal) this.el.timeVal.textContent = U.timecode(App.playhead, App.project.fps);
      if (this.el.statusTime) this.el.statusTime.textContent = U.timecode(App.playhead, App.project.fps);
      this.positionPlayhead();
      Renderer.draw();
    },

    wireModal: function () {
      var self = this;
      function hide() { if (self.el.modal) self.el.modal.classList.remove('open'); }
      if (this.el.modalClose) this.el.modalClose.addEventListener('click', hide);
      if (this.el.modalCancel) this.el.modalCancel.addEventListener('click', hide);
      if (this.el.modalOk) this.el.modalOk.addEventListener('click', hide);
      if (this.el.modal) this.el.modal.addEventListener('click', function (e) { if (e.target === self.el.modal) hide(); });
    }
  };

  global.UI = UI;
})(window);

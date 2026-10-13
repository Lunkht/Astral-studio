(function (global) {
  'use strict';

  var U = global.Utils;
  var K = global.Keyframe;
  var App = global.App;
  var Comp = global.Comp;
  var Layer = global.Layer;
  var Effects = global.Effects;
  var Player = global.Player;
  var Export = global.Export;

  var TRANSFORM_PROPS = [
    { key: 'x', label: 'Position X' },
    { key: 'y', label: 'Position Y' },
    { key: 'scale', label: 'Echelle' },
    { key: 'rotation', label: 'Rotation' },
    { key: 'opacity', label: 'Opacite' }
  ];

  var UI = {
    el: {},
    expanded: {},
    _numRefs: [],
    _menuName: null
  };

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function clear(e) {
    if (!e) return;
    e.innerHTML = '';
  }

  UI.cache = function () {
    var ids = ['compCanvas', 'tlRuler', 'tlRows', 'tlPlayhead', 'layersBody', 'inspectorBody', 'mediaInput',
      'btnPrev', 'btnPlay', 'btnNext', 'btnStart', 'btnEnd', 'btnZoomIn', 'btnZoomOut', 'btnZoomFit',
      'btnAutoKey', 'timeVal', 'zoomVal', 'fpsVal', 'statusText', 'statusRight', 'tlInfo', 'helpLayer', 'menuPop',
      'btnAddSolid', 'btnAddText', 'btnAddShape', 'btnAddMedia'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
  };

  UI.status = function (msg) {
    if (this.el.statusText) this.el.statusText.textContent = msg;
  };

  UI.timeText = function () {
    var c = App.comp;
    return c ? U.timecode(App.time, c.fps) : '00:00:00:00';
  };

  UI.init = function () {
    this.cache();
    this.wireMenus();
    this.wireControls();
    this.wireRail();
    this.wireInspector();
    this.wireTimeline();
    var self = this;
    App.on('change', function () { self.render(); });
    App.on('time', function () { self.syncDynamic(); });
    App.on('playing', function () { self.syncPlaying(); });
    this.render();
    return this;
  };

  /* ---------- menus ---------- */

  function menus() {
    return {
      file: [
        { label: 'Nouvelle composition', action: function () { App.newComp(); UI.status('Nouvelle composition'); } },
        { label: 'Importer un media...', action: function () { if (UI.el.mediaInput) UI.el.mediaInput.click(); } },
        { sep: true },
        { label: 'Exporter l\'image (PNG)', action: function () { Export.framePNG({ download: true }); UI.status('Image exportee'); } },
        { label: 'Exporter le projet (JSON)', action: function () { Export.projectJSON({ download: true }); UI.status('Projet exporte'); } },
        { label: 'Exporter la video (WebM)', action: function () {
          if (!Export.canRecord()) { UI.status('MediaRecorder indisponible'); return; }
          UI.status('Rendu video...');
          Export.video({ onProgress: function (p) { UI.status('Rendu ' + Math.round(p * 100) + '%'); }, onDone: function () { UI.status('Video exportee'); } });
        } }
      ],
      edit: [
        { label: 'Annuler', action: function () { App.undo(); } },
        { label: 'Retablir', action: function () { App.redo(); } },
        { sep: true },
        { label: 'Dupliquer', action: function () { App.duplicateSelected(); } },
        { label: 'Supprimer', action: function () { App.removeSelected(); } },
        { label: 'Tout selectionner', action: function () { App.selectAll(); } }
      ],
      layer: [
        { label: 'Nouveau solide', action: function () { App.addSolid(); } },
        { label: 'Nouveau texte', action: function () { App.addText(); } },
        { label: 'Nouvelle forme (ellipse)', action: function () { App.addShape({ kind: 'ellipse' }); } },
        { label: 'Nouvelle forme (rectangle)', action: function () { App.addShape({ kind: 'rect' }); } },
        { label: 'Nouvelle etoile', action: function () { App.addShape({ kind: 'star' }); } },
        { sep: true },
        { label: 'Ajouter un effet (Flou)', action: function () { App.addEffectToSelection('blur'); } },
        { label: 'Monter', action: function () { App.moveSelected(1); } },
        { label: 'Descendre', action: function () { App.moveSelected(-1); } }
      ],
      view: [
        { label: 'Ajuster', action: function () { App.setCamera(0, 0, 1); } },
        { label: 'Zoom avant', action: function () { App.zoomBy(1.25); } },
        { label: 'Zoom arriere', action: function () { App.zoomBy(0.8); } }
      ],
      help: [
        { label: 'Raccourcis clavier', action: function () { UI.toggleHelp(); } }
      ]
    };
  }

  UI.wireMenus = function () {
    var btns = document.querySelectorAll('[data-menu]');
    var self = this;
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          self.openMenu(btn.getAttribute('data-menu'), btn);
        });
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
    var items = menus()[name] || [];
    items.forEach(function (it) {
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
    if (!this.el.helpLayer) return;
    this.el.helpLayer.hidden = !this.el.helpLayer.hidden;
  };

  /* ---------- controls ---------- */

  UI.wireControls = function () {
    var self = this;
    var el = this.el;
    function on(e, fn) { if (e) e.addEventListener('click', fn); }
    on(el.btnPrev, function () { App.stepFrame(-1); });
    on(el.btnNext, function () { App.stepFrame(1); });
    on(el.btnStart, function () { App.goStart(); });
    on(el.btnEnd, function () { App.goEnd(); });
    on(el.btnPlay, function () { Player.toggle(); });
    on(el.btnZoomIn, function () { App.zoomBy(1.25); });
    on(el.btnZoomOut, function () { App.zoomBy(0.8); });
    on(el.btnZoomFit, function () { App.setCamera(0, 0, 1); });
    on(el.btnAutoKey, function () { App.autoKey = !App.autoKey; App.emit('change'); });
    if (el.fpsVal) {
      el.fpsVal.addEventListener('change', function () {
        var v = parseInt(el.fpsVal.value, 10);
        if (v >= 1 && v <= 120) { App.comp.fps = v; App.emit('change'); }
      });
    }
  };

  UI.wireRail = function () {
    var btns = document.querySelectorAll('[data-tool]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          App.tool = btn.getAttribute('data-tool');
          App.emit('change');
        });
      })(btns[i]);
    }
  };

  UI.wireInspector = function () {
    var self = this;
    if (this.el.btnAddMedia && this.el.mediaInput) {
      this.el.btnAddMedia.addEventListener('click', function () { self.el.mediaInput.click(); });
    }
    if (this.el.mediaInput) {
      this.el.mediaInput.addEventListener('change', function () {
        var files = self.el.mediaInput.files || [];
        for (var i = 0; i < files.length; i++) {
          App.importFile(files[i], function (asset) { App.addMediaLayer(asset.id); });
        }
      });
    }
    var add = function (id, fn) { if (self.el[id]) self.el[id].addEventListener('click', fn); };
    add('btnAddSolid', function () { App.addSolid(); });
    add('btnAddText', function () { App.addText(); });
    add('btnAddShape', function () { App.addShape({ kind: 'ellipse' }); });
  };

  UI.wireTimeline = function () {
    var self = this;
    if (this.el.tlRuler) {
      this.el.tlRuler.addEventListener('click', function (e) {
        var t = timeFromEvent(e, self.el.tlRuler, App.comp ? App.comp.duration : 0);
        App.setTime(t);
      });
    }
  };

  /* ---------- helpers ---------- */

  function timeFromEvent(e, el, duration) {
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var w = rect ? rect.width : (el.clientWidth || 1);
    var x = rect ? (e.clientX - rect.left) : (e.offsetX || 0);
    if (!w) w = 1;
    return U.clamp((x / w) * duration, 0, duration);
  }

  function pct(t) {
    var c = App.comp;
    if (!c || !c.duration) return 0;
    return U.round(U.clamp(t / c.duration, 0, 1) * 100, 3);
  }

  function numberInput(value, min, max, step, onChange) {
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'num';
    inp.value = U.round(value, 2);
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    inp.step = step == null ? 1 : step;
    inp.addEventListener('change', function () {
      var v = parseFloat(inp.value);
      if (isFinite(v)) onChange(v);
    });
    return inp;
  }

  function keyButton(prop, onClick) {
    var has = K.keyAt(prop, App.time);
    var b = document.createElement('button');
    b.className = 'key-btn' + (has ? ' on' : '');
    b.title = 'Image cle a la position courante';
    b.textContent = prop.keys.length ? '\u25C6 ' + prop.keys.length : '\u25C7';
    b.addEventListener('click', onClick);
    return b;
  }

  UI.edit = function (fn) {
    fn();
    App.commit();
    App.emit('change');
  };

  /* ---------- render ---------- */

  UI.render = function () {
    this._numRefs = [];
    this.syncDynamic();
    this.syncPlaying();
    this.renderLayers();
    this.renderInspector();
    this.renderTimeline();
  };

  UI.syncDynamic = function () {
    var el = this.el;
    if (el.timeVal) el.timeVal.textContent = this.timeText();
    if (el.zoomVal) el.zoomVal.textContent = Math.round(App.camera.zoom * 100) + '%';
    if (el.fpsVal && App.comp && document.activeElement !== el.fpsVal) el.fpsVal.value = App.comp.fps;
    if (el.tlPlayhead && App.comp) el.tlPlayhead.style.left = pct(App.time) + '%';
    if (el.tlInfo && App.comp) el.tlInfo.textContent = U.round(App.comp.duration, 2) + ' s';
    if (el.statusRight && App.comp) {
      el.statusRight.textContent = App.comp.name + '  ' + App.comp.width + 'x' + App.comp.height + ' @ ' + App.comp.fps + ' i/s';
    }
    for (var i = 0; i < this._numRefs.length; i++) {
      var ref = this._numRefs[i];
      if (document.activeElement !== ref.el) ref.el.value = U.round(ref.get(), 2);
    }
  };

  UI.syncPlaying = function () {
    if (this.el.btnPlay) this.el.btnPlay.textContent = App.playing ? 'Pause' : 'Lecture';
  };

  UI.renderLayers = function () {
    var body = this.el.layersBody;
    if (!body || !App.comp) return;
    clear(body);
    var self = this;
    var layers = Comp.topDown(App.comp);
    layers.forEach(function (layer, i) {
      var row = mk('div', 'layer-row' + (App.isSelected(layer.id) ? ' sel' : ''));
      var idx = mk('span', 'layer-index', String(Comp.topDown(App.comp).length - i));
      var vis = mk('button', 'layer-dot' + (layer.visible ? ' on' : ''), layer.visible ? '\u25C9' : '\u25CB');
      vis.title = 'Visibilite';
      vis.addEventListener('click', function (e) { e.stopPropagation(); App.toggleVisibility(layer.id); });
      var lock = mk('button', 'layer-dot' + (layer.locked ? ' on' : ''), layer.locked ? '\u25A0' : '\u25A1');
      lock.title = 'Verrouillage';
      lock.addEventListener('click', function (e) { e.stopPropagation(); App.toggleLocked(layer.id); });
      var label = mk('span', 'layer-name', layer.name);

      row.appendChild(idx);
      row.appendChild(vis);
      row.appendChild(lock);
      row.appendChild(label);
      row.addEventListener('click', function () { App.select(layer.id); });
      body.appendChild(row);
    });
  };

  UI.renderInspector = function () {
    var body = this.el.inspectorBody;
    if (!body) return;
    clear(body);
    var layer = App.firstSelected();
    if (!layer) {
      body.appendChild(mk('div', 'empty', App.selection.length > 1 ? App.selection.length + ' calques selectionnes' : 'Aucun calque selectionne'));
      return;
    }
    var self = this;

    var nameRow = mk('div', 'field');
    nameRow.appendChild(mk('label', 'field-label', 'Nom'));
    var nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'text';
    nameInp.value = layer.name;
    nameInp.addEventListener('change', function () { self.edit(function () { layer.name = nameInp.value; }); });
    nameRow.appendChild(nameInp);
    body.appendChild(nameRow);

    var typeRow = mk('div', 'field');
    typeRow.appendChild(mk('label', 'field-label', 'Type'));
    typeRow.appendChild(mk('span', 'field-static', layer.type));
    body.appendChild(typeRow);

    var blendRow = mk('div', 'field');
    blendRow.appendChild(mk('label', 'field-label', 'Fusion'));
    var blendSel = document.createElement('select');
    blendSel.className = 'select';
    ['normal', 'multiply', 'screen', 'overlay', 'lighter', 'difference'].forEach(function (b) {
      var o = document.createElement('option');
      o.value = b;
      o.textContent = b;
      if (layer.blend === b) o.selected = true;
      blendSel.appendChild(o);
    });
    blendSel.addEventListener('change', function () { self.edit(function () { layer.blend = blendSel.value; }); });
    blendRow.appendChild(blendSel);
    body.appendChild(blendRow);

    body.appendChild(mk('div', 'section', 'Transformation'));
    TRANSFORM_PROPS.forEach(function (tp) {
      var prop = layer.transform[tp.key];
      var row = mk('div', 'field');
      row.appendChild(mk('label', 'field-label', tp.label));
      var inp = numberInput(K.valueAt(prop, App.time), tp.key === 'scale' || tp.key === 'opacity' ? 0 : null, null, tp.key === 'rotation' ? 1 : 0.5, function (v) {
        App.setTransform(layer.id, tp.key, v);
      });
      self._numRefs.push({ el: inp, get: function () { return K.valueAt(prop, App.time); } });
      row.appendChild(inp);
      row.appendChild(keyButton(prop, function () { App.toggleTransformKey(layer.id, tp.key); }));
      body.appendChild(row);
    });

    self.renderContent(body, layer);
    self.renderEffects(body, layer);
  };

  UI.renderContent = function (body, layer) {
    var self = this;
    body.appendChild(mk('div', 'section', 'Contenu'));
    if (layer.type === 'solid' || layer.type === 'shape') {
      var colorRow = mk('div', 'field');
      colorRow.appendChild(mk('label', 'field-label', 'Couleur'));
      var color = document.createElement('input');
      color.type = 'color';
      color.className = 'color';
      color.value = layer.color;
      color.addEventListener('change', function () { self.edit(function () { layer.color = color.value; }); });
      colorRow.appendChild(color);
      body.appendChild(colorRow);

      if (layer.type === 'shape') {
        var kindRow = mk('div', 'field');
        kindRow.appendChild(mk('label', 'field-label', 'Forme'));
        var sel = document.createElement('select');
        sel.className = 'select';
        [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['star', 'Etoile']].forEach(function (k) {
          var o = document.createElement('option');
          o.value = k[0];
          o.textContent = k[1];
          if (layer.shape.kind === k[0]) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () { self.edit(function () { layer.shape.kind = sel.value; }); });
        kindRow.appendChild(sel);
        body.appendChild(kindRow);
      }

      [['w', 'Largeur'], ['h', 'Hauteur']].forEach(function (d) {
        var row = mk('div', 'field');
        row.appendChild(mk('label', 'field-label', d[1]));
        row.appendChild(numberInput(layer.shape[d[0]], 1, null, 1, function (v) {
          self.edit(function () { layer.shape[d[0]] = v; });
        }));
        body.appendChild(row);
      });

      if (layer.shape.kind === 'rect') {
        var rr = mk('div', 'field');
        rr.appendChild(mk('label', 'field-label', 'Arrondi'));
        rr.appendChild(numberInput(layer.shape.radius, 0, null, 1, function (v) {
          self.edit(function () { layer.shape.radius = v; });
        }));
        body.appendChild(rr);
      }
      if (layer.shape.kind === 'star') {
        var pr = mk('div', 'field');
        pr.appendChild(mk('label', 'field-label', 'Pointes'));
        pr.appendChild(numberInput(layer.shape.points, 3, 20, 1, function (v) {
          self.edit(function () { layer.shape.points = v; });
        }));
        body.appendChild(pr);
      }
    } else if (layer.type === 'text') {
      var tr = mk('div', 'field');
      tr.appendChild(mk('label', 'field-label', 'Texte'));
      var ta = document.createElement('textarea');
      ta.className = 'text';
      ta.value = layer.text;
      ta.addEventListener('change', function () { self.edit(function () { layer.text = ta.value; }); });
      tr.appendChild(ta);
      body.appendChild(tr);

      var fr = mk('div', 'field');
      fr.appendChild(mk('label', 'field-label', 'Taille'));
      fr.appendChild(numberInput(layer.fontSize, 4, null, 1, function (v) {
        self.edit(function () { layer.fontSize = v; });
      }));
      body.appendChild(fr);

      var cr = mk('div', 'field');
      cr.appendChild(mk('label', 'field-label', 'Couleur'));
      var tc = document.createElement('input');
      tc.type = 'color';
      tc.className = 'color';
      tc.value = layer.color;
      tc.addEventListener('change', function () { self.edit(function () { layer.color = tc.value; }); });
      cr.appendChild(tc);
      body.appendChild(cr);
    } else {
      var a = App.assets.byId[layer.assetId];
      var ir = mk('div', 'field');
      ir.appendChild(mk('label', 'field-label', 'Media'));
      ir.appendChild(mk('span', 'field-static', a ? a.name : 'introuvable'));
      body.appendChild(ir);
    }
  };

  UI.renderEffects = function (body, layer) {
    var self = this;
    body.appendChild(mk('div', 'section', 'Effets'));

    var addRow = mk('div', 'field');
    var sel = document.createElement('select');
    sel.className = 'select';
    Effects.list().forEach(function (fx) {
      var o = document.createElement('option');
      o.value = fx.type;
      o.textContent = fx.name;
      sel.appendChild(o);
    });
    var addBtn = mk('button', 'btn', 'Ajouter');
    addBtn.addEventListener('click', function () { App.addEffectToSelection(sel.value); });
    addRow.appendChild(sel);
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    layer.effects.forEach(function (fx) {
      var head = mk('div', 'fx-head');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = fx.enabled;
      chk.title = 'Activer / desactiver';
      chk.addEventListener('change', function () { App.toggleEffectEnabled(layer.id, fx.id); });
      head.appendChild(chk);
      var def = Effects.def(fx.type);
      head.appendChild(mk('span', 'fx-name', def ? def.name : fx.type));
      var del = mk('button', 'fx-del', '\u00D7');
      del.title = 'Supprimer';
      del.addEventListener('click', function () { App.removeEffect(layer.id, fx.id); });
      head.appendChild(del);
      body.appendChild(head);

      var d = Effects.def(fx.type) || { params: {} };
      for (var key in fx.params) {
        if (!Object.prototype.hasOwnProperty.call(fx.params, key)) continue;
        var pr = mk('div', 'field');
        var pd = d.params[key] || {};
        pr.appendChild(mk('label', 'field-label', pd.label || key));
        var prop = fx.params[key];
        var inp = numberInput(K.valueAt(prop, App.time), pd.min, pd.max, pd.step, function (v) {
          App.setEffectParam(layer.id, fx.id, key, v);
        });
        self._numRefs.push({ el: inp, get: function () { return K.valueAt(prop, App.time); } });
        pr.appendChild(inp);
        pr.appendChild(keyButton(prop, function () { App.toggleEffectKey(layer.id, fx.id, key); }));
        body.appendChild(pr);
      }
    });
  };

  UI.renderTimeline = function () {
    var rows = this.el.tlRows;
    if (!rows || !App.comp) return;
    clear(rows);
    this.renderRuler();
    var self = this;
    var layers = Comp.topDown(App.comp);
    var total = layers.length;

    layers.forEach(function (layer, i) {
      var row = mk('div', 'tl-row' + (App.isSelected(layer.id) ? ' sel' : ''));
      var name = mk('div', 'tl-name');
      var disc = mk('button', 'tl-disc', self.expanded[layer.id] ? '\u25BE' : '\u25B8');
      disc.addEventListener('click', function (e) {
        e.stopPropagation();
        self.expanded[layer.id] = !self.expanded[layer.id];
        self.renderTimeline();
      });
      name.appendChild(disc);
      name.appendChild(mk('span', 'tl-index', String(total - i)));
      name.appendChild(mk('span', 'tl-label', layer.name));
      name.addEventListener('click', function () { App.select(layer.id); });
      var track = mk('div', 'tl-track');
      var bar = mk('div', 'tl-bar');
      track.appendChild(bar);
      track.addEventListener('click', function (e) {
        App.select(layer.id);
        App.setTime(timeFromEvent(e, track, App.comp.duration));
      });
      row.appendChild(name);
      row.appendChild(track);
      rows.appendChild(row);

      if (self.expanded[layer.id]) {
        TRANSFORM_PROPS.forEach(function (tp) { self.appendPropRow(rows, layer, layer.transform[tp.key], tp.label, function () { App.toggleTransformKey(layer.id, tp.key); }); });
        layer.effects.forEach(function (fx) {
          var d = Effects.def(fx.type) || { params: {} };
          for (var key in fx.params) {
            if (!Object.prototype.hasOwnProperty.call(fx.params, key)) continue;
            var pd = d.params[key] || {};
            (function (kk) {
              self.appendPropRow(rows, layer, fx.params[kk], (d.name || fx.type) + ' / ' + (pd.label || kk), function () { App.toggleEffectKey(layer.id, fx.id, kk); });
            })(key);
          }
        });
      }
    });
  };

  UI.appendPropRow = function (rows, layer, prop, label, toggle) {
    var self = this;
    var row = mk('div', 'tl-subrow');
    var name = mk('div', 'tl-name sub');
    name.appendChild(mk('span', 'tl-label', label));
    var track = mk('div', 'tl-track sub');
    track.addEventListener('click', function (e) {
      var t = timeFromEvent(e, track, App.comp.duration);
      var nearest = null, best = 0.14;
      prop.keys.forEach(function (k2) {
        var d = Math.abs(k2.t - t);
        if (d < best) { best = d; nearest = k2; }
      });
      if (nearest) K.removeKey(prop, nearest.t);
      else K.setKey(prop, t, K.valueAt(prop, t));
      App.commit();
      App.emit('change');
    });
    prop.keys.forEach(function (k2) {
      var d = mk('div', 'tl-key' + (K.keyAt(prop, App.time) ? ' sel' : ''));
      d.style.left = pct(k2.t) + '%';
      d.title = U.round(k2.t, 2) + ' s';
      track.appendChild(d);
    });
    row.appendChild(name);
    row.appendChild(track);
    rows.appendChild(row);
  };

  UI.renderRuler = function () {
    var ruler = this.el.tlRuler;
    if (!ruler) return;
    clear(ruler);
    var c = App.comp;
    if (!c) return;
    for (var i = 0; i <= 4; i++) {
      var tick = mk('span', 'tl-tick', U.formatClock(c.duration * i / 4));
      tick.style.left = (i * 25) + '%';
      ruler.appendChild(tick);
    }
  };

  global.UI = UI;
})(window);

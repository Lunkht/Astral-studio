(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;
  var App = global.App;
  var Tools = global.Tools;
  var Align = global.Align;

  var DEFAULT_FILL = '#c9d7f0';
  var DEFAULT_STROKE = '#2b3a55';

  var PALETTE = [
    '#000000', '#ffffff', '#e06c6c', '#e8a33d', '#e8d84f', '#7ec850',
    '#3db6a0', '#1473e6', '#6b6bff', '#b06bff', '#ff6bd6', '#8a5a2b',
    '#c9d7f0', '#2b3a55', '#333333', '#999999'
  ];

  function $(id) { return document.getElementById(id); }
  function on(el, evt, fn) { if (el) el.addEventListener(evt, fn); }
  function toHex(c) { return (c && c !== 'none' && c[0] === '#') ? c : '#000000'; }

  var UI = {
    workspace: null,
    textEditor: null,
    _textTargetId: null,

    init: function () {
      this.workspace = $('workspace');
      this.initMenus();
      this.initTools();
      this.initControlbar();
      this.initPanels();
      this.initSwatches();
      this.initLayers();
      this.initZoom();
      this.initResizers();
      this.initTextEditor();

      var self = this;
      App.on('change', function () { self.render(); });
      App.on('selection', function () { self.render(); });
      App.on('view', function () { self.renderView(); });

      this.render();
    },

    renderRulers: function () { global.Renderer && global.Renderer.drawRulers && global.Renderer.drawRulers(); },

    initResizers: function () {
      this.initResizer({
        handleId: 'railResizer', cssVar: '--rail-w', storageKey: 'astralion.railW',
        min: 44, max: 220, def: 68,
        measure: function (main, e) { return Math.round(e.clientX - main.getBoundingClientRect().left); }
      });
      this.initResizer({
        handleId: 'dockResizer', cssVar: '--dock-w', storageKey: 'astralion.dockW',
        min: 200, max: 460, def: 262,
        measure: function (main, e) { return Math.round(main.getBoundingClientRect().right - e.clientX); }
      });
    },

    initResizer: function (cfg) {
      var handle = $(cfg.handleId);
      var main = document.querySelector('.main');
      if (!handle || !main) return;
      var current = cfg.def;
      try {
        var stored = parseInt(localStorage.getItem(cfg.storageKey), 10);
        if (stored >= cfg.min && stored <= cfg.max) current = stored;
      } catch (e) { }
      main.style.setProperty(cfg.cssVar, current + 'px');

      var dragging = false;
      var move = function (e) {
        if (!dragging) return;
        current = Math.max(cfg.min, Math.min(cfg.max, cfg.measure(main, e)));
        main.style.setProperty(cfg.cssVar, current + 'px');
        global.Renderer.resize();
      };
      var up = function () {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        document.body.classList.remove('rail-resizing');
        try { localStorage.setItem(cfg.storageKey, current); } catch (e) { }
      };
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        dragging = true;
        handle.classList.add('dragging');
        document.body.classList.add('rail-resizing');
        if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
      });
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },

    /* ================= MENUS ================= */
    initMenus: function () {
      var self = this;
      var menubar = document.querySelector('.menubar');
      if (menubar) menubar.setAttribute('role', 'menubar');
      var menus = Array.prototype.slice.call(document.querySelectorAll('.menu'));

      function closeAll() {
        menus.forEach(function (m) {
          m.classList.remove('open');
          var t = m.querySelector('.menu-title');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
      }
      function focusTitle(i) {
        var t = menus[i] && menus[i].querySelector('.menu-title');
        if (t) t.focus();
      }
      function openAt(menu, itemIndex) {
        closeAll();
        menu.classList.add('open');
        var t = menu.querySelector('.menu-title');
        if (t) t.setAttribute('aria-expanded', 'true');
        var items = Array.prototype.slice.call(menu.querySelectorAll('.menu-drop button'));
        if (items[itemIndex || 0]) items[itemIndex || 0].focus();
      }

      menus.forEach(function (menu, idx) {
        menu.setAttribute('role', 'none');
        var title = menu.querySelector('.menu-title');
        var drop = menu.querySelector('.menu-drop');
        title.setAttribute('role', 'menuitem');
        title.setAttribute('aria-haspopup', 'true');
        title.setAttribute('aria-expanded', 'false');
        drop.setAttribute('role', 'menu');
        var items = Array.prototype.slice.call(drop.querySelectorAll('button'));
        items.forEach(function (b) { b.setAttribute('role', 'menuitem'); b.setAttribute('tabindex', '-1'); });
        Array.prototype.slice.call(drop.querySelectorAll('.sep')).forEach(function (s) { s.setAttribute('role', 'separator'); });

        on(title, 'click', function (e) {
          e.stopPropagation();
          var isOpen = menu.classList.contains('open');
          closeAll();
          if (!isOpen) { menu.classList.add('open'); title.setAttribute('aria-expanded', 'true'); }
        });
        on(title, 'keydown', function (e) {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(menu, 0); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(menu, items.length - 1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); focusTitle((idx + 1) % menus.length); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTitle((idx - 1 + menus.length) % menus.length); }
          else if (e.key === 'Escape') { e.preventDefault(); closeAll(); }
        });
        items.forEach(function (b, i) {
          on(b, 'keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
            else if (e.key === 'Escape') { e.preventDefault(); closeAll(); title.focus(); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              var n = e.key === 'ArrowRight' ? (idx + 1) % menus.length : (idx - 1 + menus.length) % menus.length;
              openAt(menus[n], 0);
            }
          });
        });
      });

      document.addEventListener('click', function () { closeAll(); });
      document.querySelectorAll('[data-action]').forEach(function (btn) {
        on(btn, 'click', function (e) {
          e.stopPropagation();
          closeAll();
          self.action(btn.getAttribute('data-action'));
        });
      });
      var docName = $('docName');
      on(docName, 'change', function () { document.title = docName.value + ' — AstralIon'; });
    },

    action: function (name) {
      switch (name) {
        case 'new': global.DocDialog.open(); break;
        case 'doc-setup': global.DocDialog.openForResize(); break;
        case 'export-svg': global.Exporter.exportSVG(); break;
        case 'export-png': global.Exporter.exportPNG(); break;
        case 'undo': App.undo(); break;
        case 'redo': App.redo(); break;
        case 'duplicate': global.Interaction.duplicateSelection(); break;
        case 'delete': global.Interaction.deleteSelection(); break;
        case 'select-all': this.selectAll(); break;
        case 'deselect': App.clearSelection(); App.edit = null; App.emit('change'); break;
        case 'front': App.reorder('front'); break;
        case 'forward': App.reorder('up'); break;
        case 'backward': App.reorder('down'); break;
        case 'back': App.reorder('back'); break;
        case 'pf-union': Align.pathfinder('union'); break;
        case 'pf-exclude': Align.pathfinder('exclude'); break;
        case 'group-concept': this.flattenSelection(); break;
        case 'align-left': Align.align('h', 'min', this.toArtboard()); break;
        case 'align-hcenter': Align.align('h', 'center', this.toArtboard()); break;
        case 'align-right': Align.align('h', 'max', this.toArtboard()); break;
        case 'align-top': Align.align('v', 'min', this.toArtboard()); break;
        case 'align-vcenter': Align.align('v', 'center', this.toArtboard()); break;
        case 'align-bottom': Align.align('v', 'max', this.toArtboard()); break;
        case 'dist-h': Align.distribute('h'); break;
        case 'dist-v': Align.distribute('v'); break;
        case 'zoom-in': App.setZoom(App.camera.zoom * 1.2); break;
        case 'zoom-out': App.setZoom(App.camera.zoom / 1.2); break;
        case 'fit': global.Interaction.fit(); break;
        case 'zoom-100': App.setZoom(1); break;
        case 'toggle-rulers':
          App.rulers = !App.rulers;
          this.workspace.classList.toggle('rulers-off', !App.rulers);
          App.emit('view');
          break;
        case 'about':
          alert('AstralIon — studio vectoriel\nUn clone minimaliste d\'Adobe Illustrator en HTML/CSS/JS.\n\nOutils : sélection, plume, crayon, formes, texte, pipette…');
          break;
      }
    },

    toArtboard: function () { var c = $('alignArtboard'); return c ? c.checked : false; },

    selectAll: function () {
      var all = {};
      App.shapes.forEach(function (s) { all[s.id] = true; });
      App.selection = all;
      App.emit('selection');
    },

    flattenSelection: function () {
      var sel = App.selected().filter(function (s) { return s.type !== 'path' && s.type !== 'text'; });
      if (!sel.length) return;
      App.beginChange();
      var newSel = {};
      sel.forEach(function (s) {
        var pts = Tools.shapeToAnchorPoints(s);
        var b = bounds(pts);
        var p = S.create('path');
        p.x = b.x; p.y = b.y; p.w = b.w; p.h = b.h;
        p.closed = true; p.fillRule = 'nonzero';
        p.points = pts.map(function (pt) { return { x: pt.x - b.x, y: pt.y - b.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }; });
        p.fill = s.fill; p.stroke = s.stroke; p.strokeWidth = s.strokeWidth;
        p.opacity = s.opacity; p.rotation = s.rotation;
        var idx = App.shapes.indexOf(s);
        if (idx >= 0) App.shapes[idx] = p;
        if (App.selection[s.id]) { delete App.selection[s.id]; newSel[p.id] = true; }
      });
      for (var k in newSel) App.selection[k] = true;
      App.endChange();
      App.emit('selection');
    },

    /* ================= TOOLS ================= */
    initTools: function () {
      var self = this;
      document.querySelectorAll('.tool[data-tool]').forEach(function (btn) {
        on(btn, 'click', function () { self.setTool(btn.getAttribute('data-tool')); });
      });
      var cwFill = $('cwFill'), cwStroke = $('cwStroke');
      on(cwFill, 'click', function () { self.setActiveSwatch('fill'); });
      on(cwStroke, 'click', function () { self.setActiveSwatch('stroke'); });
      on($('cwSwap'), 'click', function () { self.swapColors(); });
      on($('cwDefault'), 'click', function () { self.defaultColors(); });
    },

    setTool: function (name) {
      App.tool = name;
      if (name !== 'direct' && name !== 'addAnchor' && name !== 'delAnchor') App.edit = null;
      if (name !== 'pen') App.pen = null;
      App.preview = null;
      document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
        var on = b.getAttribute('data-tool') === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      this.setCursor(name);
      App.emit('change');
    },

    setCursor: function (name) {
      var body = document.body;
      ['cursor-cross', 'cursor-pen', 'cursor-zoom', 'cursor-text', 'cursor-eyedrop', 'cursor-hand'].forEach(function (c) { body.classList.remove(c); });
      var shapeTools = ['rect', 'roundrect', 'ellipse', 'polygon', 'star', 'line'];
      if (shapeTools.indexOf(name) >= 0) body.classList.add('cursor-cross');
      else if (name === 'pen' || name === 'addAnchor' || name === 'delAnchor' || name === 'pencil') body.classList.add('cursor-pen');
      else if (name === 'zoom') body.classList.add('cursor-zoom');
      else if (name === 'text') body.classList.add('cursor-text');
      else if (name === 'eyedropper') body.classList.add('cursor-eyedrop');
      else if (name === 'hand') body.classList.add('cursor-hand');
    },

    setActiveSwatch: function (which) {
      App.activeSwatch = which;
      $('cwFill').classList.toggle('is-target', which === 'fill');
      $('cwStroke').classList.toggle('is-target', which === 'stroke');
    },

    /* ================= CONTROL BAR ================= */
    initControlbar: function () {
      var self = this;
      var map = {
        cbX: function (s, v) { s.x = U.fromUnit(v, App.unit); },
        cbY: function (s, v) { s.y = U.fromUnit(v, App.unit); },
        cbW: function (s, v) { setWH(s, U.fromUnit(v, App.unit), null); },
        cbH: function (s, v) { setWH(s, null, U.fromUnit(v, App.unit)); },
        cbRot: function (s, v) { s.rotation = v; },
        cbSW: function (s, v) { s.strokeWidth = v; }
      };
      Object.keys(map).forEach(function (id) {
        on($(id), 'change', function () {
          var v = parseFloat($(id).value);
          if (isNaN(v)) return;
          self.applyToSelection(function (s) { map[id](s, v); });
          if (id === 'cbSW') App.setStyle({ strokeWidth: v });
        });
      });
      on($('cbUnit'), 'change', function () {
        App.unit = $('cbUnit').value;
        App.emit('change'); App.emit('selection');
      });
      on($('cbRadius'), 'change', function () {
        var v = parseFloat($('cbRadius').value);
        if (isNaN(v)) return;
        self.applyToSelection(function (s) { if (s.type === 'roundrect') s.radius = Math.max(0, v); });
      });
      on($('cbSides'), 'change', function () {
        var v = parseInt($('cbSides').value, 10);
        if (isNaN(v)) return;
        self.applyToSelection(function (s) {
          if (s.type === 'polygon') s.sides = Math.max(3, v);
          if (s.type === 'star') s.points = Math.max(3, v);
        });
      });
      on($('undoBtn'), 'click', function () { App.undo(); });
      on($('redoBtn'), 'click', function () { App.redo(); });
    },

    /* ================= PANELS ================= */
    initPanels: function () {
      var self = this;
      document.querySelectorAll('.panel-head').forEach(function (head) {
        var panel = head.parentElement;
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.setAttribute('aria-expanded', String(!panel.classList.contains('collapsed')));
        function toggle() {
          var collapsed = panel.classList.toggle('collapsed');
          head.setAttribute('aria-expanded', String(!collapsed));
        }
        on(head, 'click', toggle);
        on(head, 'keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });

      var map = {
        xIn: function (s, v) { s.x = U.fromUnit(v, App.unit); },
        yIn: function (s, v) { s.y = U.fromUnit(v, App.unit); },
        wIn: function (s, v) { setWH(s, U.fromUnit(v, App.unit), null); },
        hIn: function (s, v) { setWH(s, null, U.fromUnit(v, App.unit)); },
        rotIn: function (s, v) { s.rotation = v; },
        swIn: function (s, v) { s.strokeWidth = v; }
      };
      Object.keys(map).forEach(function (id) {
        on($(id), 'change', function () {
          var v = parseFloat($(id).value);
          if (isNaN(v)) return;
          self.applyToSelection(function (s) { map[id](s, v); });
          if (id === 'swIn') App.setStyle({ strokeWidth: v });
        });
      });

      on($('fillColor'), 'change', function () { self.setColor('fill', $('fillColor').value); });
      on($('strokeColor'), 'change', function () { self.setColor('stroke', $('strokeColor').value); });
      on($('fillNone'), 'click', function () { self.setColor('fill', 'none'); });
      on($('strokeNone'), 'click', function () { self.setColor('stroke', 'none'); });

      var op = $('opacity'), opNum = $('opacityNum');
      var applyOpacity = function (v) {
        v = U.clamp(v / 100, 0, 1);
        self.applyToSelection(function (s) { s.opacity = v; });
        App.setStyle({ opacity: v });
      };
      on(op, 'change', function () { applyOpacity(parseFloat(op.value)); });
      on(opNum, 'change', function () { applyOpacity(parseFloat(opNum.value)); });

      on($('styleDefault'), 'click', function () { self.defaultColors(); });
      on($('styleSwap'), 'click', function () { self.swapColors(); });
      on($('styleNone'), 'click', function () { App.setStyle({ fill: 'none', stroke: 'none' }); self.applyToSelection(function (s) { s.fill = 'none'; s.stroke = 'none'; }); });
    },

    applyToSelection: function (fn) {
      if (!App.hasSelection()) { App.emit('selection'); return; }
      App.beginChange();
      App.selected().forEach(fn);
      App.endChange();
      App.emit('selection');
    },

    setColor: function (which, value) {
      var partial = {};
      partial[which] = value;
      App.setStyle(partial);
      if (App.hasSelection()) {
        this.applyToSelection(function (s) { s[which] = value; });
      } else {
        App.emit('selection');
      }
    },

    swapColors: function () {
      var f = App.style.fill, s = App.style.stroke;
      App.setStyle({ fill: s, stroke: f });
      this.applyToSelection(function (sh) { var t = sh.fill; sh.fill = sh.stroke; sh.stroke = t; });
    },

    defaultColors: function () {
      App.setStyle({ fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, strokeWidth: 1 });
      this.applyToSelection(function (s) { s.fill = DEFAULT_FILL; s.stroke = DEFAULT_STROKE; s.strokeWidth = 1; });
    },

    /* ================= SWATCHES ================= */
    initSwatches: function () {
      var self = this;
      var box = $('swatches');
      var html = '<span class="swatch-cell none" data-color="none" title="Aucun"></span>';
      PALETTE.forEach(function (c) { html += '<span class="swatch-cell" data-color="' + c + '" style="background:' + c + '"></span>'; });
      box.innerHTML = html;
      on(box, 'click', function (e) {
        var cell = e.target.closest('.swatch-cell');
        if (!cell) return;
        self.setColor(App.activeSwatch || 'fill', cell.getAttribute('data-color'));
      });
    },

    /* ================= LAYERS ================= */
    initLayers: function () {
      var self = this;
      var list = $('layersList');
      on(list, 'click', function (e) {
        var item = e.target.closest('.layer');
        if (!item) return;
        var id = item.getAttribute('data-id');
        var s = App.shapeById(id);
        if (!s) return;
        if (e.target.closest('.li-vis')) { s.visible = !s.visible; App.emit('change'); return; }
        if (e.target.closest('.li-lock')) { s.locked = !s.locked; App.emit('change'); return; }
        if (e.shiftKey) App.toggleSelect(id); else App.select([id]);
      });
      on(list, 'dblclick', function (e) {
        var item = e.target.closest('.layer');
        if (!item) return;
        var s = App.shapeById(item.getAttribute('data-id'));
        if (!s) return;
        var name = prompt('Nom du calque', s.name);
        if (name != null) { s.name = name || s.name; App.emit('change'); }
      });

      on($('layerFront'), 'click', function () { App.reorder('front'); });
      on($('layerUp'), 'click', function () { App.reorder('up'); });
      on($('layerDown'), 'click', function () { App.reorder('down'); });
      on($('layerBack'), 'click', function () { App.reorder('back'); });
      on($('layerDelete'), 'click', function () { global.Interaction.deleteSelection(); });
    },

    /* ================= ZOOM ================= */
    initZoom: function () {
      var self = this;
      on($('zoomIn'), 'click', function () { App.setZoom(App.camera.zoom * 1.25); });
      on($('zoomOut'), 'click', function () { App.setZoom(App.camera.zoom / 1.25); });
      on($('zoomVal'), 'click', function () { global.Interaction.fit(); });
    },

    /* ================= TEXT EDITOR ================= */
    initTextEditor: function () {
      var self = this;
      var ta = document.createElement('textarea');
      ta.className = 'text-editor';
      ta.spellcheck = false;
      this.workspace.appendChild(ta);
      this.textEditor = ta;

      ta.addEventListener('input', function () {
        var te = App.textEdit;
        if (!te) return;
        var s = App.shapeById(te.shapeId);
        if (!s) return;
        s.text = ta.value;
        Tools.syncTextBounds(s);
        App.emit('change');
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); global.Interaction.finishTextEdit(); }
      });
      ta.addEventListener('blur', function () { global.Interaction.finishTextEdit(); });
    },

    syncTextEditor: function () {
      var ta = this.textEditor;
      var te = App.textEdit;
      if (!te) {
        if (ta.style.display !== 'none') { ta.style.display = 'none'; this._textTargetId = null; }
        return;
      }
      var s = App.shapeById(te.shapeId);
      if (!s) { ta.style.display = 'none'; return; }
      var zoom = App.camera.zoom;
      var tl = App.worldToScreen(s.x, s.y);
      ta.style.display = 'block';
      ta.style.left = tl.x + 'px';
      ta.style.top = tl.y + 'px';
      ta.style.width = Math.max(20, s.w * zoom) + 'px';
      ta.style.height = Math.max(16, s.h * zoom) + 'px';
      ta.style.font = (s.fontWeight || 400) + ' ' + ((s.fontSize || 48) * zoom) + 'px ' + (s.fontFamily || 'sans-serif');
      ta.style.lineHeight = (s.lineHeight || (s.fontSize || 48) * 1.2) * zoom + 'px';
      ta.style.color = toHex(s.fill);
      if (this._textTargetId !== s.id) {
        this._textTargetId = s.id;
        ta.value = s.text || '';
        ta.focus();
        var len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    },

    /* ================= RENDER ================= */
    render: function () {
      this.renderControlbar();
      this.renderProps();
      this.renderAppearance();
      this.renderLayers();
      this.renderStatus();
      this.renderView();
      this.syncTextEditor();
    },

    renderProps: function () {
      var sel = App.selected();
      var u = App.unit;
      var set = function (id, v) { $(id).value = v; };
      if (!sel.length) {
        ['xIn', 'yIn', 'wIn', 'hIn', 'rotIn', 'swIn'].forEach(function (id) { $(id).value = ''; });
        return;
      }
      var box = S.unionAabb(sel);
      var single = sel[0];
      set('xIn', U.formatUnit(box.x, u));
      set('yIn', U.formatUnit(box.y, u));
      set('wIn', U.formatUnit(box.w, u));
      set('hIn', U.formatUnit(box.h, u));
      set('rotIn', sel.length === 1 ? Math.round(single.rotation) : '');
      set('swIn', single.strokeWidth);
    },

    renderView: function () {
      var z = Math.round(App.camera.zoom * 100);
      $('zoomVal').textContent = z + '%';
      $('statusZoom').textContent = z + '%';
    },

    renderControlbar: function () {
      var sel = App.selected();
      var has = sel.length > 0;
      $('cbEmpty').style.display = has ? 'none' : 'flex';
      $('cbTransform').style.display = has ? 'flex' : 'none';
      $('cbAlign').style.display = has ? 'flex' : 'none';

      $('undoBtn').disabled = App.history.past.length === 0;
      $('redoBtn').disabled = App.history.future.length === 0;
      $('cbUnit').value = App.unit;

      if (!has) { $('cbExtra').style.display = 'none'; return; }

      var box = S.unionAabb(sel);
      var single = sel[0];
      var u = App.unit;
      $('cbObjType').textContent = sel.length === 1 ? single.name : sel.length + ' objets';
      $('cbX').value = U.formatUnit(box.x, u);
      $('cbY').value = U.formatUnit(box.y, u);
      $('cbW').value = U.formatUnit(box.w, u);
      $('cbH').value = U.formatUnit(box.h, u);
      $('cbRot').value = sel.length === 1 ? Math.round(single.rotation) : '';
      $('cbSW').value = single.strokeWidth;

      var showExtra = sel.length === 1 && (single.type === 'roundrect' || single.type === 'polygon' || single.type === 'star');
      $('cbExtra').style.display = showExtra ? 'flex' : 'none';
      if (showExtra) {
        $('cbRadius').parentElement.style.display = single.type === 'roundrect' ? '' : 'none';
        $('cbRadius').value = single.radius || 0;
        $('cbSides').parentElement.style.display = (single.type === 'polygon' || single.type === 'star') ? '' : 'none';
        $('cbSides').value = single.type === 'polygon' ? (single.sides || 3) : (single.points || 5);
      }
    },

    renderAppearance: function () {
      var sel = App.selected();
      var fill, stroke, opacity;
      if (sel.length) {
        fill = sel[0].fill; stroke = sel[0].stroke; opacity = sel[0].opacity;
      } else {
        fill = App.style.fill; stroke = App.style.stroke; opacity = App.style.opacity;
      }
      this.paintSwatch($('fillSwatch'), fill);
      this.paintSwatch($('strokeSwatch'), stroke);
      $('fillColor').value = toHex(fill);
      $('strokeColor').value = toHex(stroke);
      var op = Math.round((opacity == null ? 1 : opacity) * 100);
      $('opacity').value = op;
      $('opacityNum').value = op;
      this.setActiveSwatch(App.activeSwatch || 'fill');
    },

    paintSwatch: function (el, color) {
      if (!el) return;
      if (!color || color === 'none') {
        el.classList.add('none');
        el.style.background = '';
      } else {
        el.classList.remove('none');
        el.style.background = color;
      }
    },

    renderLayers: function () {
      var list = $('layersList');
      if (!App.shapes.length) {
        list.innerHTML = '<div class="layers-empty">Aucun objet</div>';
        return;
      }
      var html = '';
      for (var i = App.shapes.length - 1; i >= 0; i--) {
        var s = App.shapes[i];
        var selc = App.selection[s.id] ? ' sel' : '';
        var hidden = s.visible ? '' : ' hidden-shape';
        var sw = (s.fill && s.fill !== 'none') ? s.fill : ((s.stroke && s.stroke !== 'none') ? s.stroke : '#ffffff');
        html += '<div class="layer' + selc + hidden + '" data-id="' + s.id + '">' +
          '<span class="li li-vis" title="Visibilité">' + (s.visible ? '◉' : '○') + '</span>' +
          '<span class="li li-lock" title="Verrou">' + (s.locked ? '■' : '□') + '</span>' +
          '<span class="sw" style="background:' + sw + '"></span>' +
          '<span class="nm">' + escapeHtml(s.name) + '</span>' +
          '</div>';
      }
      list.innerHTML = html;
    },

    renderStatus: function () {
      var sel = App.selected();
      var toolNames = {
        select: 'Sélection', direct: 'Sélection directe', pen: 'Plume', pencil: 'Crayon',
        addAnchor: 'Ajouter ancre', delAnchor: 'Supprimer ancre', rect: 'Rectangle',
        roundrect: 'Rectangle arrondi', ellipse: 'Ellipse', polygon: 'Polygone', star: 'Étoile',
        line: 'Segment', text: 'Texte', eyedropper: 'Pipette', hand: 'Main', zoom: 'Zoom'
      };
      var left = toolNames[App.tool] || App.tool;
      if (sel.length) left += ' · ' + sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '');
      $('statusLeft').textContent = left;

      var fill = sel.length ? sel[0].fill : App.style.fill;
      var stroke = sel.length ? sel[0].stroke : App.style.stroke;
      var st = $('statusStyle');
      st.innerHTML = '<span class="dot" style="background:' + (fill && fill !== 'none' ? fill : 'transparent') + '"></span>' +
        '<span class="dot" style="background:' + (stroke && stroke !== 'none' ? stroke : 'transparent') + '"></span>';
    },

    setCoords: function (wp) {
      var el = $('statusCoords');
      if (el) {
        var u = App.unit;
        el.textContent = 'x ' + U.formatUnit(wp.x, u) + ' · y ' + U.formatUnit(wp.y, u) + ' ' + U.UNIT_LABEL[u];
      }
    }
  };

  function setWH(s, w, h) {
    if (w != null && isFinite(w)) {
      if (s.type === 'path' && s.w) {
        var kx = w / s.w;
        S.subpathsOf(s).forEach(function (sp) {
          (sp.points || []).forEach(function (p) { p.x *= kx; p.in.x *= kx; p.out.x *= kx; });
        });
      }
      s.w = w;
    }
    if (h != null && isFinite(h)) {
      if (s.type === 'path' && s.h) {
        var ky = h / s.h;
        S.subpathsOf(s).forEach(function (sp) {
          (sp.points || []).forEach(function (p) { p.y *= ky; p.in.y *= ky; p.out.y *= ky; });
        });
      } else if (s.type === 'text' && s.h) {
        s.fontSize = Math.max(4, (s.fontSize || 48) * (h / s.h));
      }
      s.h = h;
    }
  }

  function bounds(pts) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    pts.forEach(function (p) {
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    });
    if (!isFinite(minx)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.UI = UI;
})(window);

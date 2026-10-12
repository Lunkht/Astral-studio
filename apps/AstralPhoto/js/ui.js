(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Layer = global.Layer;
  var Tools = global.Tools;
  var Filters = global.Filters;
  var Selection = global.Selection;
  var U = global.Utils;

  var SWATCHES = [
    '#000000', '#404040', '#808080', '#bfbfbf', '#ffffff',
    '#7f1d1d', '#dc2626', '#f97316', '#f59e0b', '#eab308',
    '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#0284c7',
    '#1d4ed8', '#4f46e5', '#7c3aed', '#a21caf', '#db2777',
    '#f43f5e', '#fecdd3', '#fde68a', '#bbf7d0', '#bfdbfe'
  ];

  function el(id) { return document.getElementById(id); }
  function show(node, on) { if (node) node.style.display = on ? '' : 'none'; }

  var UI = {
    inited: false,
    _colorInput: null,
    _onPick: null,
    _modalOk: null,
    _modalCancel: null,

    init: function () {
      if (this.inited) return;
      this.inited = true;
      var self = this;

      /* menus */
      var menus = document.querySelectorAll('[data-menu]');
      for (var i = 0; i < menus.length; i++) {
        (function (menu) {
          var title = menu.querySelector('.menu-title');
          if (title) title.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = menu.classList.contains('open');
            self.closeMenus();
            if (!open) menu.classList.add('open');
          });
        })(menus[i]);
      }
      document.addEventListener('click', function () { self.closeMenus(); });

      /* actions */
      var actions = document.querySelectorAll('[data-action]');
      for (var a = 0; a < actions.length; a++) {
        (function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            self.doAction(btn.getAttribute('data-action'));
            self.closeMenus();
          });
        })(actions[a]);
      }

      /* toolbar */
      var tools = document.querySelectorAll('[data-tool]');
      for (var t = 0; t < tools.length; t++) {
        (function (btn) {
          btn.addEventListener('click', function () { App.setTool(btn.getAttribute('data-tool')); });
        })(tools[t]);
      }

      /* collapse panels */
      var collapses = document.querySelectorAll('.collapse');
      for (var c = 0; c < collapses.length; c++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var panel = btn.closest ? btn.closest('.panel') : null;
            if (panel) panel.classList.toggle('collapsed');
          });
        })(collapses[c]);
      }

      /* color widget */
      this.on(el('cwFg'), 'click', function () { self.pickColor(App.fg, function (v) { App.setFg(v); Renderer.draw(); }); });
      this.on(el('cwBg'), 'click', function () { self.pickColor(App.bg, function (v) { App.setBg(v); }); });
      this.on(el('cwSwap'), 'click', function () { App.swapColors(); });
      this.on(el('cwDefault'), 'click', function () { App.resetColors(); });
      this.on(el('fgChip'), 'click', function () { self.pickColor(App.fg, function (v) { App.setFg(v); Renderer.draw(); }); });
      this.on(el('bgChip'), 'click', function () { self.pickColor(App.bg, function (v) { App.setBg(v); }); });

      /* brush panel */
      this.bindBrush();
      /* text + shape + tolerance control bar */
      this.bindControlbar();
      /* layer controls */
      this.bindLayers();
      /* history */
      this.on(el('histUndo'), 'click', function () { App.undo(); Renderer.draw(); });
      this.on(el('histRedo'), 'click', function () { App.redo(); Renderer.draw(); });
      this.on(el('undoBtn'), 'click', function () { App.undo(); Renderer.draw(); });
      this.on(el('redoBtn'), 'click', function () { App.redo(); Renderer.draw(); });
      /* zoom */
      this.on(el('zoomIn'), 'click', function () { App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 1.25); Renderer.draw(); });
      this.on(el('zoomOut'), 'click', function () { App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 0.8); Renderer.draw(); });
      this.on(el('zoomVal'), 'click', function () { App.fitToView(Renderer.viewW, Renderer.viewH); Renderer.draw(); });

      /* doc name */
      var dn = el('docName');
      if (dn) {
        dn.addEventListener('change', function () { if (App.doc) App.doc.name = dn.value; });
        dn.addEventListener('keydown', function (e) { if (e.key === 'Enter') dn.blur(); });
      }

      /* modal */
      this.on(el('modalClose'), 'click', function () { self.closeModal(); });
      this.on(el('modalCancel'), 'click', function () { self.closeModal(); });
      this.on(el('modalOk'), 'click', function () {
        if (self._modalOk && self._modalOk() === false) return;
        self.closeModal(true);
      });

      /* open file */
      var file = el('fileOpen');
      if (file) file.addEventListener('change', function () { self.openImageFile(file); });

      this.buildSwatches();

      /* subscriptions */
      var redraw = function () { Renderer.draw(); };
      App.on('change', function () { UI.render(); redraw(); });
      App.on('layers', function () { UI.renderLayers(); redraw(); });
      App.on('selection', redraw);
      App.on('view', function () { UI.renderStatus(); redraw(); });
      App.on('color', function () { UI.renderColor(); });
      App.on('tool', function () { UI.renderToolbar(); UI.renderContextTools(); });
      App.on('brush', function () { UI.syncBrushInputs(); });
      App.on('history', function () { UI.renderHistory(); });
      App.on('doc', function () { UI.renderAll(); });
      App.on('status', function (msg) { UI.status(msg); });

      window.addEventListener('resize', function () { Renderer.resize(); });

      this.renderAll();
    },

    render: function () {
      this.renderToolbar();
      this.renderContextTools();
      this.renderColor();
      this.renderHistory();
      this.renderStatus();
      this.renderLayerProps();
    },

    on: function (node, evt, fn) { if (node) node.addEventListener(evt, fn); },
    closeMenus: function () {
      var menus = document.querySelectorAll('[data-menu]');
      for (var i = 0; i < menus.length; i++) menus[i].classList.remove('open');
    },

    /* ---------------- color ---------------- */
    pickColor: function (current, onPick) {
      var self = this;
      if (!this._colorInput) {
        var inp = document.createElement('input');
        inp.type = 'color';
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('input', function () { if (self._onPick) self._onPick(inp.value); });
        this._colorInput = inp;
      }
      this._onPick = onPick;
      this._colorInput.value = current || '#000000';
      this._colorInput.click();
    },

    buildSwatches: function () {
      var box = el('swatches');
      if (!box) return;
      var self = this;
      box.innerHTML = '';
      SWATCHES.forEach(function (hex) {
        var b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = hex;
        b.title = hex;
        b.addEventListener('click', function () { App.setFg(hex); Renderer.draw(); });
        box.appendChild(b);
      });
    },

    renderColor: function () {
      var fg = el('cwFg'), bg = el('cwBg');
      if (fg) fg.style.background = App.fg;
      if (bg) bg.style.background = App.bg;
      var fh = el('fgHex'), bh = el('bgHex');
      if (fh) fh.textContent = App.fg;
      if (bh) bh.textContent = App.bg;
      var fc = el('fgChip'), bc = el('bgChip');
      if (fc) fc.style.background = App.fg;
      if (bc) bc.style.background = App.bg;
      if (fc) fc.style.color = this.contrast(App.fg);
      if (bc) bc.style.color = this.contrast(App.bg);
    },

    contrast: function (hex) {
      var c = U.parseColor(hex) || { r: 0, g: 0, b: 0 };
      return (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) > 140 ? '#111' : '#fff';
    },

    /* ---------------- brush ---------------- */
    bindBrush: function () {
      var self = this;
      function wire(rangeId, numId, key, scale) {
        var r = el(rangeId), n = el(numId);
        function set(v, silent) {
          v = U.clamp(parseFloat(v) || 0, parseFloat(r ? r.min : 0), parseFloat(r ? r.max : 100));
          if (key === 'opacity' || key === 'hardness') App.brush[key] = v / 100;
          else App.brush[key] = v;
          if (!silent) { self.syncBrushInputs(); App.emit('brush'); Renderer.draw(); }
        }
        if (r) r.addEventListener('input', function () { set(r.value); });
        if (n) n.addEventListener('input', function () { set(n.value); });
      }
      wire('brushSize', 'brushSizeNum', 'size');
      wire('brushHard', 'brushHardNum', 'hardness');
      wire('brushOp', 'brushOpNum', 'opacity');
    },

    syncBrushInputs: function () {
      var b = App.brush;
      setVal('brushSize', b.size); setVal('brushSizeNum', b.size);
      setVal('brushHard', Math.round(b.hardness * 100)); setVal('brushHardNum', Math.round(b.hardness * 100));
      setVal('brushOp', Math.round(b.opacity * 100)); setVal('brushOpNum', Math.round(b.opacity * 100));
      function setVal(id, v) { var e = el(id); if (e) e.value = v; }
    },

    /* ---------------- control bar ---------------- */
    bindControlbar: function () {
      var self = this;
      this.on(el('cbBrushSize'), 'input', function () { App.brush.size = U.clamp(parseFloat(this.value) || 1, 1, 500); App.emit('brush'); Renderer.draw(); });
      this.on(el('cbBrushHard'), 'input', function () { App.brush.hardness = (parseFloat(this.value) || 0) / 100; Renderer.draw(); });
      this.on(el('cbBrushOp'), 'input', function () { App.brush.opacity = (parseFloat(this.value) || 0) / 100; Renderer.draw(); });
      this.on(el('cbFont'), 'change', function () { App.text.family = this.value; });
      this.on(el('cbFontSize'), 'input', function () { App.text.size = U.clamp(parseFloat(this.value) || 12, 4, 500); });
      this.on(el('cbBold'), 'click', function () { App.text.bold = !App.text.bold; this.classList.toggle('active', App.text.bold); });
      this.on(el('cbItalic'), 'click', function () { App.text.italic = !App.text.italic; this.classList.toggle('active', App.text.italic); });
      this.on(el('cbShapeRadius'), 'input', function () { App.shape.radius = Math.max(0, parseFloat(this.value) || 0); });
      this.on(el('cbTolerance'), 'input', function () { App.tolerance = U.clamp(parseFloat(this.value) || 0, 0, 255); });
      this.on(el('cropApply'), 'click', function () { self.applyCrop(); });
      this.on(el('cropCancel'), 'click', function () { App.cropRect = null; Renderer.draw(); });
    },

    syncControlbar: function () {
      var b = App.brush;
      setVal('cbBrushSize', b.size);
      setVal('cbBrushHard', Math.round(b.hardness * 100));
      setVal('cbBrushOp', Math.round(b.opacity * 100));
      setVal('cbFontSize', App.text.size);
      setVal('cbShapeRadius', App.shape.radius);
      setVal('cbTolerance', App.tolerance);
      var f = el('cbFont'); if (f) f.value = App.text.family;
      var bold = el('cbBold'); if (bold) bold.classList.toggle('active', App.text.bold);
      var ital = el('cbItalic'); if (ital) ital.classList.toggle('active', App.text.italic);
      function setVal(id, v) { var e = el(id); if (e) e.value = v; }
    },

    /* ---------------- layers ---------------- */
    bindLayers: function () {
      this.on(el('layerNew'), 'click', function () { App.addLayer(); });
      this.on(el('layerDup'), 'click', function () { App.duplicateLayer(); });
      this.on(el('layerUp'), 'click', function () { App.moveLayer(App.doc.activeId, 'up'); });
      this.on(el('layerDown'), 'click', function () { App.moveLayer(App.doc.activeId, 'down'); });
      this.on(el('layerMerge'), 'click', function () { App.mergeDown(); });
      this.on(el('layerDelete'), 'click', function () { App.removeLayer(App.doc.activeId); });

      var op = el('layerOpacity');
      if (op) op.addEventListener('input', function () {
        var l = App.activeLayer(); if (!l) return;
        l.opacity = (parseFloat(op.value) || 0) / 100;
        var num = el('layerOpacityNum'); if (num) num.textContent = Math.round(l.opacity * 100) + '%';
        Renderer.draw();
      });
      if (op) op.addEventListener('change', function () {
        var l = App.activeLayer(); if (!l) return;
        App.commit('Opacité du calque', function () {});
      });

      var blend = el('layerBlend');
      if (blend) {
        Layer.BLEND_MODES.forEach(function (m) {
          var o = document.createElement('option');
          o.value = m.id; o.textContent = m.label;
          blend.appendChild(o);
        });
        blend.addEventListener('change', function () {
          var l = App.activeLayer(); if (!l) return;
          App.commit('Mode de fusion', function () { l.blend = blend.value; });
        });
      }
    },

    renderLayers: function () {
      var list = el('layersList');
      if (!list || !App.doc) return;
      var self = this;
      list.innerHTML = '';
      var ls = App.doc.layers;
      for (var i = ls.length - 1; i >= 0; i--) {
        (function (layer) {
          var row = document.createElement('div');
          row.className = 'layer-row' + (layer.id === App.doc.activeId ? ' active' : '');

          var vis = document.createElement('button');
          vis.className = 'lyr-vis';
          vis.textContent = layer.visible ? '\u25C9' : '\u25CB';
          vis.title = 'Visibilité';
          vis.addEventListener('click', function (e) {
            e.stopPropagation();
            App.commit('Visibilité du calque', function () { layer.visible = !layer.visible; });
            Renderer.draw();
          });

          var thumb = document.createElement('canvas');
          thumb.className = 'lyr-thumb';
          thumb.width = 34; thumb.height = 26;
          try { thumb.getContext('2d').drawImage(layer.canvas, 0, 0, 34, 26); } catch (err) {}

          var name = document.createElement('span');
          name.className = 'lyr-name';
          name.textContent = layer.name;
          name.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            name.setAttribute('contenteditable', 'true');
            name.focus();
            var range = document.createRange ? document.createRange() : null;
            if (range && window.getSelection) { range.selectNodeContents(name); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
          });
          name.addEventListener('blur', function () {
            name.removeAttribute('contenteditable');
            layer.name = name.textContent.trim() || layer.name;
          });
          name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });

          row.addEventListener('click', function () { App.setActive(layer.id); });

          row.appendChild(vis);
          row.appendChild(thumb);
          row.appendChild(name);
          list.appendChild(row);
        })(ls[i]);
      }
      this.renderLayerProps();
    },

    renderLayerProps: function () {
      var l = App.activeLayer();
      var op = el('layerOpacity'), num = el('layerOpacityNum'), blend = el('layerBlend');
      if (!l) return;
      if (op) op.value = Math.round(l.opacity * 100);
      if (num) num.textContent = Math.round(l.opacity * 100) + '%';
      if (blend) blend.value = l.blend;
    },

    /* ---------------- history ---------------- */
    renderHistory: function () {
      var info = el('histInfo');
      var n = App.history.past.length + App.history.future.length;
      if (info) info.textContent = n + ' étape(s) · ' + App.history.past.length + ' annulable(s)';
      var u = el('undoBtn'), r = el('redoBtn');
      if (u) u.disabled = App.history.past.length === 0;
      if (r) r.disabled = App.history.future.length === 0;
    },

    /* ---------------- status ---------------- */
    renderStatus: function () {
      var z = el('statusZoom'), zv = el('zoomVal');
      var pct = Math.round(App.camera.zoom * 100) + '%';
      if (z) z.textContent = pct;
      if (zv) zv.textContent = pct;
      var d = el('statusDoc');
      if (d && App.doc) d.textContent = App.doc.width + ' × ' + App.doc.height + ' px';
    },
    status: function (msg) {
      var s = el('statusLeft');
      if (s) s.textContent = msg;
      global.clearTimeout(this._statusTimer);
      var self = this;
      this._statusTimer = global.setTimeout(function () {
        if (el('statusLeft')) el('statusLeft').textContent = 'Prêt';
      }, 2500);
    },
    coords: function (wx, wy) {
      var c = el('statusCoords');
      if (c) c.textContent = 'x ' + Math.round(wx) + ' · y ' + Math.round(wy);
    },

    /* ---------------- toolbar ---------------- */
    renderToolbar: function () {
      var tools = document.querySelectorAll('[data-tool]');
      for (var i = 0; i < tools.length; i++) {
        var active = tools[i].getAttribute('data-tool') === App.tool;
        tools[i].classList.toggle('active', active);
      }
    },

    renderContextTools: function () {
      var t = App.tool;
      show(el('cbBrush'), t === 'brush' || t === 'pencil' || t === 'eraser');
      show(el('cbText'), t === 'text');
      show(el('cbShape'), t === 'shape' || t === 'ellipse-shape');
      show(el('cbCrop'), t === 'crop');
      show(el('cbFill'), t === 'bucket');
      this.syncControlbar();
    },

    renderAll: function () {
      this.renderToolbar();
      this.renderContextTools();
      this.renderColor();
      this.syncBrushInputs();
      this.renderLayers();
      this.renderHistory();
      this.renderStatus();
      var dn = el('docName');
      if (dn && App.doc) dn.value = App.doc.name;
    },

    /* ---------------- modal ---------------- */
    openModal: function (opts) {
      var self = this;
      this._modalOk = opts.onOk || null;
      this._modalCancel = opts.onCancel || null;
      var title = el('modalTitle'), body = el('modalBody'), root = el('modal');
      if (title) title.textContent = opts.title || '';
      if (body) { body.innerHTML = ''; if (opts.build) opts.build(body, self); }
      if (root) root.classList.add('open');
    },
    closeModal: function (ok) {
      var root = el('modal');
      if (root) root.classList.remove('open');
      if (!ok && this._modalCancel) this._modalCancel();
      this._modalOk = null;
      this._modalCancel = null;
    },

    sliderRow: function (label, min, max, value, onchange) {
      var row = document.createElement('div');
      row.className = 'slider-row';
      var lab = document.createElement('span');
      lab.textContent = label; lab.style.width = '90px'; lab.style.color = 'var(--text-dim)';
      var range = document.createElement('input');
      range.type = 'range'; range.min = min; range.max = max; range.value = value;
      var val = document.createElement('span');
      val.className = 'val'; val.textContent = value;
      range.addEventListener('input', function () { val.textContent = range.value; onchange(parseFloat(range.value)); });
      row.appendChild(lab); row.appendChild(range); row.appendChild(val);
      return row;
    },

    /* ---------------- actions ---------------- */
    doAction: function (action) {
      var self = this;
      if (!action) return;
      if (action === 'new') { global.DocDialog.open(); return; }
      if (action === 'open-image') { var f = el('fileOpen'); if (f) f.click(); return; }
      if (action === 'export-png') { global.Exporter.exportPNG(); return; }
      if (action === 'export-jpg') { global.Exporter.exportJPEG(); return; }
      if (action === 'undo') { App.undo(); Renderer.draw(); return; }
      if (action === 'redo') { App.redo(); Renderer.draw(); return; }
      if (action === 'copy') { global.Interaction.copy(); return; }
      if (action === 'paste') { global.Interaction.paste(); Renderer.draw(); return; }
      if (action === 'fill-fg') { this.fillLayer(App.fg); return; }
      if (action === 'fill-bg') { this.fillLayer(App.bg); return; }
      if (action === 'clear') { global.Interaction.clearSelectionPixels(); Renderer.draw(); return; }
      if (action === 'select-all') { App.selectAll(); Renderer.draw(); return; }
      if (action === 'deselect') { App.clearSelection(); Renderer.draw(); return; }
      if (action === 'toggle-grid') { App.showGrid = !App.showGrid; Renderer.draw(); return; }
      if (action === 'zoom-in') { App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 1.25); Renderer.draw(); return; }
      if (action === 'zoom-out') { App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 0.8); Renderer.draw(); return; }
      if (action === 'fit') { App.fitToView(Renderer.viewW, Renderer.viewH); Renderer.draw(); return; }
      if (action === 'zoom-100') { App.setZoom(1, Renderer.viewW / 2, Renderer.viewH / 2); Renderer.draw(); return; }
      if (action === 'about') { this.showAbout(); return; }
      if (action === 'image-size') { this.imageSizeDialog(); return; }
      if (action === 'crop-apply') { this.applyCrop(); return; }
      if (action === 'rotate-90') { this.rotateDoc(90); return; }
      if (action === 'rotate-180') { this.rotateDoc(180); return; }
      if (action === 'flip-h') { this.flipDoc('h'); return; }
      if (action === 'flip-v') { this.flipDoc('v'); return; }
      if (action === 'layer-new') { App.addLayer(); return; }
      if (action === 'layer-duplicate') { App.duplicateLayer(); return; }
      if (action === 'layer-delete') { App.removeLayer(App.doc.activeId); return; }
      if (action === 'layer-top') { App.moveLayer(App.doc.activeId, 'top'); return; }
      if (action === 'layer-up') { App.moveLayer(App.doc.activeId, 'up'); return; }
      if (action === 'layer-down') { App.moveLayer(App.doc.activeId, 'down'); return; }
      if (action === 'layer-bottom') { App.moveLayer(App.doc.activeId, 'bottom'); return; }
      if (action === 'layer-merge') { App.mergeDown(); return; }
      if (action === 'layer-flatten') { App.flatten(); return; }

      if (action === 'adj-brightness') { this.adjustDialog('brightness'); return; }
      if (action === 'adj-hue') { this.adjustDialog('hue'); return; }
      if (action === 'adj-grayscale') { this.applyFilter('Noir et blanc', function (img) { return Filters.grayscale(img); }); return; }
      if (action === 'adj-invert') { this.applyFilter('Inverser', function (img) { return Filters.invert(img); }); return; }
      if (action === 'adj-sepia') { this.applyFilter('Sépia', function (img) { return Filters.sepia(img); }); return; }
      if (action === 'f-blur') { this.applyFilter('Flou gaussien', function (img) { return Filters.gaussianBlur(img, 3); }); return; }
      if (action === 'f-sharpen') { this.applyFilter('Netteté', function (img) { return Filters.sharpen(img, 1); }); return; }
      if (action === 'f-edge') { this.applyFilter('Détection de contours', function (img) { return Filters.edgeDetect(img); }); return; }
      if (action === 'f-emboss') { this.applyFilter('Estampage', function (img) { return Filters.emboss(img); }); return; }
      if (action === 'f-threshold') { this.numberDialog('Seuil', 'Seuil (0-255)', 128, 0, 255, function (v) { self.applyFilter('Seuil', function (img) { return Filters.threshold(img, v); }); }); return; }
      if (action === 'f-posterize') { this.numberDialog('Postériser', 'Niveaux (2-32)', 4, 2, 32, function (v) { self.applyFilter('Postériser', function (img) { return Filters.posterize(img, v); }); }); return; }
    },

    /* ---------------- operations ---------------- */
    fillLayer: function (color) {
      var l = App.activeLayer();
      if (!l) return;
      var self = this;
      App.commit('Remplir', function () {
        var ctx = Layer.context(l.canvas);
        Tools.fill(ctx, color, App.selection, l.canvas.width, l.canvas.height, 1);
      });
      Renderer.draw();
    },

    applyFilter: function (name, fn) {
      var l = App.activeLayer();
      if (!l) return;
      App.commit(name, function () { Tools.applyFilterToLayer(l, fn); });
      Renderer.draw();
    },

    applyCrop: function () {
      if (!App.cropRect) return;
      App.crop(App.cropRect);
      App.cropRect = null;
      App.fitToView(Renderer.viewW, Renderer.viewH);
      Renderer.draw();
    },

    rotateDoc: function (deg) {
      var self = this;
      App.commit('Rotation', function () {
        var w = App.doc.width, h = App.doc.height;
        var nw = deg === 180 ? w : h;
        var nh = deg === 180 ? h : w;
        App.doc.layers.forEach(function (l) {
          var c = Layer.newCanvas(nw, nh);
          var ctx = Layer.context(c);
          ctx.translate(nw / 2, nh / 2);
          ctx.rotate(U.toRad(deg));
          ctx.drawImage(l.canvas, -w / 2, -h / 2);
          l.canvas = c;
        });
        App.doc.width = nw; App.doc.height = nh;
      });
      App.fitToView(Renderer.viewW, Renderer.viewH);
      Renderer.draw();
    },

    flipDoc: function (axis) {
      App.commit('Symétrie', function () {
        App.doc.layers.forEach(function (l) {
          var w = l.canvas.width, h = l.canvas.height;
          var c = Layer.newCanvas(w, h);
          var ctx = Layer.context(c);
          ctx.translate(axis === 'h' ? w : 0, axis === 'v' ? h : 0);
          ctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
          ctx.drawImage(l.canvas, 0, 0);
          l.canvas = c;
        });
      });
      Renderer.draw();
    },

    /* ---------------- dialogs ---------------- */
    adjustDialog: function (kind) {
      var layer = App.activeLayer();
      if (!layer) return;
      var ctx = Layer.context(layer.canvas);
      var original = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
      var params = kind === 'brightness' ? { brightness: 0, contrast: 0 } : { hue: 0, saturation: 0, lightness: 0 };
      function compute() {
        return kind === 'brightness' ? Filters.brightnessContrast(original, params) : Filters.hueSaturation(original, params);
      }
      function put(img) {
        var d;
        try {
          if (global.ImageData) d = new global.ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
          else { d = ctx.createImageData(img.width, img.height); d.data.set(img.data); }
          ctx.putImageData(d, 0, 0);
        } catch (e) {}
      }
      function preview() { put(compute()); Renderer.draw(); }
      var self = this;
      var specs = kind === 'brightness'
        ? [['brightness', 'Luminosité', -100, 100], ['contrast', 'Contraste', -100, 100]]
        : [['hue', 'Teinte', -180, 180], ['saturation', 'Saturation', -100, 100], ['lightness', 'Luminosité', -100, 100]];
      this.openModal({
        title: kind === 'brightness' ? 'Luminosité / Contraste' : 'Teinte / Saturation',
        build: function (body) {
          specs.forEach(function (s) {
            body.appendChild(self.sliderRow(s[1], s[2], s[3], params[s[0]], function (v) { params[s[0]] = v; preview(); }));
          });
        },
        onOk: function () {
          ctx.putImageData(original, 0, 0);
          App.beginChange();
          put(compute());
          App.touch();
          App.endChange();
          Renderer.draw();
        },
        onCancel: function () { ctx.putImageData(original, 0, 0); Renderer.draw(); }
      });
    },

    numberDialog: function (title, label, value, min, max, onOk) {
      var input;
      this.openModal({
        title: title,
        build: function (body) {
          var lab = document.createElement('label');
          lab.textContent = label;
          input = document.createElement('input');
          input.type = 'number'; input.value = value; input.min = min; input.max = max;
          body.appendChild(lab); body.appendChild(input);
        },
        onOk: function () { onOk(U.clamp(parseFloat(input.value) || value, min, max)); }
      });
    },

    imageSizeDialog: function () {
      if (!App.doc) return;
      var self = this;
      var w, h, keep;
      this.openModal({
        title: 'Taille de l\'image',
        build: function (body) {
          var row = document.createElement('div');
          row.className = 'modal-row';
          var wl = document.createElement('label'); wl.textContent = 'Largeur (px)';
          w = document.createElement('input'); w.type = 'number'; w.value = App.doc.width; w.min = 1;
          var hl = document.createElement('label'); hl.textContent = 'Hauteur (px)';
          h = document.createElement('input'); h.type = 'number'; h.value = App.doc.height; h.min = 1;
          var c1 = document.createElement('div'); c1.appendChild(wl); c1.appendChild(w);
          var c2 = document.createElement('div'); c2.appendChild(hl); c2.appendChild(h);
          row.appendChild(c1); row.appendChild(c2);
          var kr = document.createElement('label');
          keep = document.createElement('input'); keep.type = 'checkbox'; keep.checked = true;
          kr.appendChild(keep); kr.appendChild(document.createTextNode(' Conserver les proportions'));
          body.appendChild(row); body.appendChild(kr);
          watch();
          function watch() {
            var ratio = App.doc.width / App.doc.height;
            w.addEventListener('input', function () { if (keep.checked) h.value = Math.round((parseFloat(w.value) || 1) / ratio); });
            h.addEventListener('input', function () { if (keep.checked) w.value = Math.round((parseFloat(h.value) || 1) * ratio); });
          }
        },
        onOk: function () { App.resizeDocument(parseFloat(w.value) || App.doc.width, parseFloat(h.value) || App.doc.height, null); }
      });
    },

    showAbout: function () {
      this.openModal({
        title: 'À propos d\'AstralPhoto',
        build: function (body) {
          var p = document.createElement('p');
          p.style.margin = '0';
          p.style.lineHeight = '1.5';
          p.innerHTML = '<b>AstralPhoto</b> — clone minimaliste d\'Adobe Photoshop, en HTML/CSS/JS pur (Canvas 2D), sans dépendance ni build.<br><br>Application de la suite <b>Astral Studio</b>.';
          body.appendChild(p);
        }
      });
    },

    openImageFile: function (input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          App.newDocument({ name: file.name.replace(/\.[^.]+$/, ''), width: img.width, height: img.height, background: 'transparent' });
          var l = App.activeLayer();
          l.name = 'Image';
          Layer.context(l.canvas).drawImage(img, 0, 0);
          App.fitToView(Renderer.viewW, Renderer.viewH);
          Renderer.draw();
          UI.renderAll();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  };

  /* track pointer for the status bar */
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', function (e) {
      var canvas = document.getElementById('canvas');
      if (!canvas || !App.doc) return;
      var r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      var w = App.screenToWorld(e.clientX - r.left, e.clientY - r.top);
      UI.coords(w.x, w.y);
    });
  }

  global.UI = UI;
})(typeof window !== 'undefined' ? window : this);

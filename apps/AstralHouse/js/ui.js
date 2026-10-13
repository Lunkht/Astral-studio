(function (global) {
  'use strict';

  var U = global.Utils;
  var G = global.Geom;
  var App = global.App;
  var Layers = global.Layers;
  var Drawing = global.Drawing;
  var Tools = global.Tools;
  var Export = global.Export;
  var Renderer = global.Renderer;

  function $(id) { return document.getElementById(id); }
  function r(v, d) { return U.round(v, d == null ? 2 : d); }

  function setInput(id, value) {
    var el = $(id);
    if (!el || document.activeElement === el) return;
    el.value = value;
  }

  function setChecked(id, value) {
    var el = $(id);
    if (el) el.checked = !!value;
  }

  var UI = {
    el: {},

    init: function () {
      this.cache();
      this.wireMenus();
      this.wireActions();
      this.wireTools();
      this.wireLayers();
      this.wireProperties();
      this.wireSettings();
      this.wireModal();
      this.wireFileInput();

      var self = this;
      App.on('change', function () { self.render(); });
      App.on('view', function () { self.render(); });
      App.on('scene', function () { self.render(); });
      App.on('layers', function () { self.renderLayers(); });
      App.on('selection', function () { self.render(); });
      App.on('tool', function () { self.render(); });
      App.on('snap', function () { self.render(); });
      App.on('measure', function () { self.renderMeasure(); });
    },

    cache: function () {
      this.el = {
        drawingName: $('drawingName'),
        statusLeft: $('statusLeft'),
        statusCoords: $('statusCoords'),
        statusSnap: $('statusSnap'),
        statusZoom: $('statusZoom'),
        statusSel: $('statusSel'),
        layerList: $('layerList'),
        currentLayer: $('currentLayer'),
        propEmpty: $('propEmpty'),
        propBody: $('propBody'),
        propLayer: $('propLayer'),
        propColor: $('propColor'),
        propLinetype: $('propLinetype'),
        gridSize: $('gridSize'),
        gridChk: $('gridChk'),
        axesChk: $('axesChk'),
        snapChk: $('snapChk'),
        orthoChk: $('orthoChk'),
        undoBtn: $('undoBtn'),
        redoBtn: $('redoBtn'),
        measureBox: $('measureBox'),
        modal: $('modal'),
        modalTitle: $('modalTitle'),
        modalBody: $('modalBody'),
        modalClose: $('modalClose'),
        modalCancel: $('modalCancel'),
        modalOk: $('modalOk'),
        fileInput: $('fileInput')
      };
    },

    /* ---- menus ---- */
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

    /* ---- actions ---- */
    wireActions: function () {
      var actions = {
        'new': function () { App.newDrawing(); App.zoomExtents(); UI.status('Nouveau dessin'); },
        'sample': function () { App.addSample(); App.zoomExtents(); UI.status('Exemple insere'); },
        'open': function () { if (UI.el.fileInput && UI.el.fileInput.click) UI.el.fileInput.click(); },
        'save-json': function () { Export.saveJson(); UI.status('Dessin enregistre (JSON)'); },
        'export-svg': function () { Export.saveSvg(); UI.status('Export SVG'); },
        'export-dxf': function () { Export.saveDxf(); UI.status('Export DXF'); },
        'export-png': function () { Export.png(); UI.status('Capture PNG'); },
        'undo': function () { App.undo(); },
        'redo': function () { App.redo(); },
        'delete': function () { App.deleteSelection(); },
        'select-all': function () { App.selectAll(); },
        'zoom-extents': function () { App.zoomExtents(); },
        'zoom-in': function () { App.zoomAt({ x: Renderer.w / 2, y: Renderer.h / 2 }, 1.25); },
        'zoom-out': function () { App.zoomAt({ x: Renderer.w / 2, y: Renderer.h / 2 }, 0.8); },
        'toggle-grid': function () { App.showGrid = !App.showGrid; App.emit('change'); },
        'toggle-axes': function () { App.showAxes = !App.showAxes; App.emit('change'); },
        'toggle-snap': function () { App.showSnap = !App.showSnap; App.emit('change'); },
        'toggle-ortho': function () { App.ortho = !App.ortho; App.emit('change'); },
        'add-layer': function () { App.addLayer(); },
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

    /* ---- tools ---- */
    wireTools: function () {
      var btns = document.querySelectorAll('[data-tool]');
      for (var i = 0; i < btns.length; i++) {
        (function (b) {
          b.addEventListener('click', function () { UI.setTool(b.getAttribute('data-tool')); });
        })(btns[i]);
      }
    },

    setTool: function (tool) {
      App.setTool(tool);
      var btns = document.querySelectorAll('[data-tool]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-tool') === tool);
      }
    },

    /* ---- layers ---- */
    wireLayers: function () {
      var addBtn = $('addLayerBtn');
      if (addBtn) addBtn.addEventListener('click', function () { App.addLayer(); });
      var delBtn = $('delLayerBtn');
      if (delBtn) delBtn.addEventListener('click', function () {
        App.removeLayer(App.drawing.currentLayer);
      });
    },

    renderLayers: function () {
      if (!App.drawing) return;
      var list = this.el.layerList;
      if (!list) return;
      while (list.firstChild) list.removeChild(list.firstChild);

      for (var i = 0; i < App.drawing.layers.length; i++) {
        var l = App.drawing.layers[i];
        var row = document.createElement('div');
        row.className = 'layer-row' + (App.drawing.currentLayer === l.name ? ' current' : '');
        row.setAttribute('data-layer', l.name);

        var vis = document.createElement('button');
        vis.className = 'lyr-toggle' + (l.visible ? '' : ' off');
        vis.textContent = l.visible ? '◉' : '◌';
        vis.setAttribute('data-flag', 'visible');
        vis.addEventListener('click', function (e) {
          e.stopPropagation();
          var name = e.currentTarget.parentNode.getAttribute('data-layer');
          var lay = Layers.byName(App.drawing.layers, name);
          App.setLayerFlag(name, 'visible', !lay.visible);
        });

        var lock = document.createElement('button');
        lock.className = 'lyr-toggle' + (l.locked ? ' on' : '');
        lock.textContent = l.locked ? '⊘' : '⊙';
        lock.setAttribute('data-flag', 'locked');
        lock.addEventListener('click', function (e) {
          e.stopPropagation();
          var name = e.currentTarget.parentNode.getAttribute('data-layer');
          var lay = Layers.byName(App.drawing.layers, name);
          App.setLayerFlag(name, 'locked', !lay.locked);
        });

        var swatch = document.createElement('span');
        swatch.className = 'lyr-swatch';
        swatch.style.background = l.color;

        var nm = document.createElement('span');
        nm.className = 'lyr-name';
        nm.textContent = l.name;

        var cnt = document.createElement('span');
        cnt.className = 'lyr-count';
        cnt.textContent = Drawing.entitiesOn(App.drawing, l.name).length;

        row.appendChild(vis);
        row.appendChild(lock);
        row.appendChild(swatch);
        row.appendChild(nm);
        row.appendChild(cnt);
        row.addEventListener('click', function (e) {
          App.setCurrentLayer(e.currentTarget.getAttribute('data-layer'));
        });
        list.appendChild(row);
      }

      if (this.el.currentLayer) {
        while (this.el.currentLayer.firstChild) this.el.currentLayer.removeChild(this.el.currentLayer.firstChild);
        for (var k = 0; k < App.drawing.layers.length; k++) {
          var op = document.createElement('option');
          op.value = App.drawing.layers[k].name;
          op.textContent = App.drawing.layers[k].name;
          this.el.currentLayer.appendChild(op);
        }
        this.el.currentLayer.value = App.drawing.currentLayer;
      }
    },

    /* ---- properties ---- */
    wireProperties: function () {
      var self = this;
      if (this.el.currentLayer) {
        this.el.currentLayer.addEventListener('change', function () { App.setCurrentLayer(this.value); });
      }
      if (this.el.propColor) {
        this.el.propColor.addEventListener('input', function () {
          var v = this.value;
          App.applyToSelection(function (e) { e.color = v; });
        });
        this.el.propColor.addEventListener('change', function () { App.commit(); });
      }
      if (this.el.propLinetype) {
        this.el.propLinetype.addEventListener('change', function () {
          var v = this.value;
          App.applyToSelection(function (e) { e.linetype = v; });
          App.commit();
        });
      }
    },

    renderProperties: function () {
      var sel = App.selected();
      if (this.el.propEmpty) this.el.propEmpty.style.display = sel.length ? 'none' : '';
      if (this.el.propBody) this.el.propBody.style.display = sel.length ? '' : 'none';
      if (!sel.length) return;

      if (this.el.propLayer) {
        while (this.el.propLayer.firstChild) this.el.propLayer.removeChild(this.el.propLayer.firstChild);
        for (var i = 0; i < App.drawing.layers.length; i++) {
          var op = document.createElement('option');
          op.value = App.drawing.layers[i].name;
          op.textContent = App.drawing.layers[i].name;
          this.el.propLayer.appendChild(op);
        }
        this.el.propLayer.value = sel[0].layer;
        this.el.propLayer.onchange = function () {
          App.setSelectionLayer(this.value);
        };
      }
      setInput('propColor', sel[0].color || App.effectiveColor(sel[0]));
      if (this.el.propLinetype) this.el.propLinetype.value = sel[0].linetype || 'bylayer';
    },

    /* ---- settings ---- */
    wireSettings: function () {
      var self = this;
      if (this.el.gridSize) {
        this.el.gridSize.addEventListener('change', function () { App.setGridSize(U.parseNumber(this.value, 10)); App.emit('layers'); });
      }
      if (this.el.gridChk) this.el.gridChk.addEventListener('change', function () { App.showGrid = this.checked; App.emit('change'); });
      if (this.el.axesChk) this.el.axesChk.addEventListener('change', function () { App.showAxes = this.checked; App.emit('change'); });
      if (this.el.snapChk) this.el.snapChk.addEventListener('change', function () { App.showSnap = this.checked; App.emit('change'); });
      if (this.el.orthoChk) this.el.orthoChk.addEventListener('change', function () { App.ortho = this.checked; App.emit('change'); });

      var modes = document.querySelectorAll('[data-snapmode]');
      for (var i = 0; i < modes.length; i++) {
        (function (cb) {
          cb.addEventListener('change', function () { App.toggleSnapMode(cb.getAttribute('data-snapmode')); });
        })(modes[i]);
      }
    },

    /* ---- file input ---- */
    wireFileInput: function () {
      if (!this.el.fileInput) return;
      this.el.fileInput.addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try { Export.loadJson(reader.result); App.zoomExtents(); UI.status('Dessin charge'); }
          catch (err) { UI.status('Fichier invalide'); }
        };
        reader.readAsText(f);
      });
    },

    /* ---- modal ---- */
    wireModal: function () {
      var self = this;
      function hide() { if (self.el.modal) self.el.modal.classList.remove('open'); }
      if (this.el.modalClose) this.el.modalClose.addEventListener('click', hide);
      if (this.el.modalCancel) this.el.modalCancel.addEventListener('click', hide);
      if (this.el.modalOk) this.el.modalOk.addEventListener('click', hide);
      if (this.el.modal) this.el.modal.addEventListener('click', function (e) { if (e.target === self.el.modal) hide(); });
    },

    about: function () {
      if (!this.el.modal) return;
      this.el.modalTitle.textContent = 'À propos d\'AstralHouse';
      this.el.modalBody.innerHTML = '<p><b>AstralHouse</b> — CAO / architecture 2D légère, 100 % Canvas 2D.</p>' +
        '<p>Dessin technique au clic : lignes, polylignes, rectangles, cercles, arcs 3 points, cotation, hachures et texte.</p>' +
        '<p>Calques, accrochage objet (extrémités, milieux, centres), mode ortho, unités réelles et export SVG / DXF / PNG.</p>';
      if (this.el.modalOk) this.el.modalOk.style.display = 'none';
      if (this.el.modalCancel) this.el.modalCancel.textContent = 'Fermer';
      this.el.modal.classList.add('open');
    },

    status: function (msg) {
      if (this.el.statusLeft) this.el.statusLeft.textContent = msg;
    },

    renderMeasure: function () {
      var box = this.el.measureBox;
      if (!box) return;
      if (!App.measure) { box.textContent = '—'; return; }
      box.textContent = U.fmt(App.measure.distance) + ' ' + (App.drawing.units || '') +
        '  @ ' + U.fmt(U.rad2deg(App.measure.angle), 1) + '°';
    },

    /* ---- render ---- */
    render: function () {
      if (!App.drawing) return;
      if (this.el.undoBtn) this.el.undoBtn.disabled = !App.canUndo();
      if (this.el.redoBtn) this.el.redoBtn.disabled = !App.canRedo();
      if (this.el.drawingName && document.activeElement !== this.el.drawingName) this.el.drawingName.value = App.drawing.name;

      if (this.el.gridChk) this.el.gridChk.checked = !!App.showGrid;
      if (this.el.axesChk) this.el.axesChk.checked = !!App.showAxes;
      if (this.el.snapChk) this.el.snapChk.checked = !!App.showSnap;
      if (this.el.orthoChk) this.el.orthoChk.checked = !!App.ortho;
      setInput('gridSize', r(App.drawing.gridSize, 3));

      var tool = Tools.def(App.tool);
      if (this.el.statusLeft) this.el.statusLeft.textContent = tool ? tool.title + ' — ' + tool.hint : 'Prêt';

      if (this.el.statusCoords) {
        var c = App.cursor || G.v(0, 0);
        this.el.statusCoords.textContent = r(c.x, 2) + ', ' + r(c.y, 2);
      }
      if (this.el.statusSnap) this.el.statusSnap.textContent = App.snapHit ? 'ACC ' + App.snapHit.type : 'ACC -';
      if (this.el.statusZoom) this.el.statusZoom.textContent = 'zoom ' + r(App.viewport.scale, 2) + 'x';
      var sel = App.selectedIds().length;
      if (this.el.statusSel) this.el.statusSel.textContent = sel ? sel + ' sel.' : 'aucune sel.';

      this.renderLayers();
      this.renderProperties();
      this.renderMeasure();
      Renderer.draw();
    }
  };

  global.UI = UI;
})(window);

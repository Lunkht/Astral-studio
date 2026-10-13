(function (global) {
  'use strict';

  var U = global.Utils;
  var L = global.Layer;
  var App = global.App;
  var Renderer = global.Renderer;
  var Timeline = global.Timeline;

  function $(id) { return document.getElementById(id); }
  function isFocused(el) { return document.activeElement === el; }

  var UI = {
    els: {},

    init: function () {
      var self = this;
      this.cache();
      this.wireMenus();
      this.wireToolrail();
      this.wireControlbar();
      this.wireProps();
      this.wireLayers();
      this.wireTimeline();
      this.wireModal();
      this.wireDocDialog();

      App.on('change', function () { self.render(); Renderer.draw(); });
      App.on('frame', function () { self.render(); });
      App.on('play', function () { self.render(); });
      App.on('selection', function () { self.render(); });
      App.on('doc', function () {
        if (App.doc) { self.els.docName.value = App.doc.name; self.els.ddName.value = App.doc.name; }
      });

      Renderer.draw();
    },

    cache: function () {
      var ids = ['docName', 'cbFill', 'cbStroke', 'cbStrokeW', 'cbFontSize', 'cbText', 'undoBtn', 'redoBtn',
        'tlFirst', 'tlPrev', 'tlPlay', 'tlNext', 'tlLast', 'frameVal', 'fpsVal', 'zoomOut', 'zoomIn', 'zoomVal',
        'layersList', 'layerNew', 'layerUp', 'layerDown', 'layerDelete',
        'propsEmpty', 'propsBody', 'pX', 'pY', 'pW', 'pH', 'pFill', 'pStroke', 'pStrokeW', 'pOpacity', 'pOpacityNum',
        'tlKeyAdd', 'tlKeyDel', 'onionChk', 'gridChk', 'frameCount', 'tlNames', 'tlRows', 'tlNums',
        'statusLeft', 'statusDoc', 'statusFrame', 'statusZoom', 'statusCoords', 'timeline',
        'modal', 'modalTitle', 'modalBody', 'modalClose', 'modalCancel', 'modalOk',
        'docDialog', 'ddName', 'ddW', 'ddH', 'ddFps', 'ddFrames', 'ddBg', 'ddCreate', 'ddCancel', 'ddClose'];
      for (var i = 0; i < ids.length; i++) this.els[ids[i]] = $(ids[i]);
    },

    /* ---------- menus ---------- */
    wireMenus: function () {
      var self = this;
      var menus = document.querySelectorAll('.menu');
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
      var actions = document.querySelectorAll('[data-action]');
      for (var a = 0; a < actions.length; a++) {
        actions[a].addEventListener('click', function (e) {
          self.doAction(this.getAttribute('data-action'));
          self.closeMenus();
          e.preventDefault();
        });
      }
    },
    closeMenus: function () {
      var menus = document.querySelectorAll('.menu.open');
      for (var i = 0; i < menus.length; i++) menus[i].classList.remove('open');
    },

    doAction: function (action) {
      switch (action) {
        case 'new': this.openDocDialog(); break;
        case 'undo': App.undo(); Renderer.draw(); break;
        case 'redo': App.redo(); Renderer.draw(); break;
        case 'duplicate': this.duplicate(); break;
        case 'delete': App.deleteSelection(); Renderer.draw(); break;
        case 'key-add': App.addKey(); Renderer.draw(); break;
        case 'key-del': App.removeKey(); Renderer.draw(); break;
        case 'frame-prev': App.prevFrame(); Renderer.draw(); break;
        case 'frame-next': App.nextFrame(); Renderer.draw(); break;
        case 'play': Timeline.toggle(); break;
        case 'onion': App.onion = !App.onion; this.render(); Renderer.draw(); break;
        case 'grid': App.grid = !App.grid; this.render(); Renderer.draw(); break;
        case 'layer-new': App.addLayer(); break;
        case 'layer-up': App.moveLayer(App.activeLayerId, 1); break;
        case 'layer-down': App.moveLayer(App.activeLayerId, -1); break;
        case 'layer-delete': App.removeLayer(App.activeLayerId); break;
        case 'zoom-in': App.zoomAt(Renderer.w / 2, Renderer.h / 2, 1.25); Renderer.draw(); break;
        case 'zoom-out': App.zoomAt(Renderer.w / 2, Renderer.h / 2, 0.8); Renderer.draw(); break;
        case 'fit': global.Interaction.fit(); break;
        case 'export-svg': global.Export.svgDialog(); break;
        case 'export-png': global.Export.png(); break;
        case 'about': this.about(); break;
      }
    },

    /* ---------- tools ---------- */
    wireToolrail: function () {
      var self = this;
      var tools = document.querySelectorAll('.tool');
      for (var i = 0; i < tools.length; i++) {
        tools[i].addEventListener('click', function () {
          self.setTool(this.getAttribute('data-tool'));
        });
      }
    },
    setTool: function (tool) {
      App.tool = tool;
      var tools = document.querySelectorAll('.tool');
      for (var i = 0; i < tools.length; i++) {
        if (tools[i].getAttribute('data-tool') === tool) tools[i].classList.add('active');
        else tools[i].classList.remove('active');
      }
      if (this.els.cbText) this.els.cbText.style.display = tool === 'text' ? '' : 'none';
      this.render();
    },

    /* ---------- control bar ---------- */
    wireControlbar: function () {
      var self = this;
      var e = this.els;
      e.cbFill.addEventListener('input', function () { App.style.fill = this.value; self.applyToSelection('fill', this.value); });
      e.cbStroke.addEventListener('input', function () { App.style.stroke = this.value; self.applyToSelection('stroke', this.value); });
      e.cbStrokeW.addEventListener('input', function () { var v = parseFloat(this.value) || 0; App.style.strokeWidth = v; self.applyToSelection('strokeWidth', v); });
      e.cbFontSize.addEventListener('input', function () { App.style.fontSize = parseFloat(this.value) || 48; self.applyToSelection('fontSize', App.style.fontSize); });
      e.undoBtn.addEventListener('click', function () { App.undo(); Renderer.draw(); });
      e.redoBtn.addEventListener('click', function () { App.redo(); Renderer.draw(); });
      e.tlFirst.addEventListener('click', function () { App.setFrame(0); Renderer.draw(); });
      e.tlPrev.addEventListener('click', function () { App.prevFrame(); Renderer.draw(); });
      e.tlPlay.addEventListener('click', function () { Timeline.toggle(); });
      e.tlNext.addEventListener('click', function () { App.nextFrame(); Renderer.draw(); });
      e.tlLast.addEventListener('click', function () { App.setFrame(App.doc.frameCount - 1); Renderer.draw(); });
      e.fpsVal.addEventListener('change', function () { App.doc.fps = U.clamp(parseInt(this.value, 10) || 12, 1, 60); this.value = App.doc.fps; });
      e.zoomOut.addEventListener('click', function () { App.zoomAt(Renderer.w / 2, Renderer.h / 2, 0.8); Renderer.draw(); });
      e.zoomIn.addEventListener('click', function () { App.zoomAt(Renderer.w / 2, Renderer.h / 2, 1.25); Renderer.draw(); });
      e.onionChk.addEventListener('change', function () { App.onion = this.checked; Renderer.draw(); });
      e.gridChk.addEventListener('change', function () { App.grid = this.checked; Renderer.draw(); });
      e.frameCount.addEventListener('change', function () {
        App.doc.frameCount = U.clamp(parseInt(this.value, 10) || 1, 1, 600);
        this.value = App.doc.frameCount;
        App.setFrame(U.clamp(App.currentFrame, 0, App.doc.frameCount - 1));
        Renderer.draw();
      });
    },

    applyToSelection: function (key, value) {
      var shapes = App.selectedShapes();
      if (!shapes.length) { Renderer.draw(); return; }
      for (var i = 0; i < shapes.length; i++) shapes[i][key] = value;
      App.emit('change');
    },

    /* ---------- properties ---------- */
    wireProps: function () {
      var self = this;
      var e = this.els;
      function bind(id, key, num) {
        e[id].addEventListener('input', function () {
          var shapes = App.selectedShapes();
          if (!shapes.length) return;
          var v = num ? (parseFloat(this.value) || 0) : this.value;
          for (var i = 0; i < shapes.length; i++) shapes[i][key] = v;
          App.emit('change');
        });
        e[id].addEventListener('change', function () { if (App.hasSelection()) App.commit('Propriétés'); });
      }
      bind('pX', 'x', true);
      bind('pY', 'y', true);
      bind('pW', 'w', true);
      bind('pH', 'h', true);
      bind('pFill', 'fill', false);
      bind('pStroke', 'stroke', false);
      bind('pStrokeW', 'strokeWidth', true);
      bind('pOpacity', 'opacity', true);
      e.pOpacity.addEventListener('input', function () {
        var v = (parseFloat(this.value) || 0) / 100;
        var shapes = App.selectedShapes();
        for (var i = 0; i < shapes.length; i++) shapes[i].opacity = v;
        e.pOpacityNum.textContent = Math.round(v * 100) + '%';
        App.emit('change');
      });
    },

    /* ---------- layers ---------- */
    wireLayers: function () {
      var self = this;
      var e = this.els;
      e.layerNew.addEventListener('click', function () { App.addLayer(); });
      e.layerUp.addEventListener('click', function () { App.moveLayer(App.activeLayerId, 1); });
      e.layerDown.addEventListener('click', function () { App.moveLayer(App.activeLayerId, -1); });
      e.layerDelete.addEventListener('click', function () { App.removeLayer(App.activeLayerId); });
      e.layersList.addEventListener('click', function (ev) {
        var row = ev.target.closest ? ev.target.closest('[data-layer]') : null;
        if (!row) return;
        var id = row.getAttribute('data-layer');
        var act = ev.target.getAttribute && ev.target.getAttribute('data-act');
        var layer = App.layerById(id);
        if (!layer) return;
        if (act === 'vis') { layer.visible = !layer.visible; App.commit('Visibilité'); }
        else if (act === 'lock') { layer.locked = !layer.locked; App.commit('Verrouillage'); }
        else App.setActiveLayer(id);
        Renderer.draw();
      });
      e.tlNames.addEventListener('click', function (ev) {
        var row = ev.target.closest ? ev.target.closest('[data-layer]') : null;
        if (row) { App.setActiveLayer(row.getAttribute('data-layer')); Renderer.draw(); }
      });
    },

    /* ---------- timeline ---------- */
    wireTimeline: function () {
      var self = this;
      var e = this.els;
      e.tlKeyAdd.addEventListener('click', function () { App.addKey(); Renderer.draw(); });
      e.tlKeyDel.addEventListener('click', function () { App.removeKey(); Renderer.draw(); });
      e.tlRows.addEventListener('click', function (ev) {
        var cell = ev.target.closest ? ev.target.closest('[data-frame]') : null;
        if (!cell) return;
        var layerId = cell.getAttribute('data-layer');
        var frame = parseInt(cell.getAttribute('data-frame'), 10);
        if (layerId) App.activeLayerId = layerId;
        App.selection = {};
        App.setFrame(frame);
        Renderer.draw();
      });
    },

    duplicate: function () {
      var layer = App.activeLayer();
      if (!layer) return;
      var key = App.editableKey();
      if (!key) return;
      var sel = App.selectedShapes();
      if (!sel.length) return;
      var newSel = {};
      for (var i = 0; i < sel.length; i++) {
        var c = U.deepClone(sel[i]);
        c.id = U.uid('s');
        c.x += 12; c.y += 12;
        if (c.points) for (var j = 0; j < c.points.length; j++) { c.points[j].x += 12; c.points[j].y += 12; }
        key.shapes.push(c);
        newSel[c.id] = true;
      }
      App.selection = newSel;
      App.commit('Dupliquer');
    },

    /* ---------- modal / dialog ---------- */
    wireModal: function () {
      var self = this;
      var e = this.els;
      e.modalClose.addEventListener('click', function () { self.closeModal(); });
      e.modalCancel.addEventListener('click', function () { self.closeModal(); });
      e.modalOk.addEventListener('click', function () { if (self._onOk) self._onOk(); self.closeModal(); });
    },
    openModal: function (title, bodyHTML, onOk, okLabel) {
      var e = this.els;
      e.modalTitle.textContent = title;
      e.modalBody.innerHTML = bodyHTML || '';
      e.modalOk.textContent = okLabel || 'OK';
      this._onOk = onOk || null;
      if (e.modal) e.modal.classList.add('open');
    },
    closeModal: function () {
      if (this.els.modal) this.els.modal.classList.remove('open');
      this._onOk = null;
    },
    about: function () {
      this.openModal('À propos d\'AstralAnimate',
        '<p>AstralAnimate — clone minimaliste d\'Adobe Animate.</p>' +
        '<p>Animation 2D image par image, images clés et interpolation, rendu Canvas 2D.</p>' +
        '<p>Application de la suite <b>Astral Studio</b>. Sans dépendance.</p>',
        null, 'Fermer');
    },

    wireDocDialog: function () {
      var self = this;
      var e = this.els;
      e.ddCreate.addEventListener('click', function () {
        App.newDocument({
          name: e.ddName.value || 'Sans titre',
          width: Math.max(1, parseInt(e.ddW.value, 10) || 800),
          height: Math.max(1, parseInt(e.ddH.value, 10) || 600),
          fps: U.clamp(parseInt(e.ddFps.value, 10) || 12, 1, 60),
          frameCount: U.clamp(parseInt(e.ddFrames.value, 10) || 24, 1, 600),
          background: e.ddBg.value
        });
        self.closeDocDialog();
        global.Interaction.fit();
        self.setTool('select');
      });
      e.ddCancel.addEventListener('click', function () { self.closeDocDialog(); });
      e.ddClose.addEventListener('click', function () { self.closeDocDialog(); });
      e.ddName.addEventListener('change', function () { if (App.doc) { App.doc.name = this.value; self.els.docName.value = this.value; } });
    },
    openDocDialog: function () {
      if (App.doc) {
        this.els.ddName.value = App.doc.name;
        this.els.ddW.value = App.doc.width;
        this.els.ddH.value = App.doc.height;
        this.els.ddFps.value = App.doc.fps;
        this.els.ddFrames.value = App.doc.frameCount;
        this.els.ddBg.value = App.doc.background;
      }
      if (this.els.docDialog) this.els.docDialog.classList.add('open');
    },
    closeDocDialog: function () {
      if (this.els.docDialog) this.els.docDialog.classList.remove('open');
    },

    /* ---------- render ---------- */
    setCoords: function (x, y) {
      if (this.els.statusCoords) this.els.statusCoords.textContent = 'x ' + U.round(x) + ' · y ' + U.round(y);
    },

    render: function () {
      if (!App.doc || !this.els.docName) return;
      var e = this.els;
      if (!isFocused(e.docName)) e.docName.value = App.doc.name;
      if (!isFocused(e.fpsVal)) e.fpsVal.value = App.doc.fps;
      if (!isFocused(e.frameCount)) e.frameCount.value = App.doc.frameCount;

      e.frameVal.textContent = App.currentFrame;
      e.zoomVal.textContent = Math.round(App.camera.zoom * 100) + '%';
      e.statusZoom.textContent = Math.round(App.camera.zoom * 100) + '%';
      e.statusFrame.textContent = 'image ' + App.currentFrame;
      e.statusDoc.textContent = App.doc.name + ' · ' + App.doc.width + '×' + App.doc.height;
      e.statusLeft.textContent = App.playing ? 'Lecture…' : 'Prêt';

      e.tlPlay.innerHTML = App.playing ? '&#10074;&#10074;' : '&#9654;';
      e.onionChk.checked = !!App.onion;
      e.gridChk.checked = !!App.grid;
      e.undoBtn.disabled = !App.canUndo();
      e.redoBtn.disabled = !App.canRedo();

      e.cbFill.value = App.style.fill;
      e.cbStroke.value = App.style.stroke;
      e.cbStrokeW.value = App.style.strokeWidth;
      e.cbFontSize.value = App.style.fontSize || 48;

      this.renderProps();
      this.renderLayers();
      this.renderTimeline();
    },

    renderProps: function () {
      var e = this.els;
      var shapes = App.selectedShapes();
      if (!shapes.length) {
        e.propsEmpty.style.display = '';
        e.propsBody.style.display = 'none';
        return;
      }
      e.propsEmpty.style.display = 'none';
      e.propsBody.style.display = '';
      var s = shapes[0];
      if (!isFocused(e.pX)) e.pX.value = Math.round(s.x);
      if (!isFocused(e.pY)) e.pY.value = Math.round(s.y);
      if (!isFocused(e.pW)) e.pW.value = Math.round(s.w);
      if (!isFocused(e.pH)) e.pH.value = Math.round(s.h);
      if (s.fill && s.fill !== 'none') e.pFill.value = s.fill;
      if (s.stroke && s.stroke !== 'none') e.pStroke.value = s.stroke;
      e.pStrokeW.value = s.strokeWidth;
      e.pOpacity.value = Math.round((s.opacity == null ? 1 : s.opacity) * 100);
      e.pOpacityNum.textContent = Math.round((s.opacity == null ? 1 : s.opacity) * 100) + '%';
    },

    renderLayers: function () {
      var html = '';
      for (var i = App.doc.layers.length - 1; i >= 0; i--) {
        var lyr = App.doc.layers[i];
        html += '<div class="layer-row' + (lyr.id === App.activeLayerId ? ' active' : '') + '" data-layer="' + lyr.id + '">' +
          '<button class="lico ' + (lyr.visible ? 'on' : '') + '" data-act="vis" title="Visibilité">' + (lyr.visible ? '&#128065;' : '&#8211;') + '</button>' +
          '<button class="lico ' + (lyr.locked ? 'on' : '') + '" data-act="lock" title="Verrouillage">' + (lyr.locked ? '&#128274;' : '&#128275;') + '</button>' +
          '<span class="lname">' + lyr.name + '</span></div>';
      }
      this.els.layersList.innerHTML = html;
    },

    renderTimeline: function () {
      var doc = App.doc;
      var n = doc.frameCount;
      var nums = '';
      for (var f = 0; f < n; f++) {
        nums += '<div class="tl-num' + (f % 5 === 0 ? ' every5' : '') + '">' + (f % 5 === 0 ? (f + 1) : '') + '</div>';
      }
      this.els.tlNums.innerHTML = nums;

      var names = '';
      var rows = '';
      for (var i = doc.layers.length - 1; i >= 0; i--) {
        var lyr = doc.layers[i];
        names += '<div class="tl-name' + (lyr.id === App.activeLayerId ? ' active' : '') + '" data-layer="' + lyr.id + '">' + lyr.name + '</div>';
        rows += '<div class="tl-row">';
        for (var c = 0; c < n; c++) {
          var cls = 'tl-cell';
          if (L.keyAt(lyr, c)) cls += ' key';
          else {
            var p = L.prevKey(lyr, c), nx = L.nextKey(lyr, c);
            if (p && nx) cls += ' tween';
          }
          if (c === App.currentFrame) cls += ' current';
          rows += '<div class="' + cls + '" data-layer="' + lyr.id + '" data-frame="' + c + '"></div>';
        }
        rows += '</div>';
      }
      this.els.tlNames.innerHTML = names;
      this.els.tlRows.innerHTML = rows;
    }
  };

  global.UI = UI;
})(window);

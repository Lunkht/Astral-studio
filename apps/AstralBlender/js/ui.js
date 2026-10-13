(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Export = global.Export;

  function $(id) { return document.getElementById(id); }
  function r2(v) { return Math.round(v * 100) / 100; }

  function setInput(id, value) {
    var el = $(id);
    if (!el || document.activeElement === el) return;
    el.value = value;
  }

  var UI = {
    el: {},

    init: function () {
      this.cache();
      this.wireMenus();
      this.wireActions();
      this.wireTools();
      this.wireDock();
      this.wireTransform();
      this.wireModal();

      var self = this;
      App.on('change', function () { self.render(); });
      App.on('camera', function () { self.render(); });
      App.on('selection', function () { self.render(); });
      App.on('scene', function () { self.render(); });
    },

    cache: function () {
      this.el = {
        scene: $('sceneName'),
        shadeSel: $('shadeSel'),
        edgesChk: $('edgesChk'),
        gridChk: $('gridChk'),
        axesChk: $('axesChk'),
        undoBtn: $('undoBtn'),
        redoBtn: $('redoBtn'),
        objList: $('objList'),
        xfEmpty: $('xfEmpty'),
        xfBody: $('xfBody'),
        distVal: $('distVal'),
        statusLeft: $('statusLeft'),
        statusObjects: $('statusObjects'),
        statusSel: $('statusSel'),
        statusDist: $('statusDist'),
        modal: $('modal'),
        modalTitle: $('modalTitle'),
        modalBody: $('modalBody'),
        modalClose: $('modalClose'),
        modalCancel: $('modalCancel'),
        modalOk: $('modalOk')
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

    /* ---- shared actions ---- */
    wireActions: function () {
      var actions = {
        'new': function () { App.newScene(); UI.status('Nouvelle scène'); },
        'export-png': function () { Export.png(); UI.status('Rendu PNG exporté'); },
        'export-obj': function () { Export.obj(); UI.status('Scène exportée en OBJ'); },
        'undo': function () { App.undo(); },
        'redo': function () { App.redo(); },
        'duplicate': function () { App.duplicateSelection(); },
        'delete': function () { App.deleteSelection(); },
        'add-cube': function () { UI.add('cube'); },
        'add-plane': function () { UI.add('plane'); },
        'add-sphere': function () { UI.add('sphere'); },
        'add-cylinder': function () { UI.add('cylinder'); },
        'add-cone': function () { UI.add('cone'); },
        'add-torus': function () { UI.add('torus'); },
        'shade-solid': function () { UI.setShading('solid'); },
        'shade-edges': function () { UI.setShading('edges'); },
        'shade-wire': function () { UI.setShading('wireframe'); },
        'toggle-grid': function () { App.showGrid = !App.showGrid; App.emit('change'); },
        'toggle-axes': function () { App.showAxes = !App.showAxes; App.emit('change'); },
        'view-front': function () { App.setView('front'); },
        'view-side': function () { App.setView('side'); },
        'view-top': function () { App.setView('top'); },
        'frame': function () { App.frame(); },
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

    add: function (kind) {
      App.addPrimitive(kind);
      UI.status('Ajout : ' + kind);
    },

    setShading: function (mode) {
      if (mode === 'wireframe') { App.shading = 'wireframe'; App.showEdges = true; }
      else { App.shading = 'solid'; App.showEdges = (mode === 'edges'); }
      App.emit('change');
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
      App.tool = tool;
      var btns = document.querySelectorAll('[data-tool]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-tool') === tool);
      }
    },

    /* ---- dock ---- */
    wireDock: function () {
      var addBtns = document.querySelectorAll('[data-add]');
      for (var i = 0; i < addBtns.length; i++) {
        (function (b) {
          b.addEventListener('click', function () { UI.add(b.getAttribute('data-add')); });
        })(addBtns[i]);
      }
      var collapses = document.querySelectorAll('.collapse');
      for (var j = 0; j < collapses.length; j++) {
        (function (c) {
          c.addEventListener('click', function () {
            var panel = c.closest ? c.closest('.panel') : null;
            if (panel) panel.classList.toggle('collapsed');
          });
        })(collapses[j]);
      }
      if (this.el.shadeSel) this.el.shadeSel.addEventListener('change', function () { UI.setShading(this.value); });
      if (this.el.edgesChk) this.el.edgesChk.addEventListener('change', function () { App.showEdges = this.checked; App.emit('change'); });
      if (this.el.gridChk) this.el.gridChk.addEventListener('change', function () { App.showGrid = this.checked; App.emit('change'); });
      if (this.el.axesChk) this.el.axesChk.addEventListener('change', function () { App.showAxes = this.checked; App.emit('change'); });
      if (this.el.undoBtn) this.el.undoBtn.addEventListener('click', function () { App.undo(); });
      if (this.el.redoBtn) this.el.redoBtn.addEventListener('click', function () { App.redo(); });
      if (this.el.scene) this.el.scene.addEventListener('input', function () { App.name = this.value; });
    },

    /* ---- transform fields ---- */
    wireTransform: function () {
      ['px', 'py', 'pz'].forEach(function (id, idx) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('input', function () {
          var v = parseFloat(el.value);
          if (isNaN(v)) return;
          App.updateSelected(function (o) { o.position[['x', 'y', 'z'][idx]] = v; });
        });
        el.addEventListener('change', function () { App.commit('Transform'); });
      });
      ['rx', 'ry', 'rz'].forEach(function (id, idx) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('input', function () {
          var v = parseFloat(el.value);
          if (isNaN(v)) return;
          App.updateSelected(function (o) { o.rotation[['x', 'y', 'z'][idx]] = v * Math.PI / 180; });
        });
        el.addEventListener('change', function () { App.commit('Transform'); });
      });
      ['sx', 'sy', 'sz'].forEach(function (id, idx) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('input', function () {
          var v = parseFloat(el.value);
          if (isNaN(v)) return;
          App.updateSelected(function (o) { o.scale[['x', 'y', 'z'][idx]] = Math.max(0.01, v); });
        });
        el.addEventListener('change', function () { App.commit('Transform'); });
      });
      var name = $('objName');
      if (name) {
        name.addEventListener('input', function () {
          App.updateSelected(function (o) { o.name = name.value; });
        });
        name.addEventListener('change', function () { App.commit('Renommer'); UI.renderObjects(); });
      }
      var color = $('objColor');
      if (color) {
        color.addEventListener('input', function () {
          App.updateSelected(function (o) { o.color = color.value; });
        });
        color.addEventListener('change', function () { App.commit('Couleur'); });
      }
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
      this.el.modalTitle.textContent = 'À propos d\'AstralBlender';
      this.el.modalBody.innerHTML = '<p><b>AstralBlender</b> — modélisation 3D légère, 100 % Canvas 2D.</p>' +
        '<p>Rendu par rasterisation logicielle (algorithme du peintre) et éclairage lambertien, sans WebGL ni aucune dépendance.</p>' +
        '<p>Ajoutez des primitives, déplacez-les, orbitez avec le bouton du milieu de la souris et exportez en PNG ou OBJ.</p>';
      if (this.el.modalOk) this.el.modalOk.style.display = 'none';
      if (this.el.modalCancel) this.el.modalCancel.textContent = 'Fermer';
      this.el.modal.classList.add('open');
    },

    status: function (msg) {
      if (this.el.statusLeft) this.el.statusLeft.textContent = msg;
    },

    /* ---- render ---- */
    render: function () {
      if (!App.scene) return;
      if (this.el.undoBtn) this.el.undoBtn.disabled = !App.canUndo();
      if (this.el.redoBtn) this.el.redoBtn.disabled = !App.canRedo();
      if (this.el.shadeSel && document.activeElement !== this.el.shadeSel) {
        this.el.shadeSel.value = App.shading === 'wireframe' ? 'wireframe' : (App.showEdges ? 'edges' : 'solid');
      }
      if (this.el.edgesChk) this.el.edgesChk.checked = !!App.showEdges;
      if (this.el.gridChk) this.el.gridChk.checked = !!App.showGrid;
      if (this.el.axesChk) this.el.axesChk.checked = !!App.showAxes;

      this.renderObjects();
      this.renderTransform();

      var count = App.scene.objects.length;
      if (this.el.statusObjects) this.el.statusObjects.textContent = count + (count > 1 ? ' objets' : ' objet');
      var sel = App.selectedIds().length;
      if (this.el.statusSel) this.el.statusSel.textContent = sel ? sel + ' sélectionné' + (sel > 1 ? 's' : '') : 'aucune sélection';
      if (this.el.statusDist) this.el.statusDist.textContent = 'distance ' + r2(App.camera.distance);
      if (this.el.distVal) this.el.distVal.textContent = r2(App.camera.distance).toFixed(1);

      Renderer.draw();
    },

    renderObjects: function () {
      var list = this.el.objList;
      if (!list) return;
      while (list.firstChild) list.removeChild(list.firstChild);
      for (var i = 0; i < App.scene.objects.length; i++) {
        var obj = App.scene.objects[i];
        var row = document.createElement('div');
        row.className = 'obj-row' + (App.selection[obj.id] ? ' selected' : '');
        row.setAttribute('data-obj', obj.id);

        var eye = document.createElement('button');
        eye.className = 'obj-eye' + (obj.visible ? '' : ' off');
        eye.textContent = obj.visible ? '◉' : '◌';
        eye.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = e.currentTarget.parentNode.getAttribute('data-obj');
          var o = App.objectById(id);
          if (o) { o.visible = !o.visible; App.commit('Visibilité'); }
        });

        var swatch = document.createElement('span');
        swatch.className = 'obj-swatch';
        swatch.style.background = obj.color;

        var name = document.createElement('span');
        name.className = 'obj-name';
        name.textContent = obj.name;

        var type = document.createElement('span');
        type.className = 'obj-type';
        type.textContent = obj.type;

        row.appendChild(eye);
        row.appendChild(swatch);
        row.appendChild(name);
        row.appendChild(type);
        row.addEventListener('click', function (e) {
          var id = e.currentTarget.getAttribute('data-obj');
          if (e.shiftKey) App.toggleSelect(id);
          else App.select(id);
        });
        list.appendChild(row);
      }
    },

    renderTransform: function () {
      var sel = App.selected();
      if (this.el.xfEmpty) this.el.xfEmpty.style.display = sel.length ? 'none' : '';
      if (this.el.xfBody) this.el.xfBody.style.display = sel.length ? '' : 'none';
      if (!sel.length) return;
      var o = sel[0];
      setInput('objName', o.name);
      setInput('objColor', o.color);
      setInput('px', r2(o.position.x));
      setInput('py', r2(o.position.y));
      setInput('pz', r2(o.position.z));
      setInput('rx', r2(o.rotation.x * 180 / Math.PI));
      setInput('ry', r2(o.rotation.y * 180 / Math.PI));
      setInput('rz', r2(o.rotation.z * 180 / Math.PI));
      setInput('sx', r2(o.scale.x));
      setInput('sy', r2(o.scale.y));
      setInput('sz', r2(o.scale.z));
    }
  };

  global.UI = UI;
})(window);

(function (global) {
  'use strict';

  var App = global.App;
  var U = global.Utils;

  var UNITS = U.UNITS;
  var UNIT_LABEL = U.UNIT_LABEL;

  var CATS = [
    {
      id: 'imprime', label: 'Imprimé', presets: [
        { name: 'A4 Portrait', w: 210, h: 297, u: 'mm' },
        { name: 'A4 Paysage', w: 297, h: 210, u: 'mm' },
        { name: 'A3', w: 297, h: 420, u: 'mm' },
        { name: 'A5', w: 148, h: 210, u: 'mm' },
        { name: 'B5', w: 176, h: 250, u: 'mm' },
        { name: 'Lettre', w: 8.5, h: 11, u: 'in' }
      ]
    },
    {
      id: 'web', label: 'Web', presets: [
        { name: 'Bureau large', w: 1920, h: 1080, u: 'px' },
        { name: 'Bureau', w: 1440, h: 900, u: 'px' },
        { name: 'Portable', w: 1366, h: 768, u: 'px' },
        { name: 'Standard', w: 1280, h: 800, u: 'px' },
        { name: 'HD', w: 1280, h: 720, u: 'px' },
        { name: 'Netbook', w: 1024, h: 768, u: 'px' }
      ]
    },
    {
      id: 'mobile', label: 'Mobile', presets: [
        { name: 'iPhone X', w: 375, h: 812, u: 'px' },
        { name: 'iPhone 8', w: 375, h: 667, u: 'px' },
        { name: 'Android', w: 360, h: 640, u: 'px' },
        { name: 'Pixel', w: 412, h: 732, u: 'px' },
        { name: 'iPad', w: 768, h: 1024, u: 'px' },
        { name: 'Tablette 7"', w: 600, h: 960, u: 'px' }
      ]
    },
    {
      id: 'social', label: 'Réseaux sociaux', presets: [
        { name: 'Post carré', w: 1080, h: 1080, u: 'px' },
        { name: 'Story', w: 1080, h: 1920, u: 'px' },
        { name: 'Couverture', w: 1640, h: 856, u: 'px' },
        { name: 'Bannière', w: 1500, h: 500, u: 'px' },
        { name: 'Miniature', w: 1280, h: 720, u: 'px' },
        { name: 'Profil', w: 400, h: 400, u: 'px' }
      ]
    },
    {
      id: 'video', label: 'Vidéo', presets: [
        { name: 'HD', w: 1920, h: 1080, u: 'px' },
        { name: '2K', w: 2560, h: 1440, u: 'px' },
        { name: '4K', w: 3840, h: 2160, u: 'px' },
        { name: 'SD', w: 720, h: 480, u: 'px' },
        { name: 'Cinéma', w: 2048, h: 858, u: 'px' },
        { name: 'Vertical', w: 1080, h: 1920, u: 'px' }
      ]
    },
    {
      id: 'art', label: 'Art et illustration', presets: [
        { name: 'Carré', w: 1000, h: 1000, u: 'px' },
        { name: 'Affiche', w: 800, h: 1200, u: 'px' },
        { name: 'Carte de visite', w: 1050, h: 600, u: 'px' },
        { name: 'Fond d\'écran', w: 2560, h: 1440, u: 'px' },
        { name: 'Croquis', w: 1200, h: 900, u: 'px' },
        { name: 'Logo', w: 512, h: 512, u: 'px' }
      ]
    }
  ];

  function el(id) { return document.getElementById(id); }
  function on(node, evt, fn) { if (node) node.addEventListener(evt, fn); }

  function fmt(px, unit) {
    var v = px / UNITS[unit];
    var r = Math.round(v * 100) / 100;
    return String(r);
  }

  var DocDialog = {
    els: {},
    state: null,
    resizeMode: false,
    lastCat: 'web',
    _lastFocus: null,

    init: function () {
      this.els = {
        root: el('docDialog'),
        cats: el('ddCats'),
        presets: el('ddPresets'),
        empty: el('ddEmpty'),
        presetName: el('ddPresetName'),
        name: el('ddName'),
        w: el('ddW'),
        h: el('ddH'),
        unit: el('ddUnit'),
        hint: el('ddHint'),
        create: el('ddCreate'),
        close: el('ddClose'),
        cancel: el('ddCancel'),
        docName: el('docName')
      };
      if (!this.els.root) return;
      var self = this;

      on(this.els.cats, 'click', function (e) {
        var b = e.target.closest('.dd-cat');
        if (b) self.selectCategory(b.getAttribute('data-cat'));
      });
      on(this.els.presets, 'click', function (e) {
        var card = e.target.closest('.dd-card');
        if (card) self.selectPreset(parseInt(card.getAttribute('data-idx'), 10));
      });
      on(this.els.presets, 'dblclick', function (e) {
        if (e.target.closest('.dd-card')) self.create();
      });

      on(this.els.w, 'change', function () {
        var v = parseFloat(self.els.w.value);
        if (!isNaN(v)) { self.state.wpx = Math.max(1, v) * UNITS[self.state.unit]; self.state.presetName = null; self.render(); }
      });
      on(this.els.h, 'change', function () {
        var v = parseFloat(self.els.h.value);
        if (!isNaN(v)) { self.state.hpx = Math.max(1, v) * UNITS[self.state.unit]; self.state.presetName = null; self.render(); }
      });
      on(this.els.unit, 'change', function () { self.setUnit(self.els.unit.value); });
      this.els.root.querySelectorAll('.dd-orient button').forEach(function (b) {
        on(b, 'click', function () { self.setOrientation(b.getAttribute('data-orient')); });
      });
      on(this.els.create, 'click', function () { self.create(); });
      on(this.els.close, 'click', function () { self.close(); });
      if (this.els.cancel) on(this.els.cancel, 'click', function () { self.close(); });
      on(document, 'keydown', function (e) {
        if (!self.isOpen()) return;
        if (e.key === 'Escape') { e.preventDefault(); self.close(); return; }
        if (e.key === 'Tab') {
          var f = self.focusables();
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });

      this.state = { catId: 'web', presetName: 'Bureau large', wpx: 1920, hpx: 1080, unit: 'px' };
      this.render();
    },

    open: function () {
      if (!this.els.root) return;
      this.resizeMode = false;
      if (this.els.name) this.els.name.parentElement.style.display = '';
      this.els.root.classList.remove('hidden');
      this.render();
      this.focusIn();
    },

    openForResize: function () {
      if (!this.els.root) return;
      this.resizeMode = true;
      var catId = this.state ? this.state.catId : this.lastCat;
      this.state = {
        catId: catId, presetName: null,
        wpx: App.artboard.w, hpx: App.artboard.h, unit: App.unit
      };
      if (this.els.name) this.els.name.parentElement.style.display = 'none';
      this.els.root.classList.remove('hidden');
      this.render();
      this.focusIn();
    },

    close: function () {
      if (this.els.root) this.els.root.classList.add('hidden');
      if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
      this._lastFocus = null;
    },

    focusables: function () {
      if (!this.els.root || !this.els.root.querySelectorAll) return [];
      var list = this.els.root.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
      return Array.prototype.slice.call(list).filter(function (el) { return !el.disabled; });
    },

    focusIn: function () {
      this._lastFocus = document.activeElement;
      var target = this.resizeMode ? this.els.create : this.els.name;
      if (target && target.focus) target.focus();
      if (target && target.select) { try { target.select(); } catch (e) { } }
    },

    isOpen: function () { return this.els.root && !this.els.root.classList.contains('hidden'); },

    cat: function (id) {
      for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i];
      return CATS[0];
    },

    selectCategory: function (id) {
      var cat = this.cat(id);
      this.state.catId = id;
      this.lastCat = id;
      if (cat.presets.length) this.applyPreset(cat.presets[0]);
      this.render();
    },

    applyPreset: function (p) {
      this.state.presetName = p.name;
      this.state.unit = p.u;
      this.state.wpx = p.w * UNITS[p.u];
      this.state.hpx = p.h * UNITS[p.u];
    },

    selectPreset: function (idx) {
      var cat = this.cat(this.state.catId);
      var p = cat.presets[idx];
      if (p) this.applyPreset(p);
      this.render();
    },

    setUnit: function (unit) {
      if (!UNITS[unit]) return;
      this.state.unit = unit;
      this.render();
    },

    setOrientation: function (o) {
      var w = this.state.wpx, h = this.state.hpx;
      if (o === 'landscape' && h > w) { this.state.wpx = h; this.state.hpx = w; }
      if (o === 'portrait' && w > h) { this.state.wpx = h; this.state.hpx = w; }
      this.render();
    },

    render: function () {
      if (!this.els.root) return;
      var self = this;

      var catsHtml = '';
      CATS.forEach(function (c) {
        var on = c.id === self.state.catId;
        catsHtml += '<button class="dd-cat' + (on ? ' active' : '') + '" data-cat="' + c.id + '" aria-pressed="' + on + '">' + c.label + '</button>';
      });
      this.els.cats.innerHTML = catsHtml;

      var cat = this.cat(this.state.catId);
      var html = '';
      cat.presets.forEach(function (p, i) {
        var active = (self.state.presetName === p.name &&
          Math.abs(self.state.wpx - p.w * UNITS[p.u]) < 0.5 &&
          Math.abs(self.state.hpx - p.h * UNITS[p.u]) < 0.5);
        var scale = Math.min(92 / p.w, 62 / p.h);
        var tw = Math.max(20, Math.round(p.w * scale));
        var th = Math.max(20, Math.round(p.h * scale));
        html += '<button class="dd-card' + (active ? ' active' : '') + '" data-idx="' + i + '" aria-pressed="' + active + '">' +
          '<span class="dd-thumb" style="width:' + tw + 'px;height:' + th + 'px"></span>' +
          '<span class="dd-cname">' + p.name + '</span>' +
          '<span class="dd-csize">' + p.w + ' &#215; ' + p.h + ' ' + UNIT_LABEL[p.u] + '</span>' +
          '</button>';
      });
      this.els.presets.innerHTML = html;
      this.els.empty.style.display = cat.presets.length ? 'none' : 'block';

      this.els.presetName.textContent = this.resizeMode
        ? 'Plan de travail'
        : (this.state.presetName || 'Document personnalisé');
      this.els.w.value = fmt(this.state.wpx, this.state.unit);
      this.els.h.value = fmt(this.state.hpx, this.state.unit);
      this.els.unit.value = this.state.unit;
      this.els.create.textContent = this.resizeMode ? 'Appliquer' : 'Créer le document';

      var landscape = this.state.wpx >= this.state.hpx;
      this.els.root.querySelectorAll('.dd-orient button').forEach(function (b) {
        var o = b.getAttribute('data-orient');
        var on = (o === 'landscape') === landscape;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });

      this.els.hint.textContent = Math.round(this.state.wpx) + ' \u00d7 ' + Math.round(this.state.hpx) + ' px · ' +
        (landscape ? 'Paysage' : 'Portrait');
    },

    create: function () {
      var W = Math.max(1, Math.round(this.state.wpx));
      var H = Math.max(1, Math.round(this.state.hpx));
      App.unit = this.state.unit;

      if (this.resizeMode) {
        App.artboard = { x: 0, y: 0, w: W, h: H };
        this.resizeMode = false;
        this.close();
        var wsel = el('workspace');
        if (wsel) { var rr = wsel.getBoundingClientRect(); App.fitToView(rr.width, rr.height); }
        App.emit('change'); App.emit('selection'); App.emit('view');
        return;
      }

      App.artboard = { x: 0, y: 0, w: W, h: H };
      App.newDocument();

      var name = this.els.name.value.trim() || 'Sans titre';
      if (this.els.docName) this.els.docName.value = name;
      document.title = name + ' — AstralIon';

      this.close();

      var ws = el('workspace');
      if (ws) {
        var r = ws.getBoundingClientRect();
        App.fitToView(r.width, r.height);
      }
      App.emit('change');
      App.emit('selection');
      App.emit('view');
    }
  };

  global.DocDialog = DocDialog;
})(window);

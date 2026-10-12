(function (global) {
  'use strict';

  var U = global.Utils;
  var App = global.App;

  var CATEGORIES = [
    { id: 'blank', label: 'Vide', presets: [
      { name: 'Défaut 1000 × 700', w: 1000, h: 700, unit: 'px' }
    ] },
    { id: 'photo', label: 'Photo', presets: [
      { name: 'Paysage 3000 × 2000', w: 3000, h: 2000, unit: 'px' },
      { name: 'Portrait 2000 × 3000', w: 2000, h: 3000, unit: 'px' },
      { name: 'Carré 2048 × 2048', w: 2048, h: 2048, unit: 'px' },
      { name: '10 × 15 cm 300 dpi', w: 10, h: 15, unit: 'cm' }
    ] },
    { id: 'print', label: 'Impression', presets: [
      { name: 'A4 210 × 297 mm', w: 210, h: 297, unit: 'mm' },
      { name: 'A3 297 × 420 mm', w: 297, h: 420, unit: 'mm' },
      { name: 'A5 148 × 210 mm', w: 148, h: 210, unit: 'mm' },
      { name: 'Lettre 8,5 × 11 in', w: 8.5, h: 11, unit: 'in' }
    ] },
    { id: 'web', label: 'Web', presets: [
      { name: 'Bannière 1920 × 480', w: 1920, h: 480, unit: 'px' },
      { name: 'Desktop 1440 × 900', w: 1440, h: 900, unit: 'px' },
      { name: 'Tablette 768 × 1024', w: 768, h: 1024, unit: 'px' },
      { name: 'Mobile 390 × 844', w: 390, h: 844, unit: 'px' }
    ] },
    { id: 'video', label: 'Vidéo', presets: [
      { name: 'HD 1280 × 720', w: 1280, h: 720, unit: 'px' },
      { name: 'Full HD 1920 × 1080', w: 1920, h: 1080, unit: 'px' },
      { name: '4K UHD 3840 × 2160', w: 3840, h: 2160, unit: 'px' }
    ] }
  ];

  var Dialog = {
    cat: 'blank',
    preset: null,
    orientation: 'landscape',
    el: {},
    inited: false,

    init: function () {
      if (this.inited) return;
      this.inited = true;
      var g = function (id) { return document.getElementById(id); };
      this.el = {
        root: g('docDialog'), cats: g('ddCats'), presets: g('ddPresets'),
        empty: g('ddEmpty'), presetName: g('ddPresetName'), name: g('ddName'),
        w: g('ddW'), h: g('ddH'), unit: g('ddUnit'), hint: g('ddHint'),
        bg: g('ddBg'), orient: g('ddOrient'), create: g('ddCreate'),
        cancel: g('ddCancel'), close: g('ddClose')
      };
      var self = this;
      if (this.el.close) this.el.close.addEventListener('click', function () { self.close(); });
      if (this.el.cancel) this.el.cancel.addEventListener('click', function () { self.close(); });
      if (this.el.create) this.el.create.addEventListener('click', function () { self.create(); });
      if (this.el.unit) this.el.unit.addEventListener('change', function () {
        var v = self.currentPx();
        self.setUnitFields(self.el.unit.value, self.el.w.value, self.el.h.value);
      });
      var orientBtns = this.el.orient ? this.el.orient.querySelectorAll('button') : [];
      for (var i = 0; i < orientBtns.length; i++) {
        orientBtns[i].addEventListener('click', function () {
          self.orientation = this.getAttribute('data-orient') || 'landscape';
          self.applyOrientation();
        });
      }
      this.renderCats();
      this.renderPresets();
      this.selectPreset(CATEGORIES[0].presets[0]);
    },

    open: function () {
      if (this.el.root) this.el.root.classList.add('open');
    },
    close: function () {
      if (this.el.root) this.el.root.classList.remove('open');
    },

    renderCats: function () {
      var self = this;
      if (!this.el.cats) return;
      this.el.cats.innerHTML = '';
      CATEGORIES.forEach(function (c) {
        var b = document.createElement('button');
        b.textContent = c.label;
        b.className = c.id === self.cat ? 'active' : '';
        b.addEventListener('click', function () {
          self.cat = c.id;
          self.renderCats();
          self.renderPresets();
        });
        self.el.cats.appendChild(b);
      });
    },

    renderPresets: function () {
      var self = this;
      if (!this.el.presets) return;
      this.el.presets.innerHTML = '';
      var cat = CATEGORIES.filter(function (c) { return c.id === self.cat; })[0];
      var list = cat ? cat.presets : [];
      if (this.el.empty) this.el.empty.style.display = list.length ? 'none' : 'block';
      list.forEach(function (p) {
        var b = document.createElement('button');
        b.className = 'dd-preset';
        var ratio = p.w / p.h;
        var vw = ratio >= 1 ? 46 : 46 * ratio;
        var vh = ratio >= 1 ? 46 / ratio : 46;
        b.innerHTML = '<span class="dd-thumb" style="width:' + vw.toFixed(0) + 'px;height:' + vh.toFixed(0) + 'px"></span>' +
          '<span class="dd-pname">' + p.name + '</span>';
        b.addEventListener('click', function () { self.selectPreset(p); });
        self.el.presets.appendChild(b);
      });
    },

    selectPreset: function (p) {
      this.preset = p;
      this.orientation = p.w >= p.h ? 'landscape' : 'portrait';
      if (this.el.presetName) this.el.presetName.textContent = p.name;
      if (this.el.name) this.el.name.value = 'Sans titre';
      this.setUnitFields(p.unit || 'px', p.w, p.h);
    },

    setUnitFields: function (unit, w, h) {
      if (this.el.unit) this.el.unit.value = unit;
      var wpx = typeof w === 'number' ? w * (U.UNITS[unit] || 1) : parseFloat(w) * (U.UNITS[unit] || 1);
      var hpx = typeof h === 'number' ? h * (U.UNITS[unit] || 1) : parseFloat(h) * (U.UNITS[unit] || 1);
      this._px = { w: Math.round(wpx), h: Math.round(hpx) };
      if (this.el.w) this.el.w.value = Math.round(wpx / (U.UNITS[unit] || 1) * 100) / 100;
      if (this.el.h) this.el.h.value = Math.round(hpx / (U.UNITS[unit] || 1) * 100) / 100;
      this.updateHint();
    },

    currentPx: function () {
      var unit = this.el.unit ? this.el.unit.value : 'px';
      var wv = parseFloat(this.el.w ? this.el.w.value : 0) || 0;
      var hv = parseFloat(this.el.h ? this.el.h.value : 0) || 0;
      var conv = U.UNITS[unit] || 1;
      return { w: Math.round(wv * conv), h: Math.round(hv * conv), unit: unit };
    },

    applyOrientation: function () {
      var wv = parseFloat(this.el.w ? this.el.w.value : 0) || 0;
      var hv = parseFloat(this.el.h ? this.el.h.value : 0) || 0;
      var land = wv >= hv;
      if (this.orientation === 'landscape' && !land) { this.swap(); }
      else if (this.orientation === 'portrait' && land) { this.swap(); }
      this.updateHint();
    },

    swap: function () {
      var w = this.el.w.value; this.el.w.value = this.el.h.value; this.el.h.value = w;
    },

    updateHint: function () {
      var px = this.currentPx();
      if (this.el.hint) this.el.hint.textContent = 'Dimensions : ' + px.w + ' × ' + px.h + ' pixels';
    },

    create: function () {
      var px = this.currentPx();
      if (px.w < 1 || px.h < 1) { alert('Dimensions invalides.'); return; }
      var bg = this.el.bg ? this.el.bg.value : 'white';
      var background = bg === 'transparent' ? 'transparent' : bg === 'black' ? '#000000' : '#ffffff';
      App.newDocument({
        name: this.el.name ? this.el.name.value : 'Sans titre',
        width: px.w, height: px.h, background: background
      });
      this.close();
      global.Renderer.resize();
      global.App.fitToView(global.Renderer.viewW, global.Renderer.viewH);
      global.Renderer.draw();
    }
  };

  global.DocDialog = Dialog;
})(typeof window !== 'undefined' ? window : this);

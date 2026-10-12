const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 800, height: 600 };
      if (p === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (!(p in t)) t[p] = function () {};
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function makeEl(id) {
  const el = {
    id: id || '',
    style: {},
    dataset: {},
    value: '',
    min: 0,
    max: 100,
    textContent: '',
    innerHTML: '',
    disabled: false,
    checked: false,
    width: 100,
    height: 100,
    clientWidth: 800,
    clientHeight: 600,
    files: [],
    children: [],
    _listeners: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    querySelectorAll() { return this._qsa || []; },
    querySelector() { return null; },
    closest() { return null; },
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; },
    parentElement: { style: {} },
    setPointerCapture() {},
    releasePointerCapture() {},
    getContext() { return this._ctx || (this._ctx = makeCtx()); },
    toBlob(cb) { cb({}); },
    toDataURL() { return 'data:image/png;base64,'; }
  };
  return el;
}

const registry = {};
function getEl(id) {
  if (!registry[id]) registry[id] = makeEl(id);
  return registry[id];
}

const documentStub = {
  readyState: 'complete',
  activeElement: null,
  body: makeEl('body'),
  title: '',
  getElementById: getEl,
  createElement: (tag) => makeEl(tag),
  createRange: () => ({ selectNodeContents() {}, setStart() {}, setEnd() {} }),
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; }
};

const sandbox = {
  console,
  setTimeout: (() => { let t = 1; return () => t++; })(),
  clearTimeout: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  devicePixelRatio: 2,
  Blob: function () {},
  Image: function () { this.onload = null; },
  FileReader: function () { this.readAsDataURL = function () {}; },
  Uint8ClampedArray,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  prompt: () => null,
  confirm: () => true,
  alert: () => {},
  navigator: { userAgent: 'node' },
  document: documentStub,
  ResizeObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
  addEventListener() {},
  removeEventListener() {},
  Math,
  JSON
};
sandbox.window = sandbox;

registry.workspace = makeEl('workspace');

vm.createContext(sandbox);

const files = ['utils.js', 'pixels.js', 'layer.js', 'selection.js', 'filters.js', 'app.js', 'render.js', 'tools.js', 'document.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
const errors = [];
for (const f of files) {
  const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
    console.log('loaded', f);
  } catch (e) {
    errors.push(f + ': ' + e.stack);
    console.log('ERROR loading', f, e.message);
  }
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }

const { App, Utils, Pixels, Selection, Filters, Layer, Renderer, Tools, UI } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function fresh(w, h) {
  App.newDocument({ name: 'test', width: w || 100, height: h || 80, background: '#ffffff' });
}

console.log('\n-- utils / couleurs --');
ok('hexToRgb #ff8800', JSON.stringify(Utils.hexToRgb('#ff8800')) === JSON.stringify({ r: 255, g: 136, b: 0 }));
ok('hexToRgb 3 chiffres', Utils.hexToRgb('#abc').r === 170);
ok('rgbToHex aller-retour', Utils.rgbToHex(255, 136, 0) === '#ff8800');
ok('clamp', Utils.clamp(15, 0, 10) === 10);
ok('pointInPolygon (dans)', Utils.pointInPolygon(50, 50, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) === true);
ok('pointInPolygon (hors)', Utils.pointInPolygon(150, 50, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) === false);
ok('hslToRgb rouge', (function () { var c = Utils.hslToRgb(0, 1, 0.5); return Math.abs(c.r - 255) < 1 && c.g < 1 && c.b < 1; })());

console.log('\n-- pixels --');
const img = Pixels.create(4, 4);
Pixels.set(img, 1, 1, { r: 10, g: 20, b: 30, a: 255 });
ok('set/get pixel', Pixels.get(img, 1, 1).r === 10);
ok('get hors limites = transparent', Pixels.get(img, 9, 9).a === 0);
const filled = Pixels.create(5, 5, { r: 0, g: 0, b: 0, a: 255 });
Pixels.fillRect(filled, 1, 1, 3, 3, { r: 255, g: 0, b: 0, a: 255 }, 1);
ok('fillRect touche le centre', Pixels.get(filled, 2, 2).r === 255);
ok('fillRect n\'affecte pas le bord', Pixels.get(filled, 0, 0).r === 0);
const ff = Pixels.create(4, 4, { r: 255, g: 255, b: 255, a: 255 });
const changed = Pixels.floodFill(ff, 0, 0, { r: 0, g: 0, b: 0, a: 255 }, 0, null);
ok('floodFill remplit tout', changed === 16);
ok('floodFill couleur appliquée', Pixels.get(ff, 3, 3).r === 0);
const barrier = Pixels.create(5, 1, { r: 255, g: 255, b: 255, a: 255 });
Pixels.set(barrier, 2, 0, { r: 0, g: 0, b: 0, a: 255 });
const c2 = Pixels.floodFill(barrier, 0, 0, { r: 0, g: 0, b: 0, a: 255 }, 0, null);
ok('floodFill stoppé par barrière', c2 === 2, c2);
ok('colorDistance identique = 0', Pixels.colorDistance({ r: 1, g: 2, b: 3, a: 4 }, { r: 1, g: 2, b: 3, a: 4 }) === 0);

console.log('\n-- sélection --');
const rsel = Selection.rect(50, 50, 10, 20);
ok('rect: pas de normalisation', rsel.x === 50 && rsel.w === 10);
const nsel = Selection.rect(60, 70, -10, -20);
ok('rect négatif normalisé', nsel.x === 50 && nsel.y === 50 && nsel.w === 10 && nsel.h === 20);
const esel = Selection.ellipse(0, 0, 100, 100);
ok('ellipse: centre inclus', Selection.contains(esel, 50, 50) === true);
ok('ellipse: coin exclu', Selection.contains(esel, 2, 2) === false);
const lsel = Selection.lasso([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
ok('lasso bounds', lsel.w === 100 && lsel.h === 100);
ok('lasso contient point', Selection.contains(lsel, 50, 50) === true);
ok('sélection vide', Selection.isEmpty(Selection.none()) === true);
const mask = Selection.maskFn(esel);
ok('maskFn exclut coin', mask(1, 1) === false && mask(50, 50) === true);
let clipped = false;
Selection.clip({ beginPath(){}, rect(){ clipped = true; }, ellipse(){}, clip(){}, moveTo(){}, lineTo(){}, closePath(){} }, rsel);
ok('clip appliqué', clipped === true);

console.log('\n-- filtres --');
const fimg = Pixels.create(1, 1);
Pixels.set(fimg, 0, 0, { r: 10, g: 20, b: 30, a: 255 });
const inv = Filters.invert(fimg);
ok('invert', inv.data[0] === 245 && inv.data[2] === 225);
const grey = Filters.grayscale(fimg);
ok('grayscale gris', grey.data[0] === grey.data[1] && grey.data[1] === grey.data[2]);
const bright = Filters.brightnessContrast(fimg, { brightness: 0, contrast: 0 });
ok('brightness identité', Math.abs(bright.data[0] - 10) < 1.5);
const th = Filters.threshold(fimg, 30);
ok('threshold noir', th.data[0] === 0);
const post = Filters.posterize(fimg, 2);
ok('posterize bornée', post.data[0] === 0 || post.data[0] === 255);
const blur = Filters.boxBlur(Pixels.create(3, 3, { r: 100, g: 100, b: 100, a: 255 }), 1);
ok('boxBlur dimensions', blur.width === 3 && blur.height === 3);
const sharp = Filters.sharpen(fimg, 1);
ok('sharpen dimensions', sharp.width === 1);

console.log('\n-- calques --');
const lyr = Layer.create({ width: 10, height: 10, name: 'Test' });
ok('layer.create', lyr.canvas.width === 10 && lyr.opacity === 1 && lyr.blend === 'source-over');
const lyr2 = Layer.clone(lyr);
ok('layer.clone', lyr2.id !== lyr.id && lyr2.canvas.width === 10);
ok('layer.blendLabel', Layer.blendLabel('multiply') === 'Produit');

console.log('\n-- document & état --');
fresh(200, 150);
ok('doc dimensions', App.doc.width === 200 && App.doc.height === 150);
ok('un calque initial', App.doc.layers.length === 1);
App.setFg('#123456');
ok('setFg', App.fg === '#123456');
App.swapColors();
ok('swapColors', App.fg === '#ffffff' && App.bg === '#123456');
App.resetColors();
ok('resetColors', App.fg === '#000000' && App.bg === '#ffffff');

console.log('\n-- historique --');
fresh(100, 100);
App.setFg('#ff0000');
App.commit('dessin', function () { App.activeLayer().name = 'Modifié'; });
ok('commit modifie', App.activeLayer().name === 'Modifié');
ok('historique 1', App.history.past.length === 1);
App.undo();
ok('undo restaure le nom', App.activeLayer().name !== 'Modifié');
App.redo();
ok('redo réeffectue', App.activeLayer().name === 'Modifié');

console.log('\n-- opérations calques --');
fresh(100, 100);
const baseId = App.doc.activeId;
App.addLayer({ name: 'Calque 2' });
ok('addLayer', App.doc.layers.length === 2 && App.doc.activeId !== baseId);
const secondId = App.doc.activeId;
App.moveLayer(secondId, 'down');
ok('moveLayer down', App.doc.layers[0].id === secondId);
App.duplicateLayer(secondId);
ok('duplicateLayer', App.doc.layers.length === 3);
App.removeLayer(secondId);
ok('removeLayer', App.doc.layers.length === 2);
App.undo();
ok('undo re-crée le calque', App.doc.layers.length === 3);

console.log('\n-- sélection (app) --');
fresh(100, 100);
App.selectAll();
ok('selectAll', App.selection.active && App.selection.w === 100);
App.clearSelection();
ok('clearSelection', App.selection.active === false);

console.log('\n-- recadrage & redimensionnement --');
fresh(100, 100);
App.crop({ x: 10, y: 10, w: 50, h: 40 });
ok('crop dims', App.doc.width === 50 && App.doc.height === 40);
App.resizeDocument(200, 120, null);
ok('resizeDocument', App.doc.width === 200 && App.doc.height === 120);
ok('layer suit le doc', App.doc.layers[0].canvas.width === 200);

console.log('\n-- caméra --');
fresh(400, 300);
App.camera.zoom = 2; App.camera.pan.x = 100; App.camera.pan.y = 50;
const back = App.screenToWorld(App.worldToScreen(30, 40).x, App.worldToScreen(30, 40).y);
ok('aller-retour écran/monde', Math.abs(back.x - 30) < 0.001 && Math.abs(back.y - 40) < 0.001);
App.fitToView(800, 600);
ok('fitToView zoom > 0', App.camera.zoom > 0);

console.log('\n-- outils --');
const gctx = ({ beginPath(){}, moveTo(){}, lineTo(){}, arcTo(){}, closePath(){}, save(){}, restore(){}, fill(){}, rect(){}, ellipse(){} });
let threw = false;
try { Tools.shape(gctx, 'rect', { x: 0, y: 0, w: 10, h: 10 }, '#ff0000', 0); } catch (e) { threw = true; console.log('   ', e.message); }
ok('Tools.shape sans erreur', !threw);

console.log('\n-- rendu --');
fresh(300, 200);
let drew = true;
try { Renderer.draw(); } catch (err) { drew = false; console.log('   ', err.message); }
ok('Renderer.draw sans erreur', drew);
App.selection = Selection.rect(10, 10, 50, 50);
try { Renderer.draw(); } catch (err) { drew = false; console.log('   ', err.message); }
ok('Renderer.draw avec sélection', drew);

console.log('\n-- export --');
const flat = sandbox.Exporter.flatten('#ffffff');
ok('flatten produit un canvas', flat && flat.width === 300);

console.log('\n' + pass + ' réussis, ' + fail + ' échecs');
process.exit(fail ? 1 : 0);

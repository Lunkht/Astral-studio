const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 800, height: 600 };
      if (p === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'getImageData') return (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
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
    querySelector() { return this._qs || null; },
    closest() { return null; },
    getAttribute() { return null; },
    setAttribute() {},
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; },
    parentElement: { style: {}, getBoundingClientRect() { return { width: 800, height: 600 }; } },
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
  readyState: 'loading',
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

const files = ['utils.js', 'shapes.js', 'layer.js', 'app.js', 'timeline.js', 'tools.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { App, Utils, Shapes, Layer, Tools, Export, Timeline } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function fresh(w, h) {
  App.newDocument({ name: 'test', width: w || 200, height: h || 150, fps: 12, frameCount: 24, background: '#ffffff' });
}

console.log('\n-- utils --');
ok('clamp borne haut', Utils.clamp(15, 0, 10) === 10);
ok('clamp borne bas', Utils.clamp(-5, 0, 10) === 0);
ok('lerp milieu', Utils.lerp(0, 100, 0.5) === 50);
ok('round 2 dec', Utils.round(1.2345) === 1.23);
ok('easeInOut(0.5)', Math.abs(Utils.easeInOut(0.5) - 0.5) < 1e-9);
ok('easeOut(0)', Utils.easeOut(0) === 0);
ok('easeIn(1)', Utils.easeIn(1) === 1);
ok('pointInRect dedans', Utils.pointInRect(5, 5, 0, 0, 10, 10) === true);
ok('pointInRect dehors', Utils.pointInRect(50, 5, 0, 0, 10, 10) === false);
ok('pointSegmentDistance', Math.abs(Utils.pointSegmentDistance(5, 5, 0, 0, 10, 0) - 5) < 1e-9);
ok('deepClone indépendant', (function () { var a = { x: 1 }; var b = Utils.deepClone(a); b.x = 2; return a.x === 1 && b.x === 2; })());

console.log('\n-- shapes --');
const rect = Shapes.create('rect', { x: 10, y: 10, w: 50, h: 40 });
ok('create: type', rect.type === 'rect');
ok('create: id unique', Shapes.create('rect').id !== rect.id);
ok('hitTest intérieur', Shapes.hitTest(rect, 20, 20) === true);
ok('hitTest extérieur', Shapes.hitTest(rect, 200, 200) === false);
const ell = Shapes.create('ellipse', { x: 0, y: 0, w: 100, h: 100 });
ok('ellipse: centre', Shapes.hitTest(ell, 50, 50) === true);
ok('ellipse: coin', Shapes.hitTest(ell, 2, 2) === false);
const poly = Shapes.create('pencil', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }] });
const pb = Shapes.bounds(poly);
ok('bounds chemin', pb.x === 0 && pb.w === 100 && pb.h === 50);
ok('hitTest chemin proche', Shapes.hitTest(poly, 50, 1) === true);
ok('hitTest chemin loin', Shapes.hitTest(poly, 50, 80) === false);
const inter = Shapes.interpolate(Shapes.create('rect', { x: 0, y: 0 }), Shapes.create('rect', { x: 100, y: 50 }), 0.5);
ok('interpolate x', inter.x === 50 && inter.y === 25);

console.log('\n-- layer / images clés --');
const layer = Layer.create('Couche');
const sa = Shapes.create('rect', { x: 0, y: 0, w: 10, h: 10 });
const sb = Shapes.create('rect', { x: 100, y: 0, w: 10, h: 10 });
Layer.setKey(layer, 0, [sa]);
Layer.setKey(layer, 10, [sb]);
ok('keyAt(0)', Layer.keyAt(layer, 0) != null);
ok('keyAt absent', Layer.keyAt(layer, 5) === null);
ok('prevKey', Layer.prevKey(layer, 5).frame === 0);
ok('nextKey', Layer.nextKey(layer, 5).frame === 10);
ok('keyFrames triés', JSON.stringify(Layer.keyFrames(layer)) === '[0,10]');
const mid = Layer.renderAt(layer, 5);
ok('interpolation entre clés', Math.abs(mid[0].x - 50) < 1e-9);
const exact = Layer.renderAt(layer, 0);
ok('renderAt clé exacte', exact[0].x === 0);
ok('renderAt clone', Layer.renderAt(layer, 0)[0] !== sa);
ok('removeKey', Layer.removeKey(layer, 10) === true && Layer.keyAt(layer, 10) === null);

console.log('\n-- app / document --');
fresh();
ok('newDocument: 1 calque', App.doc.layers.length === 1);
ok('newDocument: frame 0', App.currentFrame === 0);
ok('newDocument: calque actif', App.activeLayer().id === App.doc.layers[0].id);
App.addShape(Shapes.create('rect', { x: 10, y: 10, w: 50, h: 40 }));
ok('addShape: 1 forme', Layer.keyAt(App.activeLayer(), 0).shapes.length === 1);
ok('addShape: sélection', App.hasSelection() === true);
ok('selectedShapes', App.selectedShapes().length === 1);
ok('undo supprime la forme', (function () { App.undo(); return Layer.keyAt(App.activeLayer(), 0) === null; })());
ok('redo restaure la forme', (function () { App.redo(); return Layer.keyAt(App.activeLayer(), 0).shapes.length === 1; })());
App.setFrame(100);
ok('setFrame borné', App.currentFrame === App.doc.frameCount - 1);
App.setFrame(5);
App.addKey();
ok('addKey à l\'image 5', App.hasKey(App.activeLayer(), 5) === true);
ok('addKey copie les formes', Layer.keyAt(App.activeLayer(), 5).shapes.length === 1);
App.addLayer('Deux');
ok('addLayer', App.doc.layers.length === 2);
App.moveLayer(App.doc.layers[1].id, -1);
ok('moveLayer réordonne', App.doc.layers[0].name === 'Deux');
App.removeLayer(App.doc.layers[0].id);
ok('removeLayer', App.doc.layers.length === 1);
ok('deleteSelection', (function () { fresh(); App.addShape(Shapes.create('rect', {})); App.deleteSelection(); return App.selectedShapes().length === 0 && Layer.keyAt(App.activeLayer(), 0).shapes.length === 0; })());

console.log('\n-- outils --');
const d = Tools.fromDrag('rect', 100, 100, 40, 30, App.style);
ok('fromDrag normalise', d.x === 40 && d.y === 30 && d.w === 60 && d.h === 70);
const ln = Tools.line(0, 0, 20, 20, App.style);
ok('line sans remplissage', ln.fill === 'none');
ok('line points', ln.w === 20 && ln.h === 20);
const pen = Tools.pencil([{ x: 0, y: 0 }, { x: 5, y: 5 }], App.style);
ok('pencil points', pen.points.length === 2);
const tx = Tools.text(0, 0, 'Salut', { fontSize: 20, fill: '#000000', stroke: '#000000', strokeWidth: 1 });
ok('text taille estimée', tx.w > 0 && tx.h > 0 && tx.text === 'Salut');

console.log('\n-- export --');
fresh();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 10, h: 10, fill: '#c9d7f0', stroke: '#2b3a55', strokeWidth: 2 }));
const svg = Export.svgString(0);
ok('svgString balise svg', svg.indexOf('<svg') !== -1);
ok('svgString contient rect', svg.indexOf('<rect') !== -1);
ok('svgString contient forme', svg.indexOf('#c9d7f0') !== -1);
ok('svgString fond doc', svg.indexOf(App.doc.background) !== -1);
const canvas = Export.renderToCanvas(0);
ok('renderToCanvas dimensions', canvas.width === App.doc.width && canvas.height === App.doc.height);

console.log('\n-- timeline (lecture) --');
ok('pause sans erreur', (function () { Timeline.pause(); return App.playing === false; })());

console.log('\n' + pass + ' réussis, ' + fail + ' échecs');
process.exit(fail ? 1 : 0);

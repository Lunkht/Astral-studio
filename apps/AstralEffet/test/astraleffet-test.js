const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 640, height: 360 };
      if (p === 'measureText') return () => ({ width: 40 });
      if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (!(p in t)) t[p] = function () {};
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function makeEl(id) {
  return {
    id: id || '',
    style: {},
    dataset: {},
    value: '',
    type: '',
    min: 0,
    max: 100,
    step: 1,
    selected: false,
    textContent: '',
    innerHTML: '',
    title: '',
    disabled: false,
    checked: false,
    hidden: false,
    naturalWidth: 0,
    naturalHeight: 0,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    currentTime: 0,
    paused: true,
    duration: 0,
    src: '',
    width: 100,
    height: 100,
    clientWidth: 640,
    clientHeight: 360,
    files: [],
    children: [],
    _listeners: {},
    _attrs: {},
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
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    getAttribute(k) { return this._attrs[k] == null ? null : this._attrs[k]; },
    setAttribute(k, v) { this._attrs[k] = v; },
    focus() {},
    blur() {},
    click() {},
    play() { this.paused = false; },
    pause() { this.paused = true; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }; },
    getContext() { return this._ctx || (this._ctx = makeCtx()); },
    toBlob(cb) { cb({}); },
    toDataURL() { return 'data:image/png;base64,'; },
    captureStream() { return {}; }
  };
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
  performance: { now: () => 0 },
  devicePixelRatio: 2,
  Blob: function () {},
  Uint8ClampedArray,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  MediaRecorder: undefined,
  Promise,
  prompt: () => null,
  confirm: () => true,
  alert: () => {},
  navigator: { userAgent: 'node' },
  document: documentStub,
  addEventListener() {},
  removeEventListener() {},
  Math,
  JSON,
  Object,
  isFinite,
  parseFloat,
  parseInt
};
sandbox.window = sandbox;

vm.createContext(sandbox);

const files = ['utils.js', 'keyframe.js', 'effects.js', 'asset.js', 'layer.js', 'comp.js', 'app.js', 'player.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { Utils: U, Keyframe: K, Effects, Asset, Layer, Comp, App, Player, Renderer, Interaction, UI, Export } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function approx(a, b, eps) { return Math.abs(a - b) < (eps == null ? 1e-6 : eps); }
function noThrow(fn) { try { fn(); return true; } catch (e) { return false; } }

console.log('\n-- utils --');
ok('clamp borne haut', U.clamp(15, 0, 10) === 10);
ok('clamp borne bas', U.clamp(-5, 0, 10) === 0);
ok('lerp milieu', U.lerp(0, 100, 0.5) === 50);
ok('round 2 dec', U.round(1.2345) === 1.23);
ok('isNum vrai', U.isNum(3.5) === true);
ok('isNum faux', U.isNum('x') === false && U.isNum(NaN) === false);
ok('deepClone independant', (function () { var a = { x: 1 }; var b = U.deepClone(a); b.x = 2; return a.x === 1; })());
ok('uid prefixe', U.uid('layer').indexOf('layer') === 0);
ok('snap proche', U.snap(10.4, [10], 0.5) === 10);
ok('snap loin intact', U.snap(10.9, [10], 0.5) === 10.9);
ok('timecode 1.5s@30', U.timecode(1.5, 30) === '00:00:01:15');
ok('timecode 0', U.timecode(0, 30) === '00:00:00:00');
ok('formatClock 65', U.formatClock(65) === '1:05');
ok('hexToRgb', U.hexToRgb('#ff8000').r === 255 && U.hexToRgb('#ff8000').g === 128);
ok('rgbToHex', U.rgbToHex(255, 128, 0) === '#ff8000');
ok('withAlpha', U.withAlpha('#000000', 0.5) === 'rgba(0,0,0,0.5)');

console.log('\n-- keyframe --');
const p0 = K.prop(7);
ok('prop valeur', p0.value === 7);
ok('prop sans cle', K.hasKeys(p0) === false);
ok('valueAt sans cle', K.valueAt(p0, 3) === 7);
ok('isProp vrai', K.isProp(p0) === true);
ok('isProp faux', K.isProp({}) === false);
const pk = K.prop(0);
K.setKey(pk, 0, 0);
K.setKey(pk, 2, 100);
ok('setKey compte', pk.keys.length === 2);
ok('interp milieu', approx(K.valueAt(pk, 1), 50));
ok('avant premiere cle', K.valueAt(pk, -1) === 0);
ok('apres derniere cle', K.valueAt(pk, 5) === 100);
K.setKey(pk, 1, 40);
ok('setKey trie', pk.keys[1].t === 1);
ok('setKey remplace', K.keyAt(pk, 1).value === 40);
K.removeKey(pk, 1);
ok('removeKey', pk.keys.length === 2);
ok('removeKey absent', K.removeKey(pk, 9) === false);
const pe = K.prop(0);
K.setKey(pe, 0, 0, 'easeIn');
K.setKey(pe, 2, 100);
ok('easeIn milieu', approx(K.valueAt(pe, 1), 25));
const ph = K.prop(0);
K.setKey(ph, 0, 0, 'hold');
K.setKey(ph, 2, 100);
ok('hold garde valeur', K.valueAt(ph, 1) === 0);
const pt = K.prop(5);
ok('toggleKeyAt ajoute', K.toggleKeyAt(pt, 0) === true && K.hasKeys(pt) === true);
ok('toggleKeyAt retire', K.toggleKeyAt(pt, 0) === false && K.hasKeys(pt) === false);
ok('ease easeOut', approx(K.ease('easeOut', 0.5), 0.75));

console.log('\n-- effects --');
ok('list 8 effets', Effects.list().length === 8);
const fxBlur = Effects.create('blur');
ok('create blur', fxBlur && fxBlur.type === 'blur' && fxBlur.enabled === true);
ok('blur rayon defaut', fxBlur.params.radius.value === 8);
ok('filter blur', Effects.filterString(fxBlur, 0) === 'blur(8px)');
K.setKey(fxBlur.params.radius, 0, 40);
ok('filter blur anime', Effects.filterString(fxBlur, 0) === 'blur(40px)');
const fxBright = Effects.create('brightness');
ok('filter brightness', Effects.filterString(fxBright, 0) === 'brightness(1)');
const fxSat = Effects.create('saturate');
ok('filter saturate', Effects.filterString(fxSat, 0) === 'saturate(1)');
const fxHue = Effects.create('hue');
ok('filter hue', Effects.filterString(fxHue, 0) === 'hue-rotate(0deg)');
const fxInv = Effects.create('invert');
fxInv.enabled = false;
ok('combinedFilter ignore desactive', Effects.combinedFilter([fxBlur, fxInv], 0).indexOf('invert') < 0);
ok('combinedFilter vide', Effects.combinedFilter([], 0) === 'none');
ok('hasKeys effet faux', Effects.hasKeys(fxHue) === false);
ok('hasKeys effet vrai', Effects.hasKeys(fxBlur) === true);
ok('create type inconnu', Effects.create('zzz') === null);

console.log('\n-- asset --');
const aimg = Asset.create({ kind: 'image', name: 'a.png' });
const avid = Asset.create({ kind: 'video', name: 'a.mp4' });
ok('asset kind image', aimg.kind === 'image');
ok('asset image duration null', aimg.duration === null);
ok('asset kind video', avid.kind === 'video');
ok('asset video duration 0', avid.duration === 0);
ok('isVisual image', Asset.isVisual(aimg) === true);
ok('isVisual video', Asset.isVisual(avid) === true);
ok('probe renvoie element', !!Asset.probe(aimg));
ok('revoke sans erreur', noThrow(function () { Asset.revoke(aimg); }));

console.log('\n-- layer --');
const lay = Layer.create({ type: 'solid', color: '#123456' });
ok('layer type', lay.type === 'solid');
ok('layer couleur', lay.color === '#123456');
ok('layer transform x prop', K.isProp(lay.transform.x));
ok('layer transform scale 100', lay.transform.scale.value === 100);
ok('layer effects vide', lay.effects.length === 0);
ok('layer visible', lay.visible === true);
ok('evaluate x', Layer.evaluate(lay, 0).x === 0);
ok('evaluate opacity', Layer.evaluate(lay, 0).opacity === 100);
const lb = Layer.bounds(lay, App.assets);
ok('bounds solide 200', lb.w === 200 && lb.h === 200);
const ltxt = Layer.create({ type: 'text', text: 'hello' });
ok('bounds texte positif', Layer.bounds(ltxt, App.assets).w > 0);
const limg = Layer.create({ type: 'image', assetId: 'nope' });
ok('bounds media fallback', Layer.bounds(limg, App.assets).w === 400);
K.setKey(lay.transform.x, 0, 10);
ok('layer hasKeys', Layer.hasKeys(lay) === true);
const fx = Layer.addEffect(lay, 'blur');
ok('addEffect', lay.effects.length === 1 && fx.type === 'blur');
ok('removeEffect', Layer.removeEffect(lay, fx.id) === true && lay.effects.length === 0);
ok('drawContent sans erreur', noThrow(function () { Layer.drawContent(makeCtx(), lay, App.assets); }));
ok('drawContent texte', noThrow(function () { Layer.drawContent(makeCtx(), ltxt, App.assets); }));
ok('transformCtx sans erreur', noThrow(function () { Layer.transformCtx(makeCtx(), Layer.evaluate(lay, 0)); }));

console.log('\n-- comp --');
const cp = Comp.create({});
ok('comp defaut 1280', cp.width === 1280 && cp.height === 720);
ok('comp fps 30', cp.fps === 30);
ok('comp duration 5', cp.duration === 5);
ok('comp sans calque', cp.layers.length === 0);
const l1 = Layer.create({ type: 'solid', name: 'A' });
const l2 = Layer.create({ type: 'solid', name: 'B' });
Comp.addLayer(cp, l1);
Comp.addLayer(cp, l2);
ok('addLayer ordre', cp.layers[0].id === l1.id && cp.layers[1].id === l2.id);
ok('layerById', Comp.layerById(cp, l1.id) === l1);
ok('layerById absent', Comp.layerById(cp, 'x') === null);
ok('indexOf', Comp.indexOf(cp, l2.id) === 1);
ok('moveLayer monte', Comp.moveLayer(cp, l1.id, 1) === true && cp.layers[1].id === l1.id);
ok('topDown inverse', Comp.topDown(cp)[0].id === l1.id);
ok('removeLayer', Comp.removeLayer(cp, l1.id) === true && cp.layers.length === 1);

console.log('\n-- app --');
App.newComp({ name: 'Test', duration: 4 });
ok('newComp nom', App.comp.name === 'Test');
ok('newComp fps 30', App.comp.fps === 30);
ok('newComp pas de calque', App.comp.layers.length === 0);
ok('canUndo faux', App.canUndo() === false);
const solid = App.addSolid();
ok('addSolid cree', App.comp.layers.length === 1);
ok('addSolid selection', App.selection[0] === solid.id);
ok('addSolid centre', solid.transform.x.value === App.comp.width / 2);
App.addText('Bonjour');
ok('addText cree', App.comp.layers.length === 2);
ok('addText type', App.comp.layers[1].type === 'text');
App.addShape({ kind: 'star' });
ok('addShape etoile', App.comp.layers[2].shape.kind === 'star');
ok('noms uniques', App.comp.layers[0].name !== App.comp.layers[1].name);

App.select(solid.id);
App.setTransform(solid.id, 'x', 300);
ok('setTransform valeur', solid.transform.x.value === 300);
App.toggleTransformKey(solid.id, 'x');
ok('toggleTransformKey ajoute', K.hasKeys(solid.transform.x) === true);
App.toggleTransformKey(solid.id, 'x');
ok('toggleTransformKey retire', K.hasKeys(solid.transform.x) === false);

App.setTime(1000);
ok('setTime borne', App.time === App.comp.duration);
App.setTime(1);
App.stepFrame(1);
ok('stepFrame', approx(App.time, 1 + 1 / 30));
App.goStart();
ok('goStart', App.time === 0);
App.goEnd();
ok('goEnd', App.time === App.comp.duration);

App.select(null);
ok('select null vide', App.selection.length === 0);
App.select(solid.id);
App.select(solid.id, true);
ok('select additif retire', App.selection.length === 0);
App.select(solid.id);
const nBefore = App.comp.layers.length;
App.duplicateSelected();
ok('duplicate ajoute', App.comp.layers.length === nBefore + 1);
App.removeSelected();
ok('removeSelected', App.comp.layers.length === nBefore);

App.newComp({ duration: 4 });
App.addSolid();
App.addText();
const two = App.comp.layers.length;
App.undo();
ok('undo retire', App.comp.layers.length === two - 1);
App.redo();
ok('redo retablit', App.comp.layers.length === two);

App.select(App.comp.layers[0].id);
App.addEffectToSelection('blur');
ok('addEffectToSelection', App.comp.layers[0].effects.length === 1);
const ef = App.comp.layers[0].effects[0];
App.setEffectParam(App.comp.layers[0].id, ef.id, 'radius', 25, true);
ok('setEffectParam', ef.params.radius.value === 25);
App.toggleEffectEnabled(App.comp.layers[0].id, ef.id);
ok('toggleEffectEnabled', ef.enabled === false);
App.removeEffect(App.comp.layers[0].id, ef.id);
ok('removeEffect app', App.comp.layers[0].effects.length === 0);

App.toggleVisibility(App.comp.layers[0].id);
ok('toggleVisibility', App.comp.layers[0].visible === false);
App.toggleLocked(App.comp.layers[0].id);
ok('toggleLocked', App.comp.layers[0].locked === true);

App.setCamera(5, 6, 100);
ok('setCamera zoom borne', App.camera.zoom === 8);
App.zoomBy(0.5);
ok('zoomBy', App.camera.zoom === 4);

App.selectAll();
ok('selectAll', App.selection.length === App.comp.layers.length);

console.log('\n-- renderer / player --');
App.newComp({ width: 1280, height: 720, duration: 3 });
const canvas = getEl('compCanvas');
ok('renderer init', noThrow(function () { Renderer.init(canvas); }));
ok('renderer dimensions', canvas.width === 640 && canvas.height === 360);
ok('view fit positif', Renderer.view().fit > 0);
const round = Renderer.screenToComp(Renderer.compToScreen(100, 50).x, Renderer.compToScreen(100, 50).y);
ok('compToScreen inverse', approx(round.x, 100, 1e-6) && approx(round.y, 50, 1e-6));
const s1 = App.addSolid({ w: 400, h: 400 });
ok('draw sans erreur', noThrow(function () { Renderer.draw(); }));
ok('drawOverlay sans erreur', noThrow(function () { Renderer.drawOverlay(); }));
ok('layerCorners 4', Renderer.layerCorners(s1, 0).length === 4);
const sc = Renderer.compToScreen(App.comp.width / 2, App.comp.height / 2);
ok('hitTest dedans', Renderer.hitTest(sc.x, sc.y) === s1);
ok('hitTest dehors', Renderer.hitTest(0, 0) === null);

ok('player init', noThrow(function () { Player.init(); }));
Player.play();
ok('player play', App.playing === true);
Player.tick(1000);
Player.tick(2000);
ok('player tick avance', App.time > 0);
Player.pause();
ok('player pause', App.playing === false);
ok('syncVideos sans erreur', noThrow(function () { Player.syncVideos(0.5, false); }));

console.log('\n-- interaction / export --');
ok('interaction init', noThrow(function () { Interaction.init(canvas); }));

App.newComp({ duration: 2 });
App.addSolid();
ok('export renderComp sans erreur', noThrow(function () { Export.renderComp(makeCtx(), App.comp, 0); }));
const rc = Export.renderCanvas(1);
ok('renderCanvas dimensionne', rc.width === App.comp.width && rc.height === App.comp.height);
ok('framePNG dataURL', Export.framePNG({ download: false }).indexOf('data:image/png') === 0);
const json = Export.projectJSON({});
ok('projectJSON parse', noThrow(function () { JSON.parse(json); }));
ok('projectJSON calques', JSON.parse(json).comp.layers.length === 1);
ok('canRecord faux', Export.canRecord() === false);
ok('video refuse sans recorder', Export.video({}) === false);

console.log('\n-- ui --');
ok('UI.init sans erreur', noThrow(function () { UI.init(); }));
ok('UI.render sans erreur', noThrow(function () { UI.render(); }));
App.select(App.comp.layers[0].id);
ok('UI.render avec selection', noThrow(function () { UI.render(); }));
UI.expanded[App.comp.layers[0].id] = true;
ok('UI.render timeline etendue', noThrow(function () { UI.render(); }));
UI.expanded[App.comp.layers[0].id] = false;
App.addEffectToSelection('blur');
ok('UI.render avec effet', noThrow(function () { UI.render(); }));
ok('UI.timeText', typeof UI.timeText() === 'string' && UI.timeText().length === 11);
ok('UI.edit sans erreur', noThrow(function () { UI.edit(function () { App.comp.layers[0].name = 'X'; }); }));
ok('UI.openMenu sans erreur', noThrow(function () { UI.openMenu('file', getEl('btnAddSolid')); }));
ok('UI.closeMenu sans erreur', noThrow(function () { UI.closeMenu(); }));
ok('UI.toggleHelp sans erreur', noThrow(function () { UI.toggleHelp(); }));

console.log('\n========================================');
console.log('  ' + pass + ' / ' + (pass + fail) + ' tests OK');
if (fail) console.log('  ' + fail + ' ECHEC(S)');
else console.log('  tous les tests passent.');
process.exit(fail ? 1 : 0);

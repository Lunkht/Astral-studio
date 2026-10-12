const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 800, height: 600 };
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
    textContent: '',
    innerHTML: '',
    disabled: false,
    clientWidth: 800,
    clientHeight: 600,
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
    setSelectionRange() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; },
    parentElement: { style: {} },
    setPointerCapture() {},
    releasePointerCapture() {},
    getContext() { return this._ctx || (this._ctx = makeCtx()); },
    toBlob(cb) { cb({}); },
    click() {}
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
  devicePixelRatio: 2,
  Blob: function () {},
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

const files = ['utils.js', 'shapes.js', 'app.js', 'render.js', 'tools.js', 'align.js', 'document.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { App, Shapes, Tools, Interaction, Utils, Renderer, UI, Align } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function reset() {
  App.shapes = []; App.selection = {}; App.edit = null; App.pen = null; App.textEdit = null;
  App.history.past = []; App.history.future = [];
}

console.log('\n-- création --');
const rect = Tools.buildShape('rect', { x: 10, y: 20 }, { x: 110, y: 120 }, {});
ok('rect bbox', rect.x === 10 && rect.y === 20 && rect.w === 100 && rect.h === 100);
const sq = Tools.buildShape('rect', { x: 0, y: 0 }, { x: 80, y: 30 }, { shift: true });
ok('rect carré (shift)', sq.w === 80 && sq.h === 80);
const rr = Tools.buildShape('roundrect', { x: 0, y: 0 }, { x: 100, y: 60 }, {});
ok('roundrect rayon par défaut', rr.type === 'roundrect' && rr.radius > 0);
const poly = Tools.buildShape('polygon', { x: 0, y: 0 }, { x: 100, y: 100 }, {});
ok('polygon côtés par défaut', poly.type === 'polygon' && poly.sides === 6);
const star = Tools.buildShape('star', { x: 0, y: 0 }, { x: 100, y: 100 }, {});
ok('star branches par défaut', star.type === 'star' && star.points === 5);
const ln = Tools.buildShape('line', { x: 10, y: 10 }, { x: 60, y: 110 }, {});
ok('ligne direction', ln.p1.x === 0 && ln.p1.y === 0 && ln.p2.x === 1 && ln.p2.y === 1);

console.log('\n-- géométrie & hit test --');
ok('polygon 6 sommets', Shapes.polygonVertices(poly).length === 6);
ok('star 10 sommets', Shapes.starVertices(star).length === 10);
ok('hit polygone centre', Shapes.hitTest(Object.assign({}, poly, { fill: '#f00' }), 50, 50, 0) === true);
const e = Shapes.create('ellipse', { x: 0, y: 0, w: 100, h: 100 });
ok('ellipse coin exclu', Shapes.hitTest(e, 2, 2, 0) === false);
ok('ellipse centre inclus', Shapes.hitTest(e, 50, 50, 0) === true);
const rot = Shapes.create('rect', { x: 0, y: 0, w: 100, h: 20, rotation: Math.PI / 2 });
ok('hit après rotation', Shapes.hitTest(rot, 50, 50, 0) === true);

console.log('\n-- resize rotation aware --');
const s0 = Shapes.create('rect', { x: 0, y: 0, w: 100, h: 100 });
const clone = Utils.deepClone(s0);
Tools.resizeShape(clone, 'se', { x: 200, y: 150 }, {});
ok('resize se', clone.w === 200 && clone.h === 150 && clone.x === 0 && clone.y === 0);

console.log('\n-- app + historique --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 10, h: 10 }));
ok('shape ajoutée', App.shapes.length === 1);
App.beginChange(); App.shapes[0].x = 500; App.endChange();
ok('undo', (App.undo(), App.shapes[0].x) === 0);
ok('redo', (App.redo(), App.shapes[0].x) === 500);

console.log('\n-- rendu --');
reset();
App.addShape(Shapes.create('roundrect', { x: 10, y: 10, w: 120, h: 80, radius: 14 }));
App.addShape(Shapes.create('star', { x: 60, y: 60, w: 90, h: 90 }));
App.addShape(Shapes.create('text', { x: 20, y: 200, text: 'Bonjour', w: 200, h: 60, lineHeight: 60 }));
App.addShape(Shapes.create('polygon', { x: 200, y: 10, w: 90, h: 90 }));
let drew = true;
try { Renderer.draw(); } catch (err) { drew = false; console.log('   ', err.message); }
ok('Renderer.draw sans erreur', drew);

console.log('\n-- texte --');
const txt = Shapes.create('text', { text: 'Salut\ntoi', fontSize: 40 });
Tools.syncTextBounds(txt);
ok('mesure texte > 0', txt.w > 0 && txt.h > 0, JSON.stringify({ w: txt.w, h: txt.h }));
ok('texte 2 lignes hauteur', txt.h >= 80);

console.log('\n-- alignement / distribution --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 20, h: 20 }));
App.addShape(Shapes.create('rect', { x: 100, y: 0, w: 20, h: 20 }));
App.select(App.shapes.map(s => s.id));
Align.align('h', 'min', false);
ok('align gauche', App.shapes[0].x === 0 && App.shapes[1].x === 0, App.shapes.map(s => s.x).join(','));
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 10, h: 10 }));
App.addShape(Shapes.create('rect', { x: 50, y: 0, w: 10, h: 10 }));
App.addShape(Shapes.create('rect', { x: 200, y: 0, w: 10, h: 10 }));
App.select(App.shapes.map(s => s.id));
Align.distribute('h');
const midC = App.shapes[1].x + 5;
ok('répartir centre', Math.abs(midC - 105) < 0.01, midC);

console.log('\n-- Pathfinder --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 100, h: 100 }));
App.addShape(Shapes.create('rect', { x: 50, y: 50, w: 100, h: 100 }));
App.select(App.shapes.map(s => s.id));
Align.pathfinder('union');
const uni = App.shapes[0];
ok('union: un seul objet', App.shapes.length === 1);
ok('union: type tracé', uni && uni.type === 'path');
ok('union: 2 sous-tracés', uni && uni.subpaths && uni.subpaths.length === 2, uni && uni.subpaths && uni.subpaths.length);
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 100, h: 100 }));
App.addShape(Shapes.create('ellipse', { x: 50, y: 50, w: 80, h: 80 }));
App.select(App.shapes.map(s => s.id));
Align.pathfinder('exclude');
ok('exclude: fillRule evenodd', App.shapes[0].fillRule === 'evenodd');
const bx = Shapes.aabb(App.shapes[0]);
ok('chemin fusionné a une bbox', bx.w > 0 && bx.h > 0);

console.log('\n-- aplatir (convertir en tracé) --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 40, h: 40 }));
App.select([App.shapes[0].id]);
UI.flattenSelection();
ok('aplati en path', App.shapes[0].type === 'path' && App.shapes[0].closed === true);
ok('aplati conserve le remplissage', App.shapes[0].fill === Shapes.DEFAULTS.fill);

console.log('\n-- plume / bézier --');
reset();
const penPts = [
  { x: 0, y: 0, in: { x: 0, y: 0 }, out: { x: 30, y: 0 } },
  { x: 100, y: 100, in: { x: -30, y: 0 }, out: { x: 0, y: 0 } },
  { x: 200, y: 0, in: { x: -30, y: 0 }, out: { x: 0, y: 0 } }
];
const pshape = Tools.buildPathShape(penPts, false);
ok('path: 3 points', pshape.points.length === 3);
ok('path: bbox', pshape.w > 150 && pshape.h > 0);
const samples = Shapes.samplePoints(pshape.points, false, 20, pshape.x, pshape.y);
ok('path: échantillonnage', samples.length > 20);

reset();
Interaction.penDown({ x: 10, y: 10 }, App.worldToScreen(10, 10));
Interaction.penDrag({ x: 40, y: 10 });
Interaction.penDown({ x: 100, y: 100 }, App.worldToScreen(100, 100));
Interaction.penDrag({ x: 130, y: 100 });
ok('pen: 2 points', App.pen && App.pen.points.length === 2);
Interaction.finishPen(false);
ok('pen: finalisé', App.shapes.length === 1 && App.shapes[0].type === 'path');

console.log('\n-- crayon --');
reset();
const freehand = [];
for (let i = 0; i <= 200; i++) freehand.push({ x: i, y: 40 + Math.sin(i / 20) * 30 });
const ps = Tools.pencilToPath(freehand, 3);
ok('crayon: crée un tracé', ps && ps.type === 'path');
ok('crayon: simplifié', ps.points.length < freehand.length && ps.points.length >= 2, ps.points.length);
ok('crayon: poignées de lissage', Math.abs(ps.points[1].out.x) > 0 || Math.abs(ps.points[1].out.y) > 0);

console.log('\n-- ancres (ajout/suppression) --');
reset();
const linePath = Tools.buildPathShape([
  { x: 0, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
  { x: 100, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }
], false);
App.addShape(linePath);
App.select([linePath.id]);
Interaction.addAnchor({ x: 50, y: 0 });
ok('ajout d\'ancre', linePath.points.length === 3, linePath.points.length);
Interaction.removeAnchor({ x: 50, y: 0 });
ok('suppression d\'ancre', linePath.points.length === 2, linePath.points.length);

console.log('\n-- pipette --');
reset();
const srcS = App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 50, h: 50, fill: '#ff0000', stroke: '#00ff00' }));
const dstS = Shapes.create('rect', { x: 100, y: 0, w: 50, h: 50 });
App.shapes.push(dstS); App.select([dstS.id]);
Interaction.pick({ x: 25, y: 25 }, {});
ok('pipette copie le fond', dstS.fill === '#ff0000', dstS.fill);
ok('pipette copie le contour', dstS.stroke === '#00ff00', dstS.stroke);

console.log('\n-- texte via interaction --');
reset();
Interaction.startText(App.worldToScreen(10, 10), { x: 10, y: 10 });
ok('texte: objet créé + édition', App.shapes.length === 1 && App.textEdit && App.textEdit.shapeId === App.shapes[0].id);
const tedit = App.shapeById(App.textEdit.shapeId);
tedit.text = 'Hello';
Interaction.finishTextEdit();
ok('texte: validé', App.textEdit === null && App.shapes[0].text === 'Hello');
reset();
Interaction.startText(App.worldToScreen(10, 10), { x: 10, y: 10 });
Interaction.finishTextEdit();
ok('texte: vide supprimé', App.shapes.length === 0);

console.log('\n-- export --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 50, h: 50 }));
App.addShape(Shapes.create('polygon', { x: 60, y: 0, w: 50, h: 50 }));
App.addShape(Shapes.create('star', { x: 120, y: 0, w: 50, h: 50 }));
App.addShape(Shapes.create('roundrect', { x: 0, y: 60, w: 50, h: 50, radius: 10 }));
App.addShape(Shapes.create('text', { x: 0, y: 130, text: 'Hi', w: 100, h: 50 }));
let svg = '';
sandbox.Blob = function (parts) { svg = parts.join(''); };
try { sandbox.Exporter.svg(); ok('export svg sans erreur', true); } catch (err) { ok('export svg', false, err.message); }
ok('svg: <polygon', svg.indexOf('<polygon') >= 0);
ok('svg: <text', svg.indexOf('<text') >= 0);
ok('svg: rect arrondi rx', /<rect[^>]*rx=/.test(svg));

reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 100, h: 100 }));
App.addShape(Shapes.create('rect', { x: 50, y: 50, w: 100, h: 100 }));
App.select(App.shapes.map(s => s.id));
Align.pathfinder('union');
svg = '';
sandbox.Exporter.svg();
ok('svg: path multi-sous-tracés', (svg.match(/M /g) || []).length >= 2, (svg.match(/M /g) || []).length);

console.log('\n-- ui render --');
try { UI.render(); UI.renderRulers(); ok('UI.render sans erreur', true); } catch (err) { ok('UI.render', false, err.message); }

console.log('\n-- ui actions --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 20, h: 20 }));
App.select([App.shapes[0].id]);
try { UI.action('front'); UI.action('toggle-rulers'); ok('UI.action lance sans erreur', true); } catch (err) { ok('UI.action', false, err.message); }

console.log('\n-- nouveau document (préréglages) --');
const { DocDialog } = sandbox;
DocDialog.init();
ok('dialogue initialisé', !!DocDialog.state);
ok('préréglage par défaut web', DocDialog.state.wpx === 1920 && DocDialog.state.hpx === 1080, JSON.stringify(DocDialog.state));
DocDialog.selectCategory('imprime');
ok('catégorie imprimé -> A4', DocDialog.state.presetName === 'A4 Portrait' && Math.round(DocDialog.state.wpx) === Math.round(210 * 96 / 25.4), DocDialog.state.presetName);
DocDialog.setOrientation('landscape');
ok('orientation paysage', DocDialog.state.wpx > DocDialog.state.hpx);
DocDialog.setUnit('mm');
ok('conversion unité mm', Math.abs(parseFloat(DocDialog.els.w.value) - DocDialog.state.wpx / (96 / 25.4)) < 0.5, DocDialog.els.w.value);
DocDialog.state.unit = 'px'; DocDialog.state.wpx = 800; DocDialog.state.hpx = 600;
DocDialog.els.name.value = 'Maquette';
DocDialog.els.docName = sandbox.document.getElementById('docName');
DocDialog.create();
ok('créer -> artboard 800x600', App.artboard.w === 800 && App.artboard.h === 600, JSON.stringify(App.artboard));
ok('créer -> document vidé', App.shapes.length === 0);
ok('créer -> dialogue fermé', DocDialog.isOpen() === false);

console.log('\n-- unités --');
ok('toUnit in', Math.abs(Utils.toUnit(96, 'in') - 1) < 1e-9, Utils.toUnit(96, 'in'));
ok('fromUnit mm', Math.abs(Utils.fromUnit(210, 'mm') - 210 * 96 / 25.4) < 1e-6);
ok('formatUnit px entier', Utils.formatUnit(100, 'px') === 100);
App.unit = 'mm';
let drewMm = true;
try { Renderer.draw(); } catch (err) { drewMm = false; console.log('   ', err.message); }
ok('Renderer.draw en mm', drewMm);
App.unit = 'px';

console.log('\n-- configuration du document --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 20, h: 20 }));
DocDialog.openForResize();
ok('resize: mode actif', DocDialog.resizeMode === true);
ok('resize: préremplit artboard', Math.round(DocDialog.state.wpx) === App.artboard.w && Math.round(DocDialog.state.hpx) === App.artboard.h);
DocDialog.state.wpx = 640; DocDialog.state.hpx = 480; DocDialog.state.unit = 'px';
DocDialog.create();
ok('resize: nouveau plan', App.artboard.w === 640 && App.artboard.h === 480, JSON.stringify(App.artboard));
ok('resize: conserve les objets', App.shapes.length === 1);
ok('resize: mode désactivé', DocDialog.resizeMode === false);

console.log('\n-- sous-tracages & ancres --');
function pt(x, y) { return { x: x, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }; }
const merged = {
  id: 'm1', type: 'path', x: 0, y: 0, w: 30, h: 30, rotation: 0, fill: 'none',
  subpaths: [
    { closed: true, points: [pt(0, 0), pt(10, 0), pt(10, 10)] },
    { closed: true, points: [pt(20, 20), pt(30, 20), pt(30, 30)] }
  ]
};
merged.points = merged.subpaths[0].points;
ok('anchorRefs multi-sous-tracés (6)', Shapes.anchorRefs(merged).length === 6);
ok('subpathPoints 2e sous-tracé', Shapes.subpathPoints(merged, 1).length === 3);
ok('subpathClosed 2e sous-tracé', Shapes.subpathClosed(merged, 1) === true);
const aw2 = Shapes.anchorWorld(merged, 1, 0);
ok('anchorWorld point 2e sous-tracé', aw2.x === 20 && aw2.y === 20, JSON.stringify(aw2));
const singlePath = { id: 's1', type: 'path', x: 5, y: 5, w: 10, h: 0, rotation: 0, points: [pt(0, 0), pt(10, 0)], closed: false };
ok('subpathPoints chemin simple === points', Shapes.subpathPoints(singlePath, 0) === singlePath.points);

console.log('\n-- nudge (historique regroupé) --');
reset();
App.addShape(Shapes.create('rect', { x: 0, y: 0, w: 10, h: 10 }));
App.select([App.shapes[0].id]);
App.nudge(1, 0); App.nudge(1, 0); App.nudge(1, 0);
App.flushNudge();
ok('nudge déplace la sélection (3)', App.shapes[0].x === 3);
ok('nudge = une seule entrée d\'historique', App.history.past.length === 1, App.history.past.length);
ok('nudge undo restaure', (App.undo(), App.shapes[0].x) === 0);

console.log('\nResultat: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);

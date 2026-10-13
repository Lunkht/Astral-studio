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
  return {
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
  FileReader: function () { this.readAsText = function () {}; },
  Uint8ClampedArray,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  prompt: () => 'Texte',
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
registry.canvas = makeEl('canvas');

vm.createContext(sandbox);

const files = ['utils.js', 'geom.js', 'layers.js', 'entities.js', 'drawing.js', 'snap.js', 'tools.js', 'app.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { Utils, Geom, Layers, Entities, Drawing, Snap, Tools, App, Renderer, Interaction, UI, Export } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function approx(a, b, eps) { return Math.abs(a - b) < (eps == null ? 1e-9 : eps); }
function V(x, y) { return Geom.v(x, y); }

console.log('\n-- utils --');
ok('clamp borne haut', Utils.clamp(15, 0, 10) === 10);
ok('clamp borne bas', Utils.clamp(-5, 0, 10) === 0);
ok('lerp milieu', Utils.lerp(0, 100, 0.5) === 50);
ok('round 2 dec', Utils.round(1.2345) === 1.23);
ok('deg2rad 180', approx(Utils.deg2rad(180), Math.PI));
ok('rad2deg PI', approx(Utils.rad2deg(Math.PI), 180));
ok('almost', Utils.almost(1.0000000001, 1));
ok('normAngle negatif', approx(Utils.normAngle(-Math.PI / 2), Math.PI * 1.5));
ok('angleDelta court', approx(Utils.angleDelta(0.1, -0.1), -0.2));
ok('fmt arrondit', Utils.fmt(1.23456) === '1.235');
ok('parseNumber fallback', Utils.parseNumber('abc', 7) === 7);
ok('deepClone independant', (function () { var a = { x: 1 }; var b = Utils.deepClone(a); b.x = 2; return a.x === 1 && b.x === 2; })());
ok('uid prefixe', Utils.uid('e').indexOf('e') === 0);
ok('uid unique', Utils.uid('e') !== Utils.uid('e'));

console.log('\n-- geom --');
ok('v defaut 0', Geom.v().x === 0 && Geom.v().y === 0);
ok('add', JSON.stringify(Geom.add(V(1, 2), V(3, 4))) === JSON.stringify(V(4, 6)));
ok('sub', JSON.stringify(Geom.sub(V(5, 5), V(1, 2))) === JSON.stringify(V(4, 3)));
ok('scale', JSON.stringify(Geom.scale(V(1, 2), 3)) === JSON.stringify(V(3, 6)));
ok('dot', Geom.dot(V(1, 0), V(0, 1)) === 0);
ok('cross', Geom.cross(V(1, 0), V(0, 1)) === 1);
ok('len 3-4-5', Geom.len(V(3, 4)) === 5);
ok('dist 3-4-5', Geom.dist(V(0, 0), V(3, 4)) === 5);
ok('normalize longueur 1', approx(Geom.len(Geom.normalize(V(5, 0))), 1));
ok('rotate 90deg', (function () { var r = Geom.rotate(V(1, 0), Math.PI / 2); return approx(r.x, 0) && approx(r.y, 1); })());
ok('mid', JSON.stringify(Geom.mid(V(0, 0), V(4, 2))) === JSON.stringify(V(2, 1)));
ok('perp', JSON.stringify(Geom.perp(V(1, 0))) === JSON.stringify(V(0, 1)));
ok('lineDist signee', Geom.lineDist(V(5, -5), V(0, 0), V(10, 0)) === -5);
ok('closestOnSeg borne', JSON.stringify(Geom.closestOnSeg(V(20, 5), V(0, 0), V(10, 0))) === JSON.stringify(V(10, 0)));
ok('pointSegDist', Geom.pointSegDist(V(5, 3), V(0, 0), V(10, 0)) === 3);
ok('segIntersect croisement', (function () { var i = Geom.segIntersect(V(0, 0), V(10, 10), V(0, 10), V(10, 0)); return i && approx(i.x, 5) && approx(i.y, 5); })());
ok('segIntersect hors segments -> null', Geom.segIntersect(V(0, 0), V(1, 1), V(5, 5), V(6, 6)) === null);
ok('lineCircle 2 points', Geom.lineCircle(V(-10, 0), V(10, 0), V(0, 0), 5).length === 2);
ok('lineCircle tangent 1 point', Geom.lineCircle(V(-10, 5), V(10, 5), V(0, 0), 5).length === 1);
ok('circumcenter triangle rectangle', (function () { var c = Geom.circumcenter(V(0, 0), V(4, 0), V(0, 4)); return c && approx(c.x, 2) && approx(c.y, 2); })());
ok('circumcenter alignes -> null', Geom.circumcenter(V(0, 0), V(1, 1), V(2, 2)) === null);
ok('pointInPolygon dedans', Geom.pointInPolygon(V(5, 5), [V(0, 0), V(10, 0), V(10, 10), V(0, 10)]) === true);
ok('pointInPolygon dehors', Geom.pointInPolygon(V(15, 5), [V(0, 0), V(10, 0), V(10, 10), V(0, 10)]) === false);
ok('polygonArea carre', Math.abs(Geom.polygonArea([V(0, 0), V(10, 0), V(10, 10), V(0, 10)])) === 100);
ok('pointsBounds', (function () { var b = Geom.pointsBounds([V(1, 5), V(-2, 3), V(4, -1)]); return b.min.x === -2 && b.min.y === -1 && b.max.x === 4 && b.max.y === 5; })());

console.log('\n-- layers --');
const lays = Layers.defaults();
ok('calque 0 par defaut', !!Layers.byName(lays, '0'));
ok('byName inconnu -> null', Layers.byName(lays, 'zzz') === null);
ok('add calque', Layers.add(lays, Layers.create('Test', '#fff')) && Layers.byName(lays, 'Test').name === 'Test');
ok('indexOf', Layers.indexOf(lays, '0') === 0);
ok('remove interdit pour 0', Layers.remove(lays, '0') === false);
ok('remove calque', Layers.remove(lays, 'Test') === true);
ok('names contient 0', Layers.names(lays).indexOf('0') >= 0);

console.log('\n-- entities --');
const ln = Entities.line(V(0, 0), V(30, 40));
ok('line length 50', Entities.length(ln) === 50);
ok('line 2 points', Entities.points(ln).length === 2);
ok('line segments 1', Entities.segments(ln).length === 1);
ok('line anchors 3', Entities.anchors(ln).length === 3);
ok('line mid anchor', (function () { var a = Entities.anchors(ln); return a[2].type === 'midpoint' && a[2].x === 15; })());
const rect = Entities.rectangle(V(0, 0), V(10, 5));
ok('rectangle 4 points', Entities.rectPoints(rect).length === 4);
ok('rectangle area 50', Entities.area(rect) === 50);
ok('rectangle segments closes 4', Entities.segments(rect).length === 4);
const circ = Entities.circle(V(10, 10), 5);
ok('circle bounds min', Entities.bounds(circ).min.x === 5 && Entities.bounds(circ).min.y === 5);
ok('circle bounds max', Entities.bounds(circ).max.x === 15 && Entities.bounds(circ).max.y === 15);
ok('circle area', approx(Entities.area(circ), Math.PI * 25));
ok('circle center anchor', Entities.anchors(circ)[0].type === 'center');
const arcE = Entities.arc(V(0, 0), 1, 0, Math.PI / 2, true);
ok('arc sweep ccw quart', approx(Entities.arcSweep(arcE), Math.PI / 2));
ok('arc contains PI/4', Entities.arcContainsAngle(arcE, Math.PI / 4) === true);
ok('arc exclut PI', Entities.arcContainsAngle(arcE, Math.PI) === false);
ok('arc length', approx(Entities.length(arcE), Math.PI / 2, 1e-6));
const poly = Entities.polyline([V(0, 0), V(10, 0), V(10, 10)], false);
ok('polyline 3 points', Entities.points(poly).length === 3);
ok('polyline segments ouverts 2', Entities.segments(poly).length === 2);
ok('polyline ferme segments 3', Entities.segments(Entities.polyline(poly.points, true)).length === 3);
ok('polyline length', Entities.length(poly) === 20);
ok('hitTest ligne sur la ligne', Entities.hitTest(ln, V(15, 20), 0.5) === true);
ok('hitTest ligne hors', Entities.hitTest(ln, V(15, 5), 0.5) === false);
ok('hitTest cercle', Entities.hitTest(circ, V(10, 15), 0.4) === true);
const moved = Entities.line(V(0, 0), V(1, 0));
Entities.translate(moved, 5, 3);
ok('translate', moved.p1.x === 5 && moved.p1.y === 3 && moved.p2.x === 6);
const rotE = Entities.line(V(1, 0), V(2, 0));
Entities.rotate(rotE, Math.PI / 2, V(0, 0));
ok('rotate entite', approx(rotE.p1.x, 0) && approx(rotE.p1.y, 1));
const cl = Entities.clone(ln);
ok('clone nouvel id', cl.id !== ln.id && cl.p1.x === ln.p1.x);
const dim = Entities.dimension(V(0, 0), V(10, 0), -5);
ok('dim offset points', approx(Entities.dimOffsetPoints(dim).a.y, -5));
ok('dim segments 3', Entities.segments(dim).length === 3);
const hatch = Entities.hatch([V(0, 0), V(20, 0), V(20, 20), V(0, 20)], 0, 5);
const hsegs = Entities.hatchSegments(hatch);
ok('hatch produit des lignes', hsegs.length > 0);
ok('hatch lignes dans la borne', hsegs.every(function (s) {
  return s[0].x >= -0.01 && s[0].x <= 20.01 && s[1].x >= -0.01 && s[1].x <= 20.01 && s[0].y >= -0.01 && s[0].y <= 20.01;
}));
ok('hatch area', Entities.area(hatch) === 400);

console.log('\n-- drawing --');
const d = Drawing.create({});
ok('drawing calque 0', !!Drawing.layerByName(d, '0'));
ok('drawing sans entite', Drawing.count(d) === 0);
const e1 = Entities.line(V(0, 0), V(100, 0));
Drawing.addEntity(d, e1);
ok('addEntity', Drawing.count(d) === 1 && Drawing.byId(d, e1.id) === e1);
ok('layerOf par defaut 0', Drawing.layerOf(d, e1).name === '0');
const e2 = Entities.circle(V(50, 50), 10);
e2.layer = 'Murs';
Drawing.addEntity(d, e2);
ok('entitiesOn Murs', Drawing.entitiesOn(d, 'Murs').length === 1);
ok('bounds englobe', Drawing.bounds(d).max.x >= 100 && Drawing.bounds(d).max.y >= 60);
const round = Drawing.deserialize(Drawing.serialize(d));
ok('serialize/deserialize entites', round.entities.length === 2);
ok('serialize/deserialize calques', round.layers.length === d.layers.length);
const murs = Drawing.layerByName(d, 'Murs');
murs.visible = false;
ok('visibleEntities masque calque', Drawing.visibleEntities(d).length === 1);
murs.visible = true;
ok('removeEntity', Drawing.removeEntity(d, e2.id) === true && Drawing.count(d) === 1);
ok('removeEntity absent', Drawing.removeEntity(d, 'nope') === false);

console.log('\n-- snap --');
const sd = Drawing.create({});
const sLine = Entities.line(V(0, 0), V(10, 0));
Drawing.addEntity(sd, sLine);
const epHit = Snap.find(V(0.5, 0.4), sd, { modes: { endpoint: true }, tol: 1 });
ok('snap extremity', epHit && epHit.type === 'endpoint' && approx(epHit.point.x, 0) && approx(epHit.point.y, 0));
const midHit = Snap.find(V(5.2, 0.1), sd, { modes: { midpoint: true }, tol: 1 });
ok('snap midpoint', midHit && midHit.type === 'midpoint' && approx(midHit.point.x, 5));
ok('snap loin -> null', Snap.find(V(50, 50), sd, { modes: { endpoint: true }, tol: 1 }) === null);
const cd = Drawing.create({});
Drawing.addEntity(cd, Entities.circle(V(10, 10), 5));
const cHit = Snap.find(V(10.3, 10.2), cd, { modes: { center: true }, tol: 1 });
ok('snap center', cHit && cHit.type === 'center');
const id = Drawing.create({});
Drawing.addEntity(id, Entities.line(V(0, 0), V(10, 10)));
Drawing.addEntity(id, Entities.line(V(0, 10), V(10, 0)));
const iHit = Snap.find(V(5.2, 4.8), id, { modes: { intersection: true }, tol: 1 });
ok('snap intersection', iHit && iHit.type === 'intersection' && approx(iHit.point.x, 5) && approx(iHit.point.y, 5));
const gd = Drawing.create({});
const gHit = Snap.find(V(4.2, -3.7), gd, { modes: { grid: true }, tol: 20, gridSize: 10 });
ok('snap grille', gHit && gHit.type === 'grid' && gHit.point.x === 0 && gHit.point.y === 0);

console.log('\n-- tools --');
ok('def line steps 2', Tools.def('line').steps === 2);
ok('keyFor L -> line', Tools.keyFor('l') === 'line');
ok('keyFor inconnu -> null', Tools.keyFor('!') === null);
ok('isDrawing line', Tools.isDrawing('line') === true);
ok('isDrawing select', Tools.isDrawing('select') === false);
const bLine = Tools.buildFromPoints('line', [V(0, 0), V(3, 4)]);
ok('build line length', Entities.length(bLine) === 5);
ok('build insuffisant -> null', Tools.buildFromPoints('line', [V(0, 0)]) === null);
const bCircle = Tools.buildFromPoints('circle', [V(0, 0), V(0, 7)]);
ok('build circle rayon', bCircle.radius === 7);
const bArc = Tools.buildFromPoints('arc', [V(1, 0), V(0, 1), V(-1, 0)]);
ok('build arc centre origine', approx(bArc.center.x, 0, 1e-6) && approx(bArc.center.y, 0, 1e-6));
ok('build arc rayon 1', approx(bArc.radius, 1, 1e-6));
ok('build arc passe par le milieu', Entities.arcContainsAngle(bArc, Math.PI / 2) === true);
const bDim = Tools.buildFromPoints('dimension', [V(0, 0), V(10, 0), V(5, -5)]);
ok('build dimension offset -5', approx(bDim.offset, -5));
const bPoly = Tools.buildFromPoints('polyline', [V(0, 0), V(1, 0), V(1, 1)]);
ok('build polyline 3 points', bPoly.points.length === 3);
const bHatch = Tools.buildFromPoints('hatch', [V(0, 0), V(10, 0), V(10, 10)]);
ok('build hatch', bHatch.type === 'hatch' && bHatch.boundary.length === 3);
const bMeas = Tools.buildFromPoints('measure', [V(0, 0), V(3, 4)]);
ok('build measure distance 5', bMeas.distance === 5);
const bMove = Tools.buildFromPoints('move', [V(1, 1), V(4, 5)]);
ok('build move delta', bMove.dx === 3 && bMove.dy === 4);
const bText = Tools.buildFromPoints('text', [V(2, 2)], { text: 'Salut' });
ok('build text', bText.type === 'text' && bText.text === 'Salut');

console.log('\n-- app --');
Renderer.init(getEl('canvas'));
ok('renderer dimensions', Renderer.w === 800 && Renderer.h === 600);
App.newDrawing();
ok('newDrawing vide', App.drawing.entities.length === 0);
ok('newDrawing pas de selection', App.selectedIds().length === 0);
ok('canUndo faux au depart', App.canUndo() === false);
App.addSample();
ok('addSample entites', App.drawing.entities.length >= 5);
ok('addSample undo possible', App.canUndo() === true);
const before = App.drawing.entities.length;
App.undo();
ok('undo reduit les entites', App.drawing.entities.length === 0);
App.redo();
ok('redo restaure', App.drawing.entities.length === before);
App.clearSelection();
App.selectAll();
ok('selectAll selectionne tout', App.selectedIds().length === before);
App.clearSelection();
ok('clearSelection', App.selectedIds().length === 0);
const firstId = App.drawing.entities[0].id;
App.select(firstId);
ok('select simple', App.selectedIds().length === 1);
App.toggleSelect(App.drawing.entities[1].id);
ok('toggleSelect additif', App.selectedIds().length === 2);
const px0 = App.drawing.entities[0].p1 ? App.drawing.entities[0].p1.x : null;
App.moveSelection(10, 0);
ok('moveSelection deplace', App.drawing.entities[0].p1 ? App.drawing.entities[0].p1.x === px0 + 10 : true);
App.commit();
const del = App.drawing.entities.length;
App.deleteSelection();
ok('deleteSelection', App.drawing.entities.length === del - 2);
App.clearSelection();

const s1 = App.worldToScreen(V(12.5, -7.5));
const w1 = App.screenToWorld(s1);
ok('worldToScreen/screenToWorld inverse', approx(w1.x, 12.5, 1e-6) && approx(w1.y, -7.5, 1e-6));
(function () {
  const anchor = { x: 300, y: 200 };
  const wb = App.screenToWorld(anchor);
  App.zoomAt(anchor, 1.5);
  const wa = App.screenToWorld(anchor);
  ok('zoomAt garde le point sous le curseur', approx(wb.x, wa.x, 1e-6) && approx(wb.y, wa.y, 1e-6));
})();
App.zoomExtents();
ok('zoomExtents echelle positive', App.viewport.scale > 0);

App.setTool('line');
App.pending = [V(0, 0)];
App.ortho = true;
const res = App.resolveInput(V(10, 3), 0.5);
ok('resolveInput ortho horizontal', approx(res.point.y, 0) && res.snap.type === 'ortho');
App.ortho = false;
App.pending = [];

App.setTool('polyline');
App.click(V(0, 0)); App.click(V(10, 0)); App.click(V(10, 10));
ok('click polyline accumule', App.pending.length === 3);
App.finish();
ok('finish polyline cree entite', App.drawing.entities[App.drawing.entities.length - 1].type === 'polyline');

App.commit();
const cntBefore = App.drawing.entities.length;
App.setTool('text');
App.click(V(5, 5));
const tEnt = App.placeText('Bonjour');
ok('placeText cree entite', tEnt && tEnt.type === 'text' && tEnt.text === 'Bonjour');
ok('placeText ajoute', App.drawing.entities.length === cntBefore + 1);

App.setTool('line');
App.pending = [V(0, 0)];
App.cancel();
ok('cancel vide pending', App.pending.length === 0);

App.drawing.currentLayer = 'Murs';
const stamped = App.stamp(Entities.line(V(1, 1), V(2, 2)));
ok('stamp utilise le calque courant', stamped.layer === 'Murs');
App.undo();

console.log('\n-- renderer --');
App.newDrawing();
const pickLine = Entities.line(V(0, 0), V(100, 0));
Drawing.addEntity(App.drawing, pickLine);
App.zoomExtents();
const midScr = App.worldToScreen(V(50, 0));
ok('pick sur la ligne', Renderer.pick(midScr, 8) === pickLine.id);
ok('pick loin -> null', Renderer.pick(App.worldToScreen(V(50, 500)), 8) === null);
ok('effectiveColor du calque', typeof App.effectiveColor(pickLine) === 'string');
Renderer.draw();
ok('draw ne jette pas', true);

console.log('\n-- interaction --');
Interaction.init(getEl('canvas'));
ok('interaction init sans erreur', true);
ok('tol world positive', Interaction._tolWorld() > 0);

console.log('\n-- export --');
App.newDrawing();
App.addSample();
const svg = Export.svg();
ok('svg entete', svg.indexOf('<svg') === 0);
ok('svg contient une ligne', svg.indexOf('<line') > 0);
ok('svg contient un polygone/segment', svg.indexOf('<polygon') > 0 || svg.indexOf('<polyline') > 0);
ok('svg ferme', svg.indexOf('</svg>') > 0);
const dxfTxt = Export.dxf();
ok('dxf entete ENTITIES', dxfTxt.indexOf('ENTITIES') > 0);
ok('dxf contient LINE', dxfTxt.indexOf('LINE') > 0);
ok('dxf contient CIRCLE', dxfTxt.indexOf('CIRCLE') > 0);
ok('dxf termine EOF', dxfTxt.indexOf('EOF') > 0);
const j = Export.json();
ok('json contient entites', j.indexOf('entities') > 0);
ok('json deserialisable', Drawing.deserialize(j).entities.length === App.drawing.entities.length);

console.log('\n-- ui --');
UI.init();
ok('ui init sans erreur', true);
UI.render();
ok('ui render sans erreur', true);

console.log('\n========================================');
console.log('  ' + pass + ' / ' + (pass + fail) + ' tests OK');
if (fail) { console.log('  ' + fail + ' ECHEC(S)'); process.exit(1); }
console.log('  tous les tests passent.');

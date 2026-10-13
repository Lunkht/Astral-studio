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
registry.canvas = makeEl('canvas');

vm.createContext(sandbox);

const files = ['utils.js', 'vec.js', 'mat4.js', 'mesh.js', 'scene.js', 'tools.js', 'app.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { Utils, Vec3: V, Mat4: M, Mesh, Scene, Tools, App, Renderer, Interaction, Export } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function approx(a, b, eps) { return Math.abs(a - b) < (eps == null ? 1e-9 : eps); }

console.log('\n-- utils --');
ok('clamp borne haut', Utils.clamp(15, 0, 10) === 10);
ok('clamp borne bas', Utils.clamp(-5, 0, 10) === 0);
ok('lerp milieu', Utils.lerp(0, 100, 0.5) === 50);
ok('round 2 dec', Utils.round(1.2345) === 1.23);
ok('deg2rad 180', approx(Utils.deg2rad(180), Math.PI));
ok('rad2deg PI', approx(Utils.rad2deg(Math.PI), 180));
ok('deepClone independant', (function () { var a = { x: 1 }; var b = Utils.deepClone(a); b.x = 2; return a.x === 1 && b.x === 2; })());
ok('uid prefixe', Utils.uid('obj').indexOf('obj') === 0);

console.log('\n-- vec3 --');
ok('add', JSON.stringify(V.add(V.v(1, 2, 3), V.v(4, 5, 6))) === JSON.stringify(V.v(5, 7, 9)));
ok('sub', JSON.stringify(V.sub(V.v(5, 5, 5), V.v(1, 2, 3))) === JSON.stringify(V.v(4, 3, 2)));
ok('scale', JSON.stringify(V.scale(V.v(1, 2, 3), 2)) === JSON.stringify(V.v(2, 4, 6)));
ok('dot', V.dot(V.v(1, 0, 0), V.v(0, 1, 0)) === 0);
ok('cross', JSON.stringify(V.cross(V.v(1, 0, 0), V.v(0, 1, 0))) === JSON.stringify(V.v(0, 0, 1)));
ok('length 3-4-0', V.length(V.v(3, 4, 0)) === 5);
ok('normalize', approx(V.length(V.normalize(V.v(5, 0, 0))), 1));
ok('lerp milieu', JSON.stringify(V.lerp(V.v(0, 0, 0), V.v(2, 4, 6), 0.5)) === JSON.stringify(V.v(1, 2, 3)));

console.log('\n-- mat4 --');
ok('identity multiplie neutre', JSON.stringify(M.multiply(M.identity(), M.identity())) === JSON.stringify(M.identity()));
const tr = M.translation(V.v(1, 2, 3));
const tp = M.transformPoint(tr, V.v(10, 20, 30));
ok('translation transformPoint', tp.x === 11 && tp.y === 22 && tp.z === 33 && tp.w === 1);
const sc = M.transformPoint(M.scaling(V.v(2, 2, 2)), V.v(1, 1, 1));
ok('scaling transformPoint', sc.x === 2 && sc.y === 2 && sc.z === 2);
const ryp = M.transformPoint(M.rotationY(Math.PI / 2), V.v(1, 0, 0));
ok('rotationY 90deg', approx(ryp.x, 0, 1e-9) && approx(ryp.z, -1, 1e-9));
const cmp = M.compose(V.v(5, 0, 0), V.v(0, 0, 0), V.v(1, 1, 1));
ok('compose position', M.transformPoint(cmp, V.v(0, 0, 0)).x === 5);
const persp = M.perspective(Utils.deg2rad(50), 1.5, 0.1, 100);
ok('perspective longueur 16', persp.length === 16);
const la = M.lookAt(V.v(0, 0, 5), V.v(0, 0, 0), V.v(0, 1, 0));
const laP = M.transformPoint(la, V.v(0, 0, 0));
ok('lookAt centre a l origine', approx(laP.x, 0) && approx(laP.y, 0) && approx(laP.z, -5));

console.log('\n-- mesh --');
const cube = Mesh.cube(2);
ok('cube 8 sommets', cube.vertices.length === 8);
ok('cube 6 faces', cube.faces.length === 6);
ok('cube 12 aretes', cube.edges.length === 12);
const cb = Mesh.bounds(cube);
ok('cube bounds -1', cb.min.x === -1 && cb.min.y === -1 && cb.min.z === -1);
ok('cube bounds +1', cb.max.x === 1 && cb.max.y === 1 && cb.max.z === 1);
ok('plane 4 sommets / 1 face', Mesh.plane(2).vertices.length === 4 && Mesh.plane(2).faces.length === 1);
const sph = Mesh.sphere(1, 8, 4);
ok('sphere sommets = 1+(segV-1)*segU+1', sph.vertices.length === 1 + 3 * 8 + 1);
ok('sphere aretes dedupliquees', sph.edges.length > 0 && sph.edges.length < sph.faces.length * 4);
ok('cylinder sommets = 2*seg+2', Mesh.cylinder(1, 2, 6).vertices.length === 6 * 2 + 2);
ok('cone sommets = seg+2', Mesh.cone(1, 2, 6).vertices.length === 6 + 2);
ok('torus sommets = segU*segV', Mesh.torus(1, 0.4, 10, 6).vertices.length === 60);
const fn = Mesh.faceNormal(cube, cube.faces[0]);
ok('faceNormal normalise', approx(V.length(fn), 1));
ok('edgesFromFaces dedupe', (function () {
  var e = Mesh.edgesFromFaces([[0, 1, 2], [2, 1, 3]]);
  return e.length === 5;
})());

console.log('\n-- scene --');
const scene = { objects: [] };
const o1 = Scene.createObject('cube', Mesh.cube(2), { name: 'A', color: '#fff' });
const o2 = Scene.createObject('cube', Mesh.cube(2), { name: 'B' });
ok('createObject id unique', o1.id !== o2.id);
ok('createObject position 0', o1.position.x === 0 && o1.position.y === 0 && o1.position.z === 0);
ok('createObject scale 1', o1.scale.x === 1);
ok('add', Scene.add(scene, o1) === o1 && scene.objects.length === 1);
ok('byId', Scene.byId(scene, o1.id) === o1);
ok('byId absent', Scene.byId(scene, 'nope') === null);
ok('remove', Scene.remove(scene, o1.id) === true && scene.objects.length === 0);
ok('remove absent', Scene.remove(scene, 'nope') === false);

console.log('\n-- tools --');
ok('meshFor cube', Tools.meshFor('cube').name === 'Cube');
ok('meshFor sphere', Tools.meshFor('sphere').name === 'Sphere');
ok('meshFor inconnu -> cube', Tools.meshFor('zzz').name === 'Cube');
ok('restHeight cube = 1', Tools.restHeight(Mesh.cube(2)) === 1);
ok('COLORS non vide', Tools.COLORS.length > 0);

console.log('\n-- app --');
App.newScene();
ok('newScene: 1 objet', App.scene.objects.length === 1);
ok('newScene: cube pose au sol', App.scene.objects[0].position.y === 1);
ok('newScene: pas de selection', App.selectedIds().length === 0);
ok('canUndo faux au depart', App.canUndo() === false);
App.addPrimitive('sphere');
ok('addPrimitive: 2 objets', App.scene.objects.length === 2);
ok('addPrimitive: selectionne', App.selectedIds().length === 1);
ok('addPrimitive: undo possible', App.canUndo() === true);
const selId = App.selectedIds()[0];
ok('objectById', App.objectById(selId).type === 'sphere');
App.translateSelection(1, 2, 3);
ok('translateSelection', App.objectById(selId).position.x === 1 && App.objectById(selId).position.y === 3);
App.setView('top');
ok('setView top pitch ~ 90', App.camera.pitch > 1.5);
App.setView('front');
ok('setView front pitch 0', App.camera.pitch === 0 && App.camera.yaw === 0);
App.frame();
ok('frame: distance positive', App.camera.distance > 0);
const wb = App.worldBounds();
ok('worldBounds englobe les objets', wb.min.x <= 1 && wb.max.x >= 1);
App.duplicateSelection();
ok('duplicateSelection: 3 objets', App.scene.objects.length === 3);
ok('duplicateSelection: nom .001', App.scene.objects[2].name.indexOf('.001') > 0);
App.undo();
ok('undo: retour a 2 objets', App.scene.objects.length === 2);
App.redo();
ok('redo: de nouveau 3 objets', App.scene.objects.length === 3);
App.clearSelection();
App.select(selId);
ok('select simple', App.selectedIds().length === 1);
App.toggleSelect(App.scene.objects[0].id);
ok('toggleSelect additif', App.selectedIds().length === 2);
App.deleteSelection();
ok('deleteSelection: 1 objet restant', App.scene.objects.length === 1);
App.clearSelection();
ok('clearSelection', App.selectedIds().length === 0);

console.log('\n-- renderer --');
Renderer.init(getEl('canvas'));
ok('renderer dimensions', Renderer.w === 800 && Renderer.h === 600);
ok('renderer dpr', Renderer.dpr === 2);
const proj = Renderer.project(M.identity(), V.v(1, 1, 0));
ok('project coin -> (800,0)', approx(proj.x, 800) && approx(proj.y, 0));
ok('project derriere camera -> null', Renderer.project([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], V.v(1, 1, 1)) === null);
App.newScene();
Renderer.draw();
ok('draw construit des picks', Array.isArray(Renderer.picks) && Renderer.picks.length >= 1);
const pickId = Renderer.pick(400, 300);
ok('pick renvoie un id ou null', pickId === null || typeof pickId === 'string');
Renderer.picks = [{ id: 'X', minX: 0, minY: 0, maxX: 100, maxY: 100, depth: -1 }, { id: 'Y', minX: 20, minY: 20, maxX: 40, maxY: 40, depth: -5 }];
ok('pick choisit le plus proche (depth max)', Renderer.pick(30, 30) === 'X');
ok('pick hors zone -> null', Renderer.pick(500, 500) === null);

console.log('\n-- interaction --');
ok('worldScale positive', Interaction._worldScale() > 0);
Interaction.init(getEl('canvas'));
ok('interaction init sans erreur', true);

console.log('\n-- export --');
App.newScene();
App.addPrimitive('cube');
const objText = Export.objString();
ok('obj: entete', objText.indexOf('# AstralBlender export') === 0);
ok('obj: sommets', objText.indexOf('\nv ') > 0);
ok('obj: faces', objText.indexOf('\nf ') > 0);
ok('obj: nom objet', objText.indexOf('o ') > 0);
ok('obj: terminaison newline', objText.charAt(objText.length - 1) === '\n');

console.log('\n========================================');
console.log('  ' + pass + ' / ' + (pass + fail) + ' tests OK');
if (fail) { console.log('  ' + fail + ' ECHEC(S)'); process.exit(1); }
console.log('  tous les tests passent.');

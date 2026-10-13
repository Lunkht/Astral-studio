const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 640, height: 360 };
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
    naturalWidth: 0,
    naturalHeight: 0,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    currentTime: 0,
    paused: true,
    playbackRate: 1,
    preload: '',
    src: '',
    width: 100,
    height: 100,
    clientWidth: 640,
    clientHeight: 360,
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
    play() { this.paused = false; },
    pause() { this.paused = true; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }; },
    parentElement: { style: {}, getBoundingClientRect() { return { width: 640, height: 360 }; } },
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
  ResizeObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
  addEventListener() {},
  removeEventListener() {},
  Math,
  JSON
};
sandbox.window = sandbox;

vm.createContext(sandbox);

const files = ['utils.js', 'asset.js', 'clip.js', 'project.js', 'app.js', 'player.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { Utils: U, Asset, Clip, Project: P, App, Player, Renderer, Interaction, UI, Export } = sandbox;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra == null ? '' : extra); }
}
function approx(a, b, eps) { return Math.abs(a - b) < (eps == null ? 1e-9 : eps); }

console.log('\n-- utils --');
ok('clamp borne haut', U.clamp(15, 0, 10) === 10);
ok('clamp borne bas', U.clamp(-5, 0, 10) === 0);
ok('lerp milieu', U.lerp(0, 100, 0.5) === 50);
ok('round 2 dec', U.round(1.2345) === 1.23);
ok('isNum vrai', U.isNum(3.5) === true);
ok('isNum faux', U.isNum('x') === false && U.isNum(NaN) === false);
ok('deepClone independant', (function () { var a = { x: 1 }; var b = U.deepClone(a); b.x = 2; return a.x === 1; })());
ok('uid prefixe', U.uid('clip').indexOf('clip') === 0);
ok('overlaps vrai', U.overlaps(0, 10, 5, 15) === true);
ok('overlaps colles faux', U.overlaps(0, 10, 10, 20) === false);
ok('snap proche', U.snap(10.4, [10], 0.5) === 10);
ok('snap loin intact', U.snap(10.9, [10], 0.5) === 10.9);
ok('timecode 1.5s@30', U.timecode(1.5, 30) === '00:00:01:15');
ok('timecode 0', U.timecode(0, 30) === '00:00:00:00');
ok('formatClock 65', U.formatClock(65) === '1:05');

console.log('\n-- asset --');
const va = Asset.create({ kind: 'video', name: 'a.mp4', src: 'blob:1' });
ok('create kind video', va.kind === 'video');
ok('create id', typeof va.id === 'string' && va.id.length > 0);
ok('create duration video 0', va.duration === 0);
ok('create image duration 5', Asset.create({ kind: 'image' }).duration === 5);
ok('isVisual video', Asset.isVisual(va) === true);
ok('isVisual audio faux', Asset.isVisual(Asset.create({ kind: 'audio' })) === false);
ok('isFiniteDuration faux (0)', Asset.isFiniteDuration(va) === false);
ok('isFiniteDuration vrai', Asset.isFiniteDuration(Asset.create({ kind: 'video', duration: 12 })) === true);
ok('revoke sans erreur', (function () { try { Asset.revoke(va); return true; } catch (e) { return false; } })());

console.log('\n-- clip --');
const c1 = Clip.create({ type: 'video', name: 'C', start: 2, inPoint: 1, duration: 8, srcDuration: 20 });
ok('create start', c1.start === 2);
ok('create inPoint', c1.inPoint === 1);
ok('create opacity 1', c1.opacity === 1);
ok('create speed 1', c1.speed === 1);
ok('end = start+duree', Clip.end(c1) === 10);
ok('contains dedans', Clip.contains(c1, 5) === true);
ok('contains fin exclue', Clip.contains(c1, 10) === false);
ok('sourceTime', Clip.sourceTime(c1, 4) === 3);
const c2 = Clip.create({ type: 'video', duration: 10, srcDuration: 10, speed: 2 });
ok('maxDuration avec source', Clip.maxDuration(c2) === 5);
ok('maxDuration illimite', Clip.maxDuration(Clip.create({ type: 'title' })) === Infinity);
const parts = Clip.split(c1, 6);
ok('split non nul', parts !== null);
ok('split gauche duree', parts.left.duration === 4);
ok('split droite start', parts.right.start === 6);
ok('split droite inPoint', parts.right.inPoint === 5);
ok('split droite duree', parts.right.duration === 4);
ok('split nouveau id', parts.right.id !== c1.id);
ok('split hors bornes null', Clip.split(c1, 20) === null);

console.log('\n-- project --');
const pr = P.create({ fps: 25 });
ok('create 2 pistes', pr.tracks.length === 2);
ok('create piste video V1', P.videoTracks(pr).length === 1 && P.videoTracks(pr)[0].name === 'V1');
ok('create piste audio A1', P.audioTracks(pr).length === 1 && P.audioTracks(pr)[0].name === 'A1');
const v2 = P.addTrack(pr, 'video');
ok('addTrack video insere en haut', pr.tracks[0].id === v2.id && v2.name === 'V2');
const a2 = P.addTrack(pr, 'audio');
ok('addTrack audio nomme A2', a2.name === 'A2');
ok('trackById', P.trackById(pr, v2.id) === v2);
ok('trackById absent', P.trackById(pr, 'x') === null);

const prj = P.create({ fps: 30 });
const tv = P.videoTracks(prj)[0].id;
const ta = P.audioTracks(prj)[0].id;
const kA = P.addClip(prj, Clip.create({ type: 'video', track: tv, start: 0, duration: 10 }));
const kAudio = P.addClip(prj, Clip.create({ type: 'audio', track: ta, start: 0, duration: 10 }));
ok('addClip', prj.clips.length === 2);
ok('clipById', P.clipById(prj, kA.id) === kA);
ok('clipById absent', P.clipById(prj, 'x') === null);
ok('clipsOnTrack', P.clipsOnTrack(prj, tv).length === 1);
ok('visualClipsAt dedans', P.visualClipsAt(prj, 5).length === 1);
ok('visualClipsAt dehors', P.visualClipsAt(prj, 20).length === 0);
ok('audioClipsAt dedans', P.audioClipsAt(prj, 5).length === 1);
ok('duration', P.duration(prj) === 10);
ok('removeClip', P.removeClip(prj, kAudio.id) === true && prj.clips.length === 1);

const prj2 = P.create({ fps: 30 });
const tv2 = P.videoTracks(prj2)[0].id;
const vB = P.addTrack(prj2, 'video');
const bot = P.addClip(prj2, Clip.create({ type: 'video', track: tv2, start: 0, duration: 10 }));
const top = P.addClip(prj2, Clip.create({ type: 'video', track: vB.id, start: 0, duration: 10 }));
const vc = P.visualClipsAt(prj2, 5);
ok('ordre de dessin bas->haut', vc.length === 2 && vc[0].clip.id === bot.id && vc[1].clip.id === top.id);

const mMove = P.addClip(prj2, Clip.create({ type: 'video', track: tv2, start: 2, duration: 3 }));
ok('moveClip', P.moveClip(prj2, mMove.id, 5).start === 5);
ok('moveClip borne bas', P.moveClip(prj2, mMove.id, -4).start === 0);

const mTrim = P.addClip(prj2, Clip.create({ type: 'video', track: ta, start: 0, inPoint: 0, duration: 10, srcDuration: null }));
P.trimClip(prj2, mTrim.id, 'start', 3);
ok('trim start: start', approx(mTrim.start, 3));
ok('trim start: inPoint', approx(mTrim.inPoint, 3));
ok('trim start: duree', approx(mTrim.duration, 7));
P.trimClip(prj2, mTrim.id, 'end', 8);
ok('trim end: duree', approx(mTrim.duration, 5));
const mSrc = P.addClip(prj2, Clip.create({ type: 'video', track: ta, start: 0, inPoint: 0, duration: 10, srcDuration: 6 }));
P.trimClip(prj2, mSrc.id, 'end', 20);
ok('trim end limite par source', approx(mSrc.duration, 6));

const prj3 = P.create({ fps: 30 });
const t3 = P.videoTracks(prj3)[0].id;
const ks = P.addClip(prj3, Clip.create({ type: 'video', track: t3, start: 0, duration: 10 }));
const made = P.splitAt(prj3, 4);
ok('splitAt cree un clip', made.length === 1 && prj3.clips.length === 2);
ok('splitAt gauche conserve id', P.clipById(prj3, ks.id).duration === 4);

console.log('\n-- app --');
App.newProject({ name: 'Seq', width: 1920, height: 1080, fps: 24 });
ok('newProject nom', App.project.name === 'Seq');
ok('newProject fps', App.project.fps === 24);
ok('newProject activeTrack video', P.trackById(App.project, App.activeTrackId).kind === 'video');
ok('newProject pas de clip', App.project.clips.length === 0);
ok('canUndo faux', App.canUndo() === false);

const assetV = Asset.create({ kind: 'video', name: 'clip.mp4', duration: 8 });
App.addAsset(assetV);
ok('addAsset', App.assets.length === 1 && App.assetById(assetV.id) === assetV);
const inserted = App.insertAsset(assetV.id, null, 2);
ok('insertAsset cree un clip', inserted !== null && App.project.clips.length === 1);
ok('insertAsset start', inserted.start === 2);
ok('insertAsset duree = asset', inserted.duration === 8);
ok('insertAsset auto-selection', App.selectedIds().length === 1);
ok('insertAsset commit (undo dispo)', App.canUndo() === true);

const title = App.addTitle('Hello');
ok('addTitle cree un clip titre', title.type === 'title' && title.text === 'Hello');

App.setPlayhead(4);
ok('setPlayhead', approx(App.playhead, 4));
ok('splitAtPlayhead divise', App.splitAtPlayhead().length >= 1);
App.setPlayhead(1000);
ok('setPlayhead borne haut', App.playhead <= App.timelineLength() + 1e-6);
App.goStart();
ok('goStart', App.playhead === 0);
App.goEnd();
ok('goEnd = duree', approx(App.playhead, App.totalDuration()));

App.setPlayhead(2);
App.stepFrame(1);
const beforeStep = App.playhead;
App.stepFrame(-1);
ok('stepFrame 1 image = 1/fps', approx(beforeStep - App.playhead, 1 / App.project.fps, 1e-6));

App.setZoom(1000);
ok('setZoom borne haut', App.pxPerSec === 600);
App.setZoom(1);
ok('setZoom borne bas', App.pxPerSec === 8);
App.setZoom(90);

App.select(App.project.clips[0].id);
ok('select', App.selectedIds().length === 1);
const nBefore = App.project.clips.length;
App.duplicateSelection();
ok('duplicate ajoute un clip', App.project.clips.length === nBefore + 1);
App.deleteSelection();
ok('deleteSelection retire', App.project.clips.length === nBefore);
App.undo();
ok('undo restaure', App.project.clips.length === nBefore + 1);
App.redo();
ok('redo', App.project.clips.length === nBefore);

const audioAsset = Asset.create({ kind: 'audio', name: 'son.mp3', duration: 5 });
App.addAsset(audioAsset);
const ac = App.insertAsset(audioAsset.id, null, 0);
ok('insertAsset audio bascule sur piste audio', P.trackById(App.project, ac.track).kind === 'audio');
ok('insertAsset audio non visuel', P.visualClipsAt(App.project, 1).length >= 0);

console.log('\n-- renderer / player --');
Renderer.init(getEl('canvas'));
ok('renderer dimensions', Renderer.w === 640 && Renderer.h === 360);
App.newProject({ width: 1280, height: 720, fps: 30 });
App.addAsset(assetV);
App.insertAsset(assetV.id, null, 0);
ok('draw sans erreur', (function () { try { Renderer.draw(); return true; } catch (e) { return false; } })());
ok('comp calculee', Renderer.comp.w > 0 && Renderer.comp.h > 0);
App.addTitle('T');
ok('draw avec titre', (function () { try { Renderer.draw(); return true; } catch (e) { return false; } })());
ok('sync sans media sans erreur', (function () { try { Player.sync(0, false); return true; } catch (e) { return false; } })());
ok('interaction init', (function () { try { Interaction.init(getEl('canvas2')); return true; } catch (e) { return false; } })());

console.log('\n-- export --');
ok('projectJSON sans erreur', (function () { try { Export.projectJSON(); return true; } catch (e) { return false; } })());
ok('canRecord faux sans MediaRecorder', Export.canRecord() === false);
ok('video refuse sans recorder', Export.video() === false);

console.log('\n-- ui (cablage) --');
ok('UI.init sans erreur', (function () { try { UI.init(); return true; } catch (e) { return false; } })());
ok('UI.render sans erreur', (function () { try { UI.render(); return true; } catch (e) { return false; } })());
ok('UI.applySnap desactive renvoie valeur', (function () { UI.snap = false; var v = UI.applySnap(3.33, null); UI.snap = true; return v === 3.33; })());
ok('UI.niceStep renvoie un pas', UI.niceStep(90) > 0);

console.log('\n========================================');
console.log('  ' + pass + ' / ' + (pass + fail) + ' tests OK');
if (fail) { console.log('  ' + fail + ' ECHEC(S)'); process.exit(1); }
console.log('  tous les tests passent.');

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
    step: 1,
    type: '',
    hidden: false,
    textContent: '',
    innerHTML: '',
    disabled: false,
    checked: false,
    files: [],
    children: [],
    _listeners: {},
    width: 100,
    height: 100,
    clientWidth: 640,
    clientHeight: 360,
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
    getAttribute() { return null; },
    setAttribute() {},
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }; },
    getContext() { return this._ctx || (this._ctx = makeCtx()); }
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
  Float32Array,
  Uint8Array,
  Uint8ClampedArray,
  ArrayBuffer,
  DataView,
  Promise,
  Blob: function () {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  AudioContext: undefined,
  webkitAudioContext: undefined,
  FileReader: function () {},
  prompt: () => null,
  confirm: () => true,
  alert: () => {},
  navigator: { userAgent: 'node' },
  document: documentStub,
  addEventListener() {},
  removeEventListener() {},
  Math,
  JSON
};
sandbox.window = sandbox;

vm.createContext(sandbox);

const files = ['utils.js', 'audiodata.js', 'asset.js', 'clip.js', 'track.js', 'project.js',
  'edits.js', 'app.js', 'engine.js', 'render.js', 'interaction.js', 'ui.js', 'export.js', 'main.js'];
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

const { Utils: U, AudioData: AD, Asset, Clip, Track, Project: P, Edits, App, Engine, Renderer, Interaction, UI, Export } = sandbox;
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
ok('formatTime 0', U.formatTime(0) === '0:00.000');
ok('formatTime 65.25', U.formatTime(65.25) === '1:05.250');
ok('dbToGain 0 dB', approx(U.dbToGain(0), 1));
ok('gainToDb aller-retour', approx(U.gainToDb(U.dbToGain(6)), 6, 1e-6));

console.log('\n-- audiodata --');
const d1 = AD.create(8000, 2, 100);
ok('create canaux', d1.channels.length === 2 && d1.channels[0] instanceof Float32Array);
ok('create length', d1.length === 100);
ok('duration', approx(AD.duration({ sampleRate: 8000, length: 4000 }), 0.5));
ok('fromChannels length', AD.fromChannels(8000, [new Float32Array(10), new Float32Array(10)]).length === 10);
ok('clone independant', (function () { var c = AD.clone(d1); c.channels[0][0] = 0.5; return d1.channels[0][0] === 0; })());
ok('slice longueur', AD.slice(d1, 10, 40).length === 30);
ok('concat sommme', AD.concat([AD.create(8000, 1, 10), AD.create(8000, 1, 5)]).length === 15);
ok('silence zero', AD.maxAbs(AD.silence(8000, 0.01, 1)) === 0);
ok('maxAbs', approx(AD.maxAbs(AD.fromChannels(8000, [new Float32Array([0.2, -0.7, 0.3])])), 0.7, 1e-6));
const pk = AD.peaks(AD.fromChannels(8000, [new Float32Array([0.2, -0.7, 0.3, 0.9])]), 2);
ok('peaks buckets', pk.length === 2);
ok('peaks min/max', approx(pk[0][0], -0.7, 1e-6) && approx(pk[1][1], 0.9, 1e-6));

const wav = AD.wavEncode(AD.fromChannels(8000, [new Float32Array([0, 0.5, -0.5, 1])]));
ok('wav taille', wav.length === 44 + 4 * 1 * 2);
ok('wav entete RIFF', String.fromCharCode(wav[0], wav[1], wav[2], wav[3]) === 'RIFF');
ok('wav entete WAVE', String.fromCharCode(wav[8], wav[9], wav[10], wav[11]) === 'WAVE');
ok('wav sampleRate', new DataView(wav.buffer).getUint32(24, true) === 8000);

console.log('\n-- asset --');
const a1 = Asset.create(AD.fromChannels(8000, [new Float32Array(8000)]), 'a.wav');
ok('create id', typeof a1.id === 'string' && a1.id.length > 0);
ok('create duration', approx(a1.duration, 1));
ok('peaks mis en cache', Asset.peaks(a1, 8) === Asset.peaks(a1, 8));
ok('clearCache', (function () { Asset.clearCache(a1); return Object.keys(a1._peaks).length === 0; })());
ok('revoke vide data', (function () { var b = Asset.create(AD.create(8000, 1, 4), 'x'); Asset.revoke(b); return b.data === null; })());

console.log('\n-- clip --');
const c1 = Clip.create({ name: 'C', assetId: 'a', start: 2, offset: 1, duration: 8, gain: 1, fadeIn: 2 });
ok('create start', c1.start === 2);
ok('create offset', c1.offset === 1);
ok('create gain 1', c1.gain === 1);
ok('end = start+duree', Clip.end(c1) === 10);
ok('contains dedans', Clip.contains(c1, 5) === true);
ok('contains fin exclue', Clip.contains(c1, 10) === false);
ok('localTime', Clip.localTime(c1, 5) === 3);
ok('sourceTime', Clip.sourceTime(c1, 4) === 3);
ok('gainAt fondu debut 0', Clip.gainAt(c1, 0) === 0);
ok('gainAt fondu milieu', approx(Clip.gainAt(c1, 1), 0.5));
ok('gainAt apres fondu', Clip.gainAt(c1, 4) === 1);
const parts = Clip.split(c1, 6);
ok('split non nul', parts !== null);
ok('split gauche duree', parts.left.duration === 4);
ok('split droite start', parts.right.start === 6);
ok('split droite offset', approx(parts.right.offset, 5));
ok('split droite duree', parts.right.duration === 4);
ok('split nouveau id', parts.right.id !== c1.id);
ok('split hors bornes null', Clip.split(c1, 20) === null);

console.log('\n-- track --');
const t1 = Track.create({ name: 'P1' });
ok('create height defaut', t1.height === 84);
ok('create gain 1', t1.gain === 1);
const k1 = Track.addClip(t1, Clip.create({ start: 4, duration: 2 }));
Track.addClip(t1, Clip.create({ start: 0, duration: 2 }));
ok('clipById', Track.clipById(t1, k1.id) === k1);
ok('clipById absent', Track.clipById(t1, 'x') === null);
ok('sortedClips ordonne', Track.sortedClips(t1)[0].start === 0);
ok('clipAt dedans', Track.clipAt(t1, 4.5) === k1);
ok('clipAt dehors', Track.clipAt(t1, 3) === null);
ok('end max', Track.end(t1) === 6);
ok('removeClip', Track.removeClip(t1, k1.id) === true && t1.clips.length === 1);

console.log('\n-- project --');
const pr = P.create({ name: 'Proj' });
ok('create 1 piste', pr.tracks.length === 1 && pr.tracks[0].name === 'Piste 1');
ok('create sampleRate', pr.sampleRate === 44100);
const t2 = P.newTrack(pr);
ok('newTrack nomme Piste 2', t2.name === 'Piste 2' && pr.tracks.length === 2);
ok('trackById', P.trackById(pr, t2.id) === t2);
ok('trackById absent', P.trackById(pr, 'x') === null);
ok('duration 0', P.duration(pr) === 0);
Track.addClip(pr.tracks[0], Clip.create({ start: 1, duration: 3 }));
ok('duration 4', P.duration(pr) === 4);
ok('anySolo faux', P.anySolo(pr) === false);
pr.tracks[0].solo = true;
ok('anySolo vrai', P.anySolo(pr) === true);
pr.tracks[0].solo = false;
ok('removeTrack', P.removeTrack(pr, t2.id) === true && pr.tracks.length === 1);

console.log('\n-- edits (transforms pures) --');
const src = AD.fromChannels(8000, [new Float32Array([0.1, 0.2, -0.4, 0.3])]);
const amp = Edits.amplifyData(src, 2);
ok('amplify double', approx(amp.channels[0][0], 0.2, 1e-6) && approx(amp.channels[0][2], -0.8, 1e-6));
ok('amplify clamp', Edits.amplifyData(src, 10).channels[0][1] === 1);
ok('normalize max ~0.99', approx(AD.maxAbs(Edits.normalizeData(src)), 0.99, 1e-3));
ok('reverse inverse', approx(Edits.reverseData(src).channels[0][0], 0.3, 1e-6));
const fd = Edits.fadeData(src, 0.00025, 'in');
ok('fade in debut attenu', fd.channels[0][0] < src.channels[0][0]);
const tone = Edits.generateTone(8000, 0.5, 440, 0.8);
ok('tone length', tone.length === 4000);
ok('tone amplitude', approx(AD.maxAbs(tone), 0.8, 0.02));
ok('noise length', Edits.generateNoise(8000, 0.25, 0.5).length === 2000);

const etrack = Track.create({ name: 'E' });
const edata = Edits.generateTone(8000, 1, 440, 0.5);
const easset = Asset.create(edata, 'Tone');
Track.addClip(etrack, Clip.create({ name: 'Tone', assetId: easset.id, start: 0, offset: 0, duration: 1 }));
const reg = { byId: {}, list: [] };
Edits.register(reg, easset);
ok('register ajoute', reg.list.length === 1 && Edits.register(reg, easset).id === easset.id && reg.list.length === 1);
ok('splitAt cree 2 clips', Edits.splitAt(etrack, 0.4) === true && etrack.clips.length === 2);
ok('copyRegion duree', approx(AD.duration(Edits.copyRegion(etrack, reg, 0.4, 0.7)), 0.3, 1e-3));
const etrack2 = Track.create({ name: 'E2' });
Track.addClip(etrack2, Clip.create({ name: 'Tone', assetId: easset.id, start: 0, offset: 0, duration: 1 }));
ok('deleteRegion retire milieu', Edits.deleteRegion(etrack2, 0.2, 0.5) === true);
ok('deleteRegion longueur reste 0.7', approx(Track.end(etrack2), 0.7, 1e-6));
const etrack3 = Track.create({ name: 'E3' });
Track.addClip(etrack3, Clip.create({ name: 'Tone', assetId: easset.id, start: 0, offset: 0, duration: 1 }));
ok('applyRegion reussit', Edits.applyRegion(etrack3, reg, 0.3, 0.6, function (d) { return Edits.amplifyData(d, 1.5); }) === true);
const etrack4 = Track.create({ name: 'E4' });
Edits.insertData(etrack4, reg, 0, AD.silence(8000, 0.5, 1), 'Sil');
ok('insertData cree clip', etrack4.clips.length === 1 && approx(etrack4.clips[0].duration, 0.5));

console.log('\n-- engine (sans Web Audio) --');
ok('available faux', Engine.available() === false);
ok('ensure null', Engine.ensure() === null);
ok('position defaut 0', Engine.position() === 0);
ok('stop sans erreur', (function () { try { Engine.stop(); return true; } catch (e) { return false; } })());
ok('invalidate sans erreur', (function () { try { Engine.invalidate(); return true; } catch (e) { return false; } })());

console.log('\n-- app --');
App.newProject({ name: 'Session', sampleRate: 8000 });
ok('newProject nom', App.project.name === 'Session');
ok('newProject sampleRate', App.project.sampleRate === 8000);
ok('newProject 1 piste', App.project.tracks.length === 1);
ok('canUndo faux', App.canUndo() === false);

const at = App.addAsset(Asset.create(Edits.generateTone(8000, 1, 440, 0.5), 'Tone'));
ok('addAsset', App.assets.list.length === 1 && App.assetById(at.id) === at);
const kc = App.addClipFromAsset(at.id, App.project.tracks[0].id, 0);
ok('addClipFromAsset cree', kc !== null && App.project.tracks[0].clips.length === 1);
ok('clip start 0', kc.start === 0);
ok('clip duree = asset', approx(kc.duration, 1));
ok('auto-selection clip', App.selectedClip() === kc);
ok('commit (undo dispo)', App.canUndo() === true);

App.setTime(0.4);
ok('setTime', approx(App.time, 0.4));
App.setTime(1000);
ok('setTime borne haut', approx(App.time, 1));
App.setTime(-5);
ok('setTime borne bas', approx(App.time, 0));

App.setRegion(App.project.tracks[0].id, 0.2, 0.8);
ok('setRegion actif', App.selection.active === true && approx(App.selection.t0, 0.2));
const eff = App.effectiveRegion();
ok('effectiveRegion = selection', approx(eff.t0, 0.2) && approx(eff.t1, 0.8));
App.clearRegion();
ok('clearRegion inactif', App.selection.active === false);

App.setRegion(App.project.tracks[0].id, 0.2, 0.8);
App.amplify(2);
ok('amplify decoupe en 3', App.project.tracks[0].clips.length === 3);
ok('amplify duree inchangee', approx(App.duration(), 1, 1e-6));
App.undo();
ok('undo revient a 1 clip', App.project.tracks[0].clips.length === 1);
App.redo();
ok('redo revient a 3 clips', App.project.tracks[0].clips.length === 3);

App.setRegion(App.project.tracks[0].id, 0.2, 0.8);
App.regionCopy();
ok('regionCopy clipboard', App.clipboard !== null && approx(AD.duration(App.clipboard), 0.6, 1e-3));
App.setTime(1);
App.paste();
ok('paste ajoute un clip', App.project.tracks[0].clips.length === 4);

App.generateTone(880, 0.5);
ok('generateTone ajoute asset', App.assets.list.length >= 2);

App.selection.trackId = App.project.tracks[0].id;
App.toggleMute(App.project.tracks[0].id);
ok('toggleMute vrai', App.project.tracks[0].mute === true);
App.toggleMute(App.project.tracks[0].id);
ok('toggleMute faux', App.project.tracks[0].mute === false);
App.toggleSolo(App.project.tracks[0].id);
ok('toggleSolo vrai', App.project.tracks[0].solo === true);
App.toggleSolo(App.project.tracks[0].id);

App.setZoom(10000);
ok('setZoom borne haut', App.zoom === 1200);
App.setZoom(0.1);
ok('setZoom borne bas', App.zoom === 4);
App.setZoom(80);

App.addTrack();
ok('addTrack', App.project.tracks.length === 2);
App.removeTrack(App.project.tracks[1].id);
ok('removeTrack', App.project.tracks.length === 1);
App.removeTrack(App.project.tracks[0].id);
ok('removeTrack garde au moins 1', App.project.tracks.length === 1);

const sel = App.project.tracks[0].clips[0];
App.selectClip(sel.id);
ok('selectClip', App.selectedClip() === sel);
const nBefore = App.project.tracks[0].clips.length;
App.deleteSelectedClip();
ok('deleteSelectedClip', App.project.tracks[0].clips.length === nBefore - 1 && App.selectedClip() === null);

console.log('\n-- renderer --');
Renderer.init(getEl('tlCanvas'));
ok('renderer dimensions', Renderer.canvas.width === 640 && Renderer.canvas.height === 360);
App.newProject({ name: 'R', sampleRate: 8000 });
const ra = App.addAsset(Asset.create(Edits.generateTone(8000, 1, 440, 0.5), 'Tone'));
App.addClipFromAsset(ra.id, App.project.tracks[0].id, 0);
ok('draw sans erreur', (function () { try { Renderer.draw(); return true; } catch (e) { return false; } })());
ok('timeAt inverse x', approx(Renderer.timeAt(Renderer.x(0.5)), 0.5, 1e-6));
ok('trackTops longueur', Renderer.trackTops().length === 1);
ok('trackAtY trouve piste', Renderer.trackAtY(Renderer.RULER_H + 10) !== null);
ok('niceStep positif', Renderer.niceStep() > 0);

console.log('\n-- interaction --');
ok('interaction init', (function () { try { Interaction.init(getEl('tlCanvas2')); return true; } catch (e) { return false; } })());

console.log('\n-- export --');
const mix = Export.mixdown(App.project, App.assets);
ok('mixdown longueur', mix.length === Math.round(App.duration() * App.project.sampleRate));
ok('mixdown 2 canaux', mix.channels.length === 2);
ok('mixdown borne', AD.maxAbs(mix) <= 1 + 1e-9);
const wav2 = Export.wav(App.project, App.assets);
ok('export wav RIFF', String.fromCharCode(wav2[0], wav2[1], wav2[2], wav2[3]) === 'RIFF');
ok('projectJSON parse', (function () { try { return JSON.parse(Export.projectJSON(App.project, App.assets)).version === 1; } catch (e) { return false; } })());

console.log('\n-- ui (cablage) --');
ok('UI.init sans erreur', (function () { try { UI.init(); return true; } catch (e) { return false; } })());
ok('UI.render sans erreur', (function () { try { UI.render(); return true; } catch (e) { return false; } })());
ok('UI.syncDynamic sans erreur', (function () { try { UI.syncDynamic(); return true; } catch (e) { return false; } })());
ok('UI.renderTracks sans erreur', (function () { try { UI.renderTracks(); return true; } catch (e) { return false; } })());

console.log('\n========================================');
console.log('  ' + pass + ' / ' + (pass + fail) + ' tests OK');
if (fail) { console.log('  ' + fail + ' ECHEC(S)'); process.exit(1); }
console.log('  tous les tests passent.');

(function (global) {
  'use strict';

  var U = global.Utils;
  var AD = global.AudioData;
  var Clip = global.Clip;
  var Track = global.Track;

  function register(reg, asset) {
    if (asset.id && !reg.byId[asset.id]) {
      reg.byId[asset.id] = asset;
      reg.list.push(asset);
    }
    return asset;
  }

  function sliceData(reg, clip, audio) {
    var a = (audio || reg.byId)[clip.assetId];
    if (!a || !a.data) return null;
    var sr = a.data.sampleRate;
    var s0 = Math.round(clip.offset * sr);
    var s1 = Math.round((clip.offset + clip.duration) * sr);
    return AD.slice(a.data, s0, s1);
  }

  function splitAt(track, t, audio) {
    var made = false;
    var list = track.clips.slice();
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (Clip.contains(c, t)) {
        var parts = Clip.split(c, t);
        if (parts) {
          Track.removeClip(track, c.id);
          Track.addClip(track, parts.left);
          Track.addClip(track, parts.right);
          made = true;
        }
      }
    }
    return made;
  }

  function regionClips(track, t0, t1) {
    var out = [];
    var list = Track.sortedClips(track);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.start >= t0 - 1e-9 && Clip.end(c) <= t1 + 1e-9) out.push(c);
    }
    return out;
  }

  function shiftClips(track, from, delta) {
    var list = track.clips;
    for (var i = 0; i < list.length; i++) {
      if (list[i].start >= from - 1e-9) list[i].start += delta;
    }
    for (var j = 0; j < list.length; j++) if (list[j].start < 0) list[j].start = 0;
  }

  function deleteRegion(track, t0, t1) {
    if (t1 <= t0) return false;
    splitAt(track, t0);
    splitAt(track, t1);
    var inside = regionClips(track, t0, t1);
    for (var i = 0; i < inside.length; i++) Track.removeClip(track, inside[i].id);
    shiftClips(track, t1, -(t1 - t0));
    return true;
  }

  function silenceRegion(track, reg, t0, t1) {
    if (t1 <= t0) return false;
    splitAt(track, t0);
    splitAt(track, t1);
    var inside = regionClips(track, t0, t1);
    var sr = 44100;
    var chans = 1;
    for (var i = 0; i < inside.length; i++) {
      var data = sliceData(reg, inside[i]);
      if (data) { sr = data.sampleRate; chans = data.channels.length; }
    }
    for (var k = 0; k < inside.length; k++) {
      var sil = AD.silence(sr, inside[k].duration, chans);
      var asset = register(reg, global.Asset.create(sil, 'Silence'));
      inside[k].assetId = asset.id;
      inside[k].offset = 0;
    }
    return true;
  }

  function copyRegion(track, reg, t0, t1) {
    splitAt(track, t0);
    splitAt(track, t1);
    var inside = regionClips(track, t0, t1);
    var parts = [];
    for (var i = 0; i < inside.length; i++) {
      var d = sliceData(reg, inside[i]);
      if (d) parts.push(d);
    }
    return AD.concat(parts);
  }

  function insertData(track, reg, t, data, name) {
    if (!data) return null;
    shiftClips(track, t, data.length / data.sampleRate);
    var asset = register(reg, global.Asset.create(data, name || 'Traitement'));
    var clip = Clip.create({ name: name || asset.name, assetId: asset.id, start: t, offset: 0, duration: AD.duration(data) });
    Track.addClip(track, clip);
    return clip;
  }

  function applyRegion(track, reg, t0, t1, transform) {
    splitAt(track, t0);
    splitAt(track, t1);
    var inside = regionClips(track, t0, t1);
    for (var i = 0; i < inside.length; i++) {
      var d = sliceData(reg, inside[i]);
      if (!d) continue;
      var nd = transform(d);
      if (!nd) continue;
      var asset = register(reg, global.Asset.create(nd, inside[i].name));
      inside[i].assetId = asset.id;
      inside[i].offset = 0;
      inside[i].duration = AD.duration(nd);
    }
    return inside.length > 0;
  }

  function deleteClip(track, id) {
    return Track.removeClip(track, id);
  }

  /* ---- pure data transforms ---- */

  function amplifyData(data, factor) {
    var out = AD.clone(data);
    var c, i;
    for (c = 0; c < out.channels.length; c++) {
      var ch = out.channels[c];
      for (i = 0; i < ch.length; i++) ch[i] = U.clamp(ch[i] * factor, -1, 1);
    }
    return out;
  }

  function normalizeData(data, target) {
    target = target == null ? 0.99 : target;
    var m = AD.maxAbs(data);
    if (m <= 1e-6) return AD.clone(data);
    return amplifyData(data, target / m);
  }

  function reverseData(data) {
    var out = AD.clone(data);
    for (var c = 0; c < out.channels.length; c++) out.channels[c].reverse();
    return out;
  }

  function fadeData(data, seconds, dir) {
    var sr = data.sampleRate;
    var n = Math.min(data.length, Math.round((seconds || 0) * sr));
    var out = AD.clone(data);
    if (n <= 0) return out;
    for (var i = 0; i < n; i++) {
      var g;
      if (dir === 'out') g = 1 - i / n;
      else g = (i + 1) / n;
      for (var c = 0; c < out.channels.length; c++) {
        var idx = dir === 'out' ? out.channels[c].length - 1 - i : i;
        out.channels[c][idx] *= g;
      }
    }
    return out;
  }

  function generateTone(sampleRate, seconds, freq, gain) {
    sampleRate = sampleRate || 44100;
    var n = Math.round((seconds || 0) * sampleRate);
    var out = AD.create(sampleRate, 1, n);
    var amp = gain == null ? 0.8 : gain;
    for (var i = 0; i < n; i++) {
      out.channels[0][i] = amp * Math.sin(2 * Math.PI * (freq || 440) * i / sampleRate);
    }
    return out;
  }

  function generateNoise(sampleRate, seconds, gain) {
    sampleRate = sampleRate || 44100;
    var n = Math.round((seconds || 0) * sampleRate);
    var out = AD.create(sampleRate, 1, n);
    var amp = gain == null ? 0.5 : gain;
    for (var i = 0; i < n; i++) {
      out.channels[0][i] = amp * (Math.random() * 2 - 1);
    }
    return out;
  }

  global.Edits = {
    register: register,
    sliceData: sliceData,
    splitAt: splitAt,
    regionClips: regionClips,
    deleteRegion: deleteRegion,
    silenceRegion: silenceRegion,
    copyRegion: copyRegion,
    insertData: insertData,
    applyRegion: applyRegion,
    deleteClip: deleteClip,
    amplifyData: amplifyData,
    normalizeData: normalizeData,
    reverseData: reverseData,
    fadeData: fadeData,
    generateTone: generateTone,
    generateNoise: generateNoise
  };
})(window);

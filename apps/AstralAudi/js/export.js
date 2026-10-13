(function (global) {
  'use strict';

  var U = global.Utils;
  var AD = global.AudioData;
  var Clip = global.Clip;
  var Track = global.Track;
  var Project = global.Project;

  var Export = {};

  function sampleAt(data, ch, posSamples) {
    var i0 = Math.floor(posSamples);
    if (i0 < 0 || i0 >= data.length) return 0;
    var i1 = Math.min(data.length - 1, i0 + 1);
    var f = posSamples - i0;
    var c = data.channels[Math.min(ch, data.channels.length - 1)];
    return c[i0] * (1 - f) + c[i1] * f;
  }

  Export.mixdown = function (project, assets) {
    var sr = project.sampleRate;
    var channels = 2;
    var duration = Project.duration(project);
    var length = Math.round(duration * sr);
    var out = AD.create(sr, channels, length);
    var anySolo = Project.anySolo(project);

    for (var ti = 0; ti < project.tracks.length; ti++) {
      var track = project.tracks[ti];
      if (track.mute || (anySolo && !track.solo)) continue;
      var tGain = track.gain;
      for (var ci = 0; ci < track.clips.length; ci++) {
        var clip = track.clips[ci];
        var asset = assets.byId[clip.assetId];
        if (!asset || !asset.data) continue;
        var data = asset.data;
        var s0 = Math.max(0, Math.round(clip.start * sr));
        var s1 = Math.min(length, Math.round(Clip.end(clip) * sr));
        for (var i = s0; i < s1; i++) {
          var local = (i - clip.start * sr) / sr;
          var g = Clip.gainAt(clip, local) * tGain;
          if (g === 0) continue;
          var srcPos = (clip.offset + local) * data.sampleRate;
          for (var c = 0; c < channels; c++) {
            var v = sampleAt(data, c, srcPos) * g;
            out.channels[c][i] += v;
          }
        }
      }
    }
    for (var oc = 0; oc < out.channels.length; oc++) {
      var ch = out.channels[oc];
      for (var k = 0; k < ch.length; k++) ch[k] = U.clamp(ch[k], -1, 1);
    }
    return out;
  };

  Export.wav = function (project, assets) {
    return AD.wavEncode(this.mixdown(project, assets));
  };

  Export.download = function (name, data) {
    if (!global.Blob || !global.URL || !global.document) return;
    var blob = data instanceof global.Blob ? data : new global.Blob([data], { type: 'application/octet-stream' });
    var url = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url;
    a.download = name;
    global.document.body.appendChild(a);
    a.click();
    global.document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
  };

  Export.wavFile = function (project, assets, opts) {
    opts = opts || {};
    if (!project || !Project.duration(project)) return null;
    var bytes = this.wav(project, assets);
    if (opts.download !== false) this.download(opts.name || (project.name + '.wav'), bytes);
    return bytes;
  };

  Export.projectJSON = function (project, assets, opts) {
    opts = opts || {};
    if (!project) return null;
    var meta = assets.list.map(function (a) {
      return { id: a.id, name: a.name, sampleRate: a.sampleRate, channels: a.data ? a.data.channels.length : 0, duration: a.duration };
    });
    var json = JSON.stringify({ version: 1, project: project, assets: meta }, null, 2);
    if (opts.download) this.download(opts.name || (project.name + '.json'), json);
    return json;
  };

  global.Export = Export;
})(window);

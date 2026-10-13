(function (global) {
  'use strict';

  var U = global.Utils;

  function create(sampleRate, channelCount, length) {
    channelCount = Math.max(1, channelCount | 0);
    length = Math.max(0, length | 0);
    var channels = [];
    for (var c = 0; c < channelCount; c++) channels.push(new Float32Array(length));
    return { sampleRate: sampleRate || 44100, length: length, channels: channels };
  }

  function fromChannels(sampleRate, channels) {
    channels = channels && channels.length ? channels : [new Float32Array(0)];
    return { sampleRate: sampleRate || 44100, length: channels[0].length, channels: channels };
  }

  function clone(data) {
    var chs = [];
    for (var c = 0; c < data.channels.length; c++) chs.push(new Float32Array(data.channels[c]));
    return { sampleRate: data.sampleRate, length: data.length, channels: chs };
  }

  function duration(data) {
    return data && data.sampleRate ? data.length / data.sampleRate : 0;
  }

  function slice(data, startSample, endSample) {
    startSample = U.clamp(Math.round(startSample), 0, data.length);
    endSample = U.clamp(Math.round(endSample == null ? data.length : endSample), 0, data.length);
    if (endSample < startSample) endSample = startSample;
    var len = endSample - startSample;
    var chs = [];
    for (var c = 0; c < data.channels.length; c++) {
      chs.push(data.channels[c].slice(startSample, endSample));
    }
    return { sampleRate: data.sampleRate, length: len, channels: chs };
  }

  function concat(list) {
    list = list.filter(function (d) { return !!d; });
    if (!list.length) return create(44100, 1, 0);
    var sampleRate = list[0].sampleRate;
    var channelCount = list[0].channels.length;
    var total = 0;
    var i, c;
    for (i = 0; i < list.length; i++) total += list[i].length;
    var out = create(sampleRate, channelCount, total);
    var pos = 0;
    for (i = 0; i < list.length; i++) {
      var d = list[i];
      for (c = 0; c < channelCount; c++) {
        var src = d.channels[Math.min(c, d.channels.length - 1)];
        out.channels[c].set(src.subarray(0, d.length), pos);
      }
      pos += d.length;
    }
    return out;
  }

  function silence(sampleRate, seconds, channelCount) {
    return create(sampleRate, channelCount || 1, Math.round((seconds || 0) * (sampleRate || 44100)));
  }

  function maxAbs(data) {
    var m = 0;
    for (var c = 0; c < data.channels.length; c++) {
      var ch = data.channels[c];
      for (var i = 0; i < ch.length; i++) {
        var a = ch[i] < 0 ? -ch[i] : ch[i];
        if (a > m) m = a;
      }
    }
    return m;
  }

  function peaks(data, buckets) {
    buckets = Math.max(1, buckets | 0);
    var out = new Array(buckets);
    if (!data.length) {
      for (var b0 = 0; b0 < buckets; b0++) out[b0] = [0, 0];
      return out;
    }
    var ratio = data.length / buckets;
    for (var b = 0; b < buckets; b++) {
      var s0 = Math.floor(b * ratio);
      var s1 = Math.floor((b + 1) * ratio);
      if (s1 <= s0) s1 = s0 + 1;
      if (s1 > data.length) s1 = data.length;
      var mn = 1e9, mx = -1e9;
      for (var c = 0; c < data.channels.length; c++) {
        var ch = data.channels[c];
        for (var i = s0; i < s1; i++) {
          var v = ch[i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }
      if (mn > mx) { mn = 0; mx = 0; }
      out[b] = [mn, mx];
    }
    return out;
  }

  function wavEncode(data) {
    var channelCount = data.channels.length;
    var frames = data.length;
    var bytesPerSample = 2;
    var dataSize = frames * channelCount * bytesPerSample;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    function writeString(off, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    }
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, data.sampleRate, true);
    view.setUint32(28, data.sampleRate * channelCount * bytesPerSample, true);
    view.setUint16(32, channelCount * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    var off = 44;
    for (var i2 = 0; i2 < frames; i2++) {
      for (var c = 0; c < channelCount; c++) {
        var s = U.clamp(data.channels[c][i2], -1, 1);
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return new Uint8Array(buffer);
  }

  global.AudioData = {
    create: create,
    fromChannels: fromChannels,
    clone: clone,
    duration: duration,
    slice: slice,
    concat: concat,
    silence: silence,
    maxAbs: maxAbs,
    peaks: peaks,
    wavEncode: wavEncode
  };
})(window);

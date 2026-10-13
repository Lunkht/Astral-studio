(function (global) {
  'use strict';

  var U = global.Utils;

  function create(opts) {
    opts = opts || {};
    return {
      id: U.uid('clip'),
      name: opts.name || 'Clip',
      assetId: opts.assetId || null,
      start: U.isNum(opts.start) ? opts.start : 0,
      offset: U.isNum(opts.offset) ? opts.offset : 0,
      duration: U.isNum(opts.duration) ? opts.duration : 0,
      gain: U.isNum(opts.gain) ? opts.gain : 1,
      fadeIn: U.isNum(opts.fadeIn) ? opts.fadeIn : 0,
      fadeOut: U.isNum(opts.fadeOut) ? opts.fadeOut : 0
    };
  }

  function end(clip) {
    return clip.start + clip.duration;
  }

  function contains(clip, t) {
    return t >= clip.start && t < end(clip);
  }

  function localTime(clip, t) {
    return t - clip.start;
  }

  function gainAt(clip, local) {
    var g = clip.gain;
    var d = clip.duration;
    if (clip.fadeIn > 0 && local < clip.fadeIn) g *= U.clamp(local / clip.fadeIn, 0, 1);
    if (clip.fadeOut > 0 && local > d - clip.fadeOut) g *= U.clamp((d - local) / clip.fadeOut, 0, 1);
    return g;
  }

  function sourceTime(clip, t) {
    return clip.offset + (t - clip.start);
  }

  function split(clip, t) {
    if (t <= clip.start || t >= end(clip)) return null;
    var left = U.deepClone(clip);
    var right = U.deepClone(clip);
    left.id = U.uid('clip');
    right.id = U.uid('clip');
    left.duration = t - clip.start;
    left.fadeOut = 0;
    right.start = t;
    right.offset = clip.offset + (t - clip.start);
    right.duration = end(clip) - t;
    right.fadeIn = 0;
    return { left: left, right: right };
  }

  global.Clip = {
    create: create,
    end: end,
    contains: contains,
    localTime: localTime,
    gainAt: gainAt,
    sourceTime: sourceTime,
    split: split
  };
})(window);

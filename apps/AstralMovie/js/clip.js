(function (global) {
  'use strict';

  var U = global.Utils;

  var TYPES = ['video', 'audio', 'image', 'title'];

  function create(opts) {
    opts = opts || {};
    var type = TYPES.indexOf(opts.type) >= 0 ? opts.type : 'video';
    var srcDuration;
    if (Object.prototype.hasOwnProperty.call(opts, 'srcDuration')) {
      srcDuration = opts.srcDuration === null ? null : (U.isNum(opts.srcDuration) ? opts.srcDuration : 0);
    } else {
      srcDuration = type === 'title' ? null : 0;
    }
    return {
      id: U.uid('clip'),
      name: opts.name || 'Clip',
      type: type,
      assetId: opts.assetId || null,
      track: opts.track || null,
      start: U.isNum(opts.start) ? opts.start : 0,
      inPoint: U.isNum(opts.inPoint) ? opts.inPoint : 0,
      duration: U.isNum(opts.duration) ? opts.duration : 0,
      srcDuration: srcDuration,
      opacity: U.isNum(opts.opacity) ? opts.opacity : 1,
      speed: U.isNum(opts.speed) && opts.speed > 0 ? opts.speed : 1,
      text: opts.text || 'Titre',
      color: opts.color || '#ffffff',
      fontSize: opts.fontSize || 64,
      align: opts.align || 'center'
    };
  }

  function end(clip) {
    return clip.start + clip.duration;
  }

  function contains(clip, t) {
    return t >= clip.start && t < end(clip);
  }

  function sourceTime(clip, t) {
    return clip.inPoint + (t - clip.start) * clip.speed;
  }

  function split(clip, t) {
    if (t <= clip.start || t >= end(clip)) return null;
    var left = U.deepClone(clip);
    left.duration = t - clip.start;
    var right = U.deepClone(clip);
    right.id = U.uid('clip');
    right.name = clip.name;
    right.start = t;
    right.inPoint = clip.inPoint + (t - clip.start) * clip.speed;
    right.duration = end(clip) - t;
    return { left: left, right: right };
  }

  function setSourceLimit(clip, assetDuration) {
    clip.srcDuration = U.isNum(assetDuration) && assetDuration > 0 ? assetDuration : null;
    return clip;
  }

  function maxDuration(clip) {
    if (clip.srcDuration == null) return Infinity;
    return Math.max(0, (clip.srcDuration - clip.inPoint) / clip.speed);
  }

  global.Clip = {
    TYPES: TYPES,
    create: create,
    end: end,
    contains: contains,
    sourceTime: sourceTime,
    split: split,
    setSourceLimit: setSourceLimit,
    maxDuration: maxDuration
  };
})(window);

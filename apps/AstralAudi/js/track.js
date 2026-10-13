(function (global) {
  'use strict';

  var U = global.Utils;
  var Clip = global.Clip;

  function create(opts) {
    opts = opts || {};
    return {
      id: U.uid('track'),
      name: opts.name || 'Piste',
      clips: [],
      gain: U.isNum(opts.gain) ? opts.gain : 1,
      mute: !!opts.mute,
      solo: !!opts.solo,
      pan: U.isNum(opts.pan) ? opts.pan : 0,
      height: U.isNum(opts.height) ? opts.height : 84
    };
  }

  function addClip(track, clip) {
    track.clips.push(clip);
    return clip;
  }

  function clipById(track, id) {
    for (var i = 0; i < track.clips.length; i++) if (track.clips[i].id === id) return track.clips[i];
    return null;
  }

  function removeClip(track, id) {
    for (var i = 0; i < track.clips.length; i++) {
      if (track.clips[i].id === id) { track.clips.splice(i, 1); return true; }
    }
    return false;
  }

  function sortedClips(track) {
    return track.clips.slice().sort(function (a, b) { return a.start - b.start; });
  }

  function clipAt(track, t) {
    for (var i = 0; i < track.clips.length; i++) {
      if (Clip.contains(track.clips[i], t)) return track.clips[i];
    }
    return null;
  }

  function end(track) {
    var e = 0;
    for (var i = 0; i < track.clips.length; i++) e = Math.max(e, Clip.end(track.clips[i]));
    return e;
  }

  global.Track = {
    create: create,
    addClip: addClip,
    clipById: clipById,
    removeClip: removeClip,
    sortedClips: sortedClips,
    clipAt: clipAt,
    end: end
  };
})(window);

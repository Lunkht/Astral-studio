(function (global) {
  'use strict';

  var U = global.Utils;
  var C = global.Clip;

  function makeTrack(kind, name) {
    return { id: U.uid('track'), kind: kind, name: name, muted: false, locked: false };
  }

  function create(opts) {
    opts = opts || {};
    return {
      name: opts.name || 'Sequence',
      width: opts.width || 1280,
      height: opts.height || 720,
      fps: opts.fps || 30,
      background: opts.background || '#000000',
      tracks: [makeTrack('video', 'V1'), makeTrack('audio', 'A1')],
      clips: []
    };
  }

  function addTrack(project, kind, name) {
    var count = 0;
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].kind === kind) count++;
    var track = makeTrack(kind, name || (kind === 'video' ? 'V' : 'A') + (count + 1));
    if (kind === 'video') project.tracks.unshift(track);
    else project.tracks.push(track);
    return track;
  }

  function trackById(project, id) {
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].id === id) return project.tracks[i];
    return null;
  }

  function videoTracks(project) { return project.tracks.filter(function (t) { return t.kind === 'video'; }); }
  function audioTracks(project) { return project.tracks.filter(function (t) { return t.kind === 'audio'; }); }

  function addClip(project, clip) {
    project.clips.push(clip);
    return clip;
  }

  function clipById(project, id) {
    for (var i = 0; i < project.clips.length; i++) if (project.clips[i].id === id) return project.clips[i];
    return null;
  }

  function removeClip(project, id) {
    for (var i = 0; i < project.clips.length; i++) {
      if (project.clips[i].id === id) { project.clips.splice(i, 1); return true; }
    }
    return false;
  }

  function clipsOnTrack(project, trackId) {
    return project.clips
      .filter(function (c) { return c.track === trackId; })
      .sort(function (a, b) { return a.start - b.start; });
  }

  function visualClipsAt(project, t) {
    var tracks = videoTracks(project);
    var out = [];
    for (var i = tracks.length - 1; i >= 0; i--) {
      var list = clipsOnTrack(project, tracks[i].id);
      for (var j = 0; j < list.length; j++) {
        if (C.contains(list[j], t)) out.push({ clip: list[j], track: tracks[i] });
      }
    }
    return out;
  }

  function audioClipsAt(project, t) {
    var tracks = audioTracks(project);
    var out = [];
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].muted) continue;
      var list = clipsOnTrack(project, tracks[i].id);
      for (var j = 0; j < list.length; j++) {
        if (C.contains(list[j], t)) out.push({ clip: list[j], track: tracks[i] });
      }
    }
    return out;
  }

  function duration(project) {
    var max = 0;
    for (var i = 0; i < project.clips.length; i++) max = Math.max(max, C.end(project.clips[i]));
    return max;
  }

  function moveClip(project, id, newStart) {
    var clip = clipById(project, id);
    if (!clip || clip.locked) return null;
    clip.start = Math.max(0, U.isNum(newStart) ? newStart : clip.start);
    return clip;
  }

  function trimClip(project, id, edge, time, opts) {
    var clip = clipById(project, id);
    if (!clip || clip.locked) return null;
    var minDur = (opts && opts.min) || 0.04;
    if (edge === 'start') {
      var newStart = U.clamp(time, 0, clip.start + clip.duration - minDur);
      var delta = newStart - clip.start;
      if (clip.inPoint + delta * clip.speed < 0) {
        delta = -clip.inPoint / clip.speed;
        newStart = clip.start + delta;
      }
      clip.inPoint = clip.inPoint + delta * clip.speed;
      clip.duration = clip.duration - delta;
      clip.start = newStart;
    } else {
      var newEnd = Math.max(clip.start + minDur, time);
      var limit = C.maxDuration(clip);
      if (limit !== Infinity) newEnd = Math.min(newEnd, clip.start + limit);
      clip.duration = newEnd - clip.start;
    }
    return clip;
  }

  function splitAt(project, t, clipId) {
    var made = [];
    var result = [];
    for (var i = 0; i < project.clips.length; i++) {
      var clip = project.clips[i];
      if (clipId && clip.id !== clipId) { result.push(clip); continue; }
      var track = trackById(project, clip.track);
      if (track && track.locked) { result.push(clip); continue; }
      var parts = C.split(clip, t);
      if (parts) {
        result.push(parts.left);
        result.push(parts.right);
        made.push(parts.right);
      } else {
        result.push(clip);
      }
    }
    project.clips = result;
    return made;
  }

  global.Project = {
    create: create,
    addTrack: addTrack,
    trackById: trackById,
    videoTracks: videoTracks,
    audioTracks: audioTracks,
    addClip: addClip,
    clipById: clipById,
    removeClip: removeClip,
    clipsOnTrack: clipsOnTrack,
    visualClipsAt: visualClipsAt,
    audioClipsAt: audioClipsAt,
    duration: duration,
    moveClip: moveClip,
    trimClip: trimClip,
    splitAt: splitAt
  };
})(window);

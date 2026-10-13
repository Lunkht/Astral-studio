(function (global) {
  'use strict';

  var U = global.Utils;
  var Track = global.Track;

  function create(opts) {
    opts = opts || {};
    var project = {
      id: U.uid('proj'),
      name: opts.name || 'Projet',
      sampleRate: U.isNum(opts.sampleRate) ? opts.sampleRate : 44100,
      tracks: []
    };
    if (opts.tracks) {
      project.tracks = opts.tracks;
    } else {
      project.tracks.push(Track.create({ name: 'Piste 1' }));
    }
    return project;
  }

  function addTrack(project, track, index) {
    if (index == null || index < 0 || index > project.tracks.length) project.tracks.push(track);
    else project.tracks.splice(index, 0, track);
    return track;
  }

  function newTrack(project, name) {
    var n = project.tracks.length + 1;
    var t = Track.create({ name: name || ('Piste ' + n) });
    project.tracks.push(t);
    return t;
  }

  function removeTrack(project, id) {
    for (var i = 0; i < project.tracks.length; i++) {
      if (project.tracks[i].id === id) { project.tracks.splice(i, 1); return true; }
    }
    return false;
  }

  function trackById(project, id) {
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].id === id) return project.tracks[i];
    return null;
  }

  function duration(project) {
    var d = 0;
    for (var i = 0; i < project.tracks.length; i++) d = Math.max(d, Track.end(project.tracks[i]));
    return d;
  }

  function anySolo(project) {
    for (var i = 0; i < project.tracks.length; i++) if (project.tracks[i].solo) return true;
    return false;
  }

  global.Project = {
    create: create,
    addTrack: addTrack,
    newTrack: newTrack,
    removeTrack: removeTrack,
    trackById: trackById,
    duration: duration,
    anySolo: anySolo
  };
})(window);

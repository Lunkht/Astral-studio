(function (global) {
  'use strict';

  var U = global.Utils;

  var KINDS = ['video', 'audio', 'image'];

  function create(opts) {
    opts = opts || {};
    var kind = KINDS.indexOf(opts.kind) >= 0 ? opts.kind : 'video';
    return {
      id: U.uid('asset'),
      kind: kind,
      name: opts.name || 'Media',
      src: opts.src || '',
      duration: U.isNum(opts.duration) ? opts.duration : (kind === 'image' ? 5 : 0),
      width: opts.width || 0,
      height: opts.height || 0,
      hasAudio: opts.hasAudio !== false,
      loaded: kind === 'image' ? false : false,
      element: null,
      objectUrl: opts.objectUrl !== false
    };
  }

  function isVisual(asset) {
    return !!asset && (asset.kind === 'video' || asset.kind === 'image');
  }

  function isFiniteDuration(asset) {
    return !!asset && U.isNum(asset.duration) && asset.duration > 0;
  }

  function revoke(asset) {
    if (asset && asset.objectUrl && asset.src && global.URL && global.URL.revokeObjectURL) {
      try { global.URL.revokeObjectURL(asset.src); } catch (e) { /* ignore */ }
    }
  }

  function probe(asset) {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined' || !document.createElement) return resolve(asset);
      var el;
      if (asset.kind === 'image') {
        el = document.createElement('img');
        el.onload = function () {
          asset.width = el.naturalWidth || el.width || 0;
          asset.height = el.naturalHeight || el.height || 0;
          asset.loaded = true;
          resolve(asset);
        };
        el.onerror = function () { resolve(asset); };
        el.src = asset.src;
        asset.element = el;
        return;
      }
      el = document.createElement(asset.kind === 'audio' ? 'audio' : 'video');
      var done = function () {
        asset.duration = U.isNum(el.duration) ? el.duration : asset.duration;
        asset.width = el.videoWidth || asset.width || 0;
        asset.height = el.videoHeight || asset.height || 0;
        asset.loaded = true;
        resolve(asset);
      };
      el.onloadedmetadata = done;
      el.onerror = function () { resolve(asset); };
      el.preload = 'auto';
      el.src = asset.src;
      asset.element = el;
    });
  }

  global.Asset = {
    KINDS: KINDS,
    create: create,
    isVisual: isVisual,
    isFiniteDuration: isFiniteDuration,
    revoke: revoke,
    probe: probe
  };
})(window);

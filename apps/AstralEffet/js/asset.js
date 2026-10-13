(function (global) {
  'use strict';

  var U = global.Utils;

  var KINDS = ['image', 'video'];

  function create(opts) {
    opts = opts || {};
    var kind = KINDS.indexOf(opts.kind) >= 0 ? opts.kind : 'image';
    return {
      id: U.uid('asset'),
      name: opts.name || 'Media',
      kind: kind,
      url: opts.url || '',
      element: null,
      width: 0,
      height: 0,
      duration: kind === 'video' ? 0 : null,
      ready: false,
      error: false
    };
  }

  function isVisual(a) {
    return !!a && (a.kind === 'image' || a.kind === 'video');
  }

  function probe(asset, onReady) {
    if (!asset) return null;
    if (asset.element) {
      if (onReady) onReady(asset);
      return asset.element;
    }
    var el;
    if (asset.kind === 'video') {
      el = document.createElement('video');
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
    } else {
      el = document.createElement('img');
    }
    function ready() {
      asset.width = el.videoWidth || el.naturalWidth || 0;
      asset.height = el.videoHeight || el.naturalHeight || 0;
      if (asset.kind === 'video' && U.isNum(el.duration)) asset.duration = el.duration;
      asset.ready = true;
      if (onReady) onReady(asset);
    }
    el.onload = ready;
    el.onloadeddata = ready;
    el.onerror = function () { asset.error = true; };
    el.src = asset.url;
    asset.element = el;
    return el;
  }

  function revoke(asset) {
    if (asset && asset.url && asset.url.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(asset.url); } catch (e) { /* ignore */ }
    }
  }

  global.Asset = {
    KINDS: KINDS,
    create: create,
    isVisual: isVisual,
    probe: probe,
    revoke: revoke
  };
})(window);

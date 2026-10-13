(function (global) {
  'use strict';

  var U = global.Utils;
  var AD = global.AudioData;

  function create(data, name) {
    return {
      id: U.uid('asset'),
      name: name || 'Audio',
      data: data,
      sampleRate: data.sampleRate,
      length: data.length,
      duration: AD.duration(data),
      _peaks: {}
    };
  }

  function duration(asset) {
    return asset && asset.data ? AD.duration(asset.data) : 0;
  }

  function peaks(asset, buckets) {
    buckets = Math.max(1, buckets | 0);
    if (!asset._peaks[buckets]) asset._peaks[buckets] = AD.peaks(asset.data, buckets);
    return asset._peaks[buckets];
  }

  function clearCache(asset) {
    asset._peaks = {};
  }

  function revoke(asset) {
    if (asset) asset.data = null;
  }

  global.Asset = {
    create: create,
    duration: duration,
    peaks: peaks,
    clearCache: clearCache,
    revoke: revoke
  };
})(window);

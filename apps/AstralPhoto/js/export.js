(function (global) {
  'use strict';

  var App = global.App;
  var Layer = global.Layer;

  function flatten(background) {
    var doc = App.doc;
    if (!doc) return null;
    var c = Layer.newCanvas(doc.width, doc.height);
    var ctx = Layer.context(c);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
    App.compositeLayers(ctx, doc.width, doc.height);
    return c;
  }

  function download(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function save(canvas, ext, quality) {
    var name = (App.doc && App.doc.name ? App.doc.name : 'astralphoto') + '.' + ext;
    var finish = function (blobOrUrl) {
      if (typeof blobOrUrl === 'string') { download(blobOrUrl, name); return; }
      var url = global.URL.createObjectURL(blobOrUrl);
      download(url, name);
      global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 4000);
    };
    if (canvas.toBlob) canvas.toBlob(finish, 'image/' + (ext === 'jpg' ? 'jpeg' : ext), quality);
    else finish(canvas.toDataURL('image/' + (ext === 'jpg' ? 'jpeg' : ext), quality));
  }

  var Exporter = {
    exportPNG: function () {
      var c = flatten(null);
      if (c) save(c, 'png', 1);
    },
    exportJPEG: function () {
      var c = flatten('#ffffff');
      if (c) save(c, 'jpg', 0.92);
    },
    flatten: flatten
  };

  global.Exporter = Exporter;
})(typeof window !== 'undefined' ? window : this);

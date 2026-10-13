(function (global) {
  'use strict';

  var S = global.Shapes;
  var L = global.Layer;
  var App = global.App;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function styleAttrs(s) {
    var a = '';
    a += ' fill="' + (s.fill && s.fill !== 'none' ? s.fill : 'none') + '"';
    if (s.stroke && s.stroke !== 'none' && s.strokeWidth > 0) {
      a += ' stroke="' + s.stroke + '" stroke-width="' + s.strokeWidth + '"';
    }
    if (s.opacity != null && s.opacity < 1) a += ' opacity="' + s.opacity + '"';
    return a;
  }

  function shapeToSvg(s) {
    if (s.visible === false) return '';
    if (s.type === 'text') {
      return '<text x="' + s.x + '" y="' + (s.y + s.fontSize) + '" font-size="' + s.fontSize + '" fill="' +
        (s.fill && s.fill !== 'none' ? s.fill : '#000000') + '">' + esc(s.text) + '</text>';
    }
    if (S.isPath(s)) {
      var pts = s.points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
      var tag = s.closed ? 'polygon' : 'polyline';
      return '<' + tag + ' points="' + pts + '"' + styleAttrs(s) + ' stroke-linejoin="round" stroke-linecap="round" />';
    }
    if (s.type === 'ellipse') {
      return '<ellipse cx="' + (s.x + s.w / 2) + '" cy="' + (s.y + s.h / 2) + '" rx="' + Math.abs(s.w / 2) +
        '" ry="' + Math.abs(s.h / 2) + '"' + styleAttrs(s) + ' />';
    }
    if (s.type === 'line') {
      return '<line x1="' + s.x + '" y1="' + s.y + '" x2="' + (s.x + s.w) + '" y2="' + (s.y + s.h) + '"' + styleAttrs(s) + ' />';
    }
    return '<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"' + styleAttrs(s) + ' />';
  }

  function svgString(frame) {
    var doc = App.doc;
    frame = frame == null ? App.currentFrame : frame;
    var body = '';
    for (var i = 0; i < doc.layers.length; i++) {
      var layer = doc.layers[i];
      if (!layer.visible) continue;
      var shapes = L.renderAt(layer, frame);
      for (var j = 0; j < shapes.length; j++) body += shapeToSvg(shapes[j]);
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + doc.width + '" height="' + doc.height +
      '" viewBox="0 0 ' + doc.width + ' ' + doc.height + '">\n' +
      '<rect width="100%" height="100%" fill="' + doc.background + '" />\n' +
      body + '\n</svg>\n';
  }

  function renderToCanvas(frame) {
    var doc = App.doc;
    var canvas = document.createElement('canvas');
    canvas.width = doc.width;
    canvas.height = doc.height;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = doc.background;
      ctx.fillRect(0, 0, doc.width, doc.height);
      for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (!layer.visible) continue;
        var shapes = L.renderAt(layer, frame == null ? App.currentFrame : frame);
        for (var j = 0; j < shapes.length; j++) S.draw(ctx, shapes[j]);
      }
    }
    return canvas;
  }

  function download(filename, href) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    if (document.body && document.body.appendChild) document.body.appendChild(a);
    if (a.click) a.click();
    if (document.body && document.body.removeChild) document.body.removeChild(a);
  }

  var Export = {
    svgString: svgString,
    renderToCanvas: renderToCanvas,

    svg: function () {
      var name = (App.doc.name || 'AstralAnimate') + '.svg';
      var blob = new Blob([svgString()], { type: 'image/svg+xml' });
      download(name, URL.createObjectURL(blob));
    },

    png: function () {
      var name = (App.doc.name || 'AstralAnimate') + '.png';
      download(name, renderToCanvas().toDataURL('image/png'));
    },

    svgDialog: function () {
      var code = svgString();
      global.UI.openModal('Exporter en SVG',
        '<p>Image ' + App.currentFrame + ' — copie le code ci-dessous ou télécharge le fichier.</p>' +
        '<textarea class="modal-code" readonly>' + esc(code) + '</textarea>',
        function () { Export.svg(); }, 'Télécharger');
    }
  };

  global.Export = Export;
})(window);

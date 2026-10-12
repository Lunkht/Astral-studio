(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;
  var App = global.App;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function color(v) { return v && v !== 'none' ? v : 'none'; }
  function deg(r) { return U.round((r * 180) / Math.PI, 3); }
  function n(v) { return U.round(v, 2); }

  function shapeToSvg(s) {
    var c = S.center(s);
    var tf = s.rotation ? ' transform="rotate(' + deg(s.rotation) + ' ' + n(c.x) + ' ' + n(c.y) + ')"' : '';
    var common = ' fill="' + color(s.fill) + '" stroke="' + color(s.stroke) + '" stroke-width="' + s.strokeWidth + '"' +
      (s.opacity < 1 ? ' opacity="' + s.opacity + '"' : '') + tf;

    if (s.type === 'path') {
      var fr = s.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '';
      return '<path d="' + pathToD(s) + '"' + common + fr + ' stroke-linejoin="round" stroke-linecap="round" />';
    }
    if (s.type === 'ellipse') {
      return '<ellipse cx="' + n(c.x) + '" cy="' + n(c.y) + '" rx="' + n(Math.abs(s.w) / 2) +
        '" ry="' + n(Math.abs(s.h) / 2) + '"' + common + ' />';
    }
    if (s.type === 'line') {
      var p = S.linePoints(s);
      return '<line x1="' + n(p.a.x) + '" y1="' + n(p.a.y) + '" x2="' + n(p.b.x) + '" y2="' + n(p.b.y) +
        '" stroke="' + color(s.stroke) + '" stroke-width="' + s.strokeWidth +
        '" stroke-linecap="round"' + (s.opacity < 1 ? ' opacity="' + s.opacity + '"' : '') + tf + ' />';
    }
    if (s.type === 'polygon' || s.type === 'star') {
      var verts = s.type === 'polygon' ? S.polygonVertices(s) : S.starVertices(s);
      var pts = verts.map(function (v) { return n(v.x) + ',' + n(v.y); }).join(' ');
      return '<polygon points="' + pts + '"' + common + ' stroke-linejoin="round" />';
    }
    if (s.type === 'text') {
      var fontSize = s.fontSize || 48;
      var lh = s.lineHeight || fontSize * 1.2;
      var lines = String(s.text == null ? '' : s.text).split('\n');
      var tspans = lines.map(function (l, i) {
        return '<tspan x="' + n(s.x) + '" y="' + n(s.y + i * lh) + '">' + esc(l || ' ') + '</tspan>';
      }).join('');
      return '<text x="' + n(s.x) + '" y="' + n(s.y) + '" font-family="' + esc(s.fontFamily || 'sans-serif') +
        '" font-size="' + fontSize + '" font-weight="' + (s.fontWeight || 400) + '"' +
        ' dominant-baseline="hanging" fill="' + color(s.fill) + '"' +
        (s.stroke !== 'none' && s.strokeWidth > 0 ? ' stroke="' + color(s.stroke) + '" stroke-width="' + s.strokeWidth + '"' : '') +
        (s.opacity < 1 ? ' opacity="' + s.opacity + '"' : '') + tf + '>' + tspans + '</text>';
    }
    var rx = s.type === 'roundrect' ? Math.min(s.radius || 0, Math.min(Math.abs(s.w), Math.abs(s.h)) / 2) : 0;
    return '<rect x="' + n(s.x) + '" y="' + n(s.y) + '" width="' + n(s.w) + '" height="' + n(s.h) +
      '"' + (rx > 0 ? ' rx="' + n(rx) + '"' : '') + common + ' />';
  }

  function subpathToD(sp, ox, oy) {
    var pts = sp.points || [];
    if (!pts.length) return '';
    var r = function (v) { return U.round(v, 2); };
    var d = 'M ' + r(ox + pts[0].x) + ' ' + r(oy + pts[0].y);
    var n2 = pts.length;
    var segs = sp.closed ? n2 : n2 - 1;
    for (var i = 0; i < segs; i++) {
      var a = pts[i], b = pts[(i + 1) % n2];
      d += ' C ' + r(ox + a.x + a.out.x) + ' ' + r(oy + a.y + a.out.y) +
        ' ' + r(ox + b.x + b.in.x) + ' ' + r(oy + b.y + b.in.y) +
        ' ' + r(ox + b.x) + ' ' + r(oy + b.y);
    }
    if (sp.closed) d += ' Z';
    return d;
  }

  function pathToD(s) {
    return S.subpathsOf(s).map(function (sp) { return subpathToD(sp, s.x, s.y); }).filter(Boolean).join(' ');
  }

  function buildSVG() {
    var a = App.artboard;
    var body = App.shapes.filter(function (s) { return s.visible; }).map(shapeToSvg).join('\n  ');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + a.w + '" height="' + a.h +
      '" viewBox="0 0 ' + a.w + ' ' + a.h + '">\n' +
      '  <rect x="0" y="0" width="' + a.w + '" height="' + a.h + '" fill="#ffffff"/>\n  ' +
      body + '\n</svg>\n';
  }

  function download(blobOrUrl, filename, isUrl) {
    var a = document.createElement('a');
    a.href = isUrl ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!isUrl) setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function safeName() {
    var input = document.getElementById('docName');
    var nm = input && input.value ? input.value.trim() : 'AstralIon';
    return (nm || 'AstralIon').replace(/[^\w\-]+/g, '_');
  }

  function paintShape(ctx, s) {
    var c = S.center(s);
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.translate(c.x, c.y);
    ctx.rotate(s.rotation);
    ctx.translate(-c.x, -c.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = s.strokeWidth;
    var filled = s.fill && s.fill !== 'none';
    var stroked = s.strokeWidth > 0 && s.stroke && s.stroke !== 'none';

    if (s.type === 'line') {
      var p = S.linePoints(s);
      ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y);
      if (stroked) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
    } else if (s.type === 'text') {
      var fontSize = s.fontSize || 48;
      var lh = s.lineHeight || fontSize * 1.2;
      ctx.font = (s.fontWeight || 400) + ' ' + fontSize + 'px ' + (s.fontFamily || 'sans-serif');
      ctx.textBaseline = 'top';
      String(s.text == null ? '' : s.text).split('\n').forEach(function (l, i) {
        if (filled) { ctx.fillStyle = s.fill; ctx.fillText(l, s.x, s.y + i * lh); }
        if (stroked) { ctx.strokeStyle = s.stroke; ctx.strokeText(l, s.x, s.y + i * lh); }
      });
    } else {
      ctx.beginPath();
      if (s.type === 'ellipse') {
        ctx.ellipse(c.x, c.y, Math.max(Math.abs(s.w) / 2, 0.01), Math.max(Math.abs(s.h) / 2, 0.01), 0, 0, Math.PI * 2);
      } else if (s.type === 'path') {
        S.tracePath(ctx, s);
      } else if (s.type === 'polygon' || s.type === 'star') {
        var verts = s.type === 'polygon' ? S.polygonVertices(s) : S.starVertices(s);
        ctx.moveTo(verts[0].x, verts[0].y);
        for (var i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
      } else if (s.type === 'roundrect') {
        var r = Math.min(s.radius || 0, Math.min(Math.abs(s.w), Math.abs(s.h)) / 2);
        if (r > 0) {
          var x = s.x, y = s.y, w = s.w, h = s.h;
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        } else ctx.rect(s.x, s.y, s.w, s.h);
      } else {
        ctx.rect(s.x, s.y, s.w, s.h);
      }
      if (filled) { ctx.fillStyle = s.fill; ctx.fill(s.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'); }
      if (stroked) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
    }
    ctx.restore();
  }

  var Exporter = {
    buildSVG: buildSVG,

    svg: function () {
      var blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
      download(blob, safeName() + '.svg');
    },

    png: function (scale) {
      scale = scale || 2;
      var a = App.artboard;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(a.w * scale);
      canvas.height = Math.round(a.h * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-a.x, -a.y);
      App.shapes.forEach(function (s) { if (s.visible) paintShape(ctx, s); });
      ctx.restore();
      canvas.toBlob(function (blob) { download(blob, safeName() + '.png'); });
    }
  };

  Exporter.exportSVG = Exporter.svg;
  Exporter.exportPNG = Exporter.png;

  global.Exporter = Exporter;
})(window);

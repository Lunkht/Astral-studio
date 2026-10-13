(function (global) {
  'use strict';

  var G = global.Geom;
  var U = global.Utils;
  var Entities = global.Entities;
  var Drawing = global.Drawing;
  var App = global.App;

  function download(filename, href) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    if (document.body && document.body.appendChild) document.body.appendChild(a);
    if (a.click) a.click();
    if (document.body && document.body.removeChild) document.body.removeChild(a);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function colorOf(e) {
    var c = e.color || (Drawing.layerOf(App.drawing, e) || {}).color || '#e8e8e8';
    return c;
  }

  var Export = {
    /* ---- SVG ---- */
    svg: function (d) {
      var draw = d || App.drawing;
      var b = Drawing.bounds(draw);
      var pad = Math.max(10, (b.max.x - b.min.x) * 0.02);
      var w = (b.max.x - b.min.x) + pad * 2;
      var h = (b.max.y - b.min.y) + pad * 2;
      function sx(x) { return U.round(x - b.min.x + pad, 3); }
      function sy(y) { return U.round(b.max.y - y + pad, 3); }
      function pt(p) { return sx(p.x) + ',' + sy(p.y); }

      var out = [];
      out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + U.round(w, 2) + '" height="' + U.round(h, 2) + '" viewBox="0 0 ' + U.round(w, 2) + ' ' + U.round(h, 2) + '">');
      out.push('<rect width="100%" height="100%" fill="#141414"/>');

      var list = Drawing.visibleEntities(draw);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var color = colorOf(e);
        var stroke = ' stroke="' + color + '" fill="none" stroke-width="' + (e.lineweight || 1.4) + '"';
        switch (e.type) {
          case 'line':
            out.push('<line x1="' + sx(e.p1.x) + '" y1="' + sy(e.p1.y) + '" x2="' + sx(e.p2.x) + '" y2="' + sy(e.p2.y) + '"' + stroke + '/>');
            break;
          case 'polyline':
            out.push('<' + (e.closed ? 'polygon' : 'polyline') + ' points="' + e.points.map(pt).join(' ') + '"' + stroke + '/>');
            break;
          case 'rectangle': {
            var rp = Entities.rectPoints(e);
            out.push('<polygon points="' + rp.map(pt).join(' ') + '"' + stroke + '/>');
            break;
          }
          case 'circle':
            out.push('<circle cx="' + sx(e.center.x) + '" cy="' + sy(e.center.y) + '" r="' + U.round(e.radius, 3) + '"' + stroke + '/>');
            break;
          case 'arc':
            out.push('<polyline points="' + Entities.points(e).map(pt).join(' ') + '"' + stroke + '/>');
            break;
          case 'hatch': {
            out.push('<polygon points="' + e.boundary.map(pt).join(' ') + '"' + stroke + '/>');
            var hs = Entities.hatchSegments(e);
            for (var k = 0; k < hs.length; k++) {
              out.push('<line x1="' + sx(hs[k][0].x) + '" y1="' + sy(hs[k][0].y) + '" x2="' + sx(hs[k][1].x) + '" y2="' + sy(hs[k][1].y) + '" stroke="' + color + '" stroke-width="0.7"/>');
            }
            break;
          }
          case 'text':
            out.push('<text x="' + sx(e.position.x) + '" y="' + sy(e.position.y) + '" fill="' + color + '" font-size="' + e.height + '" transform="rotate(' + (-U.rad2deg(e.rotation || 0)) + ' ' + sx(e.position.x) + ' ' + sy(e.position.y) + ')">' + esc(e.text) + '</text>');
            break;
          case 'dimension': {
            var segs = Entities.segments(e);
            for (var s = 0; s < segs.length; s++) {
              out.push('<line x1="' + sx(segs[s][0].x) + '" y1="' + sy(segs[s][0].y) + '" x2="' + sx(segs[s][1].x) + '" y2="' + sy(segs[s][1].y) + '"' + stroke + '/>');
            }
            var o = Entities.dimOffsetPoints(e);
            var mid = G.mid(o.a, o.b);
            out.push('<text x="' + sx(mid.x) + '" y="' + sy(mid.y) + '" fill="' + color + '" font-size="12" text-anchor="middle">' + esc(U.fmt(G.dist(e.p1, e.p2)) + ' ' + (draw.units || '')) + '</text>');
            break;
          }
        }
      }
      out.push('</svg>');
      return out.join('\n') + '\n';
    },

    /* ---- DXF ---- */
    dxf: function (d) {
      var draw = d || App.drawing;
      var out = [];
      function g(code, value) { out.push(String(code)); out.push(String(value)); }
      g(0, 'SECTION'); g(2, 'ENTITIES');
      var list = Drawing.visibleEntities(draw);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var layer = e.layer || '0';
        if (e.type === 'line') {
          g(0, 'LINE'); g(8, layer);
          g(10, U.round(e.p1.x, 6)); g(20, U.round(e.p1.y, 6)); g(30, 0);
          g(11, U.round(e.p2.x, 6)); g(21, U.round(e.p2.y, 6)); g(31, 0);
        } else if (e.type === 'circle') {
          g(0, 'CIRCLE'); g(8, layer);
          g(10, U.round(e.center.x, 6)); g(20, U.round(e.center.y, 6)); g(30, 0);
          g(40, U.round(e.radius, 6));
        } else if (e.type === 'arc') {
          var sweep = Entities.arcSweep(e);
          var a0 = U.normAngle(e.startAngle);
          var a1 = U.normAngle(e.startAngle + sweep);
          g(0, 'ARC'); g(8, layer);
          g(10, U.round(e.center.x, 6)); g(20, U.round(e.center.y, 6)); g(30, 0);
          g(40, U.round(e.radius, 6));
          g(50, U.round(U.rad2deg(a0), 6)); g(51, U.round(U.rad2deg(a1), 6));
        } else if (e.type === 'text') {
          g(0, 'TEXT'); g(8, layer);
          g(10, U.round(e.position.x, 6)); g(20, U.round(e.position.y, 6)); g(30, 0);
          g(40, e.height || 12);
          g(1, e.text);
          g(50, U.round(U.rad2deg(e.rotation || 0), 6));
        } else {
          var pts = e.type === 'rectangle' ? Entities.rectPoints(e)
            : e.type === 'hatch' ? e.boundary
              : Entities.points(e);
          var closed = e.type === 'rectangle' || e.type === 'hatch' || (e.type === 'polyline' && e.closed);
          if (e.type === 'polyline' && !e.closed) closed = false;
          if (e.type === 'arc') closed = false;
          g(0, 'LWPOLYLINE'); g(8, layer);
          g(90, pts.length); g(70, closed ? 1 : 0);
          for (var v = 0; v < pts.length; v++) {
            g(10, U.round(pts[v].x, 6)); g(20, U.round(pts[v].y, 6));
          }
        }
      }
      g(0, 'ENDSEC'); g(0, 'EOF');
      return out.join('\n') + '\n';
    },

    json: function (d) {
      return Drawing.serialize(d || App.drawing);
    },

    /* ---- downloads ---- */
    _save: function (filename, text, type) {
      var blob = new Blob([text], { type: type || 'text/plain' });
      download(filename, URL.createObjectURL(blob));
    },

    saveSvg: function () { this._save((App.drawing.name || 'AstralHouse') + '.svg', this.svg(), 'image/svg+xml'); },
    saveDxf: function () { this._save((App.drawing.name || 'AstralHouse') + '.dxf', this.dxf(), 'application/dxf'); },
    saveJson: function () { this._save((App.drawing.name || 'AstralHouse') + '.json', this.json(), 'application/json'); },

    png: function () {
      if (!global.Renderer || !global.Renderer.canvas || !global.Renderer.canvas.toDataURL) return;
      download((App.drawing.name || 'AstralHouse') + '.png', global.Renderer.canvas.toDataURL('image/png'));
    },

    loadJson: function (text) {
      var d = Drawing.deserialize(text);
      App.drawing = d;
      App.selection = {};
      App.pending = [];
      App.commit();
      App.emit('scene');
      App.emit('layers');
      App.emit('change');
      return d;
    }
  };

  global.Export = Export;
})(window);

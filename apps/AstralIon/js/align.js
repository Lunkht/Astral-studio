(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;

  function boundsOfPoints(list) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    list.forEach(function (p) {
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    });
    if (!isFinite(minx)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }

  function signedArea(points) {
    var a = 0;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      a += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    return a / 2;
  }

  function orient(points, wantPositive) {
    if ((signedArea(points) >= 0) === wantPositive) return points;
    return points.slice().reverse();
  }

  function shift(shape, dx, dy) { shape.x += dx; shape.y += dy; }

  function alignOne(s, box, axis, mode) {
    var b = S.aabb(s);
    var dx = 0, dy = 0;
    if (axis === 'h') {
      if (mode === 'min') dx = box.x - b.x;
      else if (mode === 'center') dx = (box.x + box.w / 2) - (b.x + b.w / 2);
      else if (mode === 'max') dx = (box.x + box.w) - (b.x + b.w);
    } else {
      if (mode === 'min') dy = box.y - b.y;
      else if (mode === 'center') dy = (box.y + box.h / 2) - (b.y + b.h / 2);
      else if (mode === 'max') dy = (box.y + box.h) - (b.y + b.h);
    }
    shift(s, dx, dy);
  }

  var Align = {
    align: function (axis, mode, toArtboard) {
      var App = global.App;
      var sel = App.selected();
      if (!sel.length) return;
      var box = (sel.length > 1 && !toArtboard) ? S.unionAabb(sel) : App.artboard;
      App.beginChange();
      sel.forEach(function (s) { alignOne(s, box, axis, mode); });
      App.endChange();
      App.emit('selection');
    },

    distribute: function (axis) {
      var App = global.App;
      var sel = App.selected();
      if (sel.length < 3) return;
      var key = axis === 'h' ? 'x' : 'y';
      var sizeKey = axis === 'h' ? 'w' : 'h';
      var arr = sel.map(function (s) {
        var b = S.aabb(s);
        return { s: s, c: b[key] + b[sizeKey] / 2 };
      }).sort(function (a, b) { return a.c - b.c; });

      App.beginChange();
      var first = arr[0].c, last = arr[arr.length - 1].c;
      var step = (last - first) / (arr.length - 1);
      for (var i = 1; i < arr.length - 1; i++) {
        var target = first + step * i;
        var d = target - arr[i].c;
        if (axis === 'h') shift(arr[i].s, d, 0); else shift(arr[i].s, 0, d);
      }
      App.endChange();
      App.emit('selection');
    },

    pathfinder: function (op) {
      var App = global.App;
      var Tools = global.Tools;
      var sel = App.selected();
      if (sel.length < 2) return;

      var anchorLists = sel.map(function (s) { return Tools.shapeToAnchorPoints(s); });
      var all = [];
      anchorLists.forEach(function (a) { all = all.concat(a); });
      var b = boundsOfPoints(all);

      var subpaths = anchorLists.map(function (a) {
        var pts = a.map(function (p) {
          return { x: p.x - b.x, y: p.y - b.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } };
        });
        return { points: orient(pts, true), closed: true };
      });

      var first = sel[0];
      var shape = S.create('path');
      shape.x = b.x; shape.y = b.y; shape.w = b.w; shape.h = b.h;
      shape.subpaths = subpaths;
      shape.points = subpaths[0].points;
      shape.closed = true;
      shape.fillRule = op === 'exclude' ? 'evenodd' : 'nonzero';
      shape.fill = first.fill;
      shape.stroke = first.stroke;
      shape.strokeWidth = first.strokeWidth;
      shape.opacity = first.opacity;

      App.beginChange();
      var ids = App.selectionIds();
      App.shapes = App.shapes.filter(function (s) { return ids.indexOf(s.id) < 0; });
      App.shapes.push(shape);
      App.selection = {};
      App.selection[shape.id] = true;
      App.endChange();
      App.emit('selection');
    }
  };

  global.Align = Align;
})(window);

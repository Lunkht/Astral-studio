(function (global) {
  'use strict';

  var S = global.Shapes;

  function applyStyle(s, style) {
    if (!style) return s;
    if (style.fill !== undefined) s.fill = style.fill;
    if (style.stroke !== undefined) s.stroke = style.stroke;
    if (style.strokeWidth !== undefined) s.strokeWidth = style.strokeWidth;
    if (style.opacity !== undefined) s.opacity = style.opacity;
    return s;
  }

  function fromDrag(type, ax, ay, bx, by, style) {
    var x = Math.min(ax, bx), y = Math.min(ay, by);
    var w = Math.abs(bx - ax), h = Math.abs(by - ay);
    var s = S.create(type, { x: x, y: y, w: w, h: h, name: type === 'ellipse' ? 'Ellipse' : 'Rectangle' });
    return applyStyle(s, style);
  }

  function line(ax, ay, bx, by, style) {
    var s = S.create('line', { x: ax, y: ay, w: bx - ax, h: by - ay, name: 'Ligne' });
    applyStyle(s, style);
    s.fill = 'none';
    return s;
  }

  function pencil(points, style) {
    var s = S.create('pencil', { points: points.slice(), closed: false, name: 'Tracé' });
    applyStyle(s, style);
    s.fill = 'none';
    return s;
  }

  function text(x, y, str, style) {
    var size = (style && style.fontSize) || 48;
    var s = S.create('text', {
      x: x, y: y,
      w: Math.max(1, str.length * size * 0.6),
      h: size * 1.2,
      text: str,
      fontSize: size,
      name: 'Texte'
    });
    s.stroke = 'none';
    s.strokeWidth = 0;
    return applyStyle(s, style);
  }

  global.Tools = {
    applyStyle: applyStyle,
    fromDrag: fromDrag,
    line: line,
    pencil: pencil,
    text: text
  };
})(window);

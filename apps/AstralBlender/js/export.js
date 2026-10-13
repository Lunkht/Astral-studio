(function (global) {
  'use strict';

  var V = global.Vec3;
  var M = global.Mat4;
  var App = global.App;
  var Renderer = global.Renderer;

  function download(filename, href) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    if (document.body && document.body.appendChild) document.body.appendChild(a);
    if (a.click) a.click();
    if (document.body && document.body.removeChild) document.body.removeChild(a);
  }

  function round2(v) { return Math.round(v * 1000) / 1000; }

  function objString() {
    var lines = ['# AstralBlender export', '# ' + App.scene.objects.length + ' objet(s)'];
    var offset = 1;
    for (var i = 0; i < App.scene.objects.length; i++) {
      var obj = App.scene.objects[i];
      if (!obj.visible) continue;
      lines.push('o ' + obj.name);
      var model = M.compose(obj.position, obj.rotation, obj.scale);
      for (var v = 0; v < obj.mesh.vertices.length; v++) {
        var p = M.transformPoint(model, obj.mesh.vertices[v]);
        lines.push('v ' + round2(p.x) + ' ' + round2(p.y) + ' ' + round2(p.z));
      }
      for (var f = 0; f < obj.mesh.faces.length; f++) {
        var face = obj.mesh.faces[f].map(function (idx) { return idx + offset; });
        lines.push('f ' + face.join(' '));
      }
      offset += obj.mesh.vertices.length;
    }
    return lines.join('\n') + '\n';
  }

  var Export = {
    objString: objString,

    png: function () {
      if (!Renderer.canvas || !Renderer.canvas.toDataURL) return;
      download('AstralBlender.png', Renderer.canvas.toDataURL('image/png'));
    },

    obj: function () {
      var blob = new Blob([objString()], { type: 'text/plain' });
      download('AstralBlender.obj', URL.createObjectURL(blob));
    }
  };

  global.Export = Export;
})(window);

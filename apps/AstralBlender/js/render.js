(function (global) {
  'use strict';

  var V = global.Vec3;
  var M = global.Mat4;
  var App = global.App;

  var LIGHT = V.normalize(V.v(0.5, 0.85, 0.6));
  var AMBIENT = 0.24;

  function hexToRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shade(hex, intensity) {
    var c = hexToRgb(hex);
    var k = Math.max(0, Math.min(1.2, intensity));
    return 'rgb(' + Math.round(c.r * k) + ',' + Math.round(c.g * k) + ',' + Math.round(c.b * k) + ')';
  }

  var Renderer = {
    canvas: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,
    picks: [],
    _view: null,
    _proj: null,
    _mvp: null,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
    },

    resize: function () {
      if (!this.canvas) return;
      var parent = this.canvas.parentElement;
      var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
      var w = Math.max(1, Math.round((rect && rect.width) || this.canvas.clientWidth || 800));
      var h = Math.max(1, Math.round((rect && rect.height) || this.canvas.clientHeight || 600));
      this.dpr = global.devicePixelRatio || 1;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.w = w;
      this.h = h;
      this.draw();
    },

    project: function (mvp, p) {
      var c = M.transformPoint(mvp, p);
      if (c.w <= 0.0001) return null;
      return {
        x: (c.x / c.w * 0.5 + 0.5) * this.w,
        y: (1 - (c.y / c.w * 0.5 + 0.5)) * this.h
      };
    },

    draw: function () {
      if (!this.ctx || !App.scene) return;
      var ctx = this.ctx;
      var cam = App.camera;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#202020';
      ctx.fillRect(0, 0, this.w, this.h);

      var eye = App.eye();
      var view = M.lookAt(eye, cam.target, V.v(0, 1, 0));
      var proj = M.perspective(cam.fov, this.w / this.h, cam.near, cam.far);
      this._view = view;
      this._proj = proj;

      if (App.showGrid) this.drawGrid(view, proj);
      if (App.showAxes) this.drawAxes(view, proj);

      var faces = [];
      this.picks = [];

      for (var i = 0; i < App.scene.objects.length; i++) {
        var obj = App.scene.objects[i];
        if (!obj.visible) continue;
        var model = M.compose(obj.position, obj.rotation, obj.scale);
        var viewModel = M.multiply(view, model);
        var mvp = M.multiply(proj, viewModel);
        this.collectObject(obj, viewModel, mvp, faces);
      }

      faces.sort(function (a, b) { return a.depth - b.depth; });
      ctx.lineJoin = 'round';
      for (var f = 0; f < faces.length; f++) {
        var face = faces[f];
        if (App.shading !== 'wireframe') {
          ctx.beginPath();
          ctx.moveTo(face.pts[0].x, face.pts[0].y);
          for (var k = 1; k < face.pts.length; k++) ctx.lineTo(face.pts[k].x, face.pts[k].y);
          ctx.closePath();
          ctx.fillStyle = face.color;
          ctx.fill();
        }
      }

      this.drawEdges(view, proj);

      for (var s = 0; s < App.scene.objects.length; s++) {
        if (App.selection[App.scene.objects[s].id]) this.highlight(App.scene.objects[s], view, proj);
      }
    },

    /* ---- grid & axes ---- */
    drawLine3D: function (view, proj, a, b, color, width) {
      var mvp = M.multiply(proj, view);
      var pa = this.project(mvp, a), pb = this.project(mvp, b);
      if (!pa || !pb) return;
      var ctx = this.ctx;
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    },

    drawGrid: function (view, proj) {
      var n = 10;
      for (var i = -n; i <= n; i++) {
        var c = i === 0 ? '#3d3d3d' : '#2d2d2d';
        this.drawLine3D(view, proj, V.v(i, 0, -n), V.v(i, 0, n), c, 1);
        this.drawLine3D(view, proj, V.v(-n, 0, i), V.v(n, 0, i), c, 1);
      }
    },

    drawAxes: function (view, proj) {
      this.drawLine3D(view, proj, V.v(0, 0, 0), V.v(2, 0, 0), '#b06a6a', 2);
      this.drawLine3D(view, proj, V.v(0, 0, 0), V.v(0, 2, 0), '#6ab06a', 2);
      this.drawLine3D(view, proj, V.v(0, 0, 0), V.v(0, 0, 2), '#6a6ab0', 2);
    },

    /* ---- per-object face gathering ---- */
    collectObject: function (obj, viewModel, mvp, faces) {
      var mesh = obj.mesh;
      var n = mesh.vertices.length;
      var cam = new Array(n);
      var scr = new Array(n);
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var sumZ = 0, count = 0;

      for (var i = 0; i < n; i++) {
        cam[i] = M.transformPoint(viewModel, mesh.vertices[i]);
        var s = this.project(mvp, mesh.vertices[i]);
        scr[i] = s;
        if (s) {
          minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
          maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y);
          sumZ += cam[i].z;
          count++;
        }
      }
      if (count < 3 || minX === Infinity) return;
      this.picks.push({ id: obj.id, minX: minX, minY: minY, maxX: maxX, maxY: maxY, depth: sumZ / count });

      for (var f = 0; f < mesh.faces.length; f++) {
        var face = mesh.faces[f];
        var pts = new Array(face.length);
        var ok = true, cz = 0;
        for (var p = 0; p < face.length; p++) {
          var sp = scr[face[p]];
          if (!sp) { ok = false; break; }
          pts[p] = sp;
          cz += cam[face[p]].z;
        }
        if (!ok) continue;
        cz /= face.length;
        var normal = V.normalize(V.cross(
          V.sub(cam[face[1]], cam[face[0]]),
          V.sub(cam[face[2]], cam[face[0]])
        ));
        var centroid = V.scale(V.add(V.add(cam[face[0]], cam[face[1]]), cam[face[2]]), 1 / 3);
        var toCam = V.normalize(V.scale(centroid, -1));
        if (V.dot(normal, toCam) < 0) normal = V.scale(normal, -1);
        var intensity = AMBIENT + (1 - AMBIENT) * Math.max(0, V.dot(normal, LIGHT));
        faces.push({ pts: pts, depth: cz, color: shade(obj.color, intensity) });
      }
    },

    drawEdges: function (view, proj) {
      if (!App.showEdges && App.shading !== 'wireframe') return;
      var ctx = this.ctx;
      ctx.strokeStyle = App.shading === 'wireframe' ? '#c8c8c8' : 'rgba(20,20,20,0.55)';
      ctx.lineWidth = 1;
      for (var i = 0; i < App.scene.objects.length; i++) {
        var obj = App.scene.objects[i];
        if (!obj.visible) continue;
        var model = M.compose(obj.position, obj.rotation, obj.scale);
        var mvp = M.multiply(M.multiply(proj, view), model);
        var edges = obj.mesh.edges;
        ctx.beginPath();
        for (var e = 0; e < edges.length; e++) {
          var a = this.project(mvp, obj.mesh.vertices[edges[e][0]]);
          var b = this.project(mvp, obj.mesh.vertices[edges[e][1]]);
          if (!a || !b) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    },

    highlight: function (obj, view, proj) {
      var ctx = this.ctx;
      var model = M.compose(obj.position, obj.rotation, obj.scale);
      var mvp = M.multiply(M.multiply(proj, view), model);
      ctx.strokeStyle = '#e0b060';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var e = 0; e < obj.mesh.edges.length; e++) {
        var a = this.project(mvp, obj.mesh.vertices[obj.mesh.edges[e][0]]);
        var b = this.project(mvp, obj.mesh.vertices[obj.mesh.edges[e][1]]);
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    },

    pick: function (sx, sy) {
      var best = null;
      for (var i = 0; i < this.picks.length; i++) {
        var p = this.picks[i];
        if (sx >= p.minX && sx <= p.maxX && sy >= p.minY && sy <= p.maxY) {
          if (!best || p.depth > best.depth) best = p;
        }
      }
      return best ? best.id : null;
    }
  };

  global.Renderer = Renderer;
})(window);

(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.Shapes;
  var App = global.App;
  var Tools = global.Tools;

  var HANDLE_HIT = 9; // screen px

  var Interaction = {
    canvas: null,
    marquee: null,
    drag: null,
    pencil: null,

    init: function (canvas) {
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('pointerdown', function (e) { self.onPointerDown(e); });
      window.addEventListener('pointermove', function (e) { self.onPointerMove(e); });
      window.addEventListener('pointerup', function (e) { self.onPointerUp(e); });
      canvas.addEventListener('wheel', function (e) { self.onWheel(e); }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('keydown', function (e) { self.onKeyDown(e); });
      window.addEventListener('keyup', function (e) { self.onKeyUp(e); });
    },

    eventToCanvas: function (e) {
      var rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    eventToWorld: function (e) {
      var p = this.eventToCanvas(e);
      return App.screenToWorld(p.x, p.y);
    },

    /* ================= pointer down ================= */
    onPointerDown: function (e) {
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
      if (App.textEdit) { this.finishTextEdit(); return; }
      var sp = this.eventToCanvas(e);
      var wp = App.screenToWorld(sp.x, sp.y);
      var mods = { shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey };

      if (e.button === 1 || App.tool === 'hand' || App.spaceDown) {
        this.drag = { mode: 'pan', lastX: sp.x, lastY: sp.y };
        document.body.classList.add('dragging');
        return;
      }
      if (App.tool === 'zoom') {
        var factor = (mods.alt || e.button === 2) ? 1 / 1.4 : 1.4;
        App.zoomAt(sp.x, sp.y, factor);
        return;
      }

      switch (App.tool) {
        case 'select': this.startSelect(sp, wp, mods, e); return;
        case 'direct': this.startDirect(sp, wp, mods); return;
        case 'pen': this.penDown(wp, sp); return;
        case 'addAnchor': this.addAnchor(wp); return;
        case 'delAnchor': this.removeAnchor(wp); return;
        case 'pencil': this.startPencil(wp); return;
        case 'text': this.startText(sp, wp); return;
        case 'eyedropper': this.pick(wp, mods); return;
        default: this.startCreate(wp, mods); return;
      }
    },

    startSelect: function (sp, wp, mods, e) {
      var sel = App.selected();

      if (sel.length === 1) {
        var h = S.handlePositions(sel[0], App.camera.zoom);
        if (dist2(h.rot, sp) <= (HANDLE_HIT + 3) * (HANDLE_HIT + 3)) {
          var c = S.center(sel[0]);
          this.drag = {
            mode: 'rotate', target: sel[0], original: U.deepClone(sel[0]),
            center: c, startAngle: Math.atan2(wp.y - c.y, wp.x - c.x)
          };
          this.drag.original.rotation0 = sel[0].rotation;
          App.beginChange();
          return;
        }
        for (var i = 0; i < S.HANDLE_KEYS.length; i++) {
          var k = S.HANDLE_KEYS[i];
          var hp = App.worldToScreen(h[k].x, h[k].y);
          if (dist2(hp, sp) <= HANDLE_HIT * HANDLE_HIT) {
            this.drag = { mode: 'resize', handle: k, target: sel[0], original: U.deepClone(sel[0]) };
            App.beginChange();
            return;
          }
        }
      }

      var tol = 4 / App.camera.zoom;
      var hit = App.topmostAt(wp.x, wp.y, tol);
      if (hit) {
        if (mods.shift) App.toggleSelect(hit.id);
        else if (!App.selection[hit.id]) App.select([hit.id]);
        if (App.hasSelection()) {
          this.drag = {
            mode: 'move', start: wp,
            originals: App.selected().map(function (s) { return { id: s.id, x: s.x, y: s.y }; })
          };
          App.beginChange();
        }
        return;
      }

      if (!mods.shift) App.clearSelection();
      this.marquee = { x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y, additive: mods.shift, base: Object.assign({}, App.selection) };
      this.drag = { mode: 'marquee' };
    },

    /* ================= direct selection ================= */
    startDirect: function (sp, wp, mods) {
      var sel = App.selected();

      for (var si = 0; si < sel.length; si++) {
        var s = sel[si];
        if (s.type !== 'path') continue;
        var refs = S.anchorRefs(s);

        for (var r = 0; r < refs.length; r++) {
          var ref = refs[r];
          var aw = S.anchorWorld(s, ref.sub, ref.i);
          var asp = App.worldToScreen(aw.x, aw.y);
          if (dist2(asp, sp) <= HANDLE_HIT * HANDLE_HIT) {
            App.edit = { shapeId: s.id, anchors: {} };
            App.edit.anchors[ref.sub + ':' + ref.i] = true;
            this.drag = {
              mode: 'anchorDrag', target: s, sub: ref.sub, index: ref.i, start: wp,
              original: U.deepClone(S.subpathPoints(s, ref.sub)[ref.i])
            };
            App.beginChange();
            App.emit('change');
            return;
          }
        }
        for (var r2 = 0; r2 < refs.length; r2++) {
          var ref2 = refs[r2];
          var pt = S.subpathPoints(s, ref2.sub)[ref2.i];
          var keys = ['in', 'out'];
          for (var w = 0; w < 2; w++) {
            var key = keys[w];
            var hh = pt[key];
            if (Math.abs(hh.x) < 0.001 && Math.abs(hh.y) < 0.001) continue;
            var hw = S.handleWorld(s, ref2.sub, ref2.i, key);
            var hsp = App.worldToScreen(hw.x, hw.y);
            if (dist2(hsp, sp) <= HANDLE_HIT * HANDLE_HIT) {
              App.edit = { shapeId: s.id, anchors: {} };
              App.edit.anchors[ref2.sub + ':' + ref2.i] = true;
              this.drag = {
                mode: 'handleDrag', target: s, sub: ref2.sub, index: ref2.i, which: key,
                original: U.deepClone(pt)
              };
              App.beginChange();
              App.emit('change');
              return;
            }
          }
        }
      }

      var tol = 4 / App.camera.zoom;
      var hit = App.topmostAt(wp.x, wp.y, tol);
      if (hit) {
        App.select([hit.id]);
        App.edit = hit.type === 'path' ? { shapeId: hit.id, anchors: {} } : null;
        return;
      }
      App.clearSelection();
      App.edit = null;
      App.emit('change');
    },

    /* ================= pencil ================= */
    startPencil: function (wp) {
      this.pencil = { points: [{ x: wp.x, y: wp.y }] };
      this.drag = { mode: 'pencil' };
      App.emit('change');
    },

    /* ================= text ================= */
    startText: function (sp, wp) {
      var existing = App.topmostAt(wp.x, wp.y, 4 / App.camera.zoom);
      if (existing && existing.type === 'text') {
        App.select([existing.id]);
        App.textEdit = { shapeId: existing.id };
        App.beginChange();
        App.emit('change'); App.emit('selection');
        return;
      }
      var s = S.create('text', { text: '' });
      s.x = wp.x; s.y = wp.y;
      App.applyStyle(s);
      s.stroke = 'none';
      s.strokeWidth = 0;
      Tools.syncTextBounds(s);
      App.beginChange();
      App.shapes.push(s);
      App.selection = {}; App.selection[s.id] = true;
      App.textEdit = { shapeId: s.id };
      App.emit('change'); App.emit('selection');
    },

    finishTextEdit: function () {
      var te = App.textEdit;
      if (!te) return;
      var s = App.shapeById(te.shapeId);
      App.textEdit = null;
      if (s) {
        if (!s.text || !s.text.trim()) {
          App.shapes = App.shapes.filter(function (x) { return x.id !== s.id; });
          delete App.selection[s.id];
        } else {
          Tools.syncTextBounds(s);
        }
      }
      App.endChange();
      App.emit('change'); App.emit('selection');
    },

    /* ================= eyedropper ================= */
    pick: function (wp, mods) {
      var hit = App.topmostAt(wp.x, wp.y, 6 / App.camera.zoom);
      if (!hit) return;
      App.setStyle({ fill: hit.fill, stroke: hit.stroke, strokeWidth: hit.strokeWidth, opacity: hit.opacity });
      if (App.hasSelection()) {
        App.beginChange();
        App.selected().forEach(function (s) {
          s.fill = hit.fill; s.stroke = hit.stroke; s.strokeWidth = hit.strokeWidth; s.opacity = hit.opacity;
        });
        App.endChange();
      }
      App.emit('selection');
    },

    /* ================= anchors add/remove ================= */
    addAnchor: function (wp) {
      var sel = App.selected();
      if (!sel.length) return;
      var s = sel[0];
      if (s.type !== 'path') return;
      var near = nearestSegment(s, wp);
      if (!near || near.dist > 8 / App.camera.zoom) return;
      var arr = S.subpathPoints(s, near.sub);
      if (!arr) return;

      App.beginChange();
      var n = arr.length;
      var i = near.index;
      var j = (i + 1) % n;
      var a = arr[i], b = arr[j];
      var p0 = { x: a.x, y: a.y };
      var p1 = { x: a.x + a.out.x, y: a.y + a.out.y };
      var p2 = { x: b.x + b.in.x, y: b.y + b.in.y };
      var p3 = { x: b.x, y: b.y };
      var t = near.t;
      var q0 = lerp(p0, p1, t), q1 = lerp(p1, p2, t), q2 = lerp(p2, p3, t);
      var r0 = lerp(q0, q1, t), r1 = lerp(q1, q2, t);
      var mid = lerp(r0, r1, t);
      a.out = { x: q0.x - a.x, y: q0.y - a.y };
      b.in = { x: q2.x - b.x, y: q2.y - b.y };
      var np = { x: mid.x, y: mid.y, in: { x: r0.x - mid.x, y: r0.y - mid.y }, out: { x: r1.x - mid.x, y: r1.y - mid.y } };
      arr.splice(i + 1, 0, np);
      App.edit = { shapeId: s.id, anchors: {} };
      App.edit.anchors[near.sub + ':' + (i + 1)] = true;
      App.endChange();
      App.emit('change'); App.emit('selection');
    },

    removeAnchor: function (wp) {
      var sel = App.selected();
      if (!sel.length) return;
      var s = sel[0];
      if (s.type !== 'path') return;
      var refs = S.anchorRefs(s);
      var best = null, bestD = HANDLE_HIT * HANDLE_HIT;
      var spNow = App.worldToScreen(wp.x, wp.y);
      refs.forEach(function (ref) {
        var aw = S.anchorWorld(s, ref.sub, ref.i);
        var sp = App.worldToScreen(aw.x, aw.y);
        var screenD = dist2(sp, spNow);
        if (screenD <= bestD) { bestD = screenD; best = ref; }
      });
      if (!best) return;
      var arr = S.subpathPoints(s, best.sub);
      var min = S.subpathClosed(s, best.sub) ? 3 : 2;
      if (!arr || arr.length <= min) return;
      App.beginChange();
      arr.splice(best.i, 1);
      App.edit = { shapeId: s.id, anchors: {} };
      App.endChange();
      App.emit('change'); App.emit('selection');
    },

    /* ================= shape creation ================= */
    startCreate: function (wp, mods) {
      this.drag = { mode: 'create', type: App.tool, start: wp, mods: mods };
      App.preview = null;
    },

    /* ================= pen tool ================= */
    penDown: function (wp, sp) {
      var pen = App.pen;
      if (!pen) {
        App.pen = {
          points: [this.newPenPoint(wp)], dragging: true, activeIndex: 0,
          closed: false, hover: { x: wp.x, y: wp.y }
        };
        this.drag = { mode: 'pen' };
        App.emit('change');
        return;
      }
      var first = pen.points[0];
      var firstScreen = App.worldToScreen(first.x, first.y);
      if (pen.points.length >= 2 && dist2(firstScreen, sp) <= 121) {
        this.finishPen(true);
        return;
      }
      pen.points.push(this.newPenPoint(wp));
      pen.dragging = true;
      pen.activeIndex = pen.points.length - 1;
      pen.hover = { x: wp.x, y: wp.y };
      this.drag = { mode: 'pen' };
      App.emit('change');
    },

    newPenPoint: function (wp) {
      return { x: wp.x, y: wp.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } };
    },

    penDrag: function (wp) {
      var pen = App.pen;
      if (!pen || !pen.dragging) return;
      var p = pen.points[pen.activeIndex];
      if (!p) return;
      p.out.x = wp.x - p.x; p.out.y = wp.y - p.y;
      p.in.x = -p.out.x; p.in.y = -p.out.y;
      App.emit('change');
    },

    finishPen: function (closed) {
      var pen = App.pen;
      App.pen = null;
      if (pen && pen.points.length >= 2) {
        var shape = Tools.buildPathShape(pen.points, !!closed);
        if (closed) App.applyStyle(shape);
        else { shape.fill = 'none'; shape.stroke = App.style.stroke; shape.strokeWidth = App.style.strokeWidth; shape.opacity = App.style.opacity; }
        App.beginChange();
        App.shapes.push(shape);
        App.selection = {}; App.selection[shape.id] = true;
        App.endChange();
        App.emit('selection');
      } else {
        App.emit('change');
      }
    },

    /* ================= pointer move ================= */
    onPointerMove: function (e) {
      var sp = this.eventToCanvas(e);
      var wp = App.screenToWorld(sp.x, sp.y);
      global.UI && UI.setCoords && UI.setCoords(wp);

      var m = { shift: e.shiftKey, alt: e.altKey };
      var d = this.drag;

      if (App.tool === 'pen' && App.pen) {
        App.pen.hover = wp;
        if (App.pen.dragging) this.penDrag(wp);
        else App.emit('change');
      }

      if (d) {
        if (d.mode === 'pen') return;
        if (d.mode === 'pan') {
          App.camera.pan.x += sp.x - d.lastX;
          App.camera.pan.y += sp.y - d.lastY;
          d.lastX = sp.x; d.lastY = sp.y;
          App.emit('view');
          return;
        }
        if (d.mode === 'move') {
          var dx = wp.x - d.start.x, dy = wp.y - d.start.y;
          if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
          d.originals.forEach(function (o) {
            var s = App.shapeById(o.id);
            if (s) { s.x = o.x + dx; s.y = o.y + dy; }
          });
          App.emit('change');
          return;
        }
        if (d.mode === 'resize') {
          var live = App.shapeById(d.target.id);
          var snap = U.deepClone(d.original);
          Tools.resizeShape(snap, d.handle, wp, e.shiftKey ? { shift: true } : {});
          live.x = snap.x; live.y = snap.y; live.w = snap.w; live.h = snap.h;
          if (snap.type === 'path') live.points = snap.points;
          if (snap.type === 'text') live.fontSize = snap.fontSize;
          live.subpaths = snap.subpaths;
          App.emit('change');
          return;
        }
        if (d.mode === 'rotate') {
          var liveR = App.shapeById(d.target.id);
          if (liveR) {
            var ang = Math.atan2(wp.y - d.center.y, wp.x - d.center.x);
            var delta = ang - d.startAngle;
            var newRot = d.original.rotation0 + delta;
            if (e.shiftKey) newRot = U.snapAngle(newRot, 15);
            liveR.rotation = newRot;
            App.emit('change');
          }
          return;
        }
        if (d.mode === 'marquee') {
          this.marquee.x1 = wp.x; this.marquee.y1 = wp.y;
          this.applyMarquee();
          App.emit('change');
          return;
        }
        if (d.mode === 'create') {
          App.preview = Tools.buildShape(d.type, d.start, wp, m);
          App.applyStyle(App.preview);
          App.emit('change');
          return;
        }
        if (d.mode === 'pencil') {
          this.pencil.points.push({ x: wp.x, y: wp.y });
          App.emit('change');
          return;
        }
        if (d.mode === 'anchorDrag') {
          var s = d.target;
          var lw = S.worldToLocal(s, wp.x, wp.y);
          var arr = S.subpathPoints(s, d.sub);
          if (arr && arr[d.index]) { arr[d.index].x = lw.x; arr[d.index].y = lw.y; }
          App.emit('change');
          return;
        }
        if (d.mode === 'handleDrag') {
          var sh = d.target;
          var lwp = S.worldToLocal(sh, wp.x, wp.y);
          var harr = S.subpathPoints(sh, d.sub);
          var p = harr && harr[d.index];
          if (!p) { App.emit('change'); return; }
          var hx = lwp.x - p.x, hy = lwp.y - p.y;
          p[d.which].x = hx; p[d.which].y = hy;
          if (!e.altKey) {
            var other = d.which === 'in' ? 'out' : 'in';
            var o = p[other];
            if (Math.abs(o.x) > 0.001 || Math.abs(o.y) > 0.001) { o.x = -hx; o.y = -hy; }
          }
          App.emit('change');
          return;
        }
      } else {
        this.updateHoverCursor(sp);
      }
    },

    applyMarquee: function () {
      var m = this.marquee;
      var rect = {
        x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1),
        w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0)
      };
      var sel = Object.assign({}, m.additive ? m.base : {});
      App.shapes.forEach(function (s) {
        if (!s.visible) return;
        var b = S.aabb(s);
        if (b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y) sel[s.id] = true;
      });
      App.selection = sel;
      App.emit('selection');
    },

    /* ================= pointer up ================= */
    onPointerUp: function (e) {
      var d = this.drag;
      this.drag = null;
      document.body.classList.remove('dragging');
      if (!d) return;

      if (d.mode === 'pen') { if (App.pen) App.pen.dragging = false; App.emit('change'); return; }

      if (d.mode === 'pencil') {
        var pts = this.pencil ? this.pencil.points : [];
        this.pencil = null;
        var shape = Tools.pencilToPath(pts, 2.5 / App.camera.zoom);
        if (shape) {
          shape.fill = 'none';
          shape.stroke = App.style.stroke;
          shape.strokeWidth = App.style.strokeWidth;
          shape.opacity = App.style.opacity;
          App.beginChange();
          App.shapes.push(shape);
          App.selection = {}; App.selection[shape.id] = true;
          App.endChange();
          App.emit('selection');
        } else App.emit('change');
        return;
      }

      if (d.mode === 'create') {
        var sh = Tools.buildShape(d.type, d.start, this.eventToWorld(e), { shift: e.shiftKey, alt: e.altKey });
        App.applyStyle(sh);
        App.preview = null;
        if (Tools.isMeaningful(sh)) {
          App.beginChange();
          App.shapes.push(sh);
          App.selection = {}; App.selection[sh.id] = true;
          App.endChange();
          App.emit('selection');
        } else {
          App.emit('change');
        }
        return;
      }

      if (d.mode === 'marquee') { this.marquee = null; App.emit('change'); return; }

      if (d.mode === 'anchorDrag') { S.normalizePath(d.target); App.endChange(); App.emit('change'); App.emit('selection'); return; }
      if (d.mode === 'handleDrag') { App.endChange(); App.emit('selection'); return; }
      if (d.mode === 'move' || d.mode === 'resize' || d.mode === 'rotate') { App.endChange(); App.emit('selection'); return; }
    },

    /* ================= wheel ================= */
    onWheel: function (e) {
      e.preventDefault();
      var sp = this.eventToCanvas(e);
      if (e.ctrlKey || e.metaKey) {
        var factor = Math.pow(1.0015, -e.deltaY);
        App.zoomAt(sp.x, sp.y, factor);
      } else if (e.shiftKey) {
        App.camera.pan.x -= e.deltaY;
        App.emit('view');
      } else {
        App.camera.pan.x -= e.deltaX;
        App.camera.pan.y -= e.deltaY;
        App.emit('view');
      }
    },

    /* ================= keyboard ================= */
    onKeyDown: function (e) {
      var target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      var ctrl = e.ctrlKey || e.metaKey;
      var key = e.key;

      if (key === ' ') {
        if (!App.spaceDown) { App.spaceDown = true; document.body.classList.add('cursor-hand'); }
        e.preventDefault();
        return;
      }
      if (ctrl && key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); return; }
      if (ctrl && key.toLowerCase() === 'y') { e.preventDefault(); App.redo(); return; }
      if (ctrl && key.toLowerCase() === 'a') {
        e.preventDefault();
        var all = {};
        App.shapes.forEach(function (s) { all[s.id] = true; });
        App.selection = all;
        App.emit('selection');
        return;
      }
      if (ctrl && key.toLowerCase() === 'd') { e.preventDefault(); Interaction.duplicateSelection(); return; }
      if (ctrl && key.toLowerCase() === 'n') { e.preventDefault(); global.UI && UI.action('new'); return; }
      if (ctrl && key === '0') { e.preventDefault(); Interaction.fit(); return; }
      if (ctrl && (key === '=' || key === '+')) { e.preventDefault(); App.setZoom(App.camera.zoom * 1.2); return; }
      if (ctrl && key === '-') { e.preventDefault(); App.setZoom(App.camera.zoom / 1.2); return; }

      if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); Interaction.deleteSelection(); return; }
      if (key === 'Escape') {
        if (App.pen) { Interaction.finishPen(false); return; }
        App.clearSelection();
        App.edit = null;
        App.preview = null;
        App.emit('change');
        return;
      }
      if (key === 'Enter') { if (App.pen) { e.preventDefault(); Interaction.finishPen(false); return; } }

      if (key.indexOf('Arrow') === 0 && App.hasSelection()) {
        e.preventDefault();
        var step = e.shiftKey ? 10 : 1;
        var dx = 0, dy = 0;
        if (key === 'ArrowLeft') dx = -step;
        if (key === 'ArrowRight') dx = step;
        if (key === 'ArrowUp') dy = -step;
        if (key === 'ArrowDown') dy = step;
        App.nudge(dx, dy);
        return;
      }

      var map = {
        v: 'select', a: 'direct', p: 'pen', '=': 'addAnchor', '-': 'delAnchor',
        n: 'pencil', m: 'rect', l: 'ellipse', r: 'roundrect', g: 'polygon', s: 'star',
        '\\': 'line', t: 'text', i: 'eyedropper', h: 'hand', z: 'zoom'
      };
      if (map[key.toLowerCase()] && !ctrl) global.UI && UI.setTool(map[key.toLowerCase()]);
    },

    onKeyUp: function (e) {
      if (e.key === ' ') { App.spaceDown = false; document.body.classList.remove('cursor-hand'); }
    },

    /* ================= actions ================= */
    deleteSelection: function () {
      if (!App.hasSelection()) return;
      App.beginChange();
      App.shapes = App.shapes.filter(function (s) { return !App.selection[s.id]; });
      App.clearSelection();
      App.edit = null;
      App.endChange();
    },

    duplicateSelection: function () {
      if (!App.hasSelection()) return;
      App.beginChange();
      var clones = App.selected().map(function (s) {
        var c = U.deepClone(s);
        c.id = U.uid();
        c.x += 16; c.y += 16;
        return c;
      });
      clones.forEach(function (c) { App.shapes.push(c); });
      App.selection = {};
      clones.forEach(function (c) { App.selection[c.id] = true; });
      App.endChange();
      App.emit('selection');
    },

    fit: function () {
      var rect = this.canvas.getBoundingClientRect();
      App.fitToView(rect.width, rect.height);
    },

    updateHoverCursor: function (sp) {
      if (App.spaceDown || App.tool === 'hand') { this.canvas.style.cursor = ''; return; }
      if (App.tool === 'select') {
        var sel = App.selected();
        var found = false;
        if (sel.length === 1) {
          var h = S.handlePositions(sel[0], App.camera.zoom);
          for (var i = 0; i < S.HANDLE_KEYS.length; i++) {
            var hp = App.worldToScreen(h[S.HANDLE_KEYS[i]].x, h[S.HANDLE_KEYS[i]].y);
            if (dist2(hp, sp) <= HANDLE_HIT * HANDLE_HIT) { found = true; break; }
          }
        }
        this.canvas.style.cursor = found ? 'pointer' : '';
      } else {
        this.canvas.style.cursor = '';
      }
    }
  };

  function dist2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  function nearestSegment(s, wp) {
    var lp = S.worldToLocal(s, wp.x, wp.y);
    var best = null;
    S.subpathsOf(s).forEach(function (sp, sub) {
      var pts = sp.points || [];
      var n = pts.length;
      if (n < 2) return;
      var segs = sp.closed ? n : n - 1;
      for (var i = 0; i < segs; i++) {
        var a = pts[i];
        var b = pts[(i + 1) % n];
        var p0 = { x: a.x, y: a.y };
        var c1 = { x: a.x + a.out.x, y: a.y + a.out.y };
        var c2 = { x: b.x + b.in.x, y: b.y + b.in.y };
        var p3 = { x: b.x, y: b.y };
        for (var step = 0; step <= 20; step++) {
          var t = step / 20;
          var pt = S.cubicPoint(t, p0, c1, c2, p3);
          var d = dist2(pt, lp);
          if (!best || d < best.dist) best = { sub: sub, index: i, t: t, dist: d };
        }
      }
    });
    if (best) best.dist = Math.sqrt(best.dist);
    return best;
  }

  global.Interaction = Interaction;
})(window);

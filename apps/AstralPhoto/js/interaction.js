(function (global) {
  'use strict';

  var App = global.App;
  var Renderer = global.Renderer;
  var Tools = global.Tools;
  var Selection = global.Selection;
  var Layer = global.Layer;
  var U = global.Utils;

  function normRect(a, b) {
    return {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
    };
  }

  var Interaction = {
    canvas: null,
    state: null,
    inited: false,
    _clipboard: null,
    _textWorld: null,

    init: function (canvas) {
      if (this.inited) return;
      this.inited = true;
      this.canvas = canvas;
      var self = this;
      canvas.addEventListener('pointerdown', function (e) { self.onDown(e); });
      canvas.addEventListener('pointermove', function (e) { self.onMove(e); });
      canvas.addEventListener('pointerup', function (e) { self.onUp(e); });
      canvas.addEventListener('pointercancel', function (e) { self.onUp(e); });
      canvas.addEventListener('wheel', function (e) { self.onWheel(e); }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('keydown', function (e) { self.onKeyDown(e); });
      window.addEventListener('keyup', function (e) { self.onKeyUp(e); });
      this.wireTextOverlay();
      Renderer.startAnim();
    },

    wireTextOverlay: function () {
      var self = this;
      var el = document.getElementById('textOverlay');
      if (!el) return;
      el.addEventListener('blur', function () { self.commitText(true); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); self.commitText(false); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.commitText(true); }
        e.stopPropagation();
      });
    },

    openText: function (world) {
      var el = document.getElementById('textOverlay');
      if (!el) return;
      var s = App.worldToScreen(world.x, world.y);
      el.style.display = 'block';
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.style.fontFamily = App.text.family;
      el.style.fontSize = (App.text.size * App.camera.zoom) + 'px';
      el.style.fontWeight = App.text.bold ? 'bold' : 'normal';
      el.style.fontStyle = App.text.italic ? 'italic' : 'normal';
      el.style.color = App.fg;
      el.value = '';
      this._textWorld = world;
      el.focus();
    },

    commitText: function (apply) {
      var el = document.getElementById('textOverlay');
      if (!el || el.style.display === 'none' || el.style.display === '') return;
      var val = el.value;
      el.style.display = 'none';
      var w = this._textWorld;
      this._textWorld = null;
      if (!apply || !val.replace(/\s/g, '') || !w) return;
      var layer = App.activeLayer();
      if (!layer) return;
      App.beginChange();
      var ctx = Layer.context(layer.canvas);
      ctx.save();
      Selection.clip(ctx, App.selection);
      Tools.drawText(ctx, val, w.x, w.y, {
        size: App.text.size, family: App.text.family,
        bold: App.text.bold, italic: App.text.italic, color: App.fg
      });
      ctx.restore();
      App.touch();
      App.endChange();
    },

    screenOf: function (e) {
      var r = this.canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      return { x: x, y: y, world: App.screenToWorld(x, y) };
    },

    beginPan: function (p) {
      this.state = { kind: 'pan', startScreen: { x: p.x, y: p.y } };
    },

    onDown: function (e) {
      if (!App.doc) return;
      if (this._textWorld) this.commitText(true);
      var p = this.screenOf(e);
      Renderer.setMouse({ x: p.x, y: p.y });
      var tool = App.tool;
      if (e.button === 1 || App.spaceDown || tool === 'hand') {
        this.beginPan(p);
        if (this.canvas.setPointerCapture) { try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {} }
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      if (this.canvas.setPointerCapture) { try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {} }
      this.routeDown(tool, p, e);
    },

    routeDown: function (tool, p, e) {
      var w = p.world;
      if (tool === 'zoom') {
        var f = (App.altDown || e.altKey) ? 0.5 : 2;
        App.zoomAt(p.x, p.y, f);
        Renderer.draw();
        return;
      }
      if (tool === 'eyedropper') {
        var col = Tools.pickColor(Renderer.docCanvas, w.x, w.y);
        if (col) { if (e.altKey) App.setBg(col); else App.setFg(col); }
        return;
      }
      if (tool === 'text') { this.openText(w); return; }

      var layer = App.activeLayer();
      if (!layer) return;
      if (layer.locked && (tool === 'brush' || tool === 'pencil' || tool === 'eraser' || tool === 'bucket' || tool === 'gradient' || tool === 'shape' || tool === 'move')) {
        App.emit('status', 'Calque verrouillé');
        return;
      }

      switch (tool) {
        case 'move':
          this.state = {
            kind: 'move', layer: layer, snapshot: Layer.cloneCanvas(layer.canvas),
            start: w, moved: false
          };
          App.beginChange();
          break;
        case 'marquee':
          this.state = { kind: 'marquee', shape: 'rect', start: w };
          break;
        case 'ellipse-select':
          this.state = { kind: 'marquee', shape: 'ellipse', start: w };
          break;
        case 'lasso':
          this.state = { kind: 'lasso', points: [w] };
          break;
        case 'brush':
        case 'pencil':
        case 'eraser':
          this.beginStroke(tool, layer, w);
          break;
        case 'bucket':
          App.beginChange();
          Tools.paintBucket(layer.canvas, w.x, w.y, App.fg, App.tolerance, App.selection);
          App.touch();
          App.endChange();
          break;
        case 'gradient':
          this.state = { kind: 'gradient', layer: layer, start: w, end: w };
          break;
        case 'shape':
          this.state = { kind: 'shape', layer: layer, start: w, kindShape: 'rect' };
          break;
        case 'ellipse-shape':
          this.state = { kind: 'shape', layer: layer, start: w, kindShape: 'ellipse' };
          break;
        case 'crop':
          this.state = { kind: 'crop', start: w };
          App.cropRect = normRect(w, w);
          break;
      }
    },

    beginStroke: function (tool, layer, w) {
      var ctx = Layer.context(layer.canvas);
      ctx.save();
      Selection.clip(ctx, App.selection);
      var opts = {
        size: App.brush.size,
        hardness: tool === 'pencil' ? 1 : App.brush.hardness,
        opacity: App.brush.opacity,
        color: App.fg,
        erase: tool === 'eraser'
      };
      App.beginChange();
      Tools.stamp(ctx, w.x, w.y, opts);
      this.state = { kind: 'stroke', ctx: ctx, last: w, opts: opts };
      App.touch();
    },

    onMove: function (e) {
      var p = this.screenOf(e);
      Renderer.setMouse({ x: p.x, y: p.y });
      if (!this.state) {
        if (App.tool === 'brush' || App.tool === 'eraser' || App.tool === 'pencil') Renderer.draw();
        return;
      }
      var st = this.state, w = p.world;
      switch (st.kind) {
        case 'pan':
          App.panBy(p.x - st.startScreen.x, p.y - st.startScreen.y);
          st.startScreen = { x: p.x, y: p.y };
          break;
        case 'move': {
          var dx = w.x - st.start.x, dy = w.y - st.start.y;
          var ctx = Layer.context(st.layer.canvas);
          ctx.clearRect(0, 0, st.layer.canvas.width, st.layer.canvas.height);
          ctx.drawImage(st.snapshot, Math.round(dx), Math.round(dy));
          st.moved = true;
          App.touch();
          break;
        }
        case 'marquee': {
          var r = normRect(st.start, w);
          App.selection = st.shape === 'ellipse' ? Selection.ellipse(r.x, r.y, r.w, r.h) : Selection.rect(r.x, r.y, r.w, r.h);
          App.emit('selection'); App.emit('change');
          break;
        }
        case 'lasso':
          st.points.push(w);
          App.selection = Selection.lasso(st.points);
          App.emit('selection'); App.emit('change');
          break;
        case 'stroke':
          Tools.line(st.ctx, st.last.x, st.last.y, w.x, w.y, st.opts);
          st.last = w;
          App.touch();
          break;
        case 'gradient':
          st.end = w;
          break;
        case 'shape':
          App.preview = { x: Math.min(st.start.x, w.x), y: Math.min(st.start.y, w.y), w: Math.abs(w.x - st.start.x), h: Math.abs(w.y - st.start.y), kind: st.kindShape };
          Renderer.draw();
          break;
        case 'crop':
          App.cropRect = normRect(st.start, w);
          Renderer.draw();
          break;
      }
    },

    onUp: function (e) {
      var st = this.state;
      this.state = null;
      if (!st) return;
      switch (st.kind) {
        case 'move':
          App.endChange();
          break;
        case 'stroke':
          st.ctx.restore();
          App.touch();
          App.endChange();
          break;
        case 'gradient': {
          if (Math.hypot(st.end.x - st.start.x, st.end.y - st.start.y) > 1) {
            var layer = st.layer;
            App.beginChange();
            var ctx = Layer.context(layer.canvas);
            Tools.gradient(ctx, st.start, st.end, App.fg, App.bg, App.selection, layer.canvas.width, layer.canvas.height);
            App.touch();
            App.endChange();
          }
          break;
        }
        case 'shape': {
          var pv = App.preview;
          if (pv && pv.w > 0 && pv.h > 0) {
            var slayer = st.layer;
            App.beginChange();
            var sctx = Layer.context(slayer.canvas);
            sctx.save();
            Selection.clip(sctx, App.selection);
            Tools.shape(sctx, st.kindShape, pv, App.fg, App.shape.radius);
            sctx.restore();
            App.touch();
            App.endChange();
          }
          App.preview = null;
          break;
        }
        case 'crop':
          break;
      }
      Renderer.draw();
    },

    onWheel: function (e) {
      if (!App.doc) return;
      var r = this.canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        var f = Math.pow(1.0015, -e.deltaY);
        App.zoomAt(x, y, f);
      } else {
        App.panBy(-e.deltaX, -e.deltaY);
      }
      Renderer.setMouse({ x: x, y: y });
      Renderer.draw();
    },

    translateActive: function (dx, dy) {
      var layer = App.activeLayer();
      if (!layer) return;
      var snap = Layer.cloneCanvas(layer.canvas);
      var ctx = Layer.context(layer.canvas);
      App.beginChange();
      ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.drawImage(snap, dx, dy);
      App.touch();
      App.endChange();
    },

    clearSelectionPixels: function () {
      var layer = App.activeLayer();
      if (!layer) return;
      var ctx = Layer.context(layer.canvas);
      App.beginChange();
      ctx.save();
      if (Selection.clip(ctx, App.selection)) {
        var b = Selection.bounds(App.selection);
        ctx.clearRect(b.x, b.y, b.w, b.h);
      } else {
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      }
      ctx.restore();
      App.touch();
      App.endChange();
    },

    copy: function () {
      var layer = App.activeLayer();
      if (!layer) return;
      var b = Selection.isEmpty(App.selection)
        ? { x: 0, y: 0, w: layer.canvas.width, h: layer.canvas.height }
        : Selection.bounds(App.selection);
      var c = Layer.newCanvas(b.w, b.h);
      Layer.context(c).drawImage(layer.canvas, -b.x, -b.y);
      this._clipboard = { canvas: c, x: b.x, y: b.y };
      App.emit('status', 'Copié');
    },

    paste: function () {
      if (!this._clipboard || !App.doc) return;
      var cb = this._clipboard;
      var layer = App.addLayer({ name: 'Collage' });
      App.commit('Coller', function () {
        Layer.context(layer.canvas).drawImage(cb.canvas, cb.x, cb.y);
      });
    },

    onKeyDown: function (e) {
      if (!App.doc) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      var ctrl = e.ctrlKey || e.metaKey;
      var key = e.key;

      if (key === ' ') { App.spaceDown = true; e.preventDefault(); return; }
      if (key === 'Shift') { App.shiftDown = true; return; }
      if (key === 'Alt') { App.altDown = true; e.preventDefault(); return; }

      if (ctrl && (key === 'z' || key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) App.redo(); else App.undo();
        Renderer.draw();
        return;
      }
      if (ctrl && (key === 'y' || key === 'Y')) { e.preventDefault(); App.redo(); Renderer.draw(); return; }
      if (ctrl && (key === 'a' || key === 'A')) { e.preventDefault(); App.selectAll(); Renderer.draw(); return; }
      if (ctrl && (key === 'd' || key === 'D')) { e.preventDefault(); App.clearSelection(); Renderer.draw(); return; }
      if (ctrl && (key === 'c' || key === 'C')) { e.preventDefault(); this.copy(); return; }
      if (ctrl && (key === 'v' || key === 'V')) { e.preventDefault(); this.paste(); Renderer.draw(); return; }
      if (ctrl && (key === '0')) { e.preventDefault(); App.fitToView(Renderer.viewW, Renderer.viewH); Renderer.draw(); return; }
      if (ctrl && (key === '=' || key === '+')) { e.preventDefault(); App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 1.2); Renderer.draw(); return; }
      if (ctrl && key === '-') { e.preventDefault(); App.zoomAt(Renderer.viewW / 2, Renderer.viewH / 2, 1 / 1.2); Renderer.draw(); return; }
      if (ctrl) return;

      if (key === 'Enter' && App.cropRect) {
        e.preventDefault();
        App.crop(App.cropRect);
        App.cropRect = null;
        App.fitToView(Renderer.viewW, Renderer.viewH);
        Renderer.draw();
        return;
      }
      if (key === 'Escape') {
        if (App.cropRect) { App.cropRect = null; Renderer.draw(); }
        else { App.clearSelection(); Renderer.draw(); }
        return;
      }
      if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); this.clearSelectionPixels(); Renderer.draw(); return; }

      if (key === '[') { App.brush.size = U.clamp(App.brush.size - Math.max(1, App.brush.size * 0.1), 1, 500); App.emit('brush'); return; }
      if (key === ']') { App.brush.size = U.clamp(App.brush.size + Math.max(1, App.brush.size * 0.1), 1, 500); App.emit('brush'); return; }

      if (key.indexOf('Arrow') === 0) {
        e.preventDefault();
        var step = e.shiftKey ? 10 : 1;
        var dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        var dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        this.translateActive(dx, dy);
        Renderer.draw();
        return;
      }

      var k = key.toLowerCase();
      var map = {
        v: 'move', m: 'marquee', l: 'lasso', b: 'brush', n: 'pencil',
        e: 'eraser', g: 'gradient', u: 'shape', t: 'text', i: 'eyedropper',
        c: 'crop', h: 'hand', z: 'zoom', y: 'brush', w: 'bucket'
      };
      if (map[k]) {
        if (k === 'm' && e.shiftKey) App.setTool('ellipse-select');
        else if (k === 'u' && e.shiftKey) App.setTool('ellipse-shape');
        else if (k === 'g' && e.shiftKey) App.setTool('bucket');
        else App.setTool(map[k]);
        e.preventDefault();
        return;
      }
      if (k === 'x') { App.swapColors(); return; }
      if (k === 'd') { App.resetColors(); return; }
    },

    onKeyUp: function (e) {
      if (e.key === ' ') { App.spaceDown = false; }
      if (e.key === 'Shift') App.shiftDown = false;
      if (e.key === 'Alt') App.altDown = false;
    }
  };

  global.Interaction = Interaction;
})(typeof window !== 'undefined' ? window : this);

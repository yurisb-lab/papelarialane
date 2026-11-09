// Editor do card: mostra um lado do card e deixa mexer em cada coisa (foto, texto, adesivo).
// Tocar escolhe; arrastar move; dois dedos (ou a rodinha) aumentam e giram.
// A bolinha no canto de um texto ou adesivo também aumenta e gira, com um dedo ou o mouse.

import { cardSize, cardRadius, unitOf, formatInfo, cellRects, cellFor, coverScale, newDesign, isBgPhoto, BG_CELL, HOLE } from './card.js';
import { drawSide, drawPhoto, layerBox, roundRectPath } from './render.js';

const ZOOM_MIN = 0.25; // foto: em relação ao "preencher o espaço"
const ZOOM_MAX = 8;
const SIZE = { text: [2, 40], sticker: [3, 90], draw: [3, 200] }; // mm no photo card (cresce junto com o formato)
const SNAP_DEG = 4;
const SNAP_MM = 1.2;
const HANDLE_R = 14; // px

const clone = (o) => JSON.parse(JSON.stringify(o));

export function createEditor(canvas, hooks = {}) {
  const { getImg, onChange, onCommit, onSelect, onTap, onEmptyCell, onEditText, onDelete } = hooks;
  const ctx = canvas.getContext('2d');
  let design = newDesign();
  let sideName = 'front';
  let sel = null; // { id } ou { cell }
  let view = { cw: 1, ch: 1, k: 1, cx: 0, cy: 0, dpr: 1 };
  let raf = 0;
  let tapMode = false; // "tirar fundo": tocar apaga a cor
  let rawLayerId = null; // foto mostrada sem efeitos e com xadrez atrás
  let guides = { v: false, h: false };
  let checkerPattern = null;
  let drawPen = null; // modo desenho: { layerId, c, w, pen }
  let drawing = null; // risco sendo feito: { id, st, last }

  const pointers = new Map();
  let gesture = null;
  let tap = null;
  let lastTap = null;
  let downTarget = null;
  let handleDown = false;

  // ---------- consultas ----------
  const side = () => design[sideName];
  const cells = () => cellRects(side(), design);
  const layerById = (id) => side().layers.find((l) => l.id === id) || null;
  const selectedLayer = () => (sel && sel.id ? layerById(sel.id) : null);
  const cellOf = (layer) => cellFor(side(), design, layer.cell);

  function imgSize(layer) {
    const img = getImg(layer.imageKey);
    if (!img) return null;
    return { iw: img.naturalWidth || img.width, ih: img.naturalHeight || img.height };
  }

  function baseCover(layer, cell = cellOf(layer)) {
    const s = imgSize(layer);
    if (!s || !cell) return 1;
    return coverScale(s.iw, s.ih, cell.w, cell.h, 0);
  }

  function clampScale(layer, s) {
    const c = baseCover(layer);
    return Math.min(c * ZOOM_MAX, Math.max(c * ZOOM_MIN, s));
  }

  const clampSize = (layer, s) => {
    const [lo, hi] = SIZE[layer.type] || SIZE.sticker;
    return Math.min(hi * unitOf(design), Math.max(lo, s));
  };

  function snapRotation(deg) {
    const d = ((((deg + 180) % 360) + 360) % 360) - 180;
    for (const t of [-180, -90, 0, 90, 180]) if (Math.abs(d - t) <= SNAP_DEG) return t === -180 ? 180 : t;
    return Math.round(d * 10) / 10;
  }

  // ---------- medidas da tela ----------
  function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = Math.max(1, rect.width);
    const ch = Math.max(1, rect.height);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const { w, h } = cardSize(design);
    const pad = Math.max(28, Math.min(cw, ch) * 0.12);
    const k = Math.max(0.5, Math.min((cw - pad * 2) / w, (ch - pad * 2) / h));
    view = { cw, ch, k, cx: cw / 2, cy: ch / 2, dpr };
  }

  function cardRect() {
    const { w, h } = cardSize(design);
    return { left: view.cx - (w * view.k) / 2, top: view.cy - (h * view.k) / 2, w: w * view.k, h: h * view.k };
  }

  const toMM = (p) => ({ x: (p.x - view.cx) / view.k, y: (p.y - view.cy) / view.k });
  const cellCenterPx = (cell) => ({ x: view.cx + cell.cx * view.k, y: view.cy + cell.cy * view.k });

  function layerCenterPx(layer) {
    if (layer.type === 'photo') {
      const c = cellCenterPx(cellOf(layer));
      return { x: c.x + layer.x * view.k, y: c.y + layer.y * view.k };
    }
    return { x: view.cx + layer.x * view.k, y: view.cy + layer.y * view.k };
  }

  // ---------- acertar onde tocou ----------
  const inCell = (m, c) => m.x >= c.cx - c.w / 2 && m.x <= c.cx + c.w / 2 && m.y >= c.cy - c.h / 2 && m.y <= c.cy + c.h / 2;

  function inBox(m, layer) {
    const b = layerBox(layer);
    const a = (-layer.rotation * Math.PI) / 180;
    const dx = m.x - layer.x;
    const dy = m.y - layer.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    const hw = Math.max(b.w / 2, 3.5) + 0.8;
    const hh = Math.max(b.h / 2, 3.5) + 0.8;
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function hitLayer(m) {
    const ls = side().layers;
    const cs = cells();
    for (let i = ls.length - 1; i >= 0; i--) {
      const l = ls[i];
      if (l.type === 'photo') {
        if (l.cell !== BG_CELL && cs[l.cell] && getImg(l.imageKey) && inCell(m, cs[l.cell])) return l;
      } else if (inBox(m, l)) return l;
    }
    // a foto de fundo só pega o toque onde não tem mais nada
    const bgp = ls.find((l) => isBgPhoto(l) && getImg(l.imageKey));
    const { w, h } = cardSize(design);
    if (bgp && Math.abs(m.x) <= w / 2 && Math.abs(m.y) <= h / 2) return bgp;
    return null;
  }

  const hitCell = (m) => cells().findIndex((c) => inCell(m, c));

  function handlePos(layer) {
    const b = layerBox(layer);
    const k = view.k;
    const a = (layer.rotation * Math.PI) / 180;
    const lx = (b.w / 2) * k + 6;
    const ly = (b.h / 2) * k + 6;
    const c = layerCenterPx(layer);
    return { x: c.x + lx * Math.cos(a) - ly * Math.sin(a), y: c.y + lx * Math.sin(a) + ly * Math.cos(a) };
  }

  function onHandle(p) {
    const l = selectedLayer();
    if (!l || l.type === 'photo' || tapMode) return false;
    const h = handlePos(l);
    return Math.hypot(p.x - h.x, p.y - h.y) <= HANDLE_R + 8;
  }

  // ---------- desenho ----------
  function getChecker() {
    if (checkerPattern) return checkerPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#f2dbe6';
    g.fillRect(0, 0, 8, 8);
    g.fillRect(8, 8, 8, 8);
    checkerPattern = ctx.createPattern(c, 'repeat');
    return checkerPattern;
  }

  function draw() {
    raf = 0;
    layout();
    const { dpr, k } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.cw, view.ch);
    const r = cardRect();
    const sl = selectedLayer();

    // A parte da foto que fica fora do espaço aparece apagadinha, como no Canva.
    if (sl && sl.type === 'photo') {
      const img = getImg(sl.imageKey);
      const cell = cellOf(sl);
      if (img && cell) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        const c = cellCenterPx(cell);
        drawPhoto(ctx, img, sl, c.x, c.y, k, 900, true);
        ctx.restore();
      }
    }

    // sombra do card
    ctx.save();
    ctx.shadowColor = 'rgba(122, 46, 84, 0.22)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    roundRectPath(ctx, r.left, r.top, r.w, r.h, cardRadius(design) * k);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    drawSide(ctx, design, sideName, getImg, {
      left: r.left,
      top: r.top,
      k,
      placeholders: tapMode ? null : 'editor',
      checker: rawLayerId ? getChecker() : null,
      rawLayerId,
      maxSide: 1600,
    });

    // Pontilhado de corte: é por aqui que a tesoura passa.
    ctx.save();
    roundRectPath(ctx, r.left, r.top, r.w, r.h, cardRadius(design) * k);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(142, 62, 32, 0.9)';
    ctx.stroke();
    ctx.restore();

    drawFormatGuides(r, k);

    // Pôster: a impressora pode cortar um pouquinho da beirada; o importante fica dentro desta linha.
    const safe = formatInfo(design.format).safe;
    if (safe) {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(61, 106, 85, 0.45)';
      ctx.strokeRect(r.left + safe * k, r.top + safe * k, r.w - 2 * safe * k, r.h - 2 * safe * k);
      ctx.restore();
    }

    // linhas-guia do meio
    if (guides.v || guides.h) {
      ctx.save();
      ctx.strokeStyle = 'rgba(61, 106, 85, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (guides.v) {
        ctx.moveTo(view.cx, r.top);
        ctx.lineTo(view.cx, r.top + r.h);
      }
      if (guides.h) {
        ctx.moveTo(r.left, view.cy);
        ctx.lineTo(r.left + r.w, view.cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawSelection(sl);
  }

  // Linhas de ajuda de cada formato: borda do botton, borda do papelão, furo do marcador.
  function drawFormatGuides(r, k) {
    const f = formatInfo(design.format);
    const cx = r.left + r.w / 2;
    const cy = r.top + r.h / 2;
    if (f.circle) {
      const R = (f.face / 2) * k;
      // a sobra que dobra por trás do botton fica apagadinha
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
      ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(61, 106, 85, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      // área segura: textos e o mais importante dentro desta linha
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(61, 106, 85, 0.55)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, R - 3 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (f.guide) {
      const g = f.guide.inset * k;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.rect(r.left, r.top, r.w, r.h);
      ctx.rect(r.left + g, r.top + g, r.w - 2 * g, r.h - 2 * g);
      ctx.fill('evenodd');
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(61, 106, 85, 0.8)';
      ctx.strokeRect(r.left + g, r.top + g, r.w - 2 * g, r.h - 2 * g);
      ctx.restore();
    }
    if (f.hole && design.hole) {
      const hr = (HOLE.d / 2) * k;
      const hy = r.top + (HOLE.top + HOLE.d / 2) * k;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, hy, hr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(142, 62, 32, 0.9)';
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSelection(l) {
    const k = view.k;
    const r = cardRect();
    if (sel && sel.cell != null && !l) {
      const c = cells()[sel.cell];
      if (c) {
        ctx.save();
        roundRectPath(ctx, r.left + c.x * k, r.top + c.y * k, c.w * k, c.h * k, c.r * k);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#7a52d1';
        ctx.stroke();
        ctx.restore();
      }
      return;
    }
    if (!l) return;
    if (l.type === 'photo') {
      const c = cellOf(l);
      if (!c || isBgPhoto(l) || cells().length < 2) return;
      ctx.save();
      roundRectPath(ctx, r.left + c.x * k, r.top + c.y * k, c.w * k, c.h * k, c.r * k);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#7a52d1';
      ctx.stroke();
      ctx.restore();
      return;
    }
    const b = layerBox(l);
    const c = layerCenterPx(l);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate((l.rotation * Math.PI) / 180);
    const w = b.w * k + 8;
    const h = b.h * k + 8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7a52d1';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    if (tapMode) return;
    const hp = handlePos(l);
    ctx.save();
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, HANDLE_R, 0, Math.PI * 2);
    ctx.fillStyle = '#7a52d1';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // setinha de girar
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 6, -Math.PI * 0.9, Math.PI * 0.45);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    const ex = hp.x + 6 * Math.cos(Math.PI * 0.45);
    const ey = hp.y + 6 * Math.sin(Math.PI * 0.45);
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 1);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + 1, ey - 4);
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function changed() {
    redraw();
    onChange && onChange(design);
  }

  function commit() {
    onCommit && onCommit(design);
  }

  function setSel(next) {
    const same = JSON.stringify(next) === JSON.stringify(sel);
    sel = next;
    redraw();
    if (!same && onSelect) onSelect(sel);
  }

  // ---------- gestos ----------
  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Novo centro de algo que gira/aumenta em volta de um ponto da tela (px, py).
  function aroundPivot(c, px, py, ratio, da, mx = 0, my = 0) {
    const cos = Math.cos(da);
    const sin = Math.sin(da);
    const ix = c.x - px;
    const iy = c.y - py;
    return { x: px + mx + ratio * (ix * cos - iy * sin), y: py + my + ratio * (ix * sin + iy * cos) };
  }

  function placeCenter(layer, cpx) {
    if (layer.type === 'photo') {
      const cc = cellCenterPx(cellOf(layer));
      layer.x = (cpx.x - cc.x) / view.k;
      layer.y = (cpx.y - cc.y) / view.k;
    } else {
      layer.x = (cpx.x - view.cx) / view.k;
      layer.y = (cpx.y - view.cy) / view.k;
    }
  }

  function snapPosition(layer) {
    guides = { v: false, h: false };
    if (layer.type === 'photo') return;
    if (Math.abs(layer.x) < SNAP_MM) {
      layer.x = 0;
      guides.v = true;
    }
    if (Math.abs(layer.y) < SNAP_MM) {
      layer.y = 0;
      guides.h = true;
    }
  }

  // Muda tamanho/giro de uma camada mantendo um ponto da tela parado.
  function scaleRotate(layer, start, px, py, ratio, newRot, mx = 0, my = 0) {
    let r = ratio;
    if (layer.type === 'photo') {
      const s = clampScale(layer, start.scale * ratio);
      r = s / start.scale;
      layer.scale = s;
    } else {
      const s = clampSize(layer, start.size * ratio);
      r = s / start.size;
      layer.size = s;
    }
    const da = ((newRot - start.rotation) * Math.PI) / 180;
    layer.rotation = newRot;
    const c0 = layerCenterPx({ ...layer, x: start.x, y: start.y });
    placeCenter(layer, aroundPivot(c0, px, py, r, da, mx, my));
  }

  function startGesture() {
    const pts = [...pointers.values()];
    const target = downTarget ? layerById(downTarget) : null;
    if (!target || !pts.length) {
      gesture = null;
      return;
    }
    const start = clone(target);
    if (pts.length === 1) {
      gesture = { type: handleDown ? 'handle' : 'pan', id: target.id, start, p0: { ...pts[0] }, moved: gesture ? gesture.moved : false };
    } else {
      const [a, b] = pts;
      gesture = {
        type: 'pinch',
        id: target.id,
        start,
        m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        a0: Math.atan2(b.y - a.y, b.x - a.x),
        moved: gesture ? gesture.moved : false,
      };
    }
  }

  const r2 = (v) => Math.round(v * 100) / 100;

  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* alguns navegadores recusam; o gesto funciona igual */
    }
    if (drawPen) {
      e.preventDefault();
      if (drawing) return; // outro dedo (ou a mão) encostou: ignora
      const layer = layerById(drawPen.layerId);
      if (!layer) return;
      const m = toMM(localPoint(e));
      const st = { c: drawPen.c, w: drawPen.w, pen: drawPen.pen, pts: [r2(m.x), r2(m.y)] };
      layer.strokes.push(st);
      drawing = { id: e.pointerId, st, last: m };
      changed();
      return;
    }
    const p = localPoint(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      tap = { id: e.pointerId, x: p.x, y: p.y };
      handleDown = false;
      const sl = selectedLayer();
      if (tapMode) {
        downTarget = rawLayerId;
      } else if (isBgPhoto(sl)) {
        downTarget = sl.id; // mexendo no fundo: só ele se mexe
      } else if (onHandle(p)) {
        handleDown = true;
        downTarget = sel.id;
      } else {
        const m = toMM(p);
        const hit = hitLayer(m);
        if (hit) {
          downTarget = hit.id;
          setSel({ id: hit.id });
        } else {
          downTarget = null;
          const ci = hitCell(m);
          setSel(ci >= 0 ? { cell: ci } : null);
        }
      }
      gesture = null;
    } else if (!downTarget && sel && sel.id) {
      downTarget = sel.id; // dois dedos fora de tudo: mexe no que está escolhido
    }
    canvas.classList.add('is-grabbing');
    startGesture();
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (drawing && e.pointerId === drawing.id) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      let moved = false;
      for (const ev of evs.length ? evs : [e]) {
        const m = toMM(localPoint(ev));
        if (Math.hypot(m.x - drawing.last.x, m.y - drawing.last.y) < 0.3 * Math.sqrt(unitOf(design))) continue;
        drawing.st.pts.push(r2(m.x), r2(m.y));
        drawing.last = m;
        moved = true;
      }
      if (moved) changed();
      return;
    }
    if (drawPen) return;
    if (!pointers.has(e.pointerId)) {
      // mouse passando por cima: mostra a mãozinha certa
      const p = localPoint(e);
      const over = !tapMode && (isBgPhoto(selectedLayer()) || onHandle(p) || hitLayer(toMM(p)));
      canvas.classList.toggle('is-over', !!over);
      return;
    }
    const lp = localPoint(e);
    pointers.set(e.pointerId, lp);
    if (tap && tap.id === e.pointerId) {
      if (Math.hypot(lp.x - tap.x, lp.y - tap.y) > 8) tap = null;
      else if (tapMode) return;
    }
    if (!gesture) return;
    const layer = layerById(gesture.id);
    if (!layer) return;
    const g = gesture;
    const pts = [...pointers.values()];
    const k = view.k;
    if (g.type === 'pan' && pts.length === 1) {
      layer.x = g.start.x + (pts[0].x - g.p0.x) / k;
      layer.y = g.start.y + (pts[0].y - g.p0.y) / k;
      snapPosition(layer);
    } else if (g.type === 'handle' && pts.length === 1) {
      const c = layerCenterPx(g.start);
      const v0 = { x: g.p0.x - c.x, y: g.p0.y - c.y };
      const v = { x: pts[0].x - c.x, y: pts[0].y - c.y };
      const ratio = (Math.hypot(v.x, v.y) || 1) / (Math.hypot(v0.x, v0.y) || 1);
      const rot = snapRotation(g.start.rotation + ((Math.atan2(v.y, v.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI);
      layer.size = clampSize(layer, g.start.size * ratio);
      layer.rotation = rot;
    } else if (g.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const rot = snapRotation(g.start.rotation + ((ang - g.a0) * 180) / Math.PI);
      Object.assign(layer, clone(g.start));
      scaleRotate(layer, g.start, g.m0.x, g.m0.y, d / g.d0, rot, m.x - g.m0.x, m.y - g.m0.y);
    }
    g.moved = true;
    changed();
  });

  function endPointer(e) {
    if (drawing && e.pointerId === drawing.id) {
      drawing = null;
      commit();
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size > 0) {
      startGesture();
      return;
    }
    const t = tap;
    const moved = gesture && gesture.moved;
    tap = null;
    gesture = null;
    guides = { v: false, h: false };
    canvas.classList.remove('is-grabbing');
    redraw();
    if (t && e.type === 'pointerup' && t.id === e.pointerId) {
      if (tapMode) {
        const l = layerById(rawLayerId);
        const pt = l && api.screenToImage(l, t.x, t.y);
        if (pt && onTap) onTap(pt);
        return;
      }
      const l = selectedLayer();
      const now = performance.now();
      if (l && l.type === 'text' && lastTap && lastTap.id === l.id && now - lastTap.t < 420) {
        onEditText && onEditText(l);
        lastTap = null;
      } else {
        lastTap = l ? { id: l.id, t: now } : null;
      }
      if (!l && sel && sel.cell != null && onEmptyCell) onEmptyCell(sel.cell);
    }
    if (moved) commit();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  let wheelTimer = 0;
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (drawPen) return;
      const p = localPoint(e);
      const sl = selectedLayer();
      let layer = tapMode ? layerById(rawLayerId) : isBgPhoto(sl) ? sl : hitLayer(toMM(p)) || sl;
      if (!layer) return;
      e.preventDefault();
      if (!tapMode && (!sel || sel.id !== layer.id)) setSel({ id: layer.id });
      const start = clone(layer);
      if (e.shiftKey) {
        const c = layerCenterPx(layer);
        const pivot = layer.type === 'photo' ? cellCenterPx(cellOf(layer)) : c;
        scaleRotate(layer, start, pivot.x, pivot.y, 1, snapRotation(layer.rotation + Math.sign(e.deltaY) * 3));
      } else {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const pivot = layer.type === 'photo' ? p : layerCenterPx(layer);
        scaleRotate(layer, start, pivot.x, pivot.y, factor, layer.rotation);
      }
      changed();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(commit, 300);
    },
    { passive: false }
  );

  canvas.addEventListener('keydown', (e) => {
    const layer = selectedLayer();
    if (!layer) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !tapMode) {
      e.preventDefault();
      onDelete && onDelete(layer);
      return;
    }
    if (e.key === 'Escape') {
      setSel(null);
      return;
    }
    const step = e.shiftKey ? 5 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      layer.x += moves[e.key][0];
      layer.y += moves[e.key][1];
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      const start = clone(layer);
      const c = layer.type === 'photo' ? cellCenterPx(cellOf(layer)) : layerCenterPx(layer);
      scaleRotate(layer, start, c.x, c.y, e.key === '-' ? 1 / 1.1 : 1.1, layer.rotation);
    } else return;
    e.preventDefault();
    changed();
    commit();
  });

  const ro = new ResizeObserver(redraw);
  ro.observe(canvas);
  if (document.fonts) document.fonts.addEventListener('loadingdone', redraw);

  // Fotos acompanham quando o espaço muda de tamanho (moldura, colagem, posição do card).
  function rescalePhoto(layer, oldCell, newCell) {
    const s = imgSize(layer);
    if (!s || !oldCell || !newCell) return;
    const f = coverScale(s.iw, s.ih, newCell.w, newCell.h, layer.rotation) / coverScale(s.iw, s.ih, oldCell.w, oldCell.h, layer.rotation);
    layer.scale *= f;
    layer.x *= f;
    layer.y *= f;
  }

  // Muda formato e/ou orientação, levando fotos, textos, adesivos e desenhos junto.
  function reshape(next) {
    const prev = { format: design.format || 'card', orientation: design.orientation };
    const old = cardSize(prev);
    const nw = cardSize(next);
    const ru = unitOf(next) / unitOf(prev);
    for (const name of ['front', 'back']) {
      const s = design[name];
      const before = cellRects(s, prev);
      const after = cellRects(s, next);
      for (const l of s.layers) {
        if (l.type === 'photo') {
          if (l.cell === BG_CELL) rescalePhoto(l, cellFor(s, prev, BG_CELL), cellFor(s, next, BG_CELL));
          else rescalePhoto(l, before[l.cell], after[l.cell]);
        } else {
          l.x *= nw.w / old.w;
          l.y *= nw.h / old.h;
          if (ru !== 1 && l.size) l.size *= ru;
        }
      }
    }
    design.format = next.format;
    design.orientation = next.orientation;
    layout();
    changed();
    commit();
  }

  // ---------- API ----------
  const api = {
    get design() {
      return design;
    },
    snapshot: () => JSON.stringify(design),
    getSideName: () => sideName,
    side,
    cells,
    layerById,
    selectedLayer,
    getSelection: () => sel,

    load(d, { side: s = 'front' } = {}) {
      design = clone(d);
      if (!design.format) design.format = 'card';
      drawPen = null;
      drawing = null;
      canvas.classList.remove('is-draw-mode');
      sideName = s;
      sel = null;
      layout();
      redraw();
      onSelect && onSelect(sel);
    },

    // Volta um estado (desfazer/refazer) sem perder o que estava escolhido, se ainda existir.
    restore(d) {
      design = clone(d);
      if (sel && sel.id && !layerById(sel.id)) sel = null;
      if (sel && sel.cell != null && !cells()[sel.cell]) sel = null;
      redraw();
      onSelect && onSelect(sel);
      onChange && onChange(design);
    },

    setSide(s) {
      if (s === sideName) return;
      sideName = s;
      setSel(null);
      changed();
    },

    select(id) {
      setSel(id ? { id } : null);
    },
    selectCell(i) {
      setSel(i == null ? null : { cell: i });
    },

    // Muda o card: fn(design, lado). commit = guarda para desfazer.
    change(fn, { commit: c = false } = {}) {
      fn(design, side());
      changed();
      if (c) commit();
    },
    commitNow: commit,
    redraw,

    // Para mudanças que mexem nos espaços das fotos. Devolve quantas fotos saíram.
    // refit = foto volta a preencher o espaço (usado pelos modelos).
    restructure(fn, { refit = false } = {}) {
      const before = cells();
      fn(side(), design);
      const after = cells();
      let removed = 0;
      const s = side();
      s.layers = s.layers.filter((l) => {
        if (l.type !== 'photo' || l.cell === BG_CELL) return true;
        if (!after[l.cell]) {
          removed++;
          return false;
        }
        if (refit) {
          l.x = 0;
          l.y = 0;
          l.rotation = 0;
          l.scale = baseCover(l, after[l.cell]);
        } else rescalePhoto(l, before[l.cell] || after[l.cell], after[l.cell]);
        return true;
      });
      // não deixa duas fotos no mesmo espaço
      const seen = new Set();
      s.layers = s.layers.filter((l) => {
        if (l.type !== 'photo' || l.cell === BG_CELL) return true;
        if (seen.has(l.cell)) {
          removed++;
          return false;
        }
        seen.add(l.cell);
        return true;
      });
      if (sel && sel.id && !layerById(sel.id)) sel = null;
      if (sel && sel.cell != null && !after[sel.cell]) sel = null;
      onSelect && onSelect(sel);
      changed();
      commit();
      return removed;
    },

    setOrientation(o) {
      if (o === design.orientation || !formatInfo(design.format).rotate) return;
      reshape({ format: design.format || 'card', orientation: o });
    },

    // Troca o formato (photo card, mini, marcador, cartão, pôster). Tudo acompanha o tamanho novo.
    setFormat(id) {
      const f = formatInfo(id);
      if (f.id === (design.format || 'card')) return;
      reshape({ format: f.id, orientation: f.rotate ? design.orientation : 'portrait' });
    },
    unit: () => unitOf(design),
    // Marcador: furo para fitinha (liga e desliga).
    setHole(on) {
      design.hole = !!on;
      changed();
      commit();
    },

    // Modo desenho: pen = { layerId, c, w, pen } (ou null para sair).
    setDrawMode(pen) {
      drawPen = pen ? { ...pen } : null;
      drawing = null;
      canvas.classList.toggle('is-draw-mode', !!drawPen);
      if (drawPen) setSel(null);
      redraw();
    },
    setPen(props) {
      if (drawPen) Object.assign(drawPen, props);
    },
    isDrawing: () => !!drawPen,

    // Foto: zoom em relação a "preencher o espaço".
    getZoom(layer) {
      return layer.scale / baseCover(layer);
    },
    setZoom(layer, z) {
      const start = clone(layer);
      const c = cellCenterPx(cellOf(layer));
      scaleRotate(layer, start, c.x, c.y, (z * baseCover(layer)) / layer.scale, layer.rotation);
      changed();
    },
    setRotation(layer, deg) {
      const start = clone(layer);
      const c = layer.type === 'photo' ? cellCenterPx(cellOf(layer)) : layerCenterPx(layer);
      scaleRotate(layer, start, c.x, c.y, 1, snapRotation(deg));
      changed();
    },
    fitPhoto(layer) {
      layer.x = 0;
      layer.y = 0;
      layer.rotation = 0;
      layer.scale = baseCover(layer);
      changed();
      commit();
    },
    coverFor(layer, cell) {
      return baseCover(layer, cell);
    },

    setTapMode(on, layerId = null) {
      tapMode = !!on;
      rawLayerId = on ? layerId : null;
      canvas.classList.toggle('is-tap-mode', tapMode);
      redraw();
    },

    // Ponto da tela -> pixel da foto (ou null se caiu fora dela).
    screenToImage(layer, px, py) {
      const s = imgSize(layer);
      if (!s) return null;
      const c = layerCenterPx(layer);
      const k = view.k;
      let vx = px - c.x;
      let vy = py - c.y;
      const a = (-layer.rotation * Math.PI) / 180;
      const rx = vx * Math.cos(a) - vy * Math.sin(a);
      const ry = vx * Math.sin(a) + vy * Math.cos(a);
      vx = (layer.flip ? -rx : rx) / (layer.scale * k) + s.iw / 2;
      vy = ry / (layer.scale * k) + s.ih / 2;
      if (vx < 0 || vy < 0 || vx >= s.iw || vy >= s.ih) return null;
      return { x: vx, y: vy };
    },

    // Posição do card na tela (para a animação de "voar para a folha").
    cardScreenRect() {
      const r = cardRect();
      const c = canvas.getBoundingClientRect();
      return { left: c.left + r.left, top: c.top + r.top, width: r.w, height: r.h };
    },

    destroy() {
      ro.disconnect();
      if (document.fonts) document.fonts.removeEventListener('loadingdone', redraw);
      if (raf) cancelAnimationFrame(raf);
    },
  };

  layout();
  redraw();
  return api;
}

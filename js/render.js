// Desenho do card: fundo, moldura, fotos, textos e adesivos.
// A mesma função desenha na tela, nas miniaturas e no PDF, então o que se vê é o que sai.

import {
  PX_PER_MM_PRINT,
  cardSize,
  cardRadius,
  unitOf,
  cellRects,
  BG_CELL,
  frameInfo,
  frameWindow,
  inkFor,
  frameInk,
  formatInfo,
} from './card.js';
import { processPhoto } from './fx.js';
import { cssFont } from './fonts.js';
import { drawSticker, stickerBox } from './stickers.js';

export const GRADIENTS = [
  { id: 'algodao', name: 'Algodão-doce', stops: ['#ffd1e3', '#d9c8ff'], angle: 160 },
  { id: 'pessego', name: 'Pêssego', stops: ['#ffe3c4', '#ffb3cf'], angle: 180 },
  { id: 'menta', name: 'Menta', stops: ['#d2f4e4', '#cfe6ff'], angle: 170 },
  { id: 'ceu', name: 'Céu', stops: ['#9fd3ff', '#e6dcff'], angle: 180 },
  { id: 'por-do-sol', name: 'Pôr do sol', stops: ['#ffd36e', '#ff8fb0', '#a98bff'], angle: 180 },
  { id: 'limonada', name: 'Limonada', stops: ['#fff4a8', '#c9f2c7'], angle: 160 },
  { id: 'noite', name: 'Noite', stops: ['#2b2a5c', '#6c4bb4'], angle: 180 },
];

export const PATTERNS = [
  { id: 'none', name: 'Lisa' },
  { id: 'dots', name: 'Bolinhas' },
  { id: 'hearts', name: 'Corações' },
  { id: 'stars', name: 'Estrelinhas' },
  { id: 'stripes', name: 'Listras' },
  { id: 'checker', name: 'Xadrez' },
  { id: 'grid', name: 'Quadriculado' },
];

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function addRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// ---------- estampas (medidas em mm, presas ao canto do card) ----------
const HEART = new Path2D('M50 90 C22 70 5 54 5 32 C5 16 17 6 31 6 C40 6 46 11 50 18 C54 11 60 6 69 6 C83 6 95 16 95 32 C95 54 78 70 50 90Z');
const SPARK = new Path2D('M50 3 C54 38 62 46 97 50 C62 54 54 62 50 97 C46 62 38 54 3 50 C38 46 46 38 50 3Z');

function grid(area, ox, oy, s, stagger, fn) {
  const j0 = Math.floor((area.y - oy) / s) - 1;
  const j1 = Math.ceil((area.y + area.h - oy) / s) + 1;
  const i0 = Math.floor((area.x - ox) / s) - 1;
  const i1 = Math.ceil((area.x + area.w - ox) / s) + 1;
  for (let j = j0; j <= j1; j++) {
    const off = stagger && j % 2 ? s / 2 : 0;
    for (let i = i0; i <= i1; i++) fn(ox + i * s + off + s / 2, oy + j * s + s / 2, i, j);
  }
}

function stamp(ctx, path, x, y, size) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fill(path);
  ctx.restore();
}

// tamanhos: { step, size } em mm
function drawPattern(ctx, id, ink, area, ox, oy, k, dense = false) {
  const sc = dense ? 0.62 : 1;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  if (id === 'dots') {
    const s = 5 * sc * k;
    const r = 0.85 * sc * k;
    ctx.beginPath();
    grid(area, ox, oy, s, true, (x, y) => {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    });
    ctx.fill();
  } else if (id === 'hearts') {
    const s = 7 * sc * k;
    grid(area, ox, oy, s, true, (x, y) => stamp(ctx, HEART, x, y, 2.6 * sc * k));
  } else if (id === 'stars') {
    const s = 7 * sc * k;
    grid(area, ox, oy, s, true, (x, y, i, j) => stamp(ctx, SPARK, x, y, ((i + j) % 3 ? 2.4 : 3.4) * sc * k));
  } else if (id === 'stripes') {
    const s = 4 * sc * k;
    const bw = 1.7 * sc * k;
    const h = area.h;
    ctx.beginPath();
    const start = ox + Math.floor((area.x - ox - h) / s) * s;
    for (let x = start; x < area.x + area.w + h; x += s) {
      ctx.moveTo(x, area.y);
      ctx.lineTo(x + bw, area.y);
      ctx.lineTo(x + bw - h, area.y + h);
      ctx.lineTo(x - h, area.y + h);
      ctx.closePath();
    }
    ctx.fill();
  } else if (id === 'checker') {
    const s = 4 * sc * k;
    ctx.globalAlpha = 0.45;
    const x0 = ox + Math.floor((area.x - ox) / s) * s;
    const y0 = oy + Math.floor((area.y - oy) / s) * s;
    for (let x = x0, i = Math.floor((area.x - ox) / s); x < area.x + area.w; x += s, i++) {
      if (i % 2 === 0) ctx.fillRect(x, area.y, s / 2, area.h);
    }
    for (let y = y0, j = Math.floor((area.y - oy) / s); y < area.y + area.h; y += s, j++) {
      if (j % 2 === 0) ctx.fillRect(area.x, y, area.w, s / 2);
    }
  } else if (id === 'grid') {
    const s = 4 * sc * k;
    ctx.lineWidth = Math.max(0.5, 0.28 * k);
    ctx.beginPath();
    for (let x = ox + Math.floor((area.x - ox) / s) * s; x < area.x + area.w; x += s) {
      ctx.moveTo(x, area.y);
      ctx.lineTo(x, area.y + area.h);
    }
    for (let y = oy + Math.floor((area.y - oy) / s) * s; y < area.y + area.h; y += s) {
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function bgBaseColor(bg) {
  if (!bg) return '#ffffff';
  if (bg.kind === 'gradient') return (bg.stops && bg.stops[0]) || '#ffffff';
  return bg.color || '#ffffff';
}

function paintBg(ctx, bg, area, card, k, checker, u = 1) {
  if (checker) {
    ctx.fillStyle = checker;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    return;
  }
  if (bg.kind === 'gradient' && bg.stops && bg.stops.length) {
    const a = (((bg.angle == null ? 180 : bg.angle) - 90) * Math.PI) / 180;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const half = Math.abs((card.w / 2) * Math.cos(a)) + Math.abs((card.h / 2) * Math.sin(a));
    const g = ctx.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half);
    bg.stops.forEach((c, i) => g.addColorStop(bg.stops.length === 1 ? 0 : i / (bg.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    return;
  }
  const color = bg.color || '#ffffff';
  ctx.fillStyle = color;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  if (bg.kind === 'pattern' && bg.pattern && bg.pattern !== 'none') {
    drawPattern(ctx, bg.pattern, inkFor(color), area, card.x, card.y, k * Math.sqrt(u));
  }
}

function paintFrame(ctx, frame, design, area, card, k) {
  const info = frameInfo(frame.id);
  if (!info.inset) return;
  const { w, h } = cardSize(design);
  const win = frameWindow(frame, design);
  const u = unitOf(design);
  const ku = k * u;
  const color = frame.color || '#ffffff';
  const ink = frameInk(color);
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  addRoundRect(ctx, card.x + win.x * k, card.y + win.y * k, win.w * k, win.h * k, win.r * k);
  ctx.clip('evenodd');
  ctx.fillStyle = color;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  const id = frame.id;
  if (id === 'dots' || id === 'hearts' || id === 'checker' || id === 'stripes') {
    const map = { dots: 'dots', hearts: 'hearts', checker: 'checker', stripes: 'stripes' };
    drawPattern(ctx, map[id], ink, area, card.x, card.y, ku, true);
  } else if (id === 'double') {
    const o = 1.3 * u;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.5 * ku;
    roundRectPath(ctx, card.x + (win.x - o) * k, card.y + (win.y - o) * k, (win.w + 2 * o) * k, (win.h + 2 * o) * k, (win.r + o) * k);
    ctx.stroke();
  } else if (id === 'stitch') {
    const o = (info.inset * u) / 2;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.55 * ku;
    ctx.lineCap = 'round';
    ctx.setLineDash([1.5 * ku, 1.1 * ku]);
    roundRectPath(ctx, card.x + o * k, card.y + o * k, (w - 2 * o) * k, (h - 2 * o) * k, Math.max(0.5 * u, cardRadius(design) - o + u) * k);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- foto ----------
export function drawPhoto(ctx, img, layer, px, py, k, maxSide, raw) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const res = raw ? { canvas: img, pad: 0 } : processPhoto(img, layer.fx, layer.outline, maxSide);
  ctx.save();
  ctx.translate(px + layer.x * k, py + layer.y * k);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flip) ctx.scale(-1, 1);
  const dw = (iw + res.pad * 2) * layer.scale * k;
  const dh = (ih + res.pad * 2) * layer.scale * k;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(res.canvas, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ---------- texto ----------
let measureCtx = null;
export function textMetrics(layer) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = cssFont(layer.font, 100);
  const lines = String(layer.text || ' ').split('\n');
  const widths = lines.map((l) => measureCtx.measureText(l || ' ').width * (layer.size / 100));
  const lineH = layer.size * 1.2;
  const stroke = textStroke(layer);
  return {
    lines,
    widths,
    lineH,
    stroke,
    w: Math.max(...widths, layer.size * 0.4) + stroke * 2,
    h: lines.length * lineH + stroke * 2,
  };
}

function textStroke(layer) {
  return layer.stroke && layer.stroke.color ? (layer.size * (layer.stroke.width || 4)) / 40 : 0;
}

function drawText(ctx, layer, px, py, k) {
  const m = textMetrics(layer);
  const size = layer.size * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.font = cssFont(layer.font, size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = layer.align || 'center';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const boxW = (m.w - m.stroke * 2) * k;
  const ax = layer.align === 'left' ? -boxW / 2 : layer.align === 'right' ? boxW / 2 : 0;
  const n = m.lines.length;
  const lh = m.lineH * k;
  const yOf = (i) => (i - (n - 1) / 2) * lh + size * 0.04;
  if (layer.shadow) {
    ctx.shadowColor = 'rgba(60, 20, 50, 0.42)';
    ctx.shadowBlur = 0.9 * k;
    ctx.shadowOffsetY = 0.45 * k;
  }
  if (m.stroke) {
    ctx.strokeStyle = layer.stroke.color;
    ctx.lineWidth = m.stroke * 2 * k;
    m.lines.forEach((line, i) => ctx.strokeText(line, ax, yOf(i)));
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = layer.color || '#000';
  m.lines.forEach((line, i) => ctx.fillText(line, ax, yOf(i)));
  ctx.restore();
}

// ---------- desenho à mão ----------
// Riscos suaves: curvas passando pelo meio de cada par de pontos.
function strokePath(ctx, pts) {
  ctx.beginPath();
  if (pts.length <= 2) {
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[0] + 0.01, pts[1]);
    return;
  }
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2;
    const my = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
}

export const PENS = [
  { id: 'pen', name: 'Caneta' },
  { id: 'marker', name: 'Marca-texto' },
  { id: 'glow', name: 'Neon' },
];

function drawStrokes(ctx, layer, px, py, k) {
  const s = (layer.size / (layer.base || 1)) * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of layer.strokes) {
    if (!st.pts || st.pts.length < 2) continue;
    ctx.save();
    if (st.pen === 'marker') {
      ctx.globalAlpha = 0.5;
      ctx.lineCap = 'butt';
    }
    if (st.pen === 'glow') {
      ctx.shadowColor = st.c;
      ctx.shadowBlur = st.w * 1.6 * s;
      strokePath(ctx, st.pts);
      ctx.strokeStyle = st.c;
      ctx.lineWidth = st.w;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = st.w * 0.4;
      ctx.stroke();
    } else {
      strokePath(ctx, st.pts);
      ctx.strokeStyle = st.c;
      ctx.lineWidth = st.w;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// Caixa de uma camada de texto, adesivo ou desenho (mm, centro em relação ao centro do card).
export function layerBox(layer) {
  if (layer.type === 'text') {
    const m = textMetrics(layer);
    return { w: m.w, h: m.h };
  }
  if (layer.type === 'draw') {
    const f = layer.size / (layer.base || 1);
    return { w: (layer.bw || 0) * f, h: (layer.bh || 0) * f };
  }
  return stickerBox(layer);
}

// ---------- espaço vazio ----------
function drawPlaceholder(ctx, x, y, w, h, r, k, style) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  if (style === 'sample') {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#f6c9dc');
    g.addColorStop(1, '#d9c8ff');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const s = Math.min(w, h);
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.42, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.42 + s * 0.48, s * 0.32, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(180, 83, 47, 0.6)';
    ctx.stroke();
    ctx.setLineDash([]);
    const s = Math.min(14, Math.min(w, h) * 0.18);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#b4532f';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, s * 0.32);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.65, cy);
    ctx.lineTo(cx + s * 0.65, cy);
    ctx.moveTo(cx, cy - s * 0.65);
    ctx.lineTo(cx, cy + s * 0.65);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- o lado inteiro ----------
// left/top = canto do card em px; k = px por mm; bleed = sobra em volta (mm), sem cantos arredondados.
export function drawSide(ctx, design, sideName, getImg, opt) {
  const { left, top, k, bleed = 0, placeholders = null, checker = null, rawLayerId = null, maxSide = 1400 } = opt;
  const side = design[sideName];
  const { w, h } = cardSize(design);
  const u = unitOf(design);
  const card = { x: left, y: top, w: w * k, h: h * k };
  const area = { x: left - bleed * k, y: top - bleed * k, w: (w + 2 * bleed) * k, h: (h + 2 * bleed) * k };
  const ccx = left + card.w / 2;
  const ccy = top + card.h / 2;

  ctx.save();
  if (bleed > 0) {
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
  } else {
    roundRectPath(ctx, card.x, card.y, card.w, card.h, cardRadius(design) * k);
  }
  ctx.clip();

  paintBg(ctx, side.bg, area, card, k, checker, u);

  // foto de fundo: atrás da moldura e das outras fotos
  for (const layer of side.layers) {
    if (layer.type !== 'photo' || layer.cell !== BG_CELL) continue;
    const img = getImg(layer.imageKey);
    if (img) drawPhoto(ctx, img, layer, ccx, ccy, k, maxSide, layer.id === rawLayerId);
  }

  paintFrame(ctx, side.frame, design, area, card, k);

  const cells = cellRects(side, design);
  if (placeholders) {
    const used = new Set(side.layers.filter((l) => l.type === 'photo').map((l) => l.cell));
    cells.forEach((c, i) => {
      if (!used.has(i)) drawPlaceholder(ctx, left + c.x * k, top + c.y * k, c.w * k, c.h * k, c.r * k, k, placeholders);
    });
  }

  for (const layer of side.layers) {
    if (layer.type === 'photo') {
      if (layer.cell === BG_CELL) continue;
      const cell = cells[layer.cell];
      const img = getImg(layer.imageKey);
      if (!cell || !img) continue;
      ctx.save();
      roundRectPath(ctx, left + cell.x * k, top + cell.y * k, cell.w * k, cell.h * k, cell.r * k);
      ctx.clip();
      drawPhoto(ctx, img, layer, ccx + cell.cx * k, ccy + cell.cy * k, k, maxSide, layer.id === rawLayerId);
      ctx.restore();
    } else if (layer.type === 'text') {
      drawText(ctx, layer, ccx + layer.x * k, ccy + layer.y * k, k);
    } else if (layer.type === 'sticker') {
      drawSticker(ctx, layer, ccx + layer.x * k, ccy + layer.y * k, k, getImg);
    } else if (layer.type === 'draw') {
      drawStrokes(ctx, layer, ccx + layer.x * k, ccy + layer.y * k, k);
    }
  }
  ctx.restore();
}

// ---------- saídas ----------
// Card em alta resolução, sempre em pé, pronto para a folha.
// Cards deitados giram 90°: a frente no sentido do relógio e o verso ao contrário,
// para os dois lados ficarem certos depois de recortados.
export function renderForPrint(design, sideName, getImg, { bleed = 0, pxPerMm = PX_PER_MM_PRINT } = {}) {
  const { w, h } = cardSize(design);
  const src = document.createElement('canvas');
  src.width = Math.round((w + 2 * bleed) * pxPerMm);
  src.height = Math.round((h + 2 * bleed) * pxPerMm);
  const k = src.width / (w + 2 * bleed);
  const sctx = src.getContext('2d');
  // bottons: os cantos ficam transparentes (na folha, um botton encaixa no vão do outro)
  if (!formatInfo(design.format).circle || bleed > 0) {
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, src.width, src.height);
  }
  drawSide(sctx, design, sideName, getImg, { left: bleed * k, top: bleed * k, k, bleed, maxSide: Infinity });
  if (w <= h) return src;

  const out = document.createElement('canvas');
  out.width = src.height;
  out.height = src.width;
  const octx = out.getContext('2d');
  if (sideName === 'back') {
    octx.translate(0, out.height);
    octx.rotate(-Math.PI / 2);
  } else {
    octx.translate(out.width, 0);
    octx.rotate(Math.PI / 2);
  }
  octx.drawImage(src, 0, 0);
  return out;
}

// Miniatura na orientação do próprio card.
export function renderThumb(design, sideName, getImg, longSide = 360, { placeholders = null } = {}) {
  const { w, h } = cardSize(design);
  const k = longSide / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  drawSide(ctx, design, sideName, getImg, { left: 0, top: 0, k, placeholders, maxSide: Math.max(300, longSide * 2) });
  return c;
}

// Imagem pronta de um lado (para salvar no aparelho), na orientação do próprio card.
// Os cantos arredondados ficam transparentes.
export function renderImage(design, sideName, getImg, pxPerMm = PX_PER_MM_PRINT) {
  const { w, h } = cardSize(design);
  const c = document.createElement('canvas');
  c.width = Math.round(w * pxPerMm);
  c.height = Math.round(h * pxPerMm);
  drawSide(c.getContext('2d'), design, sideName, getImg, { left: 0, top: 0, k: c.width / w, maxSide: Infinity });
  return c;
}


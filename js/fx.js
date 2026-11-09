// Filtros, ajustes e contorno das fotos.
// Tudo vira uma conta só por pixel (uma "matriz de cor"), feita aqui mesmo, então a foto
// sai igual na tela, no PDF e em qualquer navegador.

import { hexToRgb } from './card.js';

export const FILTERS = [
  { id: 'normal', name: 'Normal' },
  { id: 'vivo', name: 'Vivo', saturation: 0.45, contrast: 0.1 },
  { id: 'rosado', name: 'Rosado', tint: ['#ff7aa8', 0.16], brightness: 0.04 },
  { id: 'sonho', name: 'Sonho', brightness: 0.1, contrast: -0.18, saturation: -0.12, tint: ['#c9a8ff', 0.12] },
  { id: 'quente', name: 'Quentinho', tint: ['#ffb347', 0.14], saturation: 0.1 },
  { id: 'frio', name: 'Friozinho', tint: ['#6fb7ff', 0.14], brightness: 0.02 },
  { id: 'vintage', name: 'Vintage', sepia: 0.45, contrast: -0.06, brightness: 0.04, saturation: -0.1 },
  { id: 'pb', name: 'Preto e branco', gray: 1, contrast: 0.12 },
];

const filterInfo = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

// ---------- matriz de cor (3 linhas x 4 colunas: r, g, b, soma) ----------
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

// a depois de b (aplica b primeiro).
function mul(a, b) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let v = c === 3 ? a[r * 4 + 3] : 0;
      for (let k = 0; k < 3; k++) v += a[r * 4 + k] * b[k * 4 + c];
      o[r * 4 + c] = v;
    }
  }
  return o;
}

const lerpM = (m, t) => m.map((v, i) => ID[i] + (v - ID[i]) * t);

function saturate(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
  ];
}

const SEPIA = [0.393, 0.769, 0.189, 0, 0.349, 0.686, 0.168, 0, 0.272, 0.534, 0.131, 0];
const GRAY = [0.2126, 0.7152, 0.0722, 0, 0.2126, 0.7152, 0.0722, 0, 0.2126, 0.7152, 0.0722, 0];

export function fxMatrix(fx) {
  if (!fx) return null;
  const f = filterInfo(fx.filter);
  let m = ID;
  if (f.gray) m = mul(lerpM(GRAY, f.gray), m);
  if (f.sepia) m = mul(lerpM(SEPIA, f.sepia), m);
  const sat = 1 + (f.saturation || 0) + (fx.saturation || 0);
  if (Math.abs(sat - 1) > 0.001) m = mul(saturate(Math.max(0, sat)), m);
  const con = 1 + (f.contrast || 0) + (fx.contrast || 0) * 0.6;
  if (Math.abs(con - 1) > 0.001) m = mul([con, 0, 0, 128 * (1 - con), 0, con, 0, 128 * (1 - con), 0, 0, con, 128 * (1 - con)], m);
  const bri = 1 + (f.brightness || 0) + (fx.brightness || 0) * 0.5;
  if (Math.abs(bri - 1) > 0.001) m = mul([bri, 0, 0, 0, 0, bri, 0, 0, 0, 0, bri, 0], m);
  if (f.tint) {
    const [r, g, b] = hexToRgb(f.tint[0]);
    const a = f.tint[1];
    m = mul([1 - a, 0, 0, r * a, 0, 1 - a, 0, g * a, 0, 0, 1 - a, b * a], m);
  }
  return m.every((v, i) => Math.abs(v - ID[i]) < 1e-4) ? null : m;
}

function applyMatrix(ctx, w, h, m) {
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const [a0, a1, a2, a3, b0, b1, b2, b3, c0, c1, c2, c3] = m;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = a0 * r + a1 * g + a2 * b + a3;
    d[i + 1] = b0 * r + b1 * g + b2 * b + b3;
    d[i + 2] = c0 * r + c1 * g + c2 * b + c3;
  }
  ctx.putImageData(data, 0, 0);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Contorno: a silhueta da foto (o que não é transparente) é carimbada em volta, em círculo.
export function addOutline(base, radius, color) {
  const pad = Math.ceil(radius) + 2;
  const W = base.width + pad * 2;
  const H = base.height + pad * 2;
  const mf = Math.min(1, 1600 / Math.max(W, H)); // a máscara pode ser menor: o contorno é liso
  const mw = Math.round(W * mf);
  const mh = Math.round(H * mf);

  const sil = makeCanvas(mw, mh);
  const sctx = sil.getContext('2d');
  sctx.drawImage(base, pad * mf, pad * mf, base.width * mf, base.height * mf);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, mw, mh);

  const stamp = makeCanvas(mw, mh);
  const st = stamp.getContext('2d');
  const r = radius * mf;
  const rings = r > 8 ? [1, 0.55] : [1];
  for (const k of rings) {
    const rr = r * k;
    const steps = Math.max(16, Math.min(48, Math.round((2 * Math.PI * rr) / 3)));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      st.drawImage(sil, Math.cos(a) * rr, Math.sin(a) * rr);
    }
  }
  st.drawImage(sil, 0, 0);

  const out = makeCanvas(W, H);
  const o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(stamp, 0, 0, W, H);
  o.drawImage(base, pad, pad);
  return { canvas: out, pad };
}

const cache = new WeakMap();

// Devolve { canvas, pad } — pad é a sobra em volta (em pixels da foto original) por causa do contorno.
// maxSide: tamanho máximo do resultado (menor na tela, para ficar rápido; sem limite para imprimir).
export function processPhoto(img, fx, outline, maxSide = Infinity) {
  const m = fxMatrix(fx);
  const ol = outline && outline.on ? outline : null;
  if (!m && !ol) return { canvas: img, pad: 0 };
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const f = Math.min(1, maxSide / Math.max(iw, ih));
  const key = `${f.toFixed(4)}|${m ? m.map((v) => v.toFixed(4)).join(',') : '-'}|${ol ? ol.size + ol.color : '-'}`;
  let entries = cache.get(img);
  if (!entries) cache.set(img, (entries = new Map()));
  const hit = entries.get(key);
  if (hit) return hit;

  const base = makeCanvas(iw * f, ih * f);
  const bctx = base.getContext('2d', { willReadFrequently: !!m });
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(img, 0, 0, base.width, base.height);
  if (m) applyMatrix(bctx, base.width, base.height, m);

  let res = { canvas: base, pad: 0 };
  if (ol) {
    const radius = outlineRadius(iw, ih, ol.size) * (base.width / iw);
    const o = addOutline(base, radius, ol.color || '#ffffff');
    res = { canvas: o.canvas, pad: o.pad * (iw / base.width) };
  }
  if (entries.size >= 4) entries.delete(entries.keys().next().value);
  entries.set(key, res);
  return res;
}

// Espessura do contorno em pixels da foto: 1–10 vira até 4% do lado maior.
export function outlineRadius(iw, ih, size) {
  return Math.max(iw, ih) * 0.004 * Math.max(1, Math.min(10, size || 4));
}

// Esquece o que foi calculado para uma foto (ex.: o "tirar fundo" mudou os pixels).
export function forgetPhoto(img) {
  if (img) cache.delete(img);
}

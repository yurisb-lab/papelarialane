// Meus adesivos: figurinhas feitas a partir de fotos (com o fundo tirado) ou de imagens PNG.
// Ficam guardadas no aparelho e aparecem na aba "Adesivos" de qualquer card ou pôster.

import { db, newId } from './db.js';
import { canvasToBlob, blobToImage, releaseImage } from './image.js';

const MAX_SIDE = 1400; // px: dá para imprimir um adesivo de até ~12 cm bem nítido

// Corta as bordas transparentes e devolve um canvas só com o desenho (ou null se não sobrou nada).
export function trimTransparent(source) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const f = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * f));
  c.height = Math.max(1, Math.round(h * f));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++) {
    const row = y * c.width * 4;
    for (let x = 0; x < c.width; x++) {
      if (d[row + x * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(c.width - 1, x1 + pad);
  y1 = Math.min(c.height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// O desenho tem partes transparentes? (uma foto comum não tem: vira um adesivo quadrado)
export function hasTransparency(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor((w * h) / 40000)) * 4;
  for (let i = 3; i < d.length; i += step) if (d[i] < 200) return true;
  return false;
}

// Guarda um adesivo novo a partir de um canvas/imagem. Devolve o registro guardado.
export async function saveSticker(source, { name = '' } = {}) {
  const trimmed = trimTransparent(source);
  if (!trimmed) throw new Error('Essa imagem ficou vazia: não sobrou nada para virar adesivo.');
  const blob = await canvasToBlob(trimmed, 'image/png');
  const rec = { id: newId(), name, blob, w: trimmed.width, h: trimmed.height, createdAt: Date.now() };
  await db.putSticker(rec);
  notify();
  return rec;
}

export const listStickers = () => db.allStickers().catch(() => []);

export async function deleteSticker(id) {
  await db.deleteSticker(id);
  notify();
}

export async function restoreSticker(rec) {
  await db.putSticker(rec);
  notify();
}

// Quem quer saber quando a lista muda (a aba de adesivos aberta, por exemplo).
const listeners = new Set();
export function onStickersChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {}
  });
}

// Miniaturas (URLs) da lista de adesivos, para os botões.
export function stickerUrls(list) {
  return list.map((s) => ({ ...s, url: URL.createObjectURL(s.blob) }));
}
export function revokeUrls(list) {
  (list || []).forEach((s) => s.url && URL.revokeObjectURL(s.url));
}

// Imagem de um adesivo guardado (lembre de soltar com releaseImage).
export const stickerImage = (rec) => blobToImage(rec.blob);
export { releaseImage };

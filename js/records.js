// Coisas que várias telas fazem com os cards guardados no aparelho
// (photo cards, fichário e meus adesivos).

import { db, newId } from './db.js';
import { renderThumb } from './render.js';
import { ensureFonts } from './fonts.js';
import { migrateRecord } from './card.js';
import { canvasToBlob, blobToImage, releaseImage } from './image.js';
import { queueCard } from './cloud.js';

export const isStickerRec = (r) => !!r && r.kind === 'sticker';
// Cards antigos não têm "inSheet": estão na folha.
export const onSheet = (r) => r.inSheet !== false;

export async function allRecords() {
  return (await db.allCards()).map(migrateRecord);
}

// Abre as fotos de um card (chave -> imagem). Solte com releaseMap.
export async function loadImageMap(images) {
  const m = new Map();
  for (const [k, b] of Object.entries(images || {})) {
    if (!b) continue;
    try {
      m.set(k, await blobToImage(b));
    } catch (_) {}
  }
  return m;
}

export function releaseMap(m) {
  if (m) m.forEach(releaseImage);
}

export async function thumbBlobFor(design, getImg) {
  await ensureFonts(design);
  return canvasToBlob(renderThumb(design, 'front', getImg), 'image/png');
}

// Tira o que só existe na tela (thumbUrl) antes de guardar.
export function plain(rec) {
  const { thumbUrl, ...r } = rec;
  return r;
}

export async function putRecord(rec) {
  const r = plain(rec);
  await db.putCard(r);
  if (!isStickerRec(r)) queueCard(r.id).catch(() => {});
  return r;
}

// Cópia de um card (as fotos são as mesmas, então não ocupa quase nada a mais).
export async function duplicateRecord(rec) {
  const copy = { ...plain(rec), id: newId(), createdAt: Date.now(), copies: 1, inSheet: true, fav: false };
  return putRecord(copy);
}

// Põe um dos meus adesivos na folha de impressão. sizeMm = lado maior.
export async function addStickerToSheet(lib, sizeMm = 50) {
  const rec = {
    v: 2,
    kind: 'sticker',
    id: newId(),
    createdAt: Date.now(),
    copies: 1,
    inSheet: true,
    sticker: { libId: lib.id, sizeMm, aspect: lib.w / lib.h },
    images: { s: lib.blob },
    thumbBlob: lib.blob,
  };
  await db.putCard(rec);
  return rec;
}

// Pastas do fichário: [{ id, name }]
export async function getFolders() {
  return (await db.getMeta('folders').catch(() => null)) || [];
}
export async function setFolders(list) {
  await db.setMeta('folders', list);
}

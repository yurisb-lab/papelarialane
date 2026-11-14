// Cópia de segurança: guarda tudo o que está no aparelho num único arquivo .zip
// (criações do fichário, meus adesivos, temas, pastas e ajustes) e traz de volta,
// no mesmo aparelho ou num aparelho novo.
//
// Dentro do .zip:
//   copia.json   a lista de tudo, com as imagens trocadas por { $blob: 'arquivos/12.png' }
//   arquivos/... as imagens (fotos, adesivos, miniaturas), como estavam no aparelho
//
// Ao trazer de volta, o que já está no aparelho com o mesmo código fica como está
// (nada é apagado nem trocado); só entra o que falta. As criações que entram vão para a nuvem.

import { db } from './db.js';
import { libs } from './pdftools.js';
import { queueCards } from './cloud.js';
import { isStickerRec } from './records.js';

const APP = 'central-elane';
const FORMAT = 1;
const MANIFEST = 'copia.json';
// Ajustes que vão junto. A conta da nuvem, a fila de envio e o rascunho do editor ficam de fora:
// são deste aparelho.
const LIST_META = ['themes', 'folders']; // listas { id, ... }: junta com o que já tem
const PLAIN_META = ['notebookSpec', 'silhouette']; // só entram se o aparelho ainda não tiver
const LAST_KEY = 'lastBackup';

export class BackupError extends Error {
  constructor(msg) {
    super(msg);
    this.userFacing = true;
  }
}

const isPlainObject = (v) => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/json': 'json' };

// Troca cada imagem (Blob) por uma referência ao arquivo dentro do .zip.
// A mesma imagem usada em vários lugares (ex.: card duplicado) vai uma vez só.
function packer() {
  const files = [];
  const seen = new Map();
  function pack(v) {
    if (v instanceof Blob) {
      if (!seen.has(v)) {
        const name = `arquivos/${files.length + 1}.${EXT[v.type] || 'bin'}`;
        seen.set(v, name);
        files.push({ name, blob: v });
      }
      return { $blob: seen.get(v), type: v.type || '' };
    }
    if (Array.isArray(v)) return v.map(pack);
    if (isPlainObject(v)) {
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        if (x === undefined || typeof x === 'function') continue;
        out[k] = pack(x);
      }
      return out;
    }
    return v;
  }
  return { pack, files };
}

async function unpack(v, zip, cache) {
  if (Array.isArray(v)) return Promise.all(v.map((x) => unpack(x, zip, cache)));
  if (isPlainObject(v)) {
    if (typeof v.$blob === 'string' && Object.keys(v).every((k) => k === '$blob' || k === 'type')) {
      if (!cache.has(v.$blob)) {
        const f = zip.file(v.$blob);
        if (!f) throw new BackupError('Este arquivo de cópia está incompleto (falta uma imagem). Tente uma cópia mais nova.');
        cache.set(v.$blob, f.async('blob').then((b) => new Blob([b], { type: v.type || '' })));
      }
      return cache.get(v.$blob);
    }
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = await unpack(x, zip, cache);
    return out;
  }
  return v;
}

const stripScreenOnly = ({ thumbUrl, url, ...r }) => r;

// Quantas coisas tem no aparelho (para mostrar na tela e no aviso do início).
export async function countLocal() {
  const cards = await db.allCards();
  const creations = cards.filter((c) => !isStickerRec(c)).length;
  const stickers = (await db.allStickers()).length;
  const themes = ((await db.getMeta('themes').catch(() => null)) || []).length;
  const folders = ((await db.getMeta('folders').catch(() => null)) || []).length;
  return { creations, sheetStickers: cards.length - creations, stickers, themes, folders, total: cards.length + stickers + themes };
}

export async function lastBackup() {
  return (await db.getMeta(LAST_KEY).catch(() => null)) || null;
}

const two = (n) => String(n).padStart(2, '0');
export const dateText = (ms) => {
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Monta o .zip com tudo. progress(0..1) para a barrinha.
export async function makeBackup({ progress } = {}) {
  await libs('jszip');
  const cards = (await db.allCards()).map(stripScreenOnly);
  const stickers = (await db.allStickers()).map(stripScreenOnly);
  const meta = {};
  for (const key of [...LIST_META, ...PLAIN_META]) {
    const v = await db.getMeta(key).catch(() => undefined);
    if (v !== undefined && v !== null) meta[key] = v;
  }
  const { pack, files } = packer();
  const now = Date.now();
  const manifest = {
    app: APP,
    format: FORMAT,
    createdAt: now,
    counts: {
      creations: cards.filter((c) => !isStickerRec(c)).length,
      stickers: stickers.length,
      themes: (meta.themes || []).length,
      folders: (meta.folders || []).length,
    },
    cards: pack(cards),
    stickers: pack(stickers),
    meta: pack(meta),
  };
  const zip = new window.JSZip();
  zip.file(MANIFEST, JSON.stringify(manifest), { compression: 'DEFLATE' });
  // As imagens já são comprimidas: guarda como estão (mais rápido e não cresce).
  for (const f of files) zip.file(f.name, f.blob, { compression: 'STORE' });
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' }, (m) => progress && progress(m.percent / 100));
  const d = new Date(now);
  const name = `central-elane-copia-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}.zip`;
  return { file: new File([blob], name, { type: 'application/zip' }), counts: manifest.counts, createdAt: now };
}

// Depois que a Elane salvou ou compartilhou o arquivo.
export async function markBackupDone(createdAt, counts) {
  await db.setMeta(LAST_KEY, { at: createdAt, counts }).catch(() => {});
}

// Abre o .zip e confere se é uma cópia da Central (ainda não muda nada no aparelho).
export async function readBackup(file) {
  await libs('jszip');
  let zip;
  try {
    zip = await window.JSZip.loadAsync(file);
  } catch (_) {
    throw new BackupError('Este arquivo não é uma cópia da Central (não consegui abrir o .zip).');
  }
  const entry = zip.file(MANIFEST);
  if (!entry) throw new BackupError('Este arquivo não é uma cópia da Central. Escolha o .zip que começa com “central-elane-copia”.');
  let manifest;
  try {
    manifest = JSON.parse(await entry.async('string'));
  } catch (_) {
    throw new BackupError('A cópia está danificada (não consegui ler a lista do que tem dentro).');
  }
  if (!manifest || manifest.app !== APP) throw new BackupError('Este arquivo é de outro app, não da Central da Elane.');
  if (manifest.format > FORMAT) throw new BackupError('Esta cópia foi feita numa versão mais nova da Central. Atualize o app (recarregue a página) e tente de novo.');
  if (!Array.isArray(manifest.cards) || !Array.isArray(manifest.stickers)) throw new BackupError('A cópia está danificada.');
  return { zip, manifest };
}

const validId = (r) => r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(r.id);

// Põe no aparelho o que ainda não está nele. Devolve quantos entraram e quantos já estavam.
export async function restoreBackup({ zip, manifest }, { progress } = {}) {
  const cache = new Map();
  const haveCards = new Set((await db.allCards()).map((c) => c.id));
  const haveStickers = new Set((await db.allStickers()).map((s) => s.id));
  const res = { creations: 0, stickers: 0, themes: 0, folders: 0, skipped: 0 };
  const cards = manifest.cards.filter(validId);
  const stickers = manifest.stickers.filter(validId);
  const total = cards.length + stickers.length || 1;
  let done = 0;
  const tick = () => progress && progress(++done / total);

  // Primeiro os adesivos (os cards de adesivo na folha apontam para eles).
  for (const raw of stickers) {
    if (haveStickers.has(raw.id)) {
      res.skipped++;
    } else {
      const st = await unpack(raw, zip, cache);
      if (st.blob instanceof Blob) {
        await db.putSticker(st);
        res.stickers++;
      }
    }
    tick();
  }
  const toCloud = [];
  for (const raw of cards) {
    if (haveCards.has(raw.id)) {
      res.skipped++;
    } else {
      const rec = await unpack(raw, zip, cache);
      await db.putCard(rec);
      // Os adesivos postos na folha não vão para a nuvem (como no resto do app).
      if (!isStickerRec(rec)) {
        res.creations++;
        toCloud.push(rec.id);
      }
    }
    tick();
  }

  const meta = isPlainObject(manifest.meta) ? await unpack(manifest.meta, zip, cache) : {};
  for (const key of LIST_META) {
    const incoming = Array.isArray(meta[key]) ? meta[key].filter((x) => x && typeof x.id === 'string') : [];
    if (!incoming.length) continue;
    const mine = (await db.getMeta(key).catch(() => null)) || [];
    const ids = new Set(mine.map((x) => x.id));
    const add = incoming.filter((x) => !ids.has(x.id));
    if (add.length) await db.setMeta(key, [...mine, ...add]);
    res[key] = add.length;
  }
  for (const key of PLAIN_META) {
    if (meta[key] === undefined) continue;
    const mine = await db.getMeta(key).catch(() => undefined);
    if (mine === undefined || mine === null) await db.setMeta(key, meta[key]);
  }

  if (toCloud.length) queueCards(toCloud).catch(() => {});
  return res;
}

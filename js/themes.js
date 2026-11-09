// Temas e kits.
// Um tema guarda as cores, as letras, a estampa e as artes de uma linha de produtos
// (ex.: "Jardim", "Safari", "Festa da Ana"). Com um tema dá para:
//  - aplicar as cores e letras num design que já existe (applyTheme);
//  - gerar o kit inteiro de uma vez (makeKit): bottons, marcadores, capa… já com o nome da cliente.

import { db, newId } from './db.js';
import {
  formatInfo,
  cardSize,
  cellFor,
  newDesign,
  newPhotoLayer,
  newStickerLayer,
  newTextLayer,
  shade,
  luminance,
} from './card.js';
import { renderThumb } from './render.js';
import { ensureFonts } from './fonts.js';
import { canvasToBlob, blobToImage, releaseImage } from './image.js';
import { getFolders, setFolders } from './records.js';

// cores: [principal, destaque, fundo clarinho, texto escuro, extra]
export const PRESET_THEMES = [
  { id: 'p-terracota', name: 'Terracota', colors: ['#b4532f', '#e48b62', '#fbf1e8', '#3a2a24', '#e9b949'], fontTitle: 'pacifico', fontText: 'fredoka', pattern: 'dots', art: [], preset: true },
  { id: 'p-jardim', name: 'Jardim', colors: ['#3d6a55', '#e48b62', '#eef4ec', '#24382e', '#f2c7d0'], fontTitle: 'dancing', fontText: 'nunito', pattern: 'stars', art: [], preset: true },
  { id: 'p-ceu', name: 'Céu', colors: ['#3d6fb4', '#f4b9c8', '#eef4fb', '#22324a', '#ffd36e'], fontTitle: 'fredoka', fontText: 'nunito', pattern: 'grid', art: [], preset: true },
  { id: 'p-festa', name: 'Festa', colors: ['#d9467a', '#7a52d1', '#fff1f6', '#3b1d33', '#ffc93c'], fontTitle: 'bungee', fontText: 'fredoka', pattern: 'hearts', art: [], preset: true },
];

export async function listThemes() {
  const mine = (await db.getMeta('themes').catch(() => null)) || [];
  return [...mine, ...PRESET_THEMES.filter((p) => !mine.some((m) => m.id === p.id))];
}

export async function saveTheme(theme) {
  const mine = (await db.getMeta('themes').catch(() => null)) || [];
  const t = { ...theme, preset: false, id: theme.id && !theme.preset ? theme.id : newId(), updatedAt: Date.now() };
  const i = mine.findIndex((x) => x.id === t.id);
  if (i >= 0) mine[i] = t;
  else mine.unshift(t);
  await db.setMeta('themes', mine);
  return t;
}

export async function deleteTheme(id) {
  const mine = (await db.getMeta('themes').catch(() => null)) || [];
  await db.setMeta('themes', mine.filter((x) => x.id !== id));
}

export function newTheme() {
  return { id: null, name: 'Meu tema', colors: ['#b4532f', '#e48b62', '#fbf1e8', '#3a2a24', '#e9b949'], fontTitle: 'pacifico', fontText: 'fredoka', pattern: 'dots', art: [] };
}

const C = (t) => {
  const [main, accent, light, dark, extra] = t.colors;
  return { main, accent, light, dark, extra, onMain: luminance(main) > 0.6 ? dark : '#ffffff' };
};

const themeBg = (t, c = C(t)) => (t.pattern && t.pattern !== 'none' ? { kind: 'pattern', pattern: t.pattern, color: c.light } : { kind: 'solid', color: c.light });

// ---------- aplicar o tema num design que já existe ----------
// O texto maior ganha a letra de título e a cor principal; os outros, a letra de texto e a cor escura.
// Fundo, moldura e desenhos (corações, estrelas…) ganham as cores do tema. Fotos não mudam.
export function applyTheme(design, theme) {
  const c = C(theme);
  const inks = [c.main, c.accent, c.extra];
  for (const name of ['front', 'back']) {
    const s = design[name];
    if (!s) continue;
    const touched = s.layers.length > 0 || s.bg.kind !== 'solid' || String(s.bg.color).toLowerCase() !== '#ffffff' || s.frame.id !== 'none';
    if (!touched) continue;
    const hasBgPhoto = s.layers.some((l) => l.type === 'photo' && l.cell === -1);
    if (!hasBgPhoto) {
      if (s.bg.kind === 'gradient') s.bg = { kind: 'gradient', id: 'tema', stops: [c.light, shade(c.accent, 0.55)], angle: s.bg.angle || 180 };
      else if (s.bg.kind === 'pattern') s.bg = { kind: 'pattern', pattern: theme.pattern && theme.pattern !== 'none' ? theme.pattern : s.bg.pattern, color: c.light };
      else s.bg = themeBg(theme, c);
    }
    if (s.frame.id !== 'none') s.frame = { ...s.frame, color: s.frame.id === 'polaroid' ? '#ffffff' : c.main };
    const texts = s.layers.filter((l) => l.type === 'text');
    const biggest = texts.reduce((a, l) => (!a || l.size > a.size ? l : a), null);
    let n = 0;
    for (const l of s.layers) {
      if (l.type === 'text') {
        if (l === biggest) {
          l.font = theme.fontTitle;
          l.color = c.main;
          if (l.stroke && l.stroke.color) l.stroke = { ...l.stroke, color: '#ffffff' };
        } else {
          l.font = theme.fontText;
          l.color = c.dark;
        }
      } else if (l.type === 'sticker' && (l.kind === 'shape' || l.kind === 'calendar') && l.color) {
        l.color = inks[n++ % inks.length];
      }
    }
  }
  return design;
}

// ---------- kit ----------
// Produtos que o kit sabe fazer, com quantas cópias vêm marcadas.
export const KIT_PRODUCTS = [
  { format: 'btn32', copies: 10 },
  { format: 'btn44', copies: 6 },
  { format: 'btn58', copies: 4 },
  { format: 'bookmark', copies: 2 },
  { format: 'bookmark20', copies: 0 },
  { format: 'card', copies: 0 },
  { format: 'cover', copies: 0 },
  { format: 'hardcover', copies: 0 },
];

// Monta um design do formato com o tema.
// opts: { title, subtitle, photo: { key, img } | null, art: { key, img } | null }
export function kitDesign(format, theme, opts) {
  const f = formatInfo(format);
  const c = C(theme);
  const d = newDesign('portrait', f.id);
  const s = d.front;
  const { w, h } = cardSize(d);
  const title = (opts.title || '').trim();
  const subtitle = (opts.subtitle || '').trim();
  s.bg = themeBg(theme, c);
  s.layout = '0';
  const T = (props) => newTextLayer({ stroke: { color: null, width: 4 }, ...props });
  const Title = (props) => newTextLayer({ font: theme.fontTitle, color: c.main, stroke: { color: '#ffffff', width: 5 }, ...props });
  const artLayer = (size, props = {}) =>
    opts.art
      ? newStickerLayer({ kind: 'image', name: 'image', imageKey: opts.art.key, iw: opts.art.img.naturalWidth || opts.art.img.width, ih: opts.art.img.naturalHeight || opts.art.img.height, frame: 'none', shadow: false, color: null, size, ...props })
      : null;
  const putPhoto = () => {
    if (!opts.photo) return false;
    s.layout = '1';
    const rect = cellFor(s, d, 0);
    s.layers.push(newPhotoLayer(opts.photo.key, 0, opts.photo.img, rect));
    return true;
  };
  const push = (...ls) => ls.forEach((l) => l && s.layers.push(l));

  if (f.circle) {
    const face = f.face;
    if (opts.photo) {
      s.frame = { id: 'solid', color: c.main };
      putPhoto();
      if (title) push(Title({ text: title, size: face * 0.15, color: '#ffffff', stroke: { color: c.main, width: 6 }, y: face * 0.27 }));
    } else if (opts.art) {
      push(artLayer(face * (title ? 0.42 : 0.7), { y: title ? -face * 0.12 : 0 }));
      if (title) push(Title({ text: title, size: face * (title.length > 9 ? 0.15 : 0.19), y: face * 0.22 }));
    } else {
      push(newStickerLayer({ name: 'sparkle', color: c.extra, size: face * 0.16, x: face * 0.27, y: -face * 0.25 }));
      push(Title({ text: title || 'Nome', size: face * (title.length > 8 ? 0.15 : 0.2), y: subtitle ? -face * 0.05 : 0 }));
      if (subtitle) push(T({ text: subtitle, font: theme.fontText, size: face * 0.1, color: c.dark, y: face * 0.17 }));
    }
    return d;
  }

  if (f.id === 'bookmark' || f.id === 'bookmark20') {
    d.hole = true;
    s.frame = { id: 'stitch', color: c.main };
    push(artLayer(w * 0.62, { y: -h * 0.22 }));
    if (title) push(Title({ text: title, size: Math.min(w * 0.3, (h * 0.5) / Math.max(4, title.length) * 1.6), rotation: -90, y: h * 0.12 }));
    if (subtitle) push(T({ text: subtitle, font: theme.fontText, size: w * 0.12, color: c.dark, y: h * 0.42 }));
    if (!opts.art) push(newStickerLayer({ name: 'heart', color: c.accent, size: w * 0.3, y: -h * 0.3 }));
    return d;
  }

  if (f.id === 'cover' || f.id === 'hardcover') {
    if (putPhoto()) {
      if (title) push(Title({ text: title, size: w * 0.12, y: h * 0.3 }));
      if (subtitle) push(T({ text: subtitle, font: theme.fontText, size: w * 0.055, color: '#ffffff', stroke: { color: c.dark, width: 4 }, y: h * 0.38 }));
      return d;
    }
    push(artLayer(w * 0.45, { y: -h * 0.12 }));
    if (!opts.art) push(newStickerLayer({ name: 'label', color: c.accent, size: w * 0.6, text: 'caderno', y: -h * 0.12 }));
    if (title) push(Title({ text: title, size: w * 0.11, y: h * 0.14 }));
    if (subtitle) push(T({ text: subtitle, font: theme.fontText, size: w * 0.055, color: c.dark, y: h * 0.23 }));
    return d;
  }

  // photo card e outros cartões
  if (putPhoto()) {
    s.frame = { id: 'solid', color: c.main };
    if (title) push(Title({ text: title, size: w * 0.14, y: h * 0.36 }));
    return d;
  }
  push(artLayer(w * 0.6, { y: -h * 0.12 }));
  if (title) push(Title({ text: title, size: w * 0.16, y: h * 0.18 }));
  if (subtitle) push(T({ text: subtitle, font: theme.fontText, size: w * 0.08, color: c.dark, y: h * 0.3 }));
  return d;
}

// Gera o kit e guarda tudo no aparelho (na folha e numa pasta do fichário).
// items: [{ format, copies }]; input: { title, subtitle, photoBlob, artBlob, folderName }
// Devolve os registros criados.
export async function makeKit(theme, items, input, onStep) {
  const images = {};
  const loaded = new Map();
  let photo = null;
  let art = null;
  try {
    if (input.photoBlob) {
      const img = await blobToImage(input.photoBlob);
      loaded.set('kp', img);
      images.kp = input.photoBlob;
      photo = { key: 'kp', img };
    }
    if (input.artBlob) {
      const img = await blobToImage(input.artBlob);
      loaded.set('ka', img);
      images.ka = input.artBlob;
      art = { key: 'ka', img };
    }
    let folder = null;
    if (input.folderName) {
      const folders = await getFolders();
      folder = folders.find((f) => f.name === input.folderName) || { id: newId(), name: input.folderName };
      if (!folders.includes(folder)) await setFolders([...folders, folder]);
    }
    const getImg = (k) => loaded.get(k) || null;
    const out = [];
    let i = 0;
    for (const it of items) {
      if (!it.copies) continue;
      const design = kitDesign(it.format, theme, { title: input.title, subtitle: input.subtitle, photo, art });
      await ensureFonts(design);
      const thumbBlob = await canvasToBlob(renderThumb(design, 'front', getImg), 'image/png');
      const used = {};
      for (const l of design.front.layers) if (l.imageKey && images[l.imageKey]) used[l.imageKey] = images[l.imageKey];
      const rec = {
        v: 2,
        id: newId(),
        createdAt: Date.now() + i,
        copies: it.copies,
        inSheet: true,
        design,
        images: used,
        thumbBlob,
        folder: folder ? folder.id : null,
        kit: { theme: theme.name, title: input.title || '' },
      };
      await db.putCard(rec);
      out.push(rec);
      onStep && onStep(++i);
    }
    return out;
  } finally {
    loaded.forEach((img) => releaseImage(img));
  }
}

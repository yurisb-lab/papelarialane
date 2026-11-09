// Salvar imagens no aparelho: no tablet abre o "Compartilhar" (dá para salvar em Fotos);
// no computador, baixa os arquivos.

import { renderImage } from './render.js';
import { sideHasContent, formatInfo } from './card.js';
import { canvasToBlob } from './image.js';
import { ensureFonts } from './fonts.js';

const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Arquivos PNG (300 dpi) da frente e, se tiver, do verso.
export async function designFiles(design, getImg) {
  await ensureFonts(design);
  const f = formatInfo(design.format);
  const base = `elane-${slug(f.short)}`;
  const out = [];
  const front = await canvasToBlob(renderImage(design, 'front', getImg), 'image/png');
  out.push(new File([front], `${base}-${slug(f.sides[0])}.png`, { type: 'image/png' }));
  if (sideHasContent(design.back)) {
    const back = await canvasToBlob(renderImage(design, 'back', getImg), 'image/png');
    out.push(new File([back], `${base}-${slug(f.sides[1])}.png`, { type: 'image/png' }));
  }
  return out;
}

export const canShareFiles = (files) => !!(navigator.canShare && navigator.share && navigator.canShare({ files }));

// Devolve 'shared', 'downloaded' ou 'cancel'.
export async function shareOrDownload(files, title = 'Central Elane') {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancel';
      // sem permissão (demorou para montar a imagem, por exemplo): baixa
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await new Promise((r) => setTimeout(r, 300));
  }
  return 'downloaded';
}

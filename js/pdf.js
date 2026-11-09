// Monta as folhas A4: bottons, marcadores, cartões, capas e adesivos misturados na mesma folha
// (para gastar menos papel), e pôsteres numa folha só deles.
// Bottons do mesmo tamanho ficam encaixados como colmeia quando isso cabe mais na folha.
// Se alguma coisa tiver verso, a folha ganha uma página de verso logo depois, espelhada,
// para imprimir frente e verso virando o papel pela borda comprida.
//
// Modo Silhouette: a folha ganha margem de 2 cm em volta (lugar das marcas de registro do
// Silhouette Studio) e sai sem pontilhado nem marcas; o corte vai num arquivo à parte (silhouette.js).

import { formatInfo, sideHasContent, HOLE } from './card.js';
import { renderForPrint, roundRectPath } from './render.js';
import { ensureFonts } from './fonts.js';
import { addOutline } from './fx.js';

export const SHEET = {
  pageW: 210, // A4 em mm
  pageH: 297,
  margin: 10, // mm nas laterais
  top: 10,
  bottom: 15, // rodapé com a régua
  gap: 5, // mm entre uma coisa e outra, onde ficam as marcas de corte
  stickerGap: 2.5, // entre dois adesivos basta menos
  circleGap: 2, // entre dois bottons (corte redondo, sem marcas)
  markOffset: 1.5, // mm de folga entre o card e a marca
  markLength: 2, // mm
  backBleed: 1, // mm: o verso sai um pouco maior, para não sobrar branco se a impressora deslocar
};

// Silhouette: as marcas de registro do Studio ficam nas beiradas; nada pode encostar nelas.
export const SILHOUETTE_MARGIN = 20; // mm

export const STICKER_BORDER = 1.6; // mm de borda branca em volta do adesivo impresso
export const STICKER_MARGIN = 2.2; // mm entre o desenho e a beira da caixa (borda + linha de corte)

// Área útil da folha (mm).
export function sheetArea(opts = {}) {
  if (opts.silhouette) {
    const m = SILHOUETTE_MARGIN;
    return { left: m, top: m, W: SHEET.pageW - 2 * m, H: SHEET.pageH - 2 * m };
  }
  return { left: SHEET.margin, top: SHEET.top, W: SHEET.pageW - 2 * SHEET.margin, H: SHEET.pageH - SHEET.top - SHEET.bottom };
}

export const isSticker = (rec) => rec.kind === 'sticker';
export const hasBack = (rec) =>
  !isSticker(rec) && !!rec.design && !formatInfo(rec.design.format).noBack && sideHasContent(rec.design.back);
export const isPoster = (rec) => !isSticker(rec) && formatInfo(rec.design && rec.design.format).id === 'poster';

// Tamanho do desenho de um adesivo impresso (mm): sizeMm é o lado maior.
export function stickerDims(rec) {
  const a = rec.sticker.aspect || 1;
  const s = rec.sticker.sizeMm || 50;
  return a >= 1 ? { w: s, h: s / a } : { w: s * a, h: s };
}

// Tamanho na folha (mm), sempre do jeito que sai impresso (cards deitados saem em pé).
export function printSize(rec) {
  if (isSticker(rec)) {
    const { w, h } = stickerDims(rec);
    return { w: w + 2 * STICKER_MARGIN, h: h + 2 * STICKER_MARGIN, sticker: true };
  }
  const f = formatInfo(rec.design.format);
  if (f.id === 'poster') return { w: SHEET.pageW, h: SHEET.pageH, full: true };
  if (f.id === 'folded') return { w: f.w * 2, h: f.h, folded: true };
  if (f.circle) return { w: f.w, h: f.h, circle: true };
  return { w: f.w, h: f.h };
}

const gapX = (a, b) => (a.sticker && b.sticker ? SHEET.stickerGap : SHEET.gap);
const rowGap = (row, it) => (row.fixed ? SHEET.gap : it.sticker && row.items.every((x) => x.sticker) ? SHEET.stickerGap : SHEET.gap);

// Quantos bottons de corte d cabem numa folha, e de que jeito (colmeia ou fileiras retas).
export function circlePlan(d, area) {
  const g = SHEET.circleGap;
  const p = d + g;
  const nE = Math.max(1, Math.floor((area.W + g) / p));
  const nO = Math.max(1, Math.floor((area.W - p / 2 + g) / p));
  const vHex = (p * Math.sqrt(3)) / 2;
  const rowsFit = (v) => Math.max(1, 1 + Math.floor((area.H - d) / v + 1e-9));
  const rh = rowsFit(vHex);
  const hexPer = Math.ceil(rh / 2) * nE + Math.floor(rh / 2) * nO;
  const sqPer = rowsFit(p) * nE;
  const hex = hexPer > sqPer;
  const fullW = nE * p - g + (hex && nO === nE ? p / 2 : 0);
  return { hex, p, nE, nO: hex ? nO : nE, v: hex ? vHex : p, fullW, perPage: hex ? hexPer : sqPer };
}

// Distribui tudo (já repetido pelo número de cópias) em folhas.
// Devolve [{ full, items: [{ rec, x, y, w, h, folded, sticker, circle }] }].
export function layoutSheet(records, opts = {}) {
  const area = sheetArea(opts);
  const items = [];
  records.forEach((rec, order) => {
    const size = printSize(rec);
    for (let i = 0; i < (rec.copies || 1); i++) items.push({ rec, order, ...size });
  });
  const pages = [];
  const newPage = () => {
    const pg = { rows: [], used: 0, lastTop: 0 };
    pages.push(pg);
    return pg;
  };

  // 1) bottons: os maiores primeiro, cada tamanho em fileiras (ou colmeia) só dele
  const circles = items.filter((i) => i.circle).sort((a, b) => b.w - a.w || a.order - b.order);
  let i = 0;
  while (i < circles.length) {
    const d = circles[i].w;
    let j = i;
    while (j < circles.length && circles[j].w === d) j++;
    const group = circles.slice(i, j);
    i = j;
    const plan = circlePlan(d, area);
    let pg = pages[pages.length - 1] || newPage();
    let k = 0;
    let rowNo = 0;
    while (k < group.length) {
      let top = rowNo === 0 ? (pg.rows.length ? pg.used + SHEET.gap : 0) : pg.lastTop + plan.v;
      if (top + d > area.H + 1e-6) {
        pg = newPage();
        top = 0;
        rowNo = 0;
      }
      const odd = plan.hex && rowNo % 2 === 1;
      const n = odd ? plan.nO : plan.nE;
      const x0 = (area.W - plan.fullW) / 2 + (odd ? plan.p / 2 : 0);
      pg.rows.push({ fixed: true, top, h: d, items: group.slice(k, k + n), x0, pitch: plan.p });
      k += n;
      pg.lastTop = top;
      pg.used = top + d;
      rowNo++;
    }
  }

  // 2) o resto: cada coisa no fim de uma fileira que já existe, ou numa fileira nova
  const rest = items.filter((it) => !it.full && !it.circle).sort((a, b) => b.h - a.h || a.order - b.order);
  for (const it of rest) {
    let placed = false;
    for (const pg of pages) {
      for (const row of pg.rows) {
        if (row.fixed) continue;
        const need = row.w + gapX(row.items[row.items.length - 1], it) + it.w;
        if (it.h <= row.h && need <= area.W) {
          row.items.push(it);
          row.w = need;
          placed = true;
          break;
        }
      }
      if (placed) break;
      const last = pg.rows[pg.rows.length - 1];
      const top = last ? pg.used + rowGap(last, it) : 0;
      if (top + it.h <= area.H) {
        pg.rows.push({ items: [it], w: it.w, h: it.h, top });
        pg.used = top + it.h;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const pg = newPage();
      pg.rows.push({ items: [it], w: it.w, h: it.h, top: 0 });
      pg.used = it.h;
    }
  }

  const out = pages.map((pg) => {
    const list = [];
    const y0 = area.top + (area.H - pg.used) / 2;
    for (const row of pg.rows) {
      const y = y0 + row.top;
      if (row.fixed) {
        row.items.forEach((it, n) => list.push({ rec: it.rec, x: area.left + row.x0 + n * row.pitch, y, w: it.w, h: it.h, circle: true }));
        continue;
      }
      let x = area.left + (area.W - row.w) / 2;
      row.items.forEach((it, n) => {
        if (n > 0) x += gapX(row.items[n - 1], it);
        list.push({ rec: it.rec, x, y, w: it.w, h: it.h, folded: !!it.folded, sticker: !!it.sticker });
        x += it.w;
      });
    }
    return { full: false, items: list };
  });
  for (const it of items.filter((x) => x.full)) {
    out.push({ full: true, items: [{ rec: it.rec, x: 0, y: 0, w: SHEET.pageW, h: SHEET.pageH, full: true }] });
  }
  return out;
}

// Onde vai o verso (na página de verso, que é espelhada).
// No cartão dobrável, a parte de dentro fica atrás da metade esquerda (a contracapa),
// e assim aparece do lado direito quando o cartão abre.
export function backRect(item) {
  const b = SHEET.backBleed;
  if (item.full) return { x: 0, y: 0, w: item.w, h: item.h, bleed: 0 };
  if (item.folded) {
    const pw = item.w / 2;
    return { x: SHEET.pageW - item.x - pw - b, y: item.y - b, w: pw + 2 * b, h: item.h + 2 * b, bleed: b };
  }
  return { x: SHEET.pageW - item.x - item.w - b, y: item.y - b, w: item.w + 2 * b, h: item.h + 2 * b, bleed: b };
}

// Linhas de corte de uma coisa na folha (mm): o contorno e, no marcador, o furo.
// [{ kind: 'rect', x, y, w, h, r } | { kind: 'circle', cx, cy, r }]
export function cutShapes(it) {
  if (it.sticker) return [];
  const f = formatInfo(it.rec.design.format);
  if (it.full) return [];
  if (it.circle) return [{ kind: 'circle', cx: it.x + it.w / 2, cy: it.y + it.h / 2, r: it.w / 2 }];
  const list = [{ kind: 'rect', x: it.x, y: it.y, w: it.w, h: it.h, r: it.folded ? 0 : f.radius || 0 }];
  if (f.hole && it.rec.design.hole) list.push({ kind: 'circle', cx: it.x + it.w / 2, cy: it.y + HOLE.top + HOLE.d / 2, r: HOLE.d / 2 });
  return list;
}

// Adesivo pronto para imprimir: o desenho com borda branca e uma linha cinza fininha para recortar.
export function renderStickerPrint(img, rec, pxPerMm = 300 / 25.4, { line = true } = {}) {
  const { w, h } = printSize(rec);
  const out = document.createElement('canvas');
  out.width = Math.round(w * pxPerMm);
  out.height = Math.round(h * pxPerMm);
  const dims = stickerDims(rec);
  const innerW = dims.w * pxPerMm;
  const innerH = dims.h * pxPerMm;
  const base = document.createElement('canvas');
  base.width = Math.max(1, Math.round(innerW));
  base.height = Math.max(1, Math.round(innerH));
  const bctx = base.getContext('2d');
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(img, 0, 0, base.width, base.height);
  const white = addOutline(base, STICKER_BORDER * pxPerMm, '#ffffff');
  const top = line ? addOutline(white.canvas, Math.max(1, 0.18 * pxPerMm), '#a99aa4') : { canvas: white.canvas, pad: 0 };
  const pad = white.pad + top.pad;
  const octx = out.getContext('2d');
  octx.drawImage(top.canvas, (out.width - base.width) / 2 - pad, (out.height - base.height) / 2 - pad);
  return out;
}

let jsPdfPromise = null;
export function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
      s.onload = () => resolve(window.jspdf);
      s.onerror = () => {
        jsPdfPromise = null;
        reject(new Error('Não consegui carregar o gerador de PDF.'));
      };
      document.head.appendChild(s);
    });
  }
  return jsPdfPromise;
}

// ---------- desenho da folha ----------
// O mesmo desenho serve para o PDF, para a imagem JPG e para o kit da Silhouette: "out" sabe desenhar em cada um.
// out = { page(), image(key, getCanvas, type, x, y, w, h), line(x1, y1, x2, y2, dash), cut(shape), text(s, x, y, size, gray, align) }

function cropMarks(out, x, y, w, h) {
  const o = SHEET.markOffset;
  const l = SHEET.markLength;
  const lines = [
    // canto superior esquerdo
    [x - o - l, y, x - o, y], [x, y - o - l, x, y - o],
    // canto superior direito
    [x + w + o, y, x + w + o + l, y], [x + w, y - o - l, x + w, y - o],
    // canto inferior esquerdo
    [x - o - l, y + h, x - o, y + h], [x, y + h + o, x, y + h + o + l],
    // canto inferior direito
    [x + w + o, y + h, x + w + o + l, y + h], [x + w, y + h + o, x + w, y + h + o + l],
  ];
  for (const [x1, y1, x2, y2] of lines) out.line(x1, y1, x2, y2);
}

function ruler(out, x, y) {
  // Régua de 5 cm para conferir se a impressora não mudou o tamanho.
  out.line(x, y, x + 50, y, null, 90);
  for (let i = 0; i <= 50; i += 5) out.line(x + i, y, x + i, y - (i % 10 === 0 ? 2.2 : 1.2), null, 90);
  out.text('5 cm', x + 52, y, 6.5, 90, 'left');
}

async function paintSheet(out, records, { cutLine: withCutLine = true, onProgress, silhouette = false } = {}) {
  await ensureFonts(records.filter((r) => !isSticker(r)).map((r) => r.design));
  const pages = layoutSheet(records, { silhouette });
  const uniq = new Set();
  for (const pg of pages) {
    for (const it of pg.items) {
      uniq.add('f' + it.rec.id);
      if (!silhouette && hasBack(it.rec)) uniq.add('b' + it.rec.id);
    }
  }
  const total = uniq.size || 1;
  const seen = new Set();
  const anyBack = !silhouette && records.some(hasBack);

  // Desenha (e guarda) cada card uma vez só, mesmo com várias cópias.
  async function image(rec, sideName, bleed, x, y, w, h) {
    const key = `${sideName}-${rec.id}`;
    const make = () =>
      isSticker(rec)
        ? rec.getImg('s') && renderStickerPrint(rec.getImg('s'), rec, undefined, { line: !silhouette })
        : renderForPrint(rec.design, sideName, rec.getImg, { bleed });
    const png = isSticker(rec) || formatInfo(rec.design.format).circle;
    await out.image(key, make, png ? 'PNG' : 'JPEG', x, y, w, h);
    if (!seen.has(key)) {
      seen.add(key);
      onProgress && onProgress(seen.size / total);
      await new Promise((r) => setTimeout(r, 0)); // deixa a tela respirar no tablet
    }
  }

  const normalPages = pages.filter((p) => !p.full).length;
  let sheetNo = 0;
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    await out.page({ name: page.full ? `poster-${p + 1}` : `folha-${sheetNo + 1}` });

    if (page.full) {
      await image(page.items[0].rec, 'front', 0, 0, 0, SHEET.pageW, SHEET.pageH);
    } else {
      sheetNo++;
      for (const it of page.items) {
        if (it.sticker) {
          await image(it.rec, 'front', 0, it.x, it.y, it.w, it.h);
          continue;
        }
        if (it.folded) {
          const pw = it.w / 2;
          await image(it.rec, 'front', 0, it.x + pw, it.y, pw, it.h);
        } else {
          await image(it.rec, 'front', 0, it.x, it.y, it.w, it.h);
        }
        for (const sh of cutShapes(it)) out.cut(sh, silhouette ? 'silhouette' : withCutLine || sh.kind === 'circle' ? 'dotted' : 'none');
      }
      if (!silhouette) {
        for (const it of page.items) {
          if (it.sticker || it.circle) continue;
          cropMarks(out, it.x, it.y, it.w, it.h);
          if (it.folded) {
            // marquinhas da dobra, em cima e embaixo, por fora do cartão
            const mx = it.x + it.w / 2;
            out.line(mx, it.y - SHEET.markOffset - SHEET.markLength, mx, it.y - SHEET.markOffset, [0.6, 0.6]);
            out.line(mx, it.y + it.h + SHEET.markOffset, mx, it.y + it.h + SHEET.markOffset + SHEET.markLength, [0.6, 0.6]);
          }
        }
        const footerY = SHEET.pageH - 6;
        ruler(out, 14, footerY);
        out.text(
          `Central de Criação Elane  ·  folha ${sheetNo} de ${normalPages}${anyBack ? ' (frente)' : ''}  ·  imprima em tamanho real (100%)`,
          SHEET.pageW - 14,
          footerY,
          7,
          120,
          'right'
        );
      }
    }

    // Verso: mesma folha, espelhada da esquerda para a direita.
    const backs = silhouette ? [] : page.items.filter((it) => hasBack(it.rec));
    if (backs.length) {
      await out.page({ name: page.full ? `poster-${p + 1}-verso` : `folha-${sheetNo}-verso`, back: true });
      for (const it of backs) {
        const r = backRect(it);
        await image(it.rec, 'back', r.bleed, r.x, r.y, r.w, r.h);
      }
      if (!page.full) out.text(`Verso da folha ${sheetNo}  ·  vire o papel pela borda comprida`, SHEET.pageW / 2, SHEET.pageH - 6, 7, 120, 'center');
    }
  }
  await out.finish();
}

// Desenhista de folha em canvas (JPG e kit Silhouette). onPage(canvas, info) recebe cada página pronta.
function canvasPainter(onPage, { cuts = null } = {}) {
  const k = 300 / 25.4; // pixels por mm
  const cache = new Map();
  let canvas = null;
  let ctx = null;
  let info = null;
  let pageCuts = null;
  async function flush() {
    if (!canvas) return;
    await onPage(canvas, info, pageCuts);
    canvas.width = canvas.height = 0; // solta a memória (importante no tablet)
    canvas = null;
  }
  return {
    async page(i) {
      await flush();
      info = i;
      pageCuts = [];
      if (cuts) cuts.push(pageCuts);
      canvas = document.createElement('canvas');
      canvas.width = Math.round(SHEET.pageW * k);
      canvas.height = Math.round(SHEET.pageH * k);
      ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(k, k);
      ctx.imageSmoothingQuality = 'high';
    },
    image(key, make, type, x, y, w, h) {
      if (!cache.has(key)) cache.set(key, make() || null);
      const c = cache.get(key);
      if (c) ctx.drawImage(c, x, y, w, h);
    },
    line(x1, y1, x2, y2, dash, gray = 0) {
      ctx.save();
      ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
      ctx.lineWidth = gray ? 0.25 : 0.2;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    },
    cut(sh, mode) {
      if (mode === 'silhouette') return pageCuts.push(sh);
      if (mode !== 'dotted') return;
      const o = 0.12;
      ctx.save();
      ctx.strokeStyle = 'rgb(150,150,150)';
      ctx.lineWidth = 0.2;
      ctx.setLineDash([0.9, 0.7]);
      if (sh.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(sh.cx, sh.cy, sh.r + o, 0, Math.PI * 2);
      } else roundRectPath(ctx, sh.x - o, sh.y - o, sh.w + 2 * o, sh.h + 2 * o, sh.r > 0 ? sh.r + o : 0);
      ctx.stroke();
      ctx.restore();
    },
    text(str, x, y, size, gray, align) {
      ctx.save();
      ctx.font = `${(size * 25.4) / 72}px Nunito, Helvetica, Arial, sans-serif`;
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
      ctx.restore();
    },
    finish: flush,
  };
}

// records: [{ id, copies, design | sticker, getImg }]; options: { cutLine, onProgress, silhouette }
export async function buildPdf(records, opts = {}) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const data = new Map();
  let first = true;
  await paintSheet(
    {
      page() {
        if (!first) doc.addPage('a4', 'portrait');
        first = false;
      },
      image(key, make, type, x, y, w, h) {
        if (!data.has(key)) {
          const c = make();
          data.set(key, c ? c.toDataURL(type === 'PNG' ? 'image/png' : 'image/jpeg', 0.92) : null);
        }
        // O apelido faz o PDF guardar a imagem uma vez só, mesmo com várias cópias.
        if (data.get(key)) doc.addImage(data.get(key), type, x, y, w, h, 'img-' + key, 'NONE');
      },
      line(x1, y1, x2, y2, dash, gray = 0) {
        doc.setDrawColor(gray);
        doc.setLineWidth(gray ? 0.25 : 0.2);
        if (dash) doc.setLineDashPattern(dash, 0);
        doc.line(x1, y1, x2, y2);
        if (dash) doc.setLineDashPattern([], 0);
      },
      // Pontilhado bem rente ao card, por fora: cortando por ele, não sobra linha no card.
      cut(sh, mode) {
        if (mode !== 'dotted') return;
        const o = 0.12;
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([0.9, 0.7], 0);
        if (sh.kind === 'circle') doc.circle(sh.cx, sh.cy, sh.r + o, 'S');
        else if (sh.r > 0) doc.roundedRect(sh.x - o, sh.y - o, sh.w + 2 * o, sh.h + 2 * o, sh.r + o, sh.r + o, 'S');
        else doc.rect(sh.x - o, sh.y - o, sh.w + 2 * o, sh.h + 2 * o, 'S');
        doc.setLineDashPattern([], 0);
      },
      text(str, x, y, size, gray, align) {
        doc.setFontSize(size);
        doc.setTextColor(gray);
        doc.text(str, x, y, { align });
      },
      finish() {},
    },
    records,
    opts
  );
  return doc;
}

// A mesma folha como imagens JPG (uma por página), em 300 dpi: [File]
export async function buildSheetImages(records, opts = {}) {
  const files = [];
  await paintSheet(
    canvasPainter(async (canvas, info) => {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      files.push(new File([blob], `${info.name}.jpg`, { type: 'image/jpeg' }));
    }),
    records,
    opts
  );
  return files;
}

// Kit Silhouette: cada folha como PNG (só a arte, com a margem das marcas) e as linhas de corte.
// Devolve [{ name, png: Blob, cuts: [shape] }]
export async function buildSilhouettePages(records, opts = {}) {
  const pages = [];
  await paintSheet(
    canvasPainter(async (canvas, info, cuts) => {
      const png = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      pages.push({ name: info.name, png, cuts });
    }),
    records,
    { ...opts, silhouette: true, cutLine: false }
  );
  return pages;
}

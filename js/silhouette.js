// Kit para a Silhouette Cameo (imprimir e cortar).
// Para cada folha saem três arquivos:
//  - .svg  (Silhouette Studio Designer ou superior): a arte e as linhas de corte juntas, em A4.
//  - .png  a arte da folha inteira (A4, 300 dpi), para o Studio Basic.
//  - .dxf  só as linhas de corte (Studio Basic: "Mesclar" por cima da arte).
// A arte deixa 2 cm livres em volta para as marcas de registro que o próprio Studio imprime.

import { SHEET, SILHOUETTE_MARGIN, buildSilhouettePages } from './pdf.js';

const r2 = (n) => Math.round(n * 1000) / 1000;

// Caixa que envolve todas as linhas de corte (para posicionar no Studio Basic).
export function cutsBox(cuts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of cuts) {
    const b = s.kind === 'circle' ? { x: s.cx - s.r, y: s.cy - s.r, w: 2 * s.r, h: 2 * s.r } : s;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  if (!isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function svgShape(s) {
  if (s.kind === 'circle') return `<circle cx="${r2(s.cx)}" cy="${r2(s.cy)}" r="${r2(s.r)}"/>`;
  const rr = s.r > 0 ? ` rx="${r2(s.r)}" ry="${r2(s.r)}"` : '';
  return `<rect x="${r2(s.x)}" y="${r2(s.y)}" width="${r2(s.w)}" height="${r2(s.h)}"${rr}/>`;
}

export function makeSvg(dataUrl, cuts) {
  const W = SHEET.pageW;
  const H = SHEET.pageH;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <title>Central de Criação Elane · imprimir e cortar</title>
  <g id="arte">
    <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" xlink:href="${dataUrl}" href="${dataUrl}"/>
  </g>
  <g id="corte" fill="none" stroke="#ff0000" stroke-width="0.25">
    ${cuts.map(svgShape).join('\n    ')}
  </g>
</svg>
`;
}

// Contorno de um retângulo de cantos redondos como lista de pontos (mm), cada canto em 10 pedacinhos.
function roundRectPoints(s) {
  const r = Math.max(0, Math.min(s.r || 0, s.w / 2, s.h / 2));
  if (!r) return [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
  const pts = [];
  const corners = [
    [s.x + s.w - r, s.y + r, -90],
    [s.x + s.w - r, s.y + s.h - r, 0],
    [s.x + r, s.y + s.h - r, 90],
    [s.x + r, s.y + r, 180],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 10; i++) {
      const a = ((a0 + (i * 90) / 10) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

// DXF R12 bem simples, em milímetros, com o canto de baixo à esquerda da folha A4 no zero.
export function makeDxf(cuts) {
  const H = SHEET.pageH;
  const L = [];
  const add = (...a) => L.push(...a.map(String));
  add('0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '9', '$MEASUREMENT', '70', '1', '0', 'ENDSEC');
  add('0', 'SECTION', '2', 'ENTITIES');
  for (const s of cuts) {
    if (s.kind === 'circle') {
      add('0', 'CIRCLE', '8', 'CORTE', '10', r2(s.cx), '20', r2(H - s.cy), '30', '0', '40', r2(s.r));
    } else {
      add('0', 'POLYLINE', '8', 'CORTE', '66', '1', '70', '1', '10', '0', '20', '0', '30', '0');
      for (const [x, y] of roundRectPoints(s)) add('0', 'VERTEX', '8', 'CORTE', '10', r2(x), '20', r2(H - y), '30', '0');
      add('0', 'SEQEND', '8', 'CORTE');
    }
  }
  add('0', 'ENDSEC', '0', 'EOF');
  return L.join('\r\n') + '\r\n';
}

// [{ files: [File], box, count, name }]
export async function buildSilhouetteKit(records, opts = {}) {
  const pages = await buildSilhouettePages(records, opts);
  const out = [];
  let n = 0;
  for (const pg of pages) {
    n++;
    const base = pages.length > 1 ? `elane-silhouette-folha-${n}` : 'elane-silhouette';
    const dataUrl = await blobToDataUrl(pg.png);
    const files = [
      new File([makeSvg(dataUrl, pg.cuts)], `${base}.svg`, { type: 'image/svg+xml' }),
      new File([pg.png], `${base}-arte.png`, { type: 'image/png' }),
    ];
    if (pg.cuts.length) files.push(new File([makeDxf(pg.cuts)], `${base}-corte.dxf`, { type: 'application/dxf' }));
    out.push({ name: base, files, box: cutsBox(pg.cuts), count: pg.cuts.length });
  }
  return out;
}

export const MARGIN_CM = SILHOUETTE_MARGIN / 10;

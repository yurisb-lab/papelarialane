// Miolo de caderno A5 (148 × 210 mm) para encadernar com wire-o.
//
// Cada folha A5 tem frente e verso. A margem do wire-o fica do lado esquerdo na frente
// e do lado direito no verso (é o mesmo lado do papel).
//
// Impressão: A4 em pé, frente e verso virando pela BORDA LONGA (o padrão das impressoras).
// Cada A4 leva duas folhas A5 deitadas, uma em cima da outra; depois é só cortar ao meio.
//   frente da A4: o topo da folha A5 aponta para a direita (girada 90° no sentido do relógio);
//   verso da A4:  o topo aponta para a esquerda (girada ao contrário),
//   assim, depois de cortar, frente e verso de cada folha ficam do mesmo jeito.
// Nos dois lados, a margem do wire-o cai na beirada de cima de cada metade.
// Tudo é desenhado em linhas (vetor): o PDF fica leve e as linhas saem bem fininhas.

import { loadJsPdf } from './pdf.js';
import { hexToRgb } from './card.js';

export const A5 = { w: 148, h: 210 };
const HALF = 297 / 2; // altura de cada metade da A4

export const PAGE_TYPES = [
  { id: 'lined', name: 'Pautado' },
  { id: 'dots', name: 'Pontilhado' },
  { id: 'grid', name: 'Quadriculado' },
  { id: 'blank', name: 'Liso' },
  { id: 'todo', name: 'Lista de tarefas' },
  { id: 'week', name: 'Semana (sem data)' },
];

export const pageTypeInfo = (id) => PAGE_TYPES.find((p) => p.id === id) || PAGE_TYPES[0];

export function defaultSpec() {
  return {
    bind: 12, // mm de margem para os furos do wire-o
    spacing: 7, // mm entre as linhas do pautado (pontilhado e quadriculado usam 5)
    color: '#b9aea6',
    accent: '#b4532f',
    header: true, // linha de data no alto
    numbers: false, // número da página
    sections: [{ type: 'lined', leaves: 40 }],
  };
}

export const totalLeaves = (spec) => spec.sections.reduce((n, s) => n + Math.max(0, s.leaves | 0), 0);

// Lista das folhas na ordem: [{ type, index (dentro da seção) }]
function leafList(spec) {
  const out = [];
  for (const s of spec.sections) for (let i = 0; i < (s.leaves | 0); i++) out.push({ type: s.type, index: i });
  return out;
}

const DAYS_FRONT = ['Segunda', 'Terça', 'Quarta', 'Quinta'];
const DAYS_BACK = ['Sexta', 'Sábado', 'Domingo', 'Notas'];

// Desenha uma página A5 em pé. p = { line, dot, rect, text } em mm, com (0,0) no canto de cima à esquerda.
// side = 'front' | 'back'; pageNo começa em 1.
export function drawLeafPage(p, spec, type, side, pageNo) {
  const bind = spec.bind;
  const outer = 8;
  const L = side === 'front' ? bind : outer;
  const R = A5.w - (side === 'front' ? outer : bind);
  const top = spec.header ? 22 : 13;
  const bottom = A5.h - 11;
  const c = spec.color;
  const a = spec.accent;

  if (spec.header && type !== 'week') {
    const y = 15;
    p.text('Data:', R - 38, y, 8, a, 'left');
    p.line(R - 29, y + 0.8, R, y + 0.8, c, 0.25);
    p.line(L, y + 0.8, R - 44, y + 0.8, c, 0.25);
  }

  if (type === 'lined') {
    const s = spec.spacing;
    for (let y = top + s; y <= bottom + 0.01; y += s) p.line(L, y, R, y, c, 0.2);
  } else if (type === 'dots') {
    const s = 5;
    const cols = Math.floor((R - L) / s);
    const x0 = L + (R - L - cols * s) / 2;
    for (let y = top + s; y <= bottom + 0.01; y += s) for (let i = 0; i <= cols; i++) p.dot(x0 + i * s, y, 0.28, c);
  } else if (type === 'grid') {
    const s = 5;
    const cols = Math.floor((R - L) / s);
    const rows = Math.floor((bottom - top) / s);
    const x0 = L + (R - L - cols * s) / 2;
    const y0 = top + (bottom - top - rows * s) / 2;
    for (let i = 0; i <= cols; i++) p.line(x0 + i * s, y0, x0 + i * s, y0 + rows * s, c, 0.15);
    for (let j = 0; j <= rows; j++) p.line(x0, y0 + j * s, x0 + cols * s, y0 + j * s, c, 0.15);
  } else if (type === 'todo') {
    const s = 8;
    p.text('Para fazer', L, top - 1, 11, a, 'left');
    for (let y = top + s; y <= bottom + 0.01; y += s) {
      p.rect(L, y - 4, 3.6, 3.6, a, 0.3, 0.6);
      p.line(L + 6, y, R, y, c, 0.2);
    }
  } else if (type === 'week') {
    const days = side === 'front' ? DAYS_FRONT : DAYS_BACK;
    const t = 12;
    if (side === 'front') {
      p.text('Semana de', L, t + 2, 9, a, 'left');
      p.line(L + 18, t + 2.8, R, t + 2.8, c, 0.25);
    }
    const y0 = t + 7;
    const bh = (bottom - y0) / 4;
    days.forEach((d, i) => {
      const y = y0 + i * bh;
      p.rect(L, y, R - L, bh - 2.5, c, 0.3, 2);
      p.text(d, L + 3, y + 6, 10, a, 'left');
      for (let ly = y + 13; ly < y + bh - 5; ly += 7) p.line(L + 3, ly, R - 3, ly, c, 0.18);
    });
  }

  if (spec.numbers) p.text(String(pageNo), side === 'front' ? R : L, A5.h - 5, 7, c, side === 'front' ? 'right' : 'left');
}

// Desenhista em canvas (prévia), página em pé.
export function canvasPainter(ctx, k) {
  return {
    line(x1, y1, x2, y2, color, w) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.6, w * k);
      ctx.beginPath();
      ctx.moveTo(x1 * k, y1 * k);
      ctx.lineTo(x2 * k, y2 * k);
      ctx.stroke();
    },
    dot(x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * k, y * k, Math.max(0.7, r * k), 0, Math.PI * 2);
      ctx.fill();
    },
    rect(x, y, w, h, color, lw, r = 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.6, lw * k);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x * k, y * k, w * k, h * k, r * k);
      else ctx.rect(x * k, y * k, w * k, h * k);
      ctx.stroke();
    },
    text(str, x, y, size, color, align) {
      ctx.fillStyle = color;
      ctx.font = `700 ${(size * 25.4 * k) / 72}px Nunito, Helvetica, Arial, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x * k, y * k);
    },
  };
}

export function renderLeafPreview(spec, type, side, pageNo, width = 300) {
  const k = width / A5.w;
  const c = document.createElement('canvas');
  c.width = Math.round(A5.w * k);
  c.height = Math.round(A5.h * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  // margem do wire-o, só na prévia: furinhos
  ctx.fillStyle = '#efe7e1';
  const hx = side === 'front' ? 5 : A5.w - 5;
  for (let y = 10; y < A5.h - 6; y += 8.47) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect((hx - 2) * k, y * k, 4 * k, 4 * k, 0.8 * k) : ctx.rect((hx - 2) * k, y * k, 4 * k, 4 * k);
    ctx.fill();
  }
  drawLeafPage(canvasPainter(ctx, k), spec, type, side, pageNo);
  return c;
}

// Desenhista no PDF: leva a página A5 (em pé) para a metade da A4, já girada.
function pdfPainter(doc, slot, side) {
  // slot 0 = metade de cima, 1 = metade de baixo
  const y0 = slot * HALF + (HALF - A5.w) / 2;
  const x0 = (210 - A5.h) / 2;
  const map =
    side === 'front'
      ? (u, v) => [x0 + A5.h - v, y0 + u] // topo da página para a direita
      : (u, v) => [x0 + v, y0 + A5.w - u]; // topo da página para a esquerda
  const rgb = (hex) => hexToRgb(hex);
  return {
    line(x1, y1, x2, y2, color, w) {
      const [a, b] = map(x1, y1);
      const [c, d] = map(x2, y2);
      doc.setDrawColor(...rgb(color));
      doc.setLineWidth(w);
      doc.line(a, b, c, d);
    },
    dot(x, y, r, color) {
      const [a, b] = map(x, y);
      doc.setFillColor(...rgb(color));
      doc.circle(a, b, r, 'F');
    },
    rect(x, y, w, h, color, lw, r = 0) {
      // retângulo girado continua retângulo: basta achar os dois cantos
      const [a, b] = map(x, y);
      const [c, d] = map(x + w, y + h);
      doc.setDrawColor(...rgb(color));
      doc.setLineWidth(lw);
      const rx = Math.min(a, c);
      const ry = Math.min(b, d);
      const rw = Math.abs(c - a);
      const rh = Math.abs(d - b);
      if (r > 0) doc.roundedRect(rx, ry, rw, rh, r, r, 'S');
      else doc.rect(rx, ry, rw, rh, 'S');
    },
    text(str, x, y, size, color, align) {
      doc.setFontSize(size);
      doc.setTextColor(...rgb(color));
      const tw = doc.getTextWidth(str);
      const sx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
      const [a, b] = map(sx, y);
      doc.text(str, a, b, { angle: side === 'front' ? -90 : 90 });
    },
  };
}

// Marquinhas do corte no meio da A4 (bem na linha: somem quando corta).
function cutTicks(doc) {
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  doc.line(6, HALF, 16, HALF);
  doc.line(194, HALF, 204, HALF);
}

// PDF do miolo inteiro. Devolve { doc, sheets, leaves }.
export async function buildNotebookPdf(spec, onProgress) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setFont('helvetica', 'bold');
  const leaves = leafList(spec);
  const sheets = Math.ceil(leaves.length / 2);
  for (let s = 0; s < sheets; s++) {
    const pair = leaves.slice(s * 2, s * 2 + 2);
    for (const side of ['front', 'back']) {
      if (s > 0 || side === 'back') doc.addPage('a4', 'portrait');
      pair.forEach((leaf, slot) => {
        const n = (s * 2 + slot) * 2 + (side === 'front' ? 1 : 2);
        drawLeafPage(pdfPainter(doc, slot, side), spec, leaf.type, side, n);
      });
      if (side === 'front' && pair.length === 2) cutTicks(doc);
    }
    onProgress && onProgress((s + 1) / sheets);
    if (s % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  return { doc, sheets, leaves: leaves.length };
}

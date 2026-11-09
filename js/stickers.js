// Adesivos: desenhos feitos aqui mesmo (ficam lisinhos em qualquer tamanho), emojis,
// imagens (meus adesivos e fotos soltas) e o calendário.
// Cada desenho vive numa caixa de 100 x 100 e ganha uma borda branca, como adesivo de verdade.
// Alguns desenhos (balões, etiquetas, faixa…) têm um texto dentro, que dá para mudar.

import { shade, luminance } from './card.js';
import { cssFont } from './fonts.js';

const P = (d) => new Path2D(d);

function circle(cx, cy, r) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

function ellipse(cx, cy, rx, ry, rot = 0) {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

function rrect(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

function starPath(points, outer, inner, cx, cy) {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

// Lua: um círculo menos outro círculo.
function crescent() {
  const A = { x: 46, y: 52, r: 40 };
  const B = { x: 68, y: 36, r: 33 };
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
  const h = Math.sqrt(A.r * A.r - a * a);
  const mx = A.x + (a * dx) / d;
  const my = A.y + (a * dy) / d;
  const p1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const p2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  const ang = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
  const TAU = Math.PI * 2;
  const midOf = (a1, a2, ccw) => {
    const span = ccw ? (((a1 - a2) % TAU) + TAU) % TAU : (((a2 - a1) % TAU) + TAU) % TAU;
    return ccw ? a1 - span / 2 : a1 + span / 2;
  };
  // arco do círculo grande pelo lado longe do círculo pequeno
  const a1 = ang(A, p1);
  const a2 = ang(A, p2);
  let ccwA = false;
  const mA = midOf(a1, a2, false);
  if (Math.hypot(A.x + Math.cos(mA) * A.r - B.x, A.y + Math.sin(mA) * A.r - B.y) < B.r) ccwA = true;
  // volta pelo círculo pequeno, por dentro do grande
  const b1 = ang(B, p2);
  const b2 = ang(B, p1);
  let ccwB = false;
  const mB = midOf(b1, b2, false);
  if (Math.hypot(B.x + Math.cos(mB) * B.r - A.x, B.y + Math.sin(mB) * B.r - A.y) > A.r) ccwB = true;
  const p = new Path2D();
  p.moveTo(p1.x, p1.y);
  p.arc(A.x, A.y, A.r, a1, a2, ccwA);
  p.arc(B.x, B.y, B.r, b1, b2, ccwB);
  p.closePath();
  return p;
}

const HEART = 'M50 90 C22 70 5 54 5 32 C5 16 17 6 31 6 C40 6 46 11 50 18 C54 11 60 6 69 6 C83 6 95 16 95 32 C95 54 78 70 50 90Z';
const SPARKLE = 'M50 3 C54 38 62 46 97 50 C62 54 54 62 50 97 C46 62 38 54 3 50 C38 46 46 38 50 3Z';
const shine = (x, y, rx, ry, rot) => ({ p: ellipse(x, y, rx, ry, rot), fill: 'rgba(255,255,255,0.55)', noEdge: true });
const DARK = '#43203a';

// Um desenho da caixa 100 x 100 colocado com centro em (cx, cy), escala s e giro (graus).
function place(d, cx, cy, s, rot = 0) {
  const p = new Path2D();
  p.addPath(typeof d === 'string' ? new Path2D(d) : d, new DOMMatrix().translate(cx, cy).rotate(rot).scale(s).translate(-50, -50));
  return p;
}

// Letra escura em cor clara, branca em cor escura.
const inkOn = (c) => (luminance(c) > 0.62 ? DARK : '#ffffff');

function face(ex, ey, gap, r = 4.5) {
  return [
    { p: circle(ex - gap, ey, r), fill: DARK, noEdge: true },
    { p: circle(ex + gap, ey, r), fill: DARK, noEdge: true },
    { p: circle(ex - gap - 1.2, ey - 1.6, r * 0.32), fill: '#ffffff', noEdge: true },
    { p: circle(ex + gap - 1.2, ey - 1.6, r * 0.32), fill: '#ffffff', noEdge: true },
  ];
}
const blush = (x, y) => ({ p: ellipse(x, y, 6, 4), fill: 'rgba(255,110,150,0.45)', noEdge: true });

// parts(c): lista de { p: Path2D, fill?, stroke?, width?, noEdge? } desenhadas em ordem.
export const STICKERS = [
  { id: 'heart', name: 'Coração', color: '#ff5c93', parts: (c) => [{ p: P(HEART), fill: c }, shine(30, 28, 9, 5.5, -0.6)] },
  { id: 'star', name: 'Estrela', color: '#ffc93c', parts: (c) => [{ p: starPath(5, 47, 21, 50, 54), fill: c }] },
  { id: 'sparkle', name: 'Brilho', color: '#ffd84d', parts: (c) => [{ p: P(SPARKLE), fill: c }] },
  {
    id: 'bow',
    name: 'Laço',
    color: '#ff5c93',
    parts: (c) => [
      { p: P('M46 52 L32 86 L43 81 L50 92 L54 54Z'), fill: shade(c, -0.12) },
      { p: P('M54 52 L68 86 L57 81 L50 92 L46 54Z'), fill: shade(c, -0.12) },
      { p: P('M50 48 C36 24 8 18 7 38 C6 58 32 64 50 52Z'), fill: c },
      { p: P('M50 48 C64 24 92 18 93 38 C94 58 68 64 50 52Z'), fill: c },
      { p: ellipse(50, 50, 9, 10), fill: shade(c, -0.22) },
    ],
  },
  {
    id: 'flower',
    name: 'Flor',
    color: '#ff9cc2',
    parts: (c) => [
      ...[0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return { p: circle(50 + Math.cos(a) * 25, 52 + Math.sin(a) * 25, 18), fill: c };
      }),
      { p: circle(50, 52, 14), fill: '#ffd34d' },
    ],
  },
  {
    id: 'cloud',
    name: 'Nuvem',
    color: '#bfe0ff',
    parts: (c) => [
      { p: circle(30, 60, 17), fill: c },
      { p: circle(52, 46, 23), fill: c },
      { p: circle(74, 58, 17), fill: c },
      { p: rrect(16, 56, 72, 22, 11), fill: c },
    ],
  },
  {
    id: 'butterfly',
    name: 'Borboleta',
    color: '#b79cff',
    parts: (c) => [
      { p: ellipse(29, 36, 22, 17, -0.45), fill: c },
      { p: ellipse(71, 36, 22, 17, 0.45), fill: c },
      { p: ellipse(33, 67, 15, 12, 0.5), fill: shade(c, -0.12) },
      { p: ellipse(67, 67, 15, 12, -0.5), fill: shade(c, -0.12) },
      { p: circle(28, 35, 7), fill: 'rgba(255,255,255,0.6)', noEdge: true },
      { p: circle(72, 35, 7), fill: 'rgba(255,255,255,0.6)', noEdge: true },
      { p: rrect(46, 24, 8, 54, 4), fill: '#5a3a52' },
      { p: P('M48 27 Q42 12 34 9'), stroke: '#5a3a52', width: 3 },
      { p: P('M52 27 Q58 12 66 9'), stroke: '#5a3a52', width: 3 },
    ],
  },
  {
    id: 'crown',
    name: 'Coroa',
    color: '#ffc93c',
    parts: (c) => [
      { p: P('M18 80 L12 34 L33 54 L50 20 L67 54 L88 34 L82 80Z'), fill: c },
      { p: rrect(16, 72, 68, 12, 3), fill: shade(c, -0.14) },
      { p: circle(12, 32, 6), fill: '#ff5c93' },
      { p: circle(50, 18, 6), fill: '#6fb7ff' },
      { p: circle(88, 32, 6), fill: '#ff5c93' },
    ],
  },
  { id: 'moon', name: 'Lua', color: '#ffd84d', parts: (c) => [{ p: crescent(), fill: c }] },
  {
    id: 'note',
    name: 'Nota musical',
    color: '#7a52d1',
    parts: (c) => [
      { p: P('M47 18 C64 22 78 32 74 52 C70 42 62 37 51 36Z'), fill: c },
      { p: rrect(45, 16, 7, 60, 3), fill: c },
      { p: ellipse(36, 76, 15, 11, -0.35), fill: c },
    ],
  },
  {
    id: 'bubble',
    name: 'Balão de fala',
    color: '#ffffff',
    text: { box: [12, 20, 76, 42], def: 'oi!' },
    parts: (c) => [
      { p: P('M28 66 L18 93 L50 70Z'), fill: c },
      { p: rrect(5, 10, 90, 62, 22), fill: c },
      { p: rrect(5, 10, 90, 62, 22), stroke: shade(c, -0.3), width: 3, noEdge: true },
    ],
  },
  {
    id: 'smiley',
    name: 'Carinha',
    color: '#ffd84d',
    parts: (c) => [
      { p: circle(50, 50, 43), fill: c },
      { p: ellipse(36, 42, 5, 7), fill: '#43203a', noEdge: true },
      { p: ellipse(64, 42, 5, 7), fill: '#43203a', noEdge: true },
      { p: circle(26, 58, 7), fill: 'rgba(255,110,150,0.45)', noEdge: true },
      { p: circle(74, 58, 7), fill: 'rgba(255,110,150,0.45)', noEdge: true },
      { p: P('M33 60 Q50 78 67 60'), stroke: '#43203a', width: 6, noEdge: true },
    ],
  },
  { id: 'bolt', name: 'Raio', color: '#ffd84d', parts: (c) => [{ p: P('M60 3 L20 57 L46 57 L35 97 L81 40 L55 40 L67 3Z'), fill: c }] },
  {
    id: 'paw',
    name: 'Patinha',
    color: '#ff9cc2',
    parts: (c) => [
      { p: ellipse(50, 66, 23, 19), fill: c },
      { p: circle(24, 41, 9.5), fill: c },
      { p: circle(41, 27, 10), fill: c },
      { p: circle(59, 27, 10), fill: c },
      { p: circle(76, 41, 9.5), fill: c },
    ],
  },
  {
    id: 'cherry',
    name: 'Cerejas',
    color: '#ff4d6d',
    parts: (c) => [
      { p: P('M60 14 C71 5 85 8 90 17 C79 23 68 22 60 14Z'), fill: '#5cc49a' },
      { p: P('M35 66 Q42 34 60 14'), stroke: '#4a8a5c', width: 4 },
      { p: P('M67 70 Q62 40 60 14'), stroke: '#4a8a5c', width: 4 },
      { p: circle(34, 72, 16), fill: c },
      { p: circle(67, 75, 16), fill: shade(c, -0.08) },
      shine(28, 66, 5, 3.5, -0.6),
      shine(61, 69, 5, 3.5, -0.6),
    ],
  },
  {
    id: 'rainbow',
    name: 'Arco-íris',
    color: '#ff6b8b',
    fixed: true,
    parts: () => {
      const cols = ['#ff6b8b', '#ffb347', '#ffe066', '#7bd389', '#6fb7ff', '#b79cff'];
      const out = cols.map((col, i) => {
        const ro = 45 - i * 5.5;
        const ri = ro - 5.5;
        const p = new Path2D();
        p.arc(50, 72, ro, Math.PI, 0);
        p.arc(50, 72, ri, 0, Math.PI, true);
        p.closePath();
        return { p, fill: col };
      });
      out.push({ p: circle(14, 74, 9), fill: '#ffffff' }, { p: circle(24, 77, 8), fill: '#ffffff' });
      out.push({ p: circle(86, 74, 9), fill: '#ffffff' }, { p: circle(76, 77, 8), fill: '#ffffff' });
      return out;
    },
  },
  { id: 'tape', name: 'Fita listrada', color: '#ff9cc2', tape: 'stripes' },
  { id: 'circle', name: 'Bolinha', color: '#b79cff', parts: (c) => [{ p: circle(50, 50, 44), fill: c }, shine(32, 30, 10, 6, -0.6)] },

  // ---------- fofos ----------
  {
    id: 'sparkles3',
    name: 'Brilhinhos',
    color: '#ffd84d',
    parts: (c) => [
      { p: place(SPARKLE, 40, 56, 0.66), fill: c },
      { p: place(SPARKLE, 78, 22, 0.36), fill: c },
      { p: place(SPARKLE, 82, 76, 0.26), fill: shade(c, 0.35) },
    ],
  },
  {
    id: 'hearts3',
    name: 'Coraçõezinhos',
    color: '#ff5c93',
    parts: (c) => [
      { p: place(HEART, 40, 58, 0.62, -12), fill: c },
      { p: place(HEART, 78, 28, 0.36, 14), fill: shade(c, 0.35) },
      { p: place(HEART, 20, 18, 0.26, -18), fill: shade(c, -0.12) },
    ],
  },
  {
    id: 'bear',
    name: 'Ursinho',
    color: '#d9a577',
    parts: (c) => [
      { p: circle(22, 26, 14), fill: c },
      { p: circle(78, 26, 14), fill: c },
      { p: circle(22, 26, 7), fill: shade(c, -0.2), noEdge: true },
      { p: circle(78, 26, 7), fill: shade(c, -0.2), noEdge: true },
      { p: circle(50, 56, 38), fill: c },
      { p: ellipse(50, 69, 15, 11), fill: shade(c, 0.6), noEdge: true },
      ...face(50, 52, 14),
      { p: ellipse(50, 64, 5, 3.6), fill: DARK, noEdge: true },
      blush(28, 66),
      blush(72, 66),
    ],
  },
  {
    id: 'bunny',
    name: 'Coelhinho',
    color: '#ffd9e8',
    parts: (c) => [
      { p: ellipse(36, 28, 10, 25, -0.15), fill: c },
      { p: ellipse(64, 28, 10, 25, 0.15), fill: c },
      { p: ellipse(36, 30, 4.5, 16, -0.15), fill: '#ff9cc2', noEdge: true },
      { p: ellipse(64, 30, 4.5, 16, 0.15), fill: '#ff9cc2', noEdge: true },
      { p: ellipse(50, 64, 35, 29), fill: c },
      ...face(50, 62, 13),
      { p: P('M46 70 L54 70 L50 74Z'), fill: '#ff5c93', noEdge: true },
      blush(28, 74),
      blush(72, 74),
    ],
  },
  {
    id: 'cat',
    name: 'Gatinho',
    color: '#ffcf9e',
    parts: (c) => [
      { p: P('M14 44 L20 8 L44 28Z'), fill: c },
      { p: P('M86 44 L80 8 L56 28Z'), fill: c },
      { p: P('M22 34 L24 18 L36 28Z'), fill: '#ff9cc2', noEdge: true },
      { p: P('M78 34 L76 18 L64 28Z'), fill: '#ff9cc2', noEdge: true },
      { p: ellipse(50, 58, 39, 32), fill: c },
      ...face(50, 54, 14),
      { p: P('M46 63 L54 63 L50 67Z'), fill: '#ff5c93', noEdge: true },
      { p: P('M8 60 L28 62 M8 70 L28 67 M92 60 L72 62 M92 70 L72 67'), stroke: shade(c, -0.4), width: 1.8, noEdge: true },
      blush(28, 70),
      blush(72, 70),
    ],
  },
  {
    id: 'strawberry',
    name: 'Morango',
    color: '#ff4d6d',
    parts: (c) => [
      { p: P('M50 94 C24 84 10 58 15 40 C19 26 36 23 50 29 C64 23 81 26 85 40 C90 58 76 84 50 94Z'), fill: c },
      { p: P('M50 32 C40 30 30 24 26 14 C36 14 44 18 50 26 C56 18 64 14 74 14 C70 24 60 30 50 32Z'), fill: '#5cc49a' },
      { p: rrect(47, 6, 6, 14, 3), fill: '#4a8a5c' },
      ...[[32, 46], [50, 44], [68, 46], [40, 60], [60, 60], [32, 72], [50, 76], [68, 72], [50, 60]].map(([x, y]) => ({ p: ellipse(x, y, 2.2, 3.2), fill: '#ffe38a', noEdge: true })),
      shine(26, 48, 4, 7, 0.4),
    ],
  },
  {
    id: 'balloon',
    name: 'Balão de festa',
    color: '#6fb7ff',
    parts: (c) => [
      { p: P('M50 74 Q46 86 54 96'), stroke: '#8a6a7e', width: 2.5 },
      { p: ellipse(50, 38, 30, 34), fill: c },
      { p: P('M44 78 L56 78 L50 70Z'), fill: shade(c, -0.15) },
      shine(38, 24, 6, 10, 0.5),
    ],
  },

  // ---------- idol ----------
  {
    id: 'lightstick',
    name: 'Lightstick',
    color: '#b79cff',
    parts: (c) => [
      { p: P('M44 56 L56 56 L54 94 Q50 97 46 94Z'), fill: shade(c, -0.45) },
      { p: rrect(37, 52, 26, 8, 3), fill: '#ffd84d' },
      { p: circle(50, 31, 27), fill: c },
      { p: place(HEART, 50, 32, 0.28), fill: 'rgba(255,255,255,0.85)', noEdge: true },
      shine(38, 20, 6, 4, -0.6),
    ],
  },
  {
    id: 'mic',
    name: 'Microfone',
    color: '#ff5c93',
    parts: (c) => [
      { p: P('M38 54 L62 54 L56 95 Q50 98 44 95Z'), fill: c },
      { p: circle(50, 30, 23), fill: '#d6d3e3' },
      { p: P('M33 22 L67 22 M30 31 L70 31 M33 40 L67 40 M42 9 L42 51 M58 9 L58 51 M50 7 L50 53'), stroke: '#a9a4bd', width: 1.6, noEdge: true },
      { p: rrect(31, 48, 38, 9, 4), fill: shade(c, -0.2) },
      shine(40, 20, 5, 3, -0.6),
    ],
  },
  {
    id: 'camera',
    name: 'Câmera',
    color: '#ffb3cf',
    parts: (c) => [
      { p: rrect(22, 16, 26, 16, 5), fill: shade(c, -0.15) },
      { p: rrect(7, 26, 86, 60, 13), fill: c },
      { p: rrect(7, 44, 86, 8, 0), fill: shade(c, -0.1), noEdge: true },
      { p: circle(50, 57, 22), fill: '#ffffff', noEdge: true },
      { p: circle(50, 57, 17), fill: DARK, noEdge: true },
      { p: circle(50, 57, 10), fill: '#6fb7ff', noEdge: true },
      shine(45, 52, 3.5, 2.5, -0.6),
      { p: rrect(72, 32, 12, 8, 2), fill: '#ffffff', noEdge: true },
    ],
  },
  {
    id: 'notes',
    name: 'Notinhas',
    color: '#7a52d1',
    parts: (c) => [
      { p: P('M33 18 L78 8 L78 20 L33 30Z'), fill: c },
      { p: rrect(30, 20, 7, 56, 3), fill: c },
      { p: rrect(72, 10, 7, 56, 3), fill: c },
      { p: ellipse(23, 77, 14, 10, -0.35), fill: c },
      { p: ellipse(65, 67, 14, 10, -0.35), fill: c },
    ],
  },
  {
    id: 'ticket',
    name: 'Ingresso',
    color: '#ffc93c',
    text: { box: [14, 32, 52, 36], def: 'SHOW' },
    parts: (c) => [
      { p: P('M6 22 H94 V40 A10 10 0 0 0 94 60 V78 H6 V60 A10 10 0 0 0 6 40 Z'), fill: c },
      { p: P('M74 26 V74'), stroke: shade(c, -0.3), width: 2, dash: [4, 4], noEdge: true },
      { p: place(starPath(5, 47, 21, 50, 54), 84, 50, 0.16), fill: shade(c, -0.3), noEdge: true },
    ],
  },
  {
    id: 'heartTag',
    name: 'Coração com nome',
    color: '#ff5c93',
    text: { box: [20, 26, 60, 30], def: 'bias' },
    parts: (c) => [{ p: P(HEART), fill: c }, shine(26, 26, 7, 4.5, -0.6)],
  },

  // ---------- scrapbook ----------
  { id: 'tapeDots', name: 'Fita de bolinhas', color: '#b79cff', tape: 'dots' },
  { id: 'tapeCheck', name: 'Fita xadrez', color: '#ff9cc2', tape: 'check' },
  { id: 'tapeHearts', name: 'Fita de corações', color: '#ffd9e8', tape: 'hearts' },
  { id: 'tapePlain', name: 'Fita lisa', color: '#ffe38a', tape: 'plain' },
  {
    id: 'clip',
    name: 'Clipe',
    color: '#ff5c93',
    parts: (c) => [{ p: P('M40 84 V22 A12 12 0 0 1 64 22 V72 A8 8 0 0 1 48 72 V30'), stroke: c, width: 6 }],
  },
  {
    id: 'pin',
    name: 'Tachinha',
    color: '#ff5c93',
    parts: (c) => [
      { p: P('M50 56 L50 95'), stroke: '#8a8a99', width: 4 },
      { p: ellipse(50, 54, 20, 7), fill: shade(c, -0.2) },
      { p: circle(50, 34, 24), fill: c },
      shine(41, 25, 6, 4, -0.6),
    ],
  },
  {
    id: 'stamp',
    name: 'Selo',
    color: '#6fb7ff',
    parts: (c) => {
      const out = [{ p: rrect(12, 8, 76, 84, 2), fill: c }];
      for (let i = 0; i <= 8; i++) {
        out.push({ p: circle(12 + (i * 76) / 8, 8, 3.4), fill: '#ffffff', noEdge: true });
        out.push({ p: circle(12 + (i * 76) / 8, 92, 3.4), fill: '#ffffff', noEdge: true });
      }
      for (let i = 1; i < 9; i++) {
        out.push({ p: circle(12, 8 + (i * 84) / 9, 3.4), fill: '#ffffff', noEdge: true });
        out.push({ p: circle(88, 8 + (i * 84) / 9, 3.4), fill: '#ffffff', noEdge: true });
      }
      out.push({ p: rrect(22, 18, 56, 64, 2), fill: shade(c, 0.6), noEdge: true });
      out.push({ p: place(HEART, 50, 50, 0.4), fill: c, noEdge: true });
      return out;
    },
  },
  {
    id: 'envelope',
    name: 'Cartinha',
    color: '#ffd9e8',
    parts: (c) => [
      { p: rrect(7, 22, 86, 58, 8), fill: c },
      { p: P('M10 26 L50 56 L90 26'), stroke: shade(c, -0.25), width: 3.5, noEdge: true },
      { p: place(HEART, 50, 56, 0.2), fill: '#ff4d6d', noEdge: true },
    ],
  },
  {
    id: 'torn',
    name: 'Papel rasgado',
    color: '#fffbea',
    text: { box: [12, 32, 76, 34], def: 'amo ♡', ink: () => DARK, font: 'caveat' },
    parts: (c) => [
      { p: P('M8 26 L16 22 L24 27 L33 21 L42 26 L52 20 L61 26 L70 21 L79 26 L88 22 L93 27 L92 74 L84 79 L75 73 L66 79 L57 74 L47 80 L38 74 L29 79 L20 74 L9 78 Z'), fill: c },
      { p: P('M12 42 L88 42 M12 56 L88 56 M12 70 L88 70'), stroke: '#bfe0ff', width: 1.2, noEdge: true },
    ],
  },
  {
    id: 'label',
    name: 'Etiqueta',
    color: '#b79cff',
    text: { box: [28, 34, 58, 32], def: 'meu' },
    parts: (c) => [
      { p: P('M24 24 H88 A6 6 0 0 1 94 30 V70 A6 6 0 0 1 88 76 H24 L6 50 Z'), fill: c },
      { p: circle(19, 50, 4.2), fill: '#ffffff', noEdge: true },
    ],
  },

  // ---------- balões e faixas ----------
  {
    id: 'thought',
    name: 'Pensamento',
    color: '#ffffff',
    text: { box: [18, 22, 64, 34], def: 'hmm…' },
    parts: (c) => {
      const blob = new Path2D();
      [[30, 34, 18], [50, 26, 20], [70, 34, 18], [74, 50, 14], [52, 56, 18], [28, 52, 15]].forEach(([x, y, r]) => {
        blob.moveTo(x + r, y);
        blob.arc(x, y, r, 0, Math.PI * 2);
      });
      // contorno por baixo e o recheio por cima: só a borda de fora aparece
      const line = shade(c, -0.3);
      return [
        { p: blob, fill: c, width: 5 },
        { p: circle(26, 78, 7), fill: c, width: 5 },
        { p: circle(16, 91, 4.5), fill: c, width: 5 },
        { p: blob, stroke: line, width: 5, noEdge: true },
        { p: circle(26, 78, 7), stroke: line, width: 5, noEdge: true },
        { p: circle(16, 91, 4.5), stroke: line, width: 5, noEdge: true },
        { p: blob, fill: c, noEdge: true },
        { p: circle(26, 78, 7), fill: c, noEdge: true },
        { p: circle(16, 91, 4.5), fill: c, noEdge: true },
      ];
    },
  },
  {
    id: 'banner',
    name: 'Faixa',
    color: '#ff5c93',
    text: { box: [18, 37, 64, 26], def: 'Seu nome' },
    parts: (c) => [
      { p: P('M16 42 L2 42 L10 54 L2 68 L20 68Z'), fill: shade(c, -0.2) },
      { p: P('M84 42 L98 42 L90 54 L98 68 L80 68Z'), fill: shade(c, -0.2) },
      { p: P('M14 32 H86 V64 H14Z'), fill: c },
    ],
  },
  {
    id: 'burst',
    name: 'Explosão',
    color: '#ffd84d',
    text: { box: [22, 34, 56, 32], def: 'UAU!' },
    parts: (c) => [{ p: starPath(14, 48, 36, 50, 50), fill: c }],
  },
];

// Pacotes de adesivos (as abas dentro de "Adesivos").
export const STICKER_PACKS = [
  { id: 'fofos', name: 'Fofos', items: ['heart', 'hearts3', 'star', 'sparkle', 'sparkles3', 'bow', 'flower', 'cloud', 'rainbow', 'butterfly', 'moon', 'smiley', 'bear', 'bunny', 'cat', 'paw', 'cherry', 'strawberry', 'balloon', 'circle', 'bolt'] },
  { id: 'idol', name: 'Idol', items: ['lightstick', 'mic', 'heartTag', 'ticket', 'crown', 'camera', 'note', 'notes', 'sparkles3', 'star'] },
  { id: 'scrap', name: 'Scrapbook', items: ['tape', 'tapeDots', 'tapeCheck', 'tapeHearts', 'tapePlain', 'clip', 'pin', 'stamp', 'envelope', 'torn', 'label'] },
  { id: 'baloes', name: 'Balões', items: ['bubble', 'thought', 'banner', 'burst', 'label', 'torn', 'heartTag', 'ticket'] },
];

export const EMOJIS = [
  '💖', '💗', '💕', '💞', '💜', '🩷', '🫶', '🫰', '🎀', '🌸', '🌷', '💐', '🌼', '🦋', '🍓', '🍒', '🍰', '🎂', '🍭', '🍩',
  '🐰', '🐱', '🐶', '🐻', '🧸', '🦄', '🌈', '☀️', '🌙', '☁️', '⭐', '🌟', '✨', '💫', '👑', '🎵', '🎤', '📸', '💌', '🎈', '🎁', '🍀',
];

export const stickerInfo = (id) => STICKERS.find((s) => s.id === id) || STICKERS[0];

const TAPE_HEART = new Path2D(HEART);

function drawTape(ctx, c, style = 'stripes') {
  const base = new Path2D();
  const teeth = 4;
  const y0 = 34;
  const y1 = 66;
  base.moveTo(10, y0);
  base.lineTo(90, y0);
  for (let i = 0; i < teeth; i++) {
    const ya = y0 + ((i + 0.5) * (y1 - y0)) / teeth;
    const yb = y0 + ((i + 1) * (y1 - y0)) / teeth;
    base.lineTo(95, ya);
    base.lineTo(90, yb);
  }
  base.lineTo(10, y1);
  for (let i = teeth - 1; i >= 0; i--) {
    const ya = y0 + ((i + 0.5) * (y1 - y0)) / teeth;
    const yb = y0 + (i * (y1 - y0)) / teeth;
    base.lineTo(5, ya);
    base.lineTo(10, yb);
  }
  base.closePath();
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate((-10 * Math.PI) / 180);
  ctx.translate(-50, -50);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = c;
  ctx.fill(base);
  ctx.clip(base);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = luminance(c) > 0.8 ? shade(c, -0.25) : '#ffffff';
  if (style === 'stripes') {
    for (let x = -20; x < 120; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + 4, y0);
      ctx.lineTo(x + 4 - 32, y1);
      ctx.lineTo(x - 32, y1);
      ctx.closePath();
      ctx.fill();
    }
  } else if (style === 'dots') {
    ctx.beginPath();
    for (let x = 8, i = 0; x < 100; x += 8, i++) {
      const y = i % 2 ? 44 : 56;
      ctx.moveTo(x + 2.4, y);
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (style === 'check') {
    for (let x = 4; x < 100; x += 8) ctx.fillRect(x, y0, 4, y1 - y0);
    for (let y = y0; y < y1; y += 8) ctx.fillRect(0, y, 100, 4);
  } else if (style === 'hearts') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = shade(c, -0.3);
    for (let x = 14, i = 0; x < 96; x += 14, i++) {
      ctx.save();
      ctx.translate(x - 4.5, (i % 2 ? 40 : 52) - 4.5);
      ctx.scale(0.09, 0.09);
      ctx.fill(TAPE_HEART);
      ctx.restore();
    }
  }
  ctx.restore();
}

// Texto de dentro do desenho (balões, etiquetas, faixa…), do maior tamanho que couber.
function drawInnerText(ctx, s, c, text) {
  const t = text == null ? s.text.def : String(text);
  if (!t.trim()) return;
  const [bx, by, bw, bh] = s.text.box;
  const lines = t.split('\n').slice(0, 3);
  const font = s.text.font || 'fredoka';
  ctx.save();
  ctx.font = cssFont(font, 100);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l || ' ').width), 1);
  const px = Math.min(bh / (lines.length * 1.08), (bw / widest) * 100, 40);
  ctx.font = cssFont(font, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s.text.ink ? s.text.ink(c) : inkOn(c);
  const n = lines.length;
  lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + bh / 2 + (i - (n - 1) / 2) * px * 1.08 + px * 0.04));
  ctx.restore();
}

// Desenha um adesivo dentro da caixa 100 x 100 (o ctx já está na escala certa).
export function drawShape(ctx, id, color, text) {
  const s = stickerInfo(id);
  const c = color || s.color;
  if (s.tape) return drawTape(ctx, c, s.tape);
  const parts = s.parts(c);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // borda branca de adesivo, por baixo de tudo
  ctx.strokeStyle = '#ffffff';
  for (const part of parts) {
    if (part.noEdge) continue;
    ctx.lineWidth = (part.width || 0) + 9;
    ctx.stroke(part.p);
  }
  for (const part of parts) {
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(part.p);
    } else if (part.stroke) {
      ctx.strokeStyle = part.stroke;
      ctx.lineWidth = part.width || 3;
      if (part.dash) ctx.setLineDash(part.dash);
      ctx.stroke(part.p);
      ctx.setLineDash([]);
    }
  }
  if (s.text) drawInnerText(ctx, s, c, text);
}

export const hasInnerText = (layer) => !!(layer && layer.type === 'sticker' && layer.kind === 'shape' && stickerInfo(layer.name).text);

// ---------- imagens (meus adesivos e fotos soltas) ----------
// Moldura da foto solta, em pixels da imagem: { W, H } = tamanho com a moldura; l, t = onde a foto começa.
export function imageFrame(layer) {
  const iw = layer.iw || 100;
  const ih = layer.ih || 100;
  const fr = layer.frame || 'none';
  if (fr === 'none') return { W: iw, H: ih, l: 0, t: 0 };
  const b = Math.max(iw, ih) * 0.045;
  const bottom = fr === 'polaroid' ? b * 3.6 : b;
  return { W: iw + 2 * b, H: ih + b + bottom, l: b, t: b };
}

export const CAL_RATIO = 1.08; // altura / largura do calendário

// Caixa do adesivo em mm (largura e altura), antes de girar.
export function stickerBox(layer) {
  if (layer.kind === 'image') {
    const { W, H } = imageFrame(layer);
    const a = W / H;
    return a >= 1 ? { w: layer.size, h: layer.size / a } : { w: layer.size * a, h: layer.size };
  }
  if (layer.kind === 'calendar') return { w: layer.size, h: layer.size * CAL_RATIO };
  return { w: layer.size, h: layer.size };
}

function drawImageSticker(ctx, layer, w, h, getImg) {
  const img = getImg ? getImg(layer.imageKey) : null;
  const fr = imageFrame(layer);
  const s = w / fr.W;
  if (layer.frame && layer.frame !== 'none') {
    ctx.save();
    if (layer.shadow !== false) {
      ctx.shadowColor = 'rgba(60, 20, 50, 0.32)';
      ctx.shadowBlur = Math.max(2, w * 0.035);
      ctx.shadowOffsetY = Math.max(1, w * 0.012);
    }
    ctx.fillStyle = layer.frameColor || '#ffffff';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  } else if (layer.shadow) {
    ctx.shadowColor = 'rgba(60, 20, 50, 0.32)';
    ctx.shadowBlur = Math.max(2, w * 0.035);
    ctx.shadowOffsetY = Math.max(1, w * 0.012);
  }
  const x = -w / 2 + fr.l * s;
  const y = -h / 2 + fr.t * s;
  const iw = (layer.iw || 100) * s;
  const ih = (layer.ih || 100) * s;
  if (img) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, iw, ih);
  } else {
    ctx.fillStyle = '#f2dbe6';
    ctx.fillRect(x, y, iw, ih);
  }
  ctx.shadowColor = 'transparent';
}

// ---------- calendário ----------
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function drawCalendar(ctx, layer, w) {
  const c = layer.color || '#ff5c93';
  const month = layer.month == null ? new Date().getMonth() : layer.month;
  const year = layer.year || new Date().getFullYear();
  ctx.save();
  ctx.scale(w / 100, w / 100);
  ctx.translate(-50, -50 * CAL_RATIO);
  const H = 100 * CAL_RATIO;
  ctx.fillStyle = '#ffffff';
  ctx.fill(rrect(0, 0, 100, H, 5));
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = shade(c, 0.35);
  ctx.stroke(rrect(0, 0, 100, H, 5));
  const head = new Path2D();
  head.moveTo(0, 22);
  head.lineTo(0, 5);
  head.arcTo(0, 0, 5, 0, 5);
  head.lineTo(95, 0);
  head.arcTo(100, 0, 100, 5, 5);
  head.lineTo(100, 22);
  head.closePath();
  ctx.fillStyle = c;
  ctx.fill(head);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = inkOn(c);
  ctx.font = cssFont('fredoka', 9.5);
  ctx.fillText(`${MONTHS[month]} ${year}`, 50, 11.5);
  const cw = 100 / 7;
  ctx.font = cssFont('fredoka', 5.4);
  ctx.fillStyle = shade(c, -0.25);
  WEEK.forEach((d, i) => ctx.fillText(d, cw / 2 + i * cw, 29));
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  ctx.font = cssFont('nunito', 5.8);
  const rowH = 12;
  for (let d = 1; d <= days; d++) {
    const pos = first + d - 1;
    const col = pos % 7;
    const row = Math.floor(pos / 7);
    const x = cw / 2 + col * cw;
    const y = 40 + row * rowH;
    ctx.fillStyle = col === 0 ? shade(c, -0.15) : DARK;
    ctx.fillText(String(d), x, y);
  }
  ctx.restore();
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// Desenha o adesivo da camada com centro em (px, py) na tela; k = px por mm.
// getImg só é usado pelos adesivos de imagem.
export function drawSticker(ctx, layer, px, py, k, getImg) {
  const size = layer.size * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flip) ctx.scale(-1, 1);
  if (layer.kind === 'image') {
    const b = stickerBox(layer);
    drawImageSticker(ctx, layer, b.w * k, b.h * k, getImg);
  } else if (layer.kind === 'calendar') {
    drawCalendar(ctx, layer, size);
  } else if (layer.kind === 'emoji') {
    ctx.font = `${size * 0.86}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(layer.name, 0, size * 0.04);
  } else {
    ctx.scale(size / 100, size / 100);
    ctx.translate(-50, -50);
    drawShape(ctx, layer.name, layer.color, layer.text);
  }
  ctx.restore();
}

// Desenho pequeno para os botões.
export function stickerPreview(id, px = 56) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px * dpr);
  c.style.width = c.style.height = `${px}px`;
  const ctx = c.getContext('2d');
  ctx.scale((px * dpr) / 116, (px * dpr) / 116);
  ctx.translate(8, 8);
  drawShape(ctx, id);
  return c;
}

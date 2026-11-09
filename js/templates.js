// Modelos prontos: trocam fundo, moldura, colagem, textos e adesivos de um lado do card.
// As fotos que já estavam no card continuam (vão para os espaços do modelo).
// Cada modelo diz em quais formatos aparece (for). Sem "for", vale para os formatos pequenos.

import { cardSize, frameWindow, unitOf, newStickerLayer, newTextLayer, formatInfo } from './card.js';
import { GRADIENTS } from './render.js';

const grad = (id) => {
  const g = GRADIENTS.find((x) => x.id === id);
  return { kind: 'gradient', id, stops: g.stops.slice(), angle: g.angle };
};

const SMALL = ['card', 'mini', 'bookmark', 'bookmark20', 'folded'];
const BTN = ['btn32', 'btn44', 'btn58'];
const COVERS = ['cover', 'hardcover'];
const T = (props) => newTextLayer({ stroke: { color: null, width: 4 }, ...props });
const S = (name, props) => newStickerLayer({ name, ...props });

// Cada modelo recebe largura e altura (mm), o "g" (orientação e formato), a escala u do formato
// (1 no photo card) e P(fx, fy), que converte uma posição em frações do card para mm.
export const TEMPLATES = [
  // ---------- formatos pequenos ----------
  {
    id: 'limpo',
    name: 'Só a foto',
    for: [...SMALL, ...BTN, ...COVERS, 'poster'],
    make: () => ({ bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'none', color: '#ffffff' }, layout: '1', layers: [] }),
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    make: (w, h, g, u) => {
      const frame = { id: 'polaroid', color: '#ffffff' };
      const win = frameWindow(frame, g);
      const bottom = h - (win.y + win.h);
      return {
        bg: { kind: 'solid', color: '#ffd9e8' },
        frame,
        layout: '1',
        layers: [T({ text: 'meu dia ♡', font: 'caveat', size: Math.min(8 * u, bottom * 0.55), color: '#6e4560', y: h / 2 - bottom / 2 })],
      };
    },
  },
  {
    id: 'coracoes',
    name: 'Corações',
    make: (w, h, g, u) => ({
      bg: { kind: 'solid', color: '#ffd9e8' },
      frame: { id: 'hearts', color: '#ff9cc2' },
      layout: '1',
      layers: [
        S('heart', { color: '#ff5c93', size: 12 * u, x: -w / 2 + 7 * u, y: -h / 2 + 7 * u, rotation: -14 }),
        S('heart', { color: '#ffffff', size: 8 * u, x: w / 2 - 8 * u, y: h / 2 - 9 * u, rotation: 12 }),
      ],
    }),
  },
  {
    id: 'idol',
    name: 'Idol',
    make: (w, h, g, u) => ({
      bg: { kind: 'solid', color: '#ffffff' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '1',
      layers: [
        newTextLayer({ text: 'NOME', font: 'bungee', size: 7.5 * u, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, y: h / 2 - 9 * u }),
        newTextLayer({ text: '2026 ♡', font: 'caveat', size: 5 * u, color: '#ffffff', stroke: { color: '#43203a', width: 3 }, x: w / 2 - 9 * u, y: -h / 2 + 6 * u, rotation: 8 }),
        S('sparkle', { color: '#ffd84d', size: 9 * u, x: -w / 2 + 7 * u, y: h / 2 - 17 * u }),
      ],
    }),
  },
  {
    id: 'lightstick',
    name: 'Show',
    make: (w, h, g, u) => ({
      bg: grad('noite'),
      frame: { id: 'solid', color: '#b79cff' },
      layout: '1',
      layers: [
        S('ticket', { color: '#ffc93c', size: 18 * u, text: 'SHOW', x: w / 2 - 12 * u, y: h / 2 - 11 * u, rotation: -10 }),
        S('lightstick', { color: '#b79cff', size: 14 * u, x: -w / 2 + 9 * u, y: h / 2 - 12 * u, rotation: -16 }),
        S('sparkles3', { color: '#ffd84d', size: 10 * u, x: w / 2 - 8 * u, y: -h / 2 + 9 * u }),
      ],
    }),
  },
  {
    id: 'estrelas',
    name: 'Céu estrelado',
    make: (w, h, g, u) => ({
      bg: grad('ceu'),
      frame: { id: 'solid', color: '#ffffff' },
      layout: '1',
      layers: [
        S('star', { color: '#ffd84d', size: 10 * u, x: -w / 2 + 8 * u, y: -h / 2 + 8 * u, rotation: -12 }),
        S('sparkle', { color: '#ffffff', size: 7 * u, x: w / 2 - 8 * u, y: -h / 2 + 12 * u }),
        S('moon', { color: '#ffd84d', size: 10 * u, x: w / 2 - 9 * u, y: h / 2 - 10 * u }),
      ],
    }),
  },
  {
    id: 'scrap',
    name: 'Scrapbook',
    make: (w, h, g, u) => ({
      bg: { kind: 'pattern', pattern: 'grid', color: '#fffaf0' },
      frame: { id: 'solid', color: '#fffaf0' },
      layout: '1',
      layers: [
        S('tapeDots', { color: '#b79cff', size: 18 * u, x: -w / 2 + 9 * u, y: -h / 2 + 6 * u, rotation: -28 }),
        S('tapeCheck', { color: '#ff9cc2', size: 18 * u, x: w / 2 - 9 * u, y: h / 2 - 7 * u, rotation: -28 }),
        S('label', { color: '#ffc93c', size: 16 * u, text: 'meu', x: w / 2 - 10 * u, y: -h / 2 + 12 * u, rotation: 8 }),
      ],
    }),
  },
  {
    id: 'duas',
    name: 'Duas fotos',
    make: () => ({ bg: { kind: 'solid', color: '#e6dcff' }, frame: { id: 'solid', color: '#ffffff' }, layout: '2h', layers: [] }),
  },
  {
    id: 'tres',
    name: 'Três fotos',
    make: () => ({ bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'dots', color: '#ff9cc2' }, layout: '3t', layers: [] }),
  },
  {
    id: 'aniversario',
    name: 'Aniversário',
    make: (w, h, g, u) => ({
      bg: { kind: 'pattern', pattern: 'dots', color: '#fff0b3' },
      frame: { id: 'stitch', color: '#ffb38a' },
      layout: '1',
      layers: [
        S('crown', { color: '#ffc93c', size: 13 * u, y: -h / 2 + 10 * u }),
        newTextLayer({ text: 'Feliz\naniversário!', font: 'pacifico', size: 5.5 * u, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, y: h / 2 - 13 * u, rotation: -4 }),
      ],
    }),
  },
  {
    id: 'figurinha',
    name: 'Figurinha',
    make: (w, h, g, u) => ({
      bg: { kind: 'pattern', pattern: 'stars', color: '#e6dcff' },
      frame: { id: 'solid', color: '#ffffff' },
      layout: '1',
      layers: [newTextLayer({ text: 'Use "Tirar fundo"\ne "Contorno" ♡', font: 'caveat', size: 4.2 * u, color: '#5b3f9e', stroke: { color: '#ffffff', width: 4 }, y: h / 2 - 10 * u })],
    }),
  },
  {
    id: 'verso',
    name: 'Verso fofo',
    for: ['card', 'mini', 'bookmark'],
    make: (w, h, g, u) => ({
      bg: { kind: 'pattern', pattern: 'hearts', color: '#ffd9e8' },
      frame: { id: 'stitch', color: '#ff9cc2' },
      layout: '0',
      layers: [
        newTextLayer({ text: 'Seu nome', font: 'pacifico', size: 9 * u, color: '#b4532f', stroke: { color: '#ffffff', width: 5 }, y: -2 * u }),
        newTextLayer({ text: 'photo card ♡', font: 'caveat', size: 5 * u, color: '#6e4560', stroke: { color: '#ffffff', width: 4 }, y: 8 * u }),
      ],
    }),
  },

  // ---------- marcador de página ----------
  {
    id: 'm-polaroid',
    name: 'Marcador polaroid',
    for: ['bookmark'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#ffd9e8' },
      frame: { id: 'polaroid', color: '#ffffff' },
      layout: '2h',
      layers: [T({ text: 'Feito à mão ♡', font: 'caveat', size: 7, color: '#b4532f', ...P(0.5, 0.955) })],
    }),
  },
  {
    id: 'm-nome',
    name: 'Nome deitado',
    for: ['bookmark'],
    make: (w, h, g, u, P) => ({
      bg: grad('algodao'),
      frame: { id: 'stitch', color: '#ffffff' },
      layout: '0',
      layers: [
        newTextLayer({ text: 'Seu nome', font: 'pacifico', size: 13, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, rotation: -90, ...P(0.5, 0.5) }),
        S('heart', { color: '#ff5c93', size: 11, ...P(0.5, 0.12), rotation: -10 }),
        S('sparkles3', { color: '#ffd84d', size: 12, ...P(0.5, 0.88) }),
      ],
    }),
  },
  {
    id: 'm-tres',
    name: 'Três fotos',
    for: ['bookmark'],
    make: () => ({ bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'dots', color: '#b79cff' }, layout: '3r', layers: [] }),
  },

  // ---------- cartão dobrável ----------
  {
    id: 'c-aniver',
    name: 'Capa de aniversário',
    for: ['folded'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'pattern', pattern: 'dots', color: '#fff0b3' },
      frame: { id: 'stitch', color: '#ffb38a' },
      layout: '1c',
      layers: [
        newTextLayer({ text: 'Feliz aniversário!', font: 'pacifico', size: 9, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, ...P(0.5, 0.11), rotation: -3 }),
        S('balloon', { color: '#ff5c93', size: 20, ...P(0.16, 0.86), rotation: -12 }),
        S('balloon', { color: '#6fb7ff', size: 17, ...P(0.84, 0.86), rotation: 10 }),
        S('crown', { color: '#ffc93c', size: 14, ...P(0.5, 0.86) }),
      ],
    }),
  },
  {
    id: 'c-amor',
    name: 'Capa de coração',
    for: ['folded'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#ffd9e8' },
      frame: { id: 'hearts', color: '#ff9cc2' },
      layout: '1c',
      layers: [
        newTextLayer({ text: 'Pra você ♡', font: 'pacifico', size: 9, color: '#b4532f', stroke: { color: '#ffffff', width: 5 }, ...P(0.5, 0.12) }),
        S('hearts3', { color: '#ff5c93', size: 18, ...P(0.5, 0.86) }),
      ],
    }),
  },
  {
    id: 'c-dentro',
    name: 'Mensagem (dentro)',
    for: ['folded'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#ffffff' },
      frame: { id: 'stitch', color: '#ff9cc2' },
      layout: '0',
      layers: [
        T({ text: 'Para: ____________', font: 'caveat', size: 7, color: '#6e4560', ...P(0.5, 0.15) }),
        T({ text: 'Escreva aqui\nsua mensagem ♡', font: 'caveat', size: 8, color: '#43203a', ...P(0.5, 0.45) }),
        T({ text: 'Com carinho,\nElane', font: 'pacifico', size: 7, color: '#b4532f', ...P(0.66, 0.8) }),
        S('heart', { color: '#ff5c93', size: 9, ...P(0.18, 0.84), rotation: -14 }),
      ],
    }),
  },

  // ---------- bottons ----------
  // Nos bottons, "w" é o corte do papel; a frente é menor (face). Tudo fica dentro da frente.
  {
    id: 'b-nome',
    name: 'Nome',
    for: BTN,
    make: (w, h, g) => {
      const face = g.faceMm || w * 0.8;
      return {
        bg: { kind: 'pattern', pattern: 'dots', color: '#f8e2d5' },
        frame: { id: 'none', color: '#ffffff' },
        layout: '0',
        layers: [
          newTextLayer({ text: 'NOME', font: 'bungee', size: face * 0.2, color: '#b4532f', stroke: { color: '#ffffff', width: 5 } }),
          S('sparkle', { color: '#e9b949', size: face * 0.18, x: face * 0.26, y: -face * 0.24 }),
        ],
      };
    },
  },
  {
    id: 'b-foto',
    name: 'Foto e nome',
    for: BTN,
    make: (w, h, g) => {
      const face = g.faceMm || w * 0.8;
      return {
        bg: { kind: 'solid', color: '#ffffff' },
        frame: { id: 'solid', color: '#b4532f' },
        layout: '1',
        layers: [newTextLayer({ text: 'Nome', font: 'pacifico', size: face * 0.15, color: '#ffffff', stroke: { color: '#b4532f', width: 6 }, y: face * 0.28 })],
      };
    },
  },
  {
    id: 'b-festa',
    name: 'Festa',
    for: BTN,
    make: (w, h, g) => {
      const face = g.faceMm || w * 0.8;
      return {
        bg: grad('pessego'),
        frame: { id: 'none', color: '#ffffff' },
        layout: '0',
        layers: [
          T({ text: 'Festa da', font: 'caveat', size: face * 0.13, color: '#5e5458', y: -face * 0.17 }),
          newTextLayer({ text: 'Nome', font: 'pacifico', size: face * 0.2, color: '#b4532f', stroke: { color: '#ffffff', width: 5 }, y: face * 0.03 }),
          T({ text: '10 anos', font: 'fredoka', size: face * 0.1, color: '#3d6a55', y: face * 0.24 }),
        ],
      };
    },
  },
  {
    id: 'b-frase',
    name: 'Frase',
    for: BTN,
    make: (w, h, g) => {
      const face = g.faceMm || w * 0.8;
      return {
        bg: { kind: 'solid', color: '#3d6a55' },
        frame: { id: 'none', color: '#ffffff' },
        layout: '0',
        layers: [
          T({ text: 'eu amo\nler', font: 'pacifico', size: face * 0.17, color: '#fbf6f0' }),
          S('heart', { color: '#e48b62', size: face * 0.13, x: face * 0.22, y: face * 0.22, rotation: 12 }),
        ],
      };
    },
  },

  // ---------- capas A5 ----------
  {
    id: 'c-titulo',
    name: 'Título',
    for: COVERS,
    make: (w, h, g, u, P) => ({
      bg: { kind: 'pattern', pattern: 'grid', color: '#fbf6f0' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '0',
      layers: [
        S('label', { color: '#e48b62', size: w * 0.62, text: 'caderno', ...P(0.5, 0.36) }),
        T({ text: 'Nome', font: 'pacifico', size: w * 0.1, color: '#b4532f', ...P(0.5, 0.62) }),
        T({ text: '2027', font: 'fredoka', size: w * 0.05, color: '#3d6a55', ...P(0.5, 0.72) }),
      ],
    }),
  },
  {
    id: 'c-foto',
    name: 'Foto e nome',
    for: COVERS,
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#ffffff' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '1',
      layers: [newTextLayer({ text: 'Nome', font: 'pacifico', size: w * 0.12, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, ...P(0.5, 0.82) })],
    }),
  },
  {
    id: 'c-washi',
    name: 'Washi',
    for: COVERS,
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#dde8df' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '0',
      layers: [
        S('tapeDots', { color: '#e48b62', size: w * 0.5, ...P(0.3, 0.2), rotation: -18 }),
        S('tapePlain', { color: '#e9b949', size: w * 0.45, ...P(0.75, 0.85), rotation: -18 }),
        newTextLayer({ text: 'Meu planner', font: 'pacifico', size: w * 0.1, color: '#2f5644', stroke: { color: '#ffffff', width: 4 }, ...P(0.5, 0.45) }),
        T({ text: 'Nome', font: 'caveat', size: w * 0.08, color: '#2f5644', ...P(0.5, 0.56) }),
      ],
    }),
  },

  // ---------- pôster A4 ----------
  {
    id: 'p-mural',
    name: 'Mural de fotos',
    for: ['poster'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'pattern', pattern: 'dots', color: '#ffd9e8' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '9t',
      layers: [
        newTextLayer({ text: 'nossas fotos ♡', font: 'pacifico', size: 20, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, ...P(0.5, 0.075) }),
        S('sparkles3', { color: '#ffd84d', size: 26, ...P(0.1, 0.07) }),
        S('hearts3', { color: '#ff5c93', size: 26, ...P(0.9, 0.07) }),
      ],
    }),
  },
  {
    id: 'p-dump',
    name: 'Photo dump',
    for: ['poster'],
    hint: 'Agora use “Foto solta”, na aba Foto, para espalhar as fotos tortinhas pelo pôster.',
    make: (w, h, g, u, P) => ({
      bg: { kind: 'pattern', pattern: 'grid', color: '#fffaf0' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '0',
      layers: [
        T({ text: 'photo dump', font: 'caveat', size: 26, color: '#43203a', ...P(0.5, 0.07), rotation: -2 }),
        S('tapeHearts', { color: '#ffd9e8', size: 40, ...P(0.16, 0.06), rotation: -24 }),
        S('tapeDots', { color: '#b79cff', size: 40, ...P(0.86, 0.95), rotation: -24 }),
        S('sparkles3', { color: '#ffd84d', size: 24, ...P(0.88, 0.07) }),
        S('torn', { color: '#fffbea', size: 46, text: 'meus dias ♡', ...P(0.2, 0.93), rotation: 6 }),
      ],
    }),
  },
  {
    id: 'p-aniver',
    name: 'Cartaz de aniversário',
    for: ['poster'],
    make: (w, h, g, u, P) => ({
      bg: grad('por-do-sol'),
      frame: { id: 'none', color: '#ffffff' },
      layout: '1c',
      layers: [
        newTextLayer({ text: 'Feliz aniversário!', font: 'pacifico', size: 21, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, ...P(0.5, 0.1), rotation: -3 }),
        newTextLayer({ text: 'NOME', font: 'bungee', size: 20, color: '#ffffff', stroke: { color: '#7a52d1', width: 5 }, ...P(0.5, 0.82) }),
        S('balloon', { color: '#ff5c93', size: 44, ...P(0.13, 0.9), rotation: -12 }),
        S('balloon', { color: '#6fb7ff', size: 38, ...P(0.87, 0.9), rotation: 10 }),
        S('crown', { color: '#ffc93c', size: 30, ...P(0.5, 0.94) }),
        S('sparkles3', { color: '#ffffff', size: 26, ...P(0.9, 0.2) }),
      ],
    }),
  },
  {
    id: 'p-scrap',
    name: 'Página de scrapbook',
    for: ['poster'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'pattern', pattern: 'grid', color: '#fffaf0' },
      frame: { id: 'none', color: '#ffffff' },
      layout: 'scrap',
      layers: [
        T({ text: 'meu álbum ♡', font: 'caveat', size: 24, color: '#b4532f', ...P(0.5, 0.065) }),
        S('tapePlain', { color: '#ffe38a', size: 38, ...P(0.08, 0.13), rotation: -35 }),
        S('tapeDots', { color: '#b79cff', size: 38, ...P(0.94, 0.4), rotation: 35 }),
        S('tapeCheck', { color: '#ff9cc2', size: 38, ...P(0.1, 0.66), rotation: -30 }),
        S('label', { color: '#ff9cc2', size: 48, text: 'meu dia', ...P(0.79, 0.84), rotation: -6 }),
        S('pin', { color: '#6fb7ff', size: 18, ...P(0.74, 0.39) }),
      ],
    }),
  },
  {
    id: 'p-cal',
    name: 'Calendário',
    for: ['poster'],
    make: (w, h, g, u, P) => {
      const size = Math.min(w * 0.66, (h * 0.38) / 1.08);
      return {
        bg: { kind: 'solid', color: '#fff6ef' },
        frame: { id: 'stitch', color: '#ff9cc2' },
        layout: 'cal',
        layers: [
          S('cal', { kind: 'calendar', name: 'calendar', color: '#ff5c93', size, month: new Date().getMonth(), year: new Date().getFullYear(), ...P(0.5, 0.725) }),
          S('hearts3', { color: '#ff5c93', size: 26, ...P(0.12, 0.93) }),
          S('sparkles3', { color: '#ffd84d', size: 26, ...P(0.88, 0.55) }),
        ],
      };
    },
  },
  {
    id: 'p-idol',
    name: 'Pôster idol',
    for: ['poster'],
    make: (w, h, g, u, P) => ({
      bg: { kind: 'solid', color: '#ffffff' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '1',
      layers: [
        newTextLayer({ text: 'NOME', font: 'bungee', size: 30, color: '#ffffff', stroke: { color: '#b4532f', width: 5 }, ...P(0.5, 0.88) }),
        newTextLayer({ text: '2026 ♡', font: 'caveat', size: 18, color: '#ffffff', stroke: { color: '#43203a', width: 3 }, ...P(0.78, 0.07), rotation: 8 }),
        S('lightstick', { color: '#b79cff', size: 40, ...P(0.12, 0.84), rotation: -14 }),
        S('sparkles3', { color: '#ffd84d', size: 30, ...P(0.12, 0.08) }),
      ],
    }),
  },
];

export const templateInfo = (id) => TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];

export function templatesFor(format = 'card') {
  return TEMPLATES.filter((t) => (t.for || SMALL).includes(format));
}

// g = orientação ou o design ({ orientation, format }).
export function makeTemplate(id, g) {
  const t = templateInfo(id);
  const { w, h } = cardSize(g);
  const P = (fx, fy) => ({ x: (fx - 0.5) * w, y: (fy - 0.5) * h });
  const f = formatInfo(g && g.format);
  const gg = typeof g === 'object' && g ? { ...g, faceMm: f.face } : g;
  return t.make(w, h, gg, unitOf(g), P);
}

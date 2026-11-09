// Medidas e modelo do photo card (e dos outros formatos: mini polaroid, marcador, cartão e pôster).
// Tudo é guardado em milímetros, então a tela e o PDF usam a mesma conta.

export const CARD = {
  long: 85, // mm
  short: 53, // mm
  radius: 3, // mm, raio dos cantos arredondados
};

export const PRINT_DPI = 300;
export const PX_PER_MM_PRINT = PRINT_DPI / 25.4;

const CELL_GAP = 1.6; // mm entre as fotos de uma colagem (no photo card)
const CELL_RADIUS = 1.5; // mm

// Formatos. w e h são o tamanho em pé (mm). rotate = pode ficar deitado.
// sides = nome dos dois lados. safe = margem que a impressora pode cortar (só no pôster).
// group = grupo no seletor do editor.
// Bottons (máquina Mecolour): o papel é cortado maior que o botton, porque a sobra dobra por trás.
//   face = diâmetro do botton (o que aparece na frente); w = h = diâmetro do corte do papel.
//   Medidas da Mecolour: 32 mm → arte de 42 mm, 44 mm → 54 mm, 58 mm → 68 mm.
// guide = linha de ajuda dentro da arte (ex.: borda do papelão na capa dura).
// hole = pode ter furo para fitinha (marcadores).
export const FORMATS = [
  { id: 'btn32', group: 'Bottons', name: 'Botton 32 mm', short: '32 mm', w: 42, h: 42, face: 32, circle: true, radius: 21, rotate: false, sides: ['Frente', 'Verso'], noBack: true },
  { id: 'btn44', group: 'Bottons', name: 'Botton 44 mm', short: '44 mm', w: 54, h: 54, face: 44, circle: true, radius: 27, rotate: false, sides: ['Frente', 'Verso'], noBack: true },
  { id: 'btn58', group: 'Bottons', name: 'Botton 58 mm', short: '58 mm', w: 68, h: 68, face: 58, circle: true, radius: 34, rotate: false, sides: ['Frente', 'Verso'], noBack: true },
  { id: 'bookmark', group: 'Marcadores', name: 'Marcador 5 × 15 cm', short: '5 × 15', w: 50, h: 150, radius: 4, rotate: false, sides: ['Frente', 'Verso'], hole: true },
  { id: 'bookmark20', group: 'Marcadores', name: 'Marcador 5 × 20 cm', short: '5 × 20', w: 50, h: 200, radius: 4, rotate: false, sides: ['Frente', 'Verso'], hole: true },
  { id: 'card', group: 'Cartões', name: 'Photo card', short: 'Card', w: 53, h: 85, radius: 3, rotate: true, sides: ['Frente', 'Verso'] },
  { id: 'mini', group: 'Cartões', name: 'Mini polaroid', short: 'Mini', w: 50, h: 60, radius: 2, rotate: true, sides: ['Frente', 'Verso'] },
  { id: 'folded', group: 'Cartões', name: 'Cartão dobrável', short: 'Dobrável', w: 95, h: 133, radius: 0, rotate: false, sides: ['Capa', 'Dentro'] },
  { id: 'cover', group: 'Capas e A4', name: 'Capa A5', short: 'Capa A5', w: 148, h: 210, radius: 0, rotate: false, sides: ['Frente', 'Lado de dentro'], safe: 4 },
  {
    id: 'hardcover',
    group: 'Capas e A4',
    name: 'Capa dura A5',
    short: 'Capa dura',
    w: 182,
    h: 246,
    radius: 0,
    rotate: false,
    sides: ['Frente', 'Lado de dentro'],
    guide: { inset: 15, label: 'borda do papelão' },
  },
  { id: 'poster', group: 'Capas e A4', name: 'Pôster A4', short: 'Pôster', w: 210, h: 297, radius: 0, rotate: true, sides: ['Frente', 'Verso'], safe: 5 },
];

// Furo para fitinha no marcador: círculo de 5 mm, no meio, a 8 mm da beirada de cima.
export const HOLE = { d: 5, top: 8 };

export const formatInfo = (id) => FORMATS.find((f) => f.id === id) || FORMATS.find((f) => f.id === 'card');

// Aceita a orientação ('portrait' | 'landscape') ou qualquer coisa com { orientation, format } (o design).
function geo(g) {
  if (!g || typeof g === 'string') return { orientation: g || 'portrait', format: 'card' };
  // (o formato pode vir sozinho, como { format })
  return { orientation: g.orientation || 'portrait', format: g.format || 'card' };
}

export function cardSize(g) {
  const { orientation, format } = geo(g);
  const f = formatInfo(format);
  return orientation === 'landscape' && f.rotate ? { w: f.h, h: f.w } : { w: f.w, h: f.h };
}

export const cardRadius = (g) => formatInfo(geo(g).format).radius;

// Quanto o formato é maior que o photo card (para molduras, textos e adesivos acompanharem).
export function unitOf(g) {
  const f = formatInfo(geo(g).format);
  return Math.min(f.w, f.h) / CARD.short;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---------- molduras ----------
// inset = largura da borda (mm). A foto fica na "janela" de dentro.
export const FRAMES = [
  { id: 'none', name: 'Sem moldura', inset: 0 },
  { id: 'solid', name: 'Borda', inset: 3 },
  { id: 'polaroid', name: 'Polaroid', inset: 3.5, bottom: 14, bottomLandscape: 11, color: '#ffffff' },
  { id: 'double', name: 'Borda dupla', inset: 4 },
  { id: 'stitch', name: 'Costurinha', inset: 4 },
  { id: 'dots', name: 'Bolinhas', inset: 4.5 },
  { id: 'hearts', name: 'Corações', inset: 5 },
  { id: 'checker', name: 'Xadrez', inset: 4.5 },
  { id: 'stripes', name: 'Listras', inset: 4.5 },
];

export const frameInfo = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];

// Janela da moldura, em mm a partir do canto de cima à esquerda do card.
// g = orientação ou o design (para saber o formato).
export function frameWindow(frame, g) {
  const { w, h } = cardSize(g);
  const f = frameInfo(frame && frame.id);
  if (!f.inset) return { x: 0, y: 0, w, h, r: cardRadius(g) };
  const u = unitOf(g);
  const fmt = formatInfo(geo(g).format);
  if (fmt.circle) {
    // Botton: a moldura é um anel em volta da frente (a sobra que dobra por trás fica da cor da moldura).
    const inset = (w - fmt.face) / 2 + f.inset * u * 0.7;
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset, r: (w - 2 * inset) / 2 };
  }
  const inset = f.inset * u;
  const bottom = f.bottom ? (w > h ? f.bottomLandscape : f.bottom) * u : inset;
  return { x: inset, y: inset, w: w - 2 * inset, h: h - inset - bottom, r: CELL_RADIUS * Math.sqrt(u) };
}

// ---------- colagem ----------
// Cada espaço é [x, y, largura, altura] em frações da janela.
export const LAYOUTS = [
  { id: '0', name: 'Sem foto', cells: [] },
  { id: '1', name: 'Uma foto', cells: [[0, 0, 1, 1]] },
  { id: '2h', name: 'Duas, uma em cima da outra', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: '2v', name: 'Duas, lado a lado', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: '3t', name: 'Três, uma grande em cima', cells: [[0, 0, 1, 0.58], [0, 0.58, 0.5, 0.42], [0.5, 0.58, 0.5, 0.42]] },
  { id: '3r', name: 'Três em fileira', cells: [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]] },
  { id: '3l', name: 'Três, uma grande ao lado', cells: [[0, 0, 0.58, 1], [0.58, 0, 0.42, 0.5], [0.58, 0.5, 0.42, 0.5]] },
  { id: '4', name: 'Quatro', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  // Pôster: mais fotos, e algumas com espaço para um título em cima.
  { id: '6', name: 'Seis', big: true, cells: grid(2, 3) },
  { id: '9', name: 'Nove', big: true, cells: grid(3, 3) },
  { id: '12', name: 'Doze', big: true, cells: grid(3, 4) },
  { id: '5m', name: 'Mosaico', big: true, cells: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.25], [0.5, 0.5, 0.5, 0.25], [0, 0.75, 0.5, 0.25], [0.5, 0.75, 0.5, 0.25]] },
  { id: '6t', name: 'Título e seis', big: true, cells: grid(2, 3, 0.17) },
  { id: '9t', name: 'Título e nove', big: true, cells: grid(3, 3, 0.17) },
  { id: '1c', name: 'Uma no meio', big: true, cells: [[0.1, 0.2, 0.8, 0.52]] },
  { id: 'scrap', name: 'Scrapbook', big: true, cells: [[0.04, 0.13, 0.52, 0.33], [0.46, 0.4, 0.5, 0.3], [0.06, 0.66, 0.5, 0.3]] },
  { id: 'cal', name: 'Foto e calendário', big: true, cells: [[0, 0, 1, 0.46]] },
];

// Grade de colunas x linhas; top = espaço livre em cima (para o título).
function grid(cols, rows, top = 0) {
  const out = [];
  const h = (1 - top) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([c / cols, top + r * h, 1 / cols, h]);
  return out;
}

export const layoutInfo = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[1];

// Espaços das fotos em mm. x/y = canto; cx/cy = centro em relação ao centro do card.
// o = orientação ou o design.
export function cellRects(side, o) {
  const { w, h } = cardSize(o);
  const win = frameWindow(side.frame, o);
  const layout = layoutInfo(side.layout);
  const u = unitOf(o);
  const g = (CELL_GAP * Math.sqrt(u) * (u > 2 ? 1.6 : 1)) / 2;
  return layout.cells.map(([fx, fy, fw, fh]) => {
    const l = fx > 0.001 ? g : 0;
    const r = fx + fw < 0.999 ? g : 0;
    const t = fy > 0.001 ? g : 0;
    const b = fy + fh < 0.999 ? g : 0;
    const x = win.x + fx * win.w + l;
    const y = win.y + fy * win.h + t;
    const cw = fw * win.w - l - r;
    const ch = fh * win.h - t - b;
    return { x, y, w: cw, h: ch, r: layout.cells.length === 1 ? win.r : CELL_RADIUS * Math.sqrt(u), cx: x + cw / 2 - w / 2, cy: y + ch / 2 - h / 2 };
  });
}

// Foto de fundo: ocupa o card inteiro, atrás da moldura e das outras fotos.
export const BG_CELL = -1;

// Espaço de uma foto (o card inteiro, se for a foto de fundo).
export function cellFor(side, o, index) {
  if (index === BG_CELL) {
    const { w, h } = cardSize(o);
    return { x: 0, y: 0, w, h, r: cardRadius(o), cx: 0, cy: 0 };
  }
  return cellRects(side, o)[index] || null;
}

export const isBgPhoto = (l) => !!l && l.type === 'photo' && l.cell === BG_CELL;

// Escala (mm por pixel da imagem) para a foto cobrir um espaço inteiro.
export function coverScale(imgW, imgH, w, h, rotation = 0) {
  const r = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const needW = w * c + h * s;
  const needH = w * s + h * c;
  return Math.max(needW / imgW, needH / imgH);
}

// ---------- modelo do card ----------
export const defaultFx = () => ({ filter: 'normal', brightness: 0, contrast: 0, saturation: 0 });
export const defaultOutline = () => ({ on: false, size: 4, color: '#ffffff' });

export function newSide(layout = '1') {
  return { bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'none', color: '#ffffff' }, layout, layers: [] };
}

// O verso começa sem espaço de foto (dá para pôr uma em "Colagem" ou escolhendo uma foto).
export function newDesign(orientation = 'portrait', format = 'btn44') {
  const f = formatInfo(format);
  const d = { v: 2, format: f.id, orientation: f.rotate ? orientation : 'portrait', front: newSide('1'), back: newSide('0') };
  if (f.id === 'mini') d.front.frame = { id: 'polaroid', color: '#ffffff' };
  return d;
}

export function newPhotoLayer(imageKey, cell, img, rect) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  return {
    id: uid(),
    type: 'photo',
    cell,
    imageKey,
    originalKey: null,
    bgOps: null,
    x: 0,
    y: 0,
    scale: coverScale(iw, ih, rect.w, rect.h, 0),
    rotation: 0,
    flip: false,
    fx: defaultFx(),
    outline: defaultOutline(),
  };
}

export function newTextLayer(props = {}) {
  return {
    id: uid(),
    type: 'text',
    text: 'Seu texto',
    font: 'fredoka',
    size: 7,
    color: '#b4532f',
    stroke: { color: '#ffffff', width: 4 },
    shadow: false,
    align: 'center',
    x: 0,
    y: 0,
    rotation: 0,
    ...props,
  };
}

// kind: 'shape' (desenho), 'emoji', 'image' (meu adesivo ou foto solta) ou 'calendar'.
export function newStickerLayer(props = {}) {
  return { id: uid(), type: 'sticker', kind: 'shape', name: 'heart', color: '#ff5c93', size: 14, x: 0, y: 0, rotation: 0, flip: false, ...props };
}

// Desenho à mão: riscos guardados em mm. Enquanto desenha, base = size = 1 e x = y = 0
// (os pontos ficam na conta do card); no fim, o desenho é centralizado e ganha tamanho.
export function newDrawLayer() {
  return { id: uid(), type: 'draw', strokes: [], base: 1, size: 1, bw: 0, bh: 0, x: 0, y: 0, rotation: 0 };
}

// Ajusta um desenho recém-feito: centro no meio dos riscos e caixa do tamanho deles.
export function finishDrawLayer(layer) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const st of layer.strokes) {
    const r = st.w / 2 + (st.pen === 'glow' ? st.w : 0);
    for (let i = 0; i < st.pts.length; i += 2) {
      x0 = Math.min(x0, st.pts[i] - r);
      x1 = Math.max(x1, st.pts[i] + r);
      y0 = Math.min(y0, st.pts[i + 1] - r);
      y1 = Math.max(y1, st.pts[i + 1] + r);
    }
  }
  if (!isFinite(x0)) return false;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  for (const st of layer.strokes) {
    for (let i = 0; i < st.pts.length; i += 2) {
      st.pts[i] = Math.round((st.pts[i] - cx) * 100) / 100;
      st.pts[i + 1] = Math.round((st.pts[i + 1] - cy) * 100) / 100;
    }
  }
  layer.bw = x1 - x0;
  layer.bh = y1 - y0;
  layer.base = Math.max(layer.bw, layer.bh, 1);
  layer.size = layer.base;
  layer.x = cx;
  layer.y = cy;
  layer.rotation = 0;
  return true;
}

// O lado tem alguma coisa além do fundo branco liso?
export function sideHasContent(side) {
  if (!side) return false;
  return (
    side.layers.length > 0 ||
    side.bg.kind !== 'solid' ||
    String(side.bg.color).toLowerCase() !== '#ffffff' ||
    side.frame.id !== 'none'
  );
}

// Chaves de todas as fotos usadas no card (para guardar só o que precisa).
export function imageKeys(design) {
  const keys = new Set();
  for (const s of [design.front, design.back]) {
    for (const l of s.layers) {
      if (l.type === 'sticker' && l.kind === 'image' && l.imageKey) keys.add(l.imageKey);
      if (l.type !== 'photo') continue;
      if (l.imageKey) keys.add(l.imageKey);
      if (l.originalKey) keys.add(l.originalKey);
    }
  }
  return keys;
}

// Cards guardados antes da versão com textos e adesivos: uma foto só, sem moldura.
export function migrateRecord(rec) {
  if (!rec || rec.kind === 'sticker' || (rec.v === 2 && rec.design && rec.design.front)) return rec;
  const old = rec.design || {};
  const t = old.transform || { x: 0, y: 0, scale: 1, rotation: 0, flip: false };
  const design = newDesign(old.orientation || 'portrait', 'card');
  design.front.bg = { kind: 'solid', color: old.bg || '#ffffff' };
  const images = {};
  if (rec.imageBlob) {
    images.a = rec.imageBlob;
    if (rec.originalBlob) images.o = rec.originalBlob;
    design.front.layers.push({
      id: uid(),
      type: 'photo',
      cell: 0,
      imageKey: 'a',
      originalKey: rec.originalBlob ? 'o' : null,
      bgOps: rec.originalBlob ? rec.bgOps || null : null,
      x: t.x,
      y: t.y,
      scale: t.scale,
      rotation: t.rotation,
      flip: !!t.flip,
      fx: defaultFx(),
      outline: defaultOutline(),
    });
  }
  // foto de fundo ("Pôr fundo") da versão anterior
  const bt = old.bgTransform;
  if (rec.layerBlob && bt) {
    images.f = rec.layerBlob;
    design.front.layers.unshift({
      id: uid(),
      type: 'photo',
      cell: BG_CELL,
      imageKey: 'f',
      originalKey: null,
      bgOps: null,
      x: bt.x,
      y: bt.y,
      scale: bt.scale,
      rotation: bt.rotation,
      flip: !!bt.flip,
      fx: defaultFx(),
      outline: defaultOutline(),
    });
  }
  return { id: rec.id, createdAt: rec.createdAt, copies: rec.copies || 1, v: 2, design, images, thumbBlob: rec.thumbBlob };
}

// ---------- cores ----------
export function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

// amt > 0 clareia, amt < 0 escurece.
export function shade(hex, amt) {
  const c = hexToRgb(hex);
  const target = amt > 0 ? 255 : 0;
  const a = Math.abs(amt);
  return rgbToHex(c.map((v) => v + (target - v) * a));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return rgbToHex([f(0), f(8), f(4)]);
}

// Cor do desenho por cima de uma cor de fundo (bolinhas, listras…):
// num fundo clarinho, a mesma cor mais forte; num fundo escuro, branco.
export function inkFor(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.05 && l > 0.9) return '#ffa8c8';
  if (l > 0.66) return hslToHex([h, Math.min(1, s * 0.9 + 0.25), l - 0.17]);
  return '#ffffff';
}

// Desenho da moldura: branco, a não ser que a moldura seja bem clarinha.
export function frameInk(hex) {
  return rgbToHsl(hexToRgb(hex))[2] > 0.88 ? inkFor(hex) : '#ffffff';
}

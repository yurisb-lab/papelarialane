// Removedor de fundo por cor. Roda separado da tela para o tablet não travar.
//
// Como funciona: a partir de pontos de partida (as bordas da foto, ou o lugar onde ela tocou),
// "pinta" para os vizinhos enquanto a cor for parecida com a do fundo. Só apaga o que está
// ligado ao ponto de partida, então uma roupa da mesma cor do fundo, mas separada dele, fica.
// Na beirada do desenho a transparência é gradual e a cor do fundo é tirada dos pixels,
// para não sobrar uma "auréola".

let src = null; // pixels originais (RGBA)
let w = 0;
let h = 0;
let stamp = null; // marca de visitado por operação
let owner = null; // qual operação apagou cada pixel (0 = nenhuma)
let stack = null;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'load') {
    src = new Uint8ClampedArray(msg.buffer);
    w = msg.w;
    h = msg.h;
    stamp = new Uint8Array(w * h);
    owner = new Uint8Array(w * h);
    stack = new Int32Array(w * h);
    self.postMessage({ type: 'loaded', id: msg.id });
  } else if (msg.type === 'run') {
    const t0 = performance.now();
    const { buffer, refs, coverage } = run(msg.ops, msg.tolerance);
    self.postMessage({ type: 'result', id: msg.id, buffer, refs, coverage, ms: performance.now() - t0 }, [buffer]);
  }
};

// Distância de cor "redmean": simples e bem mais parecida com o olho humano que RGB puro.
function dist(r1, g1, b1, r2, g2, b2) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

// Cor mais comum na borda da foto.
function borderColor() {
  const bins = new Map();
  const add = (i) => {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    if (src[i + 3] < 128) return;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { n: 0, r: 0, g: 0, b: 0 }));
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
  };
  for (let x = 0; x < w; x++) {
    add(x * 4);
    add(((h - 1) * w + x) * 4);
  }
  for (let y = 1; y < h - 1; y++) {
    add(y * w * 4);
    add((y * w + w - 1) * 4);
  }
  let best = null;
  for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin;
  if (!best) return [255, 255, 255];
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

// Cor média em volta do toque (3x3), para um pixel solto não atrapalhar.
function colorAt(x, y) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const i = (yy * w + xx) * 4;
      r += src[i];
      g += src[i + 1];
      b += src[i + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

function run(ops, tolerance) {
  const thr = tolerance * 2.4; // força 1–100 -> distância de cor
  const soft = Math.max(28, thr * 0.9); // largura da beirada suave
  owner.fill(0);
  const refs = [];
  let sp = 0;
  let borderTotal = 0;
  let borderMatch = 0;

  ops.forEach((op, k) => {
    const id = k + 1;
    stamp.fill(0);
    const ref = op.kind === 'edges' ? borderColor() : colorAt(Math.round(op.x), Math.round(op.y));
    refs.push(ref);
    const [rr, rg, rb] = ref;
    const near = (p) => {
      const i = p * 4;
      // pixels já transparentes na foto original também contam como fundo
      return src[i + 3] < 16 || dist(src[i], src[i + 1], src[i + 2], rr, rg, rb) <= thr;
    };
    const seed = (p) => {
      if (stamp[p]) return;
      stamp[p] = 1;
      if (near(p)) stack[sp++] = p;
    };

    if (op.kind === 'edges') {
      for (let x = 0; x < w; x++) {
        seed(x);
        seed((h - 1) * w + x);
      }
      for (let y = 1; y < h - 1; y++) {
        seed(y * w);
        seed(y * w + w - 1);
      }
      borderTotal = 2 * w + 2 * (h - 2);
      borderMatch = sp;
    } else {
      const x = Math.round(op.x);
      const y = Math.round(op.y);
      if (x >= 0 && y >= 0 && x < w && y < h) {
        const p = y * w + x;
        stamp[p] = 1;
        stack[sp++] = p; // o ponto tocado sempre entra
      }
    }

    while (sp > 0) {
      const p = stack[--sp];
      if (!owner[p]) owner[p] = id;
      const x = p % w;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (p >= w) seed(p - w);
      if (p < w * (h - 1)) seed(p + w);
    }
  });

  // Monta o resultado.
  const out = new Uint8ClampedArray(src);
  const n = w * h;
  for (let p = 0; p < n; p++) if (owner[p]) out[p * 4 + 3] = 0;

  // Beirada suave: 2 pixels em volta da área apagada.
  if (ops.length) {
    stamp.fill(0);
    let ring = [];
    for (let p = 0; p < n; p++) {
      if (owner[p]) continue;
      const x = p % w;
      const o =
        (x > 0 && owner[p - 1]) || (x < w - 1 && owner[p + 1]) || (p >= w && owner[p - w]) || (p < n - w && owner[p + w]);
      if (o) {
        stamp[p] = o;
        ring.push(p);
      }
    }
    const second = [];
    for (const p of ring) {
      const x = p % w;
      const o = stamp[p];
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < n && !owner[q] && !stamp[q]) {
          stamp[q] = o;
          second.push(q);
        }
      }
    }
    ring = ring.concat(second);
    for (const p of ring) {
      const [rr, rg, rb] = refs[stamp[p] - 1];
      const i = p * 4;
      const d = dist(src[i], src[i + 1], src[i + 2], rr, rg, rb);
      const a = Math.min(1, Math.max(0, (d - thr) / soft));
      if (a >= 1) continue;
      if (a < 0.04) {
        out[i + 3] = 0;
        continue;
      }
      // tira a cor do fundo que "vazou" na beirada
      out[i] = (src[i] - (1 - a) * rr) / a;
      out[i + 1] = (src[i + 1] - (1 - a) * rg) / a;
      out[i + 2] = (src[i + 2] - (1 - a) * rb) / a;
      out[i + 3] = src[i + 3] * a;
    }
  }

  return {
    buffer: out.buffer,
    refs,
    coverage: borderTotal ? borderMatch / borderTotal : 1,
  };
}

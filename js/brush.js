// Borracha e restaurar do "tirar fundo": prévia da pincelada enquanto o dedo passa.
// O resultado certinho (com a borda macia) é refeito pelo js/bg-worker.js quando o dedo sai.

export const BRUSH_SIZES = { min: 6, max: 60, def: 22 }; // raio do pincel em px da tela

// Ferramentas do painel "Tirar fundo".
export const BG_TOOLS = [
  { id: 'point', name: 'Tocar na cor', icon: 'wand', help: (tap) => `${tap} na cor que quer apagar: some ela e o que estiver ligado a ela.` },
  { id: 'color', name: 'Cor na foto toda', icon: 'sparkle', help: (tap) => `${tap} numa cor: ela some da foto inteira, até nos buraquinhos (entre os braços, dentro das letras).` },
  { id: 'erase', name: 'Borracha', icon: 'eraser', help: () => 'Passe o dedo onde quer apagar.' },
  { id: 'restore', name: 'Restaurar', icon: 'brush', help: () => 'Passe o dedo onde apagou demais: a foto volta.' },
];

export const isBrushTool = (t) => t === 'erase' || t === 'restore';

// Pincelada nova (em pixels da foto). r = raio do pincel na foto.
export function newStroke(kind, pt, r) {
  return { kind, r: Math.round(r * 10) / 10, pts: [round1(pt.x), round1(pt.y)] };
}

const round1 = (v) => Math.round(v * 10) / 10;

// Junta um ponto à pincelada (pula pontos muito perto, para o desenho guardado ficar leve).
// Devolve o ponto anterior (para desenhar o pedaço novo) ou null se não juntou.
export function extendStroke(st, pt) {
  const n = st.pts.length;
  const lx = st.pts[n - 2];
  const ly = st.pts[n - 1];
  if (Math.hypot(pt.x - lx, pt.y - ly) < Math.max(1, st.r * 0.3)) return null;
  if (n >= 2400) return null;
  st.pts.push(round1(pt.x), round1(pt.y));
  return { x: lx, y: ly };
}

// Desenha o pedaço de a até b direto no resultado. original = a foto sem nada apagado.
export function paintPreview(result, original, kind, r, a, b) {
  const ctx = result.getContext('2d');
  ctx.save();
  if (kind === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
  } else {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / (r * 0.35)));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.clearRect(0, 0, result.width, result.height);
    ctx.drawImage(original, 0, 0, result.width, result.height);
  }
  ctx.restore();
}

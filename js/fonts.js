// Fontes dos textos do card. Os arquivos ficam em fonts/ (veja css/fonts.css).

export const FONTS = [
  { id: 'fredoka', family: 'Fredoka', weight: 600, name: 'Fofinha' },
  { id: 'pacifico', family: 'Pacifico', weight: 400, name: 'Pacifico' },
  { id: 'caveat', family: 'Caveat', weight: 700, name: 'Caneta' },
  { id: 'bubbles', family: 'Rubik Bubbles', weight: 400, name: 'Bolhas' },
  { id: 'lobster', family: 'Lobster', weight: 400, name: 'Lobster' },
  { id: 'marker', family: 'Permanent Marker', weight: 400, name: 'Marcador' },
  { id: 'dancing', family: 'Dancing Script', weight: 700, name: 'Elegante' },
  { id: 'bungee', family: 'Bungee', weight: 400, name: 'Bloco' },
  { id: 'nunito', family: 'Nunito', weight: 800, name: 'Simples' },
];

export const fontInfo = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

export function cssFont(id, px) {
  const f = fontInfo(id);
  return `${f.weight} ${px}px "${f.family}", "Nunito", sans-serif`;
}

// Espera as fontes usadas no card ficarem prontas (para o PDF e as miniaturas saírem certos).
export async function ensureFonts(designs) {
  const ids = new Set(['fredoka', 'nunito']); // usadas nos adesivos com texto e no calendário
  for (const d of [].concat(designs)) {
    for (const s of [d.front, d.back]) for (const l of s.layers) if (l.type === 'text') ids.add(l.font);
  }
  await loadFonts([...ids]);
}

export async function loadFonts(ids = FONTS.map((f) => f.id)) {
  if (!document.fonts || !document.fonts.load) return;
  await Promise.all(ids.map((id) => document.fonts.load(cssFont(id, 40), 'AaÇçãé♡').catch(() => {})));
}

// Fontes dos textos do card. Os arquivos ficam em fonts/ (veja css/fonts.css).

// Grupos da escolha de letra (na ordem em que aparecem).
export const FONT_GROUPS = [
  { id: 'caligrafia', name: 'Caligrafia' },
  { id: 'pincel', name: 'Pincel e caneta' },
  { id: 'serifa', name: 'Serifa chique' },
  { id: 'moderna', name: 'Moderna' },
  { id: 'fofa', name: 'Fofa' },
];

export const FONTS = [
  { id: 'fredoka', family: 'Fredoka', weight: 600, name: 'Fofinha', cat: 'fofa' },
  { id: 'pacifico', family: 'Pacifico', weight: 400, name: 'Pacifico', cat: 'pincel' },
  { id: 'caveat', family: 'Caveat', weight: 700, name: 'Caneta', cat: 'pincel' },
  { id: 'bubbles', family: 'Rubik Bubbles', weight: 400, name: 'Bolhas', cat: 'fofa' },
  { id: 'lobster', family: 'Lobster', weight: 400, name: 'Lobster', cat: 'pincel' },
  { id: 'marker', family: 'Permanent Marker', weight: 400, name: 'Marcador', cat: 'pincel' },
  { id: 'dancing', family: 'Dancing Script', weight: 700, name: 'Elegante', cat: 'caligrafia' },
  { id: 'bungee', family: 'Bungee', weight: 400, name: 'Bloco', cat: 'fofa' },
  { id: 'nunito', family: 'Nunito', weight: 800, name: 'Simples', cat: 'moderna' },
  { id: 'great-vibes', family: 'Great Vibes', weight: 400, name: 'Great Vibes', cat: 'caligrafia' },
  { id: 'pinyon-script', family: 'Pinyon Script', weight: 400, name: 'Pinyon Script', cat: 'caligrafia' },
  { id: 'allura', family: 'Allura', weight: 400, name: 'Allura', cat: 'caligrafia' },
  { id: 'parisienne', family: 'Parisienne', weight: 400, name: 'Parisienne', cat: 'caligrafia' },
  { id: 'alex-brush', family: 'Alex Brush', weight: 400, name: 'Alex Brush', cat: 'caligrafia' },
  { id: 'italianno', family: 'Italianno', weight: 400, name: 'Italianno', cat: 'caligrafia' },
  { id: 'monsieur-la-doulaise', family: 'Monsieur La Doulaise', weight: 400, name: 'Monsieur La Doulaise', cat: 'caligrafia' },
  { id: 'mrs-saint-delafield', family: 'Mrs Saint Delafield', weight: 400, name: 'Mrs Saint Delafield', cat: 'caligrafia' },
  { id: 'corinthia', family: 'Corinthia', weight: 700, name: 'Corinthia', cat: 'caligrafia' },
  { id: 'birthstone', family: 'Birthstone', weight: 400, name: 'Birthstone', cat: 'caligrafia' },
  { id: 'sacramento', family: 'Sacramento', weight: 400, name: 'Sacramento', cat: 'pincel' },
  { id: 'satisfy', family: 'Satisfy', weight: 400, name: 'Satisfy', cat: 'pincel' },
  { id: 'yellowtail', family: 'Yellowtail', weight: 400, name: 'Yellowtail', cat: 'pincel' },
  { id: 'kaushan-script', family: 'Kaushan Script', weight: 400, name: 'Kaushan Script', cat: 'pincel' },
  { id: 'damion', family: 'Damion', weight: 400, name: 'Damion', cat: 'pincel' },
  { id: 'playball', family: 'Playball', weight: 400, name: 'Playball', cat: 'pincel' },
  { id: 'cormorant-garamond', family: 'Cormorant Garamond', weight: 600, name: 'Cormorant Garamond', cat: 'serifa' },
  { id: 'playfair-display', family: 'Playfair Display', weight: 700, name: 'Playfair Display', cat: 'serifa' },
  { id: 'bodoni-moda', family: 'Bodoni Moda', weight: 600, name: 'Bodoni Moda', cat: 'serifa' },
  { id: 'cinzel', family: 'Cinzel', weight: 600, name: 'Cinzel', cat: 'serifa' },
  { id: 'cinzel-decorative', family: 'Cinzel Decorative', weight: 700, name: 'Cinzel Decorative', cat: 'serifa' },
  { id: 'italiana', family: 'Italiana', weight: 400, name: 'Italiana', cat: 'serifa' },
  { id: 'gilda-display', family: 'Gilda Display', weight: 400, name: 'Gilda Display', cat: 'serifa' },
  { id: 'dm-serif-display', family: 'DM Serif Display', weight: 400, name: 'DM Serif Display', cat: 'serifa' },
  { id: 'yeseva-one', family: 'Yeseva One', weight: 400, name: 'Yeseva One', cat: 'serifa' },
  { id: 'abril-fatface', family: 'Abril Fatface', weight: 400, name: 'Abril Fatface', cat: 'serifa' },
  { id: 'montserrat', family: 'Montserrat', weight: 600, name: 'Montserrat', cat: 'moderna' },
  { id: 'josefin-sans', family: 'Josefin Sans', weight: 600, name: 'Josefin Sans', cat: 'moderna' },
  { id: 'raleway', family: 'Raleway', weight: 600, name: 'Raleway', cat: 'moderna' },
  { id: 'jost', family: 'Jost', weight: 500, name: 'Jost', cat: 'moderna' },
  { id: 'tenor-sans', family: 'Tenor Sans', weight: 400, name: 'Tenor Sans', cat: 'moderna' },
  { id: 'baloo-2', family: 'Baloo 2', weight: 700, name: 'Baloo 2', cat: 'fofa' },
  { id: 'chewy', family: 'Chewy', weight: 400, name: 'Chewy', cat: 'fofa' },
  { id: 'titan-one', family: 'Titan One', weight: 400, name: 'Titan One', cat: 'fofa' },
  { id: 'bagel-fat-one', family: 'Bagel Fat One', weight: 400, name: 'Bagel Fat One', cat: 'fofa' },
  { id: 'grandstander', family: 'Grandstander', weight: 700, name: 'Grandstander', cat: 'fofa' },
];

// Pares prontos: uma letra para o título (o texto escolhido) e outra para os outros textos do lado.
export const FONT_PAIRS = [
  { id: 'casamento', name: 'Casamento', title: 'great-vibes', body: 'cormorant-garamond' },
  { id: 'classico', name: 'Clássico', title: 'playfair-display', body: 'montserrat' },
  { id: 'realeza', name: 'Realeza', title: 'pinyon-script', body: 'cinzel' },
  { id: 'delicado', name: 'Delicado', title: 'sacramento', body: 'josefin-sans' },
  { id: 'revista', name: 'Revista', title: 'bodoni-moda', body: 'raleway' },
  { id: 'boutique', name: 'Boutique', title: 'parisienne', body: 'tenor-sans' },
  { id: 'moderno', name: 'Moderno', title: 'yeseva-one', body: 'jost' },
  { id: 'infantil', name: 'Infantil', title: 'baloo-2', body: 'nunito' },
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

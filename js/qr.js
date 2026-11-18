// QR code (para cartão de agradecimento, Instagram, WhatsApp, Pix…). Feito no aparelho, sem internet.
// Usa o gerador de Kazuhiko Arase (vendor/qrcode.mjs, licença MIT).

import qrcode from '../vendor/qrcode.mjs';

// Acentos e emojis do texto vão em UTF-8 (o que os celulares esperam).
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

export const QR_MAX = 300; // letras

const cache = new Map();

// Quadradinhos do QR: { n, dark(row, col) }, ou null se o texto estiver vazio.
export function qrMatrix(text) {
  const t = String(text || '').trim().slice(0, QR_MAX);
  if (!t) return null;
  if (cache.has(t)) return cache.get(t);
  let m = null;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(t);
    qr.make();
    const n = qr.getModuleCount();
    const bits = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits[r * n + c] = qr.isDark(r, c) ? 1 : 0;
    m = { n, dark: (r, c) => bits[r * n + c] === 1 };
  } catch (_) {
    m = null;
  }
  if (cache.size > 40) cache.clear();
  cache.set(t, m);
  return m;
}

// Desenha o QR centrado em (0, 0), com lado s (px). Tem 2 quadradinhos de margem em volta.
export function drawQr(ctx, text, s, color = '#2a1d25', bg = '#ffffff') {
  const m = qrMatrix(text);
  const total = m ? m.n + 4 : 25;
  const cell = s / total;
  ctx.save();
  ctx.translate(-s / 2, -s / 2);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
  }
  ctx.fillStyle = color || '#2a1d25';
  if (!m) {
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cell * 2, cell * 2, s - cell * 4, s - cell * 4);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  for (let r = 0; r < m.n; r++) {
    for (let c = 0; c < m.n; c++) {
      // um pouquinho maior, para não aparecer fresta entre os quadradinhos
      if (m.dark(r, c)) ctx.rect((c + 2) * cell - 0.02 * cell, (r + 2) * cell - 0.02 * cell, cell * 1.04, cell * 1.04);
    }
  }
  ctx.fill();
  ctx.restore();
}

// Atalhos para montar o endereço.
export function qrFromPreset(kind, value) {
  const v = String(value || '').trim();
  if (kind === 'instagram') return `https://instagram.com/${v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`;
  if (kind === 'whatsapp') {
    const d = v.replace(/\D/g, '');
    return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
  }
  return v;
}

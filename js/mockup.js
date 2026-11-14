// Prévia realista do botton: a arte como fica depois de prensada na Mecolour.
// - frente: só aparece o círculo do botton; a beirada da arte curva na borda (fica um pouco espremida)
//   e o resto vai para trás. Por cima, o brilho do plástico (ou fosco) e a sombra da borda arredondada.
// - verso: o fundo de metal com o alfinete, e um fio da arte aparecendo na beirada.
// Tudo em canvas, para dar para salvar a prévia como imagem.

import { formatInfo } from './card.js';
import { renderImage } from './render.js';
import { ensureFonts } from './fonts.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ROLL_MM = 2.2; // quanto da sobra aparece "dobrando" na borda arredondada, visto de frente

// Arte do lado da frente, com o corte inteiro (o que vai para a máquina), em pxPerMm.
export async function buttonArt(design, getImg, pxPerMm) {
  await ensureFonts(design);
  return renderImage(design, 'front', getImg, pxPerMm);
}

// Lê os pixels da arte uma vez (com leitura suavizada entre pixels).
function sampler(art) {
  const w = art.width;
  const h = art.height;
  const data = art.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const px = (x, y, out) => {
    x = clamp(x, 0, w - 1);
    y = clamp(y, 0, h - 1);
    const i = (y * w + x) * 4;
    out[0] = data[i];
    out[1] = data[i + 1];
    out[2] = data[i + 2];
    out[3] = data[i + 3];
  };
  const a = [0, 0, 0, 0];
  const b = [0, 0, 0, 0];
  const c = [0, 0, 0, 0];
  const d = [0, 0, 0, 0];
  return (x, y, out) => {
    x -= 0.5;
    y -= 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    px(x0, y0, a);
    px(x0 + 1, y0, b);
    px(x0, y0 + 1, c);
    px(x0 + 1, y0 + 1, d);
    for (let k = 0; k < 4; k++) out[k] = (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy;
  };
}

// Frente do botton (sem luz), S × S px: a arte "esticada" na cúpula, com fundo branco onde a arte for transparente.
export function buildFace(art, format, S) {
  const f = formatInfo(format);
  const R = f.face / 2; // mm
  const roll = Math.min(ROLL_MM, (f.w - f.face) / 2);
  const ppm = art.width / f.w;
  const acx = art.width / 2;
  const acy = art.height / 2;
  const read = sampler(art);
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(S, S);
  const D = img.data;
  const half = S / 2;
  const px = [0, 0, 0, 0];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const rho = Math.hypot(dx, dy);
      const edge = clamp((1 - rho) * half + 0.5, 0, 1); // borda lisinha
      if (edge <= 0) continue;
      // cúpula: o meio fica um tiquinho maior; perto da borda, a sobra entra espremida
      const rmm = R * rho * (0.97 + 0.03 * rho * rho) + roll * Math.pow(smooth(0.86, 1, rho), 2);
      const s = rho > 0 ? rmm / rho : 0;
      read(acx + dx * s * ppm, acy + dy * s * ppm, px);
      // papel branco por baixo do que for transparente
      const al = px[3] / 255;
      let r = px[0] * al + 255 * (1 - al);
      let g = px[1] * al + 255 * (1 - al);
      let b = px[2] * al + 255 * (1 - al);
      // a borda arredondada recebe menos luz
      const occ = 1 - 0.22 * Math.pow(smooth(0.8, 1, rho), 1.6);
      r *= occ;
      g *= occ;
      b *= occ;
      const i = (y * S + x) * 4;
      D[i] = r;
      D[i + 1] = g;
      D[i + 2] = b;
      D[i + 3] = 255 * edge;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// Máscara da borda (anel) usada para o claro/escuro da curva.
function ringMask(S) {
  const m = document.createElement('canvas');
  m.width = m.height = S;
  const ctx = m.getContext('2d');
  const h = S / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.78, 'rgba(0,0,0,0)');
  g.addColorStop(0.95, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return m;
}

// Desenha a frente com a luz. light = { x, y } de -1 a 1 (de onde vem a luz); finish = 'gloss' | 'matte'.
export function createFacePainter(face) {
  const S = face.width;
  const h = S / 2;
  const mask = ringMask(S);
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = S;
  const tctx = tmp.getContext('2d');

  return function paint(ctx, { x = -0.45, y = -0.55, finish = 'gloss' } = {}, ox = 0, oy = 0) {
    const len = Math.hypot(x, y) || 1;
    const lx = x / len;
    const ly = y / len;
    const strength = clamp(Math.hypot(x, y), 0.25, 1);
    const gloss = finish === 'gloss';

    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(face, 0, 0);
    ctx.beginPath();
    ctx.arc(h, h, h, 0, Math.PI * 2);
    ctx.clip();

    // curva da borda: clara do lado da luz, escura do outro
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, S, S);
    const lg = tctx.createLinearGradient(h + lx * h, h + ly * h, h - lx * h, h - ly * h);
    lg.addColorStop(0, `rgba(255,255,255,${0.55 * strength})`);
    lg.addColorStop(0.45, 'rgba(255,255,255,0)');
    lg.addColorStop(0.6, 'rgba(0,0,0,0)');
    lg.addColorStop(1, `rgba(20,10,5,${0.42 * strength})`);
    tctx.fillStyle = lg;
    tctx.fillRect(0, 0, S, S);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(mask, 0, 0);
    ctx.drawImage(tmp, 0, 0);

    // reflexo largo do plástico
    ctx.globalCompositeOperation = 'screen';
    const sx = h + lx * h * 0.42;
    const sy = h + ly * h * 0.42;
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * (gloss ? 0.62 : 0.9));
    rg.addColorStop(0, `rgba(255,255,255,${(gloss ? 0.5 : 0.16) * strength})`);
    rg.addColorStop(0.5, `rgba(255,255,255,${(gloss ? 0.14 : 0.06) * strength})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, S, S);

    if (gloss) {
      // pontinho de luz forte, esticado acompanhando a curva
      const px = h + lx * h * 0.6;
      const py = h + ly * h * 0.6;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(ly, lx) + Math.PI / 2);
      ctx.scale(1, 0.42);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.22);
      sg.addColorStop(0, `rgba(255,255,255,${0.85 * strength})`);
      sg.addColorStop(0.35, `rgba(255,255,255,${0.35 * strength})`);
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // fio de luz na beirada, do lado da luz
      const ang = Math.atan2(ly, lx);
      ctx.lineWidth = S * 0.012;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * strength})`;
      ctx.beginPath();
      ctx.arc(h, h, h * 0.965, ang - 0.55, ang + 0.55);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // filme plástico: um véu bem leve por cima de tudo
    ctx.fillStyle = gloss ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
  };
}

// Verso: fundo de metal com alfinete. Na beirada aparece um fio da arte (a sobra que dobrou para trás).
export function buildBack(art, format, S, { x = -0.45, y = -0.55 } = {}) {
  const f = formatInfo(format);
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const ctx = out.getContext('2d');
  const h = S / 2;

  // fio da arte na beirada (espelhado, porque é visto de trás)
  ctx.save();
  ctx.beginPath();
  ctx.arc(h, h, h, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S, 0);
  ctx.scale(-1, 1);
  const k = S / (f.face + 2); // a sobra fica bem espremida aqui
  const aw = f.w * k;
  ctx.drawImage(art, h - aw / 2, h - aw / 2, aw, aw);
  ctx.restore();

  // anel de metal (a "tampa" que prende o papel)
  const metal = (r, a, b) => {
    const g = ctx.createLinearGradient(h + x * r, h + y * r, h - x * r, h - y * r);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  ctx.beginPath();
  ctx.arc(h, h, h * 0.94, 0, Math.PI * 2);
  ctx.fillStyle = metal(h, '#f1f2f4', '#8d9095');
  ctx.fill();
  // degrau do fundo
  ctx.beginPath();
  ctx.arc(h, h, h * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = metal(h, '#9a9da2', '#eceef0');
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h, h, h * 0.79, 0, Math.PI * 2);
  ctx.fillStyle = metal(h, '#e3e5e8', '#a7aaaf');
  ctx.fill();
  // riscos finos do metal escovado
  ctx.save();
  ctx.beginPath();
  ctx.arc(h, h, h * 0.79, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let r = h * 0.05; r < h * 0.79; r += S * 0.006) {
    ctx.beginPath();
    ctx.arc(h, h, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // alfinete: barra com a mola de um lado e o fecho do outro
  const pinY = h - h * 0.12;
  const x0 = h - h * 0.6;
  const x1 = h + h * 0.6;
  const lw = Math.max(2, S * 0.018);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetX = -x * S * 0.012;
  ctx.shadowOffsetY = -y * S * 0.012;
  // base presa no metal
  ctx.fillStyle = metal(h * 0.3, '#f4f5f6', '#9a9da2');
  ctx.beginPath();
  ctx.roundRect(x0 - S * 0.02, pinY - S * 0.03, x1 - x0 + S * 0.04, S * 0.06, S * 0.03);
  ctx.fill();
  // agulha
  ctx.strokeStyle = metal(h * 0.3, '#ffffff', '#7e8186');
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0 + S * 0.03, pinY - S * 0.045);
  ctx.lineTo(x1 - S * 0.05, pinY - S * 0.065);
  ctx.stroke();
  // mola
  ctx.beginPath();
  ctx.arc(x0 + S * 0.01, pinY - S * 0.02, S * 0.035, 0, Math.PI * 2);
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  // fecho
  ctx.fillStyle = metal(h * 0.3, '#f7f7f8', '#8d9095');
  ctx.beginPath();
  ctx.roundRect(x1 - S * 0.07, pinY - S * 0.1, S * 0.08, S * 0.1, S * 0.02);
  ctx.fill();
  ctx.restore();

  // sombra da borda
  ctx.save();
  ctx.beginPath();
  ctx.arc(h, h, h, 0, Math.PI * 2);
  ctx.clip();
  const vg = ctx.createRadialGradient(h, h, h * 0.85, h, h, h);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  return out;
}

// Cor da lateral do botton (a sobra que dá a volta na borda): a arte inteira, escurecida.
export function sideTexture(art, size = 240) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(art, 0, 0, size, size);
  ctx.fillStyle = 'rgba(30,15,10,0.22)';
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Imagem para salvar: o botton com sombra, fundo transparente.
export function mockupImage(paintFront, back, S, { side = 'front', light, finish }) {
  const pad = Math.round(S * 0.14);
  const c = document.createElement('canvas');
  c.width = c.height = S + pad * 2;
  const ctx = c.getContext('2d');
  const h = S / 2;
  const lx = light && light.x != null ? light.x : -0.45;
  const ly = light && light.y != null ? light.y : -0.55;
  ctx.save();
  ctx.shadowColor = 'rgba(40,20,10,0.35)';
  ctx.shadowBlur = S * 0.06;
  ctx.shadowOffsetX = -lx * S * 0.04;
  ctx.shadowOffsetY = -ly * S * 0.05;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pad + h, pad + h, h * 0.99, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (side === 'back') ctx.drawImage(back, pad, pad, S, S);
  else paintFront(ctx, { x: lx, y: ly, finish }, pad, pad);
  return c;
}

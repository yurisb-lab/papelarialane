// Janelinha "Ver botton pronto": a arte como fica depois de prensada, com a cúpula, o brilho
// do plástico e a espessura. Passando o dedo (ou o mouse), o botton inclina e o brilho acompanha.
// Dá para ver o verso (metal com alfinete), trocar brilhante/fosco, o fundo, e salvar a imagem.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { openModal } from '../modal.js';
import { formatInfo } from '../card.js';
import { shareOrDownload } from '../export.js';
import { canvasToBlob } from '../image.js';
import { buttonArt, buildFace, createFacePainter, buildBack, sideTexture, mockupImage } from '../mockup.js';

const BGS = [
  { id: 'paper', name: 'Papel' },
  { id: 'jeans', name: 'Jeans' },
  { id: 'pink', name: 'Rosa' },
  { id: 'dark', name: 'Escuro' },
];
const LAYERS = 10; // camadas que fazem a lateral do botton
const REST = { x: -0.45, y: -0.55 }; // de onde vem a luz quando ninguém mexe
const SAVE_PX = 1200;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function isButtonFormat(format) {
  return !!formatInfo(format).circle;
}

// design e getImg: o card como está; onDone: chamado ao fechar (para soltar as imagens).
export async function openButtonPreview({ design, getImg, onDone }) {
  const f = formatInfo(design.format);
  const D = Math.round(Math.min(300, window.innerWidth - 120)); // tamanho na tela (px css)
  const S = Math.min(900, Math.round(D * Math.min(3, window.devicePixelRatio || 1)));
  const art = await buttonArt(design, getImg, (S / f.face) * 1.15);
  const face = buildFace(art, design.format, S);
  const paintFront = createFacePainter(face);
  const sideUrl = sideTexture(art).toDataURL('image/png');
  const thick = D * 0.085;

  let side = 'front';
  let finish = 'gloss';
  let bgId = 'paper';
  let tilt = { x: 0.55, y: 0.4 }; // começa inclinado e volta devagar (mostra que dá para mexer)
  let target = { x: 0, y: 0 };
  let raf = 0;
  let alive = true;

  openModal({
    title: `${f.name} pronto`,
    className: 'modal__box--bprev',
    html: `
      <div class="bprev">
        <div class="bprev__stage" data-stage data-bg="${bgId}" style="--d:${D}px; --thick:${thick}px">
          <div class="bprev__shadow" data-shadow></div>
          <div class="bprev__btn" data-btn>
            ${Array.from({ length: LAYERS }, (_, i) => `<i class="bprev__side" style="transform: translateZ(${(-(i + 1) * thick) / LAYERS}px); background-image:url(${sideUrl})"></i>`).join('')}
            <canvas class="bprev__face" data-face width="${S}" height="${S}" aria-label="Prévia do botton"></canvas>
          </div>
          <span class="bprev__size">${f.face} mm</span>
        </div>
        <p class="hint bprev__hint">Passe o dedo em cima do botton para inclinar e ver o brilho. Só aparece o que está dentro da linha verde do editor: o resto dobra para trás.</p>
        <div class="bprev__opts">
          <div class="seg seg--sm" role="group" aria-label="Lado">
            <button type="button" class="seg__btn" data-side="front" aria-pressed="true">Frente</button>
            <button type="button" class="seg__btn" data-side="back" aria-pressed="false">Verso</button>
          </div>
          <div class="seg seg--sm" role="group" aria-label="Acabamento" data-finish-seg>
            <button type="button" class="seg__btn" data-finish="gloss" aria-pressed="true">Brilhante</button>
            <button type="button" class="seg__btn" data-finish="matte" aria-pressed="false">Fosco</button>
          </div>
        </div>
        <div class="chips" role="group" aria-label="Fundo">
          ${BGS.map((b) => `<button type="button" class="font-chip font-chip--sm" data-bg="${b.id}" aria-pressed="${b.id === bgId}"><span class="bprev__swatch bprev__swatch--${b.id}"></span>${b.name}</button>`).join('')}
        </div>
        <button type="button" class="btn btn--primary btn--wide" data-save>${icon('download', { size: 22 })}<span>Salvar imagem da prévia</span></button>
      </div>`,
    onClose() {
      alive = false;
      cancelAnimationFrame(raf);
      onDone && onDone();
    },
    onMount(body) {
      const stage = body.querySelector('[data-stage]');
      const btn = body.querySelector('[data-btn]');
      const shadow = body.querySelector('[data-shadow]');
      const canvas = body.querySelector('[data-face]');
      const ctx = canvas.getContext('2d');

      const light = () => ({ x: clamp(REST.x - tilt.x * 0.95, -1, 1), y: clamp(REST.y - tilt.y * 0.95, -1, 1) });

      function draw() {
        const L = light();
        ctx.clearRect(0, 0, S, S);
        if (side === 'back') ctx.drawImage(buildBack(art, design.format, S, L), 0, 0);
        else paintFront(ctx, { ...L, finish });
        // virado de costas, a inclinação é espelhada
        const ry = (side === 'back' ? -1 : 1) * tilt.x * 16;
        btn.style.transform = `rotateY(${ry}deg) rotateX(${-tilt.y * 16}deg)`;
        shadow.style.transform = `translate(${-L.x * D * 0.06 + tilt.x * D * 0.05}px, ${-L.y * D * 0.07 + tilt.y * D * 0.05}px)`;
      }

      function step() {
        raf = 0;
        if (!alive) return;
        const k = 0.18;
        tilt = { x: tilt.x + (target.x - tilt.x) * k, y: tilt.y + (target.y - tilt.y) * k };
        const done = Math.abs(tilt.x - target.x) < 0.002 && Math.abs(tilt.y - target.y) < 0.002;
        if (done) tilt = { ...target };
        draw();
        if (!done) raf = requestAnimationFrame(step);
      }
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(step);
      };

      function aim(e) {
        const r = stage.getBoundingClientRect();
        target = {
          x: clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1),
          y: clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1),
        };
        kick();
      }
      stage.addEventListener('pointerdown', (e) => {
        stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
        aim(e);
      });
      stage.addEventListener('pointermove', aim);
      const rest = () => {
        target = { x: 0, y: 0 };
        kick();
      };
      stage.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && rest());
      stage.addEventListener('pointerleave', rest);
      stage.addEventListener('pointercancel', rest);

      body.addEventListener('click', async (e) => {
        const s = e.target.closest('[data-side]');
        if (s) {
          side = s.dataset.side;
          body.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-pressed', String(b === s)));
          body.querySelector('[data-finish-seg]').hidden = side === 'back';
          return draw();
        }
        const fi = e.target.closest('[data-finish]');
        if (fi) {
          finish = fi.dataset.finish;
          body.querySelectorAll('[data-finish]').forEach((b) => b.setAttribute('aria-pressed', String(b === fi)));
          return draw();
        }
        const bg = e.target.closest('button[data-bg]');
        if (bg) {
          bgId = bg.dataset.bg;
          stage.dataset.bg = bgId;
          body.querySelectorAll('button[data-bg]').forEach((b) => b.setAttribute('aria-pressed', String(b === bg)));
          return;
        }
        const save = e.target.closest('[data-save]');
        if (save && !save.disabled) {
          save.disabled = true;
          save.classList.add('is-busy');
          try {
            const big = await buttonArt(design, getImg, (SAVE_PX / f.face) * 1.1);
            const bigFace = buildFace(big, design.format, SAVE_PX);
            const L = light();
            const out = mockupImage(createFacePainter(bigFace), side === 'back' ? buildBack(big, design.format, SAVE_PX, L) : null, SAVE_PX, { side, light: L, finish });
            const blob = await canvasToBlob(out, 'image/png');
            const name = `elane-botton-${f.face}mm-previa${side === 'back' ? '-verso' : ''}.png`;
            const r = await shareOrDownload([new File([blob], name, { type: 'image/png' })], 'Prévia do botton');
            if (r === 'downloaded') toast('Imagem da prévia salva!');
          } catch (err) {
            console.error(err);
            toast('Não consegui salvar a imagem da prévia.', { kind: 'error' });
          } finally {
            save.disabled = false;
            save.classList.remove('is-busy');
          }
        }
      });

      if (reduceMotion()) tilt = { x: 0, y: 0 };
      draw();
      kick();
    },
  });
}

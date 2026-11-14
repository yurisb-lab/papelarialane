// Tela inicial da Central: a criação principal em destaque, atalhos para começar direto
// e um mural com as outras ferramentas (temas e kits, cadernos, adesivos, fichário e PDF).

import { db } from '../db.js';
import { icon } from '../icons.js';
import { listThemes } from '../themes.js';
import { lastBackup, dateText, countLocal } from '../backup.js';

const REMIND_DAYS = 14; // depois disso, o início lembra de guardar uma cópia

export const title = '';

const MAIN = {
  route: 'photo-cards',
  name: 'Criar',
  text: 'Bottons (32, 44 e 58 mm), marcadores, cartões e capas A5. Enfeite com fotos, textos, adesivos e molduras, e mande tudo para a mesma folha A4, pronta para imprimir ou cortar na Silhouette.',
};

const QUICK = [
  { f: 'btn32', label: 'Botton 32' },
  { f: 'btn44', label: 'Botton 44' },
  { f: 'btn58', label: 'Botton 58' },
  { f: 'bookmark', label: 'Marcador 5×15' },
  { f: 'bookmark20', label: 'Marcador 5×20' },
  { f: 'cover', label: 'Capa A5' },
];

const TOOLS = [
  {
    route: 'temas',
    name: 'Temas e kits',
    text: 'Guarde as cores, letras e estampas de cada tema e gere o kit inteiro de uma vez: bottons, marcador e capa com o nome da cliente.',
    art: 'kit',
    meta: 'themes',
  },
  {
    route: 'cadernos',
    name: 'Cadernos A5',
    text: 'Miolo pautado, pontilhado, quadriculado ou liso, com margem para o wire-o. Sai pronto em A4 frente e verso, 2 páginas por folha.',
    art: 'notebook',
  },
  {
    route: 'adesivos',
    name: 'Meus adesivos',
    text: 'Transforme fotos e artes em adesivos com contorno e imprima em papel adesivo.',
    art: 'stickers',
    meta: 'stickers',
  },
  {
    route: 'fichario',
    name: 'Meu fichário',
    text: 'Tudo o que você já fez, com favoritos e pastas (uma por pedido, por exemplo).',
    art: 'binder',
    meta: 'binder',
  },
  {
    route: 'pdf',
    name: 'PDF',
    text: 'Extraia páginas, transforme PDF em imagem (e imagem em PDF), junte, divida, gire e comprima. Nada sai do aparelho.',
    art: 'pdf',
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia, <em>Elane</em>';
  if (h < 18) return 'Boa tarde, <em>Elane</em>';
  return 'Boa noite, <em>Elane</em>';
}

function art(kind) {
  if (kind === 'buttons') {
    return `
    <div class="tile-art" aria-hidden="true">
      <span class="art-btn art-btn--a">${icon('heart', { size: 30, fill: true })}</span>
      <span class="art-btn art-btn--b">${icon('star', { size: 26, fill: true })}</span>
      <span class="art-bookmark"><i></i></span>
      <span class="art-btn art-btn--c">${icon('sparkle', { size: 40, fill: true })}</span>
    </div>`;
  }
  if (kind === 'kit') {
    return `
    <div class="small-art" aria-hidden="true">
      <span class="art-swatch"><i style="background:#a5492b"></i><i style="background:#c9785a"></i><i style="background:#c39a45"></i><i style="background:#3b6551"></i><i style="background:#dfe7de"></i></span>
      <span class="art-btn art-btn--kit">${icon('heart', { size: 22, fill: true })}</span>
    </div>`;
  }
  if (kind === 'notebook') {
    return `
    <div class="small-art" aria-hidden="true">
      <span class="art-notebook"><b></b><i></i><i></i><i></i><i></i><i></i></span>
    </div>`;
  }
  if (kind === 'stickers') {
    return `
    <div class="small-art small-art--stickers" aria-hidden="true">
      <span class="art-sticker art-sticker--a">${icon('heart', { size: 30, fill: true })}</span>
      <span class="art-sticker art-sticker--b">${icon('star', { size: 26, fill: true })}</span>
      <span class="art-sticker art-sticker--c">${icon('sparkle', { size: 22, fill: true })}</span>
    </div>`;
  }
  if (kind === 'pdf') {
    return `
    <div class="small-art" aria-hidden="true">
      <span class="art-pdf art-pdf--a"></span>
      <span class="art-pdf art-pdf--c"></span>
      <span class="art-pdf art-pdf--b"><i></i><i></i><i></i><i></i><i></i></span>
    </div>`;
  }
  return `
    <div class="small-art small-art--binder" aria-hidden="true">
      <span class="art-binder"><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>`;
}

const go = (label) => `<span class="tool-tile__go">${label} ${icon('arrowLeft', { size: 20 }).replace('class="ic"', 'class="ic ic--flip"')}</span>`;

export async function mount(el) {
  el.innerHTML = `
    <section class="home">
      <div class="home__hello">
        <h1 class="home__title">${greeting()}<br><span>O que vamos criar hoje?</span></h1>
      </div>
      <div class="home__tools">
        <a class="tool-tile" href="#/${MAIN.route}">
          ${art('buttons')}
          <span class="tool-tile__body">
            <span class="tool-tile__name">${MAIN.name}</span>
            <span class="tool-tile__text">${MAIN.text}</span>
            <span class="tool-tile__meta" data-meta="sheet"></span>
            ${go('Começar')}
          </span>
        </a>
        <nav class="quick" aria-label="Começar direto">
          <span class="quick__label">Começar direto:</span>
          ${QUICK.map((q) => `<a class="quick__btn" href="#/photo-cards?f=${q.f}">${q.label}</a>`).join('')}
        </nav>
        <div class="home__more">
          ${TOOLS.map(
            (t, i) => `
            <a class="tool-tile tool-tile--small tool-tile--${i}" href="#/${t.route}">
              ${art(t.art)}
              <span class="tool-tile__body">
                <span class="tool-tile__name">${t.name}</span>
                <span class="tool-tile__text">${t.text}</span>
                ${t.meta ? `<span class="tool-tile__meta" data-meta="${t.meta}"></span>` : ''}
                ${go('Abrir')}
              </span>
            </a>`
          ).join('')}
        </div>
        <a class="home-backup" href="#/copia" data-backup>
          <span class="home-backup__icon">${icon('download', { size: 22 })}</span>
          <span class="home-backup__text"><strong>Cópia de segurança</strong> <span data-backup-text>Guarde um arquivo com tudo, para não perder nada.</span></span>
          <span class="home-backup__go">Abrir</span>
        </a>
      </div>
    </section>`;

  const setMeta = (key, text) => {
    const m = el.querySelector(`[data-meta="${key}"]`);
    if (m && text) m.textContent = text;
  };
  try {
    const all = await db.allCards();
    const sheet = all.filter((c) => c.inSheet !== false);
    const total = sheet.reduce((n, c) => n + (c.copies || 1), 0);
    if (total > 0) setMeta('sheet', total === 1 ? '1 coisa esperando na folha' : `${total} coisas esperando na folha`);
    const saved = all.filter((c) => c.kind !== 'sticker').length;
    if (saved) setMeta('binder', saved === 1 ? '1 criação guardada' : `${saved} criações guardadas`);
    const st = (await db.allStickers()).length;
    if (st) setMeta('stickers', st === 1 ? '1 adesivo' : `${st} adesivos`);
    const th = (await listThemes()).length;
    if (th) setMeta('themes', th === 1 ? '1 tema guardado' : `${th} temas guardados`);

    // Lembrete da cópia de segurança: nunca guardou, ou faz tempo.
    const last = await lastBackup();
    const hasStuff = (await countLocal()).total > 0; // os 4 temas prontos não contam
    const days = last ? Math.floor((Date.now() - last.at) / 86400000) : null;
    const box = el.querySelector('[data-backup]');
    const txt = el.querySelector('[data-backup-text]');
    if (box && txt && hasStuff) {
      if (!last) {
        txt.textContent = 'Você ainda não guardou uma cópia de tudo. Se o navegador apagar os dados, tudo se perde.';
        box.classList.add('is-due');
      } else if (days >= REMIND_DAYS) {
        txt.textContent = `A última cópia foi em ${dateText(last.at)}, faz ${days} dias. Que tal guardar uma nova?`;
        box.classList.add('is-due');
      } else {
        txt.textContent = `Última cópia em ${dateText(last.at)}.`;
      }
    }
  } catch (_) {}
}

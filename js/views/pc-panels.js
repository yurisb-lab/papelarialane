// Painéis de ferramentas do editor de photo cards (o HTML de cada aba).
// Os botões usam atributos data-* e quem trata os cliques é js/views/photocards.js.

import { icon } from '../icons.js';
import { FRAMES, LAYOUTS, cardSize, isBgPhoto } from '../card.js';
import { FONTS } from '../fonts.js';
import { FILTERS } from '../fx.js';
import { STICKER_PACKS, EMOJIS, MONTHS, stickerInfo, hasInnerText } from '../stickers.js';
import { GRADIENTS, PATTERNS, PENS, bgBaseColor } from '../render.js';
import { templatesFor } from '../templates.js';

export const PALETTE = [
  { c: '#ffffff', n: 'Branco' },
  { c: '#ffd9e8', n: 'Rosa clarinho' },
  { c: '#ff9cc2', n: 'Rosa' },
  { c: '#ff5c93', n: 'Rosa forte' },
  { c: '#b4532f', n: 'Framboesa' },
  { c: '#e6dcff', n: 'Lilás clarinho' },
  { c: '#b79cff', n: 'Lilás' },
  { c: '#7a52d1', n: 'Roxo' },
  { c: '#d2f4e4', n: 'Verde menta' },
  { c: '#5cc49a', n: 'Verde' },
  { c: '#fff0b3', n: 'Amarelo clarinho' },
  { c: '#ffc93c', n: 'Amarelo' },
  { c: '#ffb38a', n: 'Pêssego' },
  { c: '#d5ebff', n: 'Azul céu' },
  { c: '#6fb7ff', n: 'Azul' },
  { c: '#2a1d25', n: 'Preto' },
];

export const TABS = [
  { id: 'foto', name: 'Foto', icon: 'photo' },
  { id: 'efeitos', name: 'Efeitos', icon: 'sun' },
  { id: 'texto', name: 'Texto', icon: 'text' },
  { id: 'adesivos', name: 'Adesivos', icon: 'sticker' },
  { id: 'fundo', name: 'Fundo', icon: 'palette' },
  { id: 'moldura', name: 'Moldura', icon: 'frame' },
  { id: 'colagem', name: 'Colagem', icon: 'grid' },
  { id: 'desenho', name: 'Desenhar', icon: 'pen' },
  { id: 'modelos', name: 'Modelos', icon: 'template' },
  { id: 'camadas', name: 'Camadas', icon: 'layers' },
];

// Espessuras da caneta (mm no photo card; crescem com o formato).
export const PEN_SIZES = [
  { id: 's', name: 'Fina', mm: 0.6 },
  { id: 'm', name: 'Média', mm: 1.2 },
  { id: 'l', name: 'Grossa', mm: 2.4 },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

// Fileira de cores. prop = o que a cor muda; none = mostrar "sem cor".
export function swatches(prop, current, { label, none = false, custom = true } = {}) {
  const inPalette = PALETTE.some((p) => same(p.c, current));
  return `
    <div class="swatches" role="radiogroup" aria-label="${esc(label || 'Cor')}">
      ${label ? `<span class="swatches__label">${esc(label)}</span>` : ''}
      ${none ? `<button type="button" class="swatch swatch--none" role="radio" aria-checked="${!current}" aria-label="Sem cor" title="Sem cor" data-color-prop="${prop}" data-color=""></button>` : ''}
      ${PALETTE.map(
        (p) =>
          `<button type="button" class="swatch" role="radio" aria-checked="${same(p.c, current)}" aria-label="${p.n}" title="${p.n}" data-color-prop="${prop}" data-color="${p.c}" style="--sw:${p.c}"></button>`
      ).join('')}
      ${
        custom
          ? `<label class="swatch swatch--custom${current && !inPalette ? ' is-on' : ''}" title="Outra cor" style="${current && !inPalette ? `--sw:${current}` : ''}">
              <input type="color" data-color-input="${prop}" value="${current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#ff7aa8'}" aria-label="Escolher outra cor">
            </label>`
          : ''
      }
    </div>`;
}

function slider({ label, ic, prop, min, max, step = 1, value, out, attr = '' }) {
  return `
    <div class="slider">
      <span class="slider__label">${ic ? icon(ic, { size: 20 }) : ''}${esc(label)}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" ${prop ? `data-prop="${prop}"` : ''} ${attr} aria-label="${esc(label)}">
      ${out != null ? `<output class="slider__value">${out}</output>` : ''}
    </div>`;
}

function toggle(prop, label, on) {
  return `
    <label class="check">
      <input type="checkbox" data-prop="${prop}" ${on ? 'checked' : ''}>
      <span class="check__box">${icon('check', { size: 16 })}</span>
      ${esc(label)}
    </label>`;
}

const section = (title, body, extra = '') => `<div class="psec ${extra}"><p class="psec__title">${title}</p>${body}</div>`;

function emptyNote(text, actions = '') {
  return `<div class="pnote">${icon('heart', { size: 20, fill: true })}<p>${text}</p>${actions}</div>`;
}

// ---------- abas ----------

function fotoPanel(S) {
  const touch = S.isTouch;
  if (S.bgActive) {
    return `
      <div class="bg-panel">
        <div class="bg-panel__head">
          <p class="bg-panel__title">${icon('wand', { size: 22 })}Tirar fundo da foto</p>
          <p class="bg-panel__help">${touch ? 'Toque' : 'Clique'} na cor que quer apagar. Pode ${touch ? 'tocar' : 'clicar'} em vários lugares. Para mover a foto, é só arrastar.</p>
        </div>
        <div class="slider">
          <span class="slider__label">Força</span>
          <input type="range" min="1" max="100" step="1" value="${S.bg.tolerance}" data-tol aria-label="Força do apagador">
          <output class="slider__value" data-tol-out>${S.bg.tolerance}</output>
        </div>
        <div class="bg-panel__row">
          <button type="button" class="tool-btn" data-act="bg-auto" ${S.bg.hasAuto ? 'disabled' : ''}>${icon('sparkle', { size: 22 })}Automático</button>
          <button type="button" class="tool-btn" data-act="bg-undo" ${S.bg.ops ? '' : 'disabled'}>${icon('undo', { size: 22 })}Desfazer</button>
          <button type="button" class="tool-btn" data-act="bg-reset" ${S.bg.ops ? '' : 'disabled'}>${icon('photo', { size: 22 })}Foto original</button>
        </div>
        <button type="button" class="btn btn--primary" data-act="bg-done" ${S.bg.running ? 'disabled' : ''}>${icon('check', { size: 22 })}Pronto</button>
      </div>`;
  }
  const L = S.layer && S.layer.type === 'photo' ? S.layer : null;
  const loose = section(
    'Foto solta',
    `<p class="psec__tip">Uma foto inteira que fica por cima e dá para pôr em qualquer lugar, tortinha, com borda de polaroid. Ótima para pôster e mural.</p>
     <button type="button" class="btn btn--soft" data-act="loose-photo">${icon('photo', { size: 20 })}Pôr foto solta</button>`
  );
  if (!L) {
    if (!S.cellsCount) {
      return (
        emptyNote(
          'Este lado está sem espaço de foto. Escolha uma foto e ele ganha um, ou mude em <strong>Colagem</strong>.',
          `<div class="pnote__row"><button type="button" class="btn btn--primary" data-act="pick">${icon('photo', { size: 22 })}Escolher foto</button>
           <button type="button" class="btn btn--soft" data-act="paste">${icon('upload', { size: 20 })}Colar</button></div>`
        ) + loose
      );
    }
    return (
      emptyNote(
        S.cellsCount > 1
          ? `${touch ? 'Toque' : 'Clique'} num espaço para escolher onde a foto vai, ou escolha agora e ela vai para o primeiro espaço vazio.`
          : 'Escolha a foto.',
        `<div class="pnote__row"><button type="button" class="btn btn--primary" data-act="pick">${icon('photo', { size: 22 })}Escolher foto</button>
         <button type="button" class="btn btn--soft" data-act="paste">${icon('upload', { size: 20 })}Colar</button></div>`
      ) + loose
    );
  }
  return `
    ${slider({ label: 'Tamanho', ic: 'zoom', min: 0, max: 1000, value: S.zoomSlider, attr: 'data-photo="zoom"' })}
    ${slider({ label: 'Inclinar', ic: 'tilt', min: -180, max: 180, value: Math.round(L.rotation), out: `${Math.round(L.rotation)}°`, attr: 'data-photo="rot"' })}
    <div class="tool-row">
      <button type="button" class="tool-btn" data-act="rotate90">${icon('rotate', { size: 22 })}Girar</button>
      <button type="button" class="tool-btn" data-act="flip">${icon('flip', { size: 22 })}Espelhar</button>
      <button type="button" class="tool-btn" data-act="fit">${icon('center', { size: 22 })}Encaixar</button>
      <button type="button" class="tool-btn tool-btn--magic" data-act="bg">${icon('wand', { size: 22 })}Tirar fundo</button>
      <button type="button" class="tool-btn" data-act="pick">${icon('photo', { size: 22 })}Trocar foto</button>
      <button type="button" class="tool-btn" data-act="paste">${icon('upload', { size: 22 })}Colar</button>
    </div>
    ${section(
      'Guardar esta foto',
      `<div class="tool-row">
        <button type="button" class="tool-btn tool-btn--magic" data-act="to-sticker">${icon('sticker', { size: 22 })}Virar adesivo</button>
        <button type="button" class="tool-btn" data-act="save-cutout">${icon('download', { size: 22 })}${L.originalKey ? 'Salvar sem fundo' : 'Salvar foto'}</button>
      </div>
      <p class="psec__tip">${L.originalKey ? '“Virar adesivo” guarda a figurinha (com contorno, se tiver) em <strong>Adesivos › Meus</strong>, para usar em outros cards e imprimir.' : 'Dica: use <strong>Tirar fundo</strong> antes, para o adesivo ficar só com o desenho da pessoa.'}</p>`
    )}
    ${loose}`;
}

function efeitosPanel(S) {
  const L = S.layer && S.layer.type === 'photo' ? S.layer : null;
  if (!L) return emptyNote(`${S.isTouch ? 'Toque' : 'Clique'} numa foto do card para usar filtros, ajustes e contorno.`);
  const fx = L.fx;
  const o = L.outline;
  return `
    ${section(
      'Filtros',
      `<div class="chips chips--filters">
        ${FILTERS.map(
          (f) =>
            `<button type="button" class="fchip" data-filter="${f.id}" aria-pressed="${fx.filter === f.id}"><span class="fchip__img" data-filter-preview="${f.id}"></span><span>${f.name}</span></button>`
        ).join('')}
      </div>`
    )}
    ${section(
      'Ajustes',
      `${slider({ label: 'Brilho', min: -100, max: 100, value: Math.round(fx.brightness * 100), prop: 'fx.brightness', attr: 'data-div="100"' })}
       ${slider({ label: 'Contraste', min: -100, max: 100, value: Math.round(fx.contrast * 100), prop: 'fx.contrast', attr: 'data-div="100"' })}
       ${slider({ label: 'Cor', min: -100, max: 100, value: Math.round(fx.saturation * 100), prop: 'fx.saturation', attr: 'data-div="100"' })}
       <button type="button" class="link-btn" data-act="fx-reset">${icon('undo', { size: 18 })}Voltar ao normal</button>`
    )}
    ${section(
      'Contorno',
      `${toggle('outline.on', 'Contorno em volta da foto', o.on)}
       <div class="psec__more" ${o.on ? '' : 'hidden'}>
         ${slider({ label: 'Espessura', min: 1, max: 10, step: 1, value: o.size, prop: 'outline.size' })}
         ${swatches('outline.color', o.color, { label: 'Cor do contorno' })}
       </div>
       <p class="psec__tip">${L.originalKey ? 'O contorno segue o desenho da foto sem fundo, como uma figurinha.' : 'Dica: use <strong>Tirar fundo</strong> antes, para o contorno seguir o desenho da pessoa.'}</p>`
    )}`;
}

function textoPanel(S) {
  const L = S.layer && S.layer.type === 'text' ? S.layer : null;
  const add = `<button type="button" class="btn btn--primary btn--wide" data-act="add-text">${icon('plus', { size: 22 })}Adicionar texto</button>`;
  if (!L) return `${add}<p class="psec__tip">Depois de pôr o texto, arraste para mudar de lugar e use a bolinha roxa para girar e aumentar. ${S.isTouch ? 'Toque' : 'Clique'} duas vezes num texto para escrever.</p>`;
  return `
    ${add}
    <label class="field">
      <span class="field__label">Escreva aqui</span>
      <textarea data-prop="text" rows="2" maxlength="200" spellcheck="false">${esc(L.text)}</textarea>
    </label>
    ${section(
      'Letra',
      `<div class="chips chips--fonts">
        ${FONTS.map(
          (f) =>
            `<button type="button" class="font-chip" data-font="${f.id}" aria-pressed="${L.font === f.id}" style="font-family:'${f.family}';font-weight:${f.weight}">${f.name}</button>`
        ).join('')}
      </div>`
    )}
    ${slider({ label: 'Tamanho', ic: 'zoom', min: 2, max: Math.round(30 * S.unit), step: 0.5, value: L.size, prop: 'size' })}
    ${swatches('color', L.color, { label: 'Cor da letra' })}
    ${swatches('stroke.color', L.stroke.color, { label: 'Contorno', none: true })}
    <div class="psec__more" ${L.stroke.color ? '' : 'hidden'}>
      ${slider({ label: 'Espessura', min: 1, max: 10, step: 1, value: L.stroke.width, prop: 'stroke.width' })}
    </div>
    <div class="row-between">
      ${toggle('shadow', 'Sombra', L.shadow)}
      <div class="seg seg--sm" role="group" aria-label="Alinhamento">
        ${[
          ['left', 'alignLeft', 'Alinhar à esquerda'],
          ['center', 'alignCenter', 'Centralizar'],
          ['right', 'alignRight', 'Alinhar à direita'],
        ]
          .map(([v, ic, n]) => `<button type="button" class="seg__btn" data-align="${v}" aria-pressed="${L.align === v}" aria-label="${n}" title="${n}">${icon(ic, { size: 20 })}</button>`)
          .join('')}
      </div>
    </div>`;
}

function stickerSelected(S) {
  const L = S.layer;
  const u = S.unit;
  const sizeMax = Math.round(60 * u);
  if (L.kind === 'image') {
    const isPhoto = L.frame && L.frame !== 'none';
    return section(
      isPhoto ? 'Foto solta escolhida' : 'Meu adesivo escolhido',
      `${slider({ label: 'Tamanho', ic: 'zoom', min: 3, max: Math.round(90 * u), step: 0.5, value: L.size, prop: 'size' })}
       <div class="chips" role="group" aria-label="Borda da foto">
         ${[
           ['none', 'Sem borda'],
           ['white', 'Borda branca'],
           ['polaroid', 'Polaroid'],
         ]
           .map(([v, n]) => `<button type="button" class="font-chip font-chip--sm" data-img-frame="${v}" aria-pressed="${(L.frame || 'none') === v}">${n}</button>`)
           .join('')}
       </div>
       ${toggle('shadow', 'Sombrinha', L.shadow !== false && (L.shadow || isPhoto))}`,
      'psec--sel'
    );
  }
  if (L.kind === 'calendar') {
    const m = L.month == null ? new Date().getMonth() : L.month;
    return section(
      'Calendário escolhido',
      `<div class="cal-nav">
         <button type="button" class="round-btn" data-act="cal-prev" aria-label="Mês anterior">${icon('arrowLeft', { size: 18 })}</button>
         <strong>${MONTHS[m]} ${L.year || new Date().getFullYear()}</strong>
         <button type="button" class="round-btn" data-act="cal-next" aria-label="Próximo mês">${icon('arrowLeft', { size: 18 }).replace('class="ic"', 'class="ic ic--flip"')}</button>
       </div>
       ${slider({ label: 'Tamanho', ic: 'zoom', min: 10, max: Math.round(90 * u), step: 0.5, value: L.size, prop: 'size' })}
       ${swatches('color', L.color, { label: 'Cor' })}`,
      'psec--sel'
    );
  }
  const info = L.kind === 'shape' ? stickerInfo(L.name) : null;
  return section(
    'Adesivo escolhido',
    `${hasInnerText(L) ? `<label class="field"><span class="field__label">Texto do adesivo</span><textarea data-prop="text" rows="1" maxlength="40" spellcheck="false">${esc(L.text == null ? info.text.def : L.text)}</textarea></label>` : ''}
     ${slider({ label: 'Tamanho', ic: 'zoom', min: 3, max: sizeMax, step: 0.5, value: L.size, prop: 'size' })}
     ${info && !info.fixed ? swatches('color', L.color, { label: 'Cor' }) : ''}`,
    'psec--sel'
  );
}

function myStickers(S) {
  const list = S.library || [];
  const make = `<a class="btn btn--soft" href="#/adesivos">${icon('wand', { size: 20 })}Criar adesivo de uma foto</a>`;
  if (!list.length) {
    return `<div class="pnote">${icon('sticker', { size: 22 })}<p>Você ainda não tem adesivos seus. Faça um a partir de uma foto: escolha a foto, tire o fundo e toque em <strong>Virar adesivo</strong> (na aba Foto), ou use a tela <strong>Meus adesivos</strong>.</p><div class="pnote__row pnote__row--start">${make}</div></div>`;
  }
  return `
    <div class="sticker-grid sticker-grid--mine">${list
      .map((st) => `<button type="button" class="sticker-btn sticker-btn--mine" data-add-mine="${st.id}" aria-label="Meu adesivo"><img src="${st.url}" alt="" draggable="false"></button>`)
      .join('')}</div>
    <div class="pnote__row pnote__row--start">${make}</div>`;
}

function adesivosPanel(S) {
  const L = S.layer && S.layer.type === 'sticker' ? S.layer : null;
  const top = L ? stickerSelected(S) : '';
  const packs = [{ id: 'meus', name: 'Meus' }, ...STICKER_PACKS, { id: 'emojis', name: 'Emojis' }, { id: 'extras', name: 'Calendário' }];
  const cur = packs.some((p) => p.id === S.pack) ? S.pack : 'fofos';
  let body;
  if (cur === 'meus') body = myStickers(S);
  else if (cur === 'emojis')
    body = `<div class="sticker-grid sticker-grid--emoji">${EMOJIS.map(
      (e) => `<button type="button" class="sticker-btn sticker-btn--emoji" data-add-emoji="${e}" aria-label="Emoji ${e}">${e}</button>`
    ).join('')}</div>`;
  else if (cur === 'extras')
    body = `<p class="psec__tip">Um calendário do mês, para pôster, mural ou marcador. Depois de pôr, dá para trocar o mês e a cor.</p>
      <button type="button" class="btn btn--soft" data-act="add-calendar">${icon('calendar', { size: 20 })}Pôr calendário</button>`;
  else {
    const pack = STICKER_PACKS.find((p) => p.id === cur);
    body = `<div class="sticker-grid">${pack.items
      .map((id) => {
        const s = stickerInfo(id);
        return `<button type="button" class="sticker-btn" data-add-sticker="${s.id}" aria-label="${s.name}" title="${s.name}"><span data-sticker-preview="${s.id}"></span></button>`;
      })
      .join('')}</div>
      ${cur === 'baloes' ? '<p class="psec__tip">Depois de pôr, escreva o que quiser dentro do balão.</p>' : ''}`;
  }
  return `
    ${top}
    <div class="packs" role="tablist" aria-label="Pacotes de adesivos">
      ${packs.map((p) => `<button type="button" class="pack-btn" role="tab" aria-selected="${p.id === cur}" data-pack="${p.id}">${p.name}</button>`).join('')}
    </div>
    <div class="pack-body">${body}</div>`;
}

function fotoDeFundo(S) {
  const bp = S.side.layers.find(isBgPhoto);
  const editing = isBgPhoto(S.layer);
  const front = S.side.layers.find((l) => l.type === 'photo' && !isBgPhoto(l));
  const cutTip =
    front && !front.originalKey
      ? `<div class="pnote pnote--tip"><p>Para a foto de fundo aparecer atrás de você, tire o fundo da sua foto.</p><button type="button" class="btn btn--soft" data-act="bg-front">${icon('wand', { size: 20 })}Tirar fundo da minha foto</button></div>`
      : '';
  if (!bp) {
    return section(
      'Foto de fundo',
      `<p class="psec__tip">Coloque uma foto atrás de tudo: fica ótimo depois de “Tirar fundo”. Também dá para ${S.isTouch ? 'colar' : 'arrastar ou colar (Ctrl+V)'} uma imagem.</p>
       <div class="pnote__row pnote__row--start">
         <button type="button" class="btn btn--primary" data-act="bgphoto-pick">${icon('photo', { size: 22 })}Escolher foto de fundo</button>
         <button type="button" class="btn btn--soft" data-act="bgphoto-paste">${icon('upload', { size: 20 })}Colar</button>
       </div>`,
      'psec--bgphoto'
    );
  }
  if (!editing) {
    return section(
      'Foto de fundo',
      `<div class="tool-row">
         <button type="button" class="tool-btn tool-btn--magic" data-act="bgphoto-edit">${icon('edit', { size: 22 })}Mexer no fundo</button>
         <button type="button" class="tool-btn" data-act="bgphoto-pick">${icon('photo', { size: 22 })}Trocar</button>
         <button type="button" class="tool-btn" data-act="bgphoto-remove">${icon('trash', { size: 22 })}Remover</button>
       </div>
       ${cutTip}`,
      'psec--bgphoto'
    );
  }
  return section(
    'Mexendo na foto de fundo',
    `<p class="psec__tip">Agora só o fundo se mexe: ${S.isTouch ? 'arraste e use dois dedos' : 'arraste e use a rodinha'} para enquadrar. Sua foto fica parada na frente.</p>
     ${slider({ label: 'Tamanho', ic: 'zoom', min: 0, max: 1000, value: S.zoomSlider, attr: 'data-photo="zoom"' })}
     ${slider({ label: 'Inclinar', ic: 'tilt', min: -180, max: 180, value: Math.round(S.layer.rotation), out: `${Math.round(S.layer.rotation)}°`, attr: 'data-photo="rot"' })}
     <div class="tool-row">
       <button type="button" class="tool-btn" data-act="fit">${icon('center', { size: 22 })}Encaixar</button>
       <button type="button" class="tool-btn" data-act="bgphoto-pick">${icon('photo', { size: 22 })}Trocar</button>
       <button type="button" class="tool-btn" data-act="bgphoto-paste">${icon('upload', { size: 22 })}Colar</button>
       <button type="button" class="tool-btn" data-act="bgphoto-remove">${icon('trash', { size: 22 })}Remover</button>
     </div>
     ${cutTip}
     <button type="button" class="btn btn--primary" data-act="bgphoto-done">${icon('check', { size: 22 })}Pronto</button>`,
    'psec--sel'
  );
}

function fundoPanel(S) {
  const bg = S.side.bg;
  const base = bgBaseColor(bg);
  return `
    ${fotoDeFundo(S)}
    ${section('Cor', swatches('@bg', bg.kind === 'gradient' ? null : bg.color))}
    ${section(
      'Degradê',
      `<div class="chips">${GRADIENTS.map(
        (g) =>
          `<button type="button" class="grad-chip" data-gradient="${g.id}" aria-pressed="${bg.kind === 'gradient' && bg.id === g.id}" title="${g.name}" aria-label="${g.name}" style="background:linear-gradient(${g.angle}deg, ${g.stops.join(',')})"></button>`
      ).join('')}</div>`
    )}
    ${section(
      'Estampa',
      `<div class="chips">${PATTERNS.map(
        (p) =>
          `<button type="button" class="pat-chip" data-pattern="${p.id}" aria-pressed="${(bg.kind === 'pattern' ? bg.pattern : bg.kind === 'solid' ? 'none' : '') === p.id}" title="${p.name}"><span data-pattern-preview="${p.id}" data-base="${base}"></span><span>${p.name}</span></button>`
      ).join('')}</div>
      <p class="psec__tip">A estampa usa a cor escolhida em cima. O fundo aparece onde não tem foto, ou onde você tirou o fundo da foto.</p>`
    )}`;
}

function molduraPanel(S) {
  const fr = S.side.frame;
  return `
    <div class="frame-grid">${FRAMES.map(
      (f) =>
        `<button type="button" class="frame-btn" data-frame="${f.id}" aria-pressed="${fr.id === f.id}"><span data-frame-preview="${f.id}"></span><span>${f.name}</span></button>`
    ).join('')}</div>
    ${fr.id !== 'none' ? swatches('@frame', fr.color, { label: 'Cor da moldura' }) : ''}`;
}

function layoutPreview(l, design) {
  const { w, h } = cardSize(design);
  return `<span class="lay" style="aspect-ratio:${w}/${h}">${
    l.cells.length
      ? l.cells.map(([x, y, cw, ch]) => `<i style="left:${x * 100}%;top:${y * 100}%;width:${cw * 100}%;height:${ch * 100}%"></i>`).join('')
      : `<b>${icon('text', { size: 18 })}</b>`
  }</span>`;
}

function colagemPanel(S) {
  return `
    <div class="frame-grid">${LAYOUTS.filter((l) => !l.big || S.design.format === 'poster' || S.side.layout === l.id)
      .map(
        (l) =>
          `<button type="button" class="frame-btn" data-layout="${l.id}" aria-pressed="${S.side.layout === l.id}" title="${l.name}">${layoutPreview(l, S.design)}<span>${l.name}</span></button>`
      )
      .join('')}</div>
    <p class="psec__tip">${S.isTouch ? 'Toque' : 'Clique'} num espaço vazio do card para colocar a foto dele. Cada foto se mexe sozinha dentro do seu espaço.</p>`;
}

function desenhoPanel(S) {
  const D = S.draw;
  const L = S.layer && S.layer.type === 'draw' ? S.layer : null;
  if (D.active) {
    return `
      <div class="bg-panel draw-panel">
        <div class="bg-panel__head">
          <p class="bg-panel__title">${icon('pen', { size: 22 })}Desenhando</p>
          <p class="bg-panel__help">Desenhe com o dedo${S.isTouch ? ' ou a caneta' : ' ou o mouse'} em cima do card. Quando terminar, toque em <strong>Pronto</strong>: o desenho vira uma peça que dá para mover, girar e aumentar.</p>
        </div>
        <div class="chips" role="group" aria-label="Caneta">
          ${PENS.map((p) => `<button type="button" class="font-chip font-chip--sm" data-pen="${p.id}" aria-pressed="${D.pen === p.id}">${p.name}</button>`).join('')}
        </div>
        <div class="chips" role="group" aria-label="Espessura">
          ${PEN_SIZES.map((p) => `<button type="button" class="pen-size" data-pen-size="${p.id}" aria-pressed="${D.size === p.id}" aria-label="${p.name}" title="${p.name}"><i style="--d:${6 + PEN_SIZES.indexOf(p) * 6}px"></i></button>`).join('')}
        </div>
        ${swatches('@pen', D.color, { label: 'Cor' })}
        <div class="bg-panel__row">
          <button type="button" class="tool-btn" data-act="undo" ${S.canUndo ? '' : 'disabled'}>${icon('undo', { size: 22 })}Desfazer risco</button>
        </div>
        <button type="button" class="btn btn--primary" data-act="draw-done">${icon('check', { size: 22 })}Pronto</button>
      </div>`;
  }
  const sel = L
    ? section(
        'Desenho escolhido',
        `${slider({ label: 'Tamanho', ic: 'zoom', min: 3, max: Math.round(200 * S.unit), step: 0.5, value: Math.round(L.size * 2) / 2, prop: 'size' })}
         ${swatches('@draw', (L.strokes[0] && L.strokes[0].c) || null, { label: 'Pintar o desenho todo' })}`,
        'psec--sel'
      )
    : '';
  return `
    ${sel}
    <button type="button" class="btn btn--primary btn--wide" data-act="draw-start">${icon('pen', { size: 22 })}${L ? 'Fazer outro desenho' : 'Começar a desenhar'}</button>
    <p class="psec__tip">Rabiscos, assinatura, corações… Escolha a caneta (Caneta, Marca-texto ou Neon), a espessura e a cor. Cada vez que você desenha, o desenho vira uma peça do card.</p>`;
}

function modelosPanel(S) {
  return `
    <div class="tpl-grid">${templatesFor(S.design.format).map(
      (t) => `<button type="button" class="tpl-btn" data-template="${t.id}"><span data-template-preview="${t.id}"></span><span>${t.name}</span></button>`
    ).join('')}</div>
    <p class="psec__tip">O modelo troca o fundo, a moldura, os textos e os adesivos deste lado. As fotos ficam. Se não gostar, é só desfazer.</p>
    ${
      S.themes && S.themes.length
        ? `<p class="psec__title">Aplicar as cores de um tema</p>
    <div class="chips">${S.themes
      .map(
        (t) =>
          `<button type="button" class="font-chip font-chip--sm" data-apply-theme="${esc(t.id)}"><span class="theme-card__sw theme-card__sw--sm">${t.colors
            .slice(0, 3)
            .map((c) => `<i style="background:${c}"></i>`)
            .join('')}</span>${esc(t.name)}</button>`
      )
      .join('')}</div>
    <p class="psec__tip">Fundo, moldura, letras e cores dos desenhos mudam para as do tema. Os temas ficam em <a href="#/temas">Temas e kits</a>.</p>`
        : ''
    }`;
}

export function layerLabel(l, i, photos) {
  if (isBgPhoto(l)) return { ic: 'photo', text: 'Foto de fundo' };
  if (l.type === 'photo') return { ic: 'photo', text: photos > 1 ? `Foto ${l.cell + 1}` : 'Foto' };
  if (l.type === 'text') return { ic: 'text', text: `“${(l.text || '').replace(/\s+/g, ' ').trim().slice(0, 22) || 'texto'}”` };
  if (l.type === 'draw') return { ic: 'pen', text: 'Desenho' };
  if (l.kind === 'emoji') return { ic: null, emoji: l.name, text: 'Emoji' };
  if (l.kind === 'image') return { ic: 'photo', text: l.frame && l.frame !== 'none' ? 'Foto solta' : 'Meu adesivo' };
  if (l.kind === 'calendar') return { ic: 'calendar', text: 'Calendário' };
  const info = stickerInfo(l.name);
  return { ic: 'sticker', text: hasInnerText(l) ? `${info.name} “${String(l.text == null ? info.text.def : l.text).slice(0, 14)}”` : info.name };
}

function camadasPanel(S) {
  const layers = S.side.layers;
  if (!layers.length) return emptyNote('Ainda não tem nada neste lado do card.');
  const photos = layers.filter((l) => l.type === 'photo' && !isBgPhoto(l)).length;
  const rows = layers
    .map((l, i) => ({ l, i }))
    .reverse()
    .map(({ l, i }) => {
      const lab = layerLabel(l, i, photos);
      const on = S.layer && S.layer.id === l.id;
      return `
        <li class="layer${on ? ' is-on' : ''}">
          <button type="button" class="layer__pick" data-layer-select="${l.id}" aria-pressed="${on}">
            <span class="layer__icon">${lab.emoji ? `<span class="layer__emoji">${lab.emoji}</span>` : icon(lab.ic, { size: 20 })}</span>
            <span class="layer__name">${esc(lab.text)}</span>
          </button>
          <button type="button" class="round-btn" data-layer-move="1" data-id="${l.id}" aria-label="Trazer para a frente" title="Para a frente" ${i === layers.length - 1 ? 'disabled' : ''}>${icon('up', { size: 18 })}</button>
          <button type="button" class="round-btn" data-layer-move="-1" data-id="${l.id}" aria-label="Mandar para trás" title="Para trás" ${i === 0 ? 'disabled' : ''}>${icon('down', { size: 18 })}</button>
          <button type="button" class="round-btn round-btn--danger" data-layer-del="${l.id}" aria-label="Apagar" title="Apagar">${icon('trash', { size: 18 })}</button>
        </li>`;
    })
    .join('');
  return `<p class="psec__tip">O que está em cima na lista aparece na frente.</p><ul class="layer-list">${rows}</ul>`;
}

export function panelHtml(tab, S) {
  switch (tab) {
    case 'efeitos':
      return efeitosPanel(S);
    case 'texto':
      return textoPanel(S);
    case 'adesivos':
      return adesivosPanel(S);
    case 'fundo':
      return fundoPanel(S);
    case 'moldura':
      return molduraPanel(S);
    case 'colagem':
      return colagemPanel(S);
    case 'desenho':
      return desenhoPanel(S);
    case 'modelos':
      return modelosPanel(S);
    case 'camadas':
      return camadasPanel(S);
    default:
      return fotoPanel(S);
  }
}

// Tela de Photo cards: editor à esquerda (ou em cima, no tablet em pé) e a folha A4 ao lado.

import { createEditor } from '../editor.js';
import {
  BG_CELL,
  FORMATS,
  formatInfo,
  cardSize,
  cellFor,
  cellRects,
  isBgPhoto,
  coverScale,
  imageKeys,
  migrateRecord,
  newDesign,
  newPhotoLayer,
  newStickerLayer,
  newTextLayer,
  newDrawLayer,
  finishDrawLayer,
  sideHasContent,
  uid,
} from '../card.js';
import { renderThumb, GRADIENTS, bgBaseColor } from '../render.js';
import { processPhoto } from '../fx.js';
import { stickerPreview, stickerInfo } from '../stickers.js';
import { loadFonts, ensureFonts } from '../fonts.js';
import { makeTemplate, templateInfo } from '../templates.js';
import { createHistory } from '../history.js';
import { db, newId } from '../db.js';
import { importImageFile, blobToImage, releaseImage, canvasToBlob } from '../image.js';
import { buildPdf, buildSheetImages, layoutSheet, SHEET, hasBack, isSticker, stickerDims } from '../pdf.js';
import { buildSilhouetteKit, MARGIN_CM } from '../silhouette.js';
import { listThemes, applyTheme } from '../themes.js';
import { icon } from '../icons.js';
import { createBgRemover } from '../bg-remover.js';
import { toast } from '../toast.js';
import { cloudEnabled, queueCard, syncCloud, onCloudChange, listCloud, fetchCloudCard, daysText, KEEP_DAYS } from '../cloud.js';
import { TABS, PEN_SIZES, panelHtml, layerLabel } from './pc-panels.js';
import { saveSticker, listStickers, onStickersChange, stickerUrls, revokeUrls, trimTransparent, hasTransparency } from '../library.js';
import { designFiles, shareOrDownload } from '../export.js';
import { onSheet, duplicateRecord, plain, putRecord, thumbBlobFor } from '../records.js';
import { openModal } from '../modal.js';
import { openShareToGroup } from '../share.js';
import { cloudEnabled as groupsEnabled } from '../group.js';

export const title = 'Criar';

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => String(n).replace('.', ',');
const clone = (o) => JSON.parse(JSON.stringify(o));
const BG_TEMP = '__fundo__'; // foto provisória enquanto tira o fundo
const ZMIN = 0.25;
const ZMAX = 8;
const zoomToSlider = (z) => Math.round((Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN)) * 1000);
const sliderToZoom = (v) => ZMIN * Math.pow(ZMAX / ZMIN, v / 1000);

// Cor que cada moldura ganha quando é escolhida.
const FRAME_COLOR = { solid: '#ffffff', polaroid: '#ffffff', double: '#ffffff', stitch: '#ff9cc2', dots: '#ff9cc2', hearts: '#ff9cc2', checker: '#ff9cc2', stripes: '#b79cff' };

const FORMAT_GROUPS = [...new Set(FORMATS.map((f) => f.group))];

function shapeStyle(f) {
  if (f.circle) {
    const s = Math.round(14 + f.face / 3);
    return `width:${s}px;height:${s}px`;
  }
  return `width:${Math.round((f.w / f.h) * 34)}px`;
}

const sizeText = (d) => {
  const f = formatInfo(d.format);
  if (f.circle) return `botton ${f.face} mm · corte ${f.w} mm`;
  const { w, h } = cardSize(d);
  return `${fmt(w / 10)} × ${fmt(h / 10)} cm`;
};
const pad2 = (n) => String(n).padStart(2, '0');

function template() {
  return `
  <section class="pc">
    <div class="pc__editor">
      <div class="pc__head">
        <h1 class="pc__title"><span data-format-title>Photo card</span> <span class="chip" data-editing hidden>${icon('edit', { size: 16 })} Editando um card guardado</span></h1>
        <div class="seg" role="group" aria-label="Posição" data-orient-seg>
          <button type="button" class="seg__btn" data-orient="portrait" aria-pressed="true">${icon('portrait', { size: 20 })}Em pé</button>
          <button type="button" class="seg__btn" data-orient="landscape" aria-pressed="false">${icon('landscape', { size: 20 })}Deitado</button>
        </div>
      </div>

      <div class="formats" role="group" aria-label="O que você quer fazer">
        ${FORMAT_GROUPS.map(
          (g) =>
            `<span class="formats__group">${g}</span>` +
            FORMATS.filter((f) => f.group === g)
              .map(
                (f) => `<button type="button" class="format-btn" data-format="${f.id}" aria-pressed="${f.id === 'card'}" title="${f.name}">
            <span class="format-btn__shape${f.circle ? ' format-btn__shape--circle' : ''}" style="${shapeStyle(f)}"></span><span>${f.short}</span></button>`
              )
              .join('')
        ).join('')}
      </div>
      <label class="check check--inline" data-hole-row hidden>
        <input type="checkbox" data-hole>
        <span class="check__box">${icon('check', { size: 16 })}</span>
        Furo para fitinha (5 mm, em cima)
      </label>

      <div class="stagebar">
        <div class="seg seg--sides" role="group" aria-label="Lado do card">
          <button type="button" class="seg__btn" data-side="front" aria-pressed="true">${icon('card', { size: 20 })}<span data-side-label>Frente</span></button>
          <button type="button" class="seg__btn" data-side="back" aria-pressed="false">${icon('flipCard', { size: 20 })}<span data-side-label>Verso</span><span class="dot" data-back-dot hidden></span></button>
        </div>
        <div class="stagebar__hist">
          <button type="button" class="hist-btn" data-act="undo" title="Desfazer (Ctrl+Z)">${icon('undo', { size: 20 })}<span>Desfazer</span></button>
          <button type="button" class="hist-btn" data-act="redo" title="Refazer (Ctrl+Shift+Z)">${icon('redo', { size: 20 })}<span>Refazer</span></button>
        </div>
      </div>

      <div class="stage" data-stage>
        <canvas class="stage__canvas" tabindex="0" aria-label="Card. Toque numa parte do card para mexer nela."></canvas>
        <div class="stage__empty" data-empty hidden>
          <button type="button" class="pick-btn" data-act="pick">
            ${icon('photo', { size: 34 })}
            <span>Escolher foto</span>
          </button>
          <p class="stage__or">${isTouch ? 'ou cole uma imagem que você copiou' : 'ou arraste uma imagem para cá, ou cole com Ctrl+V'}</p>
          <button type="button" class="link-btn" data-act="paste">${icon('upload', { size: 18 })} Colar imagem</button>
        </div>
        <div class="stage__drop" aria-hidden="true"><span>${icon('heart', { size: 28, fill: true })} Solte a imagem aqui</span></div>
        <span class="stage__size" data-size>${sizeText('portrait')}</span>
        <span class="stage__cut" aria-hidden="true"><i></i><span data-cut-label>linha de corte</span></span>
        <span class="stage__badge" data-bg-badge hidden>${icon('photo', { size: 18 })}Mexendo no fundo</span>
        <span class="stage__busy" data-busy hidden>${icon('wand', { size: 18 })}Apagando o fundo…</span>
      </div>
      <p class="stage__hint" data-hint></p>

      <div class="selbar" data-selbar hidden>
        <span class="selbar__name" data-sel-name></span>
        <div class="selbar__acts">
          <button type="button" class="sel-btn" data-act="layer-up" title="Trazer para a frente">${icon('front', { size: 20 })}<span>Para frente</span></button>
          <button type="button" class="sel-btn" data-act="layer-down" title="Mandar para trás">${icon('back', { size: 20 })}<span>Para trás</span></button>
          <button type="button" class="sel-btn" data-act="dup" title="Duplicar">${icon('copy', { size: 20 })}<span>Duplicar</span></button>
          <button type="button" class="sel-btn sel-btn--danger" data-act="del" title="Apagar">${icon('trash', { size: 20 })}<span>Apagar</span></button>
        </div>
      </div>

      <div class="tools" data-tools>
        <div class="tabs" role="tablist" aria-label="Ferramentas" data-tabs>
          ${TABS.map(
            (t) => `<button type="button" class="tab" role="tab" id="tab-${t.id}" aria-selected="${t.id === 'foto'}" aria-controls="pc-panel" data-tab="${t.id}" tabindex="${t.id === 'foto' ? 0 : -1}">${icon(t.icon, { size: 22 })}<span>${t.name}</span></button>`
          ).join('')}
        </div>
        <div class="panel" id="pc-panel" role="tabpanel" data-panel></div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--primary" data-act="save">${icon('sparkle', { size: 22, fill: true })}<span data-save-label>Colocar na folha</span></button>
        <button type="button" class="btn btn--soft" data-act="new"><span data-new-label>Começar outro card</span></button>
      </div>
      <div class="actions actions--more">
        <button type="button" class="btn btn--soft btn--sm" data-act="save-image">${icon('download', { size: 20 })}<span data-save-image-label>Salvar imagem</span></button>
        <button type="button" class="btn btn--soft btn--sm" data-act="series">${icon('stack', { size: 20 })}Fazer série</button>
        ${groupsEnabled ? `<button type="button" class="btn btn--soft btn--sm" data-act="share-group">${icon('users', { size: 20 })}<span>Mostrar pra turma</span></button>` : ''}
        <a class="btn btn--soft btn--sm" href="#/fichario">${icon('book', { size: 20 })}Meu fichário</a>
      </div>
    </div>

    <aside class="pc__sheet" aria-labelledby="sheet-title" data-sheet>
      <div class="sheet__head">
        <h2 id="sheet-title" class="sheet__title">Minha folha</h2>
        <span class="sheet__count" data-count></span>
      </div>
      <div class="pages" data-pages></div>
      <ul class="card-list" data-list></ul>
      <a class="btn btn--soft btn--wide" href="#/adesivos">${icon('sticker', { size: 20 })}Pôr meus adesivos na folha</a>

      <details class="cloud" data-cloud${cloudEnabled ? '' : ' hidden'}>
        <summary class="cloud__head">
          <span class="cloud__title">${icon('cloud', { size: 22 })}Guardados na nuvem</span>
          <span class="cloud__status" data-cloud-status></span>
        </summary>
        <p class="cloud__tip">Cada card salvo fica guardado aqui por ${KEEP_DAYS} dias, mesmo se for apagado da folha. Toque num card para trazer ele de volta.</p>
        <ul class="cloud__grid" data-cloud-list></ul>
      </details>

      <div class="print-box">
        <label class="check">
          <input type="checkbox" data-silhouette>
          <span class="check__box">${icon('check', { size: 16 })}</span>
          Vou cortar na Silhouette (deixa 2 cm em volta para as marcas de registro)
        </label>
        <label class="check" data-cutline-row>
          <input type="checkbox" data-cutline checked>
          <span class="check__box">${icon('check', { size: 16 })}</span>
          Pontilhado de corte em volta de cada card
        </label>
        <button type="button" class="btn btn--primary btn--wide" data-act="silhouette-kit" hidden>${icon('scissors', { size: 22 })}<span data-kit-label>Fazer kit para a Silhouette</span></button>
        <div class="sil-tip" data-sil-tip hidden></div>
        <button type="button" class="btn btn--primary btn--wide" data-act="print">${icon('printer', { size: 22 })}<span data-print-label>Preparar folha para imprimir</span></button>
        <button type="button" class="btn btn--soft btn--wide" data-act="print-jpg">${icon('photo', { size: 22 })}<span data-jpg-label>Salvar folha como imagem (JPG)</span></button>
        <div class="ready" data-ready hidden>
          <p class="ready__title">${icon('heart', { size: 18, fill: true })} Sua folha está pronta!</p>
          <div class="ready__links">
            <a class="btn btn--primary" data-open target="_blank" rel="noopener">${icon('printer', { size: 20 })}Abrir e imprimir</a>
            <a class="btn btn--soft" data-download download="folha-elane.pdf">${icon('download', { size: 20 })}Salvar PDF</a>
            <button type="button" class="btn btn--soft" data-act="share" hidden>${icon('upload', { size: 20 })}Compartilhar</button>
          </div>
        </div>
        <p class="print-tip">Na hora de imprimir, escolha <strong>tamanho real</strong> ou <strong>escala 100%</strong> (não use “ajustar à página”). No rodapé da folha tem uma régua de 5 cm para conferir. Recorte seguindo o pontilhado; nos bottons, o círculo pontilhado é o corte do papel (use o cortador da Mecolour ou a Silhouette). Se for imprimir a imagem JPG, escolha também tamanho real (A4, sem margem extra). Adesivos: imprima em <strong>papel adesivo</strong> e recorte pela linha cinza.</p>
        <p class="print-tip" data-folded-tip hidden>${icon('book', { size: 18 })} Cartão dobrável: recorte o retângulo inteiro e dobre ao meio pelas marquinhas de cima e de baixo.</p>
        <p class="print-tip" data-duplex-tip hidden>${icon('flipCard', { size: 18 })} Tem card com verso: imprima <strong>frente e verso</strong>, virando pela <strong>borda comprida</strong>. Sem essa opção, imprima a folha da frente, coloque o papel de volta na impressora com o lado branco para imprimir e mande só a página do verso.</p>
      </div>
    </aside>
    <input type="file" accept="image/*" hidden data-file>
  </section>`;
}

export async function mount(root) {
  root.innerHTML = template();
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  const stage = $('[data-stage]');
  const canvas = $('canvas');
  const fileInput = $('[data-file]');
  const panel = $('[data-panel]');

  const images = new Map(); // chave -> { blob, img }
  const history = createHistory();
  let cards = []; // registros do banco (já no formato novo) + thumbUrl
  let editingId = null;
  let tab = 'foto';
  let pickCell = null;
  let pickBg = false; // a próxima foto escolhida vai para o fundo
  let pdfUrl = null;
  let pdfFile = null;
  let draftTimer = 0;
  let busy = false; // salvando ou trocando de card
  let textTimer = 0;
  let alive = true;
  let pickLoose = false; // a próxima foto escolhida vira foto solta
  let silMode = false; // folha preparada para imprimir e cortar na Silhouette
  let themes = []; // temas guardados (para "Aplicar as cores de um tema")
  let stickerPack = 'fofos';
  let library = []; // meus adesivos (com url para os botões)
  const draw = { active: false, pen: 'pen', color: '#b4532f', size: 'm', layerId: null };

  const getImg = (key) => (key === BG_TEMP ? bg.result : (images.get(key) || {}).img || null);

  // ---------- tirar fundo (estado) ----------
  const bg = {
    active: false,
    remover: null,
    ops: [],
    tolerance: 30,
    layerId: null,
    prevKey: null, // foto que estava antes de entrar no modo
    origKey: null, // foto original (sem nada apagado)
    result: null,
    running: false,
    timer: 0,
  };

  const editor = createEditor(canvas, {
    getImg,
    onChange: () => syncLive(),
    onCommit: () => {
      if (bg.active) return; // guarda tudo junto quando apertar "Pronto"
      if (history.push(editor.snapshot())) afterChange();
    },
    onSelect: () => onSelectChange(),
    onTap: (pt) => bgTap(pt),
    onEmptyCell: (i) => {
      pickCell = i;
      fileInput.click();
    },
    onEditText: () => {
      setTab('texto');
      focusText(true);
    },
    onDelete: (l) => deleteLayer(l.id),
  });
  history.reset(editor.snapshot());

  const side = () => editor.side();
  const selected = () => editor.selectedLayer();

  function afterChange() {
    syncChrome();
    renderPanel();
    saveDraftSoon();
  }

  // ---------- topo, barra de seleção, dicas ----------
  function syncChrome() {
    const d = editor.design;
    const s = side();
    const L = selected();
    const sideName = editor.getSideName();
    const lock = bg.active;
    const f = formatInfo(d.format);
    $('[data-format-title]').textContent = f.name;
    $$('[data-format]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.format === f.id));
      b.disabled = lock;
    });
    $('[data-orient-seg]').hidden = !f.rotate;
    $$('[data-side-label]').forEach((el, i) => (el.textContent = f.sides[i]));
    root.querySelector('.seg--sides').hidden = !!f.noBack;
    $('[data-hole-row]').hidden = !f.hole;
    $('[data-hole]').checked = !!d.hole;
    $('[data-hole]').disabled = lock;
    $('[data-cut-label]').textContent =
      f.id === 'poster'
        ? 'beirada da folha'
        : f.id === 'folded'
          ? 'linha de corte (só a capa)'
          : f.circle
            ? 'corte · verde: borda do botton · pontilhado: área segura'
            : f.guide
              ? `linha de corte · verde: ${f.guide.label}`
              : 'linha de corte';
    $$('[data-orient]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.orient === d.orientation));
      b.disabled = lock;
    });
    $$('[data-side]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.side === sideName));
      b.disabled = lock;
    });
    $('[data-back-dot]').hidden = !sideHasContent(d.back);
    $('[data-act="undo"]').disabled = lock || !history.canUndo();
    $('[data-act="redo"]').disabled = lock || !history.canRedo();
    $('[data-size]').textContent = sizeText(d);
    $('[data-busy]').hidden = !bg.running;
    $('[data-editing]').hidden = !editingId;
    $('[data-save-label]').textContent = editingId ? 'Salvar' : 'Colocar na folha';
    $('[data-new-label]').textContent = editingId ? 'Cancelar edição' : f.id === 'card' ? 'Começar outro card' : 'Começar de novo';
    $('[data-act="save"]').disabled = isEmpty(d);
    $('[data-act="new"]').disabled = lock;
    $('[data-act="save-image"]').disabled = lock || isEmpty(d);
    $('[data-act="series"]').disabled = lock;
    if ($('[data-act="share-group"]')) $('[data-act="share-group"]').disabled = lock || isEmpty(d);
    $('[data-empty]').hidden = lock || draw.active || sideName !== 'front' || s.layers.length > 0 || !editor.cells().length;
    $('[data-bg-badge]').hidden = lock || !isBgPhoto(L);
    $$('[data-tab]').forEach((b) => {
      b.disabled = lock;
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      b.tabIndex = b.dataset.tab === tab ? 0 : -1;
    });
    root.querySelector('.pc').classList.toggle('is-bg-mode', lock);

    // barra do item escolhido
    const bar = $('[data-selbar]');
    bar.hidden = !L || lock;
    if (L && !lock) {
      const photos = s.layers.filter((l) => l.type === 'photo' && !isBgPhoto(l)).length;
      const lab = layerLabel(L, 0, photos);
      const i = s.layers.indexOf(L);
      $('[data-sel-name]').innerHTML = `${lab.emoji ? `<span class="layer__emoji">${lab.emoji}</span>` : icon(lab.ic, { size: 20 })}<span></span>`;
      $('[data-sel-name] span:last-child').textContent = lab.text;
      $('[data-act="layer-up"]').disabled = i >= s.layers.length - 1;
      $('[data-act="layer-down"]').disabled = i <= 0;
      $('[data-act="dup"]').disabled = L.type === 'photo';
    }
    bar.hidden = bar.hidden || draw.active;

    const tapWord = isTouch ? 'Toque' : 'Clique';
    let hint = '';
    if (draw.active) hint = `Desenhe em cima ${f.id === 'poster' ? 'do pôster' : 'do card'}. Toque em “Pronto” quando terminar.`;
    else if (!lock) {
      if (!L) hint = s.layers.length ? `${tapWord} em alguma coisa do card para mexer nela.` : '';
      else if (isBgPhoto(L))
        hint = `Mexendo no fundo: ${isTouch ? 'arraste e use dois dedos' : 'arraste e use a rodinha'} para enquadrar. Toque em “Pronto” quando terminar.`;
      else if (L.type === 'photo')
        hint = isTouch
          ? 'Arraste com um dedo para mover a foto. Com dois dedos, abra para aumentar e gire para inclinar.'
          : 'Arraste para mover a foto. Use a rodinha do mouse para aumentar (com Shift, para girar).';
      else
        hint = `Arraste para mudar de lugar. A bolinha roxa gira e muda o tamanho.${L.type === 'text' ? ` ${tapWord} duas vezes para escrever.` : ''}`;
    }
    $('[data-hint]').textContent = hint;
    $('[data-hint]').hidden = !hint;
  }

  function isEmpty(d) {
    return !d.front.layers.length && !d.back.layers.length;
  }

  // Valores que mudam enquanto arrasta no card (sem refazer o painel).
  function syncLive() {
    const L = selected();
    if (!L) return;
    if (L.type === 'photo') {
      const z = panel.querySelector('[data-photo="zoom"]');
      const r = panel.querySelector('[data-photo="rot"]');
      if (z && document.activeElement !== z) z.value = zoomToSlider(editor.getZoom(L));
      if (r && document.activeElement !== r) r.value = Math.round(L.rotation);
      const out = r && r.parentElement.querySelector('output');
      if (out) out.textContent = `${Math.round(L.rotation)}°`;
    } else {
      const s = panel.querySelector('[data-prop="size"]');
      if (s && document.activeElement !== s) s.value = L.size;
    }
  }

  // ---------- abas e painéis ----------
  function setTab(t) {
    tab = t;
    syncChrome();
    renderPanel(true);
  }

  function onSelectChange() {
    if (bg.active) return;
    const L = selected();
    const sel = editor.getSelection();
    if (L) {
      if (isBgPhoto(L)) tab = tab === 'camadas' || tab === 'efeitos' ? tab : 'fundo';
      else if (L.type === 'text' && tab !== 'camadas') tab = 'texto';
      else if (L.type === 'sticker' && tab !== 'camadas') tab = 'adesivos';
      else if (L.type === 'draw' && tab !== 'camadas') tab = 'desenho';
      else if (L.type === 'photo' && !['foto', 'efeitos', 'camadas'].includes(tab)) tab = 'foto';
    } else if (sel && sel.cell != null && !['colagem', 'moldura', 'camadas'].includes(tab)) tab = 'foto';
    syncChrome();
    renderPanel(true);
  }

  function panelState() {
    const L = selected();
    return {
      tab,
      layer: L,
      side: side(),
      design: editor.design,
      cellsCount: editor.cells().length,
      bgActive: bg.active,
      bg: { tolerance: bg.tolerance, ops: bg.ops.length, hasAuto: bg.ops.some((o) => o.kind === 'edges'), running: bg.running },
      isTouch,
      zoomSlider: L && L.type === 'photo' ? zoomToSlider(editor.getZoom(L)) : 0,
      unit: editor.unit(),
      pack: stickerPack,
      library,
      draw: { ...draw },
      canUndo: history.canUndo(),
      themes,
    };
  }

  // Refaz o painel. Enquanto escreve num campo, só atualiza os valores (para não perder o cursor).
  function renderPanel(force = false) {
    const a = document.activeElement;
    const typing = a && panel.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type === 'text'));
    if (typing && !force) return syncLive();
    let focusSel = null;
    if (a && panel.contains(a)) {
      const attrs = [...a.attributes].filter((x) => x.name.startsWith('data-'));
      if (attrs.length) focusSel = attrs.map((x) => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
    }
    panel.innerHTML = panelHtml(tab, panelState());
    panel.setAttribute('aria-labelledby', `tab-${tab}`);
    fillPreviews();
    if (focusSel) {
      const el = panel.querySelector(focusSel);
      if (el) el.focus({ preventScroll: true });
    }
  }

  function focusText(selectAll) {
    const ta = panel.querySelector('textarea[data-prop="text"]');
    if (!ta) return;
    ta.focus();
    if (selectAll) ta.select();
  }

  // Desenhos pequenos dos botões (filtros, adesivos, estampas, molduras, modelos).
  function fillPreviews() {
    const d = editor.design;
    const L = selected();
    const put = (el, c) => {
      el.innerHTML = '';
      el.appendChild(c);
    };

    const filterEls = panel.querySelectorAll('[data-filter-preview]');
    if (filterEls.length && L && L.type === 'photo') {
      const img = getImg(L.imageKey);
      if (img) {
        const small = document.createElement('canvas');
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const f = 140 / Math.min(iw, ih);
        small.width = Math.max(1, Math.round(iw * f));
        small.height = Math.max(1, Math.round(ih * f));
        small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
        filterEls.forEach((el) => {
          const res = processPhoto(small, { filter: el.dataset.filterPreview, brightness: 0, contrast: 0, saturation: 0 }, null);
          const c = document.createElement('canvas');
          c.width = c.height = 120;
          const cx = c.getContext('2d');
          const s = Math.max(120 / small.width, 120 / small.height);
          cx.drawImage(res.canvas, (120 - small.width * s) / 2, (120 - small.height * s) / 2, small.width * s, small.height * s);
          put(el, c);
        });
      }
    }

    panel.querySelectorAll('[data-sticker-preview]').forEach((el) => put(el, stickerPreview(el.dataset.stickerPreview, 46)));

    panel.querySelectorAll('[data-pattern-preview]').forEach((el) => {
      const id = el.dataset.patternPreview;
      const base = el.dataset.base;
      const mini = { orientation: 'portrait', front: { bg: id === 'none' ? { kind: 'solid', color: base } : { kind: 'pattern', pattern: id, color: base }, frame: { id: 'none' }, layout: '0', layers: [] } };
      mini.back = mini.front;
      put(el, renderThumb(mini, 'front', getImg, 96));
    });

    panel.querySelectorAll('[data-frame-preview]').forEach((el) => {
      const id = el.dataset.framePreview;
      const s = side();
      const mini = { format: d.format, orientation: d.orientation, front: { bg: s.bg, frame: { id, color: frameColorFor(id) }, layout: s.layout === '0' ? '1' : s.layout, layers: [] } };
      mini.back = mini.front;
      put(el, renderThumb(mini, 'front', getImg, 110, { placeholders: 'sample' }));
    });

    panel.querySelectorAll('[data-template-preview]').forEach((el) => {
      const s = makeTemplate(el.dataset.templatePreview, d);
      const mini = { format: d.format, orientation: d.orientation, front: s, back: s };
      put(el, renderThumb(mini, 'front', getImg, 150, { placeholders: 'sample' }));
    });
  }

  function frameColorFor(id) {
    const cur = side().frame;
    if (id === 'polaroid') return '#ffffff';
    if (cur.id !== 'none' && cur.id !== 'polaroid' && cur.color && cur.color !== FRAME_COLOR[cur.id]) return cur.color; // cor que ela escolheu
    return FRAME_COLOR[id] || '#ffffff';
  }

  // ---------- imagens ----------
  async function loadImages(map) {
    for (const [key, blob] of Object.entries(map || {})) {
      if (!blob) continue;
      try {
        images.set(key, { blob, img: await blobToImage(blob) });
      } catch (_) {}
    }
  }

  function releaseAll() {
    images.forEach((v) => releaseImage(v.img));
    images.clear();
  }

  function blobsFor(d) {
    const out = {};
    for (const k of imageKeys(d)) if (images.has(k)) out[k] = images.get(k).blob;
    return out;
  }

  function chooseCell() {
    const sel = editor.getSelection();
    const cs = editor.cells();
    if (sel && sel.cell != null && cs[sel.cell]) return sel.cell;
    const L = selected();
    if (L && L.type === 'photo' && !isBgPhoto(L)) return L.cell;
    const used = new Set(side().layers.filter((l) => l.type === 'photo' && !isBgPhoto(l)).map((l) => l.cell));
    const free = cs.findIndex((_, i) => !used.has(i));
    return free >= 0 ? free : 0;
  }

  // Coloca uma foto num espaço do card (troca se já tinha uma).
  async function placePhoto(fileOrBlob, cell = null) {
    try {
      const { blob, img } = await importImageFile(fileOrBlob);
      if (!alive) return;
      cancelBg();
      const key = newId();
      images.set(key, { blob, img });
      if (!editor.cells().length) editor.restructure((s) => (s.layout = '1'));
      const target = cell != null && editor.cells()[cell] ? cell : chooseCell();
      let id = null;
      editor.change((d, s) => {
        const rect = editor.cells()[target];
        const old = s.layers.find((l) => l.type === 'photo' && l.cell === target);
        if (old) {
          Object.assign(old, { imageKey: key, originalKey: null, bgOps: null, x: 0, y: 0, rotation: 0, flip: false });
          old.scale = coverScale(img.naturalWidth, img.naturalHeight, rect.w, rect.h, 0);
          id = old.id;
        } else {
          const L = newPhotoLayer(key, target, img, rect);
          let at = 0;
          s.layers.forEach((l, i) => {
            if (l.type === 'photo') at = i + 1;
          });
          s.layers.splice(at, 0, L);
          id = L.id;
        }
      });
      editor.select(id);
      editor.commitNow();
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
    }
  }

  // Foto de fundo: ocupa o card inteiro, atrás de tudo. Fica escolhida para poder enquadrar.
  async function placeBgPhoto(fileOrBlob) {
    try {
      const { blob, img } = await importImageFile(fileOrBlob);
      if (!alive) return;
      cancelBg();
      const key = newId();
      images.set(key, { blob, img });
      const rect = cellFor(side(), editor.design, BG_CELL);
      let id = null;
      editor.change((d, s) => {
        const old = s.layers.find(isBgPhoto);
        if (old) {
          Object.assign(old, { imageKey: key, originalKey: null, bgOps: null, x: 0, y: 0, rotation: 0, flip: false });
          old.scale = coverScale(img.naturalWidth, img.naturalHeight, rect.w, rect.h, 0);
          id = old.id;
        } else {
          const L = newPhotoLayer(key, BG_CELL, img, rect);
          s.layers.unshift(L);
          id = L.id;
        }
      });
      editor.select(id);
      editor.commitNow();
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
    }
  }

  // Para onde vai uma imagem colada ou arrastada.
  const placeAny = (file) => (isBgPhoto(selected()) ? placeBgPhoto(file) : placePhoto(file));

  function pickPhoto(cell = null, toBg = false, loose = false) {
    pickCell = cell;
    pickBg = toBg;
    pickLoose = loose;
    fileInput.click();
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) pickLoose ? addLoosePhoto(f) : pickBg ? placeBgPhoto(f) : placePhoto(f, pickCell);
    pickCell = null;
    pickBg = false;
    pickLoose = false;
    fileInput.value = '';
  });

  // Foto solta: a foto inteira por cima de tudo, com borda de polaroid (ótima para mural e pôster).
  async function addLoosePhoto(file) {
    try {
      const { blob, img } = await importImageFile(file);
      if (!alive) return;
      const key = newId();
      images.set(key, { blob, img });
      addSticker({
        kind: 'image',
        name: 'image',
        imageKey: key,
        iw: img.naturalWidth,
        ih: img.naturalHeight,
        frame: 'polaroid',
        shadow: true,
        color: null,
        size: 30 * editor.unit(),
      });
      setTab('adesivos');
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
    }
  }

  // Um dos meus adesivos.
  async function addMine(id) {
    const st = library.find((x) => x.id === id);
    if (!st) return;
    const key = `stk_${id}`;
    try {
      if (!images.has(key)) images.set(key, { blob: st.blob, img: await blobToImage(st.blob) });
    } catch (_) {
      return toast('Não consegui abrir esse adesivo.', { kind: 'error' });
    }
    addSticker({ kind: 'image', name: 'image', imageKey: key, iw: st.w, ih: st.h, frame: 'none', shadow: false, color: null, size: 22 * editor.unit() });
  }

  function addCalendar() {
    const { w, h } = cardSize(editor.design);
    const now = new Date();
    addSticker({ kind: 'calendar', name: 'calendar', color: '#ff5c93', month: now.getMonth(), year: now.getFullYear(), size: Math.min(w * 0.8, (h * 0.8) / 1.08), rotation: 0, x: 0, y: 0 });
  }

  // A foto escolhida do jeito que aparece (efeitos, contorno, espelhada), sem cortar nada.
  function photoCutout(L) {
    const img = getImg(L.imageKey);
    if (!img) return null;
    const res = processPhoto(img, L.fx, L.outline);
    const src = res.canvas;
    const c = document.createElement('canvas');
    c.width = src.naturalWidth || src.width;
    c.height = src.naturalHeight || src.height;
    const ctx = c.getContext('2d');
    if (L.flip) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0);
    return c;
  }

  async function toSticker() {
    const L = selected();
    if (!L || L.type !== 'photo') return;
    const c = photoCutout(L);
    if (!c) return;
    try {
      const transparent = hasTransparency(c);
      await saveSticker(c);
      toast(transparent ? 'Virou adesivo! Ele está em Adesivos › Meus.' : 'Virou adesivo (quadrado). Para ficar só a pessoa, use “Tirar fundo” antes.', {
        action: 'Ver',
        duration: 6000,
        onAction: () => {
          stickerPack = 'meus';
          editor.select(null);
          setTab('adesivos');
        },
      });
    } catch (err) {
      toast(err.message || 'Não consegui guardar o adesivo.', { kind: 'error' });
    }
  }

  async function saveCutout() {
    const L = selected();
    if (!L || L.type !== 'photo') return;
    const c = photoCutout(L);
    if (!c) return;
    const out = trimTransparent(c) || c;
    const blob = await canvasToBlob(out, 'image/png');
    const r = await shareOrDownload([new File([blob], L.originalKey ? 'elane-sem-fundo.png' : 'elane-foto.png', { type: 'image/png' })]);
    if (r === 'downloaded') toast('Foto salva!');
  }

  async function saveImage() {
    if (draw.active) finishDraw();
    if (bg.active) await finishBg();
    if (isEmpty(editor.design)) return;
    const btn = $('[data-act="save-image"]');
    const label = $('[data-save-image-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    label.textContent = 'Preparando…';
    try {
      const files = await designFiles(clone(editor.design), getImg);
      const r = await shareOrDownload(files, 'Central Elane');
      if (r === 'downloaded') toast(files.length > 1 ? 'Imagens salvas (frente e verso)!' : 'Imagem salva!');
    } catch (err) {
      console.error(err);
      toast('Não consegui salvar a imagem. Tente de novo.', { kind: 'error' });
    } finally {
      btn.classList.remove('is-busy');
      label.textContent = 'Salvar imagem';
      syncChrome();
    }
  }

  // Mostrar pra turma: o card como está agora no editor.
  async function shareToGroup() {
    if (draw.active) finishDraw();
    if (bg.active) await finishBg();
    if (isEmpty(editor.design)) return;
    const btn = $('[data-act="share-group"]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      await openShareToGroup({ design: clone(editor.design), getImg, cardId: editingId });
    } finally {
      btn.classList.remove('is-busy');
      syncChrome();
    }
  }

  async function pasteFromClipboard(toBg = false) {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast(isTouch ? 'Este tablet não deixou colar por aqui. Use “Escolher foto”.' : 'Use Ctrl+V para colar a imagem.', { kind: 'error' });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const file = new File([await item.getType(type)], 'colada', { type });
          return toBg ? placeBgPhoto(file) : placePhoto(file);
        }
      }
      toast('Não tem imagem copiada. Copie uma foto e tente de novo.', { kind: 'error' });
    } catch (_) {
      toast('Não consegui colar. Copie uma imagem e tente de novo.', { kind: 'error' });
    }
  }

  function onPaste(e) {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    const items = e.clipboardData ? [...e.clipboardData.items] : [];
    const item = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    placeAny(item.getAsFile());
  }
  document.addEventListener('paste', onPaste);

  // Arrastar e soltar: vale soltar em qualquer lugar da tela.
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list');
  function onDragEnter(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    stage.classList.add('is-dropping');
  }
  function onDragOver(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) stage.classList.remove('is-dropping');
  }
  async function onDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove('is-dropping');
    const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) return placeAny(file);
    // Imagem arrastada de outra página da internet.
    const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find((l) => l && !l.startsWith('#'));
    if (!url) return toast('Isso não parece ser uma imagem.', { kind: 'error' });
    try {
      const res = await fetch(url.trim(), { mode: 'cors' });
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error();
      placeAny(blob);
    } catch (_) {
      toast('Esse site não deixou copiar a imagem. Salve a foto no aparelho e arraste o arquivo.', { kind: 'error', duration: 6000 });
    }
  }
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  // ---------- desfazer / refazer ----------
  function undo() {
    if (bg.active) return;
    const s = history.undo();
    if (!s) return;
    editor.restore(fixDraws(JSON.parse(s)));
    ensureDrawLayer();
    afterChange();
  }

  function redo() {
    if (bg.active) return;
    const s = history.redo();
    if (!s) return;
    editor.restore(fixDraws(JSON.parse(s)));
    ensureDrawLayer();
    afterChange();
  }

  // ---------- desenhar ----------
  const penWidth = () => (PEN_SIZES.find((p) => p.id === draw.size) || PEN_SIZES[1]).mm * editor.unit();

  function startDraw() {
    if (bg.active) return;
    if (draw.active) finishDraw();
    const L = newDrawLayer();
    editor.change((d, s) => s.layers.push(L));
    draw.active = true;
    draw.layerId = L.id;
    editor.setDrawMode({ layerId: L.id, c: draw.color, w: penWidth(), pen: draw.pen });
    tab = 'desenho';
    syncChrome();
    renderPanel(true);
  }

  // Depois de desfazer, o desenho em andamento pode ter sumido: começa outro.
  function ensureDrawLayer() {
    if (!draw.active || editor.layerById(draw.layerId)) return;
    const L = newDrawLayer();
    editor.change((d, s) => s.layers.push(L));
    draw.layerId = L.id;
    editor.setPen({ layerId: L.id });
  }

  // Desenhos que voltaram pelo desfazer sem estar "acabados" ganham caixa e centro.
  function fixDraws(d) {
    for (const s of [d.front, d.back]) {
      s.layers = s.layers.filter((l) => {
        if (l.type !== 'draw' || (draw.active && l.id === draw.layerId) || l.bw) return true;
        return finishDrawLayer(l);
      });
    }
    return d;
  }

  function finishDraw() {
    if (!draw.active) return;
    draw.active = false;
    editor.setDrawMode(null);
    let id = null;
    const lid = draw.layerId;
    draw.layerId = null;
    editor.change(
      (d, s) => {
        const l = s.layers.find((x) => x.id === lid);
        if (!l) return;
        if (finishDrawLayer(l)) id = l.id;
        else s.layers = s.layers.filter((x) => x !== l);
      },
      { commit: true }
    );
    if (id) editor.select(id);
    syncChrome();
    renderPanel(true);
  }

  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault();
      redo();
    }
  }
  document.addEventListener('keydown', onKey);

  // ---------- rascunho (para não perder o que está fazendo) ----------
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftNow, 400);
  }

  function saveDraftNow() {
    if (bg.active) return;
    const d = editor.design;
    if (isEmpty(d) && !editingId) return db.deleteMeta('draft').catch(() => {});
    db.setMeta('draft', draftData()).catch(() => {});
  }

  function draftData() {
    const d = clone(editor.design);
    return { v: 2, design: d, images: blobsFor(d), editingId, side: editor.getSideName() };
  }

  async function restoreDraft() {
    try {
      let draft = await db.getMeta('draft');
      if (!draft) return;
      if (!draft.v && draft.imageBlob) {
        const m = migrateRecord({ design: draft.design, imageBlob: draft.imageBlob, originalBlob: draft.originalBlob, bgOps: draft.bgOps, layerBlob: draft.layerBlob });
        draft = { v: 2, design: m.design, images: m.images, editingId: draft.editingId };
      }
      if (!draft.design || !draft.design.front) return;
      await applyDraft(draft);
    } catch (_) {}
  }

  // Coloca no editor um rascunho guardado (ao abrir o app ou ao desfazer um "cancelar").
  async function applyDraft(draft) {
    cancelBg();
    releaseAll();
    await loadImages(draft.images);
    if (!alive) return;
    editingId = draft.editingId && cards.some((c) => c.id === draft.editingId) ? draft.editingId : null;
    editor.load(draft.design, { side: draft.side === 'back' ? 'back' : 'front' });
    history.reset(editor.snapshot());
    syncChrome();
    renderPanel(true);
    renderSheet();
    saveDraftSoon();
  }

  // Tem coisa no editor que ainda não foi para a folha?
  function hasUnsaved() {
    if (isEmpty(editor.design)) return false;
    if (bg.active || !editingId) return true;
    const old = cards.find((c) => c.id === editingId);
    return !old || JSON.stringify(old.design) !== editor.snapshot();
  }

  // "Começar outro card" / "Cancelar edição": dá para desfazer, caso tenha sido sem querer.
  function startNew() {
    cancelBg();
    if (draw.active) finishDraw();
    const lost = hasUnsaved() ? draftData() : null;
    resetEditor();
    renderSheet();
    if (!lost) return;
    toast(lost.editingId ? 'Edição cancelada.' : 'Card descartado.', {
      action: 'Desfazer',
      duration: 8000,
      onAction: () => {
        if (busy || editingId || !isEmpty(editor.design)) {
          toast('Você já começou outro card. Coloque ele na folha e tente de novo.', { kind: 'error' });
          return;
        }
        applyDraft(lost).catch(() => toast('Não consegui trazer o card de volta.', { kind: 'error' }));
      },
    });
  }

  function resetEditor(format = editor.design.format) {
    cancelBg();
    if (draw.active) finishDraw();
    const o = editor.design.orientation;
    releaseAll();
    editingId = null;
    editor.load(newDesign(o, format));
    history.reset(editor.snapshot());
    db.deleteMeta('draft').catch(() => {});
    tab = 'foto';
    syncChrome();
    renderPanel(true);
  }

  // ---------- tirar fundo ----------
  async function enterBg() {
    const L = selected();
    if (bg.active || !L || L.type !== 'photo') return;
    bg.active = true;
    bg.running = true;
    bg.layerId = L.id;
    bg.prevKey = L.imageKey;
    bg.origKey = L.originalKey || L.imageKey;
    tab = 'foto';
    editor.setTapMode(true, L.id);
    syncChrome();
    renderPanel(true);
    try {
      const original = getImg(bg.origKey);
      if (!bg.remover) bg.remover = createBgRemover();
      await bg.remover.load(original);
      bg.ops = L.bgOps ? L.bgOps.ops.map((o) => ({ ...o })) : [{ kind: 'edges' }];
      bg.tolerance = L.bgOps ? L.bgOps.tolerance : 30;
      await runBg({ firstAuto: !L.bgOps });
    } catch (err) {
      console.error(err);
      toast('Não consegui tirar o fundo desta foto.', { kind: 'error' });
      cancelBg();
    }
  }

  function bgLayer() {
    for (const s of [editor.design.front, editor.design.back]) {
      const l = s.layers.find((x) => x.id === bg.layerId);
      if (l) return l;
    }
    return null;
  }

  async function runBg({ firstAuto = false } = {}) {
    if (!bg.active) return;
    bg.running = true;
    syncBgPanel();
    const res = await bg.remover.run(bg.ops, bg.tolerance);
    if (!res || !bg.active) return; // chegou um pedido mais novo
    bg.running = false;
    bg.result = res.canvas;
    const L = bgLayer();
    if (L) editor.change(() => (L.imageKey = BG_TEMP));
    editor.redraw();
    syncBgPanel();
    if (firstAuto && res.coverage < 0.35) {
      toast(`O fundo desta foto tem muitas cores. ${isTouch ? 'Toque' : 'Clique'} nas partes que quer apagar.`, { duration: 6000 });
    }
  }

  function syncBgPanel() {
    $('[data-busy]').hidden = !bg.running;
    const set = (sel, dis) => {
      const b = panel.querySelector(sel);
      if (b) b.disabled = dis;
    };
    set('[data-act="bg-undo"]', !bg.ops.length);
    set('[data-act="bg-reset"]', !bg.ops.length);
    set('[data-act="bg-auto"]', bg.ops.some((o) => o.kind === 'edges'));
    set('[data-act="bg-done"]', bg.running);
    const out = panel.querySelector('[data-tol-out]');
    if (out) out.textContent = bg.tolerance;
  }

  function bgTap(pt) {
    if (!bg.active || bg.ops.length >= 200) return;
    bg.ops.push({ kind: 'point', x: pt.x, y: pt.y });
    runBg();
  }

  // Sai do modo sem aplicar (volta a foto de antes).
  function cancelBg() {
    if (!bg.active) return;
    const L = bgLayer();
    if (L) L.imageKey = bg.prevKey;
    bg.active = false;
    bg.running = false;
    bg.result = null;
    editor.setTapMode(false);
    syncChrome();
    renderPanel(true);
  }

  // Aplica o resultado e sai do modo.
  async function finishBg() {
    if (!bg.active) return;
    const done = panel.querySelector('[data-act="bg-done"]');
    if (done) done.disabled = true;
    try {
      while (bg.running) await new Promise((r) => setTimeout(r, 50));
      const L = bgLayer();
      if (L) {
        if (!bg.ops.length) {
          L.imageKey = bg.origKey;
          L.originalKey = null;
          L.bgOps = null;
        } else {
          const blob = await canvasToBlob(bg.result, 'image/png');
          const key = newId();
          images.set(key, { blob, img: await blobToImage(blob) });
          L.imageKey = key;
          L.originalKey = bg.origKey;
          L.bgOps = { ops: bg.ops.map((o) => ({ ...o })), tolerance: bg.tolerance };
        }
      }
      bg.active = false;
      bg.running = false;
      bg.result = null;
      editor.setTapMode(false);
      editor.commitNow();
      syncChrome();
      renderPanel(true);
    } catch (err) {
      console.error(err);
      toast('Não consegui guardar a foto sem fundo. Tente de novo.', { kind: 'error' });
      if (done) done.disabled = false;
    }
  }

  // ---------- mudanças no card ----------
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  function setColor(prop, color, commit) {
    if (prop === '@pen') {
      draw.color = color;
      editor.setPen({ c: color });
      if (commit) renderPanel(true);
      return;
    }
    if (prop === '@draw') {
      const L = selected();
      if (!L || L.type !== 'draw') return;
      editor.change(() => L.strokes.forEach((st) => (st.c = color)), { commit });
    } else if (prop === '@bg') {
      editor.change((d, s) => {
        s.bg = s.bg.kind === 'pattern' ? { ...s.bg, color } : { kind: 'solid', color };
      }, { commit });
    } else if (prop === '@frame') {
      editor.change((d, s) => (s.frame.color = color), { commit });
    } else {
      const L = selected();
      if (!L) return;
      editor.change(() => setPath(L, prop, color || null), { commit });
    }
    if (!commit) {
      // mostra a cor nova no botão de "outra cor" enquanto escolhe
      const lab = panel.querySelector(`[data-color-input="${prop}"]`);
      if (lab && lab.parentElement) lab.parentElement.style.setProperty('--sw', color);
    }
  }

  function addText() {
    const { h } = cardSize(editor.design);
    const u = editor.unit();
    const s = side();
    const texts = s.layers.filter((l) => l.type === 'text').length;
    const hasPhoto = s.layers.some((l) => l.type === 'photo');
    const L = newTextLayer({ size: 7 * u, y: (hasPhoto ? h * 0.3 : 0) - (texts % 3) * 9 * u });
    editor.change((d, sd) => sd.layers.push(L), { commit: true });
    editor.select(L.id);
    setTab('texto');
    focusText(true);
  }

  function addSticker(props) {
    const u = editor.unit();
    const L = newStickerLayer({ size: 14 * u, x: (Math.random() - 0.5) * 16 * u, y: (Math.random() - 0.5) * 16 * u, rotation: Math.round((Math.random() - 0.5) * 24), ...props });
    editor.change((d, s) => s.layers.push(L), { commit: true });
    editor.select(L.id);
  }

  function moveLayer(id, dir) {
    editor.change((d, s) => {
      const i = s.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return;
      [s.layers[i], s.layers[j]] = [s.layers[j], s.layers[i]];
    }, { commit: true });
  }

  function duplicate() {
    const L = selected();
    if (!L || L.type === 'photo') return;
    const u = editor.unit();
    const copy = { ...clone(L), id: uid(), x: L.x + 4 * u, y: L.y + 4 * u };
    editor.change((d, s) => s.layers.splice(s.layers.indexOf(L) + 1, 0, copy), { commit: true });
    editor.select(copy.id);
  }

  function deleteLayer(id) {
    const s = side();
    const L = s.layers.find((l) => l.id === id);
    if (!L) return;
    const what = isBgPhoto(L)
      ? 'Foto de fundo tirada.'
      : L.type === 'photo'
        ? 'Foto tirada do card.'
        : L.type === 'text'
          ? 'Texto apagado.'
          : L.type === 'draw'
            ? 'Desenho apagado.'
            : 'Adesivo apagado.';
    editor.change((d, sd) => (sd.layers = sd.layers.filter((l) => l.id !== id)), { commit: true });
    editor.select(null);
    toast(what, { action: 'Desfazer', duration: 6000, onAction: undo });
  }

  function applyTemplate(id) {
    const t = makeTemplate(id, editor.design);
    const hint = templateInfo(id).hint;
    const removed = editor.restructure(
      (s) => {
        const photos = s.layers.filter((l) => l.type === 'photo').sort((a, b) => a.cell - b.cell);
        photos.forEach((p, i) => (p.cell = i));
        s.bg = t.bg;
        s.frame = t.frame;
        s.layout = t.layout;
        s.layers = [...photos, ...t.layers];
      },
      { refit: true }
    );
    editor.select(null);
    if (removed) toast('Modelo aplicado. Algumas fotos não couberam: dá para desfazer.', { action: 'Desfazer', onAction: undo });
    else toast(hint ? `Modelo aplicado! ${hint}` : 'Modelo aplicado!', { duration: hint ? 7000 : 3800 });
  }

  function setFormat(id) {
    if (draw.active) finishDraw();
    cancelBg();
    const d = editor.design;
    if (isEmpty(d) && !sideHasContent(d.front) && !sideHasContent(d.back)) {
      // ainda não tem nada: começa com o jeito padrão do formato (ex.: mini já vem com moldura polaroid)
      editor.load(newDesign(d.orientation, id));
      editor.commitNow();
    } else editor.setFormat(id);
    if (formatInfo(id).noBack && editor.getSideName() === 'back') editor.setSide('front');
    editor.select(null);
    syncChrome();
    renderPanel(true);
  }

  function setLayout(id) {
    const removed = editor.restructure((s) => (s.layout = id));
    if (removed) toast(removed === 1 ? 'Uma foto saiu do card.' : `${removed} fotos saíram do card.`, { action: 'Desfazer', onAction: undo, duration: 6000 });
  }

  function setFrame(id) {
    editor.restructure((s) => (s.frame = { id, color: frameColorFor(id) }));
  }

  // ---------- folha ----------
  // cards = tudo o que está guardado no aparelho (cards de todos os formatos e adesivos para imprimir).
  // Só vai para a folha o que está "na folha" (os outros ficam no fichário).
  async function loadCards() {
    const list = (await db.allCards()).map(migrateRecord);
    cards.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
    cards = list.map((c) => ({ ...c, thumbUrl: c.thumbBlob ? URL.createObjectURL(c.thumbBlob) : '' }));
  }

  const sheetRecords = () => cards.filter(onSheet);
  const recordOf = plain;

  // Miniatura do jeito que sai na folha: card deitado aparece girado; cartão dobrável mostra a capa à direita.
  function thumbImg(card) {
    if (isSticker(card)) return `<img class="is-sticker" src="${card.thumbUrl}" alt="" draggable="false">`;
    const d = card.design;
    const f = formatInfo(d.format);
    if (f.id === 'folded') return `<img class="is-half" src="${card.thumbUrl}" alt="" draggable="false">`;
    const land = f.rotate && d.orientation === 'landscape';
    const style = land ? ` style="width:${((f.h / f.w) * 100).toFixed(2)}%;height:${((f.w / f.h) * 100).toFixed(2)}%"` : '';
    return `<img class="${land ? 'is-landscape' : ''}"${style} src="${card.thumbUrl}" alt="" draggable="false">`;
  }

  // Miniatura da lista (na orientação do próprio card).
  function listThumb(card) {
    const cls = isSticker(card) ? 'is-sticker' : '';
    return `<img class="${cls}" src="${card.thumbUrl}" alt="" draggable="false">`;
  }

  function countText(list, pages) {
    const n = (pred) => list.filter(pred).reduce((t, c) => t + (c.copies || 1), 0);
    const st = n(isSticker);
    const cd = n((c) => !isSticker(c));
    const parts = [];
    if (cd) parts.push(`${cd} ${cd === 1 ? 'peça' : 'peças'}`);
    if (st) parts.push(`${st} ${st === 1 ? 'adesivo' : 'adesivos'}`);
    if (pages) parts.push(`${pages} ${pages === 1 ? 'folha' : 'folhas'}`);
    return parts.join(' · ');
  }

  function renderSheet() {
    invalidatePdf();
    const list = sheetRecords();
    const pages = layoutSheet(list, { silhouette: silMode });
    $('[data-count]').textContent = list.length ? countText(list, pages.length) : '';
    const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
    const box = (it) => `left:${pct(it.x, SHEET.pageW)};top:${pct(it.y, SHEET.pageH)};width:${pct(it.w, SHEET.pageW)};height:${pct(it.h, SHEET.pageH)}`;
    let shown = pages;
    if (!pages.length) {
      // folha vazia: mostra onde os cards vão ficar
      const ghost = layoutSheet([{ id: 'x', copies: 9, design: { format: 'card' } }], { silhouette: silMode })[0];
      shown = [{ ghost: true, items: ghost.items }];
    }
    $('[data-pages]').innerHTML = shown
      .map(
        (page, p) => `
      <figure class="page" data-page="${p}">
        <div class="page__paper${silMode && !page.full ? ' is-silhouette' : ''}">
          ${page.items
            .map((it) => {
              if (page.ghost) return `<span class="slot" style="${box(it)}"></span>`;
              const c = it.rec;
              const kind = it.sticker ? ' slot--sticker' : it.full ? ' slot--full' : it.folded ? ' slot--folded' : it.circle ? ' slot--circle' : '';
              const f = it.sticker ? null : formatInfo(c.design.format);
              const r = f && f.radius ? ` slot--r${f.id}` : '';
              if (it.sticker) return `<span class="slot is-filled${kind}" style="${box(it)}">${thumbImg(c)}</span>`;
              return `<button type="button" class="slot is-filled${kind}${r}" style="${box(it)}" data-edit="${c.id}" aria-label="Editar">${thumbImg(c)}</button>`;
            })
            .join('')}
        </div>
        ${shown.length > 1 ? `<figcaption>${page.full ? 'Pôster' : 'Folha'} ${p + 1} de ${shown.length}</figcaption>` : ''}
      </figure>`
      )
      .join('');

    const ul = $('[data-list]');
    if (!list.length) {
      ul.innerHTML = `<li class="card-list__empty">Sua folha ainda está vazia. Monte um botton, marcador ou cartão e toque em <strong>Colocar na folha</strong>. Numa folha A4 cabem 25 bottons de 32 mm, 13 de 44 mm ou 8 de 58 mm, e dá para misturar com marcadores, cartões e adesivos.</li>`;
    } else {
      ul.innerHTML = list
        .map((c, i) => {
          if (isSticker(c)) {
            const dims = stickerDims(c);
            const cm = fmt(Math.round(Math.max(dims.w, dims.h)) / 10);
            return `
        <li class="card-item card-item--sticker">
          <span class="card-item__thumb">${listThumb(c)}</span>
          <div class="card-item__copies">
            <span class="card-item__label" id="sz-${c.id}">Adesivo · tamanho</span>
            <div class="stepper" role="group" aria-labelledby="sz-${c.id}">
              <button type="button" class="round-btn" data-stsize="-5" data-id="${c.id}" aria-label="Menor" ${c.sticker.sizeMm <= 20 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
              <output>${cm} cm</output>
              <button type="button" class="round-btn" data-stsize="5" data-id="${c.id}" aria-label="Maior" ${c.sticker.sizeMm >= 150 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
            </div>
            <span class="card-item__label" id="cp-${c.id}">Quantos</span>
            <div class="stepper" role="group" aria-labelledby="cp-${c.id}">
              <button type="button" class="round-btn" data-copies="-1" data-id="${c.id}" aria-label="Um a menos" ${c.copies <= 1 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
              <output>${c.copies}</output>
              <button type="button" class="round-btn" data-copies="1" data-id="${c.id}" aria-label="Um a mais" ${c.copies >= 99 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
            </div>
          </div>
          <div class="card-item__actions">
            <button type="button" class="round-btn round-btn--danger" data-del="${c.id}" aria-label="Tirar adesivo da folha">${icon('trash', { size: 20 })}</button>
          </div>
        </li>`;
          }
          const f = formatInfo(c.design.format);
          return `
        <li class="card-item${c.id === editingId ? ' is-editing' : ''}">
          <button type="button" class="card-item__thumb" data-edit="${c.id}" aria-label="Editar ${f.short.toLowerCase()} ${i + 1}" title="Editar">${listThumb(c)}<span class="card-item__pen">${icon('edit', { size: 14 })}</span></button>
          <div class="card-item__copies">
            <span class="card-item__label" id="cp-${c.id}">${f.id === 'card' ? 'Cópias' : f.short}${hasBack(c) ? ' <span class="tag">com verso</span>' : ''}</span>
            <div class="stepper" role="group" aria-labelledby="cp-${c.id}">
              <button type="button" class="round-btn" data-copies="-1" data-id="${c.id}" aria-label="Uma cópia a menos" ${c.copies <= 1 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
              <output>${c.copies}</output>
              <button type="button" class="round-btn" data-copies="1" data-id="${c.id}" aria-label="Uma cópia a mais" ${c.copies >= 99 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
            </div>
          </div>
          <div class="card-item__actions">
            <button type="button" class="round-btn" data-dup="${c.id}" aria-label="Duplicar ${i + 1}" title="Duplicar">${icon('copy', { size: 20 })}</button>
            <button type="button" class="round-btn round-btn--danger" data-del="${c.id}" aria-label="Tirar da folha ${i + 1}" title="Tirar da folha">${icon('trash', { size: 20 })}</button>
          </div>
        </li>`;
        })
        .join('');
    }
    $('[data-act="print"]').disabled = !list.length;
    $('[data-act="print-jpg"]').disabled = !list.length;
    $('[data-act="print"]').hidden = silMode;
    $('[data-act="print-jpg"]').hidden = silMode;
    $('[data-cutline-row]').hidden = silMode;
    $('[data-act="silhouette-kit"]').hidden = !silMode;
    $('[data-act="silhouette-kit"]').disabled = !list.length;
    $('[data-silhouette]').checked = silMode;
    if (!silMode) $('[data-sil-tip]').hidden = true;
    $('[data-duplex-tip]').hidden = !list.some(hasBack);
    $('[data-folded-tip]').hidden = !list.some((c) => !isSticker(c) && c.design.format === 'folded');
    if (cloudList) renderCloud();
  }

  // Grava o card do editor: novo (vai para a folha), ou por cima do card que está sendo editado.
  async function storeCurrent() {
    if (bg.active) await finishBg();
    if (draw.active) finishDraw();
    const design = clone(editor.design);
    await ensureFonts(design);
    const thumbBlob = await canvasToBlob(renderThumb(design, 'front', getImg), 'image/png');
    const old = editingId && cards.find((c) => c.id === editingId);
    const record = {
      ...(old ? recordOf(old) : {}),
      v: 2,
      id: old ? old.id : newId(),
      createdAt: old ? old.createdAt : Date.now(),
      copies: old ? old.copies : 1,
      inSheet: old ? onSheet(old) : true,
      design,
      images: blobsFor(design),
      thumbBlob,
    };
    await db.putCard(record);
    await loadCards();
    queueCard(record.id).catch(() => {});
    return record;
  }

  async function saveCard() {
    if (isEmpty(editor.design) || busy) return;
    const btn = $('[data-act="save"]');
    btn.disabled = true;
    busy = true;
    try {
      const fromRect = editor.cardScreenRect();
      const wasEditing = editingId;
      const record = await storeCurrent();
      resetEditor();
      renderSheet();
      flyToSheet(record.id, fromRect);
      toast(wasEditing ? 'Salvo!' : 'Colocado na folha!', {
        action: window.innerWidth < 1000 && onSheet(record) ? 'Ver folha' : undefined,
        onAction: () => $('[data-sheet]').scrollIntoView({ behavior: 'smooth', block: 'start' }),
      });
    } catch (err) {
      console.error(err);
      toast('Não consegui salvar. Tente de novo.', { kind: 'error' });
    } finally {
      busy = false;
      syncChrome();
    }
  }

  // O card "voa" do editor até o lugar dele na folha.
  function flyToSheet(id, from) {
    const target = root.querySelector(`.slot[data-edit="${id}"]`);
    if (!target) return;
    target.classList.add('is-new');
    setTimeout(() => target.classList.remove('is-new'), 900);
    if (reduceMotion()) return;
    const card = cards.find((c) => c.id === id);
    let to = target.getBoundingClientRect();
    const f = formatInfo(card.design.format);
    if (f.id === 'folded') to = { left: to.left + to.width / 2, top: to.top, width: to.width / 2, height: to.height };
    const ghost = document.createElement('img');
    ghost.src = card.thumbUrl;
    ghost.className = 'fly-ghost';
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(ghost);
    const land = f.rotate && card.design.orientation === 'landscape';
    const sx = (land ? to.height : to.width) / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const endRot = land ? 90 : 0;
    ghost
      .animate(
        [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${(1 + sx) / 2}) rotate(${endRot / 2 - 8}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(${endRot}deg)`, opacity: 0.9 },
        ],
        { duration: 720, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
      .finished.then(() => ghost.remove(), () => ghost.remove());
  }

  async function editCard(id) {
    if (busy) return;
    if (!cards.some((c) => c.id === id && !isSticker(c))) return;
    if (id === editingId) {
      if (window.innerWidth < 1000) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    busy = true;
    try {
      // Antes de abrir outro card, guarda o que estava sendo feito (para não perder nada).
      if (hasUnsaved()) {
        const wasEditing = editingId;
        try {
          await storeCurrent();
        } catch (err) {
          console.error(err);
          toast('Não consegui salvar o que estava aberto, então ele continua aqui.', { kind: 'error' });
          return;
        }
        toast(wasEditing ? 'Salvei as mudanças do anterior.' : 'O que você estava fazendo foi para a folha.');
      }
      const card = cards.find((c) => c.id === id);
      if (!card) return;
      cancelBg();
      if (draw.active) finishDraw();
      releaseAll();
      await loadImages(card.images);
      editingId = id;
      editor.load(card.design);
      history.reset(editor.snapshot());
      tab = 'foto';
      syncChrome();
      renderPanel(true);
      renderSheet();
      saveDraftSoon();
      if (window.innerWidth < 1000) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {
      toast('Não consegui abrir esse card.', { kind: 'error' });
    } finally {
      busy = false;
    }
  }

  async function changeCopies(id, delta) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    card.copies = Math.max(1, Math.min(99, card.copies + delta));
    await db.putCard(recordOf(card));
    renderSheet();
  }

  async function changeStickerSize(id, delta) {
    const card = cards.find((c) => c.id === id);
    if (!card || !isSticker(card)) return;
    card.sticker = { ...card.sticker, sizeMm: Math.max(20, Math.min(150, card.sticker.sizeMm + delta)) };
    await db.putCard(recordOf(card));
    renderSheet();
  }

  // Lixeira da folha: o card sai da folha, mas continua guardado no fichário.
  // Adesivo para imprimir sai de vez (o desenho continua em Meus adesivos).
  async function deleteCard(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const rec = recordOf(card);
    if (isSticker(card)) await db.deleteCard(id);
    else await db.putCard({ ...rec, inSheet: false });
    await loadCards();
    renderSheet();
    toast(isSticker(card) ? 'Adesivo tirado da folha.' : 'Tirei da folha. Ele continua guardado no fichário.', {
      action: 'Desfazer',
      duration: 6000,
      onAction: async () => {
        await db.putCard(rec);
        await loadCards();
        renderSheet();
      },
    });
  }

  async function duplicateCard(id) {
    const card = cards.find((c) => c.id === id);
    if (!card || isSticker(card)) return;
    const copy = await duplicateRecord(card);
    await loadCards();
    renderSheet();
    toast('Cópia feita! Abra para trocar a foto.', { action: 'Abrir', duration: 6000, onAction: () => editCard(copy.id) });
  }

  // ---------- série ----------
  // Um card igual ao do editor para cada foto escolhida, com numeração se quiser.
  function openSeries() {
    if (draw.active) finishDraw();
    if (bg.active) return;
    const f = formatInfo(editor.design.format);
    const where = { v: 'front' };
    const texts = editor.design.front.layers.filter((l) => l.type === 'text');
    const biggest = texts.reduce((a, l) => (!a || l.size > a.size ? l : a), null);
    const target = { id: biggest ? biggest.id : '' };
    const short = (t) => (t.length > 18 ? t.slice(0, 17) + '…' : t);
    openModal({
      title: 'Fazer uma série',
      html: `
        <div class="seg seg--sm" role="group" aria-label="Série com" data-series-mode>
          <button type="button" class="seg__btn" data-mode="names" aria-pressed="true">${icon('text', { size: 18 })}Com nomes</button>
          <button type="button" class="seg__btn" data-mode="photos" aria-pressed="false">${icon('photo', { size: 18 })}Com fotos</button>
        </div>

        <div data-pane="names">
          <p class="modal__text">Um ${f.short.toLowerCase()} igual a este para cada nome da lista (um por linha). Ótimo para lembrancinha de festa e turma de escola.</p>
          <label class="field">
            <span class="field__label">Nomes (um por linha)</span>
            <textarea class="field__input field__input--area" rows="7" data-series-names placeholder="Ana&#10;Bia&#10;Carla"></textarea>
          </label>
          ${
            texts.length > 1
              ? `<div class="field"><span class="field__label">Qual texto troca pelo nome?</span><div class="chips">${texts
                  .map((t) => `<button type="button" class="font-chip font-chip--sm" data-target="${t.id}" aria-pressed="${t.id === target.id}"></button>`)
                  .join('')}</div></div>`
              : texts.length
                ? ''
                : '<p class="hint">Este design ainda não tem texto: o nome entra no meio, com a letra Pacifico.</p>'
          }
          <button type="button" class="btn btn--primary btn--wide" data-series-go>${icon('stack', { size: 22 })}<span data-series-go-label>Fazer</span></button>
        </div>

        <div data-pane="photos" hidden>
          <p class="modal__text">Escolha várias fotos de uma vez: cada uma vira um ${f.short.toLowerCase()} igual a este (mesmo fundo, moldura, textos e adesivos), só trocando a foto. Todos vão para a folha.</p>
          <label class="check">
            <input type="checkbox" data-series-num checked>
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Numerar, como coleção (01/09, 02/09…)
          </label>
          ${
            f.noBack
              ? ''
              : `<div class="seg seg--sm" role="group" aria-label="Onde vai o número" data-series-where>
            <button type="button" class="seg__btn" data-where="front" aria-pressed="true">Na ${f.sides[0].toLowerCase()}</button>
            <button type="button" class="seg__btn" data-where="back" aria-pressed="false">No ${f.sides[1].toLowerCase()}</button>
          </div>`
          }
          <button type="button" class="btn btn--primary btn--wide" data-series-pick>${icon('photo', { size: 22 })}Escolher as fotos</button>
          <input type="file" accept="image/*" multiple hidden data-series-file>
        </div>
        <p class="modal__status" data-series-status role="status"></p>`,
      onMount(body, close) {
        const file = body.querySelector('[data-series-file]');
        const status = body.querySelector('[data-series-status]');
        const area = body.querySelector('[data-series-names]');
        // o texto dos botões vem daqui (assim não precisa escapar nada)
        body.querySelectorAll('[data-target]').forEach((b) => (b.textContent = short(texts.find((t) => t.id === b.dataset.target).text.replace(/\n/g, ' '))));
        const names = () =>
          area.value
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 200);
        const syncGo = () => {
          const n = names().length;
          body.querySelector('[data-series-go-label]').textContent = n ? `Fazer ${n} ${n === 1 ? 'peça' : 'peças'}` : 'Escreva os nomes';
          body.querySelector('[data-series-go]').disabled = !n;
        };
        area.addEventListener('input', syncGo);
        syncGo();
        body.addEventListener('click', async (e) => {
          const b = e.target.closest('button');
          if (!b || b.disabled) return;
          if (b.dataset.mode) {
            body.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            body.querySelectorAll('[data-pane]').forEach((x) => (x.hidden = x.dataset.pane !== b.dataset.mode));
            return;
          }
          if (b.dataset.target) {
            target.id = b.dataset.target;
            body.querySelectorAll('[data-target]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            return;
          }
          if (b.dataset.where) {
            where.v = b.dataset.where;
            body.querySelectorAll('[data-where]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          }
          if (b.hasAttribute('data-series-pick')) file.click();
          if (b.hasAttribute('data-series-go')) {
            const list = names();
            if (!list.length) return;
            body.querySelectorAll('button, input, textarea').forEach((x) => (x.disabled = true));
            try {
              const n = await makeNameSeries(list, target.id, (i) => (status.textContent = `Fazendo ${i} de ${list.length}…`));
              close();
              toast(`${n} ${n === 1 ? 'peça feita' : 'peças feitas'} e colocadas na folha!`);
            } catch (err) {
              console.error(err);
              status.textContent = 'Não consegui fazer a série. Tente de novo.';
              body.querySelectorAll('button, input, textarea').forEach((x) => (x.disabled = false));
            }
          }
        });
        file.addEventListener('change', async () => {
          const files = [...(file.files || [])].filter((x) => x.type.startsWith('image/')).slice(0, 40);
          file.value = '';
          if (!files.length) return;
          body.querySelectorAll('button, input').forEach((x) => (x.disabled = true));
          try {
            const n = await makeSeries(files, { number: body.querySelector('[data-series-num]').checked, where: where.v }, (i) => {
              status.textContent = `Fazendo ${i} de ${files.length}…`;
            });
            close();
            toast(`${n} ${n === 1 ? 'card feito' : 'cards feitos'} e colocados na folha!`);
          } catch (err) {
            console.error(err);
            status.textContent = 'Não consegui fazer a série. Tente com menos fotos.';
            body.querySelectorAll('button, input').forEach((x) => (x.disabled = false));
          }
        });
      },
    });
  }

  // Série com nomes: uma peça igual à atual para cada nome, trocando um texto da frente.
  async function makeNameSeries(names, targetId, onStep) {
    const base = clone(editor.design);
    const { w } = cardSize(base);
    const f = formatInfo(base.format);
    const baseBlobs = blobsFor(base);
    const imgs = {};
    for (const k of imageKeys(base)) if (baseBlobs[k]) imgs[k] = baseBlobs[k];
    let made = 0;
    for (let i = 0; i < names.length; i++) {
      onStep && onStep(i + 1);
      const d = clone(base);
      let t = d.front.layers.find((l) => l.id === targetId);
      if (!t) {
        t = newTextLayer({ font: 'pacifico', size: (f.face || w) * 0.18, color: '#b4532f', stroke: { color: '#ffffff', width: 5 } });
        d.front.layers.push(t);
      }
      // nomes compridos diminuem um pouco para não passar da borda
      const longer = names[i].length / Math.max(1, String(t.text || '').replace(/\n/g, '').length);
      if (longer > 1.25) t.size = t.size / Math.min(1.8, Math.sqrt(longer));
      t.text = names[i];
      await ensureFonts(d);
      const thumbBlob = await thumbBlobFor(d, getImg);
      await putRecord({ v: 2, id: newId(), createdAt: Date.now() + i, copies: 1, inSheet: true, design: d, images: { ...imgs }, thumbBlob });
      made++;
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
    }
    await loadCards();
    renderSheet();
    return made;
  }

  async function makeSeries(files, { number, where }, onStep) {
    const base = clone(editor.design);
    const u = editor.unit();
    const { w, h } = cardSize(base);
    for (const sd of [base.front, base.back]) sd.layers = sd.layers.filter((l) => !l.serial);
    if (!cellRects(base.front, base).length) base.front.layout = '1';
    const baseBlobs = blobsFor(base);
    await ensureFonts(base);
    const n = files.length;
    const digits = Math.max(2, String(n).length);
    let made = 0;
    const createdIds = [];
    for (let i = 0; i < n; i++) {
      onStep && onStep(i + 1);
      let photo;
      try {
        photo = await importImageFile(files[i]);
      } catch (_) {
        continue;
      }
      const key = newId();
      const d = clone(base);
      const rect = cellFor(d.front, d, 0);
      const old = d.front.layers.find((l) => l.type === 'photo' && l.cell === 0);
      const scale = coverScale(photo.img.naturalWidth, photo.img.naturalHeight, rect.w, rect.h, 0);
      if (old) Object.assign(old, { imageKey: key, originalKey: null, bgOps: null, x: 0, y: 0, rotation: 0, flip: false, scale });
      else {
        let at = 0;
        d.front.layers.forEach((l, j) => {
          if (l.type === 'photo') at = j + 1;
        });
        d.front.layers.splice(at, 0, newPhotoLayer(key, 0, photo.img, rect));
      }
      if (number) {
        d[where].layers.push(
          newTextLayer({
            serial: true,
            text: `${String(made + 1).padStart(digits, '0')}/${String(n).padStart(digits, '0')}`,
            font: 'bungee',
            size: 3.4 * u,
            color: '#ffffff',
            stroke: { color: '#b4532f', width: 5 },
            x: w / 2 - 8.5 * u,
            y: h / 2 - 5.5 * u,
          })
        );
      }
      const all = { ...baseBlobs, [key]: photo.blob };
      const imgs = {};
      for (const k of imageKeys(d)) if (all[k]) imgs[k] = all[k];
      const getter = (k) => (k === key ? photo.img : getImg(k));
      const thumbBlob = await thumbBlobFor(d, getter);
      releaseImage(photo.img);
      const rec = await putRecord({ v: 2, id: newId(), createdAt: Date.now() + i, copies: 1, inSheet: true, design: d, images: imgs, thumbBlob });
      createdIds.push(rec.id);
      made++;
    }
    // Alguma foto não abriu: a numeração passa a contar só as que entraram ("01/08" em vez de "01/09").
    if (number && made && made < n) {
      for (let j = 0; j < createdIds.length; j++) {
        const rec = migrateRecord(await db.getCard(createdIds[j]));
        const t = rec.design[where].layers.find((l) => l.serial);
        if (t) t.text = `${String(j + 1).padStart(digits, '0')}/${String(made).padStart(digits, '0')}`;
        if (where === 'front') {
          const m = new Map();
          for (const [k, b] of Object.entries(rec.images)) m.set(k, await blobToImage(b));
          rec.thumbBlob = await thumbBlobFor(rec.design, (k) => m.get(k) || null);
          m.forEach(releaseImage);
        }
        await putRecord(rec);
      }
    }
    await loadCards();
    renderSheet();
    return made;
  }

  // ---------- nuvem ----------
  const CLOUD_STATUS = {
    idle: 'Tudo guardado',
    syncing: 'Guardando…',
    offline: 'Sem internet: guardo depois',
    error: 'Não deu para guardar agora',
    off: '',
  };
  let cloudList = null; // null = ainda não carregou
  let cloudLoading = false;

  const stopCloud = onCloudChange(({ state, pending, uploaded }) => {
    const el = $('[data-cloud-status]');
    if (!el) return;
    el.textContent = state === 'syncing' && pending > 1 ? `Guardando ${pending} cards…` : CLOUD_STATUS[state] || '';
    el.dataset.state = state;
    if (uploaded && $('[data-cloud]').open) loadCloud();
  });

  async function loadCloud() {
    if (cloudLoading) return;
    cloudLoading = true;
    const ul = $('[data-cloud-list]');
    if (cloudList === null) ul.innerHTML = '<li class="cloud__empty">Abrindo a nuvem…</li>';
    try {
      cloudList = await listCloud();
      if (alive) renderCloud();
    } catch (err) {
      console.warn(err);
      if (alive && cloudList === null) ul.innerHTML = '<li class="cloud__empty">Não consegui abrir a nuvem agora. Confira a internet e tente de novo.</li>';
    } finally {
      cloudLoading = false;
    }
  }

  function renderCloud() {
    const ul = $('[data-cloud-list]');
    if (!cloudList || !cloudList.length) {
      ul.innerHTML = '<li class="cloud__empty">Nenhum card na nuvem ainda. Quando você colocar um card na folha, ele também vem para cá.</li>';
      return;
    }
    ul.innerHTML = cloudList
      .map((c) => {
        const local = cards.find((x) => x.id === c.id);
        const here = !!local;
        const img = c.thumbUrl ? `<img class="${c.orientation === 'landscape' ? 'is-landscape' : ''}" src="${c.thumbUrl}" alt="" loading="lazy" draggable="false">` : '';
        return `<li><button type="button" class="cloud__card" data-cloud-open="${c.id}" aria-label="${here ? 'Abrir este card' : 'Trazer este card de volta para a folha'}, ${daysText(c.daysLeft)}">
          <span class="cloud__thumb">${img}</span>
          <span class="cloud__days">${daysText(c.daysLeft)}</span>
          ${here ? `<span class="tag">${onSheet(local) ? 'na folha' : 'no fichário'}</span>` : ''}
        </button></li>`;
      })
      .join('');
  }

  async function openCloudCard(id, btn) {
    if (busy) return;
    if (cards.some((c) => c.id === id)) return editCard(id);
    const img = btn.querySelector('img');
    const from = (img || btn).getBoundingClientRect();
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const rec = await fetchCloudCard(id);
      await db.putCard(rec);
      await loadCards();
      renderSheet();
      renderCloud();
      if (from.width) flyToSheet(rec.id, from);
      toast('Card de volta na folha!');
    } catch (err) {
      console.warn(err);
      toast('Não consegui trazer esse card da nuvem. Tente de novo.', { kind: 'error' });
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  }

  $('[data-cloud]').addEventListener('toggle', (e) => {
    if (e.target.open) loadCloud();
  });

  // ---------- impressão ----------
  function invalidatePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = null;
    pdfFile = null;
    const ready = $('[data-ready]');
    if (ready) ready.hidden = true;
  }

  async function preparePdf() {
    const list = sheetRecords();
    if (!list.length) return;
    const btn = $('[data-act="print"]');
    const label = $('[data-print-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    label.textContent = 'Montando a folha…';
    const loaded = [];
    try {
      const withImages = await Promise.all(
        list.map(async (c) => {
          const m = new Map();
          for (const [k, b] of Object.entries(c.images || {})) m.set(k, await blobToImage(b));
          loaded.push(m);
          return { ...c, getImg: (k) => m.get(k) || null };
        })
      );
      const doc = await buildPdf(withImages, {
        cutLine: $('[data-cutline]').checked,
        onProgress: (p) => (label.textContent = `Montando a folha… ${Math.round(p * 100)}%`),
      });
      if (!alive) return;
      const blob = doc.output('blob');
      invalidatePdf();
      pdfUrl = URL.createObjectURL(blob);
      pdfFile = new File([blob], 'folha-elane.pdf', { type: 'application/pdf' });
      $('[data-open]').href = pdfUrl;
      $('[data-download]').href = pdfUrl;
      const canShare = navigator.canShare && navigator.canShare({ files: [pdfFile] });
      $('[data-act="share"]').hidden = !canShare;
      $('[data-ready]').hidden = false;
      $('[data-ready]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não consegui montar a folha. Tente de novo.', { kind: 'error' });
    } finally {
      loaded.forEach((m) => m.forEach((img) => releaseImage(img)));
      btn.classList.remove('is-busy');
      btn.disabled = !sheetRecords().length;
      label.textContent = 'Preparar folha para imprimir';
    }
  }

  // A mesma folha em JPG (uma imagem por página, 300 dpi), para salvar em Fotos ou mandar para alguém.
  async function saveSheetJpg() {
    const list = sheetRecords();
    if (!list.length) return;
    const btn = $('[data-act="print-jpg"]');
    const label = $('[data-jpg-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    label.textContent = 'Montando a imagem…';
    const loaded = [];
    try {
      const withImages = await Promise.all(
        list.map(async (c) => {
          const m = new Map();
          for (const [k, b] of Object.entries(c.images || {})) m.set(k, await blobToImage(b));
          loaded.push(m);
          return { ...c, getImg: (k) => m.get(k) || null };
        })
      );
      const files = await buildSheetImages(withImages, {
        cutLine: $('[data-cutline]').checked,
        onProgress: (p) => (label.textContent = `Montando a imagem… ${Math.round(p * 100)}%`),
      });
      if (!alive) return;
      const r = await shareOrDownload(files, 'Folha da Elane');
      if (r === 'downloaded') toast(files.length > 1 ? `${files.length} imagens salvas (uma por página)!` : 'Imagem da folha salva!');
    } catch (err) {
      console.error(err);
      toast('Não consegui montar a imagem da folha. Tente de novo.', { kind: 'error' });
    } finally {
      loaded.forEach((m) => m.forEach((img) => releaseImage(img)));
      btn.classList.remove('is-busy');
      btn.disabled = !sheetRecords().length;
      label.textContent = 'Salvar folha como imagem (JPG)';
    }
  }

  // Kit Silhouette: arte em PNG e SVG com as linhas de corte, e o DXF para o Studio Basic.
  async function makeSilhouetteKit() {
    const list = sheetRecords();
    if (!list.length) return;
    const btn = $('[data-act="silhouette-kit"]');
    const label = $('[data-kit-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    label.textContent = 'Montando o kit…';
    const loaded = [];
    try {
      const withImages = await Promise.all(
        list.map(async (c) => {
          const m = new Map();
          for (const [k, b] of Object.entries(c.images || {})) m.set(k, await blobToImage(b));
          loaded.push(m);
          return { ...c, getImg: (k) => m.get(k) || null };
        })
      );
      const kit = await buildSilhouetteKit(withImages, {
        onProgress: (p) => (label.textContent = `Montando o kit… ${Math.round(p * 100)}%`),
      });
      if (!alive) return;
      const files = kit.flatMap((k) => k.files);
      const tip = $('[data-sil-tip]');
      const mm = (v) => fmt(Math.round(v * 10) / 10);
      const where = kit
        .map((k, i) => (k.box ? `<li>${kit.length > 1 ? `Folha ${i + 1}: ` : ''}linhas de corte em <strong>X ${mm(k.box.x)} mm</strong> e <strong>Y ${mm(k.box.y)} mm</strong> (${k.count} ${k.count === 1 ? 'corte' : 'cortes'})</li>` : `<li>Folha ${i + 1}: sem linhas de corte (adesivos: use “Traçar” no Studio)</li>`))
        .join('');
      tip.innerHTML = `
        <p class="sil-tip__title">${icon('scissors', { size: 18 })} Como cortar na Silhouette</p>
        <ol>
          <li>No Silhouette Studio, em <strong>Configurar página</strong>, escolha <strong>A4</strong> e ligue as <strong>marcas de registro</strong> (deixe no padrão, “Restaurar padrões”).</li>
          <li><strong>Designer ou superior:</strong> abra o arquivo <strong>.svg</strong>. A arte e os cortes já vêm juntos; confira se a imagem está em X 0, Y 0, com 210 × 297 mm.</li>
          <li><strong>Studio Basic:</strong> abra o <strong>-arte.png</strong> e ponha em X 0, Y 0, com 210 × 297 mm. Depois use <strong>Arquivo › Mesclar</strong> com o <strong>-corte.dxf</strong>, agrupe as linhas e ponha em:<ul>${where}</ul></li>
          <li>Confira um botton: o círculo do de 44 mm tem que medir 54 mm. Nada pode encostar na área riscada das marcas (a arte já deixa ${fmt(MARGIN_CM)} cm livres).</li>
          <li>Imprima pelo próprio Studio, ponha a folha na Cameo e corte. Linhas que não forem cortar: marque como “sem corte”.</li>
        </ol>`;
      tip.hidden = false;
      const r = await shareOrDownload(files, 'Kit Silhouette');
      if (r === 'downloaded') toast(`Kit salvo: ${files.length} arquivos.`);
      tip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      toast('Não consegui montar o kit da Silhouette. Tente de novo.', { kind: 'error' });
    } finally {
      loaded.forEach((m) => m.forEach((img) => releaseImage(img)));
      btn.classList.remove('is-busy');
      btn.disabled = !sheetRecords().length;
      label.textContent = 'Fazer kit para a Silhouette';
    }
  }

  async function sharePdf() {
    if (!pdfFile) return;
    try {
      await navigator.share({ files: [pdfFile], title: 'Folha da Elane' });
    } catch (_) {}
  }

  // ---------- cliques ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t || !root.contains(t) || t.disabled) return;
    const ds = t.dataset;
    if (draw.active && (ds.tab || ds.side || ds.format || ds.orient || ds.template || ds.layout || ds.frame || ds.edit || ds.layerSelect)) finishDraw();
    const L = selected();
    const act = ds.act;

    if (act) {
      switch (act) {
        case 'loose-photo':
          return pickPhoto(null, false, true);
        case 'to-sticker':
          return toSticker();
        case 'save-cutout':
          return saveCutout();
        case 'add-calendar':
          return addCalendar();
        case 'cal-prev':
        case 'cal-next':
          if (L && L.kind === 'calendar') {
            editor.change(() => {
              const now = new Date();
              let m = (L.month == null ? now.getMonth() : L.month) + (act === 'cal-next' ? 1 : -1);
              let y = L.year || now.getFullYear();
              if (m < 0) {
                m = 11;
                y--;
              }
              if (m > 11) {
                m = 0;
                y++;
              }
              L.month = m;
              L.year = y;
            }, { commit: true });
          }
          return;
        case 'draw-start':
          return startDraw();
        case 'draw-done':
          return finishDraw();
        case 'save-image':
          return saveImage();
        case 'series':
          return openSeries();
        case 'share-group':
          return shareToGroup();
        case 'pick':
          if (isBgPhoto(L)) return pickPhoto(null, true);
          return pickPhoto(L && L.type === 'photo' ? L.cell : null);
        case 'bgphoto-pick':
          return pickPhoto(null, true);
        case 'bgphoto-paste':
          return pasteFromClipboard(true);
        case 'bgphoto-edit': {
          const bp = side().layers.find(isBgPhoto);
          return bp && editor.select(bp.id);
        }
        case 'bgphoto-done':
          return editor.select(null);
        case 'bgphoto-remove': {
          const bp = side().layers.find(isBgPhoto);
          return bp && deleteLayer(bp.id);
        }
        case 'bg-front': {
          const fp = side().layers.find((l) => l.type === 'photo' && !isBgPhoto(l));
          if (!fp) return;
          editor.select(fp.id);
          return enterBg();
        }
        case 'paste':
          return pasteFromClipboard();
        case 'undo':
          return undo();
        case 'redo':
          return redo();
        case 'rotate90':
          if (L) {
            editor.setRotation(L, L.rotation + 90);
            editor.commitNow();
          }
          return;
        case 'flip':
          if (L) editor.change(() => (L.flip = !L.flip), { commit: true });
          return;
        case 'fit':
          if (L && L.type === 'photo') editor.fitPhoto(L);
          return;
        case 'bg':
          return enterBg();
        case 'bg-done':
          return finishBg();
        case 'bg-undo':
          bg.ops.pop();
          return runBg();
        case 'bg-reset':
          bg.ops = [];
          return runBg();
        case 'bg-auto':
          bg.ops.unshift({ kind: 'edges' });
          return runBg();
        case 'fx-reset':
          if (L && L.type === 'photo') editor.change(() => (L.fx = { ...L.fx, filter: 'normal', brightness: 0, contrast: 0, saturation: 0 }), { commit: true });
          return;
        case 'add-text':
          return addText();
        case 'layer-up':
          return L && moveLayer(L.id, 1);
        case 'layer-down':
          return L && moveLayer(L.id, -1);
        case 'dup':
          return duplicate();
        case 'del':
          return L && deleteLayer(L.id);
        case 'save':
          return saveCard();
        case 'new':
          return startNew();
        case 'print':
          return preparePdf();
        case 'print-jpg':
          return saveSheetJpg();
        case 'silhouette-kit':
          return makeSilhouetteKit();
        case 'share':
          return sharePdf();
      }
      return;
    }

    if (ds.tab) return setTab(ds.tab);
    if (ds.format) return setFormat(ds.format);
    if (ds.pack) {
      stickerPack = ds.pack;
      return renderPanel(true);
    }
    if (ds.addMine) return addMine(ds.addMine);
    if (ds.imgFrame && L) return editor.change(() => (L.frame = ds.imgFrame), { commit: true });
    if (ds.pen) {
      draw.pen = ds.pen;
      editor.setPen({ pen: ds.pen });
      return renderPanel(true);
    }
    if (ds.penSize) {
      draw.size = ds.penSize;
      editor.setPen({ w: penWidth() });
      return renderPanel(true);
    }
    if (ds.dup) return duplicateCard(ds.dup);
    if (ds.stsize) return changeStickerSize(ds.id, +ds.stsize);
    if (ds.orient) return editor.setOrientation(ds.orient);
    if (ds.side) {
      editor.setSide(ds.side);
      tab = ds.side === 'back' && !side().layers.length ? 'modelos' : tab;
      syncChrome();
      renderPanel(true);
      return;
    }
    if (ds.colorProp != null && 'color' in ds) return setColor(ds.colorProp, ds.color || null, true);
    if (ds.font && L) return editor.change(() => (L.font = ds.font), { commit: true });
    if (ds.align && L) return editor.change(() => (L.align = ds.align), { commit: true });
    if (ds.filter && L) return editor.change(() => (L.fx = { ...L.fx, filter: ds.filter }), { commit: true });
    if (ds.addSticker) return addSticker({ kind: 'shape', name: ds.addSticker, color: stickerInfo(ds.addSticker).color });
    if (ds.addEmoji) return addSticker({ kind: 'emoji', name: ds.addEmoji, color: null });
    if (ds.gradient) {
      const g = GRADIENTS.find((x) => x.id === ds.gradient);
      return editor.change((d, s) => (s.bg = { kind: 'gradient', id: g.id, stops: g.stops.slice(), angle: g.angle }), { commit: true });
    }
    if (ds.pattern) {
      return editor.change((d, s) => {
        const base = bgBaseColor(s.bg);
        s.bg = ds.pattern === 'none' ? { kind: 'solid', color: base } : { kind: 'pattern', pattern: ds.pattern, color: base };
      }, { commit: true });
    }
    if (ds.frame) return setFrame(ds.frame);
    if (ds.layout) return setLayout(ds.layout);
    if (ds.template) return applyTemplate(ds.template);
    if (ds.applyTheme) {
      const th = themes.find((x) => x.id === ds.applyTheme);
      if (th) {
        editor.change((d) => applyTheme(d, th), { commit: true });
        toast(`Tema “${th.name}” aplicado. Não gostou? É só desfazer.`, { action: 'Desfazer', onAction: undo });
      }
      return;
    }
    if (ds.layerSelect) return editor.select(ds.layerSelect);
    if (ds.layerMove) return moveLayer(ds.id, +ds.layerMove);
    if (ds.layerDel) return deleteLayer(ds.layerDel);
    if (ds.edit) return editCard(ds.edit);
    if (ds.cloudOpen) return openCloudCard(ds.cloudOpen, t);
    if (ds.del) return deleteCard(ds.del);
    if (ds.copies) return changeCopies(ds.id, +ds.copies);
  });

  // ---------- campos dos painéis ----------
  root.addEventListener('input', (e) => {
    const t = e.target;
    const L = selected();
    if (t.matches('[data-photo="zoom"]') && L) return editor.setZoom(L, sliderToZoom(+t.value));
    if (t.matches('[data-photo="rot"]') && L) {
      editor.setRotation(L, +t.value);
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = `${Math.round(L.rotation)}°`;
      return;
    }
    if (t.matches('[data-tol]')) {
      bg.tolerance = +t.value;
      syncBgPanel();
      clearTimeout(bg.timer);
      bg.timer = setTimeout(() => runBg(), 90);
      return;
    }
    if (t.matches('[data-color-input]')) return setColor(t.dataset.colorInput, t.value, false);
    if (t.matches('[data-prop]') && L && t.type !== 'checkbox') {
      const div = +(t.dataset.div || 1);
      const v = t.type === 'range' ? +t.value / div : t.value;
      editor.change(() => setPath(L, t.dataset.prop, v));
      if (t.tagName === 'TEXTAREA') {
        clearTimeout(textTimer);
        textTimer = setTimeout(() => editor.commitNow(), 700);
      }
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    const L = selected();
    if (t.matches('[data-cutline]')) return invalidatePdf();
    if (t.matches('[data-silhouette]')) {
      silMode = t.checked;
      db.setMeta('silhouette', silMode).catch(() => {});
      return renderSheet();
    }
    if (t.matches('[data-hole]')) return editor.setHole(t.checked);
    if (t.matches('[data-photo]')) return editor.commitNow();
    if (t.matches('[data-color-input]')) return setColor(t.dataset.colorInput, t.value, true);
    if (t.matches('[data-prop]') && L) {
      if (t.type === 'checkbox') {
        editor.change(() => setPath(L, t.dataset.prop, t.checked), { commit: true });
        return;
      }
      clearTimeout(textTimer);
      editor.commitNow();
    }
  });

  // Setas do teclado nas abas.
  $('[data-tabs]').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const all = $$('[data-tab]');
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight') j = (i + 1) % all.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + all.length) % all.length;
    else if (e.key === 'Home') j = 0;
    else j = all.length - 1;
    all[j].focus();
    setTab(all[j].dataset.tab);
    e.preventDefault();
  });

  // ---------- início ----------
  silMode = !!(await db.getMeta('silhouette').catch(() => false));
  themes = await listThemes().catch(() => []);
  try {
    await loadCards();
  } catch (_) {
    toast('Não consegui abrir os cards guardados neste aparelho.', { kind: 'error' });
  }
  renderSheet();
  syncChrome();
  renderPanel(true);
  await restoreDraft();
  renderSheet();
  syncCloud();

  // Meus adesivos (para a aba Adesivos).
  async function loadLibrary() {
    const fresh = stickerUrls(await listStickers());
    revokeUrls(library);
    library = fresh;
    if (alive && tab === 'adesivos') renderPanel();
  }
  const stopLib = onStickersChange(loadLibrary);
  loadLibrary();

  // Vindo de outra tela: "#/photo-cards?f=poster" (começar um pôster) ou "?edit=id" (abrir um card).
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if ([...params.keys()].length) window.history.replaceState(null, '', '#/photo-cards');
  const wantEdit = params.get('edit');
  const wantFormat = params.get('f');
  const wantModel = params.get('model');
  if (wantModel) {
    // "Quero um igual" da turma: abre o modelo da amiga, sem fotos, para pôr as suas.
    const model = await db.getMeta('pendingModel').catch(() => null);
    db.deleteMeta('pendingModel').catch(() => {});
    if (model) {
      if (hasUnsaved()) {
        try {
          await storeCurrent();
          toast('O que você estava fazendo foi para a folha.');
        } catch (_) {}
      }
      resetEditor(model.format);
      try {
        editor.load(model);
        history.reset(editor.snapshot());
        syncChrome();
        renderPanel(true);
        renderSheet();
        saveDraftSoon();
        toast('Modelo da amiga aberto! Toque nos espaços para pôr as suas fotos.', { duration: 6000 });
      } catch (err) {
        console.error(err);
        resetEditor();
        toast('Não consegui abrir esse modelo.', { kind: 'error' });
      }
    }
  } else if (wantEdit) await editCard(wantEdit);
  else if (wantFormat && formatInfo(wantFormat).id === wantFormat && wantFormat !== editor.design.format) {
    if (hasUnsaved()) {
      try {
        await storeCurrent();
        toast('O que você estava fazendo foi para a folha.');
      } catch (_) {}
    }
    resetEditor(wantFormat);
    renderSheet();
  }
  loadFonts().then(() => {
    if (!alive) return;
    editor.redraw();
    if (tab === 'modelos') fillPreviews();
  });

  return () => {
    alive = false;
    stopCloud();
    stopLib();
    revokeUrls(library);
    if (draw.active) finishDraw();
    clearTimeout(draftTimer);
    clearTimeout(textTimer);
    if (bg.active) cancelBg();
    if (bg.remover) bg.remover.destroy();
    if (!isEmpty(editor.design) || editingId) db.setMeta('draft', draftData()).catch(() => {});
    editor.destroy();
    releaseAll();
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
    invalidatePdf();
    cards.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
  };
}

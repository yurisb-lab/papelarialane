// Tela "PDF": as ferramentas de PDF mais usadas do Conversor de Tudo, dentro da Central.
// Extrair páginas, PDF em imagem, imagem em PDF, juntar, dividir, apagar páginas, girar e comprimir.
// Nada sai do aparelho.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { openModal } from '../modal.js';
import { shareOrDownload, canShareFiles } from '../export.js';
import { blobToImage, releaseImage } from '../image.js';
import { saveSticker } from '../library.js';
import * as T from '../pdftools.js';

export const title = 'PDF';

// pick: como as miniaturas funcionam. 'keep' = escolher as que ficam/saem; 'remove' = as que somem;
// 'view' = só ver. accept: pdf | img | both. multi: vários arquivos numa lista com ordem.
const TOOLS = [
  {
    id: 'extrair',
    name: 'Extrair páginas',
    icon: 'copy',
    accept: 'pdf',
    pick: 'keep',
    def: 'none',
    action: 'Extrair páginas',
    desc: 'Escolha as páginas e tire só elas do PDF, num arquivo novo (ou uma por arquivo).',
  },
  {
    id: 'pdf-imagem',
    name: 'PDF em imagem',
    icon: 'photo',
    accept: 'pdf',
    pick: 'keep',
    def: 'all',
    action: 'Transformar em imagem',
    desc: 'Cada página escolhida vira uma imagem PNG ou JPG. Dá para guardar direto em Meus adesivos e usar a arte nos cards.',
  },
  {
    id: 'imagem-pdf',
    name: 'Imagem em PDF',
    icon: 'sheet',
    accept: 'img',
    multi: true,
    action: 'Criar PDF',
    desc: 'Junte fotos e imagens (JPG, PNG, WebP…) num PDF, uma por página.',
  },
  {
    id: 'juntar',
    name: 'Juntar PDFs',
    icon: 'merge',
    accept: 'both',
    multi: true,
    action: 'Juntar',
    desc: 'Una vários PDFs (e imagens) num só arquivo, na ordem que você quiser.',
  },
  {
    id: 'dividir',
    name: 'Dividir PDF',
    icon: 'scissors',
    accept: 'pdf',
    pick: 'view',
    action: 'Dividir',
    desc: 'Quebre o PDF em vários: cada página separada, a cada tantas páginas, ao meio ou por intervalos.',
  },
  {
    id: 'remover',
    name: 'Apagar páginas',
    icon: 'trash',
    accept: 'pdf',
    pick: 'remove',
    def: 'none',
    action: 'Apagar e salvar',
    desc: 'Toque nas páginas que não servem e baixe o PDF sem elas.',
  },
  {
    id: 'girar',
    name: 'Girar páginas',
    icon: 'rotate',
    accept: 'pdf',
    pick: 'keep',
    def: 'all',
    action: 'Girar e salvar',
    desc: 'Gire todas as páginas ou só as que estão de lado.',
  },
  {
    id: 'comprimir',
    name: 'Comprimir',
    icon: 'compress',
    accept: 'pdf',
    action: 'Comprimir',
    desc: 'Deixe o PDF mais leve para mandar por WhatsApp ou e-mail.',
  },
];

const ACCEPT = {
  pdf: 'application/pdf,.pdf',
  img: 'image/*',
  both: 'application/pdf,.pdf,image/*',
};
const DROP = {
  pdf: 'Escolher o PDF',
  img: 'Escolher as imagens',
  both: 'Escolher os PDFs ou imagens',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
let uid = 0;

export async function mount(root) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let tool = TOOLS.find((t) => t.id === params.get('t')) || TOOLS[0];
  let pdf = null; // { file, doc, n, password }
  let list = []; // ferramentas de vários arquivos: { id, file, thumb, info }
  let sels = {}; // páginas escolhidas, por ferramenta
  let lastTap = null;
  let results = []; // { name, blob, note, image, url }
  let busy = false;
  let alive = true;
  let observer = null;
  const opts = {
    separate: false,
    fmt: 'png',
    dpi: '300',
    mode: 'each',
    every: 2,
    ranges: '1-3, 4-6',
    blank: false,
    name: '',
    angle: '90',
    level: 'media',
    gray: false,
    size: 'a4',
    orient: 'auto',
    margin: '0',
    together: true,
  };

  root.innerHTML = `
  <section class="nb pdfv">
    <header class="themes__head">
      <h1 class="themes__title">PDF</h1>
      <p class="themes__lead">Extraia páginas, transforme PDF em imagem (e imagem em PDF), junte, divida, gire e comprima. Tudo acontece aqui no aparelho: nenhum arquivo vai para a internet.</p>
    </header>
    <nav class="tabs pdfv__tabs" role="tablist" aria-label="Ferramentas de PDF">
      ${TOOLS.map((t) => `<button type="button" class="tab" role="tab" data-tool="${t.id}">${icon(t.icon, { size: 24 })}<span>${t.name}</span></button>`).join('')}
    </nav>
    <div class="themes__cols">
      <div class="themes__left">
        <div class="box">
          <div>
            <h2 class="box__title" data-tool-name></h2>
            <p class="hint" data-tool-desc></p>
          </div>
          <label class="pdf-drop" data-drop>
            <input type="file" data-input hidden>
            ${icon('upload', { size: 30 })}
            <span class="pdf-drop__label" data-drop-label></span>
            <span class="pdf-drop__or">ou arraste para cá</span>
          </label>
          <div data-file></div>
        </div>
        <div class="box" data-opts-box>
          <h2 class="box__title">${icon('palette', { size: 22 })} Como fazer</h2>
          <div class="pdf-opts" data-opts></div>
          <button type="button" class="btn btn--primary btn--wide" data-act="run">${icon('sparkle', { size: 22 })}<span data-run-label></span></button>
          <p class="pdf-progress" data-progress hidden><span class="pdf-progress__bar"><i data-bar></i></span><span data-progress-text></span></p>
          <div class="ready" data-ready hidden></div>
        </div>
      </div>
      <div class="themes__right">
        <div class="box" data-pages-box>
          <div class="box__head">
            <h2 class="box__title">${icon('grid', { size: 22 })} <span data-pages-title>Páginas</span></h2>
            <span class="chip" data-count></span>
          </div>
          <div data-pages-tools></div>
          <ul class="pdf-pages" data-pages></ul>
          <p class="pdf-empty" data-pages-empty>Escolha um PDF para ver as páginas aqui.</p>
        </div>
        <div class="box" data-list-box hidden>
          <div class="box__head">
            <h2 class="box__title">${icon('stack', { size: 22 })} Arquivos, na ordem</h2>
            <span class="chip" data-list-count></span>
          </div>
          <ol class="pdf-list" data-list></ol>
          <p class="pdf-empty" data-list-empty>Os arquivos escolhidos aparecem aqui. Use as setas para mudar a ordem.</p>
          <button type="button" class="btn btn--soft btn--sm" data-act="add-more" hidden>${icon('plus', { size: 18 })}Pôr mais arquivos</button>
        </div>
      </div>
    </div>
  </section>`;

  const $ = (s) => root.querySelector(s);
  const input = $('[data-input]');

  /* ---------- seleção de páginas ---------- */
  function sel() {
    if (!sels[tool.id]) {
      sels[tool.id] = new Set(pdf && tool.def === 'all' ? [...Array(pdf.n).keys()] : []);
    }
    return sels[tool.id];
  }
  const selected = () => [...sel()].sort((a, b) => a - b);

  /* ---------- telas ---------- */
  function renderTool() {
    root.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tool === tool.id)));
    $('[data-tool-name]').innerHTML = `${icon(tool.icon, { size: 24 })} ${esc(tool.name)}`;
    $('[data-tool-desc]').textContent = tool.desc;
    $('[data-drop-label]').textContent = tool.multi && list.length ? 'Pôr mais arquivos' : pdf && !tool.multi ? 'Trocar o PDF' : DROP[tool.accept];
    input.accept = ACCEPT[tool.accept];
    input.multiple = !!tool.multi;
    $('[data-run-label]').textContent = tool.action;
    $('[data-pages-box]').hidden = !!tool.multi;
    $('[data-list-box]').hidden = !tool.multi;
    if (tool.multi && !list.length && pdf && tool.accept !== 'img') addToList([pdf.file]);
    renderFile();
    renderOpts();
    renderPages();
    renderList();
    clearResults();
  }

  function renderFile() {
    const box = $('[data-file]');
    if (tool.multi || !pdf) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <div class="pdf-file">
        <span class="pdf-file__ic">${icon('sheet', { size: 26 })}</span>
        <span class="pdf-file__txt"><strong>${esc(pdf.file.name)}</strong><span>${plural(pdf.n, 'página', 'páginas')} · ${T.fmtSize(pdf.file.size)}</span></span>
        <button type="button" class="round-btn" data-act="close-pdf" aria-label="Tirar este PDF">${icon('close', { size: 18 })}</button>
      </div>`;
  }

  function seg(id, choices) {
    return `<div class="seg seg--sm pdf-seg" role="group">${choices
      .map((c) => `<button type="button" class="seg__btn" data-opt="${id}" data-v="${c.v}" aria-pressed="${String(opts[id]) === c.v}">${c.l}</button>`)
      .join('')}</div>`;
  }
  function check(id, label) {
    return `<label class="check"><input type="checkbox" data-check="${id}" ${opts[id] ? 'checked' : ''}><span class="check__box">${icon('check', { size: 16 })}</span>${label}</label>`;
  }
  function field(label, html, hint = '') {
    return `<div class="field"><span class="field__label">${label}</span>${html}${hint ? `<span class="field__hint">${hint}</span>` : ''}</div>`;
  }
  function text(id, ph, extra = '') {
    return `<input class="field__input" type="text" data-text="${id}" value="${esc(opts[id])}" placeholder="${esc(ph)}" ${extra}>`;
  }

  function renderOpts() {
    let h = '';
    if (tool.id === 'extrair') {
      h += check('separate', 'Cada página num PDF separado');
    } else if (tool.id === 'pdf-imagem') {
      h += field('Formato', seg('fmt', [{ v: 'png', l: 'PNG' }, { v: 'jpg', l: 'JPG' }]), 'PNG fica mais nítido; JPG fica mais leve.');
      h += field('Qualidade', seg('dpi', [{ v: '150', l: 'Tela' }, { v: '220', l: 'Boa' }, { v: '300', l: 'Impressão' }]), 'Impressão = 300 dpi, o mesmo das artes da Central.');
    } else if (tool.id === 'dividir') {
      h += field(
        'Como dividir',
        `<select class="field__input" data-select="mode">
          ${[
            ['each', 'Cada página vira um PDF'],
            ['every', 'A cada tantas páginas'],
            ['half', 'Ao meio (duas partes)'],
            ['ranges', 'Por intervalos (um PDF para cada)'],
          ]
            .map(([v, l]) => `<option value="${v}" ${opts.mode === v ? 'selected' : ''}>${l}</option>`)
            .join('')}
        </select>`
      );
      if (opts.mode === 'every') h += field('Páginas em cada arquivo', `<input class="field__input pdf-num" type="number" min="1" step="1" inputmode="numeric" data-text="every" value="${esc(opts.every)}">`);
      if (opts.mode === 'ranges') h += field('Intervalos', text('ranges', 'Ex.: 1-3, 4-6, 7-'), 'Separe com vírgula. “7-” vai da 7 até o fim.');
      h += `<p class="hint" data-split-info></p>`;
    } else if (tool.id === 'juntar') {
      h += field('Nome do arquivo', text('name', 'pdf-junto'));
      h += check('blank', 'Pôr uma página em branco depois de arquivos com número ímpar de páginas (para frente e verso)');
    } else if (tool.id === 'girar') {
      h += field('Girar', seg('angle', [{ v: '90', l: '90° →' }, { v: '180', l: '180°' }, { v: '270', l: '← 90°' }]));
    } else if (tool.id === 'comprimir') {
      h += `<div class="pdf-levels">${T.COMPRESS_LEVELS.map(
        (l) => `<button type="button" class="pdf-level" data-opt="level" data-v="${l.v}" aria-pressed="${opts.level === l.v}"><strong>${l.l}</strong><span>${l.hint}</span></button>`
      ).join('')}</div>`;
      if (opts.level !== 'sem') h += check('gray', 'Deixar em preto e branco (tons de cinza)');
      h += `<p class="hint">Nos níveis Leve, Recomendada e Forte cada página vira imagem: o texto deixa de ser selecionável. Se o arquivo não ficar menor, a Central devolve o original.</p>`;
    } else if (tool.id === 'imagem-pdf') {
      h += field('Tamanho da página', seg('size', [{ v: 'a4', l: 'A4' }, { v: 'a5', l: 'A5' }, { v: 'carta', l: 'Carta' }, { v: 'fit', l: 'Igual à imagem' }]));
      if (opts.size !== 'fit') h += field('Posição', seg('orient', [{ v: 'auto', l: 'Automática' }, { v: 'retrato', l: 'Em pé' }, { v: 'paisagem', l: 'Deitada' }]));
      h += field('Margem', seg('margin', [{ v: '0', l: 'Nenhuma' }, { v: '20', l: 'Pequena' }, { v: '48', l: 'Grande' }]));
      h += check('together', 'Juntar todas as imagens num PDF só');
      if (opts.together) h += field('Nome do arquivo', text('name', 'imagens'));
    }
    $('[data-opts]').innerHTML = h;
    $('[data-opts]').hidden = !h;
    updateRunState();
  }

  function updateRunState() {
    const btn = $('[data-act="run"]');
    let ok = false;
    if (tool.multi) ok = tool.id === 'juntar' ? list.length >= 2 : list.length >= 1;
    else if (pdf) ok = tool.pick === 'keep' || tool.pick === 'remove' ? sel().size > 0 : true;
    btn.disabled = busy || !ok;
    const info = $('[data-split-info]');
    if (info) info.textContent = splitInfo();
  }

  function splitInfo() {
    if (!pdf) return '';
    const n = pdf.n;
    try {
      if (opts.mode === 'each') return `Vão sair ${plural(n, 'arquivo', 'arquivos')}.`;
      if (opts.mode === 'half') return n < 2 ? '' : `Vão sair 2 arquivos: páginas 1 a ${Math.ceil(n / 2)} e ${Math.ceil(n / 2) + 1} a ${n}.`;
      if (opts.mode === 'every') {
        const k = Math.max(1, Math.round(+opts.every || 1));
        return `Vão sair ${plural(Math.ceil(n / k), 'arquivo', 'arquivos')}.`;
      }
      const g = T.parseRanges(opts.ranges, n).groups.length;
      return `Vão sair ${plural(g, 'arquivo', 'arquivos')}.`;
    } catch (e) {
      return e.message;
    }
  }

  function renderPages() {
    if (observer) observer.disconnect();
    observer = null;
    const ul = $('[data-pages]');
    const toolsEl = $('[data-pages-tools]');
    $('[data-pages-empty]').hidden = !!pdf;
    $('[data-pages-title]').textContent = tool.pick === 'remove' ? 'Toque nas páginas para apagar' : tool.pick === 'keep' ? 'Toque para escolher as páginas' : 'Páginas';
    ul.innerHTML = '';
    toolsEl.innerHTML = '';
    if (!pdf || tool.multi) {
      $('[data-count]').textContent = '';
      return;
    }
    ul.dataset.mode = tool.pick || 'none';
    ul.dataset.angle = tool.id === 'girar' ? opts.angle : '0';
    if (tool.pick === 'keep' || tool.pick === 'remove') {
      toolsEl.innerHTML = `
        <div class="pdf-picktools">
          <div class="chips">
            <button type="button" class="font-chip font-chip--sm" data-pick="all">Todas</button>
            <button type="button" class="font-chip font-chip--sm" data-pick="none">Nenhuma</button>
            <button type="button" class="font-chip font-chip--sm" data-pick="odd">Ímpares</button>
            <button type="button" class="font-chip font-chip--sm" data-pick="even">Pares</button>
          </div>
          <label class="field">
            <span class="field__label">Ou escreva as páginas</span>
            <input class="field__input" type="text" data-ranges placeholder="Ex.: 1-3, 5, 8-" inputmode="text" autocomplete="off">
            <span class="field__hint" data-ranges-hint>No computador: segure Shift para escolher várias de uma vez.</span>
          </label>
        </div>`;
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < pdf.n; i++) {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="pdf-page" data-page="${i}" ${tool.pick === 'view' || !tool.pick ? 'tabindex="-1" disabled' : ''}>
        <span class="pdf-page__img"><span class="pdf-page__ph"></span></span>
        <span class="pdf-page__mark" aria-hidden="true">${icon(tool.pick === 'remove' ? 'trash' : 'check', { size: 16 })}</span>
        <span class="pdf-page__n">${i + 1}</span>
      </button>`;
      frag.appendChild(li);
    }
    ul.appendChild(frag);
    paintSelection();
    lazyThumbs();
  }

  const thumbCache = new Map(); // página -> dataURL (do PDF aberto agora)
  function lazyThumbs() {
    const doc = pdf && pdf.doc;
    if (!doc) return;
    const queue = [];
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      while (queue.length && alive && pdf && pdf.doc === doc) {
        const btn = queue.shift();
        const i = +btn.dataset.page;
        try {
          let url = thumbCache.get(i);
          if (!url) {
            const cv = await T.renderPage(doc, i + 1, { width: 200 * Math.min(2, window.devicePixelRatio || 1) });
            url = cv.toDataURL('image/jpeg', 0.82);
            cv.width = cv.height = 0;
            thumbCache.set(i, url);
          }
          if (!btn.isConnected) continue;
          const box = btn.querySelector('.pdf-page__img');
          box.innerHTML = `<img src="${url}" alt="Página ${i + 1}" draggable="false">`;
        } catch (e) {
          console.error(e);
        }
      }
      running = false;
    };
    observer = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          observer.unobserve(en.target);
          queue.push(en.target);
        }
        run();
      },
      { rootMargin: '400px' }
    );
    root.querySelectorAll('[data-page]').forEach((b) => observer.observe(b));
  }

  function paintSelection() {
    if (!pdf || tool.multi) return;
    const s = sel();
    root.querySelectorAll('[data-page]').forEach((b) => {
      const on = s.has(+b.dataset.page);
      if (tool.pick === 'keep' || tool.pick === 'remove') b.setAttribute('aria-pressed', String(on));
      else b.removeAttribute('aria-pressed');
    });
    const r = $('[data-ranges]');
    if (r && document.activeElement !== r) r.value = T.rangesText([...s]);
    const n = s.size;
    let c = plural(pdf.n, 'página', 'páginas');
    if (tool.pick === 'keep') c = `${n} de ${pdf.n} escolhidas`;
    if (tool.pick === 'remove') c = n ? `${plural(n, 'vai sumir', 'vão sumir')} · ficam ${pdf.n - n}` : 'nenhuma para apagar';
    $('[data-count]').textContent = c;
    updateRunState();
  }

  /* ---------- vários arquivos ---------- */
  async function addToList(files) {
    const ok = files.filter((f) => (tool.accept === 'img' ? T.isImage(f) : T.isPdf(f) || T.isImage(f)));
    if (ok.length < files.length) toast(tool.accept === 'img' ? 'Só imagens aqui (JPG, PNG, WebP…).' : 'Só PDFs e imagens aqui.', { kind: 'error' });
    for (const f of ok) list.push({ id: ++uid, file: f, thumb: null, info: T.isPdf(f) ? 'PDF' : 'imagem' });
    renderList();
    clearResults();
    for (const it of list) {
      if (it.thumb) continue;
      try {
        if (T.isPdf(it.file)) {
          const doc = await T.openPdfjs(it.file);
          it.info = `${plural(doc.numPages, 'página', 'páginas')} · ${T.fmtSize(it.file.size)}`;
          const cv = await T.renderPage(doc, 1, { width: 120 });
          it.thumb = cv.toDataURL('image/jpeg', 0.8);
          doc.destroy();
        } else {
          it.thumb = URL.createObjectURL(it.file);
          it.blobThumb = true;
          it.info = `imagem · ${T.fmtSize(it.file.size)}`;
        }
      } catch (e) {
        it.thumb = '';
        it.info = e.needPassword ? 'PDF com senha' : 'não consegui ler';
        if (e.needPassword) it.locked = true;
      }
      if (!alive) return;
      renderList();
    }
  }

  function renderList() {
    if (!tool.multi) return;
    const ol = $('[data-list]');
    $('[data-list-empty]').hidden = list.length > 0;
    $('[data-act="add-more"]').hidden = !list.length;
    $('[data-list-count]').textContent = list.length ? plural(list.length, 'arquivo', 'arquivos') : '';
    ol.innerHTML = list
      .map(
        (it, i) => `
      <li class="pdf-item">
        <span class="pdf-item__n">${i + 1}</span>
        <span class="pdf-item__img">${it.thumb ? `<img src="${it.thumb}" alt="" draggable="false">` : icon(T.isPdf(it.file) ? 'sheet' : 'photo', { size: 26 })}</span>
        <span class="pdf-item__txt"><strong>${esc(it.file.name)}</strong><span>${esc(it.info)}</span></span>
        <span class="pdf-item__acts">
          <button type="button" class="round-btn" data-move="-1" data-i="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icon('up', { size: 18 })}</button>
          <button type="button" class="round-btn" data-move="1" data-i="${i}" aria-label="Descer" ${i === list.length - 1 ? 'disabled' : ''}>${icon('down', { size: 18 })}</button>
          <button type="button" class="round-btn round-btn--danger" data-del="${i}" aria-label="Tirar da lista">${icon('trash', { size: 18 })}</button>
        </span>
      </li>`
      )
      .join('');
    $('[data-drop-label]').textContent = list.length ? 'Pôr mais arquivos' : DROP[tool.accept];
    updateRunState();
  }

  /* ---------- abrir arquivos ---------- */
  async function openFiles(files) {
    files = [...files];
    if (!files.length) return;
    if (tool.multi) return addToList(files);
    const f = files.find(T.isPdf);
    if (!f) {
      if (files.some(T.isImage)) {
        toast('Isso é uma imagem. Abri a ferramenta Imagem em PDF.');
        switchTool('imagem-pdf');
        return addToList(files);
      }
      return toast('Escolha um arquivo PDF.', { kind: 'error' });
    }
    await loadMainPdf(f);
  }

  async function loadMainPdf(file, password) {
    const drop = $('[data-drop]');
    drop.classList.add('is-busy');
    try {
      const doc = await T.openPdfjs(file, password);
      if (!alive) return doc.destroy();
      closePdf();
      pdf = { file, doc, n: doc.numPages, password };
      sels = {};
      renderTool();
    } catch (e) {
      if (e.needPassword) return askPassword(file, e.message);
      console.error(e);
      toast(e.userFacing ? e.message : 'Não consegui abrir esse PDF.', { kind: 'error' });
    } finally {
      drop.classList.remove('is-busy');
    }
  }

  function askPassword(file, msg) {
    openModal({
      title: 'PDF com senha',
      html: `
        <p class="modal__text">${esc(msg)} Digite a senha para abrir.</p>
        <form class="pdf-pw" data-pw-form>
          <input class="field__input" type="password" data-pw autocomplete="off" aria-label="Senha do PDF">
          <button type="submit" class="btn btn--primary">${icon('check', { size: 20 })}Abrir</button>
        </form>`,
      onMount(body, close) {
        const inp = body.querySelector('[data-pw]');
        setTimeout(() => inp.focus(), 50);
        body.querySelector('[data-pw-form]').addEventListener('submit', (ev) => {
          ev.preventDefault();
          close();
          loadMainPdf(file, inp.value);
        });
      },
    });
  }

  function closePdf() {
    if (pdf && pdf.doc) pdf.doc.destroy();
    pdf = null;
    thumbCache.clear();
    sels = {};
  }

  function switchTool(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t || t === tool) return;
    if (t.multi !== tool.multi || t.accept !== tool.accept) {
      list.forEach((it) => it.blobThumb && URL.revokeObjectURL(it.thumb));
      list = [];
    }
    tool = t;
    history.replaceState(null, '', `#/pdf?t=${t.id}`);
    renderTool();
  }

  /* ---------- fazer ---------- */
  async function runTool() {
    if (busy) return;
    busy = true;
    const btn = $('[data-act="run"]');
    btn.classList.add('is-busy');
    updateRunState();
    clearResults();
    const prog = $('[data-progress]');
    const bar = $('[data-bar]');
    const ptxt = $('[data-progress-text]');
    prog.hidden = false;
    const progress = (p, t) => {
      bar.style.width = `${Math.round(Math.max(0.04, Math.min(1, p)) * 100)}%`;
      ptxt.textContent = t || '';
    };
    progress(0, 'Começando…');
    const pages = pdf && !tool.multi ? selected() : [];
    const args = { file: pdf && pdf.file, pages, opts: { ...opts }, password: pdf && pdf.password, progress, files: list.map((it) => it.file) };
    try {
      let out;
      if (tool.id === 'extrair') out = await T.extractPages(args);
      else if (tool.id === 'pdf-imagem') out = await T.pdfToImages(args);
      else if (tool.id === 'imagem-pdf') out = await T.imagesToPdf(args);
      else if (tool.id === 'juntar') out = await T.mergeFiles(args);
      else if (tool.id === 'dividir') out = await T.splitPdf(args);
      else if (tool.id === 'remover') out = await T.removePages(args);
      else if (tool.id === 'girar') out = await T.rotatePages(args);
      else if (tool.id === 'comprimir') out = await T.compressPdf(args);
      if (!alive) return;
      showResults(out);
    } catch (e) {
      console.error(e);
      if (alive) toast(e.userFacing ? e.message : 'Algo deu errado. Confira o arquivo e tente de novo.', { kind: 'error', duration: 6000 });
    } finally {
      busy = false;
      if (alive) {
        prog.hidden = true;
        btn.classList.remove('is-busy');
        updateRunState();
      }
    }
  }

  function clearResults() {
    results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    results = [];
    const box = $('[data-ready]');
    box.hidden = true;
    box.innerHTML = '';
  }

  function showResults(out) {
    clearResults();
    results = out.map((r) => ({ ...r, file: new File([r.blob], r.name, { type: r.blob.type }), url: URL.createObjectURL(r.blob) }));
    const many = results.length > 1;
    const total = results.reduce((n, r) => n + r.blob.size, 0);
    const shareable = canShareFiles(results.map((r) => r.file));
    const box = $('[data-ready]');
    box.innerHTML = `
      <p class="ready__title">${icon('heart', { size: 18, fill: true })} ${many ? `Prontos: ${results.length} arquivos` : 'Pronto!'}</p>
      ${
        many
          ? `<div class="ready__links pdf-ready__all">
              <button type="button" class="btn btn--primary" data-act="zip">${icon('download', { size: 20 })}Salvar tudo (.zip, ${T.fmtSize(total)})</button>
              ${shareable ? `<button type="button" class="btn btn--soft" data-act="share-all">${icon('upload', { size: 20 })}Compartilhar todos</button>` : ''}
            </div>`
          : ''
      }
      <ul class="pdf-results">
        ${results
          .map(
            (r, i) => `
          <li class="pdf-result">
            ${r.image ? `<img class="pdf-result__img" src="${r.url}" alt="" draggable="false">` : `<span class="pdf-result__ic">${icon('sheet', { size: 26 })}</span>`}
            <span class="pdf-result__txt"><strong>${esc(r.name)}</strong><span>${esc(r.note || '')}${r.note ? ' · ' : ''}${T.fmtSize(r.blob.size)}</span></span>
            <span class="pdf-result__acts">
              ${r.image ? '' : `<a class="btn btn--soft btn--sm" href="${r.url}" target="_blank" rel="noopener">${icon('zoom', { size: 18 })}Abrir</a>`}
              <a class="btn btn--${many ? 'soft' : 'primary'} btn--sm" href="${r.url}" download="${esc(r.name)}">${icon('download', { size: 18 })}Salvar</a>
              ${shareable && !many ? `<button type="button" class="btn btn--soft btn--sm" data-share="${i}">${icon('upload', { size: 18 })}Compartilhar</button>` : ''}
              ${r.image ? `<button type="button" class="btn btn--soft btn--sm" data-sticker="${i}">${icon('sticker', { size: 18 })}Guardar em Meus adesivos</button>` : ''}
              ${!r.image && !many ? `<button type="button" class="btn btn--soft btn--sm" data-continue="${i}">${icon('redo', { size: 18 })}Usar em outra ferramenta</button>` : ''}
            </span>
          </li>`
          )
          .join('')}
      </ul>`;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(many ? `${results.length} arquivos prontos.` : 'Pronto!');
  }

  async function toSticker(i, btn) {
    const r = results[i];
    btn.disabled = true;
    try {
      const img = await blobToImage(r.blob);
      await saveSticker(img, { name: T.baseName(r.name) });
      releaseImage(img);
      btn.innerHTML = `${icon('check', { size: 18 })}Guardado em Meus adesivos`;
      toast('Guardado em Meus adesivos: já aparece na aba Adesivos do editor.', { action: 'Ver', onAction: () => (location.hash = '#/adesivos') });
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      toast(e.message || 'Não consegui guardar.', { kind: 'error' });
    }
  }

  async function continueWith(i) {
    const r = results[i];
    const file = r.file;
    clearResults();
    if (tool.multi) {
      list = [];
      switchTool('extrair');
    }
    await loadMainPdf(file);
    toast('Abri o PDF novo. Escolha a próxima ferramenta.');
    $('.pdfv__tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- eventos ---------- */
  input.addEventListener('change', () => {
    openFiles(input.files);
    input.value = '';
  });

  const drop = $('[data-drop]');
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) openFiles(e.dataTransfer.files);
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t) || t.disabled) return;
    const ds = t.dataset;
    if (ds.tool) return switchTool(ds.tool);
    if (ds.page != null) {
      const i = +ds.page;
      const s = sel();
      if (e.shiftKey && lastTap != null) {
        const on = s.has(lastTap);
        const [a, b] = [Math.min(lastTap, i), Math.max(lastTap, i)];
        for (let k = a; k <= b; k++) on ? s.add(k) : s.delete(k);
      } else s.has(i) ? s.delete(i) : s.add(i);
      lastTap = i;
      $('[data-ranges-hint]') && ($('[data-ranges-hint]').textContent = 'No computador: segure Shift para escolher várias de uma vez.');
      return paintSelection();
    }
    if (ds.pick) {
      const s = sel();
      s.clear();
      for (let k = 0; k < pdf.n; k++) {
        if (ds.pick === 'all' || (ds.pick === 'odd' && k % 2 === 0) || (ds.pick === 'even' && k % 2 === 1)) s.add(k);
      }
      lastTap = null;
      return paintSelection();
    }
    if (ds.opt) {
      opts[ds.opt] = ds.v;
      if (ds.opt === 'angle') $('[data-pages]').dataset.angle = ds.v;
      clearResults();
      return renderOpts();
    }
    if (ds.move) {
      const i = +ds.i;
      const j = i + +ds.move;
      [list[i], list[j]] = [list[j], list[i]];
      clearResults();
      return renderList();
    }
    if (ds.del != null) {
      const [it] = list.splice(+ds.del, 1);
      if (it && it.blobThumb) URL.revokeObjectURL(it.thumb);
      clearResults();
      return renderList();
    }
    if (ds.share != null) return shareOrDownload([results[+ds.share].file], results[+ds.share].name);
    if (ds.sticker != null) return toSticker(+ds.sticker, t);
    if (ds.continue != null) return continueWith(+ds.continue);
    const act = ds.act;
    if (act === 'run') return runTool();
    if (act === 'add-more') return input.click();
    if (act === 'close-pdf') {
      closePdf();
      return renderTool();
    }
    if (act === 'zip') {
      t.disabled = true;
      try {
        const name = pdf ? T.baseName(pdf.file.name) : 'arquivos';
        const zip = await T.zipFiles(results, `${name}-${tool.id}`);
        await shareOrDownload([zip], zip.name).catch(() => {});
      } catch (err) {
        toast(err.message || 'Não consegui montar o .zip.', { kind: 'error' });
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (act === 'share-all') return shareOrDownload(results.map((r) => r.file), 'Arquivos da Central');
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.check) {
      opts[t.dataset.check] = t.checked;
      clearResults();
      if (t.dataset.check === 'together') renderOpts();
      if (t.dataset.check === 'gray') updateRunState();
    }
    if (t.dataset.select) {
      opts[t.dataset.select] = t.value;
      clearResults();
      renderOpts();
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.text) {
      opts[t.dataset.text] = t.value;
      clearResults();
      updateRunState();
    }
    if (t.dataset.ranges != null && pdf) {
      const hint = $('[data-ranges-hint]');
      const s = sel();
      if (!t.value.trim()) {
        s.clear();
        hint.textContent = 'Nenhuma página escolhida.';
        return paintSelection();
      }
      try {
        const { pages } = T.parseRanges(t.value, pdf.n);
        s.clear();
        pages.forEach((p) => s.add(p));
        hint.textContent = plural(pages.length, 'página escolhida', 'páginas escolhidas') + '.';
        paintSelection();
      } catch (err) {
        hint.textContent = err.message;
      }
    }
  });
  root.addEventListener('focusout', (e) => {
    if (e.target.dataset && e.target.dataset.ranges != null) paintSelection();
  });

  renderTool();

  return () => {
    alive = false;
    if (observer) observer.disconnect();
    clearResults();
    list.forEach((it) => it.blobThumb && URL.revokeObjectURL(it.thumb));
    closePdf();
  };
}

// Meus adesivos: transformar fotos em figurinhas (tirando o fundo e pondo contorno),
// guardar, usar nos cards e pôr na folha para imprimir em papel adesivo.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { createBgRemover } from '../bg-remover.js';
import { processPhoto, forgetPhoto } from '../fx.js';
import { importImageFile, releaseImage } from '../image.js';
import { db } from '../db.js';
import { saveSticker, listStickers, deleteSticker, restoreSticker, onStickersChange, stickerUrls, revokeUrls } from '../library.js';
import { addStickerToSheet, isStickerRec, onSheet } from '../records.js';
import { swatches } from './pc-panels.js';
import { BG_TOOLS, BRUSH_SIZES, isBrushTool, newStroke, extendStroke, paintPreview } from '../brush.js';

export const title = 'Meus adesivos';

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const MAKER_MAX = 1600; // px: o suficiente para um adesivo nítido e rápido de calcular

function template() {
  return `
  <section class="lib">
    <div class="lib__hello">
      <h1 class="lib__title">Meus adesivos</h1>
      <p class="lib__sub">Transforme fotos em figurinhas: o fundo sai, entra um contorno branco e pronto. Depois use nos cards ou imprima em papel adesivo.</p>
    </div>
    <div class="lib__cols">
      <div class="lib__maker" data-maker></div>
      <div class="lib__side">
        <div class="lib__box">
          <div class="lib__boxhead">
            <h2 class="lib__h2">Guardados <span class="sheet__count" data-count></span></h2>
            <button type="button" class="link-btn" data-act="png">${icon('upload', { size: 18 })}Adicionar imagem pronta (PNG)</button>
          </div>
          <ul class="lib__grid" data-list></ul>
        </div>
        <div class="lib__box lib__box--sheet">
          <p class="lib__sheet" data-sheet-info></p>
          <a class="btn btn--primary btn--wide" href="#/photo-cards">${icon('printer', { size: 22 })}Ver folha e imprimir</a>
          <p class="print-tip">Na folha dá para mudar o tamanho de cada adesivo e quantos sair. Imprima em <strong>papel adesivo</strong> (vende em papelaria) e recorte pela linha cinza.</p>
        </div>
      </div>
    </div>
    <input type="file" accept="image/*" hidden data-file>
    <input type="file" accept="image/png,image/webp,image/gif,image/*" hidden data-png>
  </section>`;
}

export async function mount(root) {
  root.innerHTML = template();
  const $ = (sel) => root.querySelector(sel);
  const maker = $('[data-maker]');
  let alive = true;
  let list = [];
  let onSheetCount = new Map(); // libId -> quantos na folha

  // ---------- fazer um adesivo ----------
  const M = {
    img: null, // foto escolhida (reduzida)
    remover: null,
    ops: [],
    tolerance: 30,
    result: null, // canvas sem fundo
    running: false,
    outline: { on: true, size: 5, color: '#ffffff' },
    view: null, // onde a figura foi desenhada no canvas: { dx, dy, s, pad }
    timer: 0,
    tool: 'point', // point | color | erase | restore
    brush: BRUSH_SIZES.def,
    stroke: null,
    cursor: null, // onde está o pincel (px do canvas)
  };

  function renderMakerEmpty() {
    maker.innerHTML = `
      <div class="maker-empty">
        <span class="maker-empty__art" aria-hidden="true">${icon('sticker', { size: 54 })}</span>
        <p class="maker-empty__title">Novo adesivo</p>
        <p class="maker-empty__text">Escolha uma foto. Fotos com fundo liso (parede, céu, lençol) ficam perfeitas.</p>
        <button type="button" class="btn btn--primary" data-act="pick">${icon('photo', { size: 22 })}Escolher foto</button>
        <button type="button" class="link-btn" data-act="paste">${icon('upload', { size: 18 })}Colar imagem</button>
      </div>`;
  }

  function renderMakerWork() {
    maker.innerHTML = `
      <div class="maker">
        <div class="maker__stage">
          <canvas class="maker__canvas" data-canvas aria-label="Prévia do adesivo. ${isTouch ? 'Toque' : 'Clique'} numa parte do fundo para apagar."></canvas>
          <span class="stage__busy" data-busy hidden>${icon('wand', { size: 18 })}Apagando o fundo…</span>
        </div>
        <div class="bg-tools" role="group" aria-label="Ferramenta">
          ${BG_TOOLS.map((t) => `<button type="button" class="bg-tool" data-bg-tool="${t.id}" aria-pressed="${t.id === M.tool}">${icon(t.icon, { size: 22 })}<span>${t.name}</span></button>`).join('')}
        </div>
        <p class="maker__help" data-tool-help></p>
        <div class="slider" data-tol-row>
          <span class="slider__label">Força</span>
          <input type="range" min="1" max="100" step="1" value="${M.tolerance}" data-tol aria-label="Força do apagador">
          <output class="slider__value" data-tol-out>${M.tolerance}</output>
        </div>
        <div class="slider" data-brush-row>
          <span class="slider__label">Pincel</span>
          <input type="range" min="${BRUSH_SIZES.min}" max="${BRUSH_SIZES.max}" step="1" value="${M.brush}" data-brush-size aria-label="Tamanho do pincel">
          <span class="brush-dot" data-brush-dot style="--d:${Math.min(44, M.brush)}px" aria-hidden="true"></span>
        </div>
        <div class="tool-row">
          <button type="button" class="tool-btn" data-act="auto">${icon('sparkle', { size: 22 })}Automático</button>
          <button type="button" class="tool-btn" data-act="bg-undo">${icon('undo', { size: 22 })}Desfazer</button>
          <button type="button" class="tool-btn" data-act="bg-reset">${icon('photo', { size: 22 })}Foto original</button>
        </div>
        <div class="psec">
          <label class="check">
            <input type="checkbox" data-outline ${M.outline.on ? 'checked' : ''}>
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Contorno, como figurinha
          </label>
          <div class="psec__more" data-outline-more ${M.outline.on ? '' : 'hidden'}>
            <div class="slider">
              <span class="slider__label">Espessura</span>
              <input type="range" min="1" max="10" step="1" value="${M.outline.size}" data-outline-size aria-label="Espessura do contorno">
            </div>
            ${swatches('outline', M.outline.color, { label: 'Cor do contorno' })}
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--primary" data-act="save">${icon('heart', { size: 22, fill: true })}Guardar adesivo</button>
          <button type="button" class="btn btn--soft" data-act="cancel">Cancelar</button>
        </div>
      </div>`;
    const c = maker.querySelector('[data-canvas]');
    c.addEventListener('pointerdown', onCanvasDown);
    c.addEventListener('pointermove', onCanvasMove);
    c.addEventListener('pointerup', onCanvasUp);
    c.addEventListener('pointercancel', onCanvasUp);
    c.addEventListener('pointerleave', () => {
      if (!M.stroke && M.cursor) {
        M.cursor = null;
        drawPreview();
      }
    });
    new ResizeObserver(() => drawPreview()).observe(c);
    syncMaker();
  }

  function syncMaker() {
    const set = (sel, dis) => {
      const b = maker.querySelector(sel);
      if (b) b.disabled = dis;
    };
    const busy = maker.querySelector('[data-busy]');
    if (busy) busy.hidden = !M.running;
    set('[data-act="bg-undo"]', !M.ops.length);
    set('[data-act="bg-reset"]', !M.ops.length);
    set('[data-act="auto"]', M.ops.some((o) => o.kind === 'edges'));
    set('[data-act="save"]', M.running || !M.result);
    const out = maker.querySelector('[data-tol-out]');
    if (out) out.textContent = M.tolerance;
    const more = maker.querySelector('[data-outline-more]');
    if (more) more.hidden = !M.outline.on;
    const brushTool = isBrushTool(M.tool);
    const tool = BG_TOOLS.find((t) => t.id === M.tool) || BG_TOOLS[0];
    const help = maker.querySelector('[data-tool-help]');
    if (help) help.textContent = `${tool.help(isTouch ? 'Toque' : 'Clique')}${brushTool ? '' : ' A barra “Força” apaga mais ou menos cores parecidas.'}`;
    const tr = maker.querySelector('[data-tol-row]');
    if (tr) tr.hidden = brushTool;
    const br = maker.querySelector('[data-brush-row]');
    if (br) br.hidden = !brushTool;
    maker.querySelectorAll('[data-bg-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bgTool === M.tool)));
    const cv = maker.querySelector('[data-canvas]');
    if (cv) cv.classList.toggle('is-brush', brushTool);
  }

  let checker = null;
  function drawPreview({ live = false } = {}) {
    const c = maker.querySelector('[data-canvas]');
    if (!c || !M.result) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!checker) {
      const t = document.createElement('canvas');
      t.width = t.height = 20;
      const g = t.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 20, 20);
      g.fillStyle = '#f2dbe6';
      g.fillRect(0, 0, 10, 10);
      g.fillRect(10, 10, 10, 10);
      checker = ctx.createPattern(t, 'repeat');
    }
    ctx.fillStyle = checker;
    ctx.fillRect(0, 0, rect.width, rect.height);
    // enquanto passa o pincel, mostra sem o contorno (fica mais rápido)
    const res = processPhoto(M.result, null, M.outline.on && !live ? M.outline : null, 900);
    const iw = M.result.width;
    const ih = M.result.height;
    const tw = iw + res.pad * 2;
    const th = ih + res.pad * 2;
    const s = Math.min((rect.width - 24) / tw, (rect.height - 24) / th);
    const dx = (rect.width - tw * s) / 2;
    const dy = (rect.height - th * s) / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(res.canvas, dx, dy, tw * s, th * s);
    M.view = { dx, dy, s, pad: res.pad };
    if (M.cursor && isBrushTool(M.tool)) {
      ctx.beginPath();
      ctx.arc(M.cursor.x, M.cursor.y, M.brush, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = M.tool === 'restore' ? '#2f8f6b' : '#7a52d1';
      ctx.stroke();
    }
  }

  // Ponto do canvas (px) -> pixel da foto.
  function toImage(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return { px, py, x: (px - M.view.dx) / M.view.s - M.view.pad, y: (py - M.view.dy) / M.view.s - M.view.pad };
  }

  let down = null; // { id, x, y } do toque, para saber se foi um toque parado
  let liveRaf = 0;
  const liveDraw = () => {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(() => {
      liveRaf = 0;
      forgetPhoto(M.result);
      drawPreview({ live: !!M.stroke });
    });
  };

  function onCanvasDown(e) {
    if (!M.view || !M.result) return;
    const p = toImage(e);
    if (isBrushTool(M.tool)) {
      if (M.stroke || M.ops.length >= 400 || M.result === M.img) return; // (ainda calculando o primeiro resultado)
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
      const r = M.brush / M.view.s;
      M.stroke = newStroke(M.tool, p, r);
      M.strokeId = e.pointerId;
      M.cursor = { x: p.px, y: p.py };
      paintPreview(M.result, M.img, M.tool, r, p, p);
      liveDraw();
      return;
    }
    down = { id: e.pointerId, x: p.px, y: p.py };
  }

  function onCanvasMove(e) {
    if (!M.view || !M.result) return;
    if (isBrushTool(M.tool)) {
      const p = toImage(e);
      M.cursor = { x: p.px, y: p.py };
      if (M.stroke && e.pointerId === M.strokeId) {
        const from = extendStroke(M.stroke, p);
        if (from) paintPreview(M.result, M.img, M.tool, M.stroke.r, from, p);
      }
      liveDraw();
      return;
    }
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - e.currentTarget.getBoundingClientRect().left - down.x, e.clientY - e.currentTarget.getBoundingClientRect().top - down.y) > 10) down = null;
  }

  function onCanvasUp(e) {
    if (M.stroke && e.pointerId === M.strokeId) {
      M.ops.push(M.stroke);
      M.stroke = null;
      if (e.pointerType !== 'mouse') M.cursor = null;
      run();
      return;
    }
    if (!down || down.id !== e.pointerId || e.type !== 'pointerup') return;
    down = null;
    if (!M.view || !M.result || M.ops.length >= 400 || isBrushTool(M.tool)) return;
    const { x, y } = toImage(e);
    if (x < 0 || y < 0 || x >= M.result.width || y >= M.result.height) return;
    M.ops.push({ kind: M.tool === 'color' ? 'color' : 'point', x, y });
    run();
  }

  async function run({ first = false } = {}) {
    M.running = true;
    syncMaker();
    const res = await M.remover.run(M.ops, M.tolerance);
    if (!res || !alive) return;
    M.running = false;
    M.result = res.canvas;
    forgetPhoto(M.result); // o canvas é o mesmo, mas os pixels mudaram
    drawPreview();
    syncMaker();
    if (first && res.coverage < 0.35) {
      toast(`O fundo desta foto tem muitas cores. ${isTouch ? 'Toque' : 'Clique'} nas partes que quer apagar.`, { duration: 6000 });
    }
  }

  async function startMaker(file) {
    try {
      const { img } = await importImageFile(file);
      if (!alive) return;
      // reduz para ficar rápido (o adesivo não precisa de mais que isso)
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const f = Math.min(1, MAKER_MAX / Math.max(w, h));
      const small = document.createElement('canvas');
      small.width = Math.round(w * f);
      small.height = Math.round(h * f);
      small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
      releaseImage(img);
      M.img = small;
      M.ops = [{ kind: 'edges' }];
      M.tolerance = 30;
      M.result = small;
      if (!M.remover) M.remover = createBgRemover();
      renderMakerWork();
      await M.remover.load(small);
      await run({ first: true });
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
      resetMaker();
    }
  }

  function resetMaker() {
    M.img = null;
    M.result = null;
    M.ops = [];
    M.view = null;
    renderMakerEmpty();
  }

  async function saveMaker() {
    if (!M.result || M.running) return;
    try {
      const res = processPhoto(M.result, null, M.outline.on ? M.outline : null, Infinity);
      const c = document.createElement('canvas');
      c.width = res.canvas.width;
      c.height = res.canvas.height;
      c.getContext('2d').drawImage(res.canvas, 0, 0);
      await saveSticker(c);
      toast('Adesivo guardado! Ele já aparece em Adesivos › Meus, nos cards.');
      resetMaker();
    } catch (err) {
      toast(err.message || 'Não consegui guardar o adesivo.', { kind: 'error' });
    }
  }

  // ---------- lista ----------
  async function loadSheetCounts() {
    onSheetCount = new Map();
    try {
      const all = await db.allCards();
      for (const r of all) {
        if (!isStickerRec(r) || !onSheet(r)) continue;
        const id = r.sticker.libId;
        onSheetCount.set(id, (onSheetCount.get(id) || 0) + (r.copies || 1));
      }
    } catch (_) {}
  }

  async function loadList() {
    const fresh = stickerUrls(await listStickers());
    await loadSheetCounts();
    if (!alive) return revokeUrls(fresh);
    revokeUrls(list);
    list = fresh;
    renderList();
  }

  function renderList() {
    $('[data-count]').textContent = list.length ? String(list.length) : '';
    const ul = $('[data-list]');
    if (!list.length) {
      ul.innerHTML = `<li class="card-list__empty">Nenhum adesivo ainda. Faça o primeiro ao lado, ou num card: escolha a foto, toque em <strong>Tirar fundo</strong> e depois em <strong>Virar adesivo</strong>.</li>`;
    } else {
      ul.innerHTML = list
        .map((st) => {
          const n = onSheetCount.get(st.id) || 0;
          return `
          <li class="lib-item">
            <span class="lib-item__img"><img src="${st.url}" alt="" draggable="false"></span>
            ${n ? `<span class="tag lib-item__tag">${n} na folha</span>` : ''}
            <div class="lib-item__acts">
              <button type="button" class="btn btn--soft btn--sm" data-to-sheet="${st.id}">${icon('plus', { size: 18 })}Pôr na folha</button>
              <button type="button" class="round-btn round-btn--danger" data-del="${st.id}" aria-label="Apagar adesivo">${icon('trash', { size: 18 })}</button>
            </div>
          </li>`;
        })
        .join('');
    }
    const total = [...onSheetCount.values()].reduce((a, b) => a + b, 0);
    $('[data-sheet-info]').textContent = total ? `${total} ${total === 1 ? 'adesivo está' : 'adesivos estão'} na folha para imprimir.` : 'Nenhum adesivo na folha ainda. Toque em “Pôr na folha” num adesivo.';
  }

  const stopLib = onStickersChange(loadList);

  // ---------- cliques ----------
  const fileInput = $('[data-file]');
  const pngInput = $('[data-png]');
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (f) startMaker(f);
  });
  pngInput.addEventListener('change', async () => {
    const f = pngInput.files && pngInput.files[0];
    pngInput.value = '';
    if (!f) return;
    try {
      const { img } = await importImageFile(f);
      await saveSticker(img);
      releaseImage(img);
      toast('Imagem guardada como adesivo!');
    } catch (err) {
      toast(err.message || 'Não consegui usar essa imagem.', { kind: 'error' });
    }
  });

  async function paste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return startMaker(new File([await item.getType(type)], 'colada', { type }));
      }
      toast('Não tem imagem copiada. Copie uma foto e tente de novo.', { kind: 'error' });
    } catch (_) {
      toast('Não consegui colar. Use “Escolher foto”.', { kind: 'error' });
    }
  }

  function onPaste(e) {
    const item = e.clipboardData && [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    startMaker(item.getAsFile());
  }
  document.addEventListener('paste', onPaste);

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled || !root.contains(t)) return;
    const ds = t.dataset;
    switch (ds.act) {
      case 'pick':
        return fileInput.click();
      case 'paste':
        return paste();
      case 'png':
        return pngInput.click();
      case 'auto':
        M.ops.unshift({ kind: 'edges' });
        return run();
      case 'bg-undo':
        M.ops.pop();
        return run();
      case 'bg-reset':
        M.ops = [];
        return run();
      case 'save':
        return saveMaker();
      case 'cancel':
        return resetMaker();
    }
    if (ds.bgTool) {
      M.tool = ds.bgTool;
      M.stroke = null;
      syncMaker();
      return drawPreview();
    }
    if (ds.colorProp === 'outline' && 'color' in ds) {
      M.outline.color = ds.color;
      maker.querySelectorAll('[data-color-prop="outline"]').forEach((b) => b.setAttribute('aria-checked', String(b === t)));
      return drawPreview();
    }
    if (ds.toSheet) {
      const st = list.find((x) => x.id === ds.toSheet);
      if (!st) return;
      await addStickerToSheet(st, 50);
      await loadSheetCounts();
      renderList();
      toast('Adesivo na folha, com 5 cm. Na folha dá para mudar o tamanho e a quantidade.', {
        action: 'Ver folha',
        duration: 6000,
        onAction: () => (location.hash = '#/photo-cards'),
      });
      return;
    }
    if (ds.del) {
      const st = list.find((x) => x.id === ds.del);
      if (!st) return;
      const { url, ...rec } = st;
      await deleteSticker(st.id);
      toast('Adesivo apagado.', { action: 'Desfazer', duration: 6000, onAction: () => restoreSticker(rec) });
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-tol]')) {
      M.tolerance = +t.value;
      syncMaker();
      clearTimeout(M.timer);
      M.timer = setTimeout(() => run(), 90);
    } else if (t.matches('[data-brush-size]')) {
      M.brush = +t.value;
      const dot = maker.querySelector('[data-brush-dot]');
      if (dot) dot.style.setProperty('--d', `${Math.min(44, M.brush)}px`);
    } else if (t.matches('[data-outline-size]')) {
      M.outline.size = +t.value;
      drawPreview();
    } else if (t.matches('[data-color-input="outline"]')) {
      M.outline.color = t.value;
      drawPreview();
    }
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-outline]')) {
      M.outline.on = e.target.checked;
      syncMaker();
      drawPreview();
    }
  });

  renderMakerEmpty();
  await loadList();

  return () => {
    alive = false;
    stopLib();
    revokeUrls(list);
    document.removeEventListener('paste', onPaste);
    if (M.remover) M.remover.destroy();
  };
}

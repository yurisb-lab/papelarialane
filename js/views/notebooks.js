// Tela "Cadernos A5": monta o miolo (pautado, pontilhado, quadriculado, liso, tarefas, semana)
// com a margem do wire-o, e gera o PDF A4 frente e verso, 2 folhas A5 por A4.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { db } from '../db.js';
import { shade } from '../card.js';
import { shareOrDownload } from '../export.js';
import { listThemes } from '../themes.js';
import { PAGE_TYPES, pageTypeInfo, defaultSpec, totalLeaves, renderLeafPreview, buildNotebookPdf } from '../notebook.js';

export const title = 'Cadernos A5';

const LINE_COLORS = ['#b9aea6', '#9fb7c9', '#a9c4b2', '#e3a98d', '#c7b3d9', '#8c8c8c'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function mount(root) {
  let spec = { ...defaultSpec(), ...((await db.getMeta('notebookSpec').catch(() => null)) || {}) };
  let shown = 0; // seção mostrada na prévia
  let pdf = null; // { url, file }
  let alive = true;
  const themes = await listThemes().catch(() => []);

  root.innerHTML = `
  <section class="nb">
    <header class="themes__head">
      <h1 class="themes__title">Cadernos A5</h1>
      <p class="themes__lead">Monte o miolo do caderno ou planner em seções, com a margem do wire-o. Sai um PDF A4 para imprimir frente e verso: cada folha A4 vira 2 folhas A5.</p>
    </header>
    <div class="themes__cols">
      <div class="themes__left">
        <div class="box">
          <h2 class="box__title">${icon('book', { size: 22 })} Seções do miolo</h2>
          <ul class="nb-sections" data-sections></ul>
          <button type="button" class="btn btn--soft btn--sm" data-act="add-section">${icon('plus', { size: 18 })}Adicionar seção</button>
          <p class="nb-total" data-total></p>
        </div>
        <div class="box">
          <h2 class="box__title">${icon('palette', { size: 22 })} Jeito das páginas</h2>
          <div class="field">
            <span class="field__label">Margem do wire-o</span>
            <div class="stepper" role="group" aria-label="Margem do wire-o">
              <button type="button" class="round-btn" data-bind="-1" aria-label="Menos">${icon('minus', { size: 18 })}</button>
              <output data-bind-out></output>
              <button type="button" class="round-btn" data-bind="1" aria-label="Mais">${icon('plus', { size: 18 })}</button>
            </div>
          </div>
          <div class="field">
            <span class="field__label">Distância entre as linhas (pautado)</span>
            <div class="chips" data-spacing></div>
          </div>
          <div class="field">
            <span class="field__label">Cor das linhas</span>
            <div class="chips" data-colors></div>
          </div>
          ${
            themes.length
              ? `<div class="field"><span class="field__label">Cores de um tema (títulos e linhas)</span><div class="chips">${themes
                  .map((t) => `<button type="button" class="font-chip font-chip--sm" data-theme="${esc(t.id)}"><span class="theme-card__sw theme-card__sw--sm">${t.colors.slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join('')}</span>${esc(t.name)}</button>`)
                  .join('')}</div></div>`
              : ''
          }
          <label class="check">
            <input type="checkbox" data-opt="header">
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Linha de data no alto de cada página
          </label>
          <label class="check">
            <input type="checkbox" data-opt="numbers">
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Número das páginas
          </label>
        </div>
      </div>
      <div class="themes__right">
        <div class="box">
          <h2 class="box__title">Prévia <span class="chip" data-preview-name></span></h2>
          <div class="nb-preview" data-preview></div>
          <p class="hint">Frente e verso de uma folha. Os furinhos cinza só aparecem aqui, para mostrar o lado do wire-o.</p>
          <button type="button" class="btn btn--primary btn--wide" data-act="pdf">${icon('printer', { size: 22 })}<span data-pdf-label>Gerar PDF do miolo</span></button>
          <div class="ready" data-ready hidden>
            <p class="ready__title">${icon('heart', { size: 18, fill: true })} Miolo pronto!</p>
            <div class="ready__links">
              <a class="btn btn--primary" data-open target="_blank" rel="noopener">${icon('printer', { size: 20 })}Abrir e imprimir</a>
              <a class="btn btn--soft" data-download download="miolo-a5-elane.pdf">${icon('download', { size: 20 })}Salvar PDF</a>
              <button type="button" class="btn btn--soft" data-act="share">${icon('upload', { size: 20 })}Compartilhar</button>
            </div>
          </div>
          <div class="print-tip">
            <p><strong>Como imprimir:</strong> papel A4, <strong>tamanho real (100%)</strong>, <strong>frente e verso virando pela borda longa</strong> (o normal da impressora).</p>
            <p><strong>Cortar:</strong> cada A4 corta ao meio, na altura das marquinhas das beiradas (148,5 mm). Cada metade é uma folha A5.</p>
            <p><strong>Furar:</strong> o lado com a margem maior (${'<span data-bind-tip></span>'}) é o do wire-o. Encaixe esse lado na Mimo Binding.</p>
            <p>Sem frente e verso automático: imprima só as páginas ímpares, vire o maço e imprima as pares.</p>
          </div>
          <a class="btn btn--soft btn--wide" href="#/photo-cards?f=cover">${icon('book', { size: 20 })}Fazer a capa A5 no editor</a>
        </div>
      </div>
    </div>
  </section>`;

  const $ = (s) => root.querySelector(s);

  function save() {
    db.setMeta('notebookSpec', spec).catch(() => {});
    invalidate();
  }

  function invalidate() {
    if (pdf) URL.revokeObjectURL(pdf.url);
    pdf = null;
    $('[data-ready]').hidden = true;
  }

  function render() {
    $('[data-sections]').innerHTML = spec.sections
      .map(
        (s, i) => `
      <li class="nb-section${i === shown ? ' is-on' : ''}">
        <button type="button" class="nb-section__eye" data-show="${i}" aria-label="Ver na prévia" aria-pressed="${i === shown}">${i + 1}</button>
        <select class="field__input nb-section__type" data-type="${i}" aria-label="Tipo de página">
          ${PAGE_TYPES.map((p) => `<option value="${p.id}" ${p.id === s.type ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <div class="stepper" role="group" aria-label="Folhas da seção ${i + 1}">
          <button type="button" class="round-btn" data-leaves="-5" data-i="${i}" aria-label="5 folhas a menos" ${s.leaves <= 1 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
          <output>${s.leaves} ${s.leaves === 1 ? 'folha' : 'folhas'}</output>
          <button type="button" class="round-btn" data-leaves="5" data-i="${i}" aria-label="5 folhas a mais" ${s.leaves >= 200 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
        </div>
        <button type="button" class="round-btn round-btn--danger" data-remove="${i}" aria-label="Tirar seção" ${spec.sections.length <= 1 ? 'disabled' : ''}>${icon('trash', { size: 18 })}</button>
      </li>`
      )
      .join('');
    const n = totalLeaves(spec);
    $('[data-total]').innerHTML = `<strong>${n} ${n === 1 ? 'folha' : 'folhas'} A5</strong> = ${n * 2} páginas = <strong>${Math.ceil(n / 2)} ${Math.ceil(n / 2) === 1 ? 'folha' : 'folhas'} A4</strong> (frente e verso)`;
    $('[data-bind-out]').textContent = `${spec.bind} mm`;
    $('[data-bind-tip]').textContent = `${spec.bind} mm`;
    $('[data-spacing]').innerHTML = [6, 7, 8]
      .map((s) => `<button type="button" class="font-chip font-chip--sm" data-space="${s}" aria-pressed="${spec.spacing === s}">${s} mm</button>`)
      .join('');
    $('[data-colors]').innerHTML =
      LINE_COLORS.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${spec.color === c}" data-line-color="${c}" style="--sw:${c}" aria-label="Cor ${c}"></button>`).join('') +
      `<label class="swatch swatch--custom${LINE_COLORS.includes(spec.color) ? '' : ' is-on'}" title="Outra cor" style="--sw:${spec.color}"><input type="color" value="${spec.color}" data-line-input aria-label="Outra cor"></label>`;
    $('[data-opt="header"]').checked = !!spec.header;
    $('[data-opt="numbers"]').checked = !!spec.numbers;
    renderPreview();
  }

  function renderPreview() {
    const s = spec.sections[shown] || spec.sections[0];
    $('[data-preview-name]').textContent = `Seção ${shown + 1}: ${pageTypeInfo(s.type).name}`;
    const wrap = $('[data-preview]');
    wrap.innerHTML = '';
    for (const side of ['front', 'back']) {
      const fig = document.createElement('figure');
      fig.className = 'nb-preview__page';
      const c = renderLeafPreview(spec, s.type, side, side === 'front' ? 1 : 2, 320);
      fig.appendChild(c);
      const cap = document.createElement('figcaption');
      cap.textContent = side === 'front' ? 'Frente' : 'Verso';
      fig.appendChild(cap);
      wrap.appendChild(fig);
    }
  }

  async function makePdf() {
    const btn = $('[data-act="pdf"]');
    const label = $('[data-pdf-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const { doc, sheets } = await buildNotebookPdf(spec, (p) => (label.textContent = `Montando… ${Math.round(p * 100)}%`));
      if (!alive) return;
      const blob = doc.output('blob');
      invalidate();
      const file = new File([blob], 'miolo-a5-elane.pdf', { type: 'application/pdf' });
      pdf = { url: URL.createObjectURL(blob), file };
      $('[data-open]').href = pdf.url;
      $('[data-download]').href = pdf.url;
      $('[data-act="share"]').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      $('[data-ready]').hidden = false;
      $('[data-ready]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast(`PDF pronto: ${sheets} ${sheets === 1 ? 'folha' : 'folhas'} A4.`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não consegui montar o PDF.', { kind: 'error' });
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      label.textContent = 'Gerar PDF do miolo';
    }
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t) || t.disabled) return;
    const ds = t.dataset;
    if (ds.show != null) {
      shown = +ds.show;
      return render();
    }
    if (ds.leaves) {
      const s = spec.sections[+ds.i];
      s.leaves = Math.max(1, Math.min(200, (s.leaves === 1 && +ds.leaves > 0 ? 0 : s.leaves) + +ds.leaves));
      save();
      return render();
    }
    if (ds.remove != null) {
      spec.sections.splice(+ds.remove, 1);
      shown = Math.min(shown, spec.sections.length - 1);
      save();
      return render();
    }
    if (ds.bind) {
      spec.bind = Math.max(8, Math.min(20, spec.bind + +ds.bind));
      save();
      return render();
    }
    if (ds.space) {
      spec.spacing = +ds.space;
      save();
      return render();
    }
    if (ds.lineColor) {
      spec.color = ds.lineColor;
      save();
      return render();
    }
    if (ds.theme) {
      const th = themes.find((x) => x.id === ds.theme);
      if (th) {
        spec.accent = th.colors[0];
        spec.color = shade(th.colors[1], 0.35);
        save();
        render();
      }
      return;
    }
    switch (ds.act) {
      case 'add-section':
        spec.sections.push({ type: 'dots', leaves: 10 });
        shown = spec.sections.length - 1;
        save();
        return render();
      case 'pdf':
        return makePdf();
      case 'share':
        if (pdf) shareOrDownload([pdf.file], 'Miolo A5').catch(() => {});
        return;
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-type]')) {
      spec.sections[+t.dataset.type].type = t.value;
      shown = +t.dataset.type;
      save();
      return render();
    }
    if (t.matches('[data-opt]')) {
      spec[t.dataset.opt] = t.checked;
      save();
      return render();
    }
    if (t.matches('[data-line-input]')) {
      spec.color = t.value;
      save();
      return render();
    }
  });

  render();
  return () => {
    alive = false;
    if (pdf) URL.revokeObjectURL(pdf.url);
  };
}

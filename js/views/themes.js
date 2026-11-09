// Tela "Temas e kits": guardar temas (cores, letras, estampa e artes) e gerar o kit inteiro
// de uma vez, com o nome da cliente, direto na folha e numa pasta do fichário.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { FORMATS, formatInfo } from '../card.js';
import { renderThumb, PATTERNS } from '../render.js';
import { FONTS, cssFont, loadFonts, ensureFonts } from '../fonts.js';
import { importImageFile, blobToImage, releaseImage } from '../image.js';
import { listStickers, stickerUrls, revokeUrls } from '../library.js';
import { listThemes, saveTheme, deleteTheme, newTheme, kitDesign, makeKit, KIT_PRODUCTS } from '../themes.js';

export const title = 'Temas e kits';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// a fonte vai dentro de style="…": as aspas duplas do nome da fonte viram simples
const fontCss = (id, px) => cssFont(id, px).replace(/"/g, "'");
const COLOR_NAMES = ['Principal', 'Destaque', 'Fundo', 'Texto', 'Extra'];

export async function mount(root) {
  let themes = [];
  let library = [];
  let current = null; // tema escolhido
  let draft = null; // tema sendo editado (cópia)
  let photo = null; // { blob, img, url }
  let artId = ''; // adesivo escolhido como arte do kit
  let alive = true;
  let previewTimer = 0;
  const qty = Object.fromEntries(KIT_PRODUCTS.map((p) => [p.format, p.copies]));

  root.innerHTML = `
  <section class="themes">
    <header class="themes__head">
      <h1 class="themes__title">Temas e kits</h1>
      <p class="themes__lead">Escolha um tema, escreva o nome da cliente e gere tudo de uma vez: bottons, marcadores e capa saem na mesma folha, com as mesmas cores e letras.</p>
    </header>
    <div class="themes__cols">
      <div class="themes__left">
        <div class="box">
          <div class="box__head">
            <h2 class="box__title">${icon('palette', { size: 22 })} Temas</h2>
            <button type="button" class="btn btn--soft btn--sm" data-act="new-theme">${icon('plus', { size: 18 })}Novo tema</button>
          </div>
          <div class="theme-grid" data-theme-list></div>
        </div>
        <div class="box" data-editor hidden></div>
      </div>

      <div class="themes__right">
        <div class="box">
          <h2 class="box__title">${icon('sparkle', { size: 22, fill: true })} Fazer kit <span class="chip" data-kit-theme></span></h2>
          <div class="kit-form">
            <label class="field">
              <span class="field__label">Nome (texto principal)</span>
              <input class="field__input" type="text" data-kit="title" placeholder="Ex.: Ana Clara" maxlength="40">
            </label>
            <label class="field">
              <span class="field__label">Texto menor (opcional)</span>
              <input class="field__input" type="text" data-kit="subtitle" placeholder="Ex.: 10 anos · 12/03" maxlength="40">
            </label>
            <div class="field">
              <span class="field__label">Foto (opcional)</span>
              <div class="kit-photo" data-photo-box></div>
            </div>
            <div class="field">
              <span class="field__label">Arte (um dos seus adesivos)</span>
              <div class="kit-art" data-art-list></div>
            </div>
            <div class="field">
              <span class="field__label">O que vai no kit (quantos de cada)</span>
              <ul class="kit-products" data-products></ul>
            </div>
            <label class="field">
              <span class="field__label">${icon('folder', { size: 18 })} Pasta no fichário</span>
              <input class="field__input" type="text" data-kit="folder" placeholder="Ex.: Pedido Ana Clara" maxlength="40">
            </label>
          </div>
          <p class="kit-preview__label">Prévia</p>
          <div class="kit-preview" data-preview></div>
          <button type="button" class="btn btn--primary btn--wide" data-act="make-kit">${icon('sparkle', { size: 22, fill: true })}<span data-make-label>Gerar kit e pôr na folha</span></button>
          <div class="kit-done" data-done hidden></div>
        </div>
      </div>
    </div>
    <input type="file" accept="image/*" hidden data-file>
  </section>`;

  const $ = (s) => root.querySelector(s);

  // ---------- temas ----------
  function swatchRow(t) {
    return `<span class="theme-card__sw">${t.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
  }

  function renderThemes() {
    $('[data-theme-list]').innerHTML = themes
      .map(
        (t) => `
      <button type="button" class="theme-card${current && t.id === current.id ? ' is-on' : ''}" data-theme="${esc(t.id)}" aria-pressed="${!!current && t.id === current.id}">
        ${swatchRow(t)}
        <span class="theme-card__name" style="font:${fontCss(t.fontTitle, 22)};color:${t.colors[0]}">${esc(t.name)}</span>
        <span class="theme-card__meta">${t.preset ? 'pronto' : 'meu tema'}${t.art && t.art.length ? ` · ${t.art.length} ${t.art.length === 1 ? 'arte' : 'artes'}` : ''}</span>
      </button>`
      )
      .join('');
    $('[data-kit-theme]').textContent = current ? current.name : '';
  }

  function renderEditor() {
    const box = $('[data-editor]');
    if (!draft) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <div class="box__head">
        <h2 class="box__title">${icon('edit', { size: 20 })} ${draft.preset ? 'Copiar tema' : draft.id ? 'Editar tema' : 'Novo tema'}</h2>
        <button type="button" class="round-btn" data-act="close-editor" aria-label="Fechar">${icon('close', { size: 18 })}</button>
      </div>
      ${draft.preset ? '<p class="hint">Este tema vem pronto. Ao salvar, vira um tema seu (o original continua aqui).</p>' : ''}
      <label class="field">
        <span class="field__label">Nome do tema</span>
        <input class="field__input" type="text" data-ed="name" value="${esc(draft.preset ? `${draft.name} (meu)` : draft.name)}" maxlength="30">
      </label>
      <div class="field">
        <span class="field__label">Cores</span>
        <div class="theme-colors">
          ${draft.colors
            .map(
              (c, i) => `<label class="theme-color"><input type="color" value="${c}" data-ed-color="${i}"><span>${COLOR_NAMES[i]}</span></label>`
            )
            .join('')}
        </div>
      </div>
      <div class="field">
        <span class="field__label">Letra dos títulos</span>
        <div class="chips">${FONTS.map((f) => `<button type="button" class="font-chip" style="font:${fontCss(f.id, 18)}" data-ed-font="title" data-font-id="${f.id}" aria-pressed="${draft.fontTitle === f.id}">${f.name}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="field__label">Letra dos textos</span>
        <div class="chips">${FONTS.map((f) => `<button type="button" class="font-chip" style="font:${fontCss(f.id, 18)}" data-ed-font="text" data-font-id="${f.id}" aria-pressed="${draft.fontText === f.id}">${f.name}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="field__label">Estampa do fundo</span>
        <div class="chips">${PATTERNS.map((p) => `<button type="button" class="font-chip font-chip--sm" data-ed-pattern="${p.id}" aria-pressed="${(draft.pattern || 'none') === p.id}">${p.name}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="field__label">Artes do tema (dos seus adesivos)</span>
        ${
          library.length
            ? `<div class="kit-art">${library
                .map((s) => `<button type="button" class="art-pick" data-ed-art="${s.id}" aria-pressed="${draft.art.includes(s.id)}"><img src="${s.url}" alt=""></button>`)
                .join('')}</div>`
            : `<p class="hint">Você ainda não tem adesivos. Crie em <a href="#/adesivos">Meus adesivos</a> (personagens, logos, flores…) e eles aparecem aqui.</p>`
        }
      </div>
      <div class="actions">
        <button type="button" class="btn btn--primary" data-act="save-theme">${icon('check', { size: 20 })}Salvar tema</button>
        ${draft.id && !draft.preset ? `<button type="button" class="btn btn--soft" data-act="delete-theme">${icon('trash', { size: 20 })}Apagar</button>` : ''}
      </div>`;
  }

  // ---------- kit ----------
  function artChoices() {
    const ids = current && current.art && current.art.length ? current.art : null;
    const list = ids ? library.filter((s) => ids.includes(s.id)) : library;
    return list;
  }

  function renderArt() {
    const list = artChoices();
    if (artId && !library.some((s) => s.id === artId)) artId = '';
    $('[data-art-list]').innerHTML = list.length
      ? `<button type="button" class="art-pick art-pick--none" data-art="" aria-pressed="${!artId}">Sem arte</button>` +
        list.map((s) => `<button type="button" class="art-pick" data-art="${s.id}" aria-pressed="${artId === s.id}"><img src="${s.url}" alt=""></button>`).join('')
      : `<p class="hint">Sem artes ainda: crie em <a href="#/adesivos">Meus adesivos</a>.</p>`;
  }

  function renderPhoto() {
    $('[data-photo-box]').innerHTML = photo
      ? `<img class="kit-photo__img" src="${photo.url}" alt=""><button type="button" class="link-btn" data-act="pick-photo">${icon('photo', { size: 18 })}Trocar</button><button type="button" class="link-btn" data-act="clear-photo">${icon('trash', { size: 18 })}Tirar</button>`
      : `<button type="button" class="btn btn--soft btn--sm" data-act="pick-photo">${icon('photo', { size: 20 })}Escolher foto</button><span class="hint">A foto vai nos bottons, no photo card e na capa.</span>`;
  }

  function renderProducts() {
    $('[data-products]').innerHTML = KIT_PRODUCTS.map((p) => {
      const f = formatInfo(p.format);
      const n = qty[p.format];
      return `<li class="kit-product${n ? ' is-on' : ''}">
        <span class="kit-product__name">${esc(f.name)}</span>
        <div class="stepper" role="group" aria-label="${esc(f.name)}">
          <button type="button" class="round-btn" data-qty="-1" data-f="${p.format}" aria-label="Menos" ${n <= 0 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
          <output>${n}</output>
          <button type="button" class="round-btn" data-qty="1" data-f="${p.format}" aria-label="Mais" ${n >= 99 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
        </div>
      </li>`;
    }).join('');
  }

  function input() {
    const title = $('[data-kit="title"]').value;
    return {
      title,
      subtitle: $('[data-kit="subtitle"]').value,
      folderName: ($('[data-kit="folder"]').value || '').trim(),
    };
  }

  // Prévia de cada produto do kit (pequena, desenhada aqui mesmo).
  async function renderPreview() {
    if (!current) return;
    const wrap = $('[data-preview]');
    const inp = input();
    const art = artId ? library.find((s) => s.id === artId) : null;
    let artImg = null;
    try {
      artImg = art ? await blobToImage(art.blob) : null;
    } catch (_) {}
    const imgs = new Map();
    if (photo) imgs.set('kp', photo.img);
    if (artImg) imgs.set('ka', artImg);
    const list = KIT_PRODUCTS.filter((p) => qty[p.format] > 0);
    const designs = list.map((p) =>
      kitDesign(p.format, current, { title: inp.title, subtitle: inp.subtitle, photo: photo ? { key: 'kp', img: photo.img } : null, art: artImg ? { key: 'ka', img: artImg } : null })
    );
    await ensureFonts(designs);
    if (!alive) return;
    wrap.innerHTML = '';
    if (!list.length) wrap.innerHTML = '<p class="hint">Escolha pelo menos um produto.</p>';
    designs.forEach((d, i) => {
      const f = formatInfo(d.format);
      const c = renderThumb(d, 'front', (k) => imgs.get(k) || null, 220);
      c.className = 'kit-preview__img' + (f.circle ? ' is-circle' : '');
      const fig = document.createElement('figure');
      fig.className = 'kit-preview__item';
      fig.appendChild(c);
      const cap = document.createElement('figcaption');
      cap.textContent = `${f.short} × ${qty[list[i].format]}`;
      fig.appendChild(cap);
      wrap.appendChild(fig);
    });
    if (artImg) releaseImage(artImg);
    $('[data-act="make-kit"]').disabled = !list.length;
  }

  function previewSoon() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 250);
  }

  function choose(id) {
    current = themes.find((t) => t.id === id) || themes[0] || null;
    renderThemes();
    renderArt();
    previewSoon();
  }

  async function loadAll() {
    themes = await listThemes();
    const fresh = stickerUrls(await listStickers());
    revokeUrls(library);
    library = fresh;
  }

  async function generate() {
    if (!current) return;
    const items = KIT_PRODUCTS.filter((p) => qty[p.format] > 0).map((p) => ({ format: p.format, copies: qty[p.format] }));
    if (!items.length) return;
    const btn = $('[data-act="make-kit"]');
    const label = $('[data-make-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    const inp = input();
    const art = artId ? library.find((s) => s.id === artId) : null;
    try {
      const recs = await makeKit(current, items, { ...inp, photoBlob: photo && photo.blob, artBlob: art && art.blob }, (n) => (label.textContent = `Montando… ${n} de ${items.length}`));
      if (!alive) return;
      const total = recs.reduce((n, r) => n + r.copies, 0);
      const done = $('[data-done]');
      done.hidden = false;
      done.innerHTML = `
        <p class="kit-done__title">${icon('heart', { size: 18, fill: true })} Kit pronto: ${total} ${total === 1 ? 'peça' : 'peças'} na folha${inp.folderName ? ` e na pasta “${esc(inp.folderName)}”` : ''}.</p>
        <div class="kit-done__links">
          <a class="btn btn--primary" href="#/photo-cards">${icon('printer', { size: 20 })}Ver a folha</a>
          ${recs.map((r) => `<a class="btn btn--soft btn--sm" href="#/photo-cards?edit=${r.id}">${icon('edit', { size: 18 })}${esc(formatInfo(r.design.format).short)}</a>`).join('')}
        </div>
        <p class="hint">Toque num item para ajustar no editor (mudar a posição do nome, trocar a foto…).</p>`;
      done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast('Kit pronto e na folha!');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não consegui gerar o kit.', { kind: 'error' });
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      label.textContent = 'Gerar kit e pôr na folha';
    }
  }

  // ---------- eventos ----------
  const fileInput = $('[data-file]');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const { blob, img } = await importImageFile(f);
      if (photo) {
        URL.revokeObjectURL(photo.url);
        releaseImage(photo.img);
      }
      photo = { blob, img, url: URL.createObjectURL(blob) };
      renderPhoto();
      previewSoon();
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa foto.', { kind: 'error' });
    }
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t) || t.disabled) return;
    const ds = t.dataset;
    if (ds.theme) {
      choose(ds.theme);
      draft = null;
      renderEditor();
      // tema pronto ou meu: dá para editar com dois toques
      return;
    }
    if (ds.qty) {
      qty[ds.f] = Math.max(0, Math.min(99, qty[ds.f] + +ds.qty));
      renderProducts();
      return previewSoon();
    }
    if (ds.art != null && !ds.edArt) {
      artId = ds.art;
      renderArt();
      return previewSoon();
    }
    if (ds.edFont && draft) {
      if (ds.edFont === 'title') draft.fontTitle = ds.fontId;
      else draft.fontText = ds.fontId;
      return renderEditor();
    }
    if (ds.edPattern && draft) {
      draft.pattern = ds.edPattern;
      return renderEditor();
    }
    if (ds.edArt && draft) {
      draft.art = draft.art.includes(ds.edArt) ? draft.art.filter((x) => x !== ds.edArt) : [...draft.art, ds.edArt];
      return renderEditor();
    }
    switch (ds.act) {
      case 'new-theme':
        draft = newTheme();
        renderEditor();
        $('[data-editor]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      case 'edit-theme':
        if (!current) return;
        draft = JSON.parse(JSON.stringify(current));
        draft.art = draft.art || [];
        return renderEditor();
      case 'close-editor':
        draft = null;
        return renderEditor();
      case 'save-theme': {
        if (!draft) return;
        draft.name = ($('[data-ed="name"]').value || '').trim() || 'Meu tema';
        const saved = await saveTheme(draft);
        draft = null;
        await loadAll();
        choose(saved.id);
        renderEditor();
        toast('Tema salvo!');
        return;
      }
      case 'delete-theme': {
        if (!draft || !draft.id) return;
        await deleteTheme(draft.id);
        draft = null;
        await loadAll();
        choose(themes[0] && themes[0].id);
        renderEditor();
        toast('Tema apagado.');
        return;
      }
      case 'pick-photo':
        return fileInput.click();
      case 'clear-photo':
        if (photo) {
          URL.revokeObjectURL(photo.url);
          releaseImage(photo.img);
        }
        photo = null;
        renderPhoto();
        return previewSoon();
      case 'make-kit':
        return generate();
    }
  });

  root.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-theme]')) {
      draft = JSON.parse(JSON.stringify(current));
      draft.art = draft.art || [];
      renderEditor();
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-ed-color]') && draft) {
      draft.colors[+t.dataset.edColor] = t.value;
      return;
    }
    if (t.matches('[data-kit="title"]')) {
      const folder = $('[data-kit="folder"]');
      if (!folder.dataset.touched) folder.value = t.value.trim() ? `Kit ${t.value.trim()}` : '';
    }
    if (t.matches('[data-kit="folder"]')) t.dataset.touched = '1';
    if (t.matches('[data-kit]')) previewSoon();
  });

  // ---------- início ----------
  await loadAll();
  await loadFonts(FONTS.map((f) => f.id));
  if (!alive) return () => {};
  current = themes[0] || null;
  renderThemes();
  renderEditor();
  renderPhoto();
  renderArt();
  renderProducts();
  // botão para editar o tema escolhido, logo abaixo da lista
  $('[data-theme-list]').insertAdjacentHTML('afterend', `<button type="button" class="link-btn themes__edit" data-act="edit-theme">${icon('edit', { size: 18 })}Editar o tema escolhido (ou fazer uma cópia)</button>`);
  previewSoon();

  return () => {
    alive = false;
    clearTimeout(previewTimer);
    revokeUrls(library);
    if (photo) {
      URL.revokeObjectURL(photo.url);
      releaseImage(photo.img);
    }
  };
}

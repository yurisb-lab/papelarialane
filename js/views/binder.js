// Meu fichário: todos os cards guardados, como um fichário de colecionar photo cards.
// Dá para marcar favoritos, separar em pastas, pôr ou tirar da folha, salvar a imagem, duplicar e apagar.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { db, newId } from '../db.js';
import { formatInfo, sideHasContent } from '../card.js';
import { allRecords, isStickerRec, onSheet, plain, duplicateRecord, loadImageMap, releaseMap, getFolders, setFolders } from '../records.js';
import { designFiles, shareOrDownload } from '../export.js';
import { openModal } from '../modal.js';
import { openShareToGroup } from '../share.js';
import { cloudEnabled as groupsEnabled } from '../group.js';

export const title = 'Meu fichário';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function mount(root) {
  root.innerHTML = `
  <section class="binder">
    <div class="lib__hello">
      <h1 class="lib__title">Meu fichário</h1>
      <p class="lib__sub">Tudo o que você já fez fica guardado aqui, mesmo depois de sair da folha. Marque os favoritos com estrela e separe em pastas.</p>
    </div>
    <div class="binder__bar">
      <div class="chips binder__filters" role="group" aria-label="Mostrar" data-filters></div>
      <a class="btn btn--primary btn--sm" href="#/photo-cards">${icon('plus', { size: 20 })}Fazer um novo</a>
    </div>
    <div class="binder__folderbar" data-folderbar hidden></div>
    <div class="binder__book" data-book></div>
  </section>`;
  const $ = (sel) => root.querySelector(sel);
  let alive = true;
  let items = [];
  let folders = [];
  let filter = 'all';

  async function load() {
    const list = (await allRecords()).filter((r) => !isStickerRec(r));
    items.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
    items = list.sort((a, b) => b.createdAt - a.createdAt).map((c) => ({ ...c, thumbUrl: c.thumbBlob ? URL.createObjectURL(c.thumbBlob) : '' }));
    folders = await getFolders();
    if (filter.startsWith('f:') && !folders.some((f) => 'f:' + f.id === filter)) filter = 'all';
    if (alive) render();
  }

  function shown() {
    if (filter === 'fav') return items.filter((c) => c.fav);
    if (filter === 'sheet') return items.filter(onSheet);
    if (filter.startsWith('f:')) return items.filter((c) => c.folder === filter.slice(2));
    return items;
  }

  function chip(id, label, n) {
    return `<button type="button" class="font-chip font-chip--sm" data-filter="${id}" aria-pressed="${filter === id}">${label}${n != null ? ` <span class="chip-n">${n}</span>` : ''}</button>`;
  }

  function render() {
    $('[data-filters]').innerHTML = [
      chip('all', 'Todos', items.length),
      chip('fav', `${icon('starOn', { size: 16 })} Favoritos`, items.filter((c) => c.fav).length),
      chip('sheet', 'Na folha', items.filter(onSheet).length),
      ...folders.map((f) => chip('f:' + f.id, `${icon('folder', { size: 16 })} ${esc(f.name)}`, items.filter((c) => c.folder === f.id).length)),
      `<button type="button" class="font-chip font-chip--sm font-chip--add" data-act="new-folder">${icon('plus', { size: 16 })} Nova pasta</button>`,
    ].join('');

    const bar = $('[data-folderbar]');
    const folder = filter.startsWith('f:') ? folders.find((f) => f.id === filter.slice(2)) : null;
    bar.hidden = !folder;
    if (folder) {
      bar.innerHTML = `<span>${icon('folder', { size: 20 })}<strong></strong></span>
        <button type="button" class="link-btn" data-act="rename-folder">${icon('edit', { size: 18 })}Renomear</button>
        <button type="button" class="link-btn" data-act="delete-folder">${icon('trash', { size: 18 })}Apagar pasta</button>`;
      bar.querySelector('strong').textContent = folder.name;
    }

    const list = shown();
    const book = $('[data-book]');
    if (!items.length) {
      book.innerHTML = `<p class="card-list__empty">Seu fichário ainda está vazio. Tudo o que você colocar na folha também fica guardado aqui.</p>`;
      return;
    }
    if (!list.length) {
      book.innerHTML = `<p class="card-list__empty">${filter === 'fav' ? 'Nenhum favorito ainda. Toque na estrela de um card.' : filter === 'sheet' ? 'Nada na folha agora.' : 'Esta pasta está vazia. Abra um card e escolha esta pasta.'}</p>`;
      return;
    }
    // páginas de 9 bolsinhos, como um fichário de verdade
    const pages = [];
    for (let i = 0; i < list.length; i += 9) pages.push(list.slice(i, i + 9));
    book.innerHTML = pages
      .map(
        (pg) => `
      <div class="binder__page">
        ${pg
          .map((c) => {
            const f = formatInfo(c.design.format);
            return `
          <div class="pocket">
            <button type="button" class="pocket__card" data-open="${c.id}" aria-label="Abrir ${f.short.toLowerCase()}">
              <img src="${c.thumbUrl}" alt="" draggable="false" loading="lazy">
            </button>
            <button type="button" class="pocket__star" data-fav="${c.id}" aria-pressed="${!!c.fav}" aria-label="${c.fav ? 'Tirar dos favoritos' : 'Favorito'}">${icon(c.fav ? 'starOn' : 'star', { size: 20 })}</button>
            <span class="pocket__tags">${f.id !== 'card' ? `<span class="tag">${f.short}</span>` : ''}${onSheet(c) ? '<span class="tag tag--sheet">na folha</span>' : ''}</span>
          </div>`;
          })
          .join('')}
      </div>`
      )
      .join('');
  }

  async function save(rec) {
    await db.putCard(plain(rec));
  }

  function askName(title, value, onOk) {
    openModal({
      title,
      html: `<label class="field"><span class="field__label">Nome da pasta</span><input type="text" class="field__input" maxlength="30" data-name value="${esc(value || '')}"></label>
        <button type="button" class="btn btn--primary btn--wide" data-ok>${icon('check', { size: 22 })}Pronto</button>`,
      onMount(body, close) {
        const input = body.querySelector('[data-name]');
        setTimeout(() => input.focus(), 50);
        const ok = () => {
          const name = input.value.trim();
          if (!name) return input.focus();
          close();
          onOk(name);
        };
        body.querySelector('[data-ok]').addEventListener('click', ok);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') ok();
        });
      },
    });
  }

  function openCard(id) {
    const c = items.find((x) => x.id === id);
    if (!c) return;
    const f = formatInfo(c.design.format);
    const back = sideHasContent(c.design.back);
    openModal({
      title: f.name,
      className: 'modal__box--card',
      html: `
        <div class="card-view">
          <div class="card-view__img"><img src="${c.thumbUrl}" alt="" draggable="false"></div>
          <div class="card-view__acts">
            <a class="btn btn--primary" href="#/photo-cards?edit=${encodeURIComponent(c.id)}">${icon('edit', { size: 22 })}Abrir e editar</a>
            <button type="button" class="btn btn--soft" data-do="sheet">${icon(onSheet(c) ? 'trash' : 'printer', { size: 20 })}${onSheet(c) ? 'Tirar da folha' : 'Pôr na folha'}</button>
            <button type="button" class="btn btn--soft" data-do="image">${icon('download', { size: 20 })}${back ? 'Salvar imagens' : 'Salvar imagem'}</button>
            ${groupsEnabled ? `<button type="button" class="btn btn--soft" data-do="group">${icon('users', { size: 20 })}Mostrar pra turma</button>` : ''}
            <button type="button" class="btn btn--soft" data-do="dup">${icon('copy', { size: 20 })}Duplicar</button>
            <label class="field">
              <span class="field__label">${icon('folder', { size: 18 })} Pasta</span>
              <select class="field__input" data-folder>
                <option value="">Sem pasta</option>
                ${folders.map((fo) => `<option value="${fo.id}" ${c.folder === fo.id ? 'selected' : ''}>${esc(fo.name)}</option>`).join('')}
              </select>
            </label>
            <button type="button" class="link-btn link-btn--danger" data-do="delete">${icon('trash', { size: 18 })}Apagar de vez</button>
          </div>
        </div>`,
      onMount(body, close) {
        body.querySelector('[data-folder]').addEventListener('change', async (e) => {
          c.folder = e.target.value || null;
          await save(c);
          render();
          toast(c.folder ? 'Guardado na pasta!' : 'Tirado da pasta.');
        });
        body.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-do]');
          if (!b || b.disabled) return;
          const what = b.dataset.do;
          if (what === 'sheet') {
            c.inSheet = !onSheet(c);
            await save(c);
            close();
            render();
            toast(c.inSheet ? 'Está na folha para imprimir!' : 'Tirado da folha (continua aqui no fichário).');
          } else if (what === 'dup') {
            await duplicateRecord(c);
            close();
            await load();
            toast('Cópia feita e colocada na folha!');
          } else if (what === 'group') {
            b.disabled = true;
            b.classList.add('is-busy');
            const m = await loadImageMap(c.images);
            close();
            await openShareToGroup({ design: c.design, getImg: (k) => m.get(k) || null, cardId: c.id, onDone: () => releaseMap(m) });
          } else if (what === 'image') {
            b.disabled = true;
            b.classList.add('is-busy');
            const m = await loadImageMap(c.images);
            try {
              const files = await designFiles(c.design, (k) => m.get(k) || null);
              const r = await shareOrDownload(files);
              if (r === 'downloaded') toast(files.length > 1 ? 'Imagens salvas!' : 'Imagem salva!');
            } catch (err) {
              console.error(err);
              toast('Não consegui salvar a imagem.', { kind: 'error' });
            } finally {
              releaseMap(m);
              b.disabled = false;
              b.classList.remove('is-busy');
            }
          } else if (what === 'delete') {
            if (!b.dataset.sure) {
              b.dataset.sure = '1';
              b.lastChild.textContent = 'Toque de novo para apagar';
              return;
            }
            const rec = plain(c);
            await db.deleteCard(c.id);
            close();
            await load();
            toast('Apagado.', {
              action: 'Desfazer',
              duration: 6000,
              onAction: async () => {
                await db.putCard(rec);
                load();
              },
            });
          }
        });
      },
    });
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    const ds = t.dataset;
    if (ds.filter) {
      filter = ds.filter;
      return render();
    }
    if (ds.open) return openCard(ds.open);
    if (ds.fav) {
      const c = items.find((x) => x.id === ds.fav);
      if (!c) return;
      c.fav = !c.fav;
      await save(c);
      return render();
    }
    if (ds.act === 'new-folder') {
      return askName('Nova pasta', '', async (name) => {
        const f = { id: newId(), name };
        folders.push(f);
        await setFolders(folders);
        filter = 'f:' + f.id;
        render();
        toast('Pasta criada! Abra um card e escolha esta pasta.');
      });
    }
    const folder = filter.startsWith('f:') ? folders.find((f) => f.id === filter.slice(2)) : null;
    if (ds.act === 'rename-folder' && folder) {
      return askName('Renomear pasta', folder.name, async (name) => {
        folder.name = name;
        await setFolders(folders);
        render();
      });
    }
    if (ds.act === 'delete-folder' && folder) {
      const before = folders.slice();
      const moved = items.filter((c) => c.folder === folder.id);
      folders = folders.filter((f) => f !== folder);
      await setFolders(folders);
      for (const c of moved) {
        c.folder = null;
        await save(c);
      }
      filter = 'all';
      render();
      toast('Pasta apagada. Os cards continuam no fichário.', {
        action: 'Desfazer',
        duration: 6000,
        onAction: async () => {
          await setFolders(before);
          for (const c of moved) {
            c.folder = folder.id;
            await save(c);
          }
          load();
        },
      });
    }
  });

  await load();
  return () => {
    alive = false;
    items.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
  };
}

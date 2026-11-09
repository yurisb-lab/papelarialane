// "Mostrar pra turma": janelinha usada no editor e no fichário para postar um card no feed.

import { icon } from './icons.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { renderThumb } from './render.js';
import { ensureFonts } from './fonts.js';
import { myGroups, publishPost, modelOf, errorText, POST_DAYS } from './group.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// design: o card; getImg: chave -> imagem; cardId: id do card no aparelho (opcional).
// onDone é chamado depois de fechar (para soltar as fotos, por exemplo).
export async function openShareToGroup({ design, getImg, cardId = null, onDone }) {
  let groups;
  try {
    groups = (await myGroups()).filter((g) => g.me.status === 'active');
  } catch (err) {
    toast(errorText(err), { kind: 'error' });
    onDone && onDone();
    return;
  }

  if (!groups.length) {
    openModal({
      title: 'Mostrar pra turma',
      html: `<p class="modal__text">Você ainda não está numa turma. Crie uma ou entre com o link de convite que alguém mandou.</p>
        <a class="btn btn--primary btn--wide" href="#/turma">${icon('users', { size: 22 })}Ir para Minha turma</a>`,
    });
    onDone && onDone();
    return;
  }

  await ensureFonts(design);
  const preview = renderThumb(design, 'front', getImg, 420).toDataURL('image/png');
  const hasModel = !!modelOf(design);
  let groupId = groups[0].id;

  const modal = openModal({
    title: 'Mostrar pra turma',
    className: 'modal__box--card',
    html: `
      <div class="card-view">
        <div class="card-view__img"><img src="${preview}" alt="" draggable="false"></div>
        <div class="card-view__acts">
          ${
            groups.length > 1
              ? `<div class="field"><span class="field__label">Para qual turma?</span><div class="chips" data-groups>${groups
                  .map((g, i) => `<button type="button" class="font-chip font-chip--sm" data-g="${g.id}" aria-pressed="${i === 0}">${esc(g.name)}</button>`)
                  .join('')}</div></div>`
              : `<p class="modal__text">Vai aparecer para a turma <strong>${esc(groups[0].name)}</strong>.</p>`
          }
          <label class="check">
            <input type="checkbox" data-copy ${hasModel ? 'checked' : 'disabled'}>
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Deixar as amigas fazerem um igual (vai só o modelo, sem as suas fotos)
          </label>
          <label class="check">
            <input type="checkbox" data-trade>
            <span class="check__box">${icon('check', { size: 16 })}</span>
            Tenho pra trocar (já imprimi e troco com quem quiser)
          </label>
          <p class="print-tip">Vai só a imagem pronta do card. Ele some da turma em ${POST_DAYS} dias. Só quem está na turma vê.</p>
          <button type="button" class="btn btn--primary" data-post>${icon('users', { size: 22 })}<span>Mostrar pra turma</span></button>
        </div>
      </div>`,
    onMount(body, close) {
      const gs = body.querySelector('[data-groups]');
      if (gs) {
        gs.addEventListener('click', (e) => {
          const b = e.target.closest('[data-g]');
          if (!b) return;
          groupId = b.dataset.g;
          gs.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        });
      }
      const btn = body.querySelector('[data-post]');
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('is-busy');
        btn.lastChild.textContent = 'Enviando…';
        const g = groups.find((x) => x.id === groupId);
        try {
          await publishPost({
            groupId,
            memberId: g.me.id,
            design,
            getImg,
            cardId,
            canCopy: body.querySelector('[data-copy]').checked,
            forTrade: body.querySelector('[data-trade]').checked,
          });
          close();
          toast('Está na turma!', { action: 'Ver', onAction: () => (location.hash = `#/turma?g=${groupId}`) });
        } catch (err) {
          console.error(err);
          toast(errorText(err), { kind: 'error' });
          btn.disabled = false;
          btn.classList.remove('is-busy');
          btn.lastChild.textContent = 'Mostrar pra turma';
        }
      });
    },
  });

  // Solta as fotos quando a janelinha some.
  if (onDone) {
    const obs = new MutationObserver(() => {
      if (!modal.el.isConnected) {
        obs.disconnect();
        onDone();
      }
    });
    obs.observe(document.body, { childList: true });
  }
}

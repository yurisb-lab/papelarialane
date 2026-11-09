// Janelinha por cima da tela (série de cards, ações do fichário…).

import { icon } from './icons.js';

let open = null;

export function openModal({ title, html, onMount, className = '' }) {
  if (open) open.close();
  const before = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal';
  const id = 'm' + Math.random().toString(36).slice(2, 8);
  el.innerHTML = `
    <div class="modal__box ${className}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="modal__head">
        <h2 class="modal__title" id="${id}"></h2>
        <button type="button" class="round-btn" data-modal-close aria-label="Fechar">${icon('close', { size: 20 })}</button>
      </div>
      <div class="modal__body">${html}</div>
    </div>`;
  el.querySelector('.modal__title').textContent = title;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  function close() {
    if (!el.isConnected) return;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 200);
    if (open && open.el === el) open = null;
    if (before && before.focus) before.focus({ preventScroll: true });
  }
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-modal-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close); // mudou de tela: fecha
  const api = { el, close };
  open = api;
  if (onMount) onMount(el.querySelector('.modal__body'), close);
  const first = el.querySelector('.modal__body button, .modal__body input, .modal__body select, .modal__body a');
  (first || el.querySelector('[data-modal-close]')).focus({ preventScroll: true });
  return api;
}

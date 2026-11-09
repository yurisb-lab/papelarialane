// Avisos rápidos no rodapé da tela, com botão opcional (ex.: "Desfazer").

import { icon } from './icons.js';

let host = null;

export function toast(message, { action, onAction, kind = 'ok', duration = 3800 } = {}) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast__icon">${icon(kind === 'error' ? 'close' : 'heart', { size: 18, fill: kind !== 'error' })}</span><span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = message;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = action;
    btn.addEventListener('click', () => {
      onAction && onAction();
      close();
    });
    el.appendChild(btn);
  }
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const timer = setTimeout(close, duration);
  function close() {
    clearTimeout(timer);
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  }
  return close;
}

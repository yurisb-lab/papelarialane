// Central de Criação Elane: navegação entre telas.
// Para criar uma tela nova: crie js/views/minha-tela.js com mount(el) e registre em ROUTES.

import { askPersistentStorage } from './db.js';
import * as home from './views/home.js';
import * as photocards from './views/photocards.js';
import * as stickers from './views/stickers.js';
import * as binder from './views/binder.js';
import * as themes from './views/themes.js';
import * as notebooks from './views/notebooks.js';

const ROUTES = {
  '': home,
  'photo-cards': photocards,
  adesivos: stickers,
  fichario: binder,
  temas: themes,
  cadernos: notebooks,
};

const viewEl = document.getElementById('view');
let unmount = null;
let seq = 0; // cada troca de tela ganha um número; uma tela que termina de abrir atrasada é fechada

function currentRoute() {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}

async function render() {
  const my = ++seq;
  const name = currentRoute();
  const view = ROUTES[name] || home;
  if (unmount) {
    try {
      unmount();
    } catch (_) {}
    unmount = null;
  }
  document.body.dataset.route = name || 'home';
  // Cada tela ganha uma caixa nova: os cliques que ela escuta somem junto com ela.
  viewEl.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'view__host';
  viewEl.appendChild(host);
  viewEl.scrollTop = 0;
  window.scrollTo(0, 0);
  const done = (await view.mount(host)) || null;
  if (my !== seq) {
    // enquanto abria, já foi para outra tela
    try {
      done && done();
    } catch (_) {}
    return;
  }
  unmount = done;
  const title = view.title ? `${view.title} · Central Elane` : 'Central de Criação Elane';
  document.title = title;
}

window.addEventListener('hashchange', render);
render();
askPersistentStorage();

// Funciona sem internet e pode ser instalado na tela inicial do tablet.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

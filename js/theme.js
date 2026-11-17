// Tema de cores do aplicativo: o mesmo seletor nos apps da Elane, da Lavínia e do Kalel.
// As cores de cada tema ficam em css/themes.css; aqui fica a lista que aparece no seletor.
// Cada app diz no <html> qual é o tema padrão (data-theme-default) e onde guardar a escolha (data-theme-key).

export const THEMES = [
  { id: 'atelie', name: 'Ateliê', note: 'terracota e sálvia', meta: '#f7f2eb', swatch: ['#f7f2eb', '#a5492b', '#c9785a', '#3b6551'] },
  { id: 'rosa', name: 'Rosa', note: 'framboesa e lilás', meta: '#ffe3ef', swatch: ['#fff6ef', '#c92f6c', '#ff7aa8', '#5b3f9e'] },
  { id: 'azul', name: 'Azul', note: 'azul e laranja', meta: '#e3f0ff', swatch: ['#f2f7ff', '#2a6bb8', '#7ab8ff', '#c2410c'] },
  { id: 'lilas', name: 'Lilás', note: 'violeta e menta', meta: '#eee8ff', swatch: ['#f8f5ff', '#6d3fc0', '#a98bff', '#1f7a5c'] },
  { id: 'menta', name: 'Menta', note: 'verde e amarelo', meta: '#def3eb', swatch: ['#f2fbf6', '#1f7a5c', '#5cc49a', '#a15c07'] },
  { id: 'coral', name: 'Coral', note: 'laranja e rosa', meta: '#ffebde', swatch: ['#fff7f0', '#c2410c', '#ff9a5c', '#be185d'] },
];

const root = document.documentElement;
const KEY = root.dataset.themeKey || 'tema';
const byId = (id) => THEMES.find((t) => t.id === id);
const DEFAULT = byId(root.dataset.themeDefault) ? root.dataset.themeDefault : THEMES[0].id;

export function currentTheme() {
  return byId(root.dataset.theme) ? root.dataset.theme : DEFAULT;
}

export function applyTheme(id, { save = true } = {}) {
  const theme = byId(id) || byId(DEFAULT);
  root.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.meta);
  if (save) {
    try {
      if (theme.id === DEFAULT) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme.id);
    } catch (_) {}
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function popMarkup() {
  const cur = currentTheme();
  const opts = THEMES.map((t) => {
    const [paper, berry, pink, alt] = t.swatch;
    const note = t.id === DEFAULT ? `${t.note} · padrão` : t.note;
    return `
      <label class="theme-opt${t.id === cur ? ' is-on' : ''}">
        <input type="radio" name="app-theme" value="${t.id}"${t.id === cur ? ' checked' : ''}>
        <span class="theme-dot" aria-hidden="true" style="--sw-paper:${paper};--sw-berry:${berry};--sw-pink:${pink};--sw-alt:${alt}"></span>
        <span class="theme-opt__text">
          <span class="theme-opt__name">${esc(t.name)}</span>
          <span class="theme-opt__note">${esc(note)}</span>
        </span>
      </label>`;
  }).join('');
  return `
    <h2 class="theme-pop__title" id="theme-pop-title">Cores do aplicativo</h2>
    <p class="theme-pop__hint">Escolha um tema. A troca aparece na hora e fica guardada neste aparelho.</p>
    <fieldset class="theme-pop__list">
      <legend class="visually-hidden">Tema de cores</legend>
      ${opts}
    </fieldset>`;
}

// Liga o botão Cores do topo: abre a caixinha com os temas e troca as cores na hora.
export function initThemePicker() {
  applyTheme(currentTheme(), { save: false });
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  let pop = null;

  function close({ focus = false } = {}) {
    if (!pop) return;
    pop.remove();
    pop = null;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey);
    if (focus) btn.focus();
  }

  function onOutside(e) {
    if (pop && !pop.contains(e.target) && !btn.contains(e.target)) close();
  }

  function onKey(e) {
    if (e.key === 'Escape') close({ focus: true });
  }

  function open() {
    pop = document.createElement('div');
    pop.className = 'theme-pop';
    pop.id = 'theme-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-labelledby', 'theme-pop-title');
    pop.innerHTML = popMarkup();
    btn.after(pop);
    btn.setAttribute('aria-expanded', 'true');
    pop.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="app-theme"]');
      if (!input) return;
      applyTheme(input.value);
      pop.querySelectorAll('.theme-opt').forEach((l) => l.classList.toggle('is-on', l.contains(input)));
    });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey);
    const checked = pop.querySelector('input:checked');
    if (checked) checked.focus({ preventScroll: true });
  }

  btn.addEventListener('click', () => (pop ? close() : open()));
  window.addEventListener('hashchange', () => close());
}

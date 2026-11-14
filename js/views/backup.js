// Tela "Cópia de segurança": guarda tudo num arquivo .zip e traz de volta
// (no mesmo aparelho ou num tablet novo). Mostra também se o navegador pode apagar os dados sozinho.

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { openModal } from '../modal.js';
import { canShareFiles } from '../export.js';
import { fmtSize } from '../pdftools.js';
import { countLocal, lastBackup, dateText, makeBackup, markBackupDone, readBackup, restoreBackup } from '../backup.js';

export const title = 'Cópia de segurança';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function countsText(c) {
  const parts = [];
  if (c.creations) parts.push(plural(c.creations, 'criação', 'criações'));
  if (c.stickers) parts.push(plural(c.stickers, 'adesivo', 'adesivos'));
  if (c.themes) parts.push(plural(c.themes, 'tema', 'temas'));
  if (c.folders) parts.push(plural(c.folders, 'pasta', 'pastas'));
  return parts.length ? parts.join(', ') : 'nada ainda';
}

export async function mount(root) {
  root.innerHTML = `
  <section class="backup">
    <header class="themes__head">
      <h1 class="themes__title">Cópia de segurança</h1>
      <p class="themes__lead">Suas criações, adesivos e temas ficam guardados neste aparelho. Se o navegador apagar os dados ou você trocar de tablet, eles se perdem. De vez em quando, guarde um arquivo com tudo no Arquivos, no Google Drive ou no computador. Para ter tudo de volta, é só abrir esse arquivo aqui.</p>
    </header>
    <div class="themes__cols">
      <div class="themes__left">
        <div class="box">
          <h2 class="box__title">${icon('download', { size: 22 })} Guardar uma cópia</h2>
          <p class="backup__now" data-now>Contando o que tem no aparelho…</p>
          <p class="hint" data-last></p>
          <button type="button" class="btn btn--primary btn--wide" data-act="make">${icon('download', { size: 22 })}Fazer cópia de tudo</button>
          <p class="pdf-progress" data-progress hidden><span class="pdf-progress__bar"><i data-bar></i></span><span data-progress-text></span></p>
          <div class="ready" data-ready hidden>
            <p class="ready__title">${icon('heart', { size: 18, fill: true })} Cópia pronta! <span class="chip" data-size></span></p>
            <p class="hint">Agora salve o arquivo num lugar fora deste aparelho.</p>
            <div class="ready__links">
              <button type="button" class="btn btn--primary" data-act="share" hidden>${icon('upload', { size: 20 })}Salvar em Arquivos ou no Drive</button>
              <a class="btn btn--soft" data-download>${icon('download', { size: 20 })}Baixar o arquivo</a>
            </div>
          </div>
          <div class="print-tip">
            <p><strong>No iPad:</strong> toque em <strong>Salvar em Arquivos ou no Drive</strong> e escolha <strong>Salvar em Arquivos</strong> (de preferência no iCloud Drive) ou o Google Drive.</p>
            <p><strong>No computador:</strong> o arquivo vai para a pasta Downloads. Guarde uma cópia num pen drive ou na nuvem.</p>
          </div>
        </div>
      </div>
      <div class="themes__right">
        <div class="box">
          <h2 class="box__title">${icon('upload', { size: 22 })} Trazer de volta</h2>
          <p class="hint">Abra um arquivo <strong>central-elane-copia-….zip</strong>. Nada do que já está no aparelho é apagado ou trocado: só entra o que estiver faltando.</p>
          <label class="pdf-drop" data-drop>
            <input type="file" accept=".zip,application/zip" data-input hidden>
            ${icon('upload', { size: 30 })}
            <span class="pdf-drop__label">Escolher o arquivo da cópia</span>
            <span class="pdf-drop__or">ou arraste para cá</span>
          </label>
          <p class="pdf-progress" data-rprogress hidden><span class="pdf-progress__bar"><i data-rbar></i></span><span data-rprogress-text></span></p>
        </div>
        <div class="box">
          <h2 class="box__title">${icon('home', { size: 22 })} Este aparelho</h2>
          <p class="hint" data-device>Conferindo…</p>
          <button type="button" class="btn btn--soft btn--sm" data-act="persist" hidden>${icon('check', { size: 18 })}Pedir para o navegador não apagar</button>
        </div>
      </div>
    </div>
  </section>`;

  const $ = (sel) => root.querySelector(sel);
  let alive = true;
  let busy = false;
  let made = null; // { file, url, counts, createdAt }

  async function refresh() {
    const c = await countLocal().catch(() => null);
    const last = await lastBackup();
    if (!alive) return;
    $('[data-now]').textContent = c ? `No aparelho agora: ${countsText(c)}.` : '';
    $('[data-last]').textContent = last ? `Última cópia guardada em ${dateText(last.at)} (${countsText(last.counts || {})}).` : 'Você ainda não guardou nenhuma cópia.';
  }

  async function deviceInfo() {
    const S = navigator.storage;
    let persisted = null;
    let used = null;
    try {
      if (S && S.persisted) persisted = await S.persisted();
      if (S && S.estimate) used = (await S.estimate()).usage;
    } catch (_) {}
    if (!alive) return;
    const lines = [];
    if (used != null) lines.push(`A Central ocupa ${fmtSize(used)} neste aparelho.`);
    if (persisted === true) lines.push('O navegador prometeu não apagar os dados sozinho. Mesmo assim, guarde uma cópia de vez em quando: se o tablet quebrar ou for trocado, só a cópia salva tudo.');
    else if (persisted === false) lines.push('O navegador ainda pode apagar os dados se a Central ficar muito tempo sem uso. Para evitar, ponha a Central na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.');
    else lines.push('Não deu para saber se o navegador guarda os dados para sempre. Guarde uma cópia de vez em quando.');
    $('[data-device]').textContent = lines.join(' ');
    $('[data-act="persist"]').hidden = persisted !== false || !(S && S.persist);
  }

  function setProgress(which, p, text) {
    const prog = $(which === 'r' ? '[data-rprogress]' : '[data-progress]');
    prog.hidden = p == null;
    if (p == null) return;
    $(which === 'r' ? '[data-rbar]' : '[data-bar]').style.width = `${Math.round(Math.max(0.04, Math.min(1, p)) * 100)}%`;
    $(which === 'r' ? '[data-rprogress-text]' : '[data-progress-text]').textContent = text || '';
  }

  function clearMade() {
    if (made && made.url) URL.revokeObjectURL(made.url);
    made = null;
    $('[data-ready]').hidden = true;
  }

  async function make() {
    if (busy) return;
    busy = true;
    clearMade();
    const btn = $('[data-act="make"]');
    btn.classList.add('is-busy');
    btn.disabled = true;
    setProgress('m', 0, 'Juntando tudo…');
    try {
      const out = await makeBackup({ progress: (p) => setProgress('m', p, 'Montando o arquivo…') });
      if (!alive) return;
      made = { ...out, url: URL.createObjectURL(out.file) };
      const dl = $('[data-download]');
      dl.href = made.url;
      dl.download = out.file.name;
      $('[data-size]').textContent = fmtSize(out.file.size);
      $('[data-act="share"]').hidden = !canShareFiles([out.file]);
      $('[data-ready]').hidden = false;
    } catch (e) {
      console.error(e);
      if (alive) toast(e.userFacing ? e.message : 'Não consegui fazer a cópia. Feche outras abas e tente de novo.', { kind: 'error', duration: 6000 });
    } finally {
      busy = false;
      btn.classList.remove('is-busy');
      btn.disabled = false;
      if (alive) setProgress('m', null);
    }
  }

  async function saved() {
    if (!made) return;
    await markBackupDone(made.createdAt, made.counts);
    refresh();
  }

  async function share() {
    if (!made) return;
    try {
      await navigator.share({ files: [made.file], title: 'Cópia da Central Elane' });
      await saved();
      toast('Cópia guardada!');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      // demorou demais entre o toque e o compartilhar: pede para tocar de novo
      toast('Toque de novo em “Salvar em Arquivos ou no Drive”.', { kind: 'error' });
    }
  }

  async function pickFile(file) {
    if (!file || busy) return;
    busy = true;
    const drop = $('[data-drop]');
    drop.classList.add('is-busy');
    let backup;
    try {
      backup = await readBackup(file);
    } catch (e) {
      if (!e.userFacing) console.error(e);
      toast(e.userFacing ? e.message : 'Não consegui abrir este arquivo.', { kind: 'error', duration: 6000 });
      return;
    } finally {
      busy = false;
      drop.classList.remove('is-busy');
      $('[data-input]').value = '';
    }
    if (!alive) return;
    const m = backup.manifest;
    openModal({
      title: 'Trazer esta cópia?',
      html: `
        <p class="hint">Cópia de <strong>${dateText(m.createdAt)}</strong>, com ${countsText(m.counts || {})}.</p>
        <p class="hint">O que já está no aparelho fica como está. Só entra o que estiver faltando, e as criações que entrarem também vão para a nuvem.</p>
        <button type="button" class="btn btn--primary btn--wide" data-ok>${icon('check', { size: 22 })}Trazer de volta</button>
        <button type="button" class="btn btn--soft btn--wide" data-modal-close>Agora não</button>`,
      onMount(body, close) {
        body.querySelector('[data-ok]').addEventListener('click', () => {
          close();
          restore(backup);
        });
      },
    });
  }

  async function restore(backup) {
    if (busy) return;
    busy = true;
    setProgress('r', 0, 'Trazendo de volta…');
    try {
      const r = await restoreBackup(backup, { progress: (p) => setProgress('r', p, 'Trazendo de volta…') });
      const got = countsText(r);
      const msg = r.creations || r.stickers || r.themes || r.folders ? `Pronto! Voltaram: ${got}.` : 'Tudo o que tem nesta cópia já estava no aparelho.';
      toast(r.skipped && (r.creations || r.stickers) ? `${msg} ${plural(r.skipped, 'coisa já estava', 'coisas já estavam')} aqui.` : msg, { duration: 6000 });
      refresh();
      deviceInfo();
    } catch (e) {
      console.error(e);
      toast(e.userFacing ? e.message : 'Não consegui trazer a cópia de volta. Tente de novo.', { kind: 'error', duration: 6000 });
    } finally {
      busy = false;
      if (alive) setProgress('r', null);
    }
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'make') make();
      else if (a === 'share') share();
      else if (a === 'persist') {
        navigator.storage
          .persist()
          .then((ok) => {
            toast(ok ? 'Combinado: o navegador não vai apagar os dados sozinho.' : 'O navegador não deixou. Ponha a Central na tela de início e tente de novo.', { kind: ok ? 'ok' : 'error' });
            deviceInfo();
          })
          .catch(() => {});
      }
      return;
    }
    if (e.target.closest('[data-download]')) setTimeout(saved, 500);
  });
  $('[data-input]').addEventListener('change', (e) => pickFile(e.target.files && e.target.files[0]));
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
    pickFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  refresh();
  deviceInfo();

  return () => {
    alive = false;
    clearMade();
  };
}

// Ferramentas de PDF (trazidas do Conversor de Tudo): extrair, dividir, juntar, remover e girar
// páginas, comprimir, PDF para imagem e imagem para PDF. Tudo roda no aparelho; as bibliotecas
// ficam em vendor/ e só são carregadas quando a tela de PDF é usada.

const LIBS = {
  pdflib: { src: 'vendor/pdf-lib.min.js', ok: () => window.PDFLib },
  pdfjs: {
    src: 'vendor/pdf.min.js',
    ok: () => window.pdfjsLib,
    after: () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', document.baseURI).href;
    },
  },
  jszip: { src: 'vendor/jszip.min.js', ok: () => window.JSZip },
};
const loading = {};

function loadLib(name) {
  const L = LIBS[name];
  if (L.ok()) return Promise.resolve();
  if (!loading[name]) {
    loading[name] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = L.src;
      s.async = true;
      s.onload = () => {
        try {
          L.after && L.after();
          res();
        } catch (e) {
          rej(e);
        }
      };
      s.onerror = () => {
        delete loading[name];
        s.remove();
        rej(new Error('Não consegui abrir a ferramenta de PDF. Recarregue a página e tente de novo.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading[name];
}
export const libs = (...names) => Promise.all(names.map(loadLib));

// Erro com mensagem para mostrar como está.
export class PdfError extends Error {
  constructor(msg, { needPassword = false } = {}) {
    super(msg);
    this.userFacing = true;
    this.needPassword = needPassword;
  }
}

export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  carta: [612, 792],
};

export const baseName = (name) => String(name || 'arquivo').replace(/\.[^.]+$/, '');
export const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [, ''])[1];
export const isPdf = (f) => f.type === 'application/pdf' || extOf(f.name) === 'pdf';
export const isImage = (f) => (f.type || '').startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(extOf(f.name));
const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const outName = (src, suffix, ext) => `${baseName(src.name)}${suffix ? '-' + suffix : ''}.${ext}`;

export function fmtSize(b) {
  if (b == null) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
}

// "1-3, 5, 8-" -> índices (começando do 0). groups: um grupo por pedaço.
export function parseRanges(str, total, { dedupe = true } = {}) {
  const out = [];
  const groups = [];
  for (const raw of String(str || '').split(/[,;]+/)) {
    const p = raw.trim();
    if (!p) continue;
    let a;
    let b;
    const m = p.match(/^(\d*)\s*[-–a]\s*(\d*)$/);
    if (m && (m[1] || m[2])) {
      a = m[1] ? +m[1] : 1;
      b = m[2] ? +m[2] : total;
    } else if (/^\d+$/.test(p)) {
      a = b = +p;
    } else throw new PdfError(`Não entendi "${p}". Escreva assim: 1-3, 5, 8-10.`);
    if (a < 1 || b < 1 || a > total || b > total) throw new PdfError(`"${p}" passa do total: o PDF tem ${total} ${total === 1 ? 'página' : 'páginas'}.`);
    const g = [];
    if (a <= b) for (let i = a; i <= b; i++) g.push(i - 1);
    else for (let i = a; i >= b; i--) g.push(i - 1);
    groups.push(g);
    out.push(...g);
  }
  if (!out.length) throw new PdfError('Escolha pelo menos uma página.');
  return { pages: dedupe ? [...new Set(out)] : out, groups };
}

// Índices -> "1-3, 5, 8".
export function rangesText(indices) {
  const s = [...new Set(indices)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i ? `${s[i] + 1}-${s[j] + 1}` : `${s[i] + 1}`);
    i = j;
  }
  return parts.join(', ');
}

async function bytesOf(file) {
  return new Uint8Array(await file.arrayBuffer());
}

// Abre com o pdf-lib. PDFs só com restrição (sem senha para abrir) abrem direto.
export async function loadPdf(file, password) {
  await libs('pdflib');
  const bytes = await bytesOf(file);
  try {
    return await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (!/encrypt|password/i.test(e.message || '')) throw badPdf(file, e);
  }
  try {
    return await PDFLib.PDFDocument.load(bytes, { updateMetadata: false, password: password || '' });
  } catch (e) {
    throw new PdfError(password ? 'Senha incorreta. Confira maiúsculas e minúsculas.' : `"${file.name}" tem senha para abrir.`, { needPassword: true });
  }
}

function badPdf(file, e) {
  console.error(e);
  return new PdfError(`"${file.name}" não parece ser um PDF válido (ou está danificado).`);
}

// Abre com o pdf.js (para ver as páginas e virar imagem).
export async function openPdfjs(file, password) {
  await libs('pdfjs');
  try {
    return await pdfjsLib.getDocument({ data: await bytesOf(file), password, isEvalSupported: false }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') {
      throw new PdfError(password ? 'Senha incorreta. Confira maiúsculas e minúsculas.' : `"${file.name}" tem senha para abrir.`, { needPassword: true });
    }
    throw badPdf(file, e);
  }
}

// Desenha a página n (começando do 1) num canvas, com fundo branco.
export async function renderPage(doc, n, { width, scale } = {}) {
  const page = await doc.getPage(n);
  const vp1 = page.getViewport({ scale: 1 });
  const s = scale || width / vp1.width;
  const vp = page.getViewport({ scale: s });
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(vp.width));
  cv.height = Math.max(1, Math.round(vp.height));
  const cx = cv.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  page.cleanup();
  return cv;
}

const canvasToBlob = (cv, type = 'image/png', q = 0.92) =>
  new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new PdfError('O navegador não conseguiu gerar a imagem.'))), type, q));

function decodeImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new PdfError(`Não consegui abrir a imagem "${blob.name || ''}". Tente JPG ou PNG.`));
    };
    img.src = url;
  });
}

async function embedImage(doc, file) {
  const t = file.type;
  if (t === 'image/jpeg' || /\.jpe?g$/i.test(file.name || '')) {
    try {
      return await doc.embedJpg(await bytesOf(file));
    } catch (_) {}
  }
  if (t === 'image/png' || /\.png$/i.test(file.name || '')) {
    try {
      return await doc.embedPng(await bytesOf(file));
    } catch (_) {}
  }
  // WebP, GIF, BMP…: passa por um canvas
  const img = await decodeImage(file);
  const r = Math.min(1, 6000 / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.naturalWidth * r));
  cv.height = Math.max(1, Math.round(img.naturalHeight * r));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return doc.embedPng(await bytesOf(await canvasToBlob(cv, 'image/png')));
}

// Página nova com a imagem centralizada. size: a4 | a5 | carta | fit (igual à imagem).
async function addImagePage(doc, file, { size = 'a4', orient = 'auto', margin = 0 } = {}) {
  const im = await embedImage(doc, file);
  let pw;
  let ph;
  if (size === 'fit') {
    pw = im.width * 0.75 + margin * 2;
    ph = im.height * 0.75 + margin * 2;
  } else {
    [pw, ph] = PAGE_SIZES[size] || PAGE_SIZES.a4;
    const land = orient === 'paisagem' || (orient === 'auto' && im.width > im.height);
    if (land) [pw, ph] = [ph, pw];
  }
  const page = doc.addPage([pw, ph]);
  const r = Math.min((pw - margin * 2) / im.width, (ph - margin * 2) / im.height);
  const w = im.width * r;
  const h = im.height * r;
  page.drawImage(im, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  return page;
}

async function pagesToPdf(src, indices) {
  const d = await PDFLib.PDFDocument.create();
  (await d.copyPages(src, indices)).forEach((p) => d.addPage(p));
  return d.save();
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/* ---------------- as ferramentas ----------------
   Cada uma recebe { file | files, pages, opts, password, progress(fração, texto) }
   e devolve uma lista de { name, blob, note }. */

export async function extractPages({ file, pages, opts, password, progress }) {
  const src = await loadPdf(file, password);
  if (!pages.length) throw new PdfError('Toque nas páginas que você quer tirar do PDF.');
  if (opts.separate) {
    const pad = String(src.getPageCount()).length;
    const out = [];
    for (let k = 0; k < pages.length; k++) {
      progress(k / pages.length, `Separando a página ${pages[k] + 1}`);
      out.push({ name: outName(file, 'pag-' + String(pages[k] + 1).padStart(pad, '0'), 'pdf'), blob: pdfBlob(await pagesToPdf(src, [pages[k]])), note: '1 página' });
      await tick();
    }
    return out;
  }
  progress(0.3, 'Montando o PDF');
  const label = pages.length === 1 ? `pag-${pages[0] + 1}` : 'extraido';
  return [{ name: outName(file, label, 'pdf'), blob: pdfBlob(await pagesToPdf(src, pages)), note: `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}` }];
}

export async function splitPdf({ file, opts, password, progress }) {
  const src = await loadPdf(file, password);
  const total = src.getPageCount();
  let groups;
  if (opts.mode === 'each') groups = [...Array(total).keys()].map((i) => [i]);
  else if (opts.mode === 'every') {
    const n = Math.max(1, Math.round(+opts.every || 1));
    groups = [];
    for (let i = 0; i < total; i += n) groups.push([...Array(Math.min(n, total - i)).keys()].map((k) => k + i));
  } else if (opts.mode === 'half') {
    const h = Math.ceil(total / 2);
    groups = [[...Array(h).keys()], [...Array(total - h).keys()].map((k) => k + h)].filter((g) => g.length);
  } else groups = parseRanges(opts.ranges, total).groups;
  if (groups.length < 2 && opts.mode !== 'ranges') throw new PdfError('Esse PDF tem uma página só: não tem o que dividir.');
  const out = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    progress(gi / groups.length, `Parte ${gi + 1} de ${groups.length}`);
    const label = g.length === 1 ? `pag-${g[0] + 1}` : `pags-${g[0] + 1}-${g[g.length - 1] + 1}`;
    out.push({ name: outName(file, label, 'pdf'), blob: pdfBlob(await pagesToPdf(src, g)), note: `${g.length} ${g.length === 1 ? 'página' : 'páginas'}` });
    await tick();
  }
  return out;
}

export async function mergeFiles({ files, opts, passwords = {}, progress }) {
  await libs('pdflib');
  if (files.length < 2) throw new PdfError('Escolha pelo menos 2 arquivos para juntar.');
  const out = await PDFLib.PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    progress(i / files.length, `Juntando ${f.name}`);
    let added = 1;
    if (isPdf(f)) {
      const src = await loadPdf(f, passwords[f.name]);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      added = pages.length;
    } else await addImagePage(out, f, { size: 'a4' });
    if (opts.blank && added % 2 && i < files.length - 1) {
      const last = out.getPage(out.getPageCount() - 1);
      out.addPage([last.getWidth(), last.getHeight()]);
    }
    await tick();
  }
  const name = (opts.name || 'pdf-junto').replace(/\.pdf$/i, '').trim() || 'pdf-junto';
  const n = out.getPageCount();
  return [{ name: name + '.pdf', blob: pdfBlob(await out.save()), note: `${n} ${n === 1 ? 'página' : 'páginas'}` }];
}

export async function removePages({ file, pages, password, progress }) {
  const d = await loadPdf(file, password);
  const total = d.getPageCount();
  if (!pages.length) throw new PdfError('Toque nas páginas que você quer apagar.');
  if (pages.length >= total) throw new PdfError('Não dá para apagar todas as páginas.');
  progress(0.3, 'Apagando as páginas');
  [...pages].sort((a, b) => b - a).forEach((i) => d.removePage(i));
  const left = total - pages.length;
  return [{ name: outName(file, 'sem-paginas', 'pdf'), blob: pdfBlob(await d.save()), note: `ficou com ${left} de ${total} páginas` }];
}

export async function rotatePages({ file, pages, opts, password, progress }) {
  const d = await loadPdf(file, password);
  if (!pages.length) throw new PdfError('Toque nas páginas que você quer girar.');
  progress(0.3, 'Girando');
  for (const i of pages) {
    const p = d.getPage(i);
    p.setRotation(PDFLib.degrees((p.getRotation().angle + +opts.angle) % 360));
  }
  return [{ name: outName(file, 'girado', 'pdf'), blob: pdfBlob(await d.save()), note: `${pages.length} ${pages.length === 1 ? 'página girada' : 'páginas giradas'}` }];
}

export const COMPRESS_LEVELS = [
  { v: 'leve', l: 'Leve', dpi: 150, q: 0.8, hint: 'ótima qualidade' },
  { v: 'media', l: 'Recomendada', dpi: 110, q: 0.65, hint: 'boa para mandar no WhatsApp' },
  { v: 'forte', l: 'Forte', dpi: 72, q: 0.5, hint: 'menor arquivo, só para ver na tela' },
  { v: 'sem', l: 'Sem perder nada', hint: 'só arruma por dentro; o texto continua selecionável' },
];

export async function compressPdf({ file, opts, password, progress }) {
  const level = COMPRESS_LEVELS.find((l) => l.v === opts.level) || COMPRESS_LEVELS[1];
  let bytes;
  if (level.v === 'sem') {
    progress(0.3, 'Otimizando');
    const d = await loadPdf(file, password);
    bytes = await d.save({ useObjectStreams: true });
  } else {
    await libs('pdflib', 'pdfjs');
    const src = await openPdfjs(file, password);
    const out = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      progress((i - 1) / src.numPages, `Comprimindo a página ${i} de ${src.numPages}`);
      const page = await src.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      let cv = await renderPage(src, i, { scale: level.dpi / 72 });
      if (opts.gray) {
        const g = document.createElement('canvas');
        g.width = cv.width;
        g.height = cv.height;
        const cx = g.getContext('2d');
        cx.filter = 'grayscale(1)';
        cx.drawImage(cv, 0, 0);
        cv.width = cv.height = 0;
        cv = g;
      }
      const jpg = await out.embedJpg(await bytesOf(await canvasToBlob(cv, 'image/jpeg', level.q)));
      out.addPage([vp.width, vp.height]).drawImage(jpg, { x: 0, y: 0, width: vp.width, height: vp.height });
      cv.width = cv.height = 0;
    }
    src.destroy();
    bytes = await out.save({ useObjectStreams: true });
  }
  if (bytes.length >= file.size) {
    return [{ name: outName(file, 'comprimido', 'pdf'), blob: file.slice(0, file.size, 'application/pdf'), note: 'já estava bem leve: ficou o original. Tente um nível mais forte.' }];
  }
  return [{ name: outName(file, 'comprimido', 'pdf'), blob: pdfBlob(bytes), note: `${fmtSize(file.size)} → ${fmtSize(bytes.length)} (−${Math.round((1 - bytes.length / file.size) * 100)}%)` }];
}

export async function pdfToImages({ file, pages, opts, password, progress }) {
  const doc = await openPdfjs(file, password);
  if (!pages.length) throw new PdfError('Toque nas páginas que você quer transformar em imagem.');
  const type = opts.fmt === 'jpg' ? 'image/jpeg' : 'image/png';
  const pad = String(doc.numPages).length;
  const out = [];
  for (let k = 0; k < pages.length; k++) {
    progress(k / pages.length, `Página ${pages[k] + 1}`);
    const cv = await renderPage(doc, pages[k] + 1, { scale: +opts.dpi / 72 });
    out.push({
      name: outName(file, 'pag-' + String(pages[k] + 1).padStart(pad, '0'), opts.fmt),
      blob: await canvasToBlob(cv, type, 0.92),
      note: `${cv.width} × ${cv.height} px`,
      image: true,
    });
    cv.width = cv.height = 0;
  }
  doc.destroy();
  return out;
}

export async function imagesToPdf({ files, opts, progress }) {
  await libs('pdflib');
  if (!files.length) throw new PdfError('Escolha as imagens.');
  const o = { size: opts.size, orient: opts.orient, margin: +opts.margin };
  if (opts.together || files.length === 1) {
    const d = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      progress(i / files.length, `Pondo ${files[i].name}`);
      await addImagePage(d, files[i], o);
      await tick();
    }
    const name = files.length === 1 ? baseName(files[0].name) : (opts.name || 'imagens').replace(/\.pdf$/i, '').trim() || 'imagens';
    return [{ name: name + '.pdf', blob: pdfBlob(await d.save()), note: `${files.length} ${files.length === 1 ? 'página' : 'páginas'}` }];
  }
  const out = [];
  for (let i = 0; i < files.length; i++) {
    progress(i / files.length, `Pondo ${files[i].name}`);
    const d = await PDFLib.PDFDocument.create();
    await addImagePage(d, files[i], o);
    out.push({ name: baseName(files[i].name) + '.pdf', blob: pdfBlob(await d.save()), note: '1 página' });
  }
  return out;
}

export async function zipFiles(list, name) {
  await libs('jszip');
  const zip = new JSZip();
  const used = new Set();
  for (const r of list) {
    let n = r.name;
    for (let k = 2; used.has(n); k++) n = r.name.replace(/(\.[^.]+)?$/, `-${k}$1`);
    used.add(n);
    zip.file(n, r.blob);
  }
  return zip.generateAsync({ type: 'blob' }).then((b) => new File([b], name + '.zip', { type: 'application/zip' }));
}

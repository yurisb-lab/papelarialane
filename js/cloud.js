// Cópia dos cards na nuvem (Supabase), guardada por 30 dias depois da última vez que o card foi salvo.
//
// Cada aparelho ganha sozinho uma conta anônima (não precisa digitar nada) e só vê os próprios cards.
// Na nuvem, cada card fica em <conta>/<card>/: front.png e back.png (o card pronto),
// project.json (para abrir e editar de novo) e img/... (as fotos usadas).
// Se estiver sem internet, o card fica numa fila e sobe quando a internet voltar.

import { CLOUD } from './cloud-config.js';
import { db } from './db.js';
import { renderThumb } from './render.js';
import { ensureFonts } from './fonts.js';
import { blobToImage, releaseImage, canvasToBlob } from './image.js';
import { sideHasContent, migrateRecord } from './card.js';

export const KEEP_DAYS = 30;
const DAY = 24 * 3600 * 1000;
const BUCKET = 'cards';
const IMAGE_PX = 1004; // lado maior da imagem pronta: 8,5 cm a 300 dpi
export const cloudEnabled = !!(CLOUD.url && CLOUD.key);

// ---------- conversa com o Supabase ----------
export async function call(path, { method = 'GET', token, headers = {}, body, json } = {}) {
  const h = { apikey: CLOUD.key, ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(CLOUD.url + path, { method, headers: h, body, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`nuvem ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res;
}

export const objPath = (path) => path.split('/').map(encodeURIComponent).join('/');

// ---------- conta anônima do aparelho ----------
let session = null;
let authing = null;

const fresh = (s) => s && s.access_token && s.expires_at * 1000 > Date.now() + 60_000;

export async function getSession() {
  if (fresh(session)) return session;
  if (!authing) authing = signIn().finally(() => (authing = null));
  return authing;
}

async function signIn() {
  if (!session) session = (await db.getMeta('cloudSession').catch(() => null)) || null;
  if (fresh(session)) return session;
  if (session && session.refresh_token) {
    try {
      const res = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: session.refresh_token } });
      return keep(await res.json());
    } catch (err) {
      // Sem internet ou servidor fora do ar: tenta de novo mais tarde, sem perder a conta.
      if (!err.status || err.status >= 500 || err.status === 429) throw err;
      // A conta antiga não vale mais: cria outra (os cards antigos desta conta não aparecem mais).
    }
  }
  const res = await call('/auth/v1/signup', { method: 'POST', json: {} });
  return keep(await res.json());
}

function keep(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user_id: data.user.id,
  };
  db.setMeta('cloudSession', session).catch(() => {});
  return session;
}

// ---------- estado (para mostrar na tela) ----------
// off: nuvem não configurada · idle: tudo guardado · syncing: enviando
// offline: sem internet, envia depois · error: deu erro, tenta de novo depois
let state = cloudEnabled ? 'idle' : 'off';
let pendingCount = 0;
const listeners = new Set();

export function onCloudChange(fn) {
  listeners.add(fn);
  fn({ state, pending: pendingCount });
  return () => listeners.delete(fn);
}

function setState(s, extra = {}) {
  state = s;
  listeners.forEach((fn) => fn({ state, pending: pendingCount, ...extra }));
}

// ---------- envio ----------
async function uploadFile(token, path, blob, type) {
  await call(`/storage/v1/object/${BUCKET}/${objPath(path)}`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': type || blob.type || 'image/png', 'x-upsert': 'true', 'cache-control': 'max-age=0' },
    body: blob,
  });
}

const safeName = (key) => String(key).replace(/[^A-Za-z0-9_-]/g, '_');

async function renderSides(design, images) {
  const loaded = new Map();
  for (const [key, blob] of Object.entries(images || {})) {
    if (!blob) continue;
    try {
      loaded.set(key, await blobToImage(blob));
    } catch (_) {}
  }
  try {
    await ensureFonts(design);
    const getImg = (k) => loaded.get(k) || null;
    const front = await canvasToBlob(renderThumb(design, 'front', getImg, IMAGE_PX), 'image/png');
    const back = sideHasContent(design.back) ? await canvasToBlob(renderThumb(design, 'back', getImg, IMAGE_PX), 'image/png') : null;
    const thumb = await canvasToBlob(renderThumb(design, 'front', getImg), 'image/png');
    return { front, back, thumb };
  } finally {
    loaded.forEach(releaseImage);
  }
}

async function pushCard(record) {
  const { access_token: token, user_id: uid } = await getSession();
  const base = `${uid}/${record.id}`;
  const rows = await (await call(`/rest/v1/saved_cards?select=files&card_id=eq.${encodeURIComponent(record.id)}`, { token })).json();
  const before = new Set((rows[0] && rows[0].files) || []);

  const { front, back } = await renderSides(record.design, record.images);
  const files = ['front.png'];
  await uploadFile(token, `${base}/front.png`, front);
  if (back) {
    files.push('back.png');
    await uploadFile(token, `${base}/back.png`, back);
  }

  // As fotos não mudam depois de entrar no card (foto nova = chave nova): só sobe as que faltam.
  const imageFiles = {};
  for (const [key, blob] of Object.entries(record.images || {})) {
    if (!blob) continue;
    const name = `img/${safeName(key)}`;
    imageFiles[key] = name;
    files.push(name);
    if (!before.has(name)) await uploadFile(token, `${base}/${name}`, blob);
  }

  const project = { v: 2, id: record.id, createdAt: record.createdAt, copies: record.copies, design: record.design, images: imageFiles };
  files.push('project.json');
  await uploadFile(token, `${base}/project.json`, new Blob([JSON.stringify(project)], { type: 'application/json' }), 'application/json');

  await call('/rest/v1/saved_cards?on_conflict=owner,card_id', {
    method: 'POST',
    token,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    json: { owner: uid, card_id: record.id, orientation: record.design.orientation === 'landscape' ? 'landscape' : 'portrait', has_back: !!back, copies: record.copies || 1, files },
  });

  const stale = [...before].filter((f) => !files.includes(f)).map((f) => `${base}/${f}`);
  if (stale.length) await call(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', token, json: { prefixes: stale } }).catch(() => {});
}

// A fila guarda { id do card: quando foi salvo }, para não esquecer um card salvo de novo durante o envio.
async function getQueue() {
  return (await db.getMeta('cloudQueue').catch(() => null)) || {};
}

export async function queueCard(id) {
  if (!cloudEnabled) return;
  const q = await getQueue();
  q[id] = Date.now();
  await db.setMeta('cloudQueue', q).catch(() => {});
  syncCloud();
}

let syncing = null;
let again = false;
let retryTimer = 0;

export function syncCloud() {
  if (!cloudEnabled) return Promise.resolve();
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = runQueue().finally(() => {
    syncing = null;
    if (again) {
      again = false;
      syncCloud();
    }
  });
  return syncing;
}

async function runQueue() {
  clearTimeout(retryTimer);
  let q = await getQueue();
  pendingCount = Object.keys(q).length;
  if (!pendingCount) return setState('idle');
  if (navigator.onLine === false) return setState('offline');
  setState('syncing');
  for (const [id, stamp] of Object.entries(q)) {
    try {
      const rec = await db.getCard(id);
      if (rec) await pushCard(migrateRecord(rec)); // card apagado da folha antes de subir: nada a enviar
    } catch (err) {
      console.warn(err);
      retryTimer = setTimeout(syncCloud, 60_000);
      return setState(err.status ? 'error' : 'offline', { message: err.message });
    }
    q = await getQueue();
    if (q[id] === stamp) {
      delete q[id];
      await db.setMeta('cloudQueue', q).catch(() => {});
    }
    pendingCount = Object.keys(q).length;
  }
  setState('idle', { uploaded: true });
}

if (cloudEnabled && typeof window !== 'undefined') {
  window.addEventListener('online', () => syncCloud());
}

// ---------- lista e volta para a folha ----------
export async function listCloud() {
  const { access_token: token, user_id: uid } = await getSession();
  const rows = await (
    await call('/rest/v1/saved_cards?select=card_id,orientation,has_back,updated_at&order=updated_at.desc', { token })
  ).json();
  const now = Date.now();
  const list = rows
    .map((r) => ({ id: r.card_id, orientation: r.orientation, hasBack: r.has_back, expiresAt: Date.parse(r.updated_at) + KEEP_DAYS * DAY }))
    .filter((c) => c.expiresAt > now);
  if (!list.length) return list;
  const signed = await (
    await call(`/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      token,
      json: { expiresIn: 3600, paths: list.map((c) => `${uid}/${c.id}/front.png`) },
    })
  ).json();
  const urls = new Map(signed.filter((s) => s.signedURL).map((s) => [s.path, `${CLOUD.url}/storage/v1${s.signedURL}`]));
  return list.map((c) => ({ ...c, thumbUrl: urls.get(`${uid}/${c.id}/front.png`) || null, daysLeft: Math.max(1, Math.ceil((c.expiresAt - now) / DAY)) }));
}

async function download(token, path) {
  return (await call(`/storage/v1/object/authenticated/${BUCKET}/${objPath(path)}`, { token })).blob();
}

// Baixa o card inteiro (projeto + fotos), no formato dos cards guardados no aparelho.
export async function fetchCloudCard(id) {
  const { access_token: token, user_id: uid } = await getSession();
  const base = `${uid}/${id}`;
  const project = JSON.parse(await (await download(token, `${base}/project.json`)).text());
  const images = {};
  for (const [key, name] of Object.entries(project.images || {})) images[key] = await download(token, `${base}/${name}`);
  const { thumb } = await renderSides(project.design, images);
  return { v: 2, id: project.id || id, createdAt: project.createdAt || Date.now(), copies: project.copies || 1, design: project.design, images, thumbBlob: thumb };
}

export function daysText(n) {
  return n === 1 ? 'falta 1 dia' : `faltam ${n} dias`;
}

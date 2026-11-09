// Minha turma: turmas fechadas por convite, com um feed de cards (cada post fica 30 dias).
//
// Cada aparelho continua com a conta anônima da nuvem (cloud.js). Na turma, a pessoa tem
// nome, avatar e uma "senha de figurinhas" (3 figurinhas), que serve para entrar como ela
// em outro aparelho. Quem cria a turma é o dono: aprova quem pede para entrar e pode tirar posts.
// Na nuvem, cada post fica em groups/<turma>/<post>/: front.png, back.png e model.json
// (o modelo do card sem as fotos, para "Quero um igual").

import { CLOUD } from './cloud-config.js';
import { cloudEnabled, call, getSession, objPath } from './cloud.js';
import { db } from './db.js';
import { renderThumb } from './render.js';
import { ensureFonts } from './fonts.js';
import { canvasToBlob } from './image.js';
import { FORMATS, sideHasContent } from './card.js';

export { cloudEnabled };
export const POST_DAYS = 30;
const DAY = 24 * 3600 * 1000;
const BUCKET = 'groups';
const IMAGE_PX = 1004; // lado maior da imagem do post

export const AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🐙', '🐧', '🦋', '🐹', '🐻'];
export const COLORS = ['#ffd2e4', '#e6dcff', '#d5ebff', '#cdeedd', '#ffe9a3', '#ffe3c4', '#ffc4c4', '#d6f5f0'];
// A ordem não pode mudar: a senha guarda a posição de cada figurinha.
export const SECRET = ['🍓', '🌈', '⭐', '🍦', '🎀', '🌸', '🍉', '🎈', '🍩', '👑', '💎', '🍀', '🌙', '☀️', '🍭', '🧸'];
export const SECRET_LEN = 3;
export const REACTIONS = [
  { id: 'heart', emoji: '❤️', name: 'Amei' },
  { id: 'love', emoji: '😍', name: 'Que lindo' },
  { id: 'star', emoji: '⭐', name: 'Estrela' },
  { id: 'fire', emoji: '🔥', name: 'Arrasou' },
];

export const avatarOf = (m) => AVATARS[(m && m.avatar) || 0] || AVATARS[0];
export const colorOf = (m) => COLORS[(m && m.color) || 0] || COLORS[0];

// Endereço do convite (o app abre direto na turma).
export function inviteUrl(code) {
  const base = location.href.split('#')[0].split('?')[0];
  return `${base}#/turma?c=${encodeURIComponent(code)}`;
}

// Aceita o link inteiro ou só o código (com ou sem espaços e traços).
export function parseInvite(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&]c=([A-Za-z0-9]+)/);
  const code = (m ? m[1] : s).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

// ---------- conversa com o servidor ----------
async function token() {
  return (await getSession()).access_token;
}

async function rpc(name, args = {}) {
  const res = await call(`/rest/v1/rpc/${name}`, { method: 'POST', token: await token(), json: args });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function rest(path, opts = {}) {
  return call(`/rest/v1/${path}`, { token: await token(), ...opts });
}

// Código do erro que o banco mandou (ex.: 'name_taken'), ou null.
export function errorCode(err) {
  try {
    return JSON.parse(err.body).message || null;
  } catch (_) {
    return null;
  }
}

export function errorText(err) {
  const code = errorCode(err);
  const T = {
    name_taken: 'Já tem alguém com esse nome na turma. Ponha mais uma letra ou o sobrenome.',
    bad_invite: 'Esse convite não vale mais. Peça um link novo para quem cuida da turma.',
    already_in: 'Este aparelho já está nessa turma.',
    too_many_requests: 'A turma tem muitos pedidos esperando. Peça para quem cuida dela aprovar e tente depois.',
    group_full: 'Essa turma já está cheia.',
    too_many_groups: 'Este aparelho já está em turmas demais.',
    too_many_posts: 'Você já postou bastante hoje! Amanhã dá para postar mais.',
    not_owner: 'Só quem cuida da turma pode fazer isso.',
    is_me: 'Isso não dá para fazer com você mesma.',
    missing_name: 'Faltou escrever o nome.',
    bad_secret: 'Escolha as 3 figurinhas da senha.',
  };
  if (T[code]) return T[code];
  if (!err.status) return 'Sem internet agora. Confira a conexão e tente de novo.';
  return 'Algo deu errado. Tente de novo daqui a pouco.';
}

// ---------- minhas turmas ----------
// [{ id, name, invite, me: { id, name, avatar, color, status, is_owner } }]
export async function myGroups() {
  const rows = await (
    await rest(
      'group_devices?select=group_id,group:groups!group_devices_group_id_fkey(id,name,invite),me:group_members!group_devices_member_id_fkey(id,name,avatar,color,status,is_owner)&order=created_at.asc'
    )
  ).json();
  const list = rows.filter((r) => r.group && r.me).map((r) => ({ ...r.group, me: r.me }));
  db.setMeta('groupsCache', list.map((g) => ({ id: g.id, name: g.name, me: g.me.id, active: g.me.status === 'active' }))).catch(() => {});
  return list;
}

export async function cachedGroups() {
  return (await db.getMeta('groupsCache').catch(() => null)) || [];
}

export const groupByInvite = (code) => rpc('group_by_invite', { p_invite: code });

export const createGroup = ({ group, name, avatar, color, secret }) =>
  rpc('create_group', { p_group: group, p_name: name, p_avatar: avatar, p_color: color, p_secret: secret });

export const joinGroup = ({ invite, name, avatar, color, secret }) =>
  rpc('join_group', { p_invite: invite, p_name: name, p_avatar: avatar, p_color: color, p_secret: secret });

// { ok: true } | { ok: false, tries_left } | { ok: false, locked_minutes }
export const loginMember = (invite, memberId, secret) => rpc('login_member', { p_invite: invite, p_member: memberId, p_secret: secret });

export async function leaveGroup(groupId) {
  await rest(`group_devices?group_id=eq.${groupId}`, { method: 'DELETE' });
  await db.deleteMeta('groupCurrent').catch(() => {});
}

export const setMySecret = (groupId, secret) => rpc('set_my_secret', { p_group: groupId, p_secret: secret });

// ---------- pessoas (dono) ----------
export async function groupMembers(groupId) {
  return (await rest(`group_members?select=id,name,avatar,color,status,is_owner,created_at&group_id=eq.${groupId}&order=created_at.asc`)).json();
}

export const approveMember = (id) => rpc('approve_member', { p_member: id });
export const removeMember = (id) => rpc('remove_member', { p_member: id });
export const setMemberSecret = (id, secret) => rpc('set_member_secret', { p_member: id, p_secret: secret });
export const setMemberOwner = (id, owner) => rpc('set_member_owner', { p_member: id, p_owner: owner });
export const newInvite = (groupId) => rpc('new_group_invite', { p_group: groupId });

// ---------- feed ----------
async function signUrls(paths) {
  if (!paths.length) return new Map();
  const signed = await (
    await call(`/storage/v1/object/sign/${BUCKET}`, { method: 'POST', token: await token(), json: { expiresIn: 3600, paths } })
  ).json();
  return new Map(signed.filter((s) => s.signedURL).map((s) => [s.path, `${CLOUD.url}/storage/v1${s.signedURL}`]));
}

// Posts da turma, do mais novo para o mais velho, com as imagens já com endereço.
export async function groupFeed(groupId) {
  const rows = await (
    await rest(
      `group_posts?select=id,member_id,card_id,format,orientation,has_back,can_copy,for_trade,created_at,post_reactions(member_id,emoji)&group_id=eq.${groupId}&ready=eq.true&order=created_at.desc&limit=120`
    )
  ).json();
  const now = Date.now();
  const paths = [];
  for (const r of rows) {
    paths.push(`${groupId}/${r.id}/front.png`);
    if (r.has_back) paths.push(`${groupId}/${r.id}/back.png`);
  }
  const urls = await signUrls(paths);
  return rows
    .map((r) => {
      const at = Date.parse(r.created_at);
      return {
        id: r.id,
        memberId: r.member_id,
        cardId: r.card_id,
        format: r.format,
        orientation: r.orientation,
        hasBack: r.has_back,
        canCopy: r.can_copy,
        forTrade: r.for_trade,
        at,
        daysLeft: Math.max(1, Math.ceil((at + POST_DAYS * DAY - now) / DAY)),
        reactions: r.post_reactions || [],
        front: urls.get(`${groupId}/${r.id}/front.png`) || null,
        back: r.has_back ? urls.get(`${groupId}/${r.id}/back.png`) || null : null,
      };
    })
    .filter((p) => p.front);
}

export async function react(postId, memberId, emoji, on) {
  if (on) {
    await rest('post_reactions?on_conflict=post_id,member_id,emoji', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      json: { post_id: postId, member_id: memberId, emoji },
    });
  } else {
    await rest(`post_reactions?post_id=eq.${postId}&member_id=eq.${memberId}&emoji=eq.${emoji}`, { method: 'DELETE' });
  }
}

export async function deletePost(postId) {
  await rest(`group_posts?id=eq.${postId}`, { method: 'DELETE' });
}

export async function setForTrade(postId, on) {
  await rest(`group_posts?id=eq.${postId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, json: { for_trade: !!on } });
}

// Posts novos de outras pessoas desde a última vez que a turma foi aberta (para a tela inicial).
export async function newPostsCount() {
  const groups = (await cachedGroups()).filter((g) => g.active);
  if (!groups.length) return 0;
  const seen = (await db.getMeta('groupSeen').catch(() => null)) || {};
  let n = 0;
  for (const g of groups) {
    const since = new Date(seen[g.id] || Date.now() - POST_DAYS * DAY).toISOString();
    const res = await rest(`group_posts?select=id&group_id=eq.${g.id}&ready=eq.true&member_id=neq.${g.me}&created_at=gt.${encodeURIComponent(since)}&limit=99`);
    n += (await res.json()).length;
  }
  return n;
}

export async function markSeen(groupId) {
  const seen = (await db.getMeta('groupSeen').catch(() => null)) || {};
  seen[groupId] = Date.now();
  await db.setMeta('groupSeen', seen).catch(() => {});
}

// ---------- postar ----------
function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const isPhotoLayer = (l) => l.type === 'photo' || (l.type === 'sticker' && l.kind === 'image');

// O modelo do card sem nenhuma foto (nem foto de fundo, foto solta ou meus adesivos).
// null se não sobrar nada além das fotos.
export function modelOf(design) {
  const d = JSON.parse(JSON.stringify(design));
  for (const s of [d.front, d.back]) s.layers = s.layers.filter((l) => !isPhotoLayer(l));
  return sideHasContent(d.front) || sideHasContent(d.back) ? d : null;
}

async function upload(path, blob, type) {
  await call(`/storage/v1/object/${BUCKET}/${objPath(path)}`, {
    method: 'POST',
    token: await token(),
    headers: { 'Content-Type': type, 'x-upsert': 'false', 'cache-control': 'max-age=3600' },
    body: blob,
  });
}

export async function publishPost({ groupId, memberId, design, getImg, cardId, canCopy, forTrade }) {
  await ensureFonts(design);
  const front = await canvasToBlob(renderThumb(design, 'front', getImg, IMAGE_PX), 'image/png');
  const back = sideHasContent(design.back) ? await canvasToBlob(renderThumb(design, 'back', getImg, IMAGE_PX), 'image/png') : null;
  const model = canCopy ? modelOf(design) : null;
  const id = newUuid();
  const fmt = FORMATS.some((f) => f.id === design.format) ? design.format : 'card';
  await rest('group_posts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    json: {
      id,
      group_id: groupId,
      member_id: memberId,
      card_id: cardId && /^[A-Za-z0-9_-]{1,64}$/.test(cardId) ? cardId : null,
      format: fmt,
      orientation: design.orientation === 'landscape' ? 'landscape' : 'portrait',
      has_back: !!back,
      can_copy: !!model,
      for_trade: !!forTrade,
    },
  });
  try {
    const base = `${groupId}/${id}`;
    await upload(`${base}/front.png`, front, 'image/png');
    if (back) await upload(`${base}/back.png`, back, 'image/png');
    if (model) await upload(`${base}/model.json`, new Blob([JSON.stringify(model)], { type: 'application/json' }), 'application/json');
    await rest(`group_posts?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, json: { ready: true } });
  } catch (err) {
    deletePost(id).catch(() => {});
    throw err;
  }
  return id;
}

// ---------- "Quero um igual" ----------
// O modelo vem de outra pessoa: só passa o que tem cara de card (nada de HTML escondido).
const SAFE_STR = /^[^<>"'`&\\]*$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const COLOR_KEYS = new Set(['color', 'c', 'stop']);

function clean(v, key, depth = 0) {
  if (depth > 12) return null;
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    if (key === 'text') return v.slice(0, 400);
    if (COLOR_KEYS.has(key)) return HEX.test(v) ? v : '#ffffff';
    return v.length <= 64 && SAFE_STR.test(v) ? v : '';
  }
  if (Array.isArray(v)) return v.slice(0, 20000).map((x) => clean(x, key === 'stops' ? 'stop' : '', depth + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (!/^[A-Za-z0-9_]{1,32}$/.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      o[k] = clean(x, k, depth + 1);
    }
    return o;
  }
  return null;
}

export function sanitizeDesign(raw) {
  const d = clean(raw, '');
  if (!d || typeof d !== 'object') return null;
  const okSide = (s) => s && typeof s === 'object' && Array.isArray(s.layers) && s.bg && typeof s.bg === 'object' && s.frame && typeof s.frame === 'object';
  if (!okSide(d.front) || !okSide(d.back)) return null;
  if (!FORMATS.some((f) => f.id === d.format)) d.format = 'card';
  d.orientation = d.orientation === 'landscape' ? 'landscape' : 'portrait';
  d.v = 2;
  for (const s of [d.front, d.back]) {
    s.layers = s.layers.filter((l) => l && typeof l === 'object' && ['text', 'sticker', 'draw'].includes(l.type) && !isPhotoLayer(l));
    s.layers.forEach((l) => (l.id = String(l.id || '').replace(/[^A-Za-z0-9_-]/g, '') || Math.random().toString(36).slice(2, 9)));
    if (typeof s.layout !== 'string') s.layout = '1';
  }
  return d;
}

export async function fetchModel(groupId, postId) {
  const res = await call(`/storage/v1/object/authenticated/${BUCKET}/${objPath(`${groupId}/${postId}/model.json`)}`, { token: await token() });
  return sanitizeDesign(JSON.parse(await res.text()));
}

// ---------- textos ----------
export function agoText(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const leftText = (n) => (n === 1 ? 'some amanhã' : `some em ${n} dias`);

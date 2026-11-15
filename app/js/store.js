// Camada de dados (modelo v2) com dois armazenamentos:
// 1) banco da conta Claude (capability "db"), privado do usuário, quando disponível;
// 2) cópia local (localStorage) sempre, para abrir rápido e funcionar sem o banco.
// No APK, só o armazenamento local (trocável por outro adaptador).

import { DEFAULT_SETS } from "./data.js";

export const SCHEMA = 2;
const LKEY = "rbt_v2";
export const LEGACY_KEY = "riftbound_matches_v1";

/*
Partida (schema 2):
{
  id, schema: 2, createdAt, updatedAt, playedAt (ms),
  set: "RAD",
  my: "Jinx", opp: "Ahri",
  deckId: null, version: "v2",           // deckId entra no Sprint 1
  event: { type: "Nexus Night", eventId: null, round: null },
  format: "bo1" | "bo3",
  result: "W" | "L" | "D",
  games: [ { n: 1, first: "me"|"opp"|null, result: "W"|"L"|"D"|null,
             myBf: null, oppBf: null, points: null, log: [] } ],
  note: "", tags: []
}
*/

const listeners = new Set();
const state = {
  matches: [],              // ordenadas por playedAt
  settings: { sets: null, customLegends: {} },
  decks: [],                // { id, name, legend, battlefields[3], set, archived, versions:[{id,name,note,createdAt}], createdAt, updatedAt }
  events: [],               // { id, name, type, place, date, deckId, versionId, status:"open"|"closed", placement, topCut, note, createdAt, updatedAt }
  listsAt: { decks: 0, events: 0 },
  images: {},               // nome da lenda -> data URI (imagem escolhida pelo usuário)
  backend: "local",         // "local" | "conta"
  loading: true,
  pending: {},              // id -> "set" | "delete" (escritas ainda não confirmadas no banco)
};

let db = null, uid = null, matchesCol = null, settingsDoc = null, imagesCol = null;
const IKEY = "rbt_imgs";
export const imgId = (name) => "L-" + encodeURIComponent(name).replace(/%/g, "_").replace(/[^A-Za-z0-9_\-.~]/g, "_").slice(0, 150);
const listDocs = {};

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

function sortMatches() { state.matches.sort((a, b) => (a.playedAt || 0) - (b.playedAt || 0) || a.id.localeCompare(b.id)); }

// Devolve true se gravou. Falha (armazenamento cheio) é avisada: nunca fingir que salvou.
let lastFullWarn = 0;
function saveLocal() {
  try {
    localStorage.setItem(LKEY, JSON.stringify({ schema: SCHEMA, matches: state.matches, settings: state.settings, pending: state.pending, decks: state.decks, events: state.events, listsAt: state.listsAt }));
    state.localFull = false;
    return true;
  } catch (e) {
    state.localFull = true;
    if (Date.now() - lastFullWarn > 3000) { lastFullWarn = Date.now(); emitError("Sem espaço no aparelho: a última alteração não foi salva. Faça um backup e remova fotos de lendas."); }
    return false;
  }
}
// sem banco da conta, a cópia local é o único lugar: se ela falhar, nada foi salvo
const durable = (localOk) => localOk || state.backend === "conta";

// Uso aproximado do armazenamento local (o navegador permite ~5 milhões de caracteres por site).
export const LOCAL_LIMIT = 5000000;
export function storageUsage() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || "").length; } } catch (e) {}
  return { used: n, limit: LOCAL_LIMIT, pct: Math.min(100, Math.round((n / LOCAL_LIMIT) * 100)) };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LKEY);
    if (!raw) return;
    let o;
    try { o = JSON.parse(raw); }
    catch (e) {
      // cópia danificada: guarda o conteúdo bruto antes de qualquer gravação por cima
      try { localStorage.setItem("rbt_v2_danificado_" + Date.now(), raw); localStorage.removeItem(LKEY); } catch (e2) {}
      state.corruptAt = Date.now();
      return;
    }
    state.matches = (o.matches || []).map(normalize).filter(Boolean);
    state.settings = { ...state.settings, ...(o.settings || {}) };
    state.pending = o.pending || {};
    state.decks = o.decks || [];
    state.events = o.events || [];
    state.listsAt = { decks: 0, events: 0, ...(o.listsAt || {}) };
    sortMatches();
  } catch (e) { console.error(e); }
}

export function sets() {
  const s = state.settings.sets && state.settings.sets.length ? state.settings.sets : DEFAULT_SETS;
  return s.slice().sort((a, b) => a.start.localeCompare(b.start));
}

export function setForDate(ms) {
  const d = new Date(ms);
  const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let cur = sets()[0];
  for (const s of sets()) if (s.start <= iso) cur = s;
  return cur ? cur.id : "";
}

export function newId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Aceita partidas v2 e converte qualquer formato parecido (importação).
export function normalize(m) {
  if (!m || typeof m !== "object") return null;
  if (m.schema === SCHEMA && m.id && m.my && m.opp) {
    if (!["W", "L", "D"].includes(m.result)) return null;
    return { ...m, id: String(m.id), format: m.format === "bo3" ? "bo3" : "bo1", playedAt: +m.playedAt || +m.createdAt || Date.now(), games: Array.isArray(m.games) ? m.games : [], tags: m.tags || [], event: m.event || { type: "Outro", eventId: null, round: null } };
  }
  // formato do app antigo (v1)
  if (m.my && m.opp && (m.r === "V" || m.r === "D")) {
    const playedAt = m.d || Date.now();
    const result = m.r === "V" ? "W" : "L";
    const first = m.turn === "Primeiro" ? "me" : m.turn === "Segundo" ? "opp" : null;
    const bo3 = m.fmt === "bo3";
    return {
      id: "v1-" + m.id, schema: SCHEMA, createdAt: playedAt, updatedAt: playedAt, playedAt,
      set: setForDate(playedAt), my: m.my, opp: m.opp, deckId: null, version: m.ver || "",
      event: { type: m.ctx || "Outro", eventId: null, round: null },
      format: bo3 ? "bo3" : "bo1", result,
      score: bo3 ? (m.score || "") : "",
      games: bo3 && m.score ? gamesFromScore(m.score, first) : [game(1, first, result)],
      note: m.note || "", tags: [],
    };
  }
  return null;
}

export function game(n, first = null, result = null) {
  return { n, first, result, myBf: null, oppBf: null, points: null, log: [] };
}

// "2-1" -> um registro por game. A ordem dos resultados não é conhecida quando
// só o placar foi informado, então o resultado de cada game fica null.
export function gamesFromScore(score, firstG1 = null) {
  const [w, l] = String(score).split("-").map(Number);
  const out = [];
  for (let i = 0; i < (w || 0) + (l || 0); i++) out.push(game(i + 1, i === 0 ? firstG1 : null, null));
  return out;
}

export function score(m) {
  if (m.format !== "bo3") return "";
  if (m.score) return m.score;
  const w = m.games.filter((g) => g.result === "W").length, l = m.games.filter((g) => g.result === "L").length;
  return w + l ? w + "-" + l : "";
}

export function firstOf(m) { return m.games && m.games[0] ? m.games[0].first : null; }

// ---------- escrita ----------
async function writeRemote(id) {
  if (!matchesCol) return;
  const op = state.pending[id];
  try {
    if (op === "delete") await matchesCol.doc(id).delete();
    else {
      const m = state.matches.find((x) => x.id === id);
      if (m) await matchesCol.doc(id).set(JSON.parse(JSON.stringify(m)));
    }
    delete state.pending[id];
    saveLocal();
  } catch (e) {
    console.warn("Falha ao salvar na conta", e);
    if (e && e.code === "quota_exceeded") emitError("O espaço do banco acabou. Exporte um backup.");
  }
}

let errorHandler = null;
export function onError(fn) { errorHandler = fn; }
function emitError(msg) { if (errorHandler) errorHandler(msg); }

// Devolve false se a partida não pôde ser guardada (aí nada muda na tela).
export async function saveMatch(m) {
  m.updatedAt = Date.now();
  const i = state.matches.findIndex((x) => x.id === m.id), prev = i >= 0 ? state.matches[i] : null;
  if (i >= 0) state.matches[i] = m; else state.matches.push(m);
  sortMatches();
  const hadPending = state.pending[m.id];
  state.pending[m.id] = "set";
  if (!durable(saveLocal())) {
    if (prev) state.matches[state.matches.findIndex((x) => x.id === m.id)] = prev; else state.matches = state.matches.filter((x) => x.id !== m.id);
    if (hadPending) state.pending[m.id] = hadPending; else delete state.pending[m.id];
    emit(); return false;
  }
  emit();
  await writeRemote(m.id);
  return true;
}

export async function deleteMatch(id) {
  const before = state.matches;
  state.matches = state.matches.filter((m) => m.id !== id);
  state.pending[id] = "delete";
  if (!durable(saveLocal())) { state.matches = before; delete state.pending[id]; emit(); return false; }
  emit();
  await writeRemote(id);
  return true;
}

export async function importLists(o) {
  if (o && o.images && typeof o.images === "object") for (const [n, u] of Object.entries(o.images)) if (typeof u === "string" && u.startsWith("data:image/") && !state.images[n]) await saveImage(n, u);
  for (const name of ["decks", "events"]) {
    if (!o || !Array.isArray(o[name])) continue;
    const list = state[name].slice();
    for (const it of o[name]) {
      if (!it || !it.id) continue;
      const i = list.findIndex((x) => x.id === it.id);
      if (i < 0) list.push(it); else if ((it.updatedAt || 0) > (list[i].updatedAt || 0)) list[i] = it;
    }
    await saveList(name, list);
  }
}

export async function importMatches(list, mode = "merge") {
  const norm = list.map(normalize).filter(Boolean);
  let added = 0, updated = 0;
  for (const m of norm) {
    const i = state.matches.findIndex((x) => x.id === m.id);
    if (i < 0) { state.matches.push(m); added++; }
    else if ((m.updatedAt || 0) > (state.matches[i].updatedAt || 0)) { state.matches[i] = m; updated++; }
    else continue;
    state.pending[m.id] = "set";
  }
  sortMatches();
  const ok = durable(saveLocal()); emit();
  for (const id of Object.keys(state.pending)) await writeRemote(id);
  return { added, updated, ignored: list.length - norm.length, ok };
}

// Versão renomeada: as partidas dela passam a usar o nome novo (senão as estatísticas se dividem).
export async function renameVersions(deckId, names) {
  const ids = [];
  for (const m of state.matches) {
    if (m.deckId !== deckId || !m.versionId || !names[m.versionId] || m.version === names[m.versionId]) continue;
    m.version = names[m.versionId]; m.updatedAt = Date.now(); state.pending[m.id] = "set"; ids.push(m.id);
  }
  if (!ids.length) return 0;
  saveLocal(); emit();
  for (const id of ids) await writeRemote(id);
  return ids.length;
}

// ---------- listas (decks, eventos) ----------
export async function saveList(name, items) {
  const prev = state[name];
  state[name] = items;
  state.listsAt[name] = Date.now();
  if (!durable(saveLocal())) { state[name] = prev; emit(); return false; }
  emit();
  if (listDocs[name]) {
    try { await listDocs[name].set(JSON.parse(JSON.stringify({ items, updatedAt: state.listsAt[name] }))); }
    catch (e) { console.warn(e); }
  }
  return true;
}
export async function upsert(name, item) {
  item.updatedAt = Date.now();
  const list = state[name].slice();
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  return (await saveList(name, list)) ? item : null;
}
export async function removeFrom(name, id) { await saveList(name, state[name].filter((x) => x.id !== id)); }
export const newKey = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const deck = (id) => state.decks.find((d) => d.id === id) || null;
export const evt = (id) => state.events.find((e) => e.id === id) || null;
export const openEvent = () => state.events.filter((e) => e.status === "open").sort((a, b) => b.date - a.date)[0] || null;

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  saveLocal(); emit();
  if (settingsDoc) {
    try { await settingsDoc.set(JSON.parse(JSON.stringify(state.settings))); } catch (e) { console.warn(e); }
  }
}

export function exportData() {
  return { app: "Riftsight", schema: SCHEMA, exportedAt: new Date().toISOString(), matches: state.matches, settings: state.settings, decks: state.decks, events: state.events, images: state.images };
}

export function legacyMatches() {
  try { const r = localStorage.getItem(LEGACY_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

// ---------- inicialização ----------
function loadImagesLocal() { try { state.images = JSON.parse(localStorage.getItem(IKEY) || "{}"); } catch (e) { state.images = {}; } }
function saveImagesLocal() { try { localStorage.setItem(IKEY, JSON.stringify(state.images)); return true; } catch (e) { emitError("Sem espaço no aparelho para mais imagens."); return false; } }
export async function saveImage(name, dataUrl) {
  const prev = state.images[name];
  if (dataUrl) state.images[name] = dataUrl; else delete state.images[name];
  if (!durable(saveImagesLocal())) { if (prev) state.images[name] = prev; else delete state.images[name]; emit(); return false; }
  emit();
  if (imagesCol) {
    try { if (dataUrl) await imagesCol.doc(imgId(name)).set({ name, data: dataUrl, updatedAt: Date.now() }); else await imagesCol.doc(imgId(name)).delete(); }
    catch (e) { console.warn(e); if (e && e.code === "quota_exceeded") emitError("O espaço do banco acabou."); }
  }
}
loadImagesLocal();

// carrega a cópia local já na importação, para as telas nascerem com decks e partidas
loadLocal();

export async function init() {
  state.loading = true;
  emit();
  const claude = window.claude;
  if (!claude || typeof claude.use !== "function") { state.loading = false; emit(); return; }
  try {
    const [d, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    uid = user ? await user.id() : null;
    if (!d || !uid) { state.loading = false; emit(); return; }
    db = d;
    const root = db.doc("data/users/" + uid + "/tracker");
    matchesCol = root.collection("matches");
    imagesCol = root.collection("images");
    settingsDoc = db.doc("data/users/" + uid + "/settings");
    state.backend = "conta";

    // imagens das lendas: lê da conta e envia as que só existem no aparelho
    try {
      const snapI = await imagesCol.get();
      const remote = {};
      snapI.docs.forEach((d) => { const x = d.data(); if (x && x.name && x.data) remote[x.name] = x.data; });
      for (const [n, u] of Object.entries(state.images)) {
        if (!remote[n]) { try { await imagesCol.doc(imgId(n)).set({ name: n, data: u, updatedAt: Date.now() }); } catch (e) { console.warn(e); } }
      }
      state.images = { ...state.images, ...remote };
      saveImagesLocal(); state.imagesAt = Date.now(); emit();
    } catch (e) { console.warn("imagens", e); }

    const s = await settingsDoc.get().catch(() => null);
    if (s && s.exists) { state.settings = { ...state.settings, ...s.data() }; }

    for (const name of ["decks", "events"]) {
      listDocs[name] = db.doc("data/users/" + uid + "/" + name);
      const snap = await listDocs[name].get().catch(() => null);
      const remote = snap && snap.exists ? snap.data() : null;
      if (remote && (remote.updatedAt || 0) >= (state.listsAt[name] || 0)) {
        state[name] = Array.isArray(remote.items) ? remote.items : [];
        state.listsAt[name] = remote.updatedAt || 0;
      } else if (state[name].length) {
        await saveList(name, state[name]);
      }
    }
    saveLocal(); emit();

    let timer = setTimeout(() => { state.loading = false; emit(); }, 10000);
    matchesCol.onSnapshot((snap) => {
      if (!snap.metadata.fromCache) { clearTimeout(timer); state.loading = false; }
      const remote = new Map(snap.docs.map((doc) => [doc.id, doc.data()]));
      // escritas locais pendentes vencem até serem confirmadas
      const local = new Map(state.matches.map((m) => [m.id, m]));
      const merged = [];
      for (const [id, data] of remote) {
        if (state.pending[id] === "delete") continue;
        if (state.pending[id] === "set" && local.has(id)) merged.push(local.get(id));
        else { const n = normalize(data); if (n) merged.push(n); }
      }
      for (const [id, m] of local) {
        if (remote.has(id)) continue;
        // pendente: ainda não chegou ao banco; cache parcial: não apagar o que já existia
        if (state.pending[id] === "set" || (snap.metadata.fromCache && state.pending[id] !== "delete")) merged.push(m);
      }
      state.matches = merged; sortMatches(); saveLocal(); emit();
    }, (e) => { clearTimeout(timer); state.loading = false; console.warn(e); emit(); });

    // envia o que ficou pendente de outras visitas
    for (const id of Object.keys(state.pending)) await writeRemote(id);
  } catch (e) {
    console.warn("Banco indisponível; usando só o aparelho", e);
    state.loading = false; emit();
  }
}

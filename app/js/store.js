// Camada de dados (modelo v2) com dois armazenamentos:
// 1) banco da conta Claude (capability "db"), privado do usuário, quando disponível;
// 2) cópia local (localStorage) sempre, para abrir rápido e funcionar sem o banco.
// No APK, só o armazenamento local (trocável por outro adaptador).

import { DEFAULT_SETS, DOMAINS } from "./data.js";

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

// ---------- validação por esquema ----------
// Tudo que entra por importação, pelo banco ou pela cópia local passa por aqui: tipos errados
// são consertados quando dá e o registro é descartado quando não dá (nunca quebra uma tela).
export const ID_RE = /^[\w-]{1,64}$/;
export const IMG_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCORE_RE = /^\d-\d$/;
export const EVENT_STATUS = ["open", "closed"];
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x, d = "") => (typeof x === "string" ? x : d);
const strOrNull = (x) => (typeof x === "string" && x ? x : null);
// Id sempre no formato ID_RE. Um id com outros caracteres é trocado, sempre do mesmo jeito
// (assim os vínculos partida → deck → versão continuam batendo); sem id aproveitável, null.
const idOrNull = (x) => {
  if (typeof x !== "string" && typeof x !== "number") return null;
  const s = String(x); if (ID_RE.test(s)) return s;
  const fixed = s.replace(/[^\w-]/g, "_").slice(0, 64);
  return /[A-Za-z0-9]/.test(fixed) ? fixed : null;
};
const num = (x, d = 0) => (typeof x === "number" && isFinite(x) ? x : d);
const posInt = (x) => (typeof x === "number" && isFinite(x) && x >= 1 ? Math.floor(x) : null);
export const validImage = (u) => typeof u === "string" && IMG_RE.test(u);

// Guarda o conteúdo bruto de uma chave ilegível antes de qualquer gravação por cima.
export function stashCorrupt(key, raw) {
  try { localStorage.setItem(key + "_danificado_" + Date.now(), raw); return true; } catch (e) { return false; }
}

function cleanGame(g, i) {
  if (!isObj(g)) return null;
  const pts = isObj(g.points) && typeof g.points.me === "number" && typeof g.points.opp === "number" ? { me: g.points.me, opp: g.points.opp } : null;
  const time = isObj(g.time) && typeof g.time.me === "number" && typeof g.time.opp === "number" ? { me: g.time.me, opp: g.time.opp } : null;
  const out = { ...g, n: i + 1, first: g.first === "me" || g.first === "opp" ? g.first : null, result: ["W", "L", "D"].includes(g.result) ? g.result : null,
    myBf: strOrNull(g.myBf), oppBf: strOrNull(g.oppBf), points: pts, log: Array.isArray(g.log) ? g.log.filter(isObj) : [] };
  if ("time" in g) out.time = time;
  if ("passes" in g) out.passes = num(g.passes);
  return out;
}
function cleanEventRef(e) {
  if (!isObj(e)) return { type: "Outro", eventId: null, round: null };
  return { type: str(e.type) || "Outro", eventId: idOrNull(e.eventId), round: posInt(e.round) };
}
function cleanDeck(d) {
  if (!isObj(d)) return null;
  const id = idOrNull(d.id); if (!id) return null;
  const legend = str(d.legend).trim();
  const vs = (Array.isArray(d.versions) ? d.versions : []).filter((v) => isObj(v) && idOrNull(v.id))
    .map((v, i) => ({ ...v, id: idOrNull(v.id), name: str(v.name).trim() || "v" + (i + 1), note: str(v.note), createdAt: num(v.createdAt) }));
  const bfs = (Array.isArray(d.battlefields) ? d.battlefields : []).map((b) => str(b)).slice(0, 3);
  while (bfs.length < 3) bfs.push("");
  return { ...d, id, name: str(d.name).trim() || legend || "Deck sem nome", legend, battlefields: bfs, set: str(d.set).slice(0, 16), archived: !!d.archived,
    versions: vs.length ? vs : [{ id: id.slice(0, 60) + "-v1", name: "v1", note: "", createdAt: num(d.createdAt) }],
    createdAt: num(d.createdAt) || num(d.updatedAt) || 1, updatedAt: num(d.updatedAt) };
}
function cleanEvent(e) {
  if (!isObj(e)) return null;
  const id = idOrNull(e.id); if (!id) return null;
  const date = num(e.date) || num(e.createdAt) || Date.now();
  return { ...e, id, name: str(e.name).trim() || "Evento", type: str(e.type) || "Outro", place: str(e.place), date,
    deckId: idOrNull(e.deckId), versionId: idOrNull(e.versionId), status: EVENT_STATUS.includes(e.status) ? e.status : "closed",
    placement: typeof e.placement === "number" && isFinite(e.placement) ? e.placement : null, players: typeof e.players === "number" && isFinite(e.players) ? e.players : null,
    topCut: !!e.topCut, note: str(e.note), createdAt: num(e.createdAt) || date, updatedAt: num(e.updatedAt) };
}
const CLEAN = { decks: cleanDeck, events: cleanEvent };
// Lista de decks/eventos: devolve só os válidos (ids repetidos: fica o primeiro).
export function cleanList(name, items) {
  const seen = new Set(), out = [];
  for (const it of Array.isArray(items) ? items : []) { const c = CLEAN[name](it); if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); } }
  return out;
}
export function cleanSettings(s) {
  const out = { sets: null, customLegends: {} };
  if (!isObj(s)) return out;
  if (isObj(s.customLegends)) for (const [name, l] of Object.entries(s.customLegends)) {
    if (!name || !isObj(l)) continue;
    const doms = (Array.isArray(l.domains) ? l.domains : []).filter((d) => typeof d === "string" && Object.prototype.hasOwnProperty.call(DOMAINS, d));
    out.customLegends[name] = { name, domains: doms.length === 2 ? doms : [], set: strOrNull(l.set) };
  }
  if (Array.isArray(s.sets)) {
    const seen = new Set();
    const list = s.sets.filter((x) => isObj(x) && typeof x.id === "string" && x.id.trim() && x.id.length <= 16 && str(x.name).trim() && typeof x.start === "string" && DATE_RE.test(x.start) && !seen.has(x.id) && seen.add(x.id))
      .map((x) => ({ id: x.id, name: x.name.trim(), start: x.start, ...(typeof x.color === "string" && COLOR_RE.test(x.color) ? { color: x.color } : {}), ...(typeof x.glyph === "string" && /^[a-z]{1,12}$/.test(x.glyph) ? { glyph: x.glyph } : {}) }));
    out.sets = list.length ? list : null;
  }
  return out;
}
function cleanImages(o) {
  const out = {};
  if (isObj(o)) for (const [n, u] of Object.entries(o)) if (n && validImage(u)) out[n] = u;
  return out;
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
    // JSON válido, mas com o formato errado (null, texto, listas que não são listas): mesma estratégia
    const okList = (x) => x === undefined || Array.isArray(x), okObj = (x) => x === undefined || isObj(x);
    let bad = !isObj(o) || !okList(o.matches) || !okList(o.decks) || !okList(o.events) || !okObj(o.settings) || !okObj(o.pending) || !okObj(o.listsAt);
    if (!isObj(o)) o = {};
    const ms = Array.isArray(o.matches) ? o.matches : [], ds = Array.isArray(o.decks) ? o.decks : [], es = Array.isArray(o.events) ? o.events : [];
    state.matches = dedupe(ms.map(normalize).filter(Boolean));
    state.settings = { ...state.settings, ...cleanSettings(o.settings) };
    state.pending = {};
    if (isObj(o.pending)) for (const [id, op] of Object.entries(o.pending)) if (op === "set" || op === "delete") state.pending[id] = op;
    state.decks = cleanList("decks", ds);
    state.events = cleanList("events", es);
    state.listsAt = { decks: num(isObj(o.listsAt) ? o.listsAt.decks : 0), events: num(isObj(o.listsAt) ? o.listsAt.events : 0) };
    sortMatches();
    // algum registro gravado não passou na validação: o original fica guardado à parte
    if (state.matches.length < ms.length || state.decks.length < ds.length || state.events.length < es.length) bad = true;
    if (bad) { if (stashCorrupt(LKEY, raw)) saveLocal(); state.repairedAt = Date.now(); }
  } catch (e) { console.warn(e); }
}
function dedupe(list) { const seen = new Set(); return list.filter((m) => !seen.has(m.id) && seen.add(m.id)); }

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
  if (!isObj(m)) return null;
  const name = (x) => (typeof x === "string" ? x.trim() : "");
  if (m.schema === SCHEMA) {
    const id = idOrNull(m.id), my = name(m.my), opp = name(m.opp);
    if (!id || !my || !opp || !["W", "L", "D"].includes(m.result)) return null;
    const format = m.format === "bo3" ? "bo3" : "bo1";
    const playedAt = num(m.playedAt) || num(m.createdAt) || Date.now();
    const games = (Array.isArray(m.games) ? m.games : []).map((g) => (isObj(g) ? g : null)).filter(Boolean).map(cleanGame);
    // placar: "2-1"; se vier em outro formato, é recalculado pelos games
    let sc = typeof m.score === "string" && SCORE_RE.test(m.score) ? m.score : "";
    if (!sc && format === "bo3") { const w = games.filter((g) => g.result === "W").length, l = games.filter((g) => g.result === "L").length; sc = w + l ? w + "-" + l : ""; }
    const out = { ...m, id, my, opp, format, playedAt, createdAt: num(m.createdAt) || playedAt, updatedAt: num(m.updatedAt), set: typeof m.set === "string" && m.set ? m.set.slice(0, 16) : setForDate(playedAt),
      deckId: idOrNull(m.deckId), versionId: idOrNull(m.versionId), version: str(m.version), event: cleanEventRef(m.event), score: sc, games,
      note: str(m.note), tags: Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string") : [] };
    if ("source" in m && typeof m.source !== "string") delete out.source;
    if ("endedBy" in m && typeof m.endedBy !== "string") delete out.endedBy;
    return out;
  }
  // formato do app antigo (v1)
  if (name(m.my) && name(m.opp) && (m.r === "V" || m.r === "D")) {
    m = { ...m, my: name(m.my), opp: name(m.opp), id: String(m.id ?? "").replace(/[^\w-]/g, "_").slice(0, 60) || Math.random().toString(36).slice(2, 8),
      d: num(m.d), ver: str(m.ver), ctx: str(m.ctx), note: str(m.note), score: typeof m.score === "string" && SCORE_RE.test(m.score) ? m.score : "" };
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

// Devolve quantos itens (decks, eventos, imagens) foram ignorados por serem inválidos.
export async function importLists(o) {
  let ignored = 0;
  if (o && isObj(o.images)) for (const [n, u] of Object.entries(o.images)) {
    if (!n || !validImage(u)) { ignored++; continue; }
    if (!state.images[n]) await saveImage(n, u);
  }
  for (const name of ["decks", "events"]) {
    if (!o || !Array.isArray(o[name])) continue;
    const list = state[name].slice();
    for (const raw of o[name]) {
      const it = CLEAN[name](raw);
      if (!it) { ignored++; continue; }
      const i = list.findIndex((x) => x.id === it.id);
      if (i < 0) list.push(it); else if ((it.updatedAt || 0) > (list[i].updatedAt || 0)) list[i] = it;
    }
    await saveList(name, list);
  }
  return ignored;
}

export async function importMatches(list, mode = "merge") {
  const norm = dedupe(list.map(normalize).filter(Boolean));
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
  state.settings = cleanSettings({ ...state.settings, ...patch });
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
function loadImagesLocal() {
  state.images = {};
  let raw = null; try { raw = localStorage.getItem(IKEY); } catch (e) {}
  if (!raw) return;
  let o; try { o = JSON.parse(raw); } catch (e) { o = undefined; }
  state.images = cleanImages(o);
  // tipo errado ou imagem inválida: guarda o original e regrava só o que é válido
  if (!isObj(o) || Object.keys(state.images).length < Object.keys(o).length) { if (stashCorrupt(IKEY, raw)) try { localStorage.setItem(IKEY, JSON.stringify(state.images)); } catch (e) {} }
}
function saveImagesLocal() { try { localStorage.setItem(IKEY, JSON.stringify(state.images)); return true; } catch (e) { emitError("Sem espaço no aparelho para mais imagens."); return false; } }
export async function saveImage(name, dataUrl) {
  if (dataUrl && !validImage(dataUrl)) return false;
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
      snapI.docs.forEach((d) => { const x = d.data(); if (x && typeof x.name === "string" && x.name && validImage(x.data)) remote[x.name] = x.data; });
      for (const [n, u] of Object.entries(state.images)) {
        if (!remote[n]) { try { await imagesCol.doc(imgId(n)).set({ name: n, data: u, updatedAt: Date.now() }); } catch (e) { console.warn(e); } }
      }
      state.images = { ...state.images, ...remote };
      saveImagesLocal(); state.imagesAt = Date.now(); emit();
    } catch (e) { console.warn("imagens", e); }

    const s = await settingsDoc.get().catch(() => null);
    if (s && s.exists) { state.settings = cleanSettings({ ...state.settings, ...s.data() }); }

    for (const name of ["decks", "events"]) {
      listDocs[name] = db.doc("data/users/" + uid + "/" + name);
      const snap = await listDocs[name].get().catch(() => null);
      const remote = snap && snap.exists ? snap.data() : null;
      if (remote && (remote.updatedAt || 0) >= (state.listsAt[name] || 0)) {
        state[name] = cleanList(name, remote.items);
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

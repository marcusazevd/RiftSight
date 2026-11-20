// Utilidades compartilhadas entre as telas.
import * as S from "./store.js";
import { $, $$ } from "./ui.js";
import { BATTLEFIELDS, BANNED_BF } from "./data.js";

export const APP_VERSION = "0.9.5 · Arcade";
export const RES = { W: "Vitória", L: "Derrota", D: "Empate" };
export const RES_SHORT = { W: "V", L: "D", D: "E" };

// preferências locais (último deck, tema…)
const PKEY = "rbt_prefs";
export let prefs = {};
// Preferências ilegíveis ou de tipo errado (null, texto solto): guarda o original e segue com os padrões.
(function loadPrefs() {
  let raw = null; try { raw = localStorage.getItem(PKEY); } catch (e) {}
  if (!raw) return;
  let o; try { o = JSON.parse(raw); } catch (e) { o = undefined; }
  if (!o || typeof o !== "object" || Array.isArray(o)) { if (S.stashCorrupt(PKEY, raw)) try { localStorage.removeItem(PKEY); } catch (e) {} return; }
  for (const k of ["my", "ver", "ctx", "ctxOut", "fmt", "place", "theme"]) if (k in o && typeof o[k] !== "string") delete o[k];
  if ("deckId" in o && o.deckId !== null && typeof o.deckId !== "string") delete o.deckId;
  prefs = o;
})();
export function savePrefs() { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {} }
export function applyTheme() {
  const t = prefs.theme || "auto";
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
}

export function toLocalInput(ms) { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
export function toLocalDate(ms) { return toLocalInput(ms).slice(0, 10); }
export function fromLocalInput(v) { const t = new Date(v).getTime(); return isNaN(t) ? Date.now() : t; }
export const setName = (id) => (S.sets().find((s) => s.id === id) || { name: id || "—" }).name;
export const fmtDate = (ms) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ---------- battlefields ----------
// Nome "normalizado" para casar variações de digitação: "Emperor dais" = "Emperor's Dais".
export const bfKey = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((w) => w.replace(/s$/, "")).join(" ");
const CATALOG = Object.entries(BATTLEFIELDS).flatMap(([set, names]) => names.map((name) => ({ name, set, banned: BANNED_BF.includes(name) })));
const CAT_BY_KEY = new Map(CATALOG.map((b) => [bfKey(b.name), b]));
// nome oficial quando reconhecido; senão o que foi digitado
export const canonBf = (n) => (n ? (CAT_BY_KEY.get(bfKey(n)) || { name: n }).name : n);
export const bfInfo = (n) => CAT_BY_KEY.get(bfKey(n)) || null;

// battlefields já usados, do mais frequente para o menos (nomes oficiais quando reconhecidos)
export function knownBattlefields() {
  const c = new Map(), add = (b, w = 1) => { if (b) { const k = canonBf(b); c.set(k, (c.get(k) || 0) + w); } };
  S.getState().decks.forEach((d) => (d.battlefields || []).forEach((b) => add(b, 0.5)));
  S.getState().matches.forEach((m) => (m.games || []).forEach((g) => { add(g.myBf); add(g.oppBf); }));
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map((x) => x[0]);
}
// Sugestões separadas por lado: as do oponente só com battlefields que oponentes já usaram;
// as minhas com os dos meus decks e os que eu já joguei.
function countBf(add) {
  const c = new Map(); add((b, w = 1) => { if (b) { const k = canonBf(b); c.set(k, (c.get(k) || 0) + w); } });
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map((x) => x[0]);
}
export function knownOppBattlefields() {
  return countBf((add) => S.getState().matches.forEach((m) => (m.games || []).forEach((g) => add(g.oppBf))));
}
export function knownMyBattlefields() {
  return countBf((add) => {
    S.getState().decks.forEach((d) => (d.battlefields || []).forEach((b) => add(b, 0.5)));
    S.getState().matches.forEach((m) => (m.games || []).forEach((g) => add(g.myBf)));
  });
}
// todos: catálogo (set mais novo primeiro) + nomes digitados que não estão nele
export function allBattlefields() {
  const order = S.sets().map((s) => s.id).reverse();
  const cat = CATALOG.slice().sort((a, b) => (order.indexOf(a.set) - order.indexOf(b.set)) || a.name.localeCompare(b.name));
  const extra = knownBattlefields().filter((n) => !bfInfo(n)).map((name) => ({ name, set: null, banned: false }));
  return [...cat, ...extra];
}

// Seletor de battlefield: atalhos em botões (os 3 do deck ou os mais vistos) + busca em todos.
// O valor fica num input oculto com o id dado, então quem lê .value continua funcionando.
export function bfPicker(id, value, options, used = [], max = 5) {
  value = canonBf(value);
  const usedC = used.map(canonBf);
  const opts = [...new Set([...(value ? [value] : []), ...options.filter(Boolean).map(canonBf)])].slice(0, Math.max(max, value ? 1 : 0));
  const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<div class="bfp" data-bfp="${id}" data-used="${e(JSON.stringify(usedC))}"><input type="hidden" id="${id}" value="${e(value || "")}">${opts.map((o) => {
    const on = o === value, dis = !on && usedC.includes(o);
    return `<button type="button" class="bfc${on ? " on" : ""}" data-bfv="${e(o)}"${dis ? ' disabled title="Já usado neste match"' : ""}>${e(o)}</button>`;
  }).join("")}<button type="button" class="bfc new" data-bfsearch="1">🔍 Buscar</button></div>`;
}
// ---------- contador em andamento (rbt_live) ----------
// Lê o estado guardado do contador. Formato errado (sem games, sem pontos…) é tratado como
// dado danificado: o original fica guardado à parte e o contador recomeça do zero.
const LIVE_KEY = "rbt_live", LIVE_PHASES = ["setup", "play", "between", "gameover", "summary"];
function validLive(o) {
  if (!o || typeof o !== "object" || Array.isArray(o) || !LIVE_PHASES.includes(o.phase)) return false;
  if (typeof o.my !== "string" || typeof o.opp !== "string" || !Array.isArray(o.games)) return false;
  if (o.phase === "setup") return true;
  const okGame = (g) => g && typeof g === "object" && g.points && typeof g.points.me === "number" && typeof g.points.opp === "number" && Array.isArray(g.log) && typeof (g.passes || 0) === "number"
    && (!g.time || (typeof g.time.me === "number" && typeof g.time.opp === "number"));
  return o.games.length > 0 && o.games.every(okGame) && Number.isInteger(o.cur) && o.cur >= 0 && o.cur < o.games.length && !!o.my && !!o.opp;
}
let liveLostAt = 0;
export const liveLost = () => liveLostAt;
export function readLive() {
  let raw = null; try { raw = localStorage.getItem(LIVE_KEY); } catch (e) {}
  if (!raw || raw === "null") return null;
  let o; try { o = JSON.parse(raw); } catch (e) { o = undefined; }
  if (validLive(o)) return o;
  if (S.stashCorrupt(LIVE_KEY, raw)) try { localStorage.removeItem(LIVE_KEY); } catch (e) {}
  liveLostAt = Date.now(); // o aviso de dados reparados conta que o placar em andamento se perdeu
  return null;
}
export const fmtClock = (ms) => { const t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };

export function resultFromGames(games) {
  const w = games.filter((g) => g.result === "W").length, l = games.filter((g) => g.result === "L").length;
  return { w, l, result: w > l ? "W" : l > w ? "L" : "D", score: w + "-" + l };
}

// resumo de evento: recorde das partidas ligadas a ele
export function eventRecord(ev) {
  const ms = S.getState().matches.filter((m) => m.event && m.event.eventId === ev.id);
  const r = { w: 0, l: 0, d: 0, n: ms.length, matches: ms, ids: 0, byes: 0 };
  // ID conta como empate e bye como vitória (o resultado gravado já é esse); os dois ocupam a rodada
  ms.forEach((m) => { if (m.result === "W") r.w++; else if (m.result === "L") r.l++; else r.d++; if (m.kind === "id") r.ids++; if (m.kind === "bye") r.byes++; });
  return r;
}
// Recorde no formato V–D–E (o E só aparece quando houver empate ou ID).
export const recTxt = (r) => `${r.w}–${r.l}${r.d ? "–" + r.d : ""}`;
// Legenda do recorde quando há empate/ID (3–1–1 · V–D–E); sem empate fica só "3–1".
export const recLegend = (r) => (r.d ? "V–D–E" : "");
export const recPlain = (r) => recTxt(r) + (r.d ? " (V–D–E)" : "");
export const recHTML = (r) => `${recTxt(r)}${r.d ? ' <span class="vde">V–D–E</span>' : ""}`;
export const KIND_LABEL = { id: "ID", bye: "BYE" };
// Texto curto de uma rodada: "2–1 vs Viktor", "ID · vs Kai'Sa · sem games", "BYE · sem oponente".
export function roundText(m) {
  if (m.kind === "id") return (m.opp ? "vs " + m.opp : "sem oponente marcado") + " · sem games";
  if (m.kind === "bye") return "sem oponente · conta como vitória";
  const g1 = m.games && m.games[0];
  const sc = m.score ? m.score.replace("-", "–") + " " : m.format !== "bo3" && g1 && g1.points ? g1.points.me + "–" + g1.points.opp + " " : "";
  return sc + "vs " + m.opp;
}

// navegação: cada tela registra seu render
const views = {};
let current = "add";
export function registerView(name, render) { views[name] = render; }
export function currentView() { return current; }
export function showView(v, opts) {
  current = v;
  $$("nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === v));
  $$("main > section").forEach((s) => s.classList.toggle("hide", s.id !== v));
  document.body.classList.toggle("live-on", v === "live");
  document.body.classList.toggle("home-on", v === "add");
  // o placar em tela cheia só existe no contador: ao sair, cabeçalho e navegação voltam
  if (v !== "live") document.body.classList.remove("board-on");
  if (views[v]) views[v](opts);
  window.scrollTo(0, 0);
}
export function rerender() { if (views[current] && current !== "add" && current !== "live") views[current](); }

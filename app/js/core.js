// Utilidades compartilhadas entre as telas.
import * as S from "./store.js";
import { $, $$ } from "./ui.js";
import { BATTLEFIELDS, BANNED_BF } from "./data.js";

export const APP_VERSION = "0.9.1 · Arcade";
export const RES = { W: "Vitória", L: "Derrota", D: "Empate" };
export const RES_SHORT = { W: "V", L: "D", D: "E" };

// preferências locais (último deck, tema…)
const PKEY = "rbt_prefs";
export let prefs = {};
try { prefs = JSON.parse(localStorage.getItem(PKEY) || "{}"); } catch (e) { prefs = {}; }
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
export const fmtClock = (ms) => { const t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };

export function resultFromGames(games) {
  const w = games.filter((g) => g.result === "W").length, l = games.filter((g) => g.result === "L").length;
  return { w, l, result: w > l ? "W" : l > w ? "L" : "D", score: w + "-" + l };
}

// resumo de evento: recorde das partidas ligadas a ele
export function eventRecord(ev) {
  const ms = S.getState().matches.filter((m) => m.event && m.event.eventId === ev.id);
  const r = { w: 0, l: 0, d: 0, n: ms.length, matches: ms };
  ms.forEach((m) => { if (m.result === "W") r.w++; else if (m.result === "L") r.l++; else r.d++; });
  return r;
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
  if (views[v]) views[v](opts);
  window.scrollTo(0, 0);
}
export function rerender() { if (views[current] && current !== "add" && current !== "live") views[current](); }

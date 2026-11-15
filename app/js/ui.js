// Componentes visuais: ícones de domínio, avatares, diálogos e avisos.
import { DOMAINS, LEGENDS } from "./data.js";
import { getState, sets as allSets } from "./store.js";
import { DEFAULT_SETS, SET_PALETTE } from "./data.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Ícones próprios (traço), inspirados no tema de cada domínio.
const GLYPH = {
  fury: "M12 3c.5 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-6 .5 2 1.5 3 2.5 3.5C12.6 8.5 12.6 6 12 3z",
  calm: "M3.5 9c2.8-2.2 5.7-2.2 8.5 0s5.7 2.2 8.5 0M3.5 15c2.8-2.2 5.7-2.2 8.5 0s5.7 2.2 8.5 0",
  mind: "M12 3l8 9-8 9-8-9zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z",
  body: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z",
  chaos: "M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2",
  order: "M4 20h16M6.5 20v-9M12 20v-9M17.5 20v-9M3.5 11L12 4.5l8.5 6.5z",
};
export function domainIcon(d, size = 16) {
  const dm = DOMAINS[d]; if (!dm) return "";
  return `<svg class="dom" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${dm.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${dm.name}"><path d="${GLYPH[d]}"/></svg>`;
}
export const RUNE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M12 6.5l4 5.5-4 5.5-4-5.5z"/><path d="M12 2.5v4M12 17.5v4"/></svg>`;

export function legendInfo(name) {
  if (LEGENDS[name]) return LEGENDS[name];
  const c = getState().settings.customLegends || {};
  return c[name] || { name, domains: [], set: null };
}
export function legendColors(name) {
  const d = legendInfo(name).domains;
  if (d && d.length === 2) return [DOMAINS[d[0]].color, DOMAINS[d[1]].color];
  return ["#8d7a52", "#4a4232"];
}

function initials(n) {
  const base = n.split(" - ")[0];
  const w = base.split(/[\s'-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : base.slice(0, 2)).toUpperCase();
}

// Avatar hexagonal com as cores dos dois domínios da lenda.
export function avatar(name, size = 40) {
  if (!name) return `<span class="av emp" style="--s:${size}px">+</span>`;
  const [a, b] = legendColors(name);
  const img = getState().images[name];
  if (img) return `<span class="av img" style="--s:${size}px;--a:${a};--b:${b}"><img src="${img}" alt="" draggable="false"></span>`;
  return `<span class="av" style="--s:${size}px;--a:${a};--b:${b}"><span>${esc(initials(name))}</span></span>`;
}
// Selo de set (C5): ícone pixelado próprio + sigla, na cor do set.
const SET_GLYPH = {
  origin: "M5 1h2v2h2v2h2v2H9v2H7v2H5V9H3V7H1V5h2V3h2z",
  spirit: "M5 1h2v2h1v2h1v3H8v2H4V8H3V5h1V3h1zM5 6v2h2V6z",
  claw: "M2 1h2v3h1v3h1v4H4V8H3V5H2zM6 1h2v2h1v3h1v5H8V7H7V4H6z",
  blade: "M9 1h2v2h-1v2H9v2H8v1H6v1H5v2H3v-2H1V8h2V7h1V6h1V5h1V4h1V3h1z",
  sun: "M5 0h2v2H5zM5 10h2v2H5zM0 5h2v2H0zM10 5h2v2h-2zM4 3h4v1h1v4H8v1H4V8H3V4h1z",
  gem: "M4 1h4v2h2v2h1v2h-1v2H8v2H4V9H2V7H1V5h1V3h2z",
};
export function setInfo(id) {
  const s = allSets().find((x) => x.id === id) || DEFAULT_SETS.find((x) => x.id === id) || { id, name: id || "—" };
  const def = DEFAULT_SETS.find((x) => x.id === id);
  const n = [...String(id || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { ...s, color: s.color || (def && def.color) || SET_PALETTE[n % SET_PALETTE.length], glyph: s.glyph || (def && def.glyph) || "gem" };
}
export function setGlyph(id, size = 10) {
  const s = setInfo(id);
  return `<svg width="${size}" height="${size}" viewBox="0 0 12 12" fill="${s.color}" shape-rendering="crispEdges" aria-hidden="true"><path d="${SET_GLYPH[s.glyph] || SET_GLYPH.gem}"/></svg>`;
}
export function setBadge(id, { full = false } = {}) {
  if (!id) return `<span class="setb" style="--sc:var(--mut)">—</span>`;
  const s = setInfo(id);
  return `<span class="setb" style="--sc:${s.color}" title="${esc(s.name)}">${setGlyph(id)}${esc(full ? s.name : s.id)}</span>`;
}
export function domainPair(name, size = 14) {
  return (legendInfo(name).domains || []).map((d) => domainIcon(d, size)).join("");
}

// ---------- diálogos próprios (alert/confirm/prompt são bloqueados) ----------
let dlgRoot;
function root() {
  if (!dlgRoot) { dlgRoot = document.createElement("div"); dlgRoot.id = "dlg"; document.body.appendChild(dlgRoot); }
  return dlgRoot;
}
export function dialog({ title, body = "", actions = [{ label: "OK", value: true, primary: true }], onOpen }) {
  return new Promise((resolve) => {
    const r = root();
    r.innerHTML = `<div class="scrim" data-v="__cancel"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h3 id="dlg-t">${esc(title)}</h3><div class="dlg-body">${body}</div>
      <div class="dlg-act">${actions.map((a, i) => `<button type="button" class="btn ${a.primary ? "pri" : ""} ${a.danger ? "dan" : ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div></div>`;
    r.classList.add("on");
    const close = (v) => { r.classList.remove("on"); r.innerHTML = ""; document.removeEventListener("keydown", key); resolve(v); };
    const key = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", key);
    r.onclick = (e) => {
      if (e.target.dataset.v === "__cancel") return close(null);
      const b = e.target.closest("button[data-i]");
      if (b) { const a = actions[+b.dataset.i]; close(typeof a.value === "function" ? a.value(r) : a.value); }
    };
    if (onOpen) onOpen(r);
    const f = r.querySelector("input,textarea,select,.btn.pri"); if (f) setTimeout(() => f.focus(), 30);
  });
}
export const confirmBox = (title, text, okLabel = "Confirmar", danger = false) =>
  dialog({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: "Cancelar", value: false }, { label: okLabel, value: true, primary: !danger, danger }] });
export const promptBox = (title, label, value = "") =>
  dialog({
    title, body: `<label class="lbl" for="dlg-in">${esc(label)}</label><input id="dlg-in" value="${esc(value)}" autocomplete="off">`,
    actions: [{ label: "Cancelar", value: null }, { label: "OK", primary: true, value: (r) => r.querySelector("#dlg-in").value.trim() || null }],
    onOpen: (r) => r.querySelector("#dlg-in").addEventListener("keydown", (e) => { if (e.key === "Enter") r.querySelector(".btn.pri").click(); }),
  });

let toastT;
export function toast(msg, action = null, ms = 2200) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.toggle("act", !!action);
  if (action) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = action.label;
    b.onclick = () => { t.classList.remove("on"); clearTimeout(toastT); action.fn(); };
    t.appendChild(b);
  }
  t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), action ? 6000 : ms);
}

// Tela "Registrar": resumo (recorde e últimas), atalho para o contador, evento e registro manual (recolhível).
import { DOMAINS, LEGENDS, EVENT_TYPES } from "./data.js";
import * as S from "./store.js";
import { esc, $, $$, avatar, domainPair, legendInfo, legendColors, dialog, confirmBox, promptBox, toast, RUNE } from "./ui.js";
import { backupBanner, handleBackupBanner } from "./views.js";
import { RES, prefs, savePrefs, toLocalInput, toLocalDate, fromLocalInput, fmtDate, knownMyBattlefields, resultFromGames, eventRecord, registerView, showView, currentView, readLive, canonBf, bfKey, allBattlefields, KIND_LABEL, recTxt, roundText } from "./core.js";

let F;
export function blankForm() {
  const ev = S.openEvent();
  let dk = prefs.deckId ? S.deck(prefs.deckId) : null;
  if (dk && dk.archived) dk = null;
  // sem preferência salva: começa com o deck mais recente
  if (!dk && prefs.deckId === undefined) dk = S.getState().decks.filter((d) => !d.archived).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  return {
    editId: null, deckId: dk ? dk.id : null, versionId: dk ? lastVersionId(dk) : null,
    my: dk ? dk.legend : prefs.my || "", opp: "", ver: dk ? "" : prefs.ver || "",
    ctx: ev ? ev.type : freeCtx(), eventId: ev ? ev.id : null, round: null,
    turn: "", note: "", fmt: prefs.fmt || "bo1", result: "", myBf: "", oppBf: "", kind: "",
    games: [g0(), g0(), g0()], timeDraw: false,
    date: toLocalInput(Date.now()), dateTouched: false, set: "", setTouched: false, details: false, manual: !!prefs.manual,
  };
}
const g0 = () => ({ first: "", result: "", myBf: "", oppBf: "" });
// Fora de evento o tipo padrão é "Casual" (ou o último que o jogador escolheu fora de evento):
// o tipo do último evento não vaza para as partidas soltas.
export function freeCtx() { return EVENT_TYPES.includes(prefs.ctxOut) ? prefs.ctxOut : "Casual"; }
export const lastVersionId = (dk) => (dk && dk.versions && dk.versions.length ? dk.versions[dk.versions.length - 1].id : null);
export function versionName(dk, vid) { const v = dk && dk.versions ? dk.versions.find((x) => x.id === vid) : null; return v ? v.name : ""; }
F = blankForm();

// ---------- lendas e decks ----------
function allLegends() {
  const names = new Set(Object.keys(LEGENDS));
  Object.keys(S.getState().settings.customLegends || {}).forEach((n) => names.add(n));
  S.getState().matches.forEach((m) => { names.add(m.my); names.add(m.opp); });
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

export function legendOptions() {
  return allLegends().map((n) => `<div class="po" tabindex="-1" data-n="${esc(n)}">${avatar(n, 30)}<span class="nm">${esc(n)}</span><span class="doms">${domainPair(n, 13)}</span><span class="st">${esc(legendInfo(n).set || "")}</span></div>`).join("");
}
function deckOptions() {
  const ds = S.getState().decks.filter((d) => !d.archived);
  if (!ds.length) return "";
  return `<div class="pg">Meus decks</div>${ds.map((d) => `<div class="po" tabindex="-1" data-deck="${esc(d.id)}" data-n="${esc(d.name + " " + d.legend)}">${avatar(d.legend, 30)}<span class="nm">${esc(d.name)}<span class="st" style="display:block">${esc(d.legend)}</span></span><span class="doms">${domainPair(d.legend, 13)}</span></div>`).join("")}<div class="pg">Só a lenda</div>`;
}
export const myLabel = (dk) => (dk ? "Seu deck" : S.getState().decks.some((d) => !d.archived) ? "Seu deck ou lenda" : "Sua lenda");
export function pickerHTML(side, value, label, withDecks, deckId = null, empty = "Escolher") {
  const dk = withDecks && deckId ? S.deck(deckId) : null;
  return `<div class="lbl">${label}</div>
    <button type="button" class="pb" aria-haspopup="listbox" aria-label="${esc(label)}: ${esc(dk ? dk.name : value || "escolher")}">${avatar(value, 66)}<span class="pt">${dk ? esc(dk.name) : value ? esc(value) : esc(empty)}</span><span class="doms">${value ? domainPair(value, 14) : ""}</span></button>
    <div class="pl hide" role="listbox"><input class="ps" placeholder="Buscar…" autocomplete="off" aria-label="Buscar">${withDecks ? deckOptions() : ""}${legendOptions()}<div class="po pn" data-n="__new">＋ Outra lenda…</div></div>`;
}
export function paintMatchup(mu, my, opp) {
  if (!mu) return;
  const [ma, mb] = my ? legendColors(my) : ["transparent", "transparent"];
  const [oa, ob] = opp ? legendColors(opp) : ["transparent", "transparent"];
  mu.style.setProperty("--my-a", ma); mu.style.setProperty("--my-b", mb);
  mu.style.setProperty("--op-a", oa); mu.style.setProperty("--op-b", ob);
}
export function filterPicker(input) {
  const raw = input.value.trim(), q = norm(raw), l = input.parentNode; let exact = false;
  $$(".po", l).forEach((o) => { if (o.classList.contains("pn")) return; const n = norm(o.dataset.n); o.classList.toggle("hide", !n.includes(q)); if (n === q) exact = true; });
  $$(".pg", l).forEach((g) => g.classList.toggle("hide", !!raw));
  const pn = $(".pn", l);
  if (raw && !exact) { pn.dataset.q = raw; pn.textContent = `＋ Usar "${raw}"`; } else { delete pn.dataset.q; pn.textContent = "＋ Outra lenda…"; }
}
export async function newLegend(name) {
  if (!name) name = await promptBox("Outra lenda", "Nome da lenda");
  if (!name) return null;
  if (LEGENDS[name]) return name;
  const opt = Object.entries(DOMAINS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join("");
  const doms = await dialog({
    title: "Domínios de " + name,
    body: `<p class="m">Usados para as cores do avatar. Pode deixar em branco.</p><div class="row"><div><label for="d1">Domínio 1</label><select id="d1"><option value="">—</option>${opt}</select></div><div><label for="d2">Domínio 2</label><select id="d2"><option value="">—</option>${opt}</select></div></div>`,
    actions: [{ label: "Pular", value: [] }, { label: "Salvar", primary: true, value: (r) => [$("#d1", r).value, $("#d2", r).value].filter(Boolean) }],
  });
  const custom = { ...(S.getState().settings.customLegends || {}) };
  custom[name] = { name, domains: doms && doms.length === 2 ? doms : [], set: null };
  await S.saveSettings({ customLegends: custom });
  return name;
}
// Liga eventos de um seletor (usado aqui e no contador). onPick(side, {legend, deckId})
export function bindPickers(root, onPick) {
  root.addEventListener("click", async (e) => {
    const pk = e.target.closest(".pick");
    $$(".pl", root).forEach((l) => { if (!pk || l.parentNode !== pk) l.classList.add("hide"); });
    if (!pk) return;
    const o = e.target.closest(".po");
    if (o) {
      if (o.dataset.deck) { const d = S.deck(o.dataset.deck); return onPick(pk.dataset.side, { legend: d.legend, deckId: d.id }); }
      let n = o.dataset.n;
      if (n === "__new") { n = await newLegend(o.dataset.q || ""); if (!n) return; }
      return onPick(pk.dataset.side, { legend: n, deckId: null });
    }
    if (e.target.closest(".pb")) {
      const l = $(".pl", pk); l.classList.toggle("hide");
      if (!l.classList.contains("hide")) { const s = $(".ps", l); s.value = ""; filterPicker(s); s.focus(); }
    }
  });
  root.addEventListener("input", (e) => { if (e.target.classList.contains("ps")) filterPicker(e.target); });
  root.addEventListener("keydown", (e) => {
    if (!e.target.classList.contains("ps")) return;
    const vis = $$(".po:not(.hide)", e.target.parentNode);
    if (e.key === "Enter") { e.preventDefault(); if (vis[0]) vis[0].click(); }
    if (e.key === "Escape") e.target.parentNode.classList.add("hide");
  });
}

// ---------- versão do deck ----------
export function versionField(id, deckId, versionId, verText, listId) {
  const dk = deckId ? S.deck(deckId) : null;
  if (dk) {
    return `<select id="${id}">${(dk.versions || []).slice().reverse().map((v) => `<option value="${esc(v.id)}"${v.id === versionId ? " selected" : ""}>${esc(v.name)}${v.note ? " — " + esc(v.note) : ""}</option>`).join("")}<option value="__new">＋ Nova versão…</option></select>`;
  }
  const versions = [...new Set(S.getState().matches.map((m) => m.version).filter(Boolean))].sort();
  return `<input id="${id}" list="${listId}" placeholder="Ex.: v2, mais agressivo" value="${esc(verText)}" autocomplete="off"><datalist id="${listId}">${versions.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
}
export async function newVersion(deckId) {
  const dk = S.deck(deckId); if (!dk) return null;
  const v = await dialog({
    title: "Nova versão de " + dk.name,
    body: `<label for="vn">Nome</label><input id="vn" value="v${(dk.versions || []).length + 1}"><label for="vt">O que mudou</label><input id="vt" placeholder="Ex.: +2 Removal, −2 unidade cara">`,
    actions: [{ label: "Cancelar", value: null }, { label: "Criar", primary: true, value: (r) => ({ name: $("#vn", r).value.trim(), note: $("#vt", r).value.trim() }) }],
  });
  if (!v || !v.name) return null;
  const ver = { id: S.newKey("v"), name: v.name, note: v.note, createdAt: Date.now() };
  await S.upsert("decks", { ...dk, versions: [...(dk.versions || []), ver] });
  return ver.id;
}

// ---------- eventos ----------
export async function startEvent() {
  const ds = S.getState().decks.filter((d) => !d.archived);
  const v = await dialog({
    title: "Começar evento",
    body: `<label for="en">Nome</label><input id="en" placeholder="Ex.: Nexus Night da loja">
      <div class="row"><div><label for="et">Tipo</label><select id="et">${EVENT_TYPES.map((t) => `<option${t === (prefs.ctx || "Nexus Night") ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <div><label for="ed">Data</label><input id="ed" type="date" value="${toLocalDate(Date.now())}"></div></div>
      <label for="ep">Loja / local</label><input id="ep" value="${esc(prefs.place || "")}">
      ${ds.length ? `<label for="ek">Deck</label><select id="ek"><option value="">—</option>${ds.map((d) => `<option value="${esc(d.id)}"${d.id === F.deckId ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select>` : ""}`,
    actions: [{ label: "Cancelar", value: null }, { label: "Começar", primary: true, value: (r) => ({ name: $("#en", r).value.trim(), type: $("#et", r).value, date: $("#ed", r).value, place: $("#ep", r).value.trim(), deckId: $("#ek", r) ? $("#ek", r).value : "" }) }],
  });
  if (!v) return null;
  const date = v.date ? fromLocalInput(v.date + "T12:00") : Date.now();
  const dk = v.deckId ? S.deck(v.deckId) : null;
  const ev = { id: S.newKey("e"), name: v.name || v.type + " " + fmtDate(date), type: v.type, place: v.place, date,
    deckId: dk ? dk.id : null, versionId: dk ? lastVersionId(dk) : null, status: "open", placement: null, topCut: false, note: "", createdAt: Date.now() };
  prefs.place = v.place; prefs.ctx = v.type; savePrefs();
  await S.upsert("events", ev);
  toast("Evento começou: " + ev.name);
  return ev;
}
export async function closeEvent(ev) {
  const r = eventRecord(ev);
  const v = await dialog({
    title: "Encerrar " + ev.name,
    body: `<p>Recorde: <b>${r.w}-${r.l}${r.d ? "-" + r.d : ""}</b> em ${r.n} rodada${r.n !== 1 ? "s" : ""}.</p>
      <div class="row"><div><label for="cp">Colocação final</label><input id="cp" type="number" min="1" inputmode="numeric" placeholder="Ex.: 3"></div>
      <div><label for="cj">Jogadores</label><input id="cj" type="number" min="2" inputmode="numeric"></div></div>
      <label class="ck"><input type="checkbox" id="ct"> Fiquei no top cut</label>
      <label for="cn">Notas do evento</label><textarea id="cn" rows="2"></textarea>`,
    actions: [{ label: "Cancelar", value: null }, { label: "Encerrar", primary: true, value: (x) => ({ placement: +$("#cp", x).value || null, players: +$("#cj", x).value || null, topCut: $("#ct", x).checked, note: $("#cn", x).value.trim() }) }],
  });
  if (!v) return false;
  await S.upsert("events", { ...ev, ...v, status: "closed" });
  toast("Evento encerrado", { label: "Card", fn: async () => { const { shareEvent } = await import("./share.js"); shareEvent(S.evt(ev.id)); } }, 5000);
  return true;
}
export function nextRound(eventId) {
  const ms = S.getState().matches.filter((m) => m.event && m.event.eventId === eventId);
  return ms.reduce((a, m) => Math.max(a, m.event.round || 0), 0) + 1;
}
function eventBanner() {
  const ev = S.openEvent();
  if (!ev) return "";
  const r = eventRecord(ev);
  return `<div class="evbar"><div><span class="tag">EVENTO EM ANDAMENTO</span><br><b>${esc(ev.name)}</b> <span class="m">· ${esc(ev.type)}</span><div class="m">Rodada ${esc(nextRound(ev.id))} · ${r.w}-${r.l}${r.d ? "-" + r.d : ""}${ev.place ? " · " + esc(ev.place) : ""}</div></div><button class="btn" type="button" id="ev-close">Encerrar</button></div>`;
}

// faixa de status: recorde, últimas 5 e sequência
function statusStrip() {
  const ms = S.played(); if (!ms.length) return "";
  const w = ms.filter((m) => m.result === "W").length, l = ms.filter((m) => m.result === "L").length, d = ms.length - w - l;
  const last = ms.slice(-5);
  let n = 0; const r = ms[ms.length - 1].result; for (let i = ms.length - 1; i >= 0 && ms[i].result === r; i--) n++;
  return `<div class="sstrip"><div class="ss-rec"><b>${w}–${l}${d ? "–" + d : ""}</b><span>${Math.round((w / ms.length) * 100)}% · ${ms.length} partidas</span></div>
    <div class="ss-last">${last.map((m) => `<span class="chip ${m.result}">${{ W: "V", L: "D", D: "E" }[m.result]}</span>`).join("")}${r === "W" && n > 1 ? `<span class="ss-streak">x${n}</span>` : ""}</div></div>`;
}
// ---------- render ----------
// Bo3: os games valem em ordem, sem buraco, e o match acaba quando alguém chega a 2.
// Devolve os games que contam (até a decisão) e se há game marcado depois de um em branco.
function bo3Games() {
  const used = []; let w = 0, l = 0, gap = -1, hole = null;
  for (const [i, g] of F.games.entries()) {
    if (!g.result) { if (gap < 0) gap = i; continue; }
    if (gap >= 0) { hole = { blank: gap + 1, marked: i + 1 }; break; } // ex.: Game 1 em branco e Game 2 marcado
    if (w === 2 || l === 2) break;
    used.push(g); if (g.result === "W") w++; else if (g.result === "L") l++;
  }
  return { used, hole };
}
const clearGame = (g) => { g.result = ""; g.first = ""; };
const pressed = (on) => `class="${on ? "on" : ""}" aria-pressed="${on ? "true" : "false"}"`;

// ---------- battlefields do game (0.9.5: um botão por game, que abre a folha) ----------
// "b1" = a partida única; 0, 1, 2 = games do Bo3.
const bfOf = (i) => (i === "b1" ? F : F.games[+i]);
const gameName = (i) => (i === "b1" ? "" : ` do game ${+i + 1}`);
function bfBtn(i) {
  const g = bfOf(i), mine = canonBf(g.myBf), theirs = canonBf(g.oppBf);
  if (!mine && !theirs) return `<button type="button" class="gbf empty" data-bfg="${i}" aria-haspopup="dialog"><span>+ battlefields${gameName(i)}</span><i aria-hidden="true">▾</i></button>`;
  return `<button type="button" class="gbf" data-bfg="${i}" aria-haspopup="dialog" aria-label="Battlefields${gameName(i)}: seu ${esc(mine || "não marcado")}, do oponente ${esc(theirs || "não marcado")}. Alterar">
    <span class="bm">${esc(mine || "—")}</span><span class="bx" aria-hidden="true">×</span><span class="bt">${esc(theirs || "—")}</span><i aria-hidden="true">▾</i></button>`;
}

function gamesHTML() {
  const rows = [];
  const g = F.games;
  const split = !!(g[0].result && g[1].result && g[0].result !== g[1].result);
  // game 3 só existe com 1–1; continua à vista enquanto guardar um resultado (ex.: G1 desmarcado por engano)
  const showG3 = !F.timeDraw && (split || !!g[2].result);
  const n = showG3 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = g[i];
    rows.push(`<div class="gm" data-g="${i}"><div class="gline"><span class="gn" aria-hidden="true">G${i + 1}</span>
      <div class="tg gf" role="group" aria-label="Quem começou o game ${i + 1}"><button type="button" data-f="me" ${pressed(x.first === "me")}>Eu</button><button type="button" data-f="opp" ${pressed(x.first === "opp")}>Ele</button></div>
      <div class="gr" role="group" aria-label="Resultado do game ${i + 1}"><button type="button" data-gr="W" ${pressed(x.result === "W").replace('class="', 'class="W ')}>Ganhei</button><button type="button" data-gr="L" ${pressed(x.result === "L").replace('class="', 'class="L ')}>Perdi</button></div></div>
      ${bfBtn(i)}</div>`);
  }
  const tie = split && !g[2].result;
  return rows.join("") + (tie ? `<label class="ck tdraw"><input type="checkbox" id="f-tdraw"${F.timeDraw ? " checked" : ""}> Terminou empatado (tempo)</label>` : "");
}
// Partida única: quem começou e o resultado na mesma linha, battlefields embaixo.
function bo1HTML() {
  return `<div class="gm one" data-g="b1"><div class="gline">
    <div class="tg gf" role="group" aria-label="Quem começou"><button type="button" data-t1="me" ${pressed(F.turn === "me")}>Eu</button><button type="button" data-t1="opp" ${pressed(F.turn === "opp")}>Ele</button></div>
    <div class="gr c3" id="f-res" role="group" aria-label="Resultado">${["W", "L", "D"].map((k) => `<button type="button" data-r="${k}" ${pressed(F.result === k).replace('class="', `class="${k} `)}>${RES[k]}</button>`).join("")}</div></div>
    ${bfBtn("b1")}</div>`;
}

// ---------- ID e bye (rodada de evento sem jogo) ----------
const KINDS_UI = [["", "JOGUEI", "registrar games"], ["id", "ID", "empate combinado"], ["bye", "BYE", "sem oponente"]];
function kindHTML() {
  return `<div class="rk-q" id="rk-q">Como foi a rodada?</div><div class="rk" role="group" aria-labelledby="rk-q">${KINDS_UI.map(([k, t, sub]) =>
    `<button type="button" data-kind="${k}" ${pressed(F.kind === k)}><b>${t}</b><small>${sub}</small></button>`).join("")}</div>`;
}
// Recorde do evento como fica depois de salvar (descontando a própria partida, quando é edição).
function projectedRecord(ev) {
  const r = ev ? eventRecord(ev) : { w: 0, l: 0, d: 0 };
  let { w, l, d } = r;
  const old = F.editId ? S.getState().matches.find((m) => m.id === F.editId) : null;
  if (old && ev && old.event && old.event.eventId === ev.id) { if (old.result === "W") w--; else if (old.result === "L") l--; else d--; }
  if (F.kind === "bye") w++; else d++;
  return recTxt({ w, l, d });
}
function roundsHTML(ev) {
  const ms = eventRecord(ev).matches.slice().sort((a, b) => (a.event.round || 0) - (b.event.round || 0));
  if (!ms.length) return "";
  return `<section class="rounds" aria-label="Rodadas do evento"><div class="rd-h">RODADAS</div>${ms.map((m) => `<div class="rd${m.kind ? " k" : ""}"><span class="rd-n">R${esc(m.event.round || "?")}</span><span class="rd-r ${m.kind ? "k" : esc(m.result)}">${m.kind ? KIND_LABEL[m.kind] : { W: "V", L: "D", D: "E" }[m.result]}</span><span class="rd-t">${esc(roundText(m))}</span></div>`).join("")}</section>`;
}
function kindBody(ev) {
  return `${F.kind === "id" ? `<div class="kopp"><div class="pick" id="opp" data-side="opp">${pickerHTML("opp", F.opp, "Contra quem? (opcional)", false, null, "Escolher a lenda")}</div>${F.opp ? '<button type="button" class="x" id="f-noopp" aria-label="Tirar o oponente">✕</button>' : ""}</div>` : ""}
    <div class="kinfo"><span>${F.kind === "bye" ? "Conta como vitória no recorde do evento" : "Conta no recorde do evento"}: <b>${projectedRecord(ev)}</b></span><span class="m">Fica fora do win rate, dos matchups e dos battlefields.</span></div>
    ${ev ? roundsHTML(ev) : ""}`;
}

// ---------- barra SALVAR ----------
// Diz se dá para salvar, com o placar e o resultado (ou o motivo curto quando falta algo).
function formStatus() {
  const verb = F.editId ? "ATUALIZAR" : "SALVAR";
  if (F.kind) {
    const ev = F.eventId ? S.evt(F.eventId) : null, rd = F.round || (ev ? nextRound(ev.id) : null);
    return { ok: true, main: verb + " " + KIND_LABEL[F.kind], sub: rd ? "R" + rd : "" };
  }
  if (!F.my) return { ok: false, main: verb, why: "falta o seu deck" };
  if (!F.opp) return { ok: false, main: verb, why: "falta o oponente" };
  if (F.fmt !== "bo3") return F.result ? { ok: true, main: verb, sub: RES[F.result].toUpperCase() } : { ok: false, main: verb, why: "falta o resultado" };
  const b3 = bo3Games();
  if (b3.hole) return { ok: false, main: verb, why: `o G${b3.hole.blank} está em branco` };
  const r = resultFromGames(b3.used), sc = `${r.w}–${r.l}`;
  if (r.w === 2 || r.l === 2) return { ok: true, main: `${verb} ${sc}`, sub: r.w === 2 ? "VITÓRIA" : "DERROTA" };
  if (F.timeDraw && r.w === 1 && r.l === 1) return { ok: true, main: `${verb} ${sc}`, sub: "EMPATE" };
  if (F.timeResult) return { ok: true, main: `${verb} ${sc}`, sub: RES[F.timeResult].toUpperCase() };
  return { ok: false, main: verb, why: `falta o G${b3.used.length + 1}` };
}
// Incompleto: aparência de desabilitado e o motivo no próprio texto ("SALVAR · falta o oponente"), mas o
// botão continua tocável para abrir a explicação completa do que falta (mesmas mensagens de antes).
// O texto da barra também vai para uma região aria-live (polite), que não é recriada a cada mudança.
const barSpeech = (st) => [st.main, st.sub, st.why].filter(Boolean).join(" · ");
function saveBtnHTML(st) {
  return `<button type="button" class="go sbtn${st.ok ? "" : " off"}" id="f-save" data-ok="${st.ok ? 1 : 0}"><span class="sb-m">${esc(st.main)}</span>${st.sub ? `<span class="sb-s"> · ${esc(st.sub)}</span>` : ""}${st.why ? `<span class="sb-w"> · ${esc(st.why)}</span>` : ""}</button>`;
}
function saveBarHTML() {
  const st = formStatus();
  return `<div class="savebar" id="f-savebar">${saveBtnHTML(st)}<span class="sr" id="f-sblive" aria-live="polite">${esc(barSpeech(st))}</span></div>`;
}
function paintBar() {
  const bar = document.getElementById("f-savebar"); if (!bar) return;
  const st = formStatus(), btn = document.getElementById("f-save"), live = document.getElementById("f-sblive");
  if (btn) btn.outerHTML = saveBtnHTML(st);
  if (live) { const t = barSpeech(st); if (live.textContent !== t) live.textContent = t; }
}

// "Data, set e notas · hoje · Radiance": a linha recolhida dos detalhes
function detailsLine(ev) {
  const d = fromLocalInput(F.date), today = toLocalDate(d) === toLocalDate(Date.now());
  const sum = [ev ? "" : F.ctx, today ? "hoje" : fmtDate(d), S.sets().find((x) => x.id === F.set)?.name || "", F.note ? "com nota" : ""].filter(Boolean).join(" · ");
  return `<button type="button" class="more-t det" id="f-more" aria-expanded="${!!F.details}" aria-controls="f-det"><span class="dl">${ev ? "Data, set e notas" : "Tipo, data, set e notas"} · <span class="ds">${esc(sum)}</span></span><i aria-hidden="true">${F.details ? "▾" : "▸"}</i></button>`;
}

function render() {
  const el = $("#add");
  // data que o usuário não mexeu acompanha o relógio (formulário pode ficar aberto por horas)
  if (!F.dateTouched && !F.editId) F.date = toLocalInput(Date.now());
  const autoSet = S.setForDate(fromLocalInput(F.date));
  if (!F.setTouched) F.set = autoSet;
  const bo3 = F.fmt === "bo3";
  const dk = F.deckId ? S.deck(F.deckId) : null;
  const ev = F.eventId ? S.evt(F.eventId) : null;
  // ID/bye: só com evento (aberto, ou o da partida que está sendo editada)
  const showKind = !!((ev && (ev.status === "open" || F.editId)) || F.kind);
  if (!showKind) F.kind = "";
  const open = !!(F.editId || F.manual);
  const lv = readLive(), liveOn = !!(lv && lv.phase !== "setup");
  el.innerHTML = `${F.editId ? "" : statusStrip()}${F.editId ? "" : liveOn ? '<div class="evbar live"><div><b>Partida em andamento</b><div class="m">O contador guardou o placar.</div></div><button class="btn pri" type="button" id="go-resume">Retomar</button></div>' : ""}${F.editId ? "" : eventBanner()}${savedStrip()}
  ${F.editId ? "" : `<div class="herorow"><button class="go big-go" id="go-live" type="button"><span>NOVA PARTIDA<small>Contador de pontos${F.eventId && S.evt(F.eventId) ? " · rodada " + nextRound(F.eventId) : ""}</small></span></button>${S.openEvent() ? "" : `<button class="evchip" type="button" id="ev-start"><b>＋</b>EVENTO</button>`}</div>
  <button class="manual-t${F.manual ? " open" : ""}" id="f-manual" type="button" aria-expanded="${!!F.manual}"><span>${S.openEvent() ? "Registrar rodada já jogada, ID ou bye" : "Registrar partida já jogada"}</span><i>${F.manual ? "▴" : "▾"}</i></button>`}
  <div class="card mcard${open ? "" : " hide"}${F.kind ? " kind" : ""}" id="f-card">
    ${F.editId ? `<h2>${F.kind ? "Editar rodada" : "Editar partida"}</h2>` : ""}
    ${showKind ? kindHTML() : ""}
    ${F.kind ? kindBody(ev) : `<div class="mu compact"><div class="pick" id="my" data-side="my">${pickerHTML("my", F.my, myLabel(dk), true, F.deckId, myLabel(dk))}</div><div class="vs">VS</div><div class="pick" id="opp" data-side="opp">${pickerHTML("opp", F.opp, "Oponente", false, null, "Oponente")}</div></div>
    <div class="frow"><div class="tg fmt2" role="group" aria-label="Formato"><button type="button" data-fmt="bo1" ${pressed(!bo3)}>Única</button><button type="button" data-fmt="bo3" ${pressed(bo3)}>Bo3</button></div>
      <div class="verchip"><label class="sr" for="f-ver">Versão</label>${versionField("f-ver", F.deckId, F.versionId, F.ver, "f-vers")}</div></div>
    ${bo3 ? `<div id="f-games">${gamesHTML()}</div>` : bo1HTML()}`}
    ${detailsLine(ev)}
    <div id="f-det" class="${F.details ? "" : "hide"}">
      ${ev ? "" : `<label for="f-ctx">Tipo de jogo</label><select id="f-ctx">${EVENT_TYPES.map((c) => `<option${c === F.ctx ? " selected" : ""}>${c}</option>`).join("")}</select>`}
      <div class="row"><div><label for="f-date">Data</label><input id="f-date" type="datetime-local" value="${esc(F.date)}"></div>
      <div><label for="f-set">Set</label><select id="f-set">${S.sets().map((s) => `<option value="${esc(s.id)}"${s.id === F.set ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div></div>
      <label for="f-note">Notas</label><textarea id="f-note" rows="2" placeholder="O que funcionou e o que deu errado">${esc(F.note)}</textarea>
    </div>
    ${F.editId ? '<button class="btn full" id="f-cancel" type="button" style="margin-top:10px">Cancelar edição</button>' : ""}
  </div>${open ? saveBarHTML() : ""}${F.editId ? "" : backupBanner()}`;
  document.body.classList.toggle("sbar-on", open);
  paintMatchup($(".mu", el), F.my, F.opp);
  F._fresh = false;
}

function collect() {
  if (F._fresh) return; // formulário novo ainda não desenhado: a tela tem dados de outro
  const v = (id) => { const x = document.getElementById(id); return x ? x.value : null; };
  if (v("f-ver") !== null) { if (F.deckId) { if (v("f-ver") !== "__new") F.versionId = v("f-ver"); } else F.ver = v("f-ver").trim(); }
  if (v("f-ctx") !== null) F.ctx = v("f-ctx");
  if (v("f-note") !== null) F.note = v("f-note").trim();
  if (v("f-date") !== null) { const d = v("f-date"); if (d && d !== F.date) { F.date = d; F.dateTouched = true; } }
  if (v("f-set") !== null) F.set = v("f-set");
}

// ---------- folha de battlefields de um game ----------
// Escolher aplica na hora (o botão do game já mostra); ✕, PRONTO, voltar do Android e toque fora só fecham.
let SH = null; // { i }
function usedIn(i, key) {
  if (i === "b1") return [];
  return F.games.map((g, k) => ({ name: canonBf(g[key]), g: k + 1 })).filter((x, k) => k !== +i && x.name);
}
// Sugestões do oponente: só battlefields que oponentes já usaram; primeiro os da mesma lenda.
function oppSuggest(opp) {
  const c = new Map(), add = (b, w) => { if (b) { const k = canonBf(b); c.set(k, (c.get(k) || 0) + w); } };
  S.played().forEach((m) => (m.games || []).forEach((g) => add(g.oppBf, opp && m.opp === opp ? 100 : 1)));
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map((x) => x[0]);
}
function bfOpt(side, name, cur, used, big) {
  const k = bfKey(name), u = used.find((x) => bfKey(x.name) === k), on = !!cur && k === bfKey(cur);
  if (u && !on) return `<button type="button" class="bo used${big ? " tall" : ""}" disabled aria-label="${esc(name)}, já usado no game ${u.g}"><s>${esc(name)}</s><small>usado no G${u.g}</small></button>`;
  return `<button type="button" class="bo${big ? " tall" : ""}${on ? " on" : ""}" data-side="${side}" data-bf="${esc(name)}" aria-pressed="${on}">${esc(name)}</button>`;
}
function bfSearchHTML(side, label) {
  return `<label class="bs-s"><span aria-hidden="true">⌕</span><input type="search" class="bs-q" data-side="${side}" placeholder="Buscar outro battlefield" aria-label="${label}" autocomplete="off" autocapitalize="off" spellcheck="false"></label><div class="bs-res" data-side="${side}" role="group" aria-label="Resultados da busca"></div>`;
}
// A ordem dos chips é fixada ao abrir a folha (SH.order) e não muda enquanto ela está aberta: o escolhido só
// ganha destaque no lugar onde está, para um 2º toque rápido não cair no vizinho (U95-01).
function sheetOrder(i) {
  const g = bfOf(i), dk = F.deckId ? S.deck(F.deckId) : null;
  const own = dk ? [...new Set((dk.battlefields || []).filter(Boolean).map(canonBf))] : [];
  const mine = canonBf(g.myBf), theirs = canonBf(g.oppBf), uMy = usedIn(i, "myBf"), uOp = usedIn(i, "oppBf");
  const my = own.length ? [...own, ...(mine && !own.includes(mine) ? [mine] : [])]
    : [...new Set([mine, ...uMy.map((x) => x.name), ...knownMyBattlefields()].filter(Boolean))].slice(0, 6 + uMy.length);
  const opp = [...new Set([...uOp.map((x) => x.name), theirs, ...oppSuggest(F.opp)].filter(Boolean))].slice(0, 6 + uOp.length);
  return { own: own.length > 0, my, opp };
}
function sheetHTML(i) {
  const g = bfOf(i), dk = F.deckId ? S.deck(F.deckId) : null;
  const mine = canonBf(g.myBf), theirs = canonBf(g.oppBf), uMy = usedIn(i, "myBf"), uOp = usedIn(i, "oppBf");
  const o = (SH && SH.order) || sheetOrder(i);
  let my;
  if (o.own) my = `<div class="bs-l" id="bs-lm">Seu battlefield <span>· ${o.my.length === 1 ? "o do deck" : `os ${o.my.length} do deck`} ${esc(dk ? dk.name : "")}</span></div>
      <div class="bs-grid">${o.my.map((n) => bfOpt("my", n, mine, uMy, true)).join("")}</div>`;
  else {
    // deck sem battlefields cadastrados (ou só a lenda): os que você já usou + busca
    my = `<div class="bs-l" id="bs-lm">Seu battlefield <span>· ${dk ? "o deck não tem battlefields cadastrados" : "busque ou escolha"}</span></div>
      ${o.my.length ? `<div class="bs-chips">${o.my.map((n) => bfOpt("my", n, mine, uMy)).join("")}</div>` : ""}${bfSearchHTML("my", "Buscar o seu battlefield")}`;
  }
  const title = i === "b1" ? "BATTLEFIELDS" : `GAME ${+i + 1} · BATTLEFIELDS`;
  return `<div class="bs-scrim" data-close="1"></div>
    <section class="bs" role="dialog" aria-modal="true" aria-labelledby="bs-t">
      <div class="bs-h"><span class="bs-t" id="bs-t">${title}</span><button type="button" class="bs-x" data-close="1" aria-label="Fechar">✕</button></div>
      <div class="bs-b">
      <div class="bs-p" role="group" aria-labelledby="bs-lm">${my}</div>
      <div class="bs-p" role="group" aria-labelledby="bs-lo"><div class="bs-l" id="bs-lo">Do oponente${F.opp ? ` <span>· ${esc(F.opp)}</span>` : ""}</div>
        ${o.opp.length ? `<div class="bs-chips">${o.opp.map((n) => bfOpt("opp", n, theirs, uOp)).join("")}</div>` : ""}
        ${bfSearchHTML("opp", "Buscar battlefield do oponente")}
        <p class="bs-hint">${o.opp.length ? `Sugestões: os que oponentes já usaram contra você${F.opp ? ` (primeiro os de ${esc(F.opp)})` : ""}.` : "Ainda não há battlefields de oponentes registrados: use a busca."}</p></div>
      </div>
      <div class="bs-a"><button type="button" class="btn bs-none" data-none="1">Sem battlefield</button><button type="button" class="go bs-ok" data-close="1">PRONTO</button></div>
    </section>`;
}
function searchResults(box, side) {
  const q = box.querySelector(`.bs-q[data-side="${side}"]`), res = box.querySelector(`.bs-res[data-side="${side}"]`);
  const k = bfKey(q.value), typed = q.value.trim();
  if (!k) { res.innerHTML = ""; return; }
  const g = bfOf(SH.i), cur = canonBf(side === "my" ? g.myBf : g.oppBf), used = usedIn(SH.i, side === "my" ? "myBf" : "oppBf");
  const hits = allBattlefields().filter((b) => bfKey(b.name).includes(k)).slice(0, 8);
  const exact = hits.some((b) => bfKey(b.name) === k);
  res.innerHTML = hits.map((b) => bfOpt(side, b.name, cur, used)).join("") + (exact ? "" : `<button type="button" class="bo add" data-side="${side}" data-bf="${esc(typed)}">＋ Usar "${esc(typed)}"</button>`);
}
function paintGame(i) {
  if (i === "b1") { const b = document.querySelector('#add [data-bfg="b1"]'); if (b) b.outerHTML = bfBtn("b1"); }
  else { const box = $("#f-games"); if (box) box.innerHTML = gamesHTML(); }
}
function sheetKeys(e) {
  const box = document.getElementById("bfsheet"); if (!box) return;
  if (e.key === "Escape") { e.preventDefault(); closeBfSheet(); return; }
  if (e.key !== "Tab") return;
  // foco preso na folha
  const f = [...box.querySelectorAll("button:not([disabled]), input")].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  else if (!box.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
}
function drawSheet() {
  const box = document.getElementById("bfsheet"); if (!box || !SH) return;
  box.innerHTML = sheetHTML(SH.i);
  const f = box.querySelector(".bo:not([disabled])") || box.querySelector(".bs-x");
  if (f) f.focus({ preventScroll: true });
}
// Marca o escolhido de um lado sem redesenhar a folha (nada muda de lugar sob o dedo).
function markSide(box, side, cur) {
  const k = bfKey(cur);
  box.querySelectorAll(`.bo[data-side="${side}"][data-bf]`).forEach((x) => { const on = !!k && bfKey(x.dataset.bf) === k; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
}
export const RETAP_MS = 350, AUTOCLOSE_MS = 250;
function openBfSheet(i) {
  closeBfSheet(false);
  collect();
  SH = { i, tap: null, closing: 0 };
  SH.order = sheetOrder(i);
  const box = document.createElement("div"); box.id = "bfsheet"; box.className = "anim"; document.body.appendChild(box);
  setTimeout(() => box.classList.remove("anim"), 250); // só a abertura anima
  document.body.classList.add("sheet-on");
  drawSheet();
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-close], [data-none], [data-bf]"); if (!b || b.disabled || !SH) return;
    if (b.dataset.close) return closeBfSheet();
    if (SH.closing) return; // já confirmando: a folha fecha em instantes
    const g = bfOf(SH.i);
    if (b.dataset.none) { g.myBf = ""; g.oppBf = ""; paintGame(SH.i); return closeBfSheet(); }
    const side = b.dataset.side, key = side === "my" ? "myBf" : "oppBf", name = canonBf(b.dataset.bf);
    // toque duplo: o 2º toque no mesmo alvo em menos de RETAP_MS é ignorado (não desmarca)
    const tk = side + "|" + bfKey(name), now = Date.now();
    if (SH.tap && SH.tap.k === tk && now - SH.tap.t < RETAP_MS) return;
    SH.tap = { k: tk, t: now };
    g[key] = canonBf(g[key]) && bfKey(g[key]) === bfKey(name) ? "" : name; // tocar de novo (depois) no escolhido desmarca
    markSide(box, side, g[key]);
    paintGame(SH.i);
    // os dois lados escolhidos: destaque rápido e a folha fecha sozinha
    if (g[key] && g.myBf && g.oppBf) {
      const sec = box.querySelector(".bs"); if (sec) sec.classList.add("done");
      const ok = box.querySelector(".bs-ok"); if (ok) ok.textContent = "✓ PRONTO";
      const me = SH; me.closing = setTimeout(() => { if (SH === me) closeBfSheet(); }, AUTOCLOSE_MS);
    }
  });
  box.addEventListener("input", (e) => { if (e.target.classList.contains("bs-q")) searchResults(box, e.target.dataset.side); });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("bs-q")) { e.preventDefault(); const first = box.querySelector(`.bs-res[data-side="${e.target.dataset.side}"] button:not([disabled])`); if (first) first.click(); }
  });
  document.addEventListener("keydown", sheetKeys, true);
}
// Fecha a folha (devolve true se estava aberta). Usado também pelo voltar do Android.
export function closeBfSheet(refocus = true) {
  const box = document.getElementById("bfsheet");
  if (!box) { SH = null; return false; }
  const i = SH && SH.i;
  if (SH && SH.closing) clearTimeout(SH.closing);
  box.remove(); SH = null;
  document.body.classList.remove("sheet-on");
  document.removeEventListener("keydown", sheetKeys, true);
  if (refocus && i !== null && i !== undefined) { const t = document.querySelector(`#add [data-bfg="${i}"]`); if (t) t.focus({ preventScroll: true }); }
  return true;
}

function bind() {
  const el = $("#add");
  bindPickers(el, (side, { legend, deckId }) => {
    collect();
    if (side === "my") {
      F.my = legend; F.deckId = deckId; F.versionId = deckId ? lastVersionId(S.deck(deckId)) : null;
      prefs.my = legend; prefs.deckId = deckId; savePrefs();
    } else F.opp = legend;
    render();
  });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.bk) { collect(); await handleBackupBanner(b); render(); return; }
    if (b.id === "go-live") return showView("live", { setup: true });
    if (b.id === "go-resume") return showView("live");
    if (b.id === "ev-start") { const ev = await startEvent(); if (ev) { collect(); F.eventId = ev.id; F.ctx = ev.type; if (ev.deckId) { const d = S.deck(ev.deckId); F.deckId = d.id; F.my = d.legend; F.versionId = ev.versionId; } render(); } return; }
    if (b.id === "ev-close") { const ev = S.openEvent(); if (ev && (await closeEvent(ev))) { F.eventId = null; F.ctx = freeCtx(); F.kind = ""; render(); } return; }
    if (b.dataset.kind !== undefined) { collect(); F.kind = b.dataset.kind; render(); return; }
    if (b.id === "f-noopp") { collect(); F.opp = ""; render(); return; }
    if (b.dataset.fmt) { collect(); F.fmt = b.dataset.fmt; F.result = ""; render(); return; }
    if (b.dataset.bfg !== undefined) return openBfSheet(b.dataset.bfg === "b1" ? "b1" : +b.dataset.bfg);
    if (b.dataset.t1) { F.turn = F.turn === b.dataset.t1 ? "" : b.dataset.t1; $$("[data-t1]", el).forEach((x) => { x.classList.toggle("on", x.dataset.t1 === F.turn); x.setAttribute("aria-pressed", x.dataset.t1 === F.turn); }); paintBar(); return; }
    if (b.dataset.r) { F.result = F.result === b.dataset.r ? "" : b.dataset.r; $$("#f-res button", el).forEach((x) => { x.classList.toggle("on", x.dataset.r === F.result); x.setAttribute("aria-pressed", x.dataset.r === F.result); }); paintBar(); return; }
    const gm = b.closest(".gm");
    if (gm && gm.dataset.g !== "b1") {
      collect();
      const i = +gm.dataset.g, g = F.games[i];
      if (b.dataset.f) g.first = g.first === b.dataset.f ? "" : b.dataset.f;
      if (b.dataset.gr) {
        g.result = g.result === b.dataset.gr ? "" : b.dataset.gr;
        // Desmarcar um game (toque duplo, comum com pressa) não apaga os seguintes: eles ficam à vista e o
        // salvar explica qual game falta. O game 3 só é limpo quando deixa de existir (2–0, ou G1 e G2 em branco).
        const [a, c] = F.games;
        if ((a.result && c.result && a.result === c.result) || (!a.result && !c.result)) clearGame(F.games[2]);
        if (!(a.result && c.result && a.result !== c.result)) F.timeDraw = false;
        // no Bo3, quem perdeu o game escolhe; sugestão: o perdedor começa o próximo
        const nx = F.games[i + 1];
        if (nx && !nx.first && g.result && (i === 0 || (a.result && c.result && a.result !== c.result))) nx.first = g.result === "L" ? "me" : "opp";
      }
      $("#f-games").innerHTML = gamesHTML();
      paintBar();
      return;
    }
    if (b.id === "f-manual") {
      collect(); F.manual = !F.manual; prefs.manual = F.manual ? 1 : 0; savePrefs(); render();
      // abriu: o formulário inteiro sobe para a área entre o topo e a barra SALVAR
      if (F.manual) { const t = document.getElementById("f-card"); if (t) t.scrollIntoView({ block: "start" }); }
      return;
    }
    if (b.id === "f-more") { collect(); F.details = !F.details; render(); return; }
    if (b.id === "f-save") return save();
    if (b.id === "sv-undo") return undoSaved();
    if (b.id === "f-cancel") { F = blankForm(); render(); showView("hist"); }
  });
  el.addEventListener("change", async (e) => {
    if (e.target.id === "f-ver" && e.target.value === "__new") { collect(); const id = await newVersion(F.deckId); if (id) F.versionId = id; render(); return; }
    if (e.target.id === "f-tdraw") { F.timeDraw = e.target.checked; collect(); if (F.timeDraw) F.games[2] = { ...F.games[2], result: "", first: "" }; $("#f-games").innerHTML = gamesHTML(); paintBar(); return; }
    if (e.target.id === "f-date") { collect(); if (!F.setTouched) render(); }
    if (e.target.id === "f-set") { F.set = e.target.value; F.setTouched = true; }
  });
}

// monta e salva a partida a partir do formulário
let saving = false, saveQuiet = 0;
// Depois de salvar, o formulário novo aparece no mesmo lugar: um 2º toque (toque duplo) no SALVAR por
// SAVE_QUIET_MS é ignorado, para não abrir um "Falta pouco" falso sobre o formulário vazio (Q95-01).
export const SAVE_QUIET_MS = 800;
async function save() {
  if (saving || Date.now() < saveQuiet) return;
  collect();
  if (F.kind) return saveKind();
  const bo3 = F.fmt === "bo3";
  let games, result, score = "";
  {
    const miss = [];
    if (!F.my) miss.push("seu deck ou sua lenda");
    if (!F.opp) miss.push("a lenda do oponente");
    if (!bo3 && !F.result) miss.push("o resultado: vitória, derrota ou empate");
    if (bo3 && !F.timeResult) {
      const b3 = bo3Games(), r0 = resultFromGames(b3.used);
      if (b3.hole) { await dialog({ title: "Games fora de ordem", body: `<p>Os games valem em ordem: o <b>Game ${b3.hole.blank}</b> está em branco, mas o <b>Game ${b3.hole.marked}</b> já foi marcado.</p><p>Marque o Game ${b3.hole.blank} ou desmarque o Game ${b3.hole.marked}.</p>` }); return; }
      if (!(r0.w === 2 || r0.l === 2 || (F.timeDraw && r0.w === 1 && r0.l === 1))) miss.push("quem ganhou cada game, até alguém fazer 2 (ou empate por tempo no 1–1)");
    }
    if (miss.length) { await dialog({ title: "Falta pouco", body: "<p>Para salvar, falta marcar:</p><ul class=\"miss\">" + miss.map((x) => "<li>" + x + "</li>").join("") + "</ul>" }); return; }
  }
  if (bo3) {
    const used = F.timeResult ? F.games.filter((g) => g.result) : bo3Games().used;
    const r = resultFromGames(used);
    const done = r.w === 2 || r.l === 2 || (F.timeDraw && r.w === 1 && r.l === 1);
    // partida do contador encerrada por tempo: mantém o resultado escolhido ao editar
    if (!done && F.timeResult) {
      games = F.games.slice(0, F.timeGames).map((g, i) => ({ ...S.game(i + 1, g.first || null, g.result || null), myBf: g.myBf || null, oppBf: g.oppBf || null }));
      result = F.timeResult; score = r.score;
    } else if (!done) { await dialog({ title: "Placar incompleto", body: "<p>Marque quem ganhou cada game até alguém fazer 2 (ou marque empate por tempo no 1–1).</p>" }); return; }
    else {
      games = used.map((g, i) => ({ ...S.game(i + 1, g.first || null, g.result), myBf: g.myBf || null, oppBf: g.oppBf || null }));
      result = F.timeDraw && r.w === r.l ? "D" : r.result; score = r.score;
    }
    const myBfs = games.map((g) => g.myBf).filter(Boolean);
    if (new Set(myBfs).size !== myBfs.length) toast("Atenção: no Bo3 o mesmo battlefield não pode repetir");
  } else {
    if (!F.result) { await dialog({ title: "Falta o resultado", body: "<p>Marque vitória, derrota ou empate.</p>" }); return; }
    result = F.result;
    games = [{ ...S.game(1, F.turn || null, result), myBf: F.myBf || null, oppBf: F.oppBf || null }];
  }
  if (!F.my || !F.opp) { await dialog({ title: "Falta pouco", body: "<p>Escolha o seu deck ou lenda e a lenda do oponente.</p>" }); return; }
  const old = F.editId ? S.getState().matches.find((m) => m.id === F.editId) : null;
  if (old) games = games.map((g, i) => ({ ...(old.games[i] || {}), ...g, points: (old.games[i] || {}).points || null, log: (old.games[i] || {}).log || [] }));
  const m = baseMatch(old);
  Object.assign(m, { format: F.fmt, score, result, games });
  delete m.kind; // ID/bye editado e trocado para "joguei" vira partida normal
  prefs.fmt = F.fmt;
  await commit(m, old);
}
// Campos comuns de partida jogada, ID e bye.
function baseMatch(old) {
  const dk = F.deckId ? S.deck(F.deckId) : null;
  // deck apagado: a partida mantém o vínculo e o nome da versão que já tinha
  const keepDeck = !dk && old && old.deckId && F.deckId === old.deckId;
  const playedAt = F.dateTouched || F.editId ? fromLocalInput(F.date) : Date.now();
  const ev = F.eventId ? S.evt(F.eventId) : null;
  const now = Date.now();
  return {
    ...(old || {}), id: old ? old.id : S.newId(), schema: S.SCHEMA, createdAt: old ? old.createdAt : now, playedAt,
    set: (F.setTouched && F.set) || S.setForDate(playedAt), my: F.my, opp: F.opp,
    deckId: dk ? dk.id : keepDeck ? old.deckId : null, versionId: dk ? F.versionId : keepDeck ? old.versionId || null : null,
    version: dk ? versionName(dk, F.versionId) : F.ver || (keepDeck ? old.version : ""),
    event: { type: ev ? ev.type : F.ctx, eventId: ev ? ev.id : null, round: ev ? (old && old.event && old.event.round) || nextRound(ev.id) : null },
    note: F.note, tags: (old && old.tags) || [],
  };
}
// ID (empate combinado, oponente opcional) e bye (sem oponente): ocupam a rodada, sem games.
async function saveKind() {
  const old = F.editId ? S.getState().matches.find((m) => m.id === F.editId) : null;
  const m = baseMatch(old);
  // evento apagado depois: a rodada guarda o número que tinha
  if (!m.event.eventId && old && old.event) m.event = { ...m.event, eventId: old.event.eventId || null, round: old.event.round || null };
  Object.assign(m, { kind: F.kind, opp: F.kind === "id" ? F.opp || "" : "", format: "bo1", score: "", result: F.kind === "bye" ? "W" : "D", games: [] });
  delete m.source; delete m.endedBy;
  await commit(m, old);
}
async function commit(m, old) {
  const ev = m.event.eventId ? S.evt(m.event.eventId) : null;
  prefs.my = F.my; prefs.deckId = F.deckId; prefs.ver = F.ver;
  if (!ev && !old) prefs.ctxOut = F.ctx; // o tipo escolhido fora de evento é lembrado à parte do tipo do evento
  savePrefs();
  saving = true;
  let ok = false;
  try { ok = await S.saveMatch(m); } finally { saving = false; }
  if (ok) saveQuiet = Date.now() + SAVE_QUIET_MS;
  if (!ok) { await dialog({ title: "Não foi possível salvar", body: "<p>O aparelho está sem espaço. O formulário continua preenchido: faça um backup, remova fotos de lendas em Mais e tente de novo.</p>" }); return; }
  const wasEdit = !!old;
  // foto do formulário como estava ao salvar: o Desfazer devolve exatamente isto
  const snap = JSON.parse(JSON.stringify(F));
  // formulário novo, com os detalhes fechados: a próxima rodada começa limpa (e em "joguei")
  F = { ...blankForm(), manual: F.manual, details: false };
  if (wasEdit) { render(); toast(m.kind ? "Rodada atualizada" : "Partida atualizada"); showView("hist"); return; }
  savedToast(m, () => { F = { ...snap, _fresh: false }; return true; });
  window.scrollTo(0, 0); // de volta ao topo: banner do evento e recorde à vista
}

// ---------- aviso "salvo" com Desfazer ----------
// Faixa no fluxo da página, logo abaixo do banner do evento (onde o olhar está depois de voltar ao topo).
// Não é flutuante: não fica por cima de nenhum controle do formulário e o texto não deixa o toque passar
// para o que está embaixo. O Desfazer vale por UNDO_MS; depois a faixa fica só como confirmação (sem botão)
// até a próxima partida ou até sair da tela.
export const UNDO_MS = 8000;
let SV = null, svT = null, svSeq = 0;
function savedStrip() {
  if (!SV || F.editId) return "";
  const can = SV.id && Date.now() < SV.until;
  return `<div class="svbar${SV.info ? " info" : ""}" id="svbar" role="status"><span class="sv-t">${SV.html}</span>${can ? '<button type="button" id="sv-undo">Desfazer</button>' : SV.info ? "" : '<span class="sv-ok" aria-hidden="true">✓</span>'}</div>`;
}
function paintStrip() {
  const el = document.getElementById("svbar"), html = savedStrip();
  if (el) { if (html) el.outerHTML = html; else el.remove(); }
}
// Aviso depois de salvar: rodada, resultado, placar, oponente e recorde do evento, com Desfazer.
// Ex.: "R3 · Vitória 2–1 vs Kai'Sa · evento 2–1". Desfazer apaga a partida recém-salva e devolve os dados:
// restore() refaz o estado de antes (formulário preenchido ou resumo do contador) e devolve false se não deu.
export function savedToast(m, restore = null) {
  const ev = m.event && m.event.eventId ? S.evt(m.event.eventId) : null, g1 = m.games && m.games[0];
  const sc = m.score ? m.score.replace("-", "–") : m.format !== "bo3" && g1 && g1.points ? g1.points.me + "–" + g1.points.opp : "";
  const rd = ev && m.event.round ? "R" + m.event.round + " · " : "";
  // ID: "R4 · ID vs Kai'Sa"; bye: "R5 · BYE (vitória)"
  let html = esc(m.kind === "bye" ? rd + "BYE (vitória)" : m.kind === "id" ? rd + "ID" + (m.opp ? " vs " + m.opp : " (empate combinado)") : rd + RES[m.result] + (sc ? " " + sc : "") + " vs " + m.opp);
  if (ev) { const r = eventRecord(ev); html += ` · <span class="nw">evento ${recTxt(r)}</span>`; }
  const seq = ++svSeq;
  SV = { seq, id: m.id, m, html, until: Date.now() + UNDO_MS, restore };
  clearTimeout(svT); svT = setTimeout(() => { if (SV && SV.seq === seq) paintStrip(); }, UNDO_MS + 30);
  if (currentView() === "add") render();
}
async function undoSaved() {
  const sv = SV;
  // só vale para o aviso que está na tela, dentro do prazo
  if (!sv || !sv.id || Date.now() >= sv.until || !document.getElementById("sv-undo")) return;
  SV = null; clearTimeout(svT);
  if (!(await S.deleteMatch(sv.id))) { SV = sv; paintStrip(); toast("Não consegui desfazer: o aparelho está sem espaço"); return; }
  const back = sv.restore ? sv.restore() : false;
  if (back === "live") return; // voltou para o resumo do contador
  if (!back) F = { ...formFromMatch(sv.m), editId: null, manual: true, details: true };
  F.manual = true; prefs.manual = 1; savePrefs();
  SV = { seq: ++svSeq, id: null, info: true, html: "Desfeito: a partida voltou para o formulário. Corrija e salve de novo." };
  render();
  window.scrollTo(0, 0);
}

export function editMatch(id) {
  const m = S.getState().matches.find((x) => x.id === id); if (!m) return;
  F = formFromMatch(m);
  showView("add");
}
// Formulário preenchido com uma partida (editar, ou devolver ao formulário depois do Desfazer).
function formFromMatch(m) {
  const gs = [0, 1, 2].map((i) => { const g = m.games[i] || {}; return { first: g.first || "", result: g.result || "", myBf: g.myBf || "", oppBf: g.oppBf || "" }; });
  // Bo3 antigo só com placar: reconstrói resultados na ordem V… D…
  if (m.format === "bo3" && !m.games.some((g) => g.result) && m.score) {
    const [w, l] = m.score.split("-").map(Number); let k = 0;
    for (let i = 0; i < w; i++) gs[k++].result = "W";
    for (let i = 0; i < l; i++) gs[k++].result = "L";
  }
  const wins = m.games.filter((g) => g.result === "W").length, losses = m.games.filter((g) => g.result === "L").length;
  const byTime = m.format === "bo3" && (m.endedBy === "time" || m.source === "contador") && wins < 2 && losses < 2 && !(m.result === "D" && wins === 1 && losses === 1);
  return { ...blankForm(), editId: m.id, kind: m.kind || "", deckId: m.deckId || null, versionId: m.versionId || null, my: m.my, opp: m.opp, ver: m.deckId && S.deck(m.deckId) ? "" : m.version || "",
    timeResult: byTime ? m.result : null, timeGames: m.games.length, dateTouched: true, _fresh: true,
    ctx: (m.event && m.event.type) || "Outro", eventId: (m.event && m.event.eventId) || null, round: (m.event && m.event.round) || null, turn: (m.games[0] && m.games[0].first) || "",
    note: m.note || "", fmt: m.kind ? prefs.fmt || "bo1" : m.format, result: m.format === "bo1" ? m.result : "", myBf: (m.games[0] && m.games[0].myBf) || "", oppBf: (m.games[0] && m.games[0].oppBf) || "",
    games: gs, timeDraw: m.format === "bo3" && m.result === "D", date: toLocalInput(m.playedAt), set: m.set, setTouched: true, details: true };
}

// Formulário intocado: refaz os padrões (deck, evento) com os dados mais recentes.
const pristine = () => !F.editId && !F.kind && !F.opp && !F.result && !F.turn && !F.myBf && !F.oppBf && !F.dateTouched && !F.games.some((g) => g.result || g.first || g.myBf || g.oppBf) && !F.note;
export function refreshAdd() {
  collect();
  if (pristine()) F = { ...blankForm(), details: F.details };
  // não redesenha se um seletor de lenda estiver aberto
  if (!document.querySelector("#add .pl:not(.hide)")) render();
}
registerView("add", () => { if (SV && !(SV.id && Date.now() < SV.until)) SV = null; collect(); if (pristine()) F = { ...blankForm(), details: F.details }; if (!F.editId) { const ev = S.openEvent(); if (ev && !F.eventId) { F.eventId = ev.id; F.ctx = ev.type; } if (F.eventId && !S.evt(F.eventId)?.status?.startsWith("open")) { F.eventId = null; F.ctx = freeCtx(); F.kind = ""; } } render(); });
export function initRegister() { bind(); }
// saiu da tela Registrar: a folha de battlefields não fica aberta por cima de outra tela
export function leaveAdd() { closeBfSheet(false); }

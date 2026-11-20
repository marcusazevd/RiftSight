// Contador de pontos que vira partida registrada (M1) + tela ligada (M3).
import * as S from "./store.js";
import { esc, $, $$, avatar, domainPair, legendColors, dialog, confirmBox, toast, RUNE, inkOn } from "./ui.js";
import { bfPicker, fmtClock, RES, prefs, savePrefs, fmtTime, knownMyBattlefields, knownOppBattlefields, resultFromGames, registerView, showView, readLive } from "./core.js";
import { myLabel, pickerHTML, bindPickers, paintMatchup, versionField, newVersion, lastVersionId, versionName, nextRound, blankForm, savedToast } from "./register.js";

const LIVE_KEY = "rbt_live";
const WIN = 8;
let L = null;

function load() { L = readLive(); }
// Devolve true se gravou; se o armazenamento estiver cheio, avisa (o placar só fica na memória).
let persistWarn = 0;
function persist() {
  try { if (L) localStorage.setItem(LIVE_KEY, JSON.stringify(L)); else localStorage.removeItem(LIVE_KEY); return true; }
  catch (e) { if (Date.now() - persistWarn > 15000) { persistWarn = Date.now(); toast("Sem espaço no aparelho: o placar não está sendo guardado. Não feche o app."); } return false; }
}

function newGame(n, first, myBf = "", oppBf = "") {
  return { n, first, myBf, oppBf, result: null, points: { me: 0, opp: 0 }, log: [], passes: 0, startedAt: Date.now(), endedAt: null, time: { me: 0, opp: 0 }, clockAt: null };
}
function setupState() {
  const f = blankForm();
  return { phase: "setup", deckId: f.deckId, versionId: f.versionId, my: f.my, opp: "", ver: f.ver, eventId: f.eventId, ctx: f.ctx,
    fmt: f.fmt, first: "", myBf: "", oppBf: "", games: [], cur: 0, startedAt: null, result: null, note: "" };
}
const G = () => L.games[L.cur];
const active = (g) => (g.passes % 2 === 0 ? g.first : g.first === "me" ? "opp" : "me");
const turnNo = (g) => Math.floor(g.passes / 2) + 1;
const matchScore = () => resultFromGames(L.games.filter((g) => g.result));

// ---------- relógio por jogador (estilo xadrez) ----------
// O tempo corre para quem está com o turno; "Passar turno" troca o relógio.
// Intervalo maior que 15 min (app fechado ou esquecido) não conta: nenhum turno dura isso.
const MAX_GAP = 15 * 60 * 1000;
const gap = (g, now) => { const d = g.clockAt ? now - g.clockAt : 0; return d > 0 && d <= MAX_GAP ? d : 0; };
function tick(g) {
  if (!g || !g.time) return;
  const now = Date.now();
  g.time[active(g)] += gap(g, now);
  g.clockAt = now;
}
function pauseClock(g) { if (g && g.time) { tick(g); g.clockAt = null; } }
function liveTime(g, side) { const t = (g.time && g.time[side]) || 0; return g.clockAt && active(g) === side ? t + gap(g, Date.now()) : t; }
let clockTimer = null;
function startClockUI() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (!L || L.phase !== "play") { clearInterval(clockTimer); return; }
    const g = G();
    const a = document.getElementById("clk-me"), b = document.getElementById("clk-opp"), t = document.getElementById("clk-total");
    if (a) a.textContent = fmtClock(liveTime(g, "me"));
    if (b) b.textContent = fmtClock(liveTime(g, "opp"));
    if (t) t.textContent = fmtClock(Date.now() - (L.startedAt || Date.now()));
  }, 1000);
}

// ---------- tela ligada ----------
let lock = null;
async function wake(on) {
  try { if (window.RBTAndroid) { window.RBTAndroid.keepAwake(!!on); return; } } catch (e) {}
  try {
    if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => (lock = null)); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { /* sem permissão neste ambiente */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && L && L.phase === "play") wake(true); });

// ---------- setup ----------
function bfOpts(list, used = []) { return list.filter((b) => !used.includes(b)).map((b) => `<option value="${esc(b)}">`).join(""); }
function renderSetup() {
  const el = $("#live"), dk = L.deckId ? S.deck(L.deckId) : null, ev = L.eventId ? S.evt(L.eventId) : null;
  const mine = dk ? (dk.battlefields || []).filter(Boolean) : knownMyBattlefields();
  el.innerHTML = `<button class="btn" type="button" id="lv-back" style="margin-bottom:12px">‹ Voltar</button>
  <div class="card gold"><h2>Escolha as lendas</h2>
    <div class="mu"><div class="pick" id="lmy" data-side="my">${pickerHTML("my", L.my, myLabel(dk), true, L.deckId)}</div><div class="vs">VS</div><div class="pick" id="lopp" data-side="opp">${pickerHTML("opp", L.opp, "Oponente", false)}</div></div>
    <label for="lv-ver">Versão</label>${versionField("lv-ver", L.deckId, L.versionId, L.ver, "lv-vers")}
    <div class="seg c2 fmt" role="group" aria-label="Formato"><button type="button" data-fmt="bo1" class="${L.fmt !== "bo3" ? "on" : ""}">Partida única</button><button type="button" data-fmt="bo3" class="${L.fmt === "bo3" ? "on" : ""}">Melhor de 3</button></div>
    <div class="tg wide" role="group" aria-label="Quem começa"><span class="m">Quem começa?</span><button type="button" data-first="me" class="${L.first === "me" ? "on" : ""}">Eu</button><button type="button" data-first="opp" class="${L.first === "opp" ? "on" : ""}">Oponente</button><button type="button" data-first="coin">Sortear</button></div>
    <div class="bfrow"><label>Meu battlefield</label>${bfPicker("lv-mybf", L.myBf, mine.length ? mine : knownMyBattlefields())}
    <label>Do oponente</label>${bfPicker("lv-opbf", L.oppBf, knownOppBattlefields())}</div>
    <p class="m" style="margin:12px 0 0">${ev ? `Evento: <b>${esc(ev.name)}</b> · rodada ${nextRound(ev.id)}` : "Tipo de jogo: " + esc(L.ctx)}</p>
    <button class="go big-start" id="lv-start" type="button">COMEÇAR PARTIDA</button>
  </div>`;
  paintMatchup($(".mu", el), L.my, L.opp);
}
function collectSetup() {
  const v = (id) => { const x = document.getElementById(id); return x ? x.value : null; };
  if (v("lv-ver") !== null) { if (L.deckId) { if (v("lv-ver") !== "__new") L.versionId = v("lv-ver"); } else L.ver = v("lv-ver").trim(); }
  if (v("lv-mybf") !== null) L.myBf = v("lv-mybf").trim();
  if (v("lv-opbf") !== null) L.oppBf = v("lv-opbf").trim();
}

// ---------- placar (estilo arcade) ----------
// Lista ordenada da origem de cada ponto de um lado (−1 remove o último).
function srcList(g, side) {
  const st = [];
  for (const x of g.log || []) { if (x.side !== side) continue; if (x.d > 0) st.push(x.src || "other"); else if (x.d < 0) st.pop(); }
  return st;
}
function segBar(g, side, name) {
  const [a, b] = legendColors(name), srcs = srcList(g, side), pts = g.points[side];
  const col = (s) => (s === "conquer" ? a : s === "hold" ? b : "#a99fd0");
  return `<div class="segbar" role="img" aria-label="${pts} de ${WIN} pontos">${Array.from({ length: WIN }, (_, i) =>
    `<i style="background:${i < pts ? col(srcs[i] || "other") : "#2a1f48"}" class="${i === pts && pts === WIN - 1 ? "next" : ""}"></i>`).join("")}</div>`;
}
// ---------- placar "mesa" (0.9.4, versão A) ----------
// Quem está no turno ganha a maior parte da tela; o outro lado fica compacto (altura fixa).
// Ao trocar o turno as alturas trocam com transição (CSS); nos SWAP_MS seguintes os botões de
// ponto ficam desabilitados para que um toque duplo em "Passar turno" não vire ponto do outro lado
// (e um 2º "Passar turno" nesse intervalo é ignorado). Desfazer funciona sempre.
const SWAP_MS = 400;
let guardUntil = 0;
const guarded = () => Date.now() < guardUntil;
function setGuard() { guardUntil = Date.now() + SWAP_MS; }
// Onde estava o "Passar turno" vira o CONQUER/HOLD de quem recebeu o turno. Por PASS_ZONE_MS,
// um toque nessa área (com folga) é ignorado e os botões que caem nela ficam marcados.
const PASS_ZONE_MS = 900;
let passZone = null;
const inZone = (x, y) => passZone && Date.now() < passZone.until && x >= passZone.l && x <= passZone.r && y >= passZone.t && y <= passZone.b;
function markZone() {
  if (!passZone) return;
  $$("#live .board .act-b").forEach((b) => {
    const r = b.getBoundingClientRect();
    b.classList.toggle("zn", Date.now() < passZone.until && r.right > passZone.l && r.left < passZone.r && r.bottom > passZone.t && r.top < passZone.b);
  });
}
function panel(side) {
  const g = G(), name = side === "me" ? L.my : L.opp, pts = g.points[side], act = active(g) === side;
  const [a, b] = legendColors(name), s = sourcesOf(g, side);
  const label = side === "me" ? (L.deckId && S.deck(L.deckId) ? S.deck(L.deckId).name : name) : name;
  // CONQUER/HOLD levam a cor do domínio: o texto fica escuro nos domínios claros (Ordem, Corpo, Calma, Mente)
  const ka = inkOn(a), kb = inkOn(b), off = guarded() ? " disabled" : "";
  const bt = (cls, d, src, txt, aria) => `<button type="button" class="act-b ${cls}" data-side="${side}" data-d="${d}"${src ? ` data-src="${src}"` : ""} aria-label="${aria}"${off}>${txt}</button>`;
  const btns = bt("c", 1, "conquer", act ? "CONQUER" : "CONQ", `Ponto de conquer para ${esc(name)}`)
    + bt("h", 1, "hold", "HOLD", `Ponto de hold para ${esc(name)}`)
    + bt("o", 1, "other", "+1", `Ponto de outra origem para ${esc(name)}`)
    + bt("m", -1, "", "−1", `Tirar um ponto de ${esc(name)}`);
  const clk = `<b id="clk-${side}">${fmtClock(liveTime(g, side))}</b>`, nm = esc(label).toUpperCase();
  const body = act
    ? `<div class="pa-h">${avatar(name, 60)}<div class="pa-n"><span class="pa-t">${nm}</span><span class="pa-turn">▶ ${side === "me" ? "SEU TURNO" : "TURNO DELE"}</span></div>
        <div class="pa-clk"><span class="clk on">${clk}</span><small>${side === "me" ? "seu relógio" : "relógio dele"}</small></div></div>
      <div class="pa-s"><output class="pts" aria-live="polite">${pts}</output><div class="pa-i"><span class="pa-de">DE ${WIN}</span><span class="srcs">Conquer ${s.conquer} · Hold ${s.hold}</span>${s.other ? `<span class="srcs">+${s.other} ${s.other === 1 ? "outro" : "outros"}</span>` : ""}${pts === WIN - 1 ? '<span class="almost">▲ FALTA 1 PONTO ▲</span>' : `<span class="left">faltam ${Math.max(0, WIN - pts)}</span>`}</div></div>
      ${segBar(g, side, name)}
      <div class="srcb big">${btns}</div>`
    : `<div class="pc-h">${avatar(name, 40)}<div class="pc-n"><div class="pc-t"><span>${nm}</span><span class="clk">${clk}</span></div>${segBar(g, side, name)}
        <span class="srcs">Conquer ${s.conquer} · Hold ${s.hold}${s.other ? " · +" + s.other : ""}</span></div><output class="pts${pts === WIN - 1 ? " almost1" : ""}" aria-live="polite">${pts}</output></div>
      <div class="srcb row">${btns}</div>`;
  return { cls: `pn ${side} ${act ? "act" : "cmp"}`, style: `--a:${a};--b:${b};--ca:${ka.bg};--ia:${ka.ink};--cb:${kb.bg};--ib:${kb.ink}`,
    aria: `${side === "me" ? "Você" : "Oponente"}: ${name}, ${act ? "no turno" : "fora do turno"}`, body };
}
function midHTML() {
  const g = G(), ms = matchScore(), me = active(g) === "me";
  const bf = g.myBf || g.oppBf ? `<div class="mid-bf">${g.myBf ? `<span>Seu bf: <b>${esc(g.myBf)}</b></span>` : ""}${g.oppBf ? `<span>Dele: <b>${esc(g.oppBf)}</b></span>` : ""}</div>` : "";
  return `<div class="mid-r${bf ? " bf" : ""}"><div class="mid-l"><span class="mid-g">${L.fmt === "bo3" ? "GAME " + g.n + " · " + ms.w + "–" + ms.l : "PARTIDA BO1"}</span>
      <span class="mid-t">Turno ${turnNo(g)} · <b id="clk-total">${fmtClock(Date.now() - (L.startedAt || Date.now()))}</b><span class="dp"> de partida</span></span></div>${bf}</div>
    <div class="mid-b"><button type="button" class="mb" id="lv-undo" aria-label="Desfazer última ação" ${g.log.length ? "" : "disabled"}>↶</button>
      <button type="button" class="mb pass" id="lv-pass" aria-label="Passar o turno ${me ? "para o oponente" : "para você"}">${me ? "PASSAR TURNO ▲" : "▼ PASSAR TURNO"}</button>
      <button type="button" class="mb" id="lv-menu" aria-label="Opções da partida">⋯</button></div>`;
}
// fresh: monta o placar do zero (sem animação). Senão atualiza os mesmos elementos, para que a
// troca de alturas entre os lados seja animada pela transição do CSS.
function renderPlay(fresh = false) {
  const el = $("#live"), g = G(), act = active(g);
  let board = fresh ? null : $(".board", el);
  const focus = document.activeElement && board && board.contains(document.activeElement) ? document.activeElement.id : "";
  if (!board) { el.innerHTML = `<div class="board"><div class="pn opp" role="region"></div><div class="mid"></div><div class="pn me" role="region"></div></div>`; board = $(".board", el); }
  else if (board.dataset.act && board.dataset.act !== act) setGuard();
  board.dataset.act = act;
  for (const side of ["opp", "me"]) {
    const p = panel(side), n = $(".pn." + side, board);
    n.className = p.cls; n.setAttribute("style", p.style); n.setAttribute("aria-label", p.aria); n.innerHTML = p.body;
  }
  $(".mid", board).innerHTML = midHTML();
  if (focus) { const f = document.getElementById(focus); if (f && !f.disabled) f.focus(); }
  if (guarded()) setTimeout(() => { if (!guarded()) $$("#live .board .act-b").forEach((x) => (x.disabled = false)); }, guardUntil - Date.now() + 10);
}
// Origem dos pontos de um lado (−1 cancela o último ponto daquele lado).
export function sourcesOf(g, side) {
  const st = [];
  for (const x of g.log || []) { if (x.side !== side) continue; if (x.d > 0) st.push(x.src || "other"); else if (x.d < 0) st.pop(); }
  return { conquer: st.filter((s) => s === "conquer").length, hold: st.filter((s) => s === "hold").length, other: st.filter((s) => s === "other").length };
}
function srcSummary(g, side) { const s = sourcesOf(g, side); return s.conquer + s.hold + s.other ? `C ${s.conquer} · H ${s.hold}${s.other ? " · +" + s.other : ""}` : ""; }
async function point(side, d, src = null) {
  if (guarded()) return; // toque logo após a troca de turno: ignorado (ver SWAP_MS)
  const g = G();
  const v = g.points[side] + d;
  if (v < 0) return;
  g.points[side] = v;
  g.log.push({ t: Date.now(), side, d, src: d > 0 ? src || "other" : null, turn: turnNo(g), active: active(g), me: g.points.me, opp: g.points.opp });
  persist(); renderPlay();
  if (navigator.vibrate) try { navigator.vibrate(d > 0 ? 18 : 8); } catch (e) {}
  if (d > 0 && v >= WIN) await endGame(side === "me" ? "W" : "L");
}
function undo() {
  const g = G(), last = g.log.pop(); if (!last) return;
  if (last.side === "turn") {
    // o tempo desde o "passar" volta para quem estava com o turno
    const now = Date.now(), dt = g.time ? gap(g, now) : 0;
    g.passes = Math.max(0, g.passes - 1);
    if (g.time) { g.time[active(g)] += dt; if (g.clockAt) g.clockAt = now; }
  } else g.points[last.side] = Math.max(0, g.points[last.side] - last.d);
  persist(); renderPlay();
}
function pass() {
  if (guarded()) return; // toque duplo em "Passar turno" não devolve o turno
  const pb = $("#lv-pass");
  if (pb) {
    const r = pb.getBoundingClientRect();
    passZone = { l: r.left - 16, r: r.right + 16, t: r.top - 24, b: r.bottom + 24, until: Date.now() + PASS_ZONE_MS };
    setTimeout(markZone, SWAP_MS + 20);
    setTimeout(() => { passZone = null; $$("#live .board .act-b.zn").forEach((b) => b.classList.remove("zn")); }, PASS_ZONE_MS + 20);
  }
  const g = G(); tick(g); g.passes++;
  g.log.push({ t: Date.now(), side: "turn", d: 0, turn: turnNo(g), active: active(g), me: g.points.me, opp: g.points.opp });
  persist(); renderPlay();
}

async function endGame(res, byTime = false) {
  pauseClock(G());
  if (byTime) return finishGame(res, true);
  L.phase = "gameover"; L.pending = res; L.reveal = true; wake(false); persist(); render();
  buzz(res);
}
// R12: vibração curta no fim do game (só onde o aparelho deixa).
function buzz(res) {
  try { if (navigator.vibrate && !matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate(res === "W" ? [40, 60, 40, 60, 120] : [220]); } catch (e) {}
}
function finishGame(res, byTime) {
  const g = G();
  g.result = res; g.endedAt = Date.now(); delete L.pending;
  const ms = matchScore();
  const decided = L.fmt !== "bo3" || ms.w === 2 || ms.l === 2 || byTime;
  if (decided) { L.result = byTime && L.result ? L.result : L.fmt === "bo3" ? (ms.w > ms.l ? "W" : ms.l > ms.w ? "L" : "D") : res; L.phase = "summary"; wake(false); }
  else { L.phase = "between"; L.nextFirst = res === "L" ? "me" : "opp"; L.myBf = ""; L.oppBf = ""; }
  persist(); render();
}
function renderGameOver() {
  const el = $("#live"), g = G(), res = L.pending, win = res === "W";
  const a = sourcesOf(g, "me"), b = sourcesOf(g, "opp"), [ma, mb] = legendColors(L.my), [oa, ob] = legendColors(L.opp);
  const bar = (s, c1, c2) => { const n = s.conquer + s.hold + s.other || 1; return `<span class="obar"><i style="width:${(s.conquer / n) * 100}%;background:${c1}"></i><i style="width:${(s.hold / n) * 100}%;background:${c2}"></i><i style="width:${(s.other / n) * 100}%;background:#a99fd0"></i></span>`; };
  const after = resultFromGames([...L.games.filter((x) => x.result), { result: res }]);
  const decided = L.fmt !== "bo3" || after.w === 2 || after.l === 2;
  const rv = L.reveal ? " reveal" : ""; if (L.reveal) { L.reveal = false; persist(); }
  const sparks = win && rv ? `<div class="sparks" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 5) * 40}ms;--c:${["var(--gold)", "var(--cyan)", "var(--win)"][i % 3]}"></i>`).join("")}</div>` : "";
  el.innerHTML = `<div class="gameover ${win ? "win" : "loss"}${rv}">${sparks}
    <div class="go-k">${L.fmt === "bo3" ? "GAME " + g.n + " · " : ""}TURNO ${turnNo(g)}</div>
    <div class="go-t">${win ? "VITÓRIA!" : "DERROTA"}</div>
    <div class="go-s"><div class="${win ? "" : "dim"}">${avatar(L.my, 64)}<b>${g.points.me}</b></div><span>×</span><div class="${win ? "dim" : ""}">${avatar(L.opp, 64)}<b>${g.points.opp}</b></div></div>
    ${g.time ? `<div class="card"><h2>Tempo</h2><div class="kpis"><div><b>${fmtClock(g.time.me)}</b><span>seu tempo</span></div><div><b>${fmtClock(g.time.opp)}</b><span>tempo dele</span></div><div><b>${fmtClock(g.time.me + g.time.opp)}</b><span>game</span></div></div></div>` : ""}
    <div class="card"><h2>De onde vieram os pontos</h2>
      <div class="obars"><span>Você</span>${bar(a, ma, mb)}<span>${esc(L.opp)}</span>${bar(b, oa, ob)}</div>
      <p class="m">Você: ${a.conquer} conquer · ${a.hold} hold${a.other ? " · " + a.other + (a.other === 1 ? " outro" : " outros") : ""} — ${esc(L.opp)}: ${b.conquer} conquer · ${b.hold} hold${b.other ? " · " + b.other + (b.other === 1 ? " outro" : " outros") : ""}</p></div>
    ${L.fmt === "bo3" ? `<div class="card gold"><h2>Placar do match · ${after.w} – ${after.l}</h2><p style="margin:0">${decided ? (after.w > after.l ? "Você venceu o match!" : "O oponente venceu o match.") + " Continuar abre o resumo." : "Continuar prepara o game " + (g.n + 1) + "."}</p></div>` : ""}
    <div class="go-a"><button type="button" class="btn" id="lv-go-undo">DESFAZER</button><button type="button" class="go" id="lv-go-ok">CONTINUAR ▶</button></div>
  </div>`;
}

function renderBetween() {
  const el = $("#live"), ms = matchScore(), dk = L.deckId ? S.deck(L.deckId) : null;
  const usedMine = L.games.map((g) => g.myBf).filter(Boolean), usedOpp = L.games.map((g) => g.oppBf).filter(Boolean);
  const mine = dk ? (dk.battlefields || []).filter(Boolean) : knownMyBattlefields();
  const n = L.games.length + 1;
  el.innerHTML = `<div class="card gold"><h2>Game ${n}</h2><p class="score">Placar: <b>${ms.w}–${ms.l}</b></p>
    <p class="m">Quem perdeu o game anterior escolhe quem começa.</p>
    <div class="tg wide" role="group" aria-label="Quem começa"><span class="m">Quem começa?</span><button type="button" data-nf="me" class="${L.nextFirst === "me" ? "on" : ""}">Eu</button><button type="button" data-nf="opp" class="${L.nextFirst === "opp" ? "on" : ""}">Oponente</button></div>
    <div class="bfrow"><label>Meu battlefield</label>${bfPicker("lv-mybf", "", [...usedMine, ...(mine.length ? mine : knownMyBattlefields())], usedMine)}
    <label>Do oponente</label>${bfPicker("lv-opbf", "", [...usedOpp, ...knownOppBattlefields()], usedOpp)}
    ${usedMine.length ? `<p class="m">No Bo3 o mesmo battlefield não se repete: ${esc(usedMine.join(", "))} já foi usado.</p>` : ""}</div>
    <button class="go" id="lv-next" type="button">COMEÇAR GAME ${n} ▶</button>
    <button class="btn full" id="lv-timeb" type="button" style="margin-top:10px">Encerrar por tempo</button></div>`;
}

// aviso de "desfeito" no topo do resumo (no fluxo da página, sem cobrir botões)
let undoMsg = "";
function renderSummary() {
  const el = $("#live"), ms = matchScore(), dk = L.deckId ? S.deck(L.deckId) : null, ev = L.eventId ? S.evt(L.eventId) : null;
  const mins = (g) => (g.endedAt && g.startedAt ? Math.max(1, Math.round((g.endedAt - g.startedAt) / 60000)) + " min" : "");
  el.innerHTML = `${undoMsg ? `<div class="svbar info" role="status"><span class="sv-t">${esc(undoMsg)}</span></div>` : ""}<div class="card gold"><h2>Resultado da partida</h2>
    <div class="mu"><div class="pick">${avatar(L.my, 56)}<span class="pt">${esc(dk ? dk.name : L.my)}</span></div><div class="vs">VS</div><div class="pick">${avatar(L.opp, 56)}<span class="pt">${esc(L.opp)}</span></div></div>
    <div class="seg c3" id="lv-res" role="group" aria-label="Resultado">${["W", "L", "D"].map((k) => `<button type="button" class="${k} ${L.result === k ? "on" : ""}" data-r="${k}">${RES[k]}</button>`).join("")}</div>
    ${L.fmt === "bo3" ? `<p class="score">Placar: <b>${ms.w}–${ms.l}</b></p>` : ""}
    <div class="gl">${L.games.map((g) => `<div class="gl-r"><b>${L.fmt === "bo3" ? "Game " + g.n : "Jogo"}</b><span class="${(g.result || "").toLowerCase()}">${g.unfinished && L.fmt === "bo3" ? "Interrompido (tempo)" : g.result ? RES[g.result] : "—"} ${g.points.me}–${g.points.opp}</span><span class="m">${g.first === "me" ? "comecei" : g.first === "opp" ? "oponente começou" : ""}${g.myBf ? " · " + esc(g.myBf) : ""}${g.oppBf ? " vs " + esc(g.oppBf) : ""}${mins(g) ? " · " + mins(g) : ""}</span>${g.time ? `<span class="m srcl">⏱ Você ${fmtClock(g.time.me)} · Oponente ${fmtClock(g.time.opp)}</span>` : ""}${srcLine(g)}${spark(g)}</div>`).join("")}</div>
    <p class="m">${dk ? esc(dk.name) + " · " + esc(versionName(dk, L.versionId)) : esc(L.ver || "sem versão")} · ${ev ? esc(ev.name) + " · rodada " + nextRound(ev.id) : esc(L.ctx)}</p>
    <label for="lv-note">Notas</label><textarea id="lv-note" rows="2" placeholder="O que funcionou e o que deu errado">${esc(L.note || "")}</textarea>
    <button class="go" id="lv-save" type="button">SALVAR PARTIDA</button>
    <button class="btn full" id="lv-discard" type="button" style="margin-top:10px">Descartar</button></div>`;
}
function srcLine(g) {
  const a = sourcesOf(g, "me"), b = sourcesOf(g, "opp");
  if (!(a.conquer + a.hold + a.other + b.conquer + b.hold + b.other)) return "";
  const t = (s) => `${s.conquer} conquer · ${s.hold} hold${s.other ? " · " + s.other + (s.other === 1 ? " outro" : " outros") : ""}`;
  return `<span class="m srcl">Você: ${t(a)}<br>Oponente: ${t(b)}</span>`;
}
// linha do tempo da pontuação (mini gráfico)
function spark(g) {
  const pts = g.log.filter((x) => x.side !== "turn");
  if (!pts.length) return "";
  const W = 260, H = 44, n = pts.length;
  const xy = (i, v) => `${(i / Math.max(1, n)) * W},${H - (v / WIN) * (H - 4) - 2}`;
  const line = (k) => [xy(0, 0), ...pts.map((p, i) => xy(i + 1, p[k]))].join(" ");
  const [ma] = legendColors(L.my), [oa] = legendColors(L.opp);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução do placar"><polyline points="${line("opp")}" fill="none" stroke="${oa}" stroke-width="2" opacity=".7"/><polyline points="${line("me")}" fill="none" stroke="${ma}" stroke-width="2.4"/></svg>`;
}

let saving = false;
async function saveLive() {
  if (saving) return;
  L.note = ($("#lv-note") || {}).value || "";
  if (!L.result) { toast("Escolha o resultado"); return; }
  const dk = L.deckId ? S.deck(L.deckId) : null, ev = L.eventId ? S.evt(L.eventId) : null;
  const games = L.games.map((g) => ({ n: g.n, first: g.first || null, result: g.result, ...(g.unfinished ? { unfinished: true } : {}), myBf: g.myBf || null, oppBf: g.oppBf || null,
    points: { me: g.points.me, opp: g.points.opp }, log: g.log, startedAt: g.startedAt, endedAt: g.endedAt, time: g.time ? { me: Math.round(g.time.me), opp: Math.round(g.time.opp) } : null }));
  const ms = resultFromGames(games);
  // resultado escolhido diferente do que o placar diz (ex.: 8–0 marcado como derrota): confirma antes
  if (L.endedBy !== "time") {
    const g1 = games[0], byScore = L.fmt === "bo3" ? (ms.w === ms.l ? "D" : ms.result) : g1 && !g1.unfinished ? g1.result : null;
    const placar = L.fmt === "bo3" ? ms.w + "–" + ms.l : g1 ? g1.points.me + "–" + g1.points.opp : "";
    if (byScore && byScore !== L.result && !(await confirmBox("Resultado diferente do placar", `O placar ${placar} indica ${RES[byScore].toLowerCase()}, mas o resultado marcado é ${RES[L.result].toLowerCase()}. Salvar assim mesmo?`, "Salvar assim"))) return;
  }
  const playedAt = L.startedAt || Date.now();
  const m = { id: S.newId(), schema: S.SCHEMA, createdAt: Date.now(), playedAt, set: S.setForDate(playedAt), my: L.my, opp: L.opp,
    deckId: dk ? dk.id : null, versionId: dk ? L.versionId : null, version: dk ? versionName(dk, L.versionId) : L.ver,
    event: { type: ev ? ev.type : L.ctx, eventId: ev ? ev.id : null, round: ev ? nextRound(ev.id) : null },
    format: L.fmt, score: L.fmt === "bo3" ? ms.score : "", result: L.result, games, note: L.note.trim(), tags: [], source: "contador" };
  if (L.endedBy) m.endedBy = L.endedBy;
  prefs.deckId = L.deckId; prefs.my = L.my; prefs.fmt = L.fmt; savePrefs();
  saving = true;
  let ok = false;
  try { ok = await S.saveMatch(m); } finally { saving = false; }
  if (!ok) { await dialog({ title: "Não foi possível salvar", body: "<p>O aparelho está sem espaço. A partida continua aqui no contador: faça um backup, remova fotos de lendas em Mais e tente salvar de novo.</p>" }); return; }
  const snap = JSON.stringify(L);
  L = null; undoMsg = ""; persist(); wake(false);
  // em evento, o próximo passo é a rodada seguinte: volta para Registrar com o banner atualizado.
  // Desfazer devolve a partida ao resumo do contador (como estava antes de salvar).
  if (ev && ev.status === "open") { showView("add"); savedToast(m, () => restoreSummary(snap)); return; }
  toast(({ W: "Vitória registrada", L: "Derrota registrada", D: "Empate registrado" })[m.result] + " contra " + m.opp);
  showView("hist");
}
// Desfazer depois de salvar: volta ao resumo do contador. Se outra partida já está em andamento no
// contador, não sobrescreve (devolve false e a partida vai para o formulário manual preenchido).
function restoreSummary(snap) {
  const cur = readLive();
  if (cur && cur.phase !== "setup") return false;
  try { localStorage.setItem(LIVE_KEY, snap); } catch (e) { return false; }
  L = null; undoMsg = "Desfeito: a partida voltou para o resumo. Corrija e salve de novo."; showView("live");
  return "live";
}
// Botão voltar do Android: no setup (antes de começar) volta para Registrar; com partida em jogo não trata.
export function liveBack() {
  if (!L || L.phase !== "setup") return false;
  L = null; persist(); showView("add"); return true;
}

async function menu() {
  const v = await dialog({ title: "Partida", body: "<p>O placar fica guardado se você sair.</p>",
    actions: [{ label: "Encerrar por tempo", value: "time" }, { label: "Pausar e sair", value: "pause" }, { label: "Descartar", value: "discard", danger: true }, { label: "Voltar ao jogo", value: null, primary: true }] });
  if (v === "pause") { pauseClock(G()); persist(); wake(false); showView("add"); }
  if (v === "time") await byTime();
  if (v === "discard" && (await confirmBox("Descartar partida?", "O placar e a linha do tempo serão apagados.", "Descartar", true))) { L = null; persist(); wake(false); showView("add"); }
}
async function byTime() {
  const r = await dialog({ title: "Encerrar por tempo", body: "<p>Qual foi o resultado da partida?</p>",
    actions: [{ label: "Cancelar", value: null }, { label: "Derrota", value: "L" }, { label: "Empate", value: "D" }, { label: "Vitória", value: "W", primary: true }] });
  if (!r) return;
  L.result = r; L.endedBy = "time";
  if (L.phase === "play") {
    const g = G();
    pauseClock(g);
    // game interrompido: guarda pontos e linha do tempo, mas não conta como game ganho/perdido.
    // No Bo1 o game é a própria partida, então fica com o resultado escolhido.
    g.unfinished = true; g.result = L.fmt === "bo3" ? null : r; g.endedAt = Date.now();
    L.phase = "summary"; wake(false); persist(); render();
  } else { L.phase = "summary"; persist(); render(); }
}

function render(opts = {}) {
  if (!L) load();
  if (opts.setup && (!L || !L.phase)) L = setupState();
  if (!L) L = setupState();
  persist();
  if (L.phase === "setup") { syncEvent(); persist(); renderSetup(); }
  else if (L.phase === "play") { const g = G(); if (g.time && !g.clockAt) { g.clockAt = Date.now(); persist(); } renderPlay(true); wake(true); startClockUI(); }
  else if (L.phase === "between") renderBetween();
  else if (L.phase === "gameover") renderGameOver();
  else renderSummary();
  document.body.classList.toggle("board-on", L.phase === "play" || L.phase === "gameover");
}

// No setup, a partida pertence ao evento aberto agora (e não ao de quando o setup foi criado).
function syncEvent() {
  const ev = S.openEvent();
  if (ev) { L.eventId = ev.id; L.ctx = ev.type; }
  else if (L.eventId) { const old = S.evt(L.eventId); L.eventId = null; if (old) L.ctx = old.type; }
}
function bind() {
  const el = $("#live");
  bindPickers(el, (side, { legend, deckId }) => {
    collectSetup();
    if (side === "my") { L.my = legend; L.deckId = deckId; L.versionId = deckId ? lastVersionId(S.deck(deckId)) : null; }
    else L.opp = legend;
    persist(); renderSetup();
  });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b || b.closest(".pl")) return;
    if (b.id === "lv-back") { L = null; persist(); showView("add"); return; } // setup não é partida em andamento
    if (b.dataset.fmt) { collectSetup(); L.fmt = b.dataset.fmt; persist(); renderSetup(); return; }
    if (b.dataset.first) {
      collectSetup();
      L.first = b.dataset.first === "coin" ? (Math.random() < 0.5 ? "me" : "opp") : b.dataset.first;
      if (b.dataset.first === "coin") toast(L.first === "me" ? "Sorteio: você começa" : "Sorteio: o oponente começa");
      persist(); renderSetup(); return;
    }
    if (b.id === "lv-start") {
      collectSetup();
      if (!L.my || !L.opp) { toast("Escolha as duas lendas"); return; }
      if (!L.first) { toast("Escolha quem começa"); return; }
      syncEvent();
      L.startedAt = Date.now(); L.games = [newGame(1, L.first, L.myBf, L.oppBf)]; L.cur = 0; L.phase = "play";
      persist(); render(); return;
    }
    if (b.classList.contains("act-b")) {
      if (inZone(e.clientX, e.clientY)) { b.classList.remove("blk"); void b.offsetWidth; b.classList.add("blk"); if (navigator.vibrate) try { navigator.vibrate([10, 40, 10]); } catch (x) {} return; }
      return point(b.dataset.side, +b.dataset.d, b.dataset.src || null);
    }
    if (b.id === "lv-go-undo") { L.phase = "play"; undo(); render(); return; }
    if (b.id === "lv-go-ok") return finishGame(L.pending, false);
    if (b.id === "lv-undo") return undo();
    if (b.id === "lv-pass") return pass();
    if (b.id === "lv-menu") return menu();
    if (b.dataset.nf) { L.nextFirst = b.dataset.nf; $$("[data-nf]", el).forEach((x) => x.classList.toggle("on", x === b)); persist(); return; }
    if (b.id === "lv-next") {
      L.games.push(newGame(L.games.length + 1, L.nextFirst, $("#lv-mybf").value.trim(), $("#lv-opbf").value.trim()));
      L.cur = L.games.length - 1; L.phase = "play"; persist(); render(); return;
    }
    if (b.id === "lv-timeb") return byTime();
    if (b.dataset.r && b.closest("#lv-res")) { L.result = b.dataset.r; $$("#lv-res button").forEach((x) => x.classList.toggle("on", x === b)); persist(); return; }
    if (b.id === "lv-save") return saveLive();
    if (b.id === "lv-discard" && (await confirmBox("Descartar partida?", "Nada será salvo.", "Descartar", true))) { L = null; undoMsg = ""; persist(); showView("add"); }
  });
  el.addEventListener("change", async (e) => {
    if (e.target.id === "lv-ver" && e.target.value === "__new") { collectSetup(); const id = await newVersion(L.deckId); if (id) L.versionId = id; persist(); renderSetup(); }
  });
  el.addEventListener("input", (e) => { if (e.target.id === "lv-note" && L) { L.note = e.target.value; persist(); } });
}

registerView("live", (opts) => render(opts || {}));
export function initLive() { bind(); }

// Tela "Estatísticas": Geral, Matchups (matriz + página do matchup), Versões e Torneio.
import { EVENT_TYPES } from "./data.js";
import * as S from "./store.js";
import { timeStats, pointSources, verKey, record, gameRecord, group, applyFilters, insights, gameRows, firstLabel, wilson, confidence, sideKey, matrix, recommend, smooth, streak, hardestMatchup, bestMatchup } from "./stats.js";
import { esc, $, $$, avatar, legendColors, domainPair, setBadge, setInfo, inkOn } from "./ui.js";
import { RES, RES_SHORT, setName, fmtDate, registerView, fmtClock, canonBf } from "./core.js";

const FL = { set: "", ctx: "", my: "", ver: "", opp: "", per: "" };
let tab = "geral", muOpp = null;
const VC = { side: "", a: "", b: "" };
const TR = { side: "", field: "set" };

const pct = (p) => Math.round(p * 100) + "%";
const rec = (r) => `${r.w}–${r.l}${r.d ? "–" + r.d : ""}`;
const dec = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ciTxt = (r) => { if (r.n < 3) return ""; const [lo, hi] = wilson(r.w, r.n); return `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`; };
const tone = (p) => (p >= 0.5 ? "w" : "l");
const FEW = 5;
// Barra divergente: sai da linha de 50% para a direita (ganhando) ou para a esquerda (perdendo).
// A faixa clara atrás é onde o win rate real provavelmente está (Wilson 95%).
function wr(r, cls = "") {
  const [lo, hi] = wilson(r.w, r.n), p = r.p, t = tone(p);
  const from = Math.min(p, 0.5), len = Math.abs(p - 0.5);
  return `<div class="wr ${t}${r.n < FEW ? " few" : ""} ${cls}" role="img" aria-label="${pct(p)}, faixa provável ${Math.round(lo * 100)} a ${Math.round(hi * 100)}%">
    <span class="wb" style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></span><span class="wf" style="left:${from * 100}%;width:${len * 100}%"></span><span class="w50"></span><span class="wp" style="left:${p * 100}%"></span></div>`;
}
function sideLabel(k) { if (k.startsWith("d:")) { const d = S.deck(k.slice(2)); return d ? d.name : "Deck apagado"; } return k.slice(2); }
function sideLegend(k) { if (k.startsWith("d:")) { const d = S.deck(k.slice(2)); return d ? d.legend : ""; } return k.slice(2); }
function sideMatches(list, k) { return list.filter((m) => sideKey(m) === k); }
function sides(list) {
  const c = new Map(); list.forEach((m) => c.set(sideKey(m), (c.get(sideKey(m)) || 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}
// Escala divergente: rosa (perdendo) → cinza neutro em 50% → verde (ganhando).
function mix(a, b, t) { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; }
const heatColor = (p) => (p < 0.5 ? mix("#ff5f7e", "#6b6290", Math.max(0, (p - 0.2) / 0.3)) : mix("#6b6290", "#26d9a6", Math.min(1, (p - 0.5) / 0.3)));
function heat(p, n) { return `background:${heatColor(p)}`; }
function sel(id, all, vals, cur, label = (v) => v) {
  return `<select id="${id}" aria-label="${esc(all)}">${all ? `<option value="">${esc(all)}</option>` : ""}${vals.map((v) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(label(v))}</option>`).join("")}</select>`;
}

// Lista "nome · recorde · barra · %", ordenada pela quantidade de partidas.
function rows(list, { leg = false, set = false, label = (k) => k } = {}) {
  return list.slice().sort((x, y) => y.n - x.n || y.p - x.p).map((r) => `<div class="br${r.n < FEW ? " few" : ""}">${leg ? avatar(r.k, 30) : ""}<div class="nm">${set ? setBadge(r.k) + " " + esc(setName(r.k)) : esc(label(r.k))}<small>${rec(r)}</small></div>${wr(r)}<div class="pc ${tone(r.p)}">${pct(r.p)}</div></div>`).join("");
}
const AXIS = `<div class="br axis"><span></span><span></span><span class="wr-ax"><i>0%</i><i>50%</i><i>100%</i></span><span></span></div>`;
const KEY = `<p class="m key">Barra: quanto acima ou abaixo de 50%. Faixa clara: onde o win rate real provavelmente está. Apagado: menos de ${FEW} partidas.</p>`;
function tbl(title, list, opts = {}) {
  if (!list.length) return "";
  return `<div class="card"><h2>${title}</h2>${rows(list, opts)}${opts.hint ? `<p class="m" style="margin:10px 0 0">${opts.hint}</p>` : ""}</div>`;
}

// Ritmo de jogo: de onde vêm os pontos (conquer/hold) e tempo por game. Só com dados do contador.
function paceCard(list, title = "Ritmo de jogo") {
  const t = pointSources(list), ts = timeStats(list);
  if (!t.games && !ts) return "";
  let h = `<div class="card"><h2>${title}</h2>`;
  if (t.games) {
    const row = (label, s) => {
      const n = s.conquer + s.hold + s.other; if (!n) return "";
      const w = (k) => (s[k] / n) * 100;
      return `<div class="srow"><div class="nm">${label}<span class="m"> · ${dec(n / t.games)} pontos por game</span></div>
        <div class="sbar"><i class="c" style="width:${w("conquer")}%"></i><i class="h" style="width:${w("hold")}%"></i><i class="o" style="width:${w("other")}%"></i></div>
        <div class="m"><b class="c">■</b> Conquer ${Math.round(w("conquer"))}% · <b class="h">■</b> Hold ${Math.round(w("hold"))}%${s.other ? " · outros " + Math.round(w("other")) + "%" : ""}</div></div>`;
    };
    h += row("Tu", t.me) + row("Oponentes", t.opp);
  }
  if (ts) h += `<div class="kpis"><div><b>${fmtClock(ts.total)}</b><span>por game</span></div><div><b>${fmtClock(ts.me)}</b><span>teu tempo</span></div><div><b>${fmtClock(ts.opp)}</b><span>do oponente</span></div></div>`;
  return h + `<p class="m" style="margin:10px 0 0">Só games jogados com o contador (${Math.max(t.games, ts ? ts.games : 0)}).</p></div>`;
}

function tabsBar() {
  const T = [["geral", "GERAL"], ["matchups", "MATCHUPS"], ["versoes", "VERSÕES"], ["torneio", "TORNEIO"]];
  return `<div class="seg c4 tabs" role="tablist">${T.map(([k, l]) => `<button type="button" role="tab" data-st="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
function filtersBar(all) {
  const uniq = (fn) => [...new Set(all.filter((m) => !FL.my || m.my === FL.my).map(fn).filter(Boolean))].sort();
  const usedSets = S.sets().filter((s) => all.some((m) => m.set === s.id)).map((s) => s.id);
  const act = Object.values(FL).some(Boolean);
  const cnt = {}; all.forEach((m) => (cnt[m.my] = (cnt[m.my] || 0) + 1));
  const mine = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  let h = "";
  if (mine.length > 1) h += `<div class="lgs"><button class="lg${FL.my ? "" : " on"}" data-lg=""><span class="av emp" style="--s:40px">★</span><span class="n">Todas</span><span class="c">${all.length} partidas</span></button>${mine.map((n) => `<button class="lg${FL.my === n ? " on" : ""}" data-lg="${esc(n)}">${avatar(n, 40)}<span class="n">${esc(n)}</span><span class="c">${cnt[n]} partidas</span></button>`).join("")}</div>`;
  if (usedSets.length > 1) h += `<div class="setchips" role="group" aria-label="Filtrar por set"><button type="button" data-fset="" class="${FL.set ? "" : "on"}">Todos</button>${usedSets.map((id) => `<button type="button" data-fset="${esc(id)}" class="${FL.set === id ? "on" : ""}" style="--sc:${esc(setInfo(id).color)}">${setBadge(id, { full: true })}</button>`).join("")}</div>`;
  h += `<div class="fl">${sel("f_ctx", "Todos os tipos", EVENT_TYPES, FL.ctx)}${tab === "geral" ? sel("f_ver", "Todas as versões", uniq((m) => m.version), FL.ver) + sel("f_opp", "Todos os oponentes", uniq((m) => m.opp), FL.opp) : ""}
    <select id="f_per" aria-label="Período">${[["", "Todo o período"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"]].map((o) => `<option value="${o[0]}"${o[0] === String(FL.per) ? " selected" : ""}>${o[1]}</option>`).join("")}</select>
    ${act ? '<button class="btn" id="f_clr" type="button">Limpar filtros</button>' : ""}</div>`;
  return h;
}

// ---------- Geral ----------
let DT = "opp"; // "Detalhar por"
function heroCard(d) {
  const r = record(d), g = gameRecord(d), [lo, hi] = wilson(r.w, r.n), last = d.slice(-10), st = streak(d);
  const sw = st && { W: ["vitória", "vitórias"], L: ["derrota", "derrotas"], D: ["empate", "empates"] }[st.result];
  return `<div class="card gold hero"><div class="hero-top"><div class="hero-p ${tone(r.p)}">${pct(r.p)}</div>
      <div><div class="hero-r">${rec(r)}</div><div class="m">${r.n} partida${r.n !== 1 ? "s" : ""}${g.w + g.l ? ` · games ${g.w}–${g.l}` : ""}</div></div></div>
    ${r.n >= 3 ? `<div class="m hero-ci"><span>Win rate real provável</span><b>${Math.round(lo * 100)}–${Math.round(hi * 100)}%</b></div>${wr(r, "big")}` : `<p class="m">Com 3 partidas ou mais aparece a faixa provável do teu win rate.</p>`}
    <div class="chips">${last.map((m) => `<span class="chip ${m.result}" title="${RES[m.result]} contra ${esc(m.opp)}">${RES_SHORT[m.result]}</span>`).join("")}</div>
    <div class="m">Últimas ${last.length}${st ? ` · sequência atual: <b class="${st.result === "W" ? "w" : st.result === "L" ? "l" : ""}">${st.n} ${st.n > 1 ? sw[1] : sw[0]}</b>` : ""}</div></div>`;
}
// Tendência: média das últimas 10 partidas, partida a partida.
function trendCard(d) {
  const N = 10;
  if (d.length < N) return `<div class="card"><h2>Tendência</h2><p class="m" style="margin:0">Aparece a partir de ${N} partidas. Faltam ${N - d.length}.</p></div>`;
  const pts = []; let w = 0;
  d.forEach((m, i) => { w += m.result === "W" ? 1 : 0; if (i >= N) w -= d[i - N].result === "W" ? 1 : 0; if (i >= N - 1) pts.push({ i: i + 1, v: w / N }); });
  const W = 300, H = 110, x = (k) => (pts.length > 1 ? (k / (pts.length - 1)) * W : W), y = (v) => 6 + (1 - v) * (H - 12);
  const line = pts.map((q, k) => `${x(k).toFixed(1)},${y(q.v).toFixed(1)}`).join(" "), lastP = pts[pts.length - 1];
  return `<div class="card"><h2>Tendência</h2><div class="trend" data-pts='${JSON.stringify(pts.map((q) => [q.i, Math.round(q.v * 100)]))}'>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Média das últimas ${N} partidas: hoje ${pct(lastP.v)}">
      <line x1="0" x2="${W}" y1="${y(0.5)}" y2="${y(0.5)}" class="t50"/>
      <polyline points="${line}" class="tl"/></svg>
    <span class="tdot" style="left:100%;top:${(y(lastP.v) / H) * 100}%"></span><span class="tlab t50l" style="top:${(y(0.5) / H) * 100}%">50%</span>
    <span class="tlab tnow" style="top:${(y(lastP.v) / H) * 100}%">${pct(lastP.v)}</span><div class="ttip hide"></div></div>
    <div class="tax m"><span>partida ${pts[0].i}</span><span>hoje</span></div>
    <p class="m" style="margin:6px 0 0">Média das últimas ${N} partidas. Acima da linha tracejada: ganhando mais do que perdendo. Toque no gráfico para ver cada ponto.</p></div>`;
}
function highlights(d) {
  const tiles = [];
  const decks = new Set(d.map(sideKey));
  const vr = group(d, decks.size > 1 ? verKey : (m) => m.version).filter((r) => r.n >= 3);
  if (vr.length) { const v = vr[0], o = vr[1]; tiles.push(`<div class="tile"><div class="k">Melhor versão</div><div class="v">${esc(v.k)}</div><div class="vp ${tone(v.p)}">${pct(v.p)}</div><div class="m">${rec(v)}${o ? ` · ${esc(o.k)}: ${pct(o.p)}` : ""}</div></div>`); }
  // mesma conta da aba Matchups: o que mais pesa (frequência × taxa suavizada), não o extremo com 2 partidas
  const worst = hardestMatchup(d), best = bestMatchup(d);
  const fewTxt = (x) => (x.few ? " (poucos dados)" : "");
  if (worst) tiles.push(`<button class="tile" data-goto-mu="${esc(worst.k)}"><div class="k">Mais difícil</div><div class="v">${avatar(worst.k, 22)}${esc(worst.k)}</div><div class="vp l">${pct(worst.p)}</div><div class="m">${rec(worst)}${fewTxt(worst)} · treinar ›</div></button>`);
  if (best) tiles.push(`<button class="tile" data-goto-mu="${esc(best.k)}"><div class="k">Melhor matchup</div><div class="v">${avatar(best.k, 22)}${esc(best.k)}</div><div class="vp w">${pct(best.p)}</div><div class="m">${rec(best)}${fewTxt(best)} ›</div></button>`);
  const tr = group(gameRows(d), firstLabel);
  const f1 = tr.find((r) => r.k === "Começando"), f2 = tr.find((r) => r.k === "Em segundo");
  if (f1 && f2) { const top = f1.p >= f2.p ? ["Começando", f1, f2, "em segundo"] : ["Em segundo", f2, f1, "começando"]; tiles.push(`<div class="tile"><div class="k">Turno</div><div class="v">${top[0]}</div><div class="vp ${tone(top[1].p)}">${pct(top[1].p)}</div><div class="m">${top[3]}: ${pct(top[2].p)} (por game)</div></div>`); }
  return tiles.length ? `<div class="card"><h2>Destaques</h2><div class="tiles">${tiles.join("")}</div></div>` : "";
}
function detail(d) {
  const gr = gameRows(d), oneSide = new Set(d.map(sideKey)).size === 1;
  const opts = [
    ["opp", "Oponente", !FL.opp, () => rows(group(d, (m) => m.opp), { leg: true })],
    ["ver", "Versão", true, () => rows(group(d, oneSide ? (m) => m.version : verKey))],
    ["my", "Minha lenda", !FL.my && new Set(d.map((m) => m.my)).size > 1, () => rows(group(d, (m) => m.my), { leg: true })],
    ["turn", "Turno", true, () => rows(group(gr, firstLabel)), "Por game: no Bo3 cada game conta separado."],
    ["mybf", "Meu battlefield", true, () => rows(group(gr, (x) => canonBf(x.myBf))), "Por game."],
    ["opbf", "Battlefield dele", true, () => rows(group(gr, (x) => canonBf(x.oppBf))), "Por game."],
    ["set", "Set", !FL.set && new Set(d.map((m) => m.set)).size > 1, () => rows(group(d, (m) => m.set), { set: true })],
    ["ctx", "Evento", !FL.ctx, () => rows(group(d, (m) => m.event && m.event.type))],
  ].filter((o) => o[2]);
  if (!opts.some((o) => o[0] === DT)) DT = opts[0][0];
  const cur = opts.find((o) => o[0] === DT), body = cur[3]();
  return `<div class="card"><h2>Detalhar por</h2><div class="dchips" role="tablist">${opts.map((o) => `<button type="button" role="tab" data-dt="${o[0]}" class="${o[0] === DT ? "on" : ""}">${o[1]}</button>`).join("")}</div>
    ${body ? body + AXIS : '<p class="m">Sem dados para essa divisão ainda.</p>'}${cur[4] ? `<p class="m" style="margin:8px 0 0">${cur[4]}</p>` : ""}${KEY}</div>`;
}
function geral(d) {
  d = d.slice().sort((a, b) => a.playedAt - b.playedAt);
  return heroCard(d) + trendCard(d) + highlights(d) + detail(d) + paceCard(d);
}

// ---------- Matchups ----------
function matchups(d) {
  if (muOpp) return matchupPage(d, muOpp);
  const mx = matrix(d);
  if (!mx.rowKeys.length) return "";
  const cols = mx.colKeys.slice(0, 6), multi = cols.length > 1;
  // texto escuro sobre verde/rosa (fundos claros) e branco sobre o cinza do meio, pelo contraste
  const cell = (r) => { if (!r.n) return `<td class="na">—</td>`; const k = inkOn(heatColor(r.p)); return `<td class="${r.n < FEW ? "few " : ""}${k.dark ? "dk" : "lt"}" style="background:${k.bg}"><b>${pct(r.p)}</b><small>${rec(r)}</small></td>`; };
  const scale = Array.from({ length: 11 }, (_, i) => `<i style="background:${heatColor(i / 10)}"></i>`).join("");
  return `<div class="card"><h2>Matriz de matchups</h2><p class="m" style="margin-top:0">Verde: ganhando. Rosa: perdendo. Cinza: equilibrado. Listrado: menos de ${FEW} partidas. Toque numa linha para abrir o matchup.</p>
    <div class="mxw"><table class="mx"><thead><tr><th></th>${multi ? '<th class="tot">Total</th>' : ""}${cols.map((c) => `<th title="${esc(sideLabel(c))}"><span>${esc(sideLabel(c))}</span></th>`).join("")}</tr></thead>
    <tbody>${mx.rowKeys.map((o) => `<tr data-mu="${esc(o)}"><th>${avatar(o, 24)}<span>${esc(o)}</span></th>${multi ? cell(mx.rowTotal(o)).replace("<td", '<td data-tot="1"').replace('class="', 'class="tot ') : ""}${cols.map((c) => cell(mx.cell(o, c))).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="scale m">0%<span>${scale}</span>100%</div>
    ${mx.colKeys.length > 6 ? `<p class="m">Mostrando os 6 decks mais jogados.</p>` : ""}</div>${hardest(d)}`;
}
// Matchup que mais pesa contra ti: frequente e com win rate baixo (suavizado).
function hardest(d) {
  const best = hardestMatchup(d);
  if (!best) return "";
  return `<div class="card boss"><h2>Matchup mais difícil</h2><div class="muh" style="margin:0">${avatar(best.opp, 44)}<div style="flex:1"><b>${esc(best.opp)} · <span class="l">${pct(best.p)}</span></b><div class="m">${rec(best)} · aparece em ${pct(best.share)} das tuas partidas</div>${wr(best)}</div></div><p class="m" style="margin:8px 0 0">Treinar este matchup é o que mais sobe teu win rate.</p></div>`;
}
function matchupPage(d, opp) {
  const ms = d.filter((m) => m.opp === opp), r = record(ms), gr = gameRows(ms), cf = confidence(r.n, r.w);
  const notes = ms.filter((m) => m.note).slice().reverse();
  let h = `<button class="btn" id="mu-back" type="button" style="margin-bottom:12px">‹ Matriz</button>
  <div class="card gold"><div class="muh">${avatar(opp, 56)}<div><h2 style="margin:0">Contra ${esc(opp)}</h2><div class="doms">${domainPair(opp, 14)}</div></div></div>
    <div class="kpis"><div><b class="${tone(r.p)}">${pct(r.p)}</b><span>win rate</span></div><div><b>${rec(r)}</b><span>${r.n} partida${r.n !== 1 ? "s" : ""}</span></div><div><b>${ciTxt(r) || "—"}</b><span>faixa provável</span></div></div>${r.n >= 3 ? wr(r, "big") : ""}</div>`;
  const parts = [["Com cada versão", group(ms, verKey)], ["Começando ou em segundo (por game)", group(gr, firstLabel)], ["Meu battlefield (por game)", group(gr, (x) => canonBf(x.myBf))], ["Battlefield dele (por game)", group(gr, (x) => canonBf(x.oppBf))]].filter((x) => x[1].length);
  if (new Set(ms.map(sideKey)).size > 1) parts.splice(1, 0, ["Com cada deck", group(ms, (m) => sideLabel(sideKey(m)))]);
  if (parts.length) h += `<div class="card"><h2>Detalhes</h2>${parts.map(([t, l]) => `<div class="pg">${t}</div>${rows(l)}`).join("")}${AXIS}</div>`;
  h += paceCard(ms, "Ritmo neste matchup");
  h += `<div class="card"><h2>Guia do matchup</h2>${notes.length ? notes.map((m) => `<div class="note"><span class="chip ${m.result}">${RES_SHORT[m.result]}</span><div><p>${esc(m.note)}</p><span class="m">${fmtDate(m.playedAt)} · ${esc(m.version || m.my)}</span></div></div>`).join("") : '<p class="m">As notas das partidas contra essa lenda aparecem aqui, reunidas.</p>'}</div>`;
  h += `<div class="card"><h2>Partidas</h2>${ms.slice().reverse().map((m) => `<div class="st"><span class="chip ${m.result}">${RES_SHORT[m.result]}</span><div class="nm">${esc(m.version || m.my)}${m.score ? " · " + esc(m.score.replace("-", "–")) : ""}</div><span class="m">${fmtDate(m.playedAt)}</span></div>`).join("")}</div>`;
  return h;
}

// ---------- Versões (D4 + E6) ----------
function versoes(all) {
  const sd = sides(all);
  if (!sd.length) return "";
  if (!VC.side || !sd.includes(VC.side)) VC.side = sd[0];
  const ms = sideMatches(applyFilters(all, { ...FL, my: "", ver: "", opp: "" }), VC.side);
  const vers = [...new Set(ms.map((m) => m.version || "(sem versão)"))];
  const byRecent = vers.slice().sort((a, b) => Math.max(...ms.filter((m) => (m.version || "(sem versão)") === b).map((m) => m.playedAt)) - Math.max(...ms.filter((m) => (m.version || "(sem versão)") === a).map((m) => m.playedAt)));
  if (!vers.includes(VC.a)) VC.a = byRecent[0] || "";
  if (!vers.includes(VC.b) || VC.b === VC.a) VC.b = byRecent.find((v) => v !== VC.a) || "";
  let h = `<div class="card"><h2>Comparar versões</h2><div class="fl">${sel("vc_side", "", sd, VC.side, sideLabel)}<span></span>${sel("vc_a", "", vers, VC.a)}${sel("vc_b", "", vers, VC.b)}</div>`;
  if (vers.length < 2) return h + '<p class="m">Este deck ainda tem uma versão só. Registre partidas com outra versão para comparar.</p></div>';
  const A = ms.filter((m) => (m.version || "(sem versão)") === VC.a), B = ms.filter((m) => (m.version || "(sem versão)") === VC.b);
  const rA = record(A), rB = record(B);
  // cada versão: ponto no win rate + faixa provável, contra a linha de 50%
  const vrow = (name, r, c) => { const [lo, hi] = wilson(r.w, r.n); return `<div class="vr"><b class="vn ${c}">${esc(name)}</b><div class="vtrack"><span class="w50"></span><span class="wb ${c}" style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></span><span class="wp ${c}" style="left:${r.p * 100}%"></span></div><b class="pc">${pct(r.p)}</b></div><div class="m vsub">${rec(r)} · ${r.n} partida${r.n !== 1 ? "s" : ""}${r.n >= 3 ? ` · faixa ${Math.round(lo * 100)}–${Math.round(hi * 100)}%` : ""}</div>`; };
  h += vrow(VC.a, rA, "va") + vrow(VC.b, rB, "vb") + `<div class="vr axis"><span></span><span class="wr-ax"><i>0%</i><i>50%</i><i>100%</i></span><span></span></div>`;
  const [la, ha] = wilson(rA.w, rA.n), [lb, hb] = wilson(rB.w, rB.n);
  const overlap = !(la > hb || lb > ha), lead = rA.p >= rB.p ? [VC.a, rA, rB] : [VC.b, rB, rA];
  h += `<p class="verdict">${rA.n < 3 || rB.n < 3 ? "Ainda há poucas partidas para comparar." : overlap ? `<b>${esc(lead[0])}</b> está na frente (${pct(lead[1].p)} × ${pct(lead[2].p)}), mas as faixas ainda se cruzam: pode ser sorte. Mais umas 10 partidas com cada uma deixam isso claro.` : `<b>${esc(lead[0])}</b> é melhor com boa segurança: as faixas não se cruzam.`}</p>`;
  const fA = group(gameRows(A), firstLabel), fB = group(gameRows(B), firstLabel);
  const fp = (rows, k) => { const x = rows.find((r) => r.k === k); return x ? `<span class="${tone(x.p)}">${pct(x.p)}</span> <small>${x.n}</small>` : "—"; };
  if (fA.length || fB.length) h += `<table class="cmp mini"><thead><tr><th>Por game</th><th class="va">${esc(VC.a)}</th><th class="vb">${esc(VC.b)}</th></tr></thead><tbody><tr><th>Começando</th><td>${fp(fA, "Começando")}</td><td>${fp(fB, "Começando")}</td></tr><tr><th>Em segundo</th><td>${fp(fA, "Em segundo")}</td><td>${fp(fB, "Em segundo")}</td></tr></tbody></table>`;
  h += "</div>";
  // matchup por versão: as duas versões ligadas por uma linha (quanto mais longa, mais a troca mudou o matchup)
  const opps = [...new Set([...A, ...B].map((m) => m.opp))];
  const mrows = opps.map((o) => ({ o, a: record(A.filter((m) => m.opp === o)), b: record(B.filter((m) => m.opp === o)) })).sort((x, y) => y.a.n + y.b.n - (x.a.n + x.b.n));
  const dot = (r, c) => (r.n ? `<span class="wp ${c}${r.n < 3 ? " few" : ""}" style="left:${r.p * 100}%" title="${pct(r.p)} (${rec(r)})"></span>` : "");
  h += `<div class="card"><h2>Matchup por versão</h2><div class="vkey m"><span><i class="va"></i>${esc(VC.a)}</span><span><i class="vb"></i>${esc(VC.b)}</span><span>vazado: menos de 3 partidas</span></div>
    ${mrows.map((x) => { const both = x.a.n && x.b.n, l = Math.min(x.a.p, x.b.p), w = Math.abs(x.a.p - x.b.p);
      return `<div class="db">${avatar(x.o, 24)}<div class="nm">${esc(x.o)}</div><div class="dtrack"><span class="w50"></span>${both ? `<span class="link" style="left:${l * 100}%;width:${w * 100}%"></span>` : ""}${dot(x.b, "vb")}${dot(x.a, "va")}</div>
        <div class="dv m"><span class="va">${x.a.n ? pct(x.a.p) : "—"}</span> <span class="vb">${x.b.n ? pct(x.b.p) : "—"}</span></div></div>`; }).join("")}
    <p class="m" style="margin:8px 0 0">A linha liga as duas versões: quanto mais longa, mais a troca mudou aquele matchup.</p></div>`;
  return h;
}

// ---------- Torneio (E8) ----------
const FEW_VER = 5, FEW_FIELD = 20; // abaixo disso: sem ★ na versão / aviso de campo pequeno
function torneio(all) {
  const sd = sides(all);
  if (!sd.length) return "";
  if (!TR.side || !sd.includes(TR.side)) TR.side = sd[0];
  const curSet = S.setForDate(Date.now());
  const fieldList = TR.field === "set" ? all.filter((m) => m.set === curSet) : TR.field === "30" ? all.filter((m) => m.playedAt >= Date.now() - 30 * 864e5) : all;
  // todas as versões do deck entram na conta, mesmo as jogadas em outro set (a origem dos dados vai indicada)
  const mine = sideMatches(all, TR.side);
  let h = `<div class="card gold"><h2>Preparação para o torneio</h2><p class="m" style="margin-top:0">Estima o desempenho de cada versão contra as lendas que tu mais enfrenta, pesando cada matchup pela frequência. Matchups com poucas partidas puxam para a média da versão.</p>
    <div class="fl">${sel("tr_side", "", sd, TR.side, sideLabel)}${sel("tr_field", "", ["set", "30", "all"], TR.field, (v) => ({ set: "Campo: " + setName(curSet), "30": "Campo: 30 dias", all: "Campo: tudo" })[v])}</div>`;
  if (!mine.length || !fieldList.length) return h + '<p class="m">Sem partidas suficientes nesse recorte.</p></div>';
  const R = recommend(mine, fieldList);
  const best = R.versions[0], many = R.versions.length > 1;
  // de onde vêm os dados de cada versão, quando não são (só) do set atual
  const from = (v) => (v.sets.some((s) => s !== curSet) ? "dados de " + v.sets.map((s) => setName(s)).join(", ") : "");
  // versão com menos de FEW_VER partidas não ganha ★: aparece marcada "(poucos dados)"
  const fewV = best && best.n < FEW_VER;
  if (best && many) h += `<p class="verdict">${fewV ? "Palpite (poucos dados)" : "Recomendação"}: <b>${esc(best.ver)}</b> · ${pct(best.expected)} esperado contra o campo${best.expected - R.versions[1].expected < 0.04 ? ", praticamente empatada com " + esc(R.versions[1].ver) : ""}.${fewV ? ` Só ${best.n} partida${best.n !== 1 ? "s" : ""} com ela: pode ser sorte.` : best.n < 8 ? " Ainda com poucas partidas: trate como palpite." : ""}</p>`;
  else if (best) h += `<p class="verdict">Só a versão <b>${esc(best.ver)}</b> tem partidas com este deck: sem outra para comparar, não há recomendação. Contra o campo ela rende cerca de ${pct(best.expected)}.${best.n < 8 ? " Ainda com poucas partidas: trate como palpite." : ""}</p>`;
  h += `<div class="pg">Esperado contra o campo</div>${R.versions.map((v, i) => { const top = many && i === 0, src = from(v);
      return `<div class="br${top ? " best" : ""}"><div class="nm">${esc(v.ver)}${top ? (v.n < FEW_VER ? ' <span class="m">(poucos dados)</span>' : " ★") : ""}<small>real ${pct(v.p)} em ${v.n} · cobre ${pct(v.coverage)}${src ? " · " + esc(src) : ""}</small></div><div class="wr ${tone(v.expected)}"><span class="wf" style="left:${Math.min(v.expected, 0.5) * 100}%;width:${Math.abs(v.expected - 0.5) * 100}%"></span><span class="w50"></span><span class="wp" style="left:${v.expected * 100}%"></span></div><div class="pc ${tone(v.expected)}">${pct(v.expected)}</div></div>`; }).join("")}${AXIS}
    <p class="m">"Cobre": parte do campo contra a qual essa versão já jogou.</p></div>`;
  const field = R.practice.slice().sort((a, b) => b.share - a.share);
  const fieldNote = R.fieldSize < FEW_FIELD ? ` <b class="l">Campo pequeno:</b> com menos de ${FEW_FIELD} partidas, as porcentagens mudam muito a cada jogo.` : "";
  h += `<div class="card"><h2>O campo · ${R.fieldSize} partida${R.fieldSize !== 1 ? "s" : ""}</h2><p class="m" style="margin-top:0">Quem tu mais enfrenta neste recorte.${fieldNote}</p>${field.slice(0, 8).map((x) => `<div class="fr">${avatar(x.opp, 24)}<div class="nm">${esc(x.opp)}</div><div class="fbar"><i style="width:${x.share * 100}%"></i></div><div class="m">${pct(x.share)}</div></div>`).join("")}</div>`;
  // só entra o que está abaixo de 50% (taxa suavizada) ou que este deck ainda não enfrentou
  const train = R.practice.filter((x) => !x.n || x.sm < 0.5).slice(0, 6);
  h += `<div class="card"><h2>Matchups para treinar</h2><p class="m" style="margin-top:0">Os que mais pesam: frequentes no campo e com win rate abaixo de 50%, ou que este deck ainda não enfrentou.</p>${!train.length ? '<p class="m">Nenhum matchup do campo está abaixo de 50% com este deck.</p>' : train.map((x) => x.n ? `<div class="br">${avatar(x.opp, 30)}<div class="nm">${esc(x.opp)}<small>${rec(x)}${x.n < 3 ? " (poucos dados)" : ""} · ${pct(x.share)} do campo</small></div>${wr(x)}<div class="pc ${tone(x.p)}">${pct(x.p)}</div></div>` : `<div class="br">${avatar(x.opp, 30)}<div class="nm">${esc(x.opp)}<small>nunca jogou com este deck · ${pct(x.share)} do campo</small></div><div></div><div class="pc">—</div></div>`).join("") + AXIS}</div>`;
  return h;
}

function render() {
  const el = $("#stats"), all = S.getState().matches;
  if (!all.length) { el.innerHTML = tabsBar() + `<div class="card m">Nenhuma partida ainda. Registre uma para ver as estatísticas.<button class="btn pri" id="st-go-add" type="button" style="display:block;margin-top:12px">Registrar partida</button></div>`; el.querySelector("#st-go-add").addEventListener("click", () => document.querySelector("nav button[data-t=add]").click()); return; }
  let h = tabsBar();
  if (tab === "geral" || (tab === "matchups" && !muOpp)) h += filtersBar(all);
  const d = applyFilters(all, tab === "matchups" ? { ...FL, opp: "", ver: "" } : FL);
  if ((tab === "geral" || tab === "matchups") && !d.length) { el.innerHTML = h + `<div class="card m">Nenhuma partida com esses filtros.</div>`; return; }
  h += tab === "geral" ? geral(d) : tab === "matchups" ? matchups(d) : tab === "versoes" ? versoes(all) : torneio(all);
  el.innerHTML = h;
}
// Toque/arraste no gráfico de tendência mostra o ponto mais próximo.
function trendTip(e) {
  const box = e.target.closest(".trend"); if (!box) return;
  const pts = JSON.parse(box.dataset.pts), r = box.getBoundingClientRect();
  const k = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1))));
  const [i, v] = pts[k], tip = box.querySelector(".ttip");
  tip.classList.remove("hide"); tip.textContent = `Partida ${i} · ${v}%`;
  tip.style.left = `${Math.min(Math.max((k / Math.max(1, pts.length - 1)) * 100, 18), 82)}%`;
  let c = box.querySelector(".tcur"); if (!c) { c = document.createElement("span"); c.className = "tcur"; box.appendChild(c); }
  c.style.left = `${(k / Math.max(1, pts.length - 1)) * 100}%`;
}
function bind() {
  const el = $("#stats");
  el.addEventListener("pointerdown", trendTip);
  el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) trendTip(e); });
  el.addEventListener("pointerleave", () => { const t = el.querySelector(".ttip"); if (t) t.classList.add("hide"); }, true);
  el.addEventListener("change", (e) => {
    const id = e.target.id, v = e.target.value;
    const k = { f_set: "set", f_ctx: "ctx", f_ver: "ver", f_opp: "opp", f_per: "per" }[id];
    if (k) FL[k] = v;
    if (id === "vc_side") { VC.side = v; VC.a = ""; VC.b = ""; }
    if (id === "vc_a") VC.a = v; if (id === "vc_b") VC.b = v;
    if (id === "tr_side") TR.side = v; if (id === "tr_field") TR.field = v;
    render();
  });
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.st) { tab = b.dataset.st; muOpp = null; render(); window.scrollTo(0, 0); return; }
    if (b && b.dataset.dt) { DT = b.dataset.dt; render(); return; }
    if (b && b.dataset.gotoMu) { tab = "matchups"; muOpp = b.dataset.gotoMu; render(); window.scrollTo(0, 0); return; }
    if (b && b.classList.contains("lg")) { FL.my = b.dataset.lg; FL.ver = ""; render(); return; }
    if (b && b.dataset.fset !== undefined) { FL.set = b.dataset.fset; render(); return; }
    if (b && b.id === "f_clr") { Object.keys(FL).forEach((k) => (FL[k] = "")); render(); return; }
    if (b && b.id === "mu-back") { muOpp = null; render(); return; }
    const tr = e.target.closest("tr[data-mu]");
    if (tr) { muOpp = tr.dataset.mu; render(); window.scrollTo(0, 0); }
  });
}
// Botão voltar do Android: da página de um matchup volta para a matriz.
export function statsBack() {
  if (tab !== "matchups" || !muOpp) return false;
  muOpp = null; render(); window.scrollTo(0, 0); return true;
}
registerView("stats", render);
export function initAnalysis() { bind(); }

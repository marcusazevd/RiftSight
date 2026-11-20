// Cálculos de estatística (funções puras, sem DOM).
import { score, firstOf, getState } from "./store.js";

// Versão identificada pelo deck: "v1" de decks diferentes não se misturam.
export function verKey(m) {
  if (!m.version) return "";
  const d = m.deckId ? getState().decks.find((x) => x.id === m.deckId) : null;
  return d ? d.name + " · " + m.version : m.version;
}

export function record(list) {
  const r = { w: 0, l: 0, d: 0, n: list.length };
  for (const m of list) { if (m.result === "W") r.w++; else if (m.result === "L") r.l++; else if (m.result === "D") r.d++; }
  r.p = r.n ? r.w / r.n : 0;
  return r;
}

export function gameRecord(list) {
  let w = 0, l = 0;
  for (const m of list) {
    const s = score(m);
    if (s) { const [a, b] = s.split("-").map(Number); w += a; l += b; }
  }
  return { w, l };
}

export function group(list, keyFn) {
  const g = new Map();
  for (const m of list) {
    const k = keyFn(m);
    if (!k) continue;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(m);
  }
  return [...g.entries()].map(([k, ms]) => ({ k, ...record(ms) })).sort((a, b) => b.p - a.p || b.n - a.n);
}

export function applyFilters(list, f) {
  const since = f.per ? Date.now() - Number(f.per) * 864e5 : 0;
  return list.filter((m) =>
    (!f.set || m.set === f.set) &&
    (!f.my || m.my === f.my) &&
    (!f.opp || m.opp === f.opp) &&
    (!f.ver || m.version === f.ver) &&
    (!f.ctx || (m.event && m.event.type) === f.ctx) &&
    (m.playedAt || 0) >= since
  );
}

export function streak(list) {
  if (!list.length) return null;
  const last = list[list.length - 1].result;
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i].result === last; i--) n++;
  return { result: last, n };
}

export const turnLabel = (m) => { const f = firstOf(m); return f === "me" ? "Primeiro" : f === "opp" ? "Segundo" : ""; };

export function insights(list) {
  const out = [];
  const pct = (r) => Math.round(r.p * 100) + "%";
  const s = streak(list);
  if (s) {
    const word = { W: ["vitória", "vitórias seguidas"], L: ["derrota", "derrotas seguidas"], D: ["empate", "empates seguidos"] }[s.result];
    out.push("Sequência atual: " + s.n + " " + (s.n > 1 ? word[1] : word[0]));
  }
  const decks = new Set(list.map((m) => m.deckId || m.my));
  const vr = group(list, decks.size > 1 ? verKey : (m) => m.version).filter((r) => r.n >= 3);
  const mr = group(list, (m) => m.opp).filter((r) => r.n >= 2);
  const tr = group(gameRows(list), firstLabel);
  if (vr.length) out.push("Melhor versão: " + vr[0].k + " (" + pct(vr[0]) + " em " + vr[0].n + ")");
  if (vr.length > 1) { const v = vr[vr.length - 1]; out.push("Versão mais fraca: " + v.k + " (" + pct(v) + " em " + v.n + ")"); }
  if (mr.length && mr[mr.length - 1].p < 0.5) { const v = mr[mr.length - 1]; out.push("Matchup mais difícil: " + v.k + " (" + pct(v) + " em " + v.n + ")"); }
  if (mr.length && mr[0].p > 0.5) out.push("Melhor matchup: " + mr[0].k + " (" + pct(mr[0]) + " em " + mr[0].n + ")");
  if (tr.length === 2) out.push(tr[0].k + ": " + pct(tr[0]) + " dos games · " + tr[1].k.toLowerCase() + ": " + pct(tr[1]));
  return out;
}

export function toCSV(list, setName) {
  // "tipo": vazio = partida jogada; ID (empate combinado) ou BYE (sem oponente), rodadas de evento sem jogo
  const head = ["data", "set", "minha_lenda", "lenda_oponente", "versao", "evento", "formato", "placar", "resultado", "comecei", "notas", "tipo", "rodada"];
  const esc = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = list.map((m) => [
    new Date(m.playedAt).toISOString().slice(0, 16).replace("T", " "),
    setName(m.set), m.my, m.opp, m.version, m.event && m.event.type, m.kind ? "" : m.format === "bo3" ? "Bo3" : "Bo1",
    m.kind ? "" : score(m), { W: "Vitória", L: "Derrota", D: "Empate" }[m.result], turnLabel(m), m.note,
    m.kind === "id" ? "ID" : m.kind === "bye" ? "BYE" : "", (m.event && m.event.round) || "",
  ].map(esc).join(","));
  return [head.join(","), ...rows].join("\n");
}

// Uma linha por game com resultado conhecido (Bo1 usa o resultado da partida).
export function gameRows(list) {
  const out = [];
  for (const m of list) {
    const gs = m.games || [];
    if (m.format !== "bo3") { const g = gs[0] || {}; out.push({ m, first: g.first, myBf: g.myBf, oppBf: g.oppBf, result: m.result }); continue; }
    for (const g of gs) if (g.result) out.push({ m, first: g.first, myBf: g.myBf, oppBf: g.oppBf, result: g.result });
  }
  return out;
}
export const firstLabel = (r) => (r.first === "me" ? "Começando" : r.first === "opp" ? "Em segundo" : "");

// ---------- Sprint 2: análise ----------

// Intervalo de Wilson (95%) para a taxa de vitória: mostra onde o win rate real
// provavelmente está, dada a amostra. Empates contam como não-vitória.
export function wilson(w, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = w / n, z2 = z * z, den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
// Confiança em palavras, pela largura do intervalo.
export function confidence(n, w) {
  const [lo, hi] = wilson(w, n), width = hi - lo;
  if (n < 5) return { label: "pouquíssimos dados", level: 0 };
  if (width > 0.45) return { label: "incerto", level: 1 };
  if (width > 0.3) return { label: "indício", level: 2 };
  return { label: "confiável", level: 3 };
}

// Chave do "meu lado": deck quando houver, senão a lenda.
export const sideKey = (m) => (m.deckId ? "d:" + m.deckId : "l:" + m.my);

// Matriz: linhas = lendas do oponente, colunas = meus decks/lendas.
export function matrix(list) {
  const cols = new Map(), rows = new Map();
  for (const m of list) {
    const c = sideKey(m);
    cols.set(c, (cols.get(c) || 0) + 1);
    if (!rows.has(m.opp)) rows.set(m.opp, new Map());
    const cell = rows.get(m.opp).get(c) || [];
    cell.push(m); rows.get(m.opp).set(c, cell);
  }
  const colKeys = [...cols.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const rowKeys = [...rows.entries()].map(([k, mp]) => [k, [...mp.values()].reduce((a, ms) => a + ms.length, 0)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  return { colKeys, rowKeys, cell: (r, c) => record((rows.get(r) && rows.get(r).get(c)) || []), rowTotal: (r) => record([...rows.get(r).values()].flat()) };
}

// Taxa suavizada: puxa amostras pequenas na direção de uma taxa de referência.
export const smooth = (w, n, prior, k = 3) => (w + k * prior) / (n + k);

// Peso de cada matchup no seu resultado: frequência × taxa suavizada. É a mesma conta em todo lugar
// (aba Matchups, destaques da aba Geral e card do deck), para as telas não se contradizerem.
export const FEW_MU = 5;
export function matchupWeights(list) {
  const by = new Map(); list.forEach((m) => { if (!by.has(m.opp)) by.set(m.opp, []); by.get(m.opp).push(m); });
  return [...by.entries()].map(([opp, ms]) => {
    const r = record(ms), share = ms.length / list.length, sm = smooth(r.w, r.n, 0.5);
    return { k: opp, opp, ...r, share, sm, risk: share * (1 - sm), gain: share * sm, few: r.n < FEW_MU };
  });
}
// O que mais pesa contra: frequente e com taxa suavizada baixa (mínimo de 2 partidas).
// Só concorre quem está abaixo de 50%: um matchup frequente em 54% não esconde um perdedor em 25%.
export function hardestMatchup(list) {
  let best = null;
  for (const x of matchupWeights(list)) { if (x.n < 2 || !(x.p < 0.5)) continue; if (!best || x.risk > best.risk) best = x; }
  return best;
}
// O que mais pesa a favor. Prefere matchups com 5+ partidas; sem nenhum, devolve o melhor com a marca few ("poucos dados").
export function bestMatchup(list) {
  const c = matchupWeights(list).filter((x) => x.n >= 2 && x.p > 0.5).sort((a, b) => b.gain - a.gain || b.n - a.n);
  return c.find((x) => !x.few) || c[0] || null;
}

// Recomendação para o torneio: para cada versão, win rate esperado contra o "campo"
// (lendas que você mais enfrentou), usando taxa por matchup suavizada pela taxa geral da versão.
export function recommend(list, fieldList) {
  const field = new Map();
  fieldList.forEach((m) => field.set(m.opp, (field.get(m.opp) || 0) + 1));
  const totalField = fieldList.length;
  const byVer = new Map();
  list.forEach((m) => { const k = m.version || "(sem versão)"; if (!byVer.has(k)) byVer.set(k, []); byVer.get(k).push(m); });
  const out = [];
  for (const [ver, ms] of byVer) {
    const r = record(ms);
    const base = smooth(r.w, r.n, 0.5);
    let exp = 0, covered = 0;
    for (const [opp, f] of field) {
      const mr = record(ms.filter((m) => m.opp === opp));
      exp += (f / totalField) * smooth(mr.w, mr.n, base);
      if (mr.n) covered += f;
    }
    const bySet = new Map(); ms.forEach((m) => bySet.set(m.set, (bySet.get(m.set) || 0) + 1));
    out.push({ ver, n: r.n, w: r.w, p: r.p, expected: totalField ? exp : base, coverage: totalField ? covered / totalField : 0, ci: wilson(r.w, r.n),
      sets: [...bySet.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]) });
  }
  out.sort((a, b) => b.expected - a.expected);
  const practice = [...field.entries()].map(([opp, f]) => {
    const mr = record(list.filter((m) => m.opp === opp));
    return { opp, share: f / totalField, ...mr, sm: smooth(mr.w, mr.n, 0.5), risk: (f / totalField) * (1 - smooth(mr.w, mr.n, 0.5)) };
  }).sort((a, b) => b.risk - a.risk);
  return { versions: out, practice, fieldSize: totalField };
}

// Origem dos pontos (só partidas do contador): soma por lado e por fonte.
export function pointSources(list) {
  const tot = { me: { conquer: 0, hold: 0, other: 0 }, opp: { conquer: 0, hold: 0, other: 0 }, games: 0 };
  for (const m of list) for (const g of m.games || []) {
    if (!g.log || !g.log.some((x) => x.src)) continue;
    tot.games++;
    for (const side of ["me", "opp"]) {
      const st = [];
      for (const x of g.log) { if (x.side !== side) continue; if (x.d > 0) st.push(x.src || "other"); else if (x.d < 0) st.pop(); }
      st.forEach((s) => tot[side][s]++);
    }
  }
  return tot;
}

// Tempo (só games jogados com o relógio do contador)
export function timeStats(list) {
  let n = 0, me = 0, opp = 0, turns = 0;
  for (const m of list) for (const g of m.games || []) {
    if (!g.time || !(g.time.me + g.time.opp)) continue;
    n++; me += g.time.me; opp += g.time.opp; turns += Math.floor((g.passes || (g.log || []).filter((x) => x.side === "turn").length) / 2) + 1;
  }
  return n ? { games: n, me: me / n, opp: opp / n, total: (me + opp) / n, turns: turns / n } : null;
}

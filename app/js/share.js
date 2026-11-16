// Card compartilhável (T5): imagem PNG do evento ou do deck + texto pronto.
import * as S from "./store.js";
import { record, group, hardestMatchup, bestMatchup } from "./stats.js";
import { RES_SHORT, eventRecord, fmtDate } from "./core.js";
import { esc, $, dialog, toast, legendColors, legendInfo, setInfo } from "./ui.js";
import { DOMAINS } from "./data.js";

const W = 1080, H = 1350;
const C = { bg: "#120c22", panel: "#1b1333", bd: "#3a2a63", gold: "#ffcf3f", cyan: "#5ee7ff", win: "#26d9a6", loss: "#ff5f7e", draw: "#c9b8ff", tx: "#f4efff", mut: "#a99fd0" };
const RC = { W: C.win, L: C.loss, D: C.draw };
const D = '"Press Start 2P", "PS Acentos", monospace', B = '"Jersey 10", system-ui, sans-serif';

async function fonts() {
  try { await Promise.all([document.fonts.load(`40px ${D}`), document.fonts.load(`700 40px ${B}`), document.fonts.load(`400 40px ${B}`)]); } catch (e) {}
}
function loadImg(src) {
  return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
function base(ctx) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.025)";
  for (let y = 0; y < H; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < W; x += 24) ctx.fillRect(x, y, 4, 4);
  const g = ctx.createRadialGradient(W / 2, 260, 20, W / 2, 260, 520);
  g.addColorStop(0, "rgba(155,89,214,.35)"); g.addColorStop(1, "rgba(155,89,214,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // moldura pixelada
  ctx.fillStyle = C.gold;
  ctx.fillRect(24, 24, W - 48, 8); ctx.fillRect(24, H - 32, W - 48, 8); ctx.fillRect(24, 24, 8, H - 48); ctx.fillRect(W - 32, 24, 8, H - 48);
  ctx.fillStyle = C.bg; [[24, 24], [W - 40, 24], [24, H - 40], [W - 40, H - 40]].forEach(([x, y]) => ctx.fillRect(x, y, 16, 16));
  ctx.fillStyle = C.gold; [[36, 36], [W - 44, 36], [36, H - 44], [W - 44, H - 44]].forEach(([x, y]) => ctx.fillRect(x, y, 8, 8));
  ctx.textBaseline = "alphabetic";
  text(ctx, "RIFTSIGHT", 72, 104, `22px ${D}`, C.cyan);
  text(ctx, "App de fã, não oficial · sem vínculo com a Riot Games", W / 2, H - 64, `400 26px ${B}`, C.mut, "center");
}
function text(ctx, s, x, y, font, color, align = "left", maxW) {
  // a fonte pixelada não tem maiúsculas acentuadas: nesses casos usa a Jersey 10
  if (font.includes("Press Start") && /[^\x00-\x7f]/.test(s)) { const px = parseInt(font, 10); font = `700 ${Math.round(px * 1.45)}px ${B}`; }
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  if (maxW) { let t = String(s); while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…"; s = t; }
  ctx.fillText(s, x, y); return ctx.measureText(s).width;
}
// Texto em pedaços com fontes diferentes na mesma linha (ex.: o "º", que a Jersey 10 desenha como "o").
const SYS = "system-ui, -apple-system, Roboto, Arial, sans-serif";
function textParts(ctx, parts, x, y, color, align = "left") {
  const ws = parts.map(([s, font]) => { ctx.font = font; return ctx.measureText(s).width; });
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.fillStyle = color; ctx.textAlign = "left";
  parts.forEach(([s, font], i) => { ctx.font = font; ctx.fillText(s, cx, y); cx += ws[i]; });
  return total;
}
function shadowText(ctx, s, x, y, font, color, align = "left", maxW) {
  text(ctx, s, x + 6, y + 6, font, "#000", align, maxW); return text(ctx, s, x, y, font, color, align, maxW);
}
function initials(n) { const base = n.split(" - ")[0]; const w = base.split(/[\s'-]+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : base.slice(0, 2)).toUpperCase(); }
async function avatar(ctx, name, x, y, s) {
  const [a, b] = legendColors(name);
  ctx.fillStyle = "#000"; ctx.fillRect(x + 8, y + 8, s, s);
  const img = await loadImg(S.getState().images[name]);
  if (img) ctx.drawImage(img, x, y, s, s);
  else {
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
    const fs = Math.round(s * 0.3);
    text(ctx, initials(name), x + s / 2 + 3, y + s / 2 + fs / 2 + 3, `${fs}px ${D}`, "rgba(0,0,0,.55)", "center");
    text(ctx, initials(name), x + s / 2, y + s / 2 + fs / 2, `${fs}px ${D}`, "#fff", "center");
  }
  ctx.lineWidth = Math.max(4, s / 30); ctx.strokeStyle = "#000"; ctx.strokeRect(x, y, s, s);
}
function domainsBar(ctx, name, x, y, w) {
  const d = (legendInfo(name).domains || []).filter((k) => DOMAINS[k]);
  d.forEach((k, i) => { ctx.fillStyle = DOMAINS[k].color; ctx.fillRect(x + i * (w / 2 + 6), y, w / 2 - 6, 12); });
  return d.map((k) => DOMAINS[k].name).join(" · ");
}
function badge(ctx, id, x, y) {
  if (!id) return 0;
  const s = setInfo(id); ctx.font = `20px ${D}`; const w = ctx.measureText(s.name.toUpperCase()).width + 32;
  ctx.fillStyle = s.color + "26"; ctx.fillRect(x, y - 30, w, 42); ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.strokeRect(x, y - 30, w, 42);
  text(ctx, s.name.toUpperCase(), x + 16, y + 1, `20px ${D}`, s.color); return w;
}
function recStr(r) { return `${r.w}-${r.l}${r.d ? "-" + r.d : ""}`; }
function bar(ctx, x, y, w, h, p, color) { ctx.fillStyle = C.bd; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x, y, Math.round(w * p), h); }

async function eventCanvas(ev) {
  await fonts();
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");
  base(ctx);
  const r = eventRecord(ev), ms = r.matches.slice().sort((a, b) => (a.event.round || 0) - (b.event.round || 0));
  const dk = ev.deckId ? S.deck(ev.deckId) : null;
  const my = (dk && dk.legend) || (ms[0] && ms[0].my) || "";
  const setId = (ms[0] && ms[0].set) || S.setForDate(ev.date || Date.now());
  let bx = 72; bx += badge(ctx, setId, bx, 176) + 14; text(ctx, (ev.type || "").toUpperCase(), bx, 176, `20px ${D}`, C.mut);
  shadowText(ctx, ev.name || "Evento", 72, 270, `700 72px ${B}`, C.tx, "left", W - 144);
  text(ctx, [fmtDate(ev.date), ev.place].filter(Boolean).join(" · "), 72, 322, `400 34px ${B}`, C.mut, "left", W - 144);
  if (my) {
    await avatar(ctx, my, 72, 372, 200);
    text(ctx, "MINHA LENDA", 304, 410, `18px ${D}`, C.cyan);
    text(ctx, dk ? dk.name : my, 304, 466, `700 50px ${B}`, C.tx, "left", W - 380);
    text(ctx, dk ? my : "", 304, 512, `400 32px ${B}`, C.mut, "left", W - 380);
    const dn = domainsBar(ctx, my, 304, 540, 300); text(ctx, dn, 304, 594, `400 28px ${B}`, C.mut);
  }
  // recorde
  shadowText(ctx, recStr(r), W / 2, 760, `130px ${D}`, C.gold, "center");
  const subColor = ev.topCut ? C.cyan : C.tx, subFont = `700 40px ${B}`;
  if (ev.placement) {
    // o "º" vai numa fonte que tem o glifo elevado
    const rest = ` lugar${ev.players ? " de " + ev.players : ""}${ev.topCut ? " · TOP CUT" : ""}`;
    textParts(ctx, [[String(ev.placement), subFont], ["º", `700 36px ${SYS}`], [rest, subFont]], W / 2, 828, subColor, "center");
  } else text(ctx, ev.topCut ? "TOP CUT" : `${r.n} rodada${r.n !== 1 ? "s" : ""}`, W / 2, 828, subFont, subColor, "center");
  // rodadas: até 6 numa coluna; de 7 a 12 em duas colunas (6 linhas cada). Tudo acaba antes do rodapé e da moldura.
  const top = 880, two = ms.length > 6, cap = two ? 12 : 6, rh = !two && ms.length <= 4 ? 80 : 58;
  const rows = ms.length > cap ? ms.slice(0, cap - 1) : ms; // passou do limite: a última casa vira "+ N rodadas"
  const gapX = 16, colW = two ? (W - 144 - gapX) / 2 : W - 144;
  const cell = (i) => ({ x: 72 + (two ? Math.floor(i / 6) : 0) * (colW + gapX), y: top + (two ? i % 6 : i) * rh });
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i], { x, y } = cell(i);
    ctx.fillStyle = (two ? i % 6 : i) % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)"; ctx.fillRect(x, y, colW, rh - 6);
    ctx.save(); ctx.translate(0, (rh - 58) / 2);
    const o = two ? [14, 82, 132, 166] : [20, 104, 168, 214]; // em duas colunas tudo fica mais junto, para o nome caber
    text(ctx, "R" + (m.event.round || i + 1), x + o[0], y + 38, `${two ? 18 : 20}px ${D}`, C.mut);
    ctx.fillStyle = RC[m.result]; ctx.fillRect(x + o[1], y + 10, 40, 32);
    text(ctx, RES_SHORT[m.result], x + o[1] + 20, y + 36, `18px ${D}`, "#120c22", "center");
    const [a, b] = legendColors(m.opp); ctx.fillStyle = a; const cw = two ? 12 : 14; ctx.fillRect(x + o[2], y + 12, cw, 28); ctx.fillStyle = b; ctx.fillRect(x + o[2] + cw, y + 12, cw, 28);
    const sc = m.score ? m.score.replace("-", "–") : m.games && m.games[0] && m.games[0].points ? m.games[0].points.me + "–" + m.games[0].points.opp : "";
    text(ctx, "vs " + m.opp, x + o[3], y + 38, `700 34px ${B}`, C.tx, "left", two ? colW - o[3] - (sc ? 92 : 16) : 560);
    if (sc) text(ctx, sc, x + colW - 20, y + 38, `22px ${D}`, RC[m.result], "right");
    ctx.restore();
  }
  if (ms.length > rows.length) { const { x, y } = cell(rows.length); text(ctx, `+ ${ms.length - rows.length} rodadas`, x + colW / 2, y + 38, `400 30px ${B}`, C.mut, "center"); }
  return cv;
}

async function deckCanvas(dk) {
  await fonts();
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");
  base(ctx);
  const all = S.getState().matches.filter((m) => m.deckId === dk.id);
  const r = record(all), cur = S.setForDate(Date.now());
  let bx = 72; bx += badge(ctx, dk.set || cur, bx, 176) + 14; text(ctx, "DECK", bx, 176, `20px ${D}`, C.mut);
  await avatar(ctx, dk.legend, 72, 226, 240);
  shadowText(ctx, dk.name, 344, 300, `700 64px ${B}`, C.tx, "left", W - 420);
  text(ctx, dk.legend, 344, 352, `400 36px ${B}`, C.mut, "left", W - 420);
  const dn = domainsBar(ctx, dk.legend, 344, 380, 300); text(ctx, dn, 344, 436, `400 28px ${B}`, C.mut);
  const last = (dk.versions || []).slice(-1)[0]; if (last) text(ctx, "versão atual: " + last.name, 344, 476, `400 28px ${B}`, C.cyan, "left", W - 420);
  shadowText(ctx, recStr(r), W / 2, 650, `120px ${D}`, C.gold, "center");
  text(ctx, r.n ? `${Math.round(r.p * 100)}% de vitórias · ${r.n} partida${r.n !== 1 ? "s" : ""}` : "Ainda sem partidas", W / 2, 718, `700 40px ${B}`, C.tx, "center");
  let y = 790;
  const vers = group(all, (m) => m.version).sort((a, b) => b.n - a.n).slice(0, 3);
  if (vers.length) {
    text(ctx, "VERSÕES", 72, y, `20px ${D}`, C.cyan); y += 24;
    for (const v of vers) {
      text(ctx, v.k, 72, y + 36, `700 32px ${B}`, C.tx, "left", 330);
      bar(ctx, 400, y + 14, 330, 24, v.p, C.win);
      text(ctx, `${recStr(v)}  ${Math.round(v.p * 100)}%`, W - 72, y + 36, `20px ${D}`, C.tx, "right"); y += 58;
    }
    y += 24;
  }
  // mesma conta da aba Matchups: o que mais pesa a favor e contra (frequência × taxa suavizada)
  const bestMu = bestMatchup(all), hardMu = hardestMatchup(all);
  const pick = [bestMu && ["MELHOR", bestMu, C.win], hardMu && ["MAIS DIFÍCIL", hardMu, C.loss]].filter(Boolean);
  if (pick.length) {
    text(ctx, "MATCHUPS", 72, y, `20px ${D}`, C.cyan); y += 24;
    for (const [lbl, mu, col] of pick) {
      await avatar(ctx, mu.k, 72, y + 6, 72);
      text(ctx, lbl + (mu.few ? " (POUCOS DADOS)" : ""), 172, y + 36, `16px ${D}`, col);
      text(ctx, mu.k, 172, y + 72, `700 32px ${B}`, C.tx, "left", 520);
      text(ctx, `${recStr(mu)}  ${Math.round(mu.p * 100)}%`, W - 72, y + 60, `20px ${D}`, C.tx, "right"); y += 100;
    }
  }
  return cv;
}

function eventText(ev) {
  const r = eventRecord(ev), dk = ev.deckId ? S.deck(ev.deckId) : null;
  const ms = r.matches.slice().sort((a, b) => (a.event.round || 0) - (b.event.round || 0));
  return [`🏆 ${ev.name} (${ev.type})${ev.place ? " — " + ev.place : ""}`,
    `${dk ? dk.name + " · " + dk.legend : ms[0] ? ms[0].my : ""}`,
    `Resultado: ${recStr(r)}${ev.placement ? ` · ${ev.placement}º${ev.players ? " de " + ev.players : ""}` : ""}${ev.topCut ? " · top cut" : ""}`,
    ...ms.map((m) => `R${m.event.round || "?"} ${RES_SHORT[m.result]} vs ${m.opp}${m.score ? " (" + m.score + ")" : ""}`)].filter(Boolean).join("\n");
}
function deckText(dk) {
  const all = S.getState().matches.filter((m) => m.deckId === dk.id), r = record(all);
  const vers = group(all, (m) => m.version).sort((a, b) => b.n - a.n).slice(0, 3);
  return [`🃏 ${dk.name} · ${dk.legend}`, `${recStr(r)} · ${Math.round(r.p * 100)}% em ${r.n} partida${r.n !== 1 ? "s" : ""}`,
    ...vers.map((v) => `${v.k}: ${recStr(v)} (${Math.round(v.p * 100)}%)`)].join("\n");
}

const toBlob = (cv) => new Promise((res) => cv.toBlob(res, "image/png"));
const slug = (s) => String(s || "card").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "card";

async function present(cv, txt, name) {
  const url = cv.toDataURL("image/png"), blob = await toBlob(cv);
  const file = typeof File === "function" ? new File([blob], name + ".png", { type: "image/png" }) : null;
  let canShare = false; try { canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) {}
  const acts = [{ label: "Fechar", value: null }, { label: "Copiar texto", value: "txt" }];
  if (canShare) acts.push({ label: "Compartilhar", value: "share", primary: !dl });
  if (dl) acts.push({ label: "Baixar imagem", value: "dl", primary: true });
  if (window.RBTAndroid) {
    const b64 = url.split(",")[1];
    const a = await dialog({ title: "Card para compartilhar", body: `<img class="sharecard" src="${url}" alt="Card de ${esc(name)}"><textarea id="sh-txt" rows="4" readonly>${esc(txt)}</textarea>`,
      actions: [{ label: "Fechar", value: null }, { label: "Salvar", value: "save" }, { label: "Compartilhar", value: "share", primary: true }] });
    try {
      if (a === "save") toast(window.RBTAndroid.saveImage(name + ".png", b64) === "ok" ? "Imagem salva em Imagens" : "Não deu para salvar");
      if (a === "share") window.RBTAndroid.shareImage(name + ".png", b64, txt);
    } catch (e) { toast("Não deu para compartilhar"); }
    return;
  }
  const v = await dialog({
    title: "Card para compartilhar",
    body: `<img class="sharecard" src="${url}" alt="Card de ${esc(name)}">${dl || canShare ? "" : '<p class="m">Toque e segure na imagem para salvar.</p>'}<textarea id="sh-txt" rows="4" readonly>${esc(txt)}</textarea>`,
    actions: acts,
  });
  if (v === "txt") { try { await navigator.clipboard.writeText(txt); toast("Texto copiado"); } catch (e) { toast("Não deu para copiar"); } }
  if (v === "share") { try { await navigator.share({ files: [file], text: txt }); } catch (e) {} }
  if (v === "dl") { try { await dl.save({ filename: name + ".png", data: blob }); toast("Imagem salva"); } catch (e) { if (!e || e.code !== "declined") toast("Não deu para baixar aqui"); } }
}

export async function shareEvent(ev) { await present(await eventCanvas(ev), eventText(ev), "riftsight-" + slug(ev.name)); }
export async function shareDeck(dk) { await present(await deckCanvas(dk), deckText(dk), "riftsight-deck-" + slug(dk.name)); }
// para testes
export const _canvas = { eventCanvas, deckCanvas, eventText, deckText };

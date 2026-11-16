// Telas: Estatísticas, Histórico (partidas e eventos) e Mais (decks, backup, sets, tema, sobre).
import { DOMAINS, EVENT_TYPES } from "./data.js";
import * as S from "./store.js";
import { record, gameRecord, group, applyFilters, insights, toCSV, gameRows, firstLabel } from "./stats.js";
import { esc, $, $$, avatar, domainPair, domainIcon, legendColors, dialog, confirmBox, toast, RUNE, setBadge } from "./ui.js";
import { RES, RES_SHORT, APP_VERSION, prefs, savePrefs, applyTheme, setName, fmtDate, eventRecord, registerView, showView, knownBattlefields, canonBf } from "./core.js";
import { editMatch, legendOptions, bindPickers, startEvent, closeEvent } from "./register.js";
import { LEGENDS } from "./data.js";

const IC = {
  backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>',
  sets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
  decks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="7" y="3" width="11" height="15" rx="1.5"/><path d="M4 7v12.5A1.5 1.5 0 0 0 5.5 21H15"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="10" cy="10" r="1.6"/><path d="M5 16l4.5-4 3 2.5L16 11l3 3"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>',
  about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
};

// ================= Histórico =================
let histTab = "matches";
function matchRow(m) {
  const g1 = m.games && m.games[0];
  const first = g1 && g1.first ? (g1.first === "me" ? "começou jogando" : "começou em segundo") : "";
  const ev = m.event && m.event.eventId ? S.evt(m.event.eventId) : null;
  const pts = m.format !== "bo3" && g1 && g1.points ? " " + g1.points.me + "–" + g1.points.opp : "";
  return `<div class="hi ${esc(m.result)}">${avatar(m.opp, 36)}<div class="b"><b class="${esc(m.result.toLowerCase())}">${RES[m.result].toUpperCase()}</b>${m.score ? " " + esc(m.score.replace("-", "–")) : esc(pts)} contra ${esc(m.opp)}
    <div class="m">${setBadge(m.set)} com ${esc(m.my)}${m.version ? " (" + esc(m.version) + ")" : ""}<br>${ev ? esc(ev.name) + " · rodada " + esc(m.event.round || "?") : esc((m.event && m.event.type) || "")}${first ? ", " + first : ""} · ${fmtDate(m.playedAt)}${m.source === "contador" ? " · ⏱" : ""}${m.note ? "<br>" + esc(m.note) : ""}</div></div>
    <button class="x" data-ed="${esc(m.id)}" aria-label="Editar partida">✎</button><button class="x" data-del="${esc(m.id)}" aria-label="Apagar partida">✕</button></div>`;
}
function renderHist() {
  const el = $("#hist"), ms = S.getState().matches, evs = S.getState().events.slice().sort((a, b) => b.date - a.date);
  const tabs = `<div class="seg c2 tabs" role="tablist"><button type="button" role="tab" data-ht="matches" class="${histTab === "matches" ? "on" : ""}">PARTIDAS (${ms.length})</button><button type="button" role="tab" data-ht="events" class="${histTab === "events" ? "on" : ""}">EVENTOS (${evs.length})</button></div>`;
  if (histTab === "events") {
    const types = [...new Set(evs.map((e) => e.type))];
    const summary = types.length ? `<div class="card"><h2>Por tipo de evento</h2>${types.map((t) => {
      const es = evs.filter((e) => e.type === t), recs = es.map(eventRecord);
      const w = recs.reduce((a, r) => a + r.w, 0), l = recs.reduce((a, r) => a + r.l, 0), d = recs.reduce((a, r) => a + r.d, 0);
      const places = es.map((e) => e.placement).filter(Boolean), tops = es.filter((e) => e.topCut).length;
      return `<div class="st"><div class="nm">${esc(t)}<div class="m">${es.length} evento${es.length > 1 ? "s" : ""}${places.length ? " · melhor: " + Math.min(...places) + "º · média: " + (places.reduce((a, b) => a + b, 0) / places.length).toFixed(1) + "º" : ""}${tops ? " · " + tops + " top cut" : ""}</div></div><div class="m">${w}-${l}${d ? "-" + d : ""}</div><div class="pc">${w + l + d ? Math.round((w / (w + l + d)) * 100) + "%" : "—"}</div></div>`;
    }).join("")}</div>` : "";
    el.innerHTML = tabs + summary + `<div class="card"><h2>Eventos</h2>${evs.length ? evs.map((ev) => {
      const r = eventRecord(ev), dk = ev.deckId ? S.deck(ev.deckId) : null;
      return `<div class="evr ${ev.status === "open" ? "open" : "closed"}"><div class="b"><span class="tag">${esc(ev.type)}</span><b>${esc(ev.name)}</b>${ev.status === "open" ? ' <span class="live-dot">em andamento</span>' : ""}
        <div class="m">${fmtDate(ev.date)}${ev.place ? " · " + esc(ev.place) : ""}${dk ? " · " + esc(dk.name) : ""}</div>
        <div class="evs"><b>${r.w}-${r.l}${r.d ? "-" + r.d : ""}</b>${ev.placement ? ` · ${ev.placement}º${ev.players ? " de " + ev.players : ""}` : ""}${ev.topCut ? " · top cut" : ""}</div>
        ${r.matches.length ? `<div class="rchips">${r.matches.sort((a, b) => (a.event.round || 0) - (b.event.round || 0)).map((m) => `<span class="rchip ${esc(m.result)}" title="Rodada ${esc(m.event.round || "?")}: ${RES[m.result]} vs ${esc(m.opp)}">R${esc(m.event.round || "?")} ${RES_SHORT[m.result]}</span>`).join("")}</div>` : ""}
        ${ev.note ? `<div class="m">${esc(ev.note)}</div>` : ""}</div>
        <div class="evbtns">${r.n ? `<button class="x" data-evshare="${esc(ev.id)}" aria-label="Card para compartilhar" title="Card para compartilhar">⇪</button>` : ""}${ev.status === "open" ? `<button class="btn" data-evclose="${esc(ev.id)}" type="button">Encerrar</button>` : `<button class="x" data-evdel="${esc(ev.id)}" aria-label="Apagar evento">✕</button>`}</div></div>`;
    }).join("") : '<p class="m">Nenhum evento ainda. Comece um na tela Registrar.</p>'}
    ${S.openEvent() ? "" : '<button class="btn pri" id="ev-new" type="button" style="margin-top:12px">Começar evento</button>'}</div>`;
    return;
  }
  el.innerHTML = tabs + (ms.length ? `<div class="card"><h2>Histórico</h2>${ms.slice().reverse().map(matchRow).join("")}</div>` : `<div class="card"><h2>Histórico</h2><p class="m">Nenhuma partida registrada.</p><button class="btn pri" id="hi-go-add" type="button" style="margin-top:4px">Registrar partida</button></div>`);
}
function bindHist() {
  $("#hist").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ht) { histTab = b.dataset.ht; renderHist(); return; }
    if (b.id === "hi-go-add") { document.querySelector("nav button[data-t=add]").click(); return; }
    if (b.dataset.ed) return editMatch(b.dataset.ed);
    if (b.dataset.del) {
      const m = S.getState().matches.find((x) => x.id === b.dataset.del); if (!m) return;
      if (!(await confirmBox("Apagar partida?", `${RES[m.result]} contra ${m.opp} em ${fmtDate(m.playedAt)}.`, "Apagar", true))) return;
      const copy = JSON.parse(JSON.stringify(m));
      if (!(await S.deleteMatch(m.id))) return;
      toast(`${RES[m.result]} contra ${m.opp} apagada`, { label: "Desfazer", fn: async () => { if (await S.saveMatch(copy)) toast("Partida restaurada"); } }, 8000);
      return;
    }
    if (b.dataset.evshare) { const ev = S.evt(b.dataset.evshare); if (ev) { const { shareEvent } = await import("./share.js"); await shareEvent(ev); } return; }
    if (b.dataset.evclose) { const ev = S.evt(b.dataset.evclose); if (ev) await closeEvent(ev); renderHist(); return; }
    if (b.id === "ev-new") { await startEvent(); renderHist(); return; }
    if (b.dataset.evdel) {
      const ev = S.evt(b.dataset.evdel);
      if (ev && (await confirmBox("Apagar evento?", "As partidas continuam no histórico, só perdem o vínculo com o evento.", "Apagar", true))) { await S.removeFrom("events", ev.id); renderHist(); }
    }
  });
}

// ================= Mais =================
let moreView = "menu", editDeck = null;
async function offerFile(filename, text) {
  if (window.RBTAndroid) {
    try { const r = window.RBTAndroid.saveText(filename, text); if (r === "ok") { toast("Salvo em Downloads: " + filename); return true; } } catch (e) { console.warn(e); }
  }
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
    if (dl) { await dl.save({ filename, data: text }); toast("Arquivo salvo"); return true; }
  } catch (e) { if (e && e.code === "declined") return false; console.warn(e); }
  await dialog({
    title: "Copie o conteúdo", body: `<p class="m">Este ambiente não permite baixar arquivos. Copie e guarde num arquivo <b>${esc(filename)}</b>.</p><textarea id="cp" rows="8" readonly>${esc(text)}</textarea>`,
    actions: [{ label: "Fechar", value: false }, { label: "Copiar", primary: true, value: (r) => { copyText($("#cp", r).value); return true; } }],
  });
}
async function copyText(t) { if (window.RBTAndroid) { try { const r = window.RBTAndroid.copy(t); if (r === "ok" || r === undefined) { toast("Copiado"); return true; } toast("Não deu para copiar"); return false; } catch (e) { toast("Não deu para copiar"); return false; } } try { await navigator.clipboard.writeText(t); toast("Copiado"); return true; } catch (e) { toast("Não deu para copiar; selecione o texto"); return false; } }
function markBackup() { prefs.lastBackup = Date.now(); savePrefs(); }
// Lembrete de backup (B3): a cada 14 dias, se houver partidas novas desde o último.
export function backupDue() {
  const ms = S.getState().matches; if (ms.length < 3) return false;
  const last = prefs.lastBackup || 0, snooze = prefs.backupSnooze || 0;
  if (Date.now() - snooze < 3 * 864e5) return false;
  const newer = ms.some((m) => (m.updatedAt || m.createdAt || 0) > last);
  return newer && Date.now() - last > 14 * 864e5;
}
export function backupBanner() {
  return backupDue() ? `<div class="bkline"><span>💾 Backup ${prefs.lastBackup ? "há " + Math.floor((Date.now() - prefs.lastBackup) / 864e5) + " dias" : "nunca feito"}</span><button type="button" data-bk="now">Fazer agora</button><button type="button" class="x" data-bk="later" aria-label="Depois">✕</button></div>` : "";
}
export async function handleBackupBanner(btn) {
  if (btn.dataset.bk === "later") { prefs.backupSnooze = Date.now(); savePrefs(); toast("Lembro em alguns dias"); return true; }
  if (btn.dataset.bk === "now") { const ok = await offerFile(`riftsight-backup-${stamp()}.json`, JSON.stringify(S.exportData(), null, 1)); if (ok) markBackup(); return true; }
  return false;
}
const stamp = () => new Date().toISOString().slice(0, 10);

function deckEditor() {
  const d = editDeck, bfs = knownBattlefields();
  return `<button class="btn" data-go="decks" type="button" style="margin-bottom:12px">‹ Decks</button>
  <div class="card gold"><h2>${d.createdAt ? "Editar deck" : "Novo deck"}</h2>
    <div class="mu" style="grid-template-columns:auto 1fr"><div class="pick" id="dk-leg" data-side="my">${avatar(d.legend, 56)}</div>
      <div><label for="dk-name">Nome do deck</label><input id="dk-name" value="${esc(d.name)}" placeholder="Ex.: Jinx agressiva"></div></div>
    <label>Lenda</label><div class="pick dkpick" data-side="my"><button type="button" class="pb row-pb">${avatar(d.legend, 28)}<span>${d.legend ? esc(d.legend) : "Escolher lenda"}</span><span class="doms">${d.legend ? domainPair(d.legend, 13) : ""}</span></button>
      <div class="pl hide" role="listbox"><input class="ps" placeholder="Buscar lenda…" autocomplete="off" aria-label="Buscar lenda">${legendOptions()}<div class="po pn" data-n="__new">＋ Outra lenda…</div></div></div>
    <label>Battlefields registrados (3)</label>
    ${[0, 1, 2].map((i) => { const v = canonBf((d.battlefields || [])[i] || ""); return `<div class="bfp bfslot" data-bfp="dk-bf${i}"><input type="hidden" id="dk-bf${i}" value="${esc(v)}"><button type="button" class="bfc${v ? " on" : ""}" data-bfsearch="1">${v ? esc(v) : "🔍 Battlefield " + (i + 1)}</button></div>`; }).join("")}
    <h2 style="margin-top:16px">Versões</h2>
    ${(d.versions || []).map((v, i) => `<div class="vrow"><span class="tag">${i + 1}</span><div class="b"><input class="dk-vn" data-i="${i}" value="${esc(v.name)}" aria-label="Nome da versão"><input class="dk-vt" data-i="${i}" value="${esc(v.note || "")}" placeholder="O que mudou" aria-label="O que mudou"></div><span class="m">${fmtDate(v.createdAt)}</span></div>`).join("")}
    <button class="btn" id="dk-addv" type="button" style="margin-top:8px">＋ Nova versão</button>
    <label class="ck"><input type="checkbox" id="dk-arch"${d.archived ? " checked" : ""}> Arquivado (some das listas de escolha)</label>
    <button class="go" id="dk-save" type="button">Salvar deck</button>
    ${d.createdAt ? '<button class="btn full" id="dk-share" type="button" style="margin-top:10px">⇪ Card do deck</button><button class="btn full dan" id="dk-del" type="button" style="margin-top:10px">Apagar deck</button>' : ""}
  </div>`;
}
function collectDeck() {
  if (!editDeck) return;
  editDeck.name = ($("#dk-name") || {}).value?.trim() ?? editDeck.name;
  editDeck.battlefields = [0, 1, 2].map((i) => (($("#dk-bf" + i) || {}).value || "").trim());
  $$(".dk-vn").forEach((x) => (editDeck.versions[+x.dataset.i].name = x.value.trim() || editDeck.versions[+x.dataset.i].name));
  $$(".dk-vt").forEach((x) => (editDeck.versions[+x.dataset.i].note = x.value.trim()));
  const a = $("#dk-arch"); if (a) editDeck.archived = a.checked;
}

function renderMore() {
  const el = $("#more"), st = S.getState();
  const status = window.RBTAndroid && st.backend !== "conta" ? '<span class="status"><i></i>Salvo neste celular (app). Faça backup de vez em quando.</span>' : st.backend === "conta" ? '<span class="status ok"><i></i>Salvo na tua conta Claude e neste aparelho</span>' : '<span class="status"><i></i>Salvo só neste aparelho</span>';
  const back = `<button class="btn" data-go="menu" type="button" style="margin-bottom:12px">‹ Voltar</button>`;
  if (moreView === "menu") {
    const legacy = S.legacyMatches();
    el.innerHTML = backupBanner() + `<div class="card"><h2>Mais</h2><p style="margin:0 0 6px">${status}</p>
      <div class="list">
        <button class="li" data-go="decks">${IC.decks}<span>Meus decks</span><span class="m">${st.decks.filter((d) => !d.archived).length}</span>›</button>
        <button class="li" data-go="legends">${IC.img}<span>Imagens das lendas</span><span class="m">${Object.keys(st.images || {}).length}</span>›</button>
        <button class="li" data-go="backup">${IC.backup}<span>Backup e planilha</span>›</button>
        <button class="li" data-go="sets">${IC.sets}<span>Sets e temporadas</span>›</button>
        <button class="li" id="go-journey">${IC.about}<span>Como usar o app</span>›</button>
        <button class="li" data-go="about">${IC.about}<span>Sobre</span>›</button>
      </div></div>
      ${legacy.length ? `<div class="card"><h2>App anterior</h2><p class="m" style="margin-top:0">Encontrei ${legacy.length} partida${legacy.length > 1 ? "s" : ""} do app anterior. Elas não entram no histórico novo, mas tu pode guardar um backup.</p><div class="btns"><button class="btn" id="lg-dl" type="button">Baixar backup antigo</button><button class="btn" id="lg-cp" type="button">Copiar</button></div></div>` : ""}`;
    return;
  }
  if (moreView === "decks") {
    const ds = st.decks.slice().sort((a, b) => (a.archived - b.archived) || a.name.localeCompare(b.name));
    el.innerHTML = back + `<div class="card"><h2>Meus decks</h2>${ds.length ? ds.map((d) => {
      const ms = st.matches.filter((m) => m.deckId === d.id), r = record(ms), last = (d.versions || [])[d.versions.length - 1];
      return `<button class="li dkrow${d.archived ? " arch" : ""}" data-dk="${esc(d.id)}" type="button">${avatar(d.legend, 40)}<span class="dk-n"><b>${esc(d.name)}</b><span class="m">${esc(d.legend)} · ${last ? esc(last.name) : "sem versão"}${d.archived ? " · arquivado" : ""}</span></span><span class="m dk-r">${r.n ? r.w + "–" + r.l + (r.d ? "–" + r.d : "") : ""}</span><i aria-hidden="true">›</i></button>`;
    }).join("") + "</div>" : '<p class="m">Cadastre teus decks para registrar versões e battlefields. Partidas sem deck continuam funcionando só com a lenda.</p>'}
    <button class="btn pri" id="dk-new" type="button" style="margin-top:12px">＋ Novo deck</button></div>`;
    return;
  }
  if (moreView === "deck") { el.innerHTML = deckEditor(); return; }
  if (moreView === "legends") {
    const names = new Set([...Object.keys(LEGENDS), ...Object.keys(st.settings.customLegends || {}), ...st.matches.flatMap((m) => [m.my, m.opp])]);
    const list = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const withImg = list.filter((n) => st.images[n]).length;
    el.innerHTML = back + `<div class="card"><h2>Imagens das lendas</h2><p class="m" style="margin-top:0">Toque numa lenda para escolher uma imagem do teu aparelho. Ela aparece no confronto, no contador, no histórico e nas estatísticas. ${withImg} de ${list.length} com imagem.</p>
      <input id="lg-q" placeholder="Buscar lenda…" autocomplete="off" aria-label="Buscar lenda">
      <div class="lgrid">${list.map((n) => `<button type="button" class="lgi${st.images[n] ? " has" : ""}" data-limg="${esc(n)}">${avatar(n, 56)}<span>${esc(n)}</span></button>`).join("")}</div></div>`;
    return;
  }
  if (moreView === "backup") {
    const u = S.storageUsage();
    el.innerHTML = back + `<div class="card"><h2>Backup</h2><p class="m" style="margin-top:0">${status}<br>Espaço usado no aparelho: <b class="${u.pct >= 80 ? "loss" : ""}">${u.pct}%</b>${u.pct >= 80 ? " · faça backup e remova fotos de lendas" : ""}<br>Faça um backup de vez em quando. O backup leva partidas, decks, eventos e fotos.${window.RBTAndroid ? " O app também regrava sozinho um backup em Downloads/Riftsight/riftsight-backup-automatico.json." : ""} Importar <b>mescla</b> com o que já existe: nada é apagado.</p>
      <div class="btns"><button class="btn pri" id="bk-json" type="button">Baixar backup (.json)</button><button class="btn" id="bk-csv" type="button">Baixar planilha (.csv)</button><button class="btn" id="bk-copy" type="button">Copiar backup</button></div>
      <label for="bk-file">Importar backup</label><input id="bk-file" type="file"${window.RBTAndroid ? "" : ' accept=".json,application/json"'}>
      <button class="btn" id="bk-paste" type="button" style="margin-top:10px">Colar backup</button></div>`;
    return;
  }
  if (moreView === "sets") {
    const custom = !!(st.settings.sets && st.settings.sets.length);
    el.innerHTML = back + `<div class="card"><h2>Sets e temporadas</h2><p class="m" style="margin-top:0">Cada partida recebe o set em vigor na data dela. Quando sair um set novo, adicione aqui.</p>
      ${S.sets().map((s) => `<div class="setrow">${setBadge(s.id)}<b>${esc(s.name)}</b><span class="m">desde ${new Date(s.start + "T12:00").toLocaleDateString("pt-BR")}</span>${custom ? `<button class="x" data-delset="${esc(s.id)}" aria-label="Remover ${esc(s.name)}">✕</button>` : ""}</div>`).join("")}
      <div class="btns" style="margin-top:12px"><button class="btn pri" id="set-add" type="button">Adicionar set</button>${custom ? '<button class="btn" id="set-reset" type="button">Restaurar lista padrão</button>' : ""}</div></div>`;
    return;
  }
  if (moreView === "about") {
    el.innerHTML = back + `<div class="card gold"><div class="brand" style="margin-bottom:12px"><span class="mark">${RUNE}</span><div><h1>Riftsight</h1><small>Conquer. Hold. Understand. · ${APP_VERSION}</small></div></div>
      <p>Registro de partidas e desempenho por set, deck, versão, battlefield e matchup.</p>
      <p class="m"><b>App de fã, não oficial.</b> Não tem vínculo nem endosso da Riot Games. Riftbound, League of Legends e nomes relacionados são marcas da Riot Games. Nenhuma arte oficial é usada: ícones e cores são próprios.</p>
      <p class="m" lang="en" style="font-size:.9em">Riftsight isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, Riftbound and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      <p class="m">Site, privacidade e código: <a href="https://marcusazevd.github.io/riftsight/" target="_blank" rel="noopener">marcusazevd.github.io/riftsight</a></p>
      <div class="orn">${RUNE}</div>
      <p class="m">${Object.entries(DOMAINS).map(([k, d]) => domainIcon(k, 16) + " " + d.name).join(" &nbsp; ")}</p></div>`;
  }
}

function bindMore() {
  const el = $("#more");
  bindPickers(el, (side, { legend }) => { collectDeck(); editDeck.legend = legend; if (!editDeck.name) editDeck.name = legend; renderMore(); });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b || b.closest(".pl") || b.classList.contains("pb")) return;
    if (b.dataset.bk) { await handleBackupBanner(b); renderMore(); return; }
    if (b.dataset.limg) { await imageEditor(b.dataset.limg); renderMore(); return; }
    if (b.dataset.go === "theme") {
      const t = await dialog({ title: "Tema", body: "<p>Escolha a aparência do app.</p>", actions: [{ label: "Automático", value: "auto" }, { label: "Pergaminho", value: "light" }, { label: "Noite", value: "dark", primary: true }] });
      if (t) { prefs.theme = t; savePrefs(); applyTheme(); renderMore(); }
      return;
    }
    if (b.dataset.go) { moreView = b.dataset.go; editDeck = null; renderMore(); window.scrollTo(0, 0); return; }
    if (b.id === "go-journey") { const { startJourney } = await import("./onboard.js"); startJourney({ first: false }); return; }
    if (b.id === "dk-new") { editDeck = { id: S.newKey("d"), name: "", legend: "", battlefields: ["", "", ""], set: S.setForDate(Date.now()), archived: false, versions: [{ id: S.newKey("v"), name: "v1", note: "", createdAt: Date.now() }], createdAt: 0 }; moreView = "deck"; renderMore(); return; }
    if (b.dataset.dk) { editDeck = JSON.parse(JSON.stringify(S.deck(b.dataset.dk))); moreView = "deck"; renderMore(); return; }
    if (b.id === "dk-addv") { collectDeck(); editDeck.versions.push({ id: S.newKey("v"), name: "v" + (editDeck.versions.length + 1), note: "", createdAt: Date.now() }); renderMore(); return; }
    if (b.id === "dk-save") {
      collectDeck();
      if (!editDeck.legend) { toast("Escolha a lenda do deck"); return; }
      if (!editDeck.name) editDeck.name = editDeck.legend;
      if (!editDeck.createdAt) editDeck.createdAt = Date.now();
      const saved = await S.upsert("decks", editDeck); if (!saved) return;
      const n = await S.renameVersions(editDeck.id, Object.fromEntries((editDeck.versions || []).map((v) => [v.id, v.name])));
      toast(n ? `Deck salvo · ${n} partida${n > 1 ? "s" : ""} com o nome novo da versão` : "Deck salvo"); moreView = "decks"; editDeck = null; renderMore(); return;
    }
    if (b.id === "dk-share") { const dk = S.deck(editDeck.id); if (dk) { const { shareDeck } = await import("./share.js"); await shareDeck(dk); } return; }
    if (b.id === "dk-del") {
      const n = S.getState().matches.filter((m) => m.deckId === editDeck.id).length;
      if (await confirmBox("Apagar deck?", n ? `${n} partida(s) usam este deck; elas ficam no histórico com a lenda e a versão. Se quiser só esconder, prefira arquivar.` : "Este deck ainda não tem partidas.", "Apagar", true)) {
        await S.removeFrom("decks", editDeck.id); moreView = "decks"; editDeck = null; renderMore();
      }
      return;
    }
    if (b.id === "bk-json") { const ok = await offerFile(`riftsight-backup-${stamp()}.json`, JSON.stringify(S.exportData(), null, 1)); if (ok) markBackup(); return; }
    if (b.id === "bk-csv") return offerFile(`riftsight-partidas-${stamp()}.csv`, toCSV(S.getState().matches, setName));
    if (b.id === "bk-copy") {
      const txt = JSON.stringify(S.exportData());
      if (window.RBTAndroid && txt.length > 400000) { toast("Backup grande demais para copiar: salvando em arquivo"); if (await offerFile(`riftsight-backup-${stamp()}.json`, txt)) markBackup(); return; }
      if (await copyText(txt)) markBackup(); return;
    }
    if (b.id === "bk-paste") { await pasteImport(); return; }
    if (b.id === "lg-dl") return offerFile(`riftsight-app-anterior-${stamp()}.json`, JSON.stringify(S.legacyMatches(), null, 1));
    if (b.id === "lg-cp") return copyText(JSON.stringify(S.legacyMatches()));
    if (b.id === "set-add") return addSet();
    if (b.id === "set-reset") { if (await confirmBox("Restaurar sets?", "Volta para a lista padrão de sets.", "Restaurar")) { await S.saveSettings({ sets: null }); renderMore(); } return; }
    if (b.dataset.delset) {
      const list = S.sets().filter((s) => s.id !== b.dataset.delset);
      if (!list.length) return;
      if (await confirmBox("Remover set?", "As partidas continuam com o código do set.", "Remover", true)) { await S.saveSettings({ sets: list }); renderMore(); }
    }
  });
  el.addEventListener("input", (e) => {
    if (e.target.id !== "lg-q") return;
    const q = e.target.value.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
    $$(".lgi", el).forEach((x) => x.classList.toggle("hide", !x.dataset.limg.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").includes(q)));
  });
  el.addEventListener("change", async (e) => {
    if (e.target.id !== "bk-file" || !e.target.files[0]) return;
    const txt = await e.target.files[0].text(); e.target.value = "";
    await doImport(txt);
  });
}
// Editor de imagem da lenda: escolhe arquivo, ajusta zoom/posição e salva 160×160.
async function imageEditor(name) {
  const cur = S.getState().images[name];
  let img = null; const st = { z: 1, x: 0, y: 0 };
  const draw = (cv, size) => {
    const c = cv.getContext("2d"); c.clearRect(0, 0, size, size);
    if (!img) return;
    const sc = Math.max(size / img.width, size / img.height) * st.z;
    const w = img.width * sc, h = img.height * sc;
    const maxX = Math.max(0, (w - size) / 2), maxY = Math.max(0, (h - size) / 2);
    c.drawImage(img, (size - w) / 2 - st.x * maxX, (size - h) / 2 - st.y * maxY, w, h);
  };
  const v = await dialog({
    title: name,
    body: `<div class="imged"><div class="imgprev">${cur ? `<img src="${esc(cur)}" alt="">` : ""}<canvas id="ie-cv" width="200" height="200"${cur ? ' class="hide"' : ""}></canvas></div>
      <label class="btn full filebtn">Escolher imagem<input id="ie-file" type="file" accept="image/*"></label>
      <div id="ie-adj" class="hide"><label for="ie-z">Zoom</label><input id="ie-z" type="range" min="1" max="3" step="0.02" value="1">
      <label for="ie-x">Horizontal</label><input id="ie-x" type="range" min="-1" max="1" step="0.02" value="0">
      <label for="ie-y">Vertical</label><input id="ie-y" type="range" min="-1" max="1" step="0.02" value="0"></div>
      <p class="m">A imagem fica salva só no teu app.</p>`,
    actions: [...(cur ? [{ label: "Remover", value: "remove", danger: true }] : []), { label: "Cancelar", value: null },
      { label: "Salvar", primary: true, value: () => { if (!img) return null; const out = document.createElement("canvas"); out.width = out.height = 160; draw(out, 160); return out.toDataURL("image/jpeg", 0.82); } }],
    onOpen: (r) => {
      const cv = $("#ie-cv", r);
      $("#ie-file", r).addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        const u = URL.createObjectURL(f), im = new Image();
        im.onload = () => { img = im; const old = $(".imgprev img", r); if (old) old.remove(); cv.classList.remove("hide"); $("#ie-adj", r).classList.remove("hide"); draw(cv, 200); };
        im.onerror = () => toast("Não consegui abrir essa imagem");
        im.src = u;
      });
      ["z", "x", "y"].forEach((k) => $("#ie-" + k, r).addEventListener("input", (e) => { st[k] = +e.target.value; draw(cv, 200); }));
    },
  });
  if (v === "remove") { await S.saveImage(name, null); toast("Imagem removida"); }
  else if (v) { await S.saveImage(name, v); toast("Imagem salva"); }
}

// APK: na primeira abertura (sem dados), oferece trazer o backup do app no claude.ai.
function pasteImport() {
  return dialog({ title: "Colar backup", body: '<textarea id="pz" rows="7" placeholder="Cole aqui o conteúdo do backup"></textarea>', actions: [{ label: "Cancelar", value: null }, { label: "Importar", primary: true, value: (r) => $("#pz", r).value }] })
    .then((txt) => (txt ? doImport(txt) : null));
}
function fileImport() {
  const inp = document.createElement("input"); inp.type = "file";
  inp.onchange = async () => { if (inp.files[0]) await doImport(await inp.files[0].text()); };
  inp.click();
}
// Usado pela jornada de boas-vindas: trazer um backup (colar ou arquivo).
export async function importChooser() {
  const v = await dialog({
    title: "Trazer um backup",
    body: `<p>Tem partidas de outro aparelho ou do app no claude.ai? Lá, vá em <b>Mais › Backup</b> e use <b>Copiar backup</b> (aí cole aqui) ou <b>Baixar backup</b> (aí escolha o arquivo).</p>`,
    actions: [{ label: "Cancelar", value: null }, { label: "Escolher arquivo", value: "file" }, { label: "Colar backup", value: "paste", primary: true }],
  });
  if (v === "paste") await pasteImport();
  if (v === "file") fileImport();
}
// Abre o editor com um deck novo (atalho da jornada de boas-vindas).
export function newDeckFlow() {
  editDeck = { id: S.newKey("d"), name: "", legend: "", battlefields: ["", "", ""], set: S.setForDate(Date.now()), archived: false, versions: [{ id: S.newKey("v"), name: "v1", note: "", createdAt: Date.now() }], createdAt: 0 };
  moreView = "deck"; showView("more", { keep: true });
}

async function doImport(txt) {
  let o;
  try { o = JSON.parse(txt); } catch (e) { await dialog({ title: "Arquivo inválido", body: "<p>Não consegui ler esse backup. Confira se é o arquivo .json exportado pelo app.</p>" }); return; }
  const list = Array.isArray(o) ? o : o && Array.isArray(o.matches) ? o.matches : null;
  if (!list) { await dialog({ title: "Arquivo inválido", body: "<p>Esse arquivo não tem partidas.</p>" }); return; }
  const ok = await confirmBox("Importar backup?", `${list.length} partida${list.length !== 1 ? "s" : ""} no arquivo${Array.isArray(o.decks) ? ", " + o.decks.length + " deck(s)" : ""}${Array.isArray(o.events) ? ", " + o.events.length + " evento(s)" : ""}. O que é novo entra; o repetido fica com a versão mais recente.`, "Importar");
  if (!ok) return;
  const badLists = Array.isArray(o) ? 0 : await S.importLists(o);
  const r = await S.importMatches(list);
  r.ignored += badLists; // decks, eventos e imagens inválidos também contam como ignorados
  const cur = S.getState().settings, inc = (o && o.settings) || {};
  const patch = {};
  if (inc.customLegends && typeof inc.customLegends === "object") patch.customLegends = { ...inc.customLegends, ...(cur.customLegends || {}) };
  if (Array.isArray(inc.sets) && inc.sets.length) { const mine = cur.sets && cur.sets.length ? cur.sets : null; patch.sets = mine ? [...mine, ...inc.sets.filter((s) => s && s.id && !mine.some((x) => x.id === s.id))] : inc.sets; }
  if (Object.keys(patch).length) await S.saveSettings(patch);
  if (!r.ok) { await dialog({ title: "Importação incompleta", body: "<p>O aparelho ficou sem espaço e as partidas não foram salvas. Remova fotos de lendas em Mais e tente de novo.</p>" }); return; }
  toast(`${r.added} nova${r.added !== 1 ? "s" : ""}, ${r.updated} atualizada${r.updated !== 1 ? "s" : ""}${r.ignored ? `, ${r.ignored} ignorada${r.ignored !== 1 ? "s" : ""} (inválidas)` : ""}`, null, 5000);
}
async function addSet() {
  const v = await dialog({
    title: "Novo set",
    body: `<label for="sn">Nome</label><input id="sn" placeholder="Ex.: Legacy"><div class="row"><div><label for="si">Código</label><input id="si" maxlength="5" placeholder="LEG"></div><div><label for="sd">Início</label><input id="sd" type="date"></div></div><label for="sc">Cor do selo</label><input id="sc" type="color" value="#c9b8ff">`,
    actions: [{ label: "Cancelar", value: null }, { label: "Adicionar", primary: true, value: (r) => ({ name: $("#sn", r).value.trim(), id: $("#si", r).value.trim().toUpperCase(), start: $("#sd", r).value, color: $("#sc", r).value }) }],
  });
  if (!v) return;
  if (!v.name || !v.id || !v.start) { toast("Preencha nome, código e data"); return; }
  await S.saveSettings({ sets: S.sets().filter((s) => s.id !== v.id).concat([v]) }); renderMore();
}

registerView("hist", renderHist);
registerView("more", (opts) => { if (!opts || !opts.keep) { moreView = "menu"; editDeck = null; } renderMore(); });
export function initViews() { bindHist(); bindMore(); }
export function refreshMore() { if (moreView !== "backup" && moreView !== "deck") renderMore(); }

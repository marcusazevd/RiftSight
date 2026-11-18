// Riftsight — inicialização e navegação.
import * as S from "./store.js";
import { record } from "./stats.js";
import { $, $$, toast, RUNE, esc, dialog, setBadge } from "./ui.js";
import { applyTheme, showView, currentView, rerender, allBattlefields, knownBattlefields, bfKey, readLive } from "./core.js";
import { initRegister, refreshAdd } from "./register.js";
import { initLive, liveBack } from "./live.js";
import { initViews, refreshMore, moreBack, leaveDeckEditor } from "./views.js";
import { maybeStartJourney, journeyBack } from "./onboard.js";
import { initAnalysis, statsBack } from "./analysis.js";

const IC = {
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l9-9M14.5 3.5l6 6-7 7-6-6z"/><path d="M4 16l4 4"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 7v10M8 11v6M16 9v8"/></svg>',
  hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l3 3-3 3-3-3zM6 9l3 3-3 3-3-3zM18 9l3 3-3 3-3-3zM12 15l3 3-3 3-3-3z"/></svg>',
};

function renderHeader() {
  const r = record(S.getState().matches);
  $("#rec").innerHTML = r.n ? `<b>${r.w}–${r.l}${r.d ? "–" + r.d : ""}</b>${r.n} partida${r.n > 1 ? "s" : ""}` : `sem partidas`;
}

// Tela de entrada: some sozinha (~1,6 s) ou com um toque.
function splash() {
  const sp = document.getElementById("splash"); if (!sp) return;
  if (window.__noSplash) { sp.remove(); return; } // testes automatizados
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gone = false;
  const go = () => { if (gone) return; gone = true; sp.classList.add("out"); setTimeout(() => sp.remove(), reduce ? 0 : 380); };
  sp.addEventListener("click", go);
  setTimeout(go, Math.max(0, (reduce ? 500 : 1650) - performance.now()));
}
function boot() {
  splash();
  applyTheme();
  document.body.insertAdjacentHTML("afterbegin", `<main>
    <header class="top"><div class="brand"><span class="mark">${RUNE}</span><div><h1>Riftsight</h1><small>Conquer · Hold · Understand</small></div></div><div class="rec" id="rec"></div></header>
    <section id="add"></section><section id="live" class="hide"></section><section id="stats" class="hide"></section><section id="hist" class="hide"></section><section id="more" class="hide"></section>
  </main>
  <footer class="fan">App de fã, não oficial. Sem vínculo com a Riot Games.</footer>
  <nav aria-label="Navegação">
    <button data-t="add" class="on">${IC.add}Registrar</button><button data-t="stats">${IC.stats}Estatísticas</button>
    <button data-t="hist">${IC.hist}Histórico</button><button data-t="more">${IC.more}Mais</button></nav>`);
  // sair do editor de deck pelas abas também pergunta quando há alteração não salva
  $$("nav button").forEach((b) => (b.onclick = async () => { if (currentView() === "more" && !(await leaveDeckEditor())) return; showView(b.dataset.t); }));
  initRegister(); initLive(); initViews(); initAnalysis();
  // seletor de battlefield (botões): escolhe, desmarca ou adiciona outro
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".bfp button"); if (!b) return;
    const box = b.closest(".bfp"), input = box.querySelector("input[type=hidden]");
    if (b.dataset.bfsearch) {
      const slot = box.classList.contains("bfslot");
      let used = slot ? [...document.querySelectorAll(".bfslot input")].filter((x) => x !== input).map((x) => x.value).filter(Boolean) : JSON.parse(box.dataset.used || "[]");
      // Bo3 manual: games irmãos (gmy0/gmy1/gmy2, gop0/…) não repetem battlefield
      const pre = input.id.replace(/\d+$/, "");
      if (!slot && pre !== input.id) used = [...new Set([...used, ...[...document.querySelectorAll(`input[type=hidden][id^="${pre}"]`)].filter((x) => x !== input && /^\d+$/.test(x.id.slice(pre.length))).map((x) => x.value).filter(Boolean)])];
      const name = await bfSearch(input.value, used); if (!name) return;
      if (slot) { input.value = name; b.textContent = name; b.classList.add("on"); return; }
      let ex = [...box.querySelectorAll("[data-bfv]")].find((x) => x.dataset.bfv === name);
      if (!ex) { ex = document.createElement("button"); ex.type = "button"; ex.className = "bfc"; ex.dataset.bfv = name; ex.textContent = name; box.insertBefore(ex, box.querySelector("[data-bfv]") || b); }
      box.querySelectorAll("[data-bfv]").forEach((x) => x.classList.toggle("on", x === ex)); input.value = name;
      return;
    }
    const on = !b.classList.contains("on");
    box.querySelectorAll("[data-bfv]").forEach((x) => x.classList.toggle("on", on && x === b));
    input.value = on ? b.dataset.bfv : "";
  });
  let lastImgs = 0;
  S.subscribe((st) => {
    renderHeader();
    const v = currentView();
    const imgsChanged = st.imagesAt && st.imagesAt !== lastImgs; if (imgsChanged) lastImgs = st.imagesAt;
    if (v === "more") refreshMore(); else if (v === "add") refreshAdd(); else if (v === "live") { if (imgsChanged) showView("live"); } else rerender();
  });
  S.onError((msg) => toast(msg, null, 6000));
  renderHeader();
  // retoma o contador se havia partida em andamento
  const live = readLive();
  showView(live && live.phase === "play" ? "live" : "add");
  S.init();
  if (S.getState().corruptAt) setTimeout(() => dialog({ title: "Cópia local danificada", body: "<p>Os dados salvos neste aparelho estavam danificados e não puderam ser lidos. O conteúdo foi guardado à parte, sem ser apagado.</p><p class=\"m\">Importe teu último backup em Mais › Backup" + (window.RBTAndroid ? " (o app também guarda um backup automático em Downloads/Riftsight)" : "") + ".</p>" }), 600);
  else if (S.getState().repairedAt) setTimeout(() => toast("Alguns dados salvos estavam danificados e foram deixados de fora. O original ficou guardado à parte; confira teu último backup em Mais › Backup.", null, 8000), 600);
  // Modo offline/instalável: só funciona fora do claude.ai (página própria ou APK).
  if (window.RBTAndroid) androidBridge();
  if (!S.getState().corruptAt) setTimeout(maybeStartJourney, 300);
  try { if (!window.RBTAndroid && "serviceWorker" in navigator && window.top === window && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {}
}
// Busca de battlefield: lista todos (catálogo + digitados), filtra ao digitar, permite nome novo.
async function bfSearch(current, used) {
  const all = allBattlefields(), recent = knownBattlefields().slice(0, 6);
  let pick = null;
  const row = (b) => `<button type="button" class="bfr${b.name === current ? " on" : ""}" data-n="${esc(b.name)}" data-k="${esc(bfKey(b.name))}"${used.includes(b.name) && b.name !== current ? " disabled" : ""}>
    <span>${esc(b.name)}</span>${b.banned ? '<span class="bfban">banido</span>' : ""}${b.set ? setBadge(b.set) : '<span class="m">teu</span>'}</button>`;
  const recentRows = recent.map((n) => all.find((b) => b.name === n)).filter(Boolean);
  await dialog({
    title: "Escolher battlefield",
    body: `<input id="bfq" placeholder="Digite parte do nome…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="bfl" id="bfl">${recentRows.length ? `<div class="bfh">Mais usados</div>${recentRows.map(row).join("")}` : ""}<div class="bfh">Todos (${all.length})</div>${all.map(row).join("")}</div>
      <button type="button" class="btn full hide" id="bfadd"></button>`,
    actions: [{ label: "Cancelar", value: null }],
    onOpen: (r) => {
      const q = r.querySelector("#bfq"), list = r.querySelector("#bfl"), add = r.querySelector("#bfadd");
      const close = () => r.querySelector('[data-v="__cancel"]').click();
      q.addEventListener("input", () => {
        const k = bfKey(q.value), typed = q.value.trim();
        list.querySelectorAll(".bfh").forEach((h) => h.classList.toggle("hide", !!k));
        const seen = new Set(); let exact = false;
        list.querySelectorAll(".bfr").forEach((x) => {
          const show = !k || (x.dataset.k.includes(k) && !seen.has(x.dataset.n)); // sem duplicar "mais usados"
          x.classList.toggle("hide", !show); if (show && k) seen.add(x.dataset.n);
          if (x.dataset.k === k) exact = true;
        });
        add.classList.toggle("hide", !typed || exact); add.textContent = `＋ Usar "${typed}"`;
      });
      q.addEventListener("keydown", (e) => { if (e.key === "Enter") { const first = list.querySelector(".bfr:not(.hide):not([disabled])"); if (first) first.click(); else if (!add.classList.contains("hide")) add.click(); } });
      list.addEventListener("click", (e) => { const it = e.target.closest(".bfr"); if (!it || it.disabled) return; pick = it.dataset.n; close(); });
      add.addEventListener("click", () => { pick = q.value.trim(); close(); });
    },
  });
  return pick;
}

// No APK: vibração pelo app nativo e botão "voltar" do Android.
function androidBridge() {
  // backup automático: um arquivo fixo em Downloads, regravado após cada mudança (nunca vazio)
  let t = null;
  S.subscribe((st) => {
    if (st.loading) return;
    clearTimeout(t); t = null;
    // histórico vazio nunca vai para o arquivo: cancela o que estava agendado e confere de novo na hora de gravar
    if (!st.matches.length) return;
    t = setTimeout(() => {
      t = null;
      try { if (S.getState().matches.length && window.RBTAndroid.autoBackup) window.RBTAndroid.autoBackup(JSON.stringify(S.exportData())); } catch (e) {}
    }, 3000);
  });
  try { navigator.vibrate = (p) => { try { window.RBTAndroid.vibrate(JSON.stringify(p)); } catch (e) {} return true; }; } catch (e) {}
  window.__rbtBack = () => {
    if (journeyBack()) return true;
    const bg = document.querySelector('#dlg [data-v="__cancel"]');
    if (bg) { bg.click(); return true; }
    const open = document.querySelector(".pl:not(.hide)"); if (open) { open.classList.add("hide"); return true; }
    const v = currentView();
    // contador: no setup volta para Registrar; em jogo fica como estava (o placar segue guardado)
    if (v === "live") return liveBack();
    // subtelas voltam um nível antes de sair da aba
    if (v === "more" && moreBack()) return true;
    if (v === "stats" && statsBack()) return true;
    if (v !== "add") { showView("add"); return true; }
    return false;
  };
}
boot();

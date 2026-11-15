// Jornada de boas-vindas: o que é o app e como usar, em 6 passos.
// Aparece sozinha na primeira abertura (sem dados) e depois em Mais › Como usar o app.
import * as S from "./store.js";
import { prefs, savePrefs, showView } from "./core.js";
import { RUNE } from "./ui.js";
import { newDeckFlow, importChooser } from "./views.js";

const seg = (n, color = "var(--win)") => `<div class="ob-seg">${Array.from({ length: 8 }, (_, i) => `<i style="${i < n ? `background:${color}` : ""}"></i>`).join("")}</div>`;
const av = (a, b, t, s = 54) => `<span class="ob-av" style="width:${s}px;height:${s}px;background:linear-gradient(135deg,${a} 50%,${b} 50%)">${t}</span>`;

const STEPS = [
  {
    k: "BEM-VINDO",
    t: "Riftsight",
    art: `<div class="ob-rune">${RUNE}</div>`,
    body: `<p class="ob-slogan">Conquer. Hold. Understand.</p><p>Teu companheiro de mesa para <b>Riftbound</b>. Ele marca os pontos durante a partida, guarda o teu histórico e mostra onde cada deck ganha e onde precisa melhorar.</p>
      <ul class="ob-feat"><li><b>Contador</b> que já vira registro</li><li><b>Decks com versões</b> para comparar mudanças</li><li><b>Estatísticas</b> por matchup, turno, battlefield e set</li><li><b>Eventos</b> rodada a rodada</li></ul>`,
  },
  {
    k: "PASSO 1",
    t: "Monte teu deck",
    art: `<div class="ob-deck">${av("#e2483d", "#9b59d6", "JI")}<div><b>Jinx Aggro</b><small>v1 → v2</small><div class="ob-chips"><span>Void Gate</span><span>Grove</span><span>Sunken Temple</span></div></div></div>`,
    body: `<p>Em <b>Mais › Meus decks</b>, escolha a lenda, os <b>3 battlefields</b> e dê um nome à versão (v1).</p>
      <p>Mudou cartas? Crie a <b>v2</b> no mesmo deck. O app separa os resultados de cada versão e mostra qual está rendendo mais.</p>`,
  },
  {
    k: "PASSO 2",
    t: "Jogue com o contador",
    art: `<div class="ob-counter"><div class="ob-row">${av("#e2483d", "#9b59d6", "JI", 30)}${seg(5)}<b>5</b></div><div class="ob-row">${av("#3b8fe0", "#36a86a", "AH", 30)}${seg(3, "var(--loss)")}<b>3</b></div><div class="ob-btns"><span class="c">CONQUER</span><span class="h">HOLD</span><span class="p">PASSAR</span></div></div>`,
    body: `<p>Toque em <b>NOVA PARTIDA</b>, escolha o oponente e quem começa.</p>
      <ul class="ob-feat"><li><b>Conquer</b> e <b>Hold</b> marcam o ponto e de onde ele veio</li><li><b>Passar turno</b> troca o relógio de cada jogador</li><li>No <b>8</b>, o game termina e a partida é salva com tudo</li><li>No Bo3, os games se encadeiam; se o app fechar, o placar volta</li></ul>
      <p class="m">Jogou sem o contador? Toque em <b>Registrar partida já jogada</b>, logo abaixo do botão.</p>`,
  },
  {
    k: "PASSO 3",
    t: "Em dia de evento",
    art: `<div class="ob-event"><div class="ob-ev-h">NEXUS NIGHT · 3–1</div>${[["R1", "V", "w"], ["R2", "V", "w"], ["R3", "D", "l"], ["R4", "V", "w"]].map(([r, x, c]) => `<div class="ob-ev-r"><span>${r}</span><i class="${c}">${x}</i></div>`).join("")}</div>`,
    body: `<p>Antes da primeira rodada, toque em <b>＋ EVENTO</b>, ao lado de NOVA PARTIDA. Cada partida registrada vira uma rodada automaticamente.</p>
      <p>No fim, <b>Encerrar</b> com a colocação. Dá para gerar um <b>card</b> com o resultado para mandar no grupo.</p>`,
  },
  {
    k: "PASSO 4",
    t: "Veja como está indo",
    art: `<div class="ob-bars">${[["Riven", 0.6], ["Ekko", 0.53], ["Kai'Sa", 0.9], ["Viktor", 0.44]].map(([n, p]) => `<div class="ob-bar"><span>${n}</span><div><i class="${p >= 0.5 ? "w" : "l"}" style="left:${Math.min(p, 0.5) * 100}%;width:${Math.abs(p - 0.5) * 100}%"></i><b></b></div><em class="${p >= 0.5 ? "w" : "l"}">${Math.round(p * 100)}%</em></div>`).join("")}</div>`,
    body: `<p>Na aba <b>Estatísticas</b>:</p>
      <ul class="ob-feat"><li><b>Geral:</b> win rate, tendência e destaques</li><li><b>Matchups:</b> contra quem tu ganha e perde</li><li><b>Versões:</b> qual versão do deck rende mais</li><li><b>Torneio:</b> qual versão levar e o que treinar</li></ul>
      <p class="m">A faixa clara nas barras mostra o quanto o número é confiável: com poucas partidas ela é larga, e vai estreitando conforme tu joga.</p>`,
  },
  {
    k: "PASSO 5",
    t: "Teus dados são teus",
    art: `<div class="ob-save"><svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.6" shape-rendering="crispEdges"><path d="M4 3h13l3 3v15H4z"/><path d="M7 3v6h9V3M7 21v-7h10v7"/></svg></div>`,
    body: `<p>Tudo fica <b>só neste aparelho</b>, sem conta e sem login.</p>
      <ul class="ob-feat"><li>Faça backup em <b>Mais › Backup</b> de vez em quando</li>${window.RBTAndroid ? "<li>O app também guarda um <b>backup automático</b> em Downloads/Riftsight</li>" : ""}<li>Trocou de celular? Importe o backup no novo</li></ul>
      <p class="m">App de fã, não oficial, sem vínculo com a Riot Games.</p>`,
    final: true,
  },
];

let el = null, i = 0, first = false;
function close() { if (!el) return; el.classList.add("out"); const x = el; el = null; setTimeout(() => x.remove(), 260); prefs.onboarded = 1; savePrefs(); }
function render() {
  const s = STEPS[i], last = i === STEPS.length - 1;
  el.innerHTML = `<div class="ob-top"><span class="ob-k">${s.k}</span>${last ? "" : '<button type="button" class="ob-skip" data-ob="skip">Pular</button>'}</div>
    <div class="ob-body" role="group" aria-roledescription="passo" aria-label="${i + 1} de ${STEPS.length}">
      <div class="ob-art">${s.art}</div><h2 class="ob-t">${s.t}</h2><div class="ob-txt">${s.body}</div></div>
    <div class="ob-foot"><div class="ob-dots">${STEPS.map((_, k) => `<button type="button" aria-label="Passo ${k + 1}" data-ob-go="${k}" class="${k === i ? "on" : ""}"></button>`).join("")}</div>
      ${last ? `<div class="ob-end">${first ? `<button type="button" class="btn pri ob-big" data-ob="deck">CRIAR MEU DECK</button><div class="ob-two"><button type="button" class="btn" data-ob="backup">Tenho um backup</button><button type="button" class="btn" data-ob="skip">Explorar o app</button></div>` : `<button type="button" class="btn pri ob-big" data-ob="skip">ENTENDI</button>`}</div>`
      : `<div class="ob-nav">${i ? '<button type="button" class="btn" data-ob="prev">‹ Voltar</button>' : "<span></span>"}<button type="button" class="btn pri" data-ob="next">Próximo ›</button></div>`}</div>`;
  const b = el.querySelector(".ob-body"); b.classList.remove("in"); void b.offsetWidth; b.classList.add("in");
}
function go(k) { i = Math.max(0, Math.min(STEPS.length - 1, k)); render(); }

export function startJourney(opts = {}) {
  if (el) return;
  first = !!opts.first; i = 0;
  el = document.createElement("div"); el.id = "onb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Boas-vindas ao Riftsight");
  document.body.appendChild(el); render();
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.obGo) return go(+b.dataset.obGo);
    const a = b.dataset.ob;
    if (a === "next") go(i + 1);
    if (a === "prev") go(i - 1);
    if (a === "skip") close();
    if (a === "deck") { close(); newDeckFlow(); }
    if (a === "backup") { close(); showView("more"); await importChooser(); }
  });
  // arrastar para o lado troca de passo
  let x0 = null;
  el.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  el.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1)); });
  el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); if (e.key === "Escape") close(); });
}
// Primeira abertura: só para quem ainda não tem nada registrado.
export function maybeStartJourney() {
  if (prefs.onboarded || window.__noSplash) return; // __noSplash: testes automatizados
  const st = S.getState();
  if (st.matches.length || st.decks.length) { prefs.onboarded = 1; savePrefs(); return; }
  startJourney({ first: true });
}
// Botão voltar do Android
export function journeyBack() { if (!el) return false; if (i > 0) go(i - 1); else close(); return true; }

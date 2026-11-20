# Riftsight 0.9.5 · Pacote 2

Registro Bo3 compacto ("V1 · Uma linha por game"), folha de battlefields, barra SALVAR fixa, ID e bye em eventos e textos em "você".
Base: `ddd4377` (0.9.4). Commits: `a994494` (você), `74ff2f8` (modelo ID/bye), `a4be696` (registro, folha, barra, ID/bye no Registrar), `f5692cd` (versão).
Mockups seguidos: `Main.dc.html` (V1), `V1-battlefield.dc.html`, `ID-bye.dc.html`. A V2 (placar primeiro) não foi implementada.

## 1. Registro manual Bo3 compacto (UX-02, UX-03)

**O que mudou**
- Cada game fica num bloco com duas linhas. Na primeira: rótulo `G1/G2/G3`, quem começou (`Eu`/`Ele`) e `Ganhei`/`Perdi`. Na segunda: um botão de battlefields `Meu bf × Do oponente ▾`, ou `+ battlefields do game N` quando está vazio.
- A lógica de antes continua igual:
  - Quem perdeu o game anterior começa o próximo (sugestão).
  - Os games valem em ordem e o G3 só aparece no 1–1.
  - O empate por tempo continua.
  - As mensagens do Pacote 1.1 continuam ("Games fora de ordem", "Falta pouco").
  - O placar e o resultado são os mesmos.
- A partida única também fica numa linha: `Eu/Ele` + `Vitória/Derrota/Empate`, com o mesmo botão de battlefields embaixo.
- O confronto virou dois botões de 48 px, com avatar de 32 px. O rótulo continua para leitor de tela.
- Formato (`Única`/`Bo3`) e versão ficam na mesma linha. A versão ganhou um `label`, o que resolve o `select-name` do axe no Registrar.
- "Mais detalhes" virou a linha recolhida `Data, set e notas · hoje · Radiance ▸`. Fora de evento ela vira `Tipo, data, set e notas`. Os battlefields **não** ficam mais dentro dela.
- Ao abrir "Registrar partida já jogada", a página rola até o formulário.
- O placar avulso ("Placar: 2–1") saiu do formulário e foi para a barra SALVAR.

**Arquivos:** `app/js/register.js` (gamesHTML, bo1HTML, bfBtn, detailsLine, render, bind, save/baseMatch/commit), `app/css/app.css` (bloco 0.9.5).

## 2. Folha (bottom sheet) de battlefields por game

**O que mudou**
- Título `GAME N · BATTLEFIELDS` (na partida única, só `BATTLEFIELDS`).
- **Seu battlefield**: os battlefields do deck em botões de 64 px, em 3 colunas. Os já usados em outros games da partida aparecem riscados, desabilitados e com `usado no Gn` (aria-label "…, já usado no game N").
  - Deck sem battlefields cadastrados (ou só lenda): aparecem os que você já usou mais a busca.
- **Do oponente**: os usados na partida aparecem riscados. As sugestões vêm **só de battlefields de oponentes** (correção UX-13), com os da mesma lenda primeiro. Depois vem a busca no catálogo, com `＋ Usar "…"` para nome novo.
- `Sem battlefield` limpa os dois e fecha. `PRONTO` fecha.
- Fecha com ✕, com Esc, com toque fora e com o voltar do Android (`window.__rbtBack` chama `closeBfSheet()` antes de tudo). Também fecha ao trocar de aba.
- Acessibilidade: `role=dialog`, `aria-modal`, `aria-labelledby` e foco preso (Tab/Shift+Tab). O foco volta ao botão do game ao fechar. Todos os controles têm nome e alvo ≥ 44 px.

**Arquivos:** `app/js/register.js` (sheetHTML, openBfSheet, closeBfSheet, oppSuggest, searchResults), `app/js/app.js` (voltar do Android, troca de aba), `app/css/app.css`.

## 3. Barra SALVAR fixa

**O que mudou**
- Barra fixa logo acima da navegação. A altura real da navegação vai para `--navh`, medida com ResizeObserver porque a fonte muda a altura depois de carregar.
- Textos da barra:

  | Situação | Texto |
  | --- | --- |
  | Bo3 completo | `SALVAR 2–1 · VITÓRIA` |
  | Empate por tempo | `SALVAR 1–1 · EMPATE` |
  | Partida única | `SALVAR · VITÓRIA` |
  | Edição | `ATUALIZAR …` |
  | ID | `SALVAR ID · R4` |
  | BYE | `SALVAR BYE · R5` |

- Incompleta: a barra fica com cara de desabilitada e mostra o motivo curto: `falta o oponente`, `falta o resultado`, `falta o G3`, `o G1 está em branco` ou `falta o seu deck`.
- O fim da página reserva a altura da barra (`body.home-on.sbar-on`), então nada fica coberto. O aviso flutuante (toast) sobe para cima da barra.
- A faixa `#svbar` do Desfazer continua no fluxo, no topo. Não se sobrepõe à barra e continua tocável.

**Arquivos:** `app/js/register.js` (formStatus, saveBarHTML, paintBar), `app/js/app.js` (`--navh`), `app/css/app.css`.

## 4. Tamanho

- **390×844**: o formulário inteiro cabe entre o topo e a barra SALVAR, já com o Bo3 completo e battlefields nos 3 games. Ele tem 639 px e inclui "Como foi a rodada?", confronto, formato, 3 games e a linha de detalhes. Sobram 48 px. Barra: 76 px. Navegação: 81 px.
- **360×740**: a página rola, mas a barra fica sempre visível e não há rolagem horizontal.
- **Toques**: 3 games + 3 pares de battlefields = **16 toques**, sem contar o SALVAR (P2-06).

## 5. ID e bye em eventos (UX-04)

**Modelo**
- Campo opcional `kind: "id" | "bye"` na partida. Sem o campo, é partida jogada.
- ID e bye gravam `format: "bo1"`, `games: []`, `score: ""` e `result` `"D"` (ID) ou `"W"` (bye). O bye grava `opp: ""`.
- `normalize` valida o campo:
  - Valor desconhecido é ignorado, e o registro segue as regras de partida jogada. Sem oponente, é descartado.
  - Em ID/bye, games e resultado são forçados.
  - Dados antigos não mudam.
- **Backup da 0.9.5 aberto na 0.9.4** (testado com a 0.9.4 servida em 8791):
  - As telas abrem sem erro.
  - O ID com oponente entra como empate comum (lá ele conta nas estatísticas).
  - O bye e o ID sem oponente são ignorados ("1 ignorada (inválida)").

**Tela**
- Com evento aberto (ou editando uma rodada de evento), o formulário mostra `Como foi a rodada?` com `JOGUEI` (padrão), `ID` (empate combinado) e `BYE` (sem oponente). O botão do manual vira "Registrar rodada já jogada, ID ou bye".
- **ID**: "Contra quem? (opcional)" com o seletor de lenda, e ✕ para tirar.
- **BYE**: sem oponente.
- Os dois mostram:
  - o recorde projetado ("Conta no recorde do evento: **2–0–1**");
  - "Fica fora do win rate, dos matchups e dos battlefields";
  - a lista **RODADAS** (`R3 ID vs Kai'Sa · sem games`, `R4 BYE sem oponente · conta como vitória`).
- A faixa depois de salvar tem Desfazer: `R3 · ID vs Kai'Sa · evento 2–0–1` / `R4 · BYE (vitória) · evento 3–0–1`. Depois de salvar, o formulário volta para `JOGUEI`.
- Os dois ocupam a rodada (a próxima avança). O recorde fica V–D–E: ID = E, bye = V.
- Onde aparecem:
  - banner do evento;
  - Histórico: linha própria "ID empate combinado contra Kai'Sa … fora das estatísticas", e chips `R3 ID` / `R4 BYE` nos eventos;
  - card do evento: selo dourado `ID`/`BYE` e texto `R3 ID vs Kai'Sa`, `R4 BYE`;
  - CSV: novas colunas `tipo` e `rodada`;
  - backup.
- Ficam fora de:
  - win rate, matchups, battlefields, primeiro/segundo, destaques, versões e aba TORNEIO (`S.played()`);
  - o recorde do cabeçalho e a faixa de status do Registrar;
  - o card e o recorde dos decks;
  - a porcentagem por tipo de evento. O recorde ao lado dela continua com ID/bye.
- **Edição pelo Histórico**: abre no modo certo (`ATUALIZAR ID · R3`) e mantém a rodada. Trocar para JOGUEI transforma em partida normal e tira o `kind`.

**Arquivos:** `app/js/store.js` (KINDS, isPlayed, played, normalize), `app/js/core.js` (eventRecord, recTxt, KIND_LABEL, roundText), `app/js/register.js`, `app/js/views.js` (matchTitle, kindRow, chips, % por tipo), `app/js/share.js`, `app/js/stats.js` (CSV), `app/js/analysis.js`, `app/js/app.js`.

## 6. "Você" em todo o app (UX-24)

Busca exaustiva: `grep -n -i -P "\b(teu|tua|tu|teus|tuas|contigo|te|ti)\b"` em `app/`. Depois da mudança, nenhuma ocorrência em `app/js`, `app/index.html`, `app/manifest.webmanifest` e `app/sw.js`.

| Onde | Antes | Agora |
| --- | --- | --- |
| live.js (placar) | `▶ TEU TURNO` | `▶ SEU TURNO` |
| live.js | `teu relógio` | `seu relógio` |
| live.js (aria do lado) | `Tu: <lenda>, no turno` | `Você: <lenda>, no turno` |
| live.js (faixa do meio) | `Teu bf:` | `Seu bf:` |
| live.js (aria Passar) | `Passar o turno para ti` | `Passar o turno para você` |
| live.js (fim do game) | `teu tempo`, `Tu` (barras e origem), `⏱ Tu` | `seu tempo`, `Você`, `⏱ Você` |
| live.js | `Tu venceu o match!` | `Você venceu o match!` |
| live.js (diálogo) | `O placar fica guardado se tu sair.` | `… se você sair.` |
| live.js (toast) | `Sorteio: tu começa` | `Sorteio: você começa` |
| analysis.js (ritmo) | `Tu`, `teu tempo` | `Você`, `seu tempo` |
| analysis.js | `faixa provável do teu win rate` | `do seu win rate` |
| analysis.js | `das tuas partidas`, `sobe teu win rate` | `das suas partidas`, `sobe seu win rate` |
| analysis.js (torneio) | `lendas que tu mais enfrenta`, `Quem tu mais enfrenta` | `que você mais enfrenta`, `Quem você mais enfrenta` |
| onboard.js | `Teu companheiro…`, `guarda o teu histórico` | `Seu companheiro…`, `guarda o seu histórico` |
| onboard.js | `Monte teu deck`, `Teus dados são teus` | `Monte seu deck`, `Seus dados são seus` |
| onboard.js | `contra quem tu ganha e perde`, `conforme tu joga` | `contra quem você ganha e perde`, `conforme você joga` |
| views.js | `Salvo na tua conta Claude`, `mas tu pode guardar` | `na sua conta`, `mas você pode guardar` |
| views.js | `Cadastre teus decks`, `do teu aparelho`, `só no teu app` | `seus decks`, `do seu aparelho`, `só no seu app` |
| app.js | `Importe teu último backup`, `confira teu último backup` | `seu último backup` |
| app.js (busca de bf) | selo `teu` | selo `seu` |
| register.js (validação) | `teu deck ou tua lenda` | `seu deck ou sua lenda` |
| manifest | `das tuas partidas` | `das suas partidas` |
| comentários (stats.js, analysis.js) | `contra ti`, `teu resultado`, `tu mais enfrentou` | `você`/`seu` |

O placar ao vivo mudou só no texto.

## 7. Versão

`APP_VERSION = "0.9.5 · Arcade"` (`app/js/core.js`) e `CACHE = "rbt-v0.9.5"` (`app/sw.js`).

## Testes

Servidor `python3 -m http.server 8790` em `app/`. Playwright em Python com o Chrome em `/usr/bin/google-chrome`, `is_mobile`/`has_touch`.

**Nova suíte `tests/t12_pacote2.py`: 77/77, 0 erros de console.** Ela cobre:
- Bo3 compacto (linha por game, rótulos, sugestão de quem começa, G3 só no 1–1) e a contagem de toques (16).
- "Cabe sem rolar" em 390×844, e 360×740 com a barra sempre visível e sem rolagem horizontal.
- Bo1 numa linha e as validações (fora de ordem, 2–0, 1–1, empate por tempo, motivos na barra e mensagens ao tocar).
- Folha: riscados, sugestões só de oponentes (um battlefield que só aparece como meu fica fora), "Sem battlefield", deck sem battlefields com busca, fechar por ✕/voltar/fora/Esc, foco preso, nomes e alvos ≥ 44.
- Barra: textos, fim da página reservado, toast acima, convivência com `#svbar`, Desfazer e salvar de novo.
- ID e bye:
  - recorde V–D–E, numeração de rodadas e lista de rodadas;
  - **telas de Estatísticas (4 abas e "Detalhar por" oponente/turno/battlefields), cabeçalho, decks e faixa de status idênticas antes e depois de salvar um ID e um bye**;
  - Histórico, chips, card do evento (texto e PNG) e CSV;
  - backup: exportar, importar num aparelho vazio, e importar com `kind` inválido;
  - edição: ID → ID com outro oponente, e BYE → JOGUEI.
- Compatibilidade: dados antigos sem `kind`, e backup 0.9.5 aberto na 0.9.4.
- Varredura de "teu/tua/tu/teus/tuas/contigo/ti" no texto, aria-label, title e placeholder de: Registrar, folha, 4 abas + página de matchup, Histórico, Mais e subtelas, jornada, setup e placar ao vivo, e fim do game.

**Regressão**

| Suíte | Antes (0.9.4) | Agora |
| --- | --- | --- |
| t01–t09 | 282/304 | **283/303** |
| t10 | 36/36 | 36/36 |
| t11 | 47/47 | 47/47 (2 asserts de texto ajustados) |
| t04 | 42/42 | 42/42 |

- O total de t01–t09 caiu um porque o DK-07b só existe como FAIL quando registrar dá exceção. Agora registrar com nome longo funciona e ele não aparece mais.
- **DK-07b** passa: registrar partida com deck de nome longo já é possível pela UI.
- **DK-08b** passa: o aviso salvo e o histórico quebravam a página com nome longo sem espaço. Corrigido com `overflow-wrap:anywhere`.
- As 20 falhas que restam são as mesmas da base: ONB-04a/07, M-17b, E-11/16/24, B-04/07/08, N-08/10, UI-T1/T2, A-01/02/03/05/06, S-14, SW-05.
- **A-01**: o `select-name` do Registrar e do Bo3 sumiu. O que aparece agora em `stats-torneio` já existia, só não era listado porque o relatório mostra apenas as 4 primeiras telas.
- **A-03**: os alvos menores que 44 px caíram de 218 para 132.

**Asserts e fluxos de teste ajustados (todos por mudança intencional)**
- `flows.py`:
  - `details()` agora lê `aria-expanded` de `#f-more`. O texto "Mais/Menos detalhes" não existe mais.
  - `bf_search()` usa a folha (`bf_sheet()`) quando o id é `f-mybf`, `f-opbf`, `gmyN` ou `gopN`, porque o seletor `.bfp` saiu do registro.
- `t03_matches.py` M-16: o "já usado no outro game" é conferido na busca da folha (`.bs-res … [disabled]`), não no diálogo antigo.
- `t07_backup.py` B-06: o CSV tem 13 colunas (+ `tipo` e `rodada`).
- `t09_nav_ui_a11y.py`:
  - passo `registrar-manual` abre os detalhes por `aria-expanded`;
  - passo `dialogo-bf` abre a folha (`[data-bfg]`).
- `t11_placar_a.py`:
  - A-07: `para ti` → `para você`;
  - A-31: `Teu bf` → `Seu bf`.

**Screenshots** (em `shots/`, conferidos com os mockups): `p2_v1_390.png`, `p2_v1_360.png`, `p2_v1_360_fim.png`, `p2_sheet_390.png`, `p2_sheet_360.png`, `p2_id.png`, `p2_bye.png`, `p2_rodadas.png`, `p2_hist.png`, `p2_card_evento.png`, `p2_old094_eventos.png`.

## Desvios do mockup

1. **Tela inteira em 844**: o mockup V1 mostra cabeçalho, banner, formulário, barra e navegação juntos. No app, entre o banner e o formulário continuam a faixa de status, o NOVA PARTIDA e o botão do registro manual. Cabeçalho + banner + formulário + barra + navegação somam 922 px.
   - O que cabe sem rolar é o formulário inteiro (639 px), entre o topo e a barra. A página rola até ele ao abrir.
   - Tirar a faixa e o NOVA PARTIDA seria mudar o fluxo principal (contador), então não foi feito.
2. **"Como foi a rodada?"** aparece também no modo JOGUEI quando há evento: o V1 não tinha essa linha. Os botões têm 58 px em vez de 64 px, e as legendas quebram em duas linhas para caber em 360.
3. **Versão** num seletor ao lado de `Única/Bo3`. Ele ocupa o lugar da dica "Comecei · Resultado" e do "v3" dentro do botão do deck.
4. **Botão de battlefields e linha de detalhes com 44 px** (mockup: 40 px), pela regra de alvo ≥ 44 px.
5. **Partida única** usa `Vitória/Derrota/Empate`, com três opções porque o empate é permitido, em vez de `Ganhei/Perdi`.
6. **Folha**: escolher já aplica, e ✕/fora/voltar só fecham, não desfazem. A dica diz "os que oponentes já usaram contra você (primeiro os de Viktor)": as sugestões são de todos os oponentes, com a lenda atual na frente.
7. **Barra incompleta** fica com cara de desabilitada e mostra o motivo, mas sem `disabled`/`aria-disabled`. Assim o toque ainda abre a explicação completa, com as mensagens de antes. Isso também mantém os testes de validação, porque o Playwright recusa clicar em `aria-disabled`.
8. **Banner do evento** sem mudança: "RODADA N / você está 2–0 / Suíço · 5 rodadas" e o rótulo "V–D–E" do mockup não foram implementados. O recorde no banner já usa V–D–E.
9. **ID/BYE** mantêm a linha "Data, set e notas", para data e nota da rodada.

## Pendências

- O site da raiz (`index.html`, `privacy.html`, fora do app) ainda tem "tuas/teus/teu".
- O APK não foi gerado na 0.9.5 (versionCode). O MainActivity e o pacote não foram tocados.
- A 0.9.4 lendo um backup da 0.9.5 conta o ID como empate nas estatísticas dela e ignora o bye. É o melhor possível sem mudar a versão antiga.
- Quem toca "Passar turno" e o restante do placar ao vivo não mudaram (só o texto).
- As suítes de teste continuam fora do git, como nos pacotes anteriores. `tests/t12_pacote2.py` e os ajustes estão só no disco.

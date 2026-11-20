# Riftsight 0.9.5 · Pacote 2.1

Correções do QA (`/home/claude/qa095/QA_0.9.5.md`) e da avaliação de UX (`/home/claude/ux095/UX_0.9.5.md`) sobre o Pacote 2.
A versão **continua 0.9.5**: `APP_VERSION` ("0.9.5 · Arcade") e `CACHE` ("rbt-v0.9.5") têm o mesmo valor, porque a 0.9.5 ainda não foi publicada.
Base: `bd9fa7d`. Commits: `7665d07` … `0a0ce6f` (10 commits). Patch: `pacote2_1.patch` (`git diff bd9fa7d..HEAD`).
O placar ao vivo, o MainActivity e o pacote Android não foram alterados.

## Itens

### 1. U95-01 · Toque duplo na folha não grava o battlefield errado
- **O que mudou**
  - A ordem dos chips é calculada uma vez, ao abrir a folha (`sheetOrder`, guardada em `SH.order`).
  - Escolher não redesenha mais a folha: `markSide` só troca o destaque (`.on`/`aria-pressed`), então nada desliza para baixo do dedo e a rolagem interna não volta ao topo.
  - Um 2º toque no mesmo alvo em menos de 350 ms (`RETAP_MS`) é ignorado. Depois disso, tocar no escolhido continua desmarcando.
  - A comparação do escolhido usa `bfKey` (sem acento/caixa).
- **Arquivos:** `app/js/register.js` (sheetOrder, sheetHTML, markSide, openBfSheet, bfOpt).
- **Teste:** t13 `U01-a` (ordem igual antes e depois do toque), `U01-b` (toque duplo no "seu" e no 2º chip do oponente).
- **Commit:** `7665d07`.

### 2. Q95-01 · Toque duplo no SALVAR
- **O que mudou:** depois de salvar, toques no SALVAR são ignorados por 800 ms (`SAVE_QUIET_MS`), além de durante o salvamento (`saving`). O 2º toque não cai mais no formulário vazio e não abre o "Falta pouco".
- **Arquivos:** `app/js/register.js` (save, commit).
- **Teste:** t13 `Q01` (60 e 300 ms: 1 gravação e nenhum diálogo). O `q4b_dbl` do QA passou de 4/12 para 12/12.
- **Commit:** `f33242d`.

### 3. Q95-02 + Q95-07 · Battlefields "usados"
- **O que mudou**
  - O `usedIn` só considera os games que aparecem na tela (`shownGames`).
  - O game que deixa de existir é limpo por inteiro, battlefields incluídos (`clearGame`). Isso vale para 2–0, para G1 e G2 em branco e para o empate por tempo.
  - Na busca da folha, um nome fora do catálogo que já foi usado em outro game aparece riscado e desabilitado ("usado no G1"), sem o "＋ Usar". A comparação ignora acento e caixa.
- **Arquivos:** `app/js/register.js` (usedIn, shownGames, gamesHTML, clearGame, searchResults).
- **Teste:** t13 `Q02` e `Q07`. `q10_g3` 4/4 (era 3/4) e `q3_sheet` SH-20 passa.
- **Commit:** `7dad82c`.

### 4. Q95-03 + Q95-04 · Editar e trocar para ID/BYE
- **O que mudou**
  - Ao editar uma partida jogada, tocar ID ou BYE abre o diálogo "Trocar para ID/BYE?". O texto lista o que será descartado ao atualizar:
    - os games (resultado, quem começou e battlefields);
    - os pontos e o log do contador, quando houver;
    - no BYE, o oponente.
  - O diálogo avisa que a ação não tem Desfazer. Cancelar mantém JOGUEI.
  - `formFromMatch`: ao voltar de ID/BYE para JOGUEI, nenhum resultado e nenhum "quem começou" vêm marcados.
- **Arquivos:** `app/js/register.js` (confirmKindSwitch, bind, formFromMatch).
- **Teste:** t13 `Q03`, `Q03-b` e `Q04`. No `q7_edge`, E-01 e E-02 passam.
- **Commit:** `015c95a`.

### 5. U95-02 · Partida única sem texto cortado
- **O que mudou**
  - Vitória, Derrota e Empate ficam numa linha própria, com três botões largos de 20 px. Em 320 px cada botão tem 77 px; em 360, 89 px; em 390, 99 px.
  - Embaixo vem "Começou: Eu | Ele", e por último o botão de battlefields.
  - Até 340 px, Eu/Ele têm 44 px e o espaço entre botões cai para 4 px, para "Ganhei/Perdi" do Bo3 caberem no bloco (resolve de quebra o U95-13).
- **Arquivos:** `app/js/register.js` (bo1HTML) e `app/css/app.css` (bloco "Pacote 2.1").
- **Teste:** t13 `U02` (largura do texto ≤ largura do botão e alvo ≥ 44 px em 320, 360 e 390). Screenshot: `shots/p21_bo1_360.png`.
- **Commit:** `8947997`.

### 6. U95-03 · Legenda "começou"
- **O que mudou**
  - No Bo3, um cabeçalho de colunas "Começou · Resultado" fica alinhado com a linha de cada game. É `aria-hidden`, porque os grupos já têm `aria-label`.
  - No Bo1, o rótulo "Começou:" fica antes de Eu/Ele.
  - A linha do game continua numa linha só em 360 px, sem rolagem horizontal.
- **Arquivos:** `app/js/register.js` (gamesHTML, bo1HTML) e `app/css/app.css`.
- **Teste:** t13 `U03`. Screenshot: `shots/p21_comecou_360.png`.
- **Commit:** `8947997`.

### 7. U95-04 · A folha fecha sozinha e o PRONTO fica sempre visível
- **O que mudou**
  - Quando os dois lados ficam escolhidos, a folha mostra "✓ PRONTO" com a borda verde por 250 ms (`AUTOCLOSE_MS`) e fecha sozinha. Com um lado só, ela continua aberta.
  - O cabeçalho e as ações ficam fixos, e só o meio (`.bs-b`) rola.
  - Medido com a folha do G3: PRONTO em 674–726 de 740 px e em 502–554 de 568 px, também com resultados de busca.
  - O A1 do UX caiu de 22 para **19 toques**.
- **Arquivos:** `app/js/register.js` (openBfSheet, closeBfSheet, sheetHTML) e `app/css/app.css` (.bs, .bs-b, .bs.done).
- **Teste:** t13 `U04-a` e `U04-b`. Screenshots: `shots/p21_folha_360.png` e `shots/p21_folha_320.png`.
- **Commit:** `7665d07`.

### 8. U95-05 · Depois de salvar, o formulário fica à vista
Implementada a opção mais barata do relatório (aviso logo acima do formulário + rolagem). A faixa de status e o NOVA PARTIDA **não** foram escondidos.
- **O que mudou**
  - Quando o salvamento vem do registro manual, o aviso pós-salvar ("R3 · Vitória 2–0 vs Viktor · evento 3–0 · Desfazer") é desenhado logo acima do formulário. A página rola até ele (`scrollToForm`) em vez de ir ao topo.
  - O Desfazer também rola até ele.
  - Com evento aberto e o registro manual aberto, a aba Registrar já abre rolada no formulário. Ela não rola nestes casos:
    - com partida do contador em andamento;
    - logo depois de salvar pelo contador, porque esse aviso continua no topo.
  - Medido em 390x844 e 360x740: aviso no topo, G1 e G2 acima da barra SALVAR.
  - No roteiro de evento do UX, as rolagens caíram de 5 para 1 (390, com ID/bye) e de 8 para 3 (360).
- **Arquivos:** `app/js/register.js` (render, commit, savedToast, undoSaved, scrollToForm, registerView).
- **Teste:** t13 `U05`. Screenshots: `shots/p21_pos_salvar_390.png` e `shots/p21_pos_salvar_360.png`.
- **Commit:** `e3368c9`.

### 9. U95-08 · 1ª rodada de evento competitivo em Bo3
- **O que mudou**
  - Nova lista `BO3_EVENT_TYPES` em `data.js`: Skirmish, Showdown, Riftatlas e Regional (RQ).
  - Enquanto o evento ainda não tem rodada jogada, o formulário abre em Bo3. Ao começar o evento pelo Registrar, isso só acontece se nenhum resultado foi marcado.
  - Nos outros casos fica o padrão de antes: o último formato salvo (`prefs.fmt`).
- **Arquivos:** `app/js/data.js` e `app/js/register.js` (defaultFmt, blankForm, ev-start).
- **Teste:** t13 `U08` (Regional abre em Bo3; Nexus Night continua em Única).
- **Commit:** `7ac0ef0`.

### 10. U95-09 + Q95-10 · Recorde, banner e contagem do Histórico
- **O que mudou**
  - O recorde usa sempre o travessão: "3–1–1", ou "3–1" sem empate. Isso vale para:
    - banner e diálogo de encerrar;
    - Histórico (Eventos e "Por tipo de evento");
    - texto e card do evento;
    - card e texto do deck (`share.js recStr`).
  - A legenda "V–D–E" aparece quando há empate ou ID: no banner, no diálogo, na caixa "Conta no recorde", no Histórico, no aviso pós-salvar e no "Resultado:" do texto do evento.
  - Banner como no mockup: "EVENTO EM ANDAMENTO / **Rodada 4** · você está **2–1–1** V–D–E / nome · tipo (se não repetir o nome) · local".
  - Histórico: a aba "PARTIDAS (N)" conta só partidas jogadas, igual ao cabeçalho. Com ID/bye, a lista explica: "13 registros · 11 partidas jogadas · 2 ID/bye (fora das estatísticas)".
- **Arquivos:** `app/js/core.js` (recLegend, recPlain, recHTML), `app/js/register.js`, `app/js/views.js`, `app/js/share.js` e `app/css/app.css`.
- **Teste:** t13 `U09`. Screenshot: `shots/p21_banner_360.png`.
- **Commit:** `8c14861`.

### 11. U95-06 / Q95-06 · Teclado virtual
- **O que mudou**
  - `body.kbd-on` é ativado quando há um campo de texto focado e a janela (ou o `visualViewport`) encolheu para menos de 80% da altura de referência. É o caso do teclado com `adjustResize` no APK.
  - Com `kbd-on`, a barra SALVAR e a navegação ficam escondidas, e o campo é trazido para a área visível se estiver fora dela.
  - Tirar o foco ou fechar o teclado devolve tudo.
- **Arquivos:** `app/js/app.js` (watchKeyboard) e `app/css/app.css`.
- **Teste:** t13 `U06` (360x430 com Notas focada e rolada para a borda de baixo: nada cobre o campo, e ao fechar a barra e a navegação voltam). `q4_bar` passa nos 16 casos KB, com a barra escondida, e `q4c_kb` fica em 16/16 (era 14/16).
- **Commit:** `198fd9d`.

### 12. U95-15 · Acessibilidade da folha e da barra
- **O que mudou**
  - "Seu battlefield" e "Do oponente" viraram `role="group"` com `aria-labelledby`.
  - A barra SALVAR ganhou uma região `aria-live="polite"` (`#f-sblive`), que não é recriada a cada mudança e anuncia "SALVAR · falta o oponente", "SALVAR 2–0 · VITÓRIA" etc. `paintBar` passou a trocar só o botão.
- **Arquivos:** `app/js/register.js`.
- **Teste:** t13 `U15`. `q9_edit_a11y` (axe) 7/7.
- **Commits:** `7665d07` e `f33242d`.

### 13. Q95-05 · Voltar de versão
- **O que mudou**
  - O backup grava `appVersion` (`APP_VER = "0.9.5"` em `data.js`). `APP_VERSION` passou a ser derivado dele e tem o mesmo valor.
  - Ao importar um arquivo com `appVersion` maior que a do app, aparece o diálogo "Backup de uma versão mais nova". Ele explica que registros desconhecidos podem ser ignorados e recomenda atualizar o app. Cancelar não importa nada.
  - A 0.9.4 **não** foi alterada.
- **Recomendações, sem mudança no app**
  - **Faça backup antes de voltar de versão.**
  - No APK, o Android só instala versão menor desinstalando, e desinstalar apaga os dados. O caminho de volta é sempre o arquivo de backup da versão mais nova, que continua completo.
  - Na web/PWA, não faça rollback do deploy da 0.9.5 para a 0.9.4. A 0.9.4 lendo o armazenamento da 0.9.5 descarta byes e IDs sem oponente e guarda o original em `rbt_v2_danificado_*` (q5 C-07, que continua falhando como esperado).
- **Arquivos:** `app/js/data.js`, `app/js/core.js`, `app/js/store.js` (exportData, cmpVer) e `app/js/views.js` (doImport).
- **Teste:** t13 `Q05`.
- **Commit:** `0a0ce6f`.

## Testes

Servidores: HEAD em `:8790`, `bd9fa7d` (worktree `/tmp/w095`) em `:8792` e 0.9.4 (`/home/claude/old094/app`) em `:8791`. Python Playwright + Chrome, `is_mobile`/`has_touch`.

**Nova suíte `tests/t13_pacote21.py`, com um caso por item.**

| Alvo | Resultado |
| --- | --- |
| HEAD (`:8790`) | **18/18**, 0 erros de console |
| `bd9fa7d` (`:8792`) | **1/18** (`results/t13_pacote21_8792.json`) |

O único caso que passa em `bd9fa7d` é o `Q03-b`. Ele só confirma que, depois de aceitar a troca, a rodada vira BYE, e na base isso já acontecia sem perguntar. O caso que prova o item 4 é o `Q03`, que falha na base.

**Regressão das suítes do dev**

| Suíte | Base | Agora |
| --- | --- | --- |
| t01–t09 | 283/303 | **283/303**: as mesmas 20 falhas antigas (ONB-04a/07, M-17b, E-11/16/24, B-04/07/08, N-08/10, UI-T1/T2, A-01/02/03/05/06, S-14, SW-05) |
| t10 | 36/36 | 36/36 |
| t11 | 47/47 | 47/47 |
| t12 | 77/77 | **77/77** (com os ajustes abaixo) |
| t13 | — | 18/18 |

Os detalhes de A-01, A-02 e A-03 (axe e alvos) são idênticos aos da base.

**Asserts ajustados nas suítes do dev (todos por mudança intencional)**
- `t05_events.py`: E-07 espera "2–1–1" e E-10 espera "3–0–1" (travessão, item 10).
- `t06_stats.py`: S-21 espera "0–0" e S-22 usa `rec()` com travessão no card do deck (item 10).
- `t12_pacote2.py`:
  - P2-20: o Bo1 agora tem o resultado numa linha e "Começou: Eu/Ele" noutra (itens 5 e 6).
  - P2-55, P2-59, P2-64 e P2-65: travessão, e "Resultado: 3–0–1 (V–D–E)" no texto do card (item 10).
  - Duas esperas de 500–900 ms antes de salvar de novo logo após um salvamento, por causa da janela de 800 ms do SALVAR (item 2).

**Scripts dos retestes**

Cópias em `tests/reteste21/qa` e `tests/reteste21/ux`, apontadas para `:8790`/`:8791`, com resultados em `tests/reteste21/results`. Os originais não foram tocados.

| Script | Antes (QA) | Agora | Observação |
| --- | --- | --- | --- |
| q1_compare | 20/22 | 20/22 | Mesmas 2: Q95-09, que não estava no escopo, e um erro do próprio script |
| q2_idbye | 30/30 | 30/30 | Asserts trocados para travessão |
| q3_sheet | 19/21 | 20/21 | SH-20 (Q95-07) passa; SH-08 é premissa errada do script; SH-10 ganhou espera de 400 ms (re-toque) |
| q4_bar | 64/80 | **83/83** | Os 16 casos KB passam; o assert aceita a barra escondida com teclado; BF usa outro nome no G2 porque repetir nome foi bloqueado (Q95-07); esperas de 900 ms nos DBL |
| q4b_dbl | 4/12 | **12/12** | |
| q4c_kb | 14/16 | **16/16** | |
| q4d_bfstats | 3/3 | 3/3 | |
| q5_compat | 6/7 | 4/7 | Veja abaixo |
| q6_voce | 1/2 | 1/2 | Mesmo falso positivo ("TE" de Teemo) |
| q7_edge | 7/10 | 7/8 | E-01 e E-02 passam; falta só E-04 (Q95-08, fora do escopo); E-05 com travessão; q7b_perf 2/2 |
| q8_norm | 8/8 | 8/8 | |
| q9_edit_a11y | 7/7 | 7/7 | |
| q10_g3 | 3/4 | **4/4** | |

As 3 falhas do q5_compat:
- C-03 e C-04 comparam texto com a 0.9.4 e só diferem pelo travessão em `deckText`/`deckCanvas` e no Histórico, o que é intencional.
- C-07 é o Q95-05: a 0.9.4 lendo o armazenamento da 0.9.5 não pôde ser corrigida.

Scripts do UX:
- `dbl.py`: depois de dois toques, a ordem dos chips fica igual e grava "Void Gate × Zaun Warrens".
- `p2_new.py` (A1): **19 toques** e 1 rolagem em 390 e em 360 (eram 22 toques, com 1 e 2 rolagens); em 320, 2 rolagens (eram 5).
- `hov.py`: sem rolagem horizontal; PRONTO visível em 360 e em 320.
- `clip.py`: nenhum botão de resultado cortado. Restam "Jinx Aggro"/"Oponente" no confronto em 320 (U95-12, fora do escopo).
- `ev_new.py`: as rolagens por evento caíram de 5 para 1 (390, ID/bye) e de 8 para 3 (360).
- `kbd.py` mede a sobreposição pela barra; com a barra escondida, a medida não se aplica (o t13 `U06` cobre o caso).

**Screenshots conferidos** (`shots/`): `p21_folha_360.png`, `p21_folha_320.png`, `p21_bo1_360.png`, `p21_comecou_360.png`, `p21_pos_salvar_390.png`, `p21_pos_salvar_360.png` e `p21_banner_360.png`.

## Pendências e decisões a confirmar

- **Bo3 por tipo de evento:** a lista (Skirmish, Showdown, Riftatlas, Regional (RQ)) segue a sugestão do UX. Não consegui confirmar nas regras oficiais de OP qual tier é Bo1. Se algum for Bo1, basta tirá-lo de `BO3_EVENT_TYPES`.
- **320x568 depois de salvar:** o aviso e o topo do formulário ficam à vista, mas o G2 fica atrás da barra, porque a tela não tem altura para tudo. Em 390 e 360 cabe.
- **Teclado:** foi validado só por emulação (janela reduzida). Falta confirmar num Android real com `adjustResize`.
- **Banner em 360:** "Rodada 4 ·" pode ficar sozinho na 1ª linha, com "você está 2–0–1 V–D–E" inteiro na 2ª.
- **Fora do escopo e ainda abertos:**
  - Q95-08: BYE sem deck grava `my: ""`.
  - Q95-09: 2º toque no resultado do Bo1 desmarca.
  - Q95-11: textos de ID/bye.
  - U95-07: tamanho do "VITÓRIA" e rodada na barra.
  - U95-10: "Como foi a rodada?" compacto.
  - U95-11: "vitória (bye)".
  - U95-12: "Opone/nte".
  - U95-14: frases a polir.
  - "Tu/teu" no site da raiz.
- As suítes continuam fora do git (`tests/t13_pacote21.py`, os ajustes e `tests/reteste21/` estão só no disco).

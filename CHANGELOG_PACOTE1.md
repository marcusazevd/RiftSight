# Riftsight 0.9.3 · Pacote 1 de correções

Base: `a08d9a5` (0.9.2). Versão nova: `APP_VERSION = "0.9.3 · Arcade"` (`app/js/core.js`) e `CACHE = "rbt-v0.9.3"` (`app/sw.js`).
Onze commits, um por item ou grupo lógico, sem push. O diff completo está em `pacote1.patch` (`git diff a08d9a5..HEAD`; o arquivo não foi commitado).

## Resultado da regressão

Suítes do QA copiadas para `/home/claude/dev/tests` (porta 8790, caminhos de `dev`), Chrome real via Playwright, 390×844 móvel.

| | Asserts | Passaram | Falharam |
|---|---:|---:|---:|
| Antes (0.9.2, mesma cópia) | 299 | 254 | 45 |
| Depois (0.9.3) | 303 | 281 | 22 |

- Os 22 que ainda falham são todos de itens **fora do Pacote 1**: QA-05 (DK-07b, DK-08b), QA-10 (N-10, UI-T1, UI-T2), QA-11 (E-11, E-16), QA-12 (E-24), QA-13 (S-14), QA-14 (B-07, B-08), QA-15 (B-04), QA-18 (SW-05), QA-19 (A-01, A-02, A-03, A-05, A-06, N-08, ONB-07), QA-20 (M-17b), QA-21 (ONB-04a).
- Nenhum assert que passava antes passou a falhar. Zero erros de console/pageerror nas suítes, fora o 404 proposital do teste de service worker (já existia).
- Verificações próprias do pacote: `tests/x_extra.py`, 36 de 36.
- Uma execução da suíte de eventos quebrou uma vez no E-16 (leitura de `players` vazia logo depois de preencher o diálogo). Não se repetiu em cinco execuções seguintes (a regressão completa foi rodada duas vezes sobre o commit final, com o mesmo resultado); trato como instabilidade do script, mas não achei a causa.

### Ajustes nas cópias dos testes (os originais em `/home/claude/qa/tests` não foram tocados)

Além de porta e caminho, seis pontos precisaram mudar porque o comportamento pedido mudou:

| Arquivo | Ajuste | Motivo |
|---|---|---|
| `flows.py` (`save_manual`) | rola o SALVAR para o centro antes de clicar | a tela agora volta ao topo depois de salvar; o Playwright não rola sozinho quando o botão está atrás da barra fixa |
| `t03_matches.py` M-04 | espera "Vitória … vs Ahri … Desfazer" | texto novo do aviso (UX-03) |
| `t03_matches.py` M-15 | recarrega antes do cenário e aceita 2-0 com 2 games | o M-14 agora é bloqueado e deixava o formulário preenchido; virar 2-0 limpa o game 3, e salvar 2-0 é correto |
| `t04_live.py` L-33 | novo L-33b confere a confirmação e confirma | o resumo agora pergunta (QA-16) |
| `t09_nav_ui_a11y.py` N-05/N-07 | novos N-05b, N-05c, N-07b; não clica mais em `#lv-back` depois do voltar | o voltar pede confirmação e já sai do setup (QA-08) |
| `t08_robust.py` SW-05 | nome do cache `rbt-v0.9.3` | com o nome antigo o teste passava por engano |

`t07b_isolate.py` termina com `__lastAuto is not defined`: é o esperado, o autobackup não é mais chamado com histórico vazio.

## P0

### 1. QA-03 / UX-01 · navegação some ao sair do contador — feito
- **Mudou:** `core.js` (`showView` remove `board-on` do body em qualquer tela que não seja o contador).
- **Teste:** L-29b e L-31b passam; em `x_shots2.py` cinco partidas são descartadas pelo menu ⋯ e a `nav` está visível depois de cada uma.

### 2. QA-01 · XSS via backup — feito
- **Mudou:** `ui.js`, `views.js`, `register.js`, `analysis.js` (todo valor interpolado passa por `esc()`: ids em `data-*`, `value` de option, `src` de imagem, cor do set, rodada, placar, colocação; a classe do evento vira `open`/`closed` fixo). `store.js`: ids no formato `/^[\w-]{1,64}$/`, imagens só `data:image/(png|jpeg|jpg|webp|gif);base64,…` (importação, cópia local, banco e `saveImage`), status de evento restrito a `open`/`closed`, cor de set só `#hex`.
- **Decisão:** id com caracteres fora do padrão é **trocado** (`[^\w-]` vira `_`, sempre igual, para os vínculos partida → deck → versão continuarem batendo) em vez de descartar o registro. Só é descartado o que não tem id aproveitável. Escolhi assim para não perder partidas antigas com id fora do padrão; o resultado sempre casa com a regex.
- **Teste:** I-22 passa (0 `<img>` injetadas, 0 alerts em 7 telas); `t07b_isolate.py` mostra 0 por vetor (match.id, deck.id, version.id, event.id/status, images).
- **Não feito:** a CSP sugerida no relatório (não estava no escopo).

### 3. QA-02 · autobackup vazio — feito
- **Mudou:** `app.js` (o timer confere `S.getState().matches.length` na hora de gravar; `clearTimeout` quando a lista fica vazia).
- **Teste:** B-14 passa; X-10 (apaga 1 de 2, espera o backup com 1 partida, apaga a última: nenhuma gravação nova).

### 4. QA-04 · validação por esquema — feito
- **Mudou:** `store.js` (`normalize`, `cleanGame`, `cleanDeck`, `cleanEvent`, `cleanSettings`, `cleanList`, `importLists`, `loadLocal`): `my`/`opp` texto não vazio; placar `n-n` ou recalculado pelos games; `games` só objetos; deck sem `versions` ganha uma `v1`; `name` texto; domínios só os de `DOMAINS`; sets precisam de id, nome e data. `ui.js`: `legendColors` tolera domínio desconhecido. `share.js`: barra de domínios idem. `views.js`: decks, eventos e imagens inválidos entram na conta de "ignoradas (inválidas)".
- A mesma validação roda ao carregar a cópia local e ao ler o banco da conta. Se algum registro já gravado for descartado, o original vai para `rbt_v2_danificado_*` antes.
- **Teste:** I-15 a I-19 passam (I-20, I-21 continuam passando); `t07c_impact.py` sem telas quebradas; X-08 (partida com `opp` numérico já gravada: fica fora, histórico abre, original guardado).

### 5. UX-05 · lista "Meus decks" — feito
- **Mudou:** `views.js` (linhas dentro de `.list`), `app.css` (regras de `.li.dkrow`).
- **Teste:** screenshot `shots/i05_meus_decks.png` conferido: avatar, nome, lenda · versão, recorde e seta alinhados; nome longo quebra em duas linhas; arquivado apagado.

### 6. UX-03 · depois de salvar no registro manual — feito
- **Mudou:** `register.js` (`save`, novo `savedToast`), `app.css` (aviso com ação numa linha; só o botão recebe toque).
- Depois de salvar: topo da tela, "Mais detalhes" fechado e aviso como `R3 · Vitória 2–1 vs Kai'Sa · evento 2–1` com **Desfazer**, que apaga a partida recém-salva (mesmo mecanismo de aviso com ação da exclusão, com `S.deleteMatch`).
- **Teste:** screenshot `shots/i06_apos_salvar.png` conferido; X-22, X-26; em `x_shots1.py` o Desfazer levou 18 → 17 partidas e o banner voltou para "Rodada 3 · 1-1".
- **Não feito:** o botão [Editar] que o relatório sugeria junto (o pedido citava só Desfazer).

### 7. QA-08 · botão voltar do Android — feito
- **Mudou:** `app.js` (`__rbtBack`), `views.js` (`moreBack`, `openDeckEditor`), `analysis.js` (`statsBack`), `live.js` (`liveBack`).
- Mais › subtela › menu; Estatísticas › matchup › matriz; setup do contador › Registrar (`true`); editor de deck com alteração pede confirmação. Em jogo continua devolvendo `false`.
- **Teste:** N-05, N-06, N-07 passam; X-40 a X-46.
- **Limite:** a confirmação vale para o botão voltar do Android. O botão "‹ Decks" da própria tela continua descartando sem perguntar (não estava no pedido).

### 8. UX-06 / UX-07 · destaques e aba Torneio — feito
- **Mudou:** `stats.js` (`matchupWeights`, `hardestMatchup`, `bestMatchup`; `recommend` devolve os sets de cada versão), `analysis.js` (destaques, `hardest`, `torneio`), `share.js` (card do deck).
- Destaques e card usam a mesma conta do card "Matchup mais difícil". "Melhor" prefere 5+ partidas; sem isso aparece com "(poucos dados)".
- Torneio: todas as versões do deck entram, com "dados de Vendetta" quando vêm de outro set; com uma versão só o texto diz que não há recomendação; "para treinar" só lista taxa suavizada < 50% ou matchup ainda não enfrentado ("nunca jogou com este deck").
- **Teste:** S-17 e S-20 passam; em `x_shots2.py`, com Kai'Sa 6–6, Ekko 1–7, Lee Sin 0–2: destaque e card da aba Matchups dão Ekko; Torneio mostra "v3 ★" e "v2 · dados de Vendetta"; Draven 6–0 não aparece em "para treinar"; deck com uma versão não recebe recomendação. Card do deck em `shots/i08_card_deck.png`.
- **Decisão:** matchups que o deck nunca enfrentou continuam na lista "para treinar" (não têm win rate; são justamente o desconhecido do campo).
- **Não feito:** o "porquê" da versão vencedora ("ganha +12 pp contra Kai'Sa"), sugerido no relatório e fora do pedido.

## P1

### 11. QA-06 + QA-16 · Bo3 manual e resumo do contador — feito
- **Mudou:** `register.js` (`bo3Games`, clique nos games, `save`), `live.js` (`saveLive`).
- Games valem em ordem; desmarcar um limpa os seguintes; o game 3 só aparece com 1–1; game marcado depois de um em branco bloqueia o salvar com explicação. No resumo do contador, resultado diferente do placar pede confirmação (não vale para partida encerrada por tempo, em que o resultado é escolhido à mão).
- **Teste:** M-14, M-15, L-33 passam, mais L-33b, X-27, X-28, X-29.

### 12. UX-15 · salvar no contador durante evento — feito
- **Mudou:** `live.js` (`saveLive`).
- **Teste:** X-25 (volta para Registrar com `R1 · Derrota 3–8 vs Viktor · evento 0–1` e Desfazer); X-24 (sem evento: Histórico e aviso antigo).

### 13. UX-12 · tipo padrão "Casual" — feito
- **Mudou:** `register.js` (`freeCtx`, `blankForm`, `save`), `core.js` (limpeza de `prefs.ctxOut`).
- "Casual" já existia em `EVENT_TYPES`, então filtros e estatísticas não mudaram. O tipo escolhido fora de evento é lembrado em `prefs.ctxOut`; `prefs.ctx` segue só como sugestão de tipo ao começar um evento. Ao encerrar o evento, o formulário volta para o tipo de fora de evento.
- **Teste:** X-20 (com `prefs.ctx = "Nexus Night"` antigo, o padrão é Casual), X-22, X-23.
- **Limite:** um setup do contador aberto durante um evento e retomado depois de o evento encerrar ainda herda o tipo do evento (`syncEvent`, que não mexi).

### 14. UX-13 · battlefields "Do oponente" — feito
- **Mudou:** `core.js` (`knownOppBattlefields`, `knownMyBattlefields`), `register.js`, `live.js`.
- **Teste:** X-21 e X-23. Sem nenhum battlefield de oponente registrado, sobra só o botão "Buscar".

### 15. UX-11 + QA-07 · ordinais e card com 7+ rodadas — feito
- **Mudou:** `ui.js` (`ord`), `views.js`, `app.css` (`.ord`), `share.js` (`textParts`, rodadas do card).
- "5º" com o sinal em fonte do sistema; média "9,0º", escondida com um evento só. Card: até 6 rodadas numa coluna, 7 a 12 em duas colunas, acima disso "+ N rodadas" na última casa.
- **Teste:** screenshots conferidos: `shots/i15_card_e9.png` (9 rodadas), `i15_card_e14.png` (14 rodadas), `i15_cards_rodadas.png`, `i15_hist_eventos.png`. A última linha termina em y≈1222, o rodapé começa em ≈1262.
- **Limite:** em duas colunas, nomes longos de lenda são cortados com reticências ("vs Master …").

### 16. UX-08 · contraste — feito
- **Mudou:** `ui.js` (`inkOn`, `contrast`), `live.js` (botões CONQUER/HOLD), `analysis.js` (células da matriz), `app.css`.
- **Teste:** contraste medido no navegador pelas cores computadas: botões de domínio de 4,63 a 10,2 (5 confrontos, os 6 domínios); matriz com 33 células, mínimo 4,68. Screenshots `shots/i16_contador_viktor_sett.png`, `i16_contador_jinx_ahri.png`, `i16_matriz.png` conferidos.
- **Efeito colateral:** para o branco chegar a 4,5:1, o roxo de Caos nos botões e os tons intermediários da matriz ficam um pouco mais escuros (ex.: `#9b59d6` vira `rgb(150,86,208)`). A legenda de escala da matriz usa as cores originais.
- **Não coberto:** o contraste das linhas "apagadas" (menos de 5 partidas), que é da QA-19.

### 17. QA-09 · tipo errado no localStorage — feito
- **Mudou:** `store.js` (`loadLocal`, `loadImagesLocal`, `stashCorrupt`), `core.js` (leitura de `rbt_prefs`, `readLive`), `live.js`, `register.js`, `app.js`.
- `rbt_v2`, `rbt_prefs`, `rbt_imgs` e `rbt_live` com formato errado: o conteúdo bruto vai para `<chave>_danificado_<data>` e o app segue com os padrões (no `rbt_v2`, o que for válido é aproveitado).
- **Decisão:** nesses casos o aviso é um toast, não o diálogo "Cópia local danificada" (que continua para JSON ilegível).
- **Teste:** R-04 a R-12 passam; X-01 a X-07 conferem a cópia bruta e que recarregar não cria outra.

## Arquivos de apoio

- `tests/` (cópias das suítes, `x_extra.py`, `x_shots1.py`, `x_shots2.py`, `runall.sh`) e `shots/` ficam fora do git (`.git/info/exclude`).
- Não mexi em pacote, estrutura nem no `MainActivity`.

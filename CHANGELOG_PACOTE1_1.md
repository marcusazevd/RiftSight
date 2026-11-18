# Riftsight 0.9.3 · Pacote 1.1 (correções dos retestes)

Base: `3124fe1` (Pacote 1). A versão continua `0.9.3 · Arcade` e o cache do service worker continua `rbt-v0.9.3`, como pedido. Não mexi em `MainActivity` nem no pacote.
São nove commits, um por item ou grupo lógico, sem push. O diff do 1.1 está em `pacote1_1.patch` (`git diff 3124fe1..HEAD`). O `pacote1.patch` foi refeito com `git diff a08d9a5..HEAD`. Os dois arquivos ficam fora do git.

## Testes

**Teste novo: `tests/t10_pacote11.py`.** Tem um bloco por item e cada bloco reproduz o passo do reteste. Uso: `python3 t10_pacote11.py [url]`.

| Alvo | Resultado |
|---|---|
| HEAD (porta 8790) | **36/36** |
| `3124fe1` (worktree em `/tmp/wt3124`, porta 8791) | **3/36** |

No `3124fe1`, os 3 que passam são controles, não o defeito:
- P11-3a: sair sem alteração vai direto;
- P11-4g: guarda extra de colisão com id "salgado";
- P11-CON: console sem erros.

**Regressão das suítes em `tests/`:** **282/304**. O baseline era 281/303; o assert a mais é o L-33c, novo e passando.
- Os 22 que falham são os mesmos do baseline: ONB-04a, ONB-07, DK-07b, DK-08b, M-17b, E-11, E-16, E-24, B-04, B-07, B-08, N-08, N-10, UI-T1, UI-T2, A-01, A-02, A-03, A-05, A-06, S-14 e SW-05.
- Nenhum assert que passava passou a falhar.
- `x_extra.py`: 36/36.

**Ajustes nas cópias das suítes**, porque o comportamento pedido mudou:

| Arquivo | Ajuste |
|---|---|
| `t03` M-04, `x_extra` X-22/X-25 | leem a faixa `#svbar` em vez do `#toast` |
| `x_extra` X-26 | o Desfazer do contador agora volta ao resumo do contador |
| `x_extra` X-27 | exige também "Game 1" na mensagem |
| `x_extra` X-29 | desmarcar o G1 mantém G2/G3 (RUX-10) |
| `t08` P-02 | espera `#svbar` |
| `t08` R-21 | antes de sair do editor com alteração, responde "Descartar" (RUX-03) |
| `t04` L-33 | reescrito (item 10) |

**Scripts dos retestes:** rodei cópias em `/tmp/rq` e `/tmp/ru`, só com porta e caminho trocados. A 0.9.2 de comparação ficou servida na 8802. Os originais não foram tocados.
- **reqa:**
  - r01, r02b (8/8, antes 2/8), r03, r05, r06 (14/14), r07 (29/29), r12 (22/22), r15, r16, r17, r20 e r21 passam. No r21, todos os botões ficam dentro de 36–284 px; no r06b, o toque no aviso sumido não age mais.
  - **r02 XL-3** e **r04 N-14v** continuam falhando, como no reteste original: são erros do próprio script.
  - **r08 ST-D2/D3-impl** passam a falhar e **ST-D2/D3-ideal** passam a passar. É o esperado: o "-impl" reproduz a conta antiga.
  - **r11 B3-A/B3-D** falham por decisão do RUX-10: desmarcar não limpa mais os games seguintes.
- **reux:**
  - `damaged.py` mostra "1 partida danificada ficou de fora (48 de 49 carregadas)… cópia" e o aviso do contador perdido.
  - `flows.py` dá:
    - nada tocável sob o Desfazer;
    - Desfazer com duração de 8,08 s;
    - formulário devolvido;
    - mensagem do Bo3 com "Game 1/Game 2";
    - "‹ Decks" pergunta.
  - p1, p2, p3 e cards rodam sem erro.
- **Adaptações nas cópias:**
  - aviso lido em `#svbar`;
  - espera de 9 s em vez de 7 s;
  - r16 lê a cor real da listra em vez de supor branco 14%;
  - Descartar responde as perguntas novas;
  - recarregar depois do Desfazer em `flows.py`, porque o formulário agora volta preenchido.

**Conferência visual (Read)**, telas em `shots/p11_*.png`:
- item 1: `p11_item1_390_bo3`, `p11_item1_360_bo1`;
- item 2: `p11_item2_undo_form`, `p11_item2_undo_live`;
- item 6: `p11_item6_matrix`;
- item 7: `p11_item7_torneio`.

## Itens

### 1. RQA-01 + RUX-01 · Desfazer invisível e aviso sobre o formulário (bloqueante): feito
- **Mudou:**
  - `ui.js` (`toast`):
    - um número de sequência e a classe `.on` são conferidos no clique: um clique atrasado ou num aviso trocado é ignorado;
    - o botão sai do DOM 250 ms depois de esconder.
  - `app.css`:
    - `#toast button{pointer-events:none}` e `#toast.on button{pointer-events:auto}`;
    - o texto do aviso continua sem receber toque.
  - `register.js`: o aviso de "salvo" com Desfazer deixou de ser toast flutuante. Virou a faixa `#svbar`, no fluxo da página, logo abaixo do banner do evento. Por estar no fluxo, não fica por cima de nada.
  - Depois de 8 s, a faixa fica só como confirmação (✓, sem botão) até a próxima partida ou até sair da tela.
- **Teste:**
  - P11-1a: em 390x844, 9 s depois de salvar, o ponto onde ficava o Desfazer não é mais um Desfazer, e tocar nele não apaga nada.
  - P11-1b, em 390x844 e 360x740, Bo1 e Bo3:
    - o retângulo do Desfazer não cruza nenhum botão, input, select ou textarea do Registrar nem a `nav`;
    - pontos sobre o texto do aviso não acertam controles embaixo.
  - P11-1c: contador em evento, de volta ao Registrar.
  - No `3124fe1`, o 1b mostrava o Desfazer sobre "Oponente", "Perdi" e "Empate", e o texto deixava passar "Eu comecei", "Única" e "Eu".
- **Decisão:**
  - Escolhi a faixa no topo, não o aviso acima da `nav`. Com a tela no topo depois de salvar, qualquer posição fixa acima da `nav` cai sobre o formulário; o padding no fim da página só ajudaria rolando até o fim.
  - Com isso, o Desfazer só existe em Registrar. Antes dava para desfazer pelo toast em outra aba; agora é preciso voltar a Registrar dentro dos 8 s.
  - Os demais avisos (sem ação ou com "Card"/"Desfazer" da exclusão) seguem no `#toast` com a proteção nova.

### 2. RUX-02 · Desfazer devolve os dados: feito
- **Mudou:**
  - `register.js` (`savedToast(m, restore)`, `undoSaved`, `formFromMatch`, extraído de `editMatch`) e `live.js` (`restoreSummary`).
  - **Manual:** volta a foto do formulário de quando o jogador salvou: oponente, games, quem começou, battlefields, nota e "Mais detalhes".
  - **Contador:** a partida volta ao resumo do contador, com resultado, pontos, linha do tempo e nota, e um aviso no topo do resumo.
  - Se já houver outra partida em andamento no contador, ela não é sobrescrita: a partida desfeita vai para o formulário manual preenchido. Nesse caso perde pontos e linha do tempo, que o formulário não comporta.
  - A rodada é recalculada (`nextRound`), então salvar de novo grava a mesma rodada.
- **Teste:**
  - P11-2a e P11-2b: Bo3 V-D-V com nota → Desfazer → formulário igual e "Rodada 2". Corrigir e salvar grava R2 1–2; a seguinte é R3; as rodadas ficam [1,2,3].
  - P11-2c e P11-2d: o contador volta ao resumo e salvar de novo dá R1 com pontos 3–8.
  - P11-2e: com outra partida em andamento, o placar é preservado e a partida desfeita vai para o formulário.
- **Não feito:** "Refazer" depois do Desfazer. Os dados voltam para a tela, então salvar de novo já é o refazer.

### 3. RUX-03 · Saídas do editor de deck: feito
- **Mudou:**
  - `views.js`: o `‹ Decks` do editor passa por `moreBack()`; nova `leaveDeckEditor()`.
  - `app.js`: as abas da barra inferior chamam `leaveDeckEditor()` antes de trocar de tela.
- **Teste:**
  - P11-3a: sem alteração, sai direto.
  - P11-3b: com alteração, pergunta; Cancelar mantém o texto.
  - P11-3c: trocar de aba também pergunta.
  - P11-3d: Descartar não grava.

### 4. RQA-02 · Ids na importação sem colisão: feito
- **Mudou:**
  - `store.js` (`idOrNull`, `deriveId`, `prepareImport`/`finishImport`, deduplicação de versões em `cleanDeck`, contagem em `importMatches`, id do formato v1).
  - `views.js` (`doImport` e mensagem).
- **Regra:** id fora de `^[\w-]{1,64}$` vira o começo legível (até 56 caracteres) + `_` + hash FNV-1a de 7 caracteres do id original inteiro.
  - É determinístico: deckId, versionId e eventId das partidas apontam para o mesmo id novo, e reimportar não duplica.
  - Durante a importação, o derivado é conferido contra os ids do aparelho, os do arquivo e os já derivados. Se colidir, ganha outro sufixo.
- **Mensagem:**
  - id ajustado não conta mais como inválido;
  - fica "3 novas, 0 atualizadas · 2 ids ajustados";
  - repetidas no arquivo aparecem à parte;
  - a concordância foi corrigida ("1 ignorada (inválida)").
- **Teste:** P11-4a a P11-4g, que cobrem os casos A–F do reteste mais a colisão salgada. `r02b_collide` passa de 2/8 para 8/8.
- **Pendência:** o banco da conta (fora do escopo) com id de doc fora do padrão continua sem tratamento. O id derivado é estável, mas apagar remove o doc pelo id novo, não pelo original.

### 5. RQA-03 · "Mais difícil": feito
- **Mudou:** `stats.js` (`hardestMatchup` filtra `p < 0,5` antes de escolher o maior risco; o mínimo de 2 partidas continua).
- **Teste:** P11-5-D2 e P11-5-D3 (dados do reteste): o destaque, o card da aba Matchups e `hardestMatchup` no deck (o mesmo do card do deck) dão Ekko.

### 6. RQA-05 · Contraste das células listradas: feito
- **Mudou:** `app.css`. Em `.mx td.few.lt` (texto branco), a listra é escura (`rgba(0,0,0,.2)`); em `.dk` (texto escuro), continua clara. Assim a listra só aumenta o contraste.
- **Teste:** P11-6 calcula o contraste pela cor real do gradiente nas duas faixas: o mínimo ficou ≥ 4,5 (era 4,11). Conferido em `p11_item6_matrix.png`: listrado ainda visível e no mesmo estilo.

### 7. RUX-06 · TORNEIO: feito
- **Mudou:** `analysis.js` (`FEW_VER = 5`, `FEW_FIELD = 20`).
  - Versão líder com menos de 5 partidas: sem ★, com "(poucos dados)" na linha e o veredito "Palpite (poucos dados): … Só 1 partida com ela: pode ser sorte."
  - "O campo · N partidas", com "Campo pequeno: com menos de 20 partidas, as porcentagens mudam muito a cada jogo."
  - "Para treinar" com n < 3 recebe "(poucos dados)".
- **Teste:** P11-7a e P11-7b. Conferido em `p11_item7_torneio.png`.
- **Não feito:** a nota "metas diferentes" no veredito e o critério "faixas se cruzam" do relatório; estavam fora do pedido.

### 8. RUX-09 · Contador danificado e aviso de reparo: feito
- **Mudou:**
  - `core.js`: `readLive` registra `liveLost()`.
  - `store.js`: `state.repaired` guarda quantos registros entraram de quantos, e `state.imagesDropped`.
  - `app.js` (`repairNote`): o aviso diz, por exemplo, "1 partida danificada ficou de fora (48 de 49 carregadas).", "A partida em andamento no contador estava danificada e não pôde ser recuperada." e "Uma cópia do original ficou guardada neste aparelho…". Dura 10 s.
  - `app.css`: aviso longo usa a largura da tela, em vez de uma coluna estreita.
- **Teste:** P11-8a (contador) e P11-8b (1 de 4 partidas).
- **Pendência:**
  - Continua um toast, não um diálogo. Um diálogo no boot travaria várias suítes e não era pedido.
  - Não há tela para baixar as cópias danificadas.

### 9. Menores: feitos
- "evento 2–1" fica numa linha (`.nw`, white-space:nowrap): P11-9a, com 4 oponentes em 390 e 360 px. No `3124fe1`, 3 de 8 quebravam (Kai'Sa em 390; Sett e Ahri em 360).
- Duração de 8 s respeitada:
  - na faixa, P11-9b: tocável aos 7 s e fora aos 8,7 s;
  - no Desfazer da exclusão, que pedia 8000 e valiam 6000: P11-9b2.
- Bloqueio do Bo3: diálogo "Games fora de ordem" com "o **Game 1** está em branco, mas o **Game 2** já foi marcado. Marque o Game 1 ou desmarque o Game 2." (P11-9c).
- Desmarcar o G1 não apaga mais G2/G3 (P11-9d: V-D-V → desmarca → "", D, V → remarca → salva 2-1).
  - O game 3 só é limpo quando deixa de existir (2–0, ou G1 e G2 em branco).
  - O game 3 continua à vista enquanto tiver resultado, para o bloqueio nunca apontar um game escondido.
- RQA-04: `.dlg-act{flex-wrap:wrap}`. Em 320 px os 4 botões do menu ⋯ ficam dentro da tela (P11-9e; antes left −71).

### 10. Teste L-33: feito
- **Mudou:** `tests/t04_live.py`. Com Bo1 8–0 marcado como Derrota:
  - **L-33b:** a confirmação aparece;
  - **L-33c:** Cancelar não salva nada, o resumo continua e a Derrota segue marcada;
  - **L-33:** "Salvar assim" grava exatamente 1 partida nova, com result L, game W, pontos 8–0, source contador e `rbt_live` limpo.

## Pendências gerais
- O cache do service worker continua `rbt-v0.9.3`, porque a versão não podia mudar. Quem já abriu a 0.9.3 pelo site (https) pode ficar com os arquivos antigos até o cache renovar. No APK isso não se aplica, porque o SW não é registrado.
- `tests/` e `shots/` continuam fora do git (`.git/info/exclude`).

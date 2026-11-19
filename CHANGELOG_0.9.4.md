# Riftsight 0.9.4 · Placar "mesa" (versão A)

Base: `4a5bed9` (0.9.3). Sem push. Diff completo em `placar_a.patch` (`git diff 4a5bed9..HEAD`, fora do git).
Versão `0.9.4 · Arcade` (`app/js/core.js`) e cache do service worker `rbt-v0.9.4` (`app/sw.js`). O modelo de dados não mudou: `rbt_live`, o log e as partidas salvas têm o mesmo formato.

## O que mudou na tela do contador (fase "play")

- **Lado do turno** (definido por `active(g)`) ocupa o espaço restante. Ele mostra:
  - avatar de 60px, nome e o selo "▶ TEU TURNO" ou "▶ TURNO DELE";
  - o relógio daquele jogador em destaque (22px, ouro), com "teu relógio" ou "relógio dele";
  - placar de 96px e "DE 8";
  - origem dos pontos: "Conquer X · Hold Y", e "+N outros" quando houver;
  - "faltam N", que vira "▲ FALTA 1 PONTO ▲" quando falta 1;
  - trilha de 8 segmentos com 30px, nas cores de origem de hoje;
  - CONQUER e HOLD em 2/3 da área de botões, "+1" e "−1" no 1/3 restante (cada um com pelo menos 44px).
- **Lado fora do turno** fica compacto, com 160px de altura (140px quando a tela tem 640px de altura ou menos). Ele mostra:
  - avatar de 40px, nome e relógio;
  - trilha de 10px, origem dos pontos e placar de 34px;
  - uma fileira CONQ · HOLD · +1 · −1, todos com 44px de altura e nas cores da lenda.
  - Os botões são os mesmos (`.act-b`, `data-side`, `data-src`, `data-d`) e passam pela mesma `point()`. Por isso o log, a origem, a vibração e o fim de game em 8 funcionam igual.
  - Com 7 pontos, o placar compacto fica dourado e o 8º segmento pisca.
- O oponente continua girado 180° nos dois tamanhos.
- **Faixa do meio**, com 132px:
  - linha de informação: "GAME n · v–d" (Bo3) ou "PARTIDA BO1", e "Turno N · mm:ss de partida";
  - à direita, "Teu bf: X" e "Dele: Y" quando existem;
  - linha de botões: ↶ (56px), PASSAR TURNO largo (56px de altura, "PASSAR TURNO ▸" no meu turno e "◂ PASSAR TURNO" no dele, com aria-label "Passar o turno para o oponente/para ti") e ⋯ (56px).
  - Abaixo de 390px de largura, se houver battlefield, o sufixo "de partida" sai para o nome do battlefield caber.
- **Animação**: as alturas trocam por `flex-grow`/`flex-basis` em 0,4s, com `cubic-bezier(.2,.8,.2,1)`, ao passar o turno e ao desfazer um passe. Com `prefers-reduced-motion` não há transição.
  - Para a transição existir, `renderPlay()` agora atualiza no lugar os mesmos elementos (`.pn.opp`, `.mid`, `.pn.me`).
  - `render()` monta do zero com `renderPlay(true)`, sem animação, ao abrir, retomar ou recarregar.
  - O foco do teclado em ↶, PASSAR ou ⋯ é devolvido depois de cada atualização.
- **Guarda contra toque fantasma**: durante 400ms (`SWAP_MS`) depois de uma troca de turno:
  - os botões de ponto ficam `disabled`, e `point()` também ignora toques;
  - um 2º "Passar turno" também é ignorado, porque um toque duplo devolveria o turno;
  - o desfazer funciona sempre.
- Mantido sem mudança:
  - cores por domínio com `inkOn()`, que escolhe texto escuro ou claro pela luminância;
  - `aria-live` no placar, aria-labels dos botões, e os ids `clk-me`, `clk-opp` e `clk-total` do relógio;
  - persistência e retomada, tela sempre ligada e vibração;
  - menu ⋯, Bo3 e battlefields, undo, `sourcesOf` e as telas de gameover e resumo.
  - Os painéis ganharam `role="region"` e um aria-label do tipo "Tu: Jinx, no turno" ou "Oponente: Ahri, fora do turno".

## Arquivos

| Arquivo | Mudança |
|---|---|
| `app/js/live.js` | `panel()` em duas variantes (ativo/compacto), `midHTML()`, `renderPlay(fresh)` incremental, guarda `SWAP_MS` em `point()`/`pass()` |
| `app/css/app.css` | bloco novo no fim: "0.9.4: placar mesa (versão A)", com media queries para largura <360 e altura ≤640 |
| `app/js/core.js` | `APP_VERSION = "0.9.4 · Arcade"` |
| `app/sw.js` | `CACHE = "rbt-v0.9.4"` |

## Testes

**Novo: `tests/t11_placar_a.py` — 47/47** (Chrome headless, `is_mobile` e `has_touch`, servidor na porta 8790). Cobre:
- alturas ativo/compacto/meio em 390x844, 360x740 e 320x568, e a troca ao passar e ao desfazer (A-01/02/06);
- a animação no meio da transição, a duração e a curva (A-03/04);
- o "Passar turno" mantém x, largura e lugar dentro da faixa (A-05), a seta e o aria-label (A-07);
- as 8 ações de ponto nos dois estados de turno: placar, log (lado/d/origem) e vibração 18 ou 8 pela ponte (A-08/09);
- fim de game em 8 pelo lado compacto, derrota e vitória, e desfazer no gameover (A-10..15);
- toque fantasma: toque duplo e toque 150ms depois no lugar do "Passar", botões desabilitados, volta após 400ms, desfazer durante a guarda (A-16..20);
- reduced motion (A-21);
- retomada após recarregar no meio, pela UI real, com Bo3 e battlefield (A-22..24);
- nada fora da tela, cortado pelo painel ou vazando do botão, e placar sem quebrar linha, nos 3 viewports × 4 estados, incluindo nomes longos (A-25);
- alvos ≥44px (A-26);
- contraste ≥4,5:1 de todos os botões e do selo, e do texto secundário sobre o fundo do painel. Usa 9 lendas que cobrem todos os domínios como conquer e como hold, nos dois turnos (A-27);
- aria-live, aria-labels e regiões (A-28), giro de 180° nos dois tamanhos (A-29/30), conteúdo da faixa do meio e do lado ativo (A-31/32);
- zero erros de console (CON-11).

**Regressão t01–t09: 282/304**, igual ao baseline medido antes da mudança. As 22 falhas são as mesmas: ONB-04a, ONB-07, DK-07b, DK-08b, M-17b, E-11, E-16, E-24, B-04, B-07, B-08, N-08, N-10, UI-T1, UI-T2, A-01, A-02, A-03, A-05, A-06, S-14 e SW-05. **t10: 36/36.**
- A t04 (42/42) passa sem ajuste. O `page.click` do Playwright espera o botão ficar habilitado, então os cliques logo depois de "Passar turno" esperam a guarda de 400ms acabar.

**Assert ajustado (1):**

| Arquivo | Ajuste | Motivo |
|---|---|---|
| `t08_robust.py` SW-05 | lê o cache atual (`caches.keys()` com prefixo `rbt-`) em vez do nome fixo `rbt-v0.9.3` | Com a troca de versão o teste passava em falso, porque abria um cache vazio. Agora volta a falhar como no baseline (o SW ainda cacheia 404, pendência antiga). |

**Screenshots** em `shots/094/`, conferidos contra `A-meu-turno`, `A-turno-oponente` e `Prototipo`: `meu_turno`, `turno_oponente`, `w320`, `w320_opp`, `bo3_bf`, `w360`, `w360_opp`.

## Desvios da especificação

- **"A troca não pode fazer o botão Passar turno se mover":** na geometria aprovada (mockups e protótipo), a faixa do meio fica entre o lado compacto (fixo) e o lado ativo (flexível). Por isso ela **desce ou sobe** quando o turno troca: em 390x844 o topo da faixa vai de y=160 para y=552.
  - Garanti o que dá para garantir sem contrariar o mockup: posição horizontal, largura e lugar do botão dentro da faixa idênticos (testado);
  - a guarda de 400ms impede que o 2º toque de um toque duplo vire ponto ou um 2º passe.
  - Manter a faixa parada exigiria lados de altura igual, ou seja, abandonar a versão A. Fica para decisão do dono.
- O 2º "Passar turno" dentro de 400ms é ignorado. Isso vai além do pedido, que falava só dos botões de ponto, pela mesma razão do toque fantasma.
- Tamanhos de fonte, para cumprir "Press Start ≥10px":
  - "CONQ" e "HOLD" compactos com 10px (8px no mockup);
  - selo do turno com 10px (9px no mockup);
  - relógio compacto sem o ícone ⏱, como no mockup.
- O "▲ FALTA 1 PONTO ▲" aparece no lado ativo. No lado compacto, a indicação é o placar dourado com o 8º segmento piscando, porque não há espaço para o texto.

## Pendências

- As regras CSS antigas do placar (`.pn-h`, `.pn-t`, `.pn-s2`, `.mid-c`, `.mid-vs`, `.track`, `.pm`…) ficaram no arquivo, sem uso pelo placar. Dá para limpar numa próxima versão.
- As setas ▸/◂/▶ não existem na Press Start 2P e saem na fonte de reserva, menores. É o mesmo comportamento do mockup.
- O APK não foi gerado de novo: `versionCode` e assinatura não foram tocados.
- Falhas antigas do baseline continuam abertas (lista acima).

## Proteção mínima para o teste em mesa (19/11/2026)

Depois dos retestes de QA (Q94-01) e experiência (U94-02/03/06), o dono escolheu testar a versão A em partidas reais antes de decidir o layout definitivo. Ajustes:

- **Área do antigo "Passar turno" protegida por 0,9 s** (`app/js/live.js`): ao passar, o retângulo do botão (com folga de 16/24 px) fica bloqueado; toques ali são ignorados, o botão treme e vibra curto. Os botões de ponto que caem nessa área ficam com borda tracejada e apagados até liberar. Fora dela vale a guarda de 0,4 s de antes. Desfazer nunca é bloqueado.
- **Setas apontam para quem recebe o turno:** "PASSAR TURNO ▲" no meu turno (vai para o oponente, em cima) e "▼ PASSAR TURNO" no dele.
- **"GAME n · v–d" / "PARTIDA BO1" em ouro** (Q94-03: CSS antigo sobrescrevia).
- Testes: repro do QA (`/home/claude/qa094/q2b_finger.py`, F2) agora passa nos 8 casos; verificação própria da zona 12/12 (bloqueia a 600 ms, libera a 1,2 s, toque fora da zona a 450 ms conta). Regressão t01–t09 282/304 (igual), t10 36/36, t11 47/47. Asserts ajustados: t11 A-07 (setas novas) e t04 (espera 1 s antes de marcar pontos logo após passar).
- Fica para a decisão de layout: o "Passar" continua mudando de posição (U94-01), paisagem/tela dividida (Q94-02), cortes de nomes longos (Q94-04), leitor de tela (U94-05).

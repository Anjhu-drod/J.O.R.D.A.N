# JORDAN V0.11.0 — Nebula Core / Spark V2 / Chess Arena

Patch incremental feito sobre a V0.10.0. Este pacote contém **somente arquivos criados ou alterados**.

## Bugs dos prints corrigidos

- O Agent Core não considera mais `/agent/health` saudável só porque o servidor HTTP respondeu. Agora diferencia `Core alcançável` de `IA realmente disponível`.
- `TESTAR AGENT CORE` faz uma chamada real do modelo e mostra o motivo exato quando a chave/modelo falham.
- Se a IA autônoma estiver indisponível, a JORDAN não mascara mais a falha com “Compreendi... Ainda não consegui formar uma resposta boa...”. Ela informa o diagnóstico e mantém apenas capacidades locais reais.
- “Onde eu estou?” ganhou ferramenta real de localização atual + reverse geocoding e também uma contingência local.
- Cálculos ganharam parser matemático seguro no dispositivo.
- “Ache meu nome na internet” é instruído a usar o nome completo do contexto e pesquisa atual, em vez de explicar o conceito de internet.

## Agent Core V2

- Modelo e raciocínio continuam configuráveis no `.env`.
- Ferramentas novas: `get_current_location`, `calculate`, `get_chess_state`, `start_chess_game`, `play_chess_move` e `undo_chess_move`.
- Contexto do dispositivo inclui identidade completa, agenda, memórias, mensagens, view atual e estado do xadrez.
- Perguntas abertas, piadas, identidade da JORDAN, explicações e conversa comum ficam no modelo geral — não no fallback legado.

## JORDAN Spark V2

Nova direção vocal original, desenhada para ser:

- feminina jovem-adulta;
- brilhante e clara;
- rápida, mas inteligível;
- muito energética e expressiva;
- carismática e espontânea;
- pouca nasalidade;
- sorriso audível leve;
- sem agudo infantil.

A referência de energia é apenas artística. A Spark V2 **não tenta copiar nenhuma personagem, dubladora ou pessoa real**.

Modo padrão `auto`:

1. tenta o TTS neural cloud configurado no `.env`;
2. se falhar, tenta a Spark V2 local/Kokoro;
3. se o JORDAN Core inteiro falhar e a opção estiver ligada, usa a contingência do dispositivo.

Os embeddings locais agora são `jordan_spark_v2_<emotion>.pt`.

## Nebula Core

Novo tema padrão: `Nebula Core · V2`, com base navy/indigo, aurora violeta/ciano, painéis glass/HUD e estados de fala/escuta redesenhados. Os temas antigos continuam selecionáveis em SYS.

## JORDAN Arena — Xadrez

Nova aba `GAME`:

- regras completas de xadrez;
- xeque, xeque-mate e afogamento;
- roque;
- en passant;
- promoção;
- regra dos 50 lances;
- histórico;
- desfazer;
- girar tabuleiro;
- persistência local;
- três dificuldades;
- motor local alpha-beta para a JORDAN;
- Agent Core consegue abrir/iniciar a partida, consultar FEN e executar lances.

## Como atualizar

Substitua no projeto apenas os arquivos deste patch, preservando as pastas.

Depois, no PC:

1. rode `voice_server/SETUP_WINDOWS.bat`;
2. rode `voice_server/CONFIGURE_AGENT_CORE.bat` e informe sua `OPENAI_API_KEY`;
3. rode `voice_server/RUN_VOICE_SERVER.bat`;
4. abra `SYS > JORDAN AUTONOMOUS AGENT CORE > TESTAR AGENT CORE`;
5. abra `SYS > JORDAN VOICE CORE > OUVIR JORDAN`;
6. publique no GitHub e faça `Ctrl+F5`/reabra a PWA.

Cache desta versão: `jordan-v0.11.0`.

## Criados

- `PATCH_V0.11.0_NEBULA_CHESS.md`
- `js/jordanChessService.js`
- `js/mathService.js`

## Alterados

- `README.md`
- `VOICE_CORE_SETUP.md`
- `css/styles.css`
- `index.html`
- `js/app.js`
- `js/assistant.js`
- `js/autonomousAgentService.js`
- `js/jordanTTSService.js`
- `js/jordanVoiceProfile.js`
- `js/locationService.js`
- `js/ui.js`
- `sw.js`
- `voice_server/.env.example`
- `voice_server/CONFIGURE_AGENT_CORE.bat`
- `voice_server/README_VOICE.md`
- `voice_server/RUN_VOICE_SERVER.bat`
- `voice_server/SETUP_WINDOWS.bat`
- `voice_server/config/voice_recipe.json`
- `voice_server/scripts/build_voice.py`
- `voice_server/server/agent_engine.py`
- `voice_server/server/app.py`
- `voice_server/server/tts_engine.py`

## Validação feita

- `node --check` em todos os JS + Service Worker;
- compilação Python dos módulos do servidor/scripts;
- JSON da receita vocal validado;
- IDs HTML sem duplicatas;
- todos os arquivos do App Shell existem;
- parser matemático testado;
- motor de xadrez testado com 20 lances iniciais, xeque-mate, undo e resposta da IA local.

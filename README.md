# JORDAN V0.12 — MANUAL CORE / NEBULA / SPARK V2 / CHESS

Atualização incremental em cima da V0.11.

## V0.12 — Manual Core

A dependência do Autonomous Agent Core foi removida do runtime. A JORDAN agora possui um cérebro manual local que roda diretamente no navegador.

Principais mudanças:

- `ManualCoreService`: interpretação local por intenção + contexto recente de conversa.
- Não usa `OPENAI_API_KEY`, modelo remoto ou endpoint `/agent/*`.
- Status do cérebro não fica offline por causa do Voice Server.
- Ferramentas locais continuam disponíveis: agenda, memória, mensagens, localização, apps, cálculo, pesquisa e xadrez.
- Perguntas como “o que é você?”, “você consegue calcular?”, “onde eu estou?”, “me conta uma piada” e “ache meu nome na internet” recebem tratamento local/contextual.
- O Manual Core usa os módulos especializados antigos como habilidades, em vez de descartá-los.
- Contexto temporário das últimas conversas é guardado em `sessionStorage` e pode ser reiniciado no SYS sem apagar memória permanente.
- Spark V2 foi colocada em modo local; o Voice Server não usa mais OpenAI API.
- Cache PWA: `jordan-v0.12.0`.

## Voice Core

Leia `VOICE_CORE_SETUP.md`.

No PC, para usar a Spark V2 local:

1. `voice_server/SETUP_WINDOWS.bat`
2. `voice_server/RUN_VOICE_SERVER.bat`
3. SYS > JORDAN VOICE CORE > TESTAR CONEXÃO

O Manual Core funciona mesmo que o Voice Server esteja fechado.

## Arquivos antigos removidos na V0.12

Esses arquivos não são mais usados e devem ser apagados do GitHub ao aplicar o patch:

- `js/autonomousAgentService.js`
- `voice_server/server/agent_engine.py`
- `voice_server/CONFIGURE_AGENT_CORE.bat`
- `voice_server/.env.example`

O seu arquivo privado `voice_server/.env`, se existir, pode ser mantido ou apagado localmente; a V0.12 não o usa.

## Firebase

As regras e a arquitetura Firebase da V0.11/V0.9.2 não foram refeitas. Mensagens, memória sincronizada, identidade e calendário continuam usando a base existente.

# JORDAN V0.12.0 — MANUAL CORE

## Objetivo

Remover a dependência do Autonomous Agent Core/OpenAI API e substituir por um cérebro manual local que nunca depende de um servidor de IA para ficar disponível.

## O que mudou

- Novo `js/manualCoreService.js`.
- O Manual Core roda no navegador e mantém contexto temporário da conversa em `sessionStorage`.
- Interpreta intenções e chama ferramentas locais para cálculo, localização, agenda, memória, apps, pesquisa e xadrez.
- Usa os módulos antigos da JORDAN como habilidades especializadas quando eles entendem melhor um pedido.
- O painel SYS agora mostra `JORDAN MANUAL CORE · LOCAL · READY`.
- `TESTAR MANUAL CORE` executa 5 testes locais e não faz chamadas externas.
- O cérebro não depende mais de `127.0.0.1:8787`.
- O Voice Server ficou responsável somente pela Spark V2.
- A Spark V2 foi fixada no modo local; não usa OpenAI API.
- Cache PWA atualizado para `jordan-v0.12.0`.

## Casos tratados diretamente pelo Manual Core

- “O que é você?”
- “Você consegue calcular?”
- “Calcule 2+2”
- “Onde eu estou?”
- “Me conta uma piada”
- “Ache meu nome na internet” — resolve o nome pelo perfil ativo antes de pesquisar.
- “Vamos jogar xadrez”
- “Jogue e2 para e4”
- leitura básica de agenda, memória e navegação de telas/apps.

## Instalação

1. Substitua no GitHub somente os arquivos presentes neste patch.
2. Apague os quatro arquivos listados em `DELETE_OLD_AGENT_CORE_FILES_V0.12.txt`.
3. Aguarde o GitHub Pages publicar.
4. Faça `Ctrl+F5` no PC ou feche e reabra a PWA.
5. Abra `SYS > JORDAN MANUAL CORE` e clique em `TESTAR MANUAL CORE`.

O resultado esperado é `5/5 testes internos`.

## Voice Core

O Manual Core funciona com o Voice Server fechado. Para usar a Spark V2 local:

1. Rode `voice_server/SETUP_WINDOWS.bat` uma vez.
2. Rode `voice_server/RUN_VOICE_SERVER.bat` quando quiser usar a voz local.

Nenhuma chave de API é necessária.

## Arquivos alterados

- `README.md`
- `VOICE_CORE_SETUP.md`
- `index.html`
- `js/app.js`
- `js/assistant.js`
- `js/ui.js`
- `sw.js`
- `voice_server/README_VOICE.md`
- `voice_server/RUN_VOICE_SERVER.bat`
- `voice_server/SETUP_WINDOWS.bat`
- `voice_server/requirements.txt`
- `voice_server/server/app.py`
- `voice_server/server/tts_engine.py`

## Arquivos criados

- `js/manualCoreService.js`
- `DELETE_OLD_AGENT_CORE_FILES_V0.12.txt`
- `PATCH_V0.12.0_MANUAL_CORE.md`

## Arquivos antigos a apagar

- `js/autonomousAgentService.js`
- `voice_server/server/agent_engine.py`
- `voice_server/CONFIGURE_AGENT_CORE.bat`
- `voice_server/.env.example`

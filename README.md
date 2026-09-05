# JORDAN V0.14 — AUTOMATION CORE / NATIVE CORE / MANUAL CORE V2.1

Atualização incremental sobre a V0.13.

A JORDAN continua tendo uma interface web/PWA, mas a V0.14 consolida o runtime nativo Tauri para Windows, Android e iOS. O objetivo é deixar de tratar ações como texto e começar a executá-las através de uma bridge com o sistema operacional.

## V0.14 em resumo

- `Manual Core V2.1`: melhora a separação entre conversa, perguntas, estado do sistema e ações.
- `Native Bridge`: JavaScript pode delegar tarefas ao Rust dentro do app.
- `Automation Core V1`: autoclique, mouse/teclado global no Windows, coordenadas e macros de voz locais.
- `open_app`: no app nativo, abre YouTube e outros serviços em uma janela/webview da JORDAN em vez de só devolver um link.
- `Local Reasoning Core`: usa um modelo on-device quando `LanguageModel` estiver disponível; continua sem OpenAI API.
- `General Knowledge / Safety Core`: corrige vários casos ruins observados nos testes manuais e bloqueia improvisação perigosa com fiação elétrica.
- Windows: tray + fechar para segundo plano + autostart.
- GitHub Actions: builds para Windows e Android; workflow iOS preparado para assinatura Apple.
- SYS: downloads Windows `.exe`, Android `.apk` e iPhone `.ipa` apontando para a Release mais recente.
- Cache PWA: `jordan-v0.14.0`.

## Compilar / publicar

Leia `NATIVE_APP_SETUP.md`.

Validação rápida:

```bash
npm install
npm run native:check
npm run build:web
```

Para criar uma release que alimente os botões de download dentro da própria JORDAN:

```bash
git tag v0.14.0
git push origin v0.14.0
```

## Voice Core

A voz Spark V2 local continua separada nesta etapa:

1. `voice_server/SETUP_WINDOWS.bat`
2. `voice_server/RUN_VOICE_SERVER.bat`
3. SYS > JORDAN VOICE CORE > TESTAR CONEXÃO

O Manual Core funciona mesmo sem o Voice Server. Uma evolução futura pode empacotar/substituir esse servidor por um motor nativo para eliminar o `.bat`.

## Firebase

Firebase, memória sincronizada, calendário, JORDAN ID, linhagem e mensagens continuam usando a arquitetura já existente. A migração para Tauri não refaz esses módulos.

## Segurança

As páginas remotas abertas no JORDAN Browser não recebem capability IPC. Somente a janela local `main` pode invocar os comandos nativos da JORDAN.

## Limites reais por sistema

Windows já consegue permanecer residente na bandeja. Android ainda precisa de Foreground Service para presença contínua fora da tela. iOS restringe background e não permite um app comum ficar executando/ouvindo indefinidamente sem usar modos de background permitidos pelo sistema.


## Automation Core V1

No Windows instalado, a JORDAN pode enviar entrada real de mouse e teclado usando o Native Core. O SYS permite escolher clique esquerdo/direito/meio, tecla ou combinação, intervalo em milissegundos e posição fixa X/Y.

Comandos de voz personalizados também ficam locais no dispositivo. Exemplo: cadastre `haki` -> tecla `j`; quando o áudio contínuo reconhecer exatamente `haki`, a ação é enviada uma vez e, por padrão, sem resposta falada para não atrapalhar jogos.

O autoclique tem parada manual e também entende `parar autoclick`. O intervalo mínimo é 25 ms para evitar loops acidentais extremos.

Android: toque global em outros apps é tecnicamente possível via `AccessibilityService` com autorização explícita do usuário, mas esse serviço móvel ainda não está embutido nesta build. iOS não oferece a um app comum uma API equivalente para injetar toques arbitrários em outros apps.

## Contexto V2.1

O Manual Core agora mantém clarificações estruturadas. Exemplo: se a JORDAN perguntar `Java ou Bedrock?` e você responder `eu jogo na Java`, ela guarda `Java` como resposta da pergunta anterior em vez de tratar `jogo java` como um assunto novo.

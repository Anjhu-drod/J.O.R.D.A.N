# JORDAN V0.13 — NATIVE CORE / MANUAL CORE V2 / SPARK V2 / CHESS

Atualização incremental sobre a V0.12.

A JORDAN continua tendo uma interface web/PWA, mas a V0.13 inaugura o runtime nativo Tauri para Windows, Android e iOS. O objetivo é deixar de tratar ações como texto e começar a executá-las através de uma bridge com o sistema operacional.

## V0.13 em resumo

- `Manual Core V2`: melhora a separação entre conversa, perguntas, estado do sistema e ações.
- `Native Bridge`: JavaScript pode delegar tarefas ao Rust dentro do app.
- `open_app`: no app nativo, abre YouTube e outros serviços em uma janela/webview da JORDAN em vez de só devolver um link.
- `Local Reasoning Core`: usa um modelo on-device quando `LanguageModel` estiver disponível; continua sem OpenAI API.
- `General Knowledge / Safety Core`: corrige vários casos ruins observados nos testes manuais e bloqueia improvisação perigosa com fiação elétrica.
- Windows: tray + fechar para segundo plano + autostart.
- GitHub Actions: builds para Windows e Android; workflow iOS preparado para assinatura Apple.
- SYS: downloads Windows `.exe`, Android `.apk` e iPhone `.ipa` apontando para a Release mais recente.
- Cache PWA: `jordan-v0.13.0`.

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
git tag v0.13.0
git push origin v0.13.0
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

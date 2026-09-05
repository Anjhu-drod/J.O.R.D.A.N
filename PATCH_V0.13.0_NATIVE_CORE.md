# JORDAN V0.13.0 — NATIVE CORE / TASK ENGINE

Patch incremental sobre a V0.12.0. Não refaz Firebase, calendário, memória, Voice Core, xadrez ou a interface-base.

## Objetivo

A V0.12 mostrou o limite de um assistente preso ao navegador: o Manual Core podia entender um comando, mas ações como abrir YouTube ainda dependiam de popup/link e o navegador não é um processo de sistema confiável para background contínuo.

A V0.13 cria a primeira camada nativa da JORDAN usando Tauri 2 e transforma o Manual Core em um planejador de tarefas que pode delegar ações ao Native Core.

## Bugs dos testes corrigidos

- `seu core está ligado?` agora consulta o estado real do Manual Core.
- `você está conectado à internet?` consulta o estado real de rede, em vez de definir o que é internet.
- perguntas elétricas perigosas, como juntar fios de chuveiro, passam por um Safety/Knowledge Core local e não recebem improvisação arriscada.
- `você conhece o mar?` recebe uma resposta sem converter `conhece` em assunto de contexto.
- `me cita três exercícios de peito` recebe exemplos locais.
- `como fazer farm de ferro no Minecraft` identifica a necessidade de saber Java/Bedrock/versão.
- perguntas fora das regras podem passar para um modelo local do próprio dispositivo quando `LanguageModel` estiver disponível.

## Ações reais

- `abra o YouTube`: no app nativo, abre um webview da própria JORDAN.
- `abra Spotify/GitHub/Maps/...`: usa o Native Bridge em vez de simplesmente escrever um link.
- música com fonte YouTube: abre a pesquisa no webview JORDAN.
- música com fonte Biblioteca JORDAN: continua tocando diretamente pelo player local existente.

## Native Core

Criado um projeto `src-tauri/` com:

- bridge Rust <-> JavaScript;
- detecção de plataforma;
- abrir URL em janela JORDAN;
- abrir URL externamente quando solicitado;
- minimizar, esconder e reabrir a janela principal;
- bandeja do sistema no desktop;
- autostart no desktop;
- fechar para a bandeja no Windows/desktop;
- proteção de capability: somente a janela `main` recebe IPC local.

## Builds

Criados workflows GitHub Actions:

- Windows x64 -> `JORDAN-Windows-x64-setup.exe`
- Android -> `JORDAN-Android-universal.apk`
- iOS -> `JORDAN-iOS.ipa` quando assinatura Apple estiver configurada

Os botões em SYS apontam para os arquivos da GitHub Release mais recente.

## Background

- Windows: background real por tray/autostart nesta versão.
- Android: runtime nativo pronto, mas ainda falta Foreground Service para assistência contínua fora da tela.
- iOS: segue as limitações reais de background do sistema; não promete escuta arbitrária permanente.

## Local Reasoning

Novo `LocalReasoningService` usa a API `LanguageModel` quando o runtime fornecer um modelo on-device. Nenhuma OpenAI API é usada. É uma camada opcional; Manual Core e ferramentas funcionam sem ela.

## Novos arquivos

- `.gitignore`
- `.github/workflows/build-native.yml`
- `.github/workflows/build-ios.yml`
- `NATIVE_APP_SETUP.md`
- `PATCH_V0.13.0_NATIVE_CORE.md`
- `package.json`
- `scripts/build-web.mjs`
- `scripts/check-native.mjs`
- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/icons/32x32.png`
- `src-tauri/icons/64x64.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/256x256.png`
- `src-tauri/icons/512x512.png`
- `src-tauri/icons/icon.ico`
- `src-tauri/icons/icon.icns`
- `js/nativeBridgeService.js`
- `js/localReasoningService.js`
- `js/generalKnowledgeService.js`

## Alterados

- `index.html`
- `sw.js`
- `css/styles.css`
- `js/app.js`
- `js/appLauncherService.js`
- `js/manualCoreService.js`
- `js/ui.js`
- `README.md`

## Arquivos removidos

Nenhum arquivo adicional é removido na V0.13.

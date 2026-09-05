# JORDAN V0.14.0 — AUTOMATION CORE

Patch incremental em cima da V0.13.0. O ZIP contém somente arquivos criados ou alterados.

## Objetivo

Transformar comandos como autoclique e atalhos de voz em ações reais do sistema operacional, mantendo o projeto local e sem API de IA.

## Windows — implementado

O Native Core agora possui um `AutomationRuntime` próprio. No Windows ele usa a API `SendInput` do `user32.dll` e suporta:

- clique esquerdo;
- clique direito;
- clique do meio;
- tecla simples;
- combinações como `ctrl+c`;
- posição fixa X/Y;
- captura da posição atual do cursor;
- repetição automática com intervalo configurável de 25 ms a 1 hora;
- contador de ações;
- parada imediata pelo SYS ou pelo comando `parar autoclick`.

Somente uma repetição global fica ativa por vez. Iniciar uma nova substitui a anterior.

## Comandos personalizados por voz

O SYS ganhou um editor de atalhos locais. Exemplo:

```text
frase: haki
ação: tecla
tecla: j
```

Com Áudio Contínuo ativo, ao reconhecer exatamente `haki`, a JORDAN envia `J` uma vez. Por padrão o atalho é silencioso para não interromper jogo/música com uma resposta falada.

Também é possível ensinar pela conversa:

```text
Jordan, quando eu disser haki aperte j
```

## Autoclique por conversa

Exemplos reconhecidos pelo Manual Core V2.1:

```text
Jordan, inicie autoclick mouse esquerdo a cada 100 ms
Jordan, inicie autoclick mouse direito a cada 1 segundo
Jordan, aperte j
Jordan, parar autoclick
```

## Android

A configuração X/Y já existe na interface e no formato de ação. Para tocar globalmente em outro aplicativo, Android exige um `AccessibilityService` autorizado pelo usuário. A V0.14 detecta essa situação e retorna `android-accessibility-service-required` em vez de fingir que clicou.

## iPhone

A JORDAN não afirma que consegue injetar toques globais no iOS. Um app comum não recebe uma API equivalente para controlar arbitrariamente a tela de outros aplicativos. No iPhone, automações futuras devem usar recursos permitidos pelo sistema, como App Intents/Shortcuts e ações dentro da própria JORDAN.

## Contexto corrigido

O Manual Core agora mantém clarificações estruturadas. Caso testado:

1. `como fazer farm de ferro no Minecraft`
2. JORDAN pergunta `Java ou Bedrock?`
3. `eu jogo na Java`
4. JORDAN entende que `Java` responde à pergunta anterior e pede somente a versão.
5. `1.21.4`
6. JORDAN continua o assunto já considerando `Minecraft Java 1.21.4`.

Isso corrige o comportamento visto no print em que `eu jogo na Java` virava um assunto novo.

## Arquivos criados

- `js/automationCoreService.js`
- `PATCH_V0.14.0_AUTOMATION_CORE.md`

## Arquivos alterados

- `index.html`
- `css/styles.css`
- `sw.js`
- `package.json`
- `README.md`
- `NATIVE_APP_SETUP.md`
- `scripts/check-native.mjs`
- `js/app.js`
- `js/ui.js`
- `js/nativeBridgeService.js`
- `js/manualCoreService.js`
- `js/generalKnowledgeService.js`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`

## Validações feitas

- `node --check` nos JavaScript alterados;
- `native:check` da estrutura Tauri;
- teste simulado do Automation Core: macro `haki -> J`, start/stop e captura de coordenada;
- teste sequencial do Manual Core com Minecraft Java + versão;
- teste do parser de autoclique `mouse direito a cada 100 ms`.

O ambiente usado para gerar o patch não possui `cargo/rustc`, então o Rust não foi compilado localmente aqui. O workflow Windows do GitHub Actions continua sendo a validação de compilação nativa real.

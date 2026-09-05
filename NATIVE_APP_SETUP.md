# JORDAN V0.13 — Native App Setup

A V0.13 adiciona uma camada nativa Tauri 2 sobre o frontend existente. O mesmo HTML/CSS/JS continua sendo a interface da JORDAN, mas agora pode chamar comandos Rust do sistema operacional.

## O que já muda no app nativo

- Windows: fechar a janela principal envia a JORDAN para a bandeja do sistema em vez de encerrar.
- Windows: opção de iniciar automaticamente com o sistema e já ficar em segundo plano.
- Windows/Android/iOS: o frontend consegue detectar que está dentro do runtime nativo.
- Pedidos como `abra o YouTube` deixam de ser apenas uma resposta com link. O Native Core abre a página em uma janela/webview da JORDAN.
- Pedidos de música que usam YouTube abrem a busca dentro da JORDAN; a Biblioteca JORDAN continua tocando os arquivos locais diretamente.
- A tela SYS ganhou botões para baixar Windows, Android e iPhone da GitHub Release mais recente.
- O Manual Core V2 ganhou respostas reais para estado do sistema e uma camada opcional de raciocínio local quando o runtime expõe `LanguageModel`.

## Arquitetura

```text
JORDAN UI (HTML/CSS/JS)
        |
        +-- Manual Core V2
        |      +-- agenda / memória / música / xadrez / pesquisa
        |      +-- General Knowledge / Safety Core
        |      +-- Local Reasoning Core (quando disponível)
        |
        +-- Native Bridge
               |
               +-- Rust / Tauri
                      +-- janelas nativas
                      +-- bandeja
                      +-- autostart
                      +-- abrir recursos externos
                      +-- futuras integrações de SO
```

## 1. Colocar os arquivos no GitHub

Substitua os arquivos alterados e adicione os arquivos novos do patch preservando as pastas.

Os arquivos `src-tauri/gen/`, `src-tauri/target/`, `node_modules/` e `dist/` NÃO devem ser enviados ao GitHub. Eles são gerados automaticamente e já estão no `.gitignore`.

## 2. Testar a estrutura

Com Node.js instalado, na raiz do projeto:

```bash
npm install
npm run native:check
npm run build:web
```

O segundo comando deve terminar com:

```text
JORDAN Native Core structure OK
```

## 3. Windows local

O build Windows precisa do Rust, Microsoft C++ Build Tools e WebView2.

Depois:

```bash
npm install
npm run native:windows
```

O instalador é gerado dentro de:

```text
src-tauri/target/release/bundle/nsis/
```

Não é necessário compilar no seu PC se você preferir usar GitHub Actions.

## 4. Android APK

Para build local, instale Android Studio/SDK/NDK e os targets Android do Rust. Depois:

```bash
npm install
npm run native:android:init
npm run native:android
```

Para facilitar, o patch já inclui `.github/workflows/build-native.yml`, que monta um APK debug instalável sem precisar de uma chave Android privada.

O arquivo publicado na release recebe exatamente este nome:

```text
JORDAN-Android-universal.apk
```

Para uma publicação definitiva na Play Store, depois troque o build debug por um build release assinado com seu keystore.

## 5. iPhone / IPA

A Apple exige build iOS em macOS/Xcode e assinatura válida para um IPA instalável. Por isso o patch usa um runner `macos-latest` do GitHub Actions: você não precisa ter um Mac local para o CI, mas precisa fornecer sua identidade de assinatura Apple.

No GitHub, abra:

```text
Repository > Settings > Secrets and variables > Actions
```

Crie estes `Secrets`:

```text
IOS_CERTIFICATE
IOS_CERTIFICATE_PASSWORD
IOS_MOBILE_PROVISION
APPLE_DEVELOPMENT_TEAM
```

Depois crie esta `Variable`:

```text
JORDAN_IOS_SIGNING = enabled
```

O workflow `.github/workflows/build-ios.yml` será liberado e tentará gerar:

```text
JORDAN-iOS.ipa
```

O workflow está configurado para exportação `debugging`, apropriada para desenvolvimento em aparelhos autorizados pelo perfil de provisionamento. Para distribuição ampla, migre para TestFlight/App Store Connect.

## 6. Fazer os downloads aparecerem dentro da própria JORDAN

Os botões no SYS usam os assets da `latest release` do repositório:

```text
JORDAN-Windows-x64-setup.exe
JORDAN-Android-universal.apk
JORDAN-iOS.ipa
```

Para criar uma Release automaticamente, envie uma tag, por exemplo:

```bash
git tag v0.13.0
git push origin v0.13.0
```

O workflow Windows/Android roda automaticamente para tags `v*`. O iOS também roda quando `JORDAN_IOS_SIGNING=enabled` e os Secrets Apple estiverem configurados.

Se você clicar em `Run workflow` manualmente, os builds ficam na aba Actions como artifacts, mas não viram `latest release` automaticamente. Para os botões internos funcionarem, use uma tag.

## 7. Segundo plano

### Windows

É o primeiro alvo com background real nesta versão:

- fechar a janela => esconde para a bandeja;
- `SEGUNDO PLANO` => esconde a janela;
- `INICIAR COM O SISTEMA` => registra autostart;
- no autostart, JORDAN recebe `--background` e inicia escondida.

### Android

O app nativo já existe e tem mais liberdade do que a página web, mas a V0.13 ainda não instala um Android Foreground Service. Isso é necessário para manter microfone/serviços realmente ativos por períodos longos quando o app sai da tela.

### iPhone

O iOS não permite transformar um app comum em um processo arbitrário sempre ativo e sempre ouvindo. Background precisa usar modos autorizados pelo sistema e justificados pela função do aplicativo. Portanto, a arquitetura nativa abre caminho para integração com notificações, áudio, localização e outras APIs permitidas, mas não deve fingir que pode ignorar as regras do iOS.

## 8. Local Reasoning Core

A V0.13 procura `globalThis.LanguageModel`. Se o navegador/runtime fornecer uma API de modelo local compatível, o botão `PREPARAR IA LOCAL` baixa/prepara o modelo e o Manual Core pode usá-lo para perguntas fora das regras fixas.

Se não houver `LanguageModel`, nada quebra: agenda, memória, comandos, música, xadrez, conhecimento local e Native Core continuam funcionando.

Essa camada é propositalmente opcional porque a disponibilidade varia entre navegadores, WebViews e hardware.

## 9. Segurança do Native Core

As webviews remotas abertas pela JORDAN, como YouTube, NÃO recebem a capability nativa da janela principal. Somente `main` possui o capability local. Isso impede uma página remota de herdar o canal IPC da JORDAN.

## Próxima etapa recomendada

Depois que Windows e Android estiverem gerando builds estáveis, a próxima evolução deve ser um `Background/Device Service` separado por plataforma:

- Windows: hotword/microfone + ações de arquivos/processos através do Rust;
- Android: Foreground Service + notificação persistente + wake-word;
- iOS: integração dentro dos background modes realmente permitidos pela Apple;
- voz: empacotar ou substituir o Voice Core Python por um motor nativo/sidecar para não depender de abrir o `.bat` manualmente.

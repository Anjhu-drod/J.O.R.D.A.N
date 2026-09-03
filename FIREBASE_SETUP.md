# JORDAN V0.7 — Firebase Setup

A V0.7 usa **Firebase Authentication + Cloud Firestore**.

- Login: e-mail/senha ou Google.
- Sessão: fica salva no dispositivo por padrão.
- Dados compartilhados: memórias, agenda e configurações.
- Offline: Firestore Persistent Local Cache.
- Reconexão: o SDK sincroniza automaticamente as escritas pendentes.
- JORDAN Music continua local porque os arquivos de áudio podem ser grandes.

## 1. Ativar Cloud Firestore

Firebase Console → projeto `jordan-a8722` → Build → Firestore Database → Create database.

Use Standard edition. Para uso no Brasil, escolha uma região próxima quando disponível.

## 2. Publicar as regras

Abra Firestore Database → Rules e cole o conteúdo do arquivo `firestore.rules` deste patch.

As regras garantem que um usuário autenticado só consiga ler/escrever em `users/{seuUid}/...`.

## 3. Ativar Email/Password

Firebase Console → Authentication → Sign-in method → Email/Password → Enable → Save.

## 4. Ativar Google

Firebase Console → Authentication → Sign-in method → Google → Enable.

Escolha o e-mail de suporte e salve.

## 5. Autorizar o GitHub Pages

Firebase Console → Authentication → Settings → Authorized domains.

Adicione o domínio do seu GitHub Pages, por exemplo:

`SEUUSUARIO.github.io`

Use somente o domínio, sem `https://` e sem o caminho do repositório.

## 6. Primeiro login

Abra a JORDAN com internet pelo menos uma vez, faça login e aguarde `CLOUD ONLINE`.

Na primeira execução desta versão, a JORDAN procura o banco antigo `JordanDB`. Se encontrar dados da V0.6.1 ou anteriores, ela:

1. envia agenda, memórias e configurações para a sua JORDAN ID;
2. espera as escritas chegarem ao Firestore;
3. marca a migração daquele dispositivo;
4. remove o banco antigo `JordanDB`.

O cache offline do Firestore continua existindo separadamente.

## 7. Teste de sincronização

1. Entre no PC.
2. Diga: `Eu gosto de Berserk`.
3. Espere `CLOUD ONLINE`.
4. Entre com a mesma conta no celular.
5. Abra MEM: a memória deve aparecer.
6. Desligue a internet no celular.
7. Crie outra memória ou compromisso.
8. O HUD deve indicar `OFFLINE MODE` ou `OFFLINE · PENDING`.
9. Ligue a internet e aguarde a sincronização automática.

## Observações

O objeto `firebaseConfig` do app Web identifica o projeto Firebase e fica no frontend. A segurança dos dados depende de Authentication + Firestore Security Rules.

O `databaseURL` do Realtime Database permanece no config porque veio do projeto Firebase, mas a V0.7 não usa Realtime Database como memória. A memória compartilhada usa Cloud Firestore.

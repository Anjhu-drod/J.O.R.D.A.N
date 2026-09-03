# JORDAN V0.7 — JORDAN ID / Cloud Memory Core

Patch incremental sobre a V0.6.1.

## Destaques

- Tela de login JORDAN ID totalmente redesenhada.
- Login com e-mail/senha.
- Login com Google.
- Sessão persistente: normalmente só é necessário entrar uma vez por dispositivo.
- Botão de logout em SYS.
- Cloud Firestore como fonte principal de agenda, memórias e configurações.
- Firestore Persistent Local Cache para continuar funcionando offline.
- Sincronização automática quando a internet volta.
- Indicadores `CLOUD ONLINE`, `SYNC PENDING` e `OFFLINE MODE`.
- Migração automática do antigo `JordanDB` para a conta Firebase.
- O banco antigo é apagado somente depois de confirmar o envio ao Firestore.
- Memória CORE do criador continua restaurada/protegida pela aplicação.
- O nome da conta JORDAN ID pode preencher `profile.name` na primeira inicialização.
- JORDAN Music continua local e offline; arquivos de áudio não são enviados ao Firestore.

Leia `FIREBASE_SETUP.md` antes de testar Google Login e sincronização.

## Firebase

Projeto configurado: `jordan-a8722`.

SDK Web usado por browser modules: Firebase JS `12.18.0`.

## Segurança

O patch inclui `firestore.rules`. Publique essas regras no Firebase Console antes de usar a versão em produção.

# JORDAN V0.9 — NEURAL VOICE / MULTI-DEVICE / CINEMATIC CORE

Patch incremental sobre a JORDAN V0.8.1.

## Destaques

- JORDAN Spark Neural V1 integrada como voz principal.
- `speechSynthesis` virou fallback, não mais a identidade principal.
- Voice Server Python/FastAPI incluído em `voice_server/`.
- Endpoint do Voice Core configurável por dispositivo em SYS.
- Mesma Firebase JORDAN ID em vários dispositivos simultaneamente.
- Vínculo opcional de Google + E-mail/Senha ao mesmo Firebase UID.
- Novo mapa `userIdentityClaims/{uid}` para recuperar a identidade rapidamente em aparelho novo.
- `browserLocalPersistence`: login permanece até usar SAIR.
- Novo boot cinematográfico ao entrar.
- Animação específica para conversa, calendário, música, pesquisa, navegação, ciência e sistema.
- Ripple em botões/toques, transições de views, varreduras, hexfield, equalizer e atividade extra do CORE.
- Layout adicional para tablet/celular pequeno.

## Firebase

**Publique o novo `firestore.rules` desta V0.9.** Sem isso, o mapa multidispositivo `userIdentityClaims` será negado pelo Firestore.

## Voice Core

Leia `VOICE_CORE_SETUP.md`.

No PC:

1. `voice_server/SETUP_WINDOWS.bat`
2. `voice_server/RUN_VOICE_SERVER.bat`
3. SYS > JORDAN VOICE CORE > TESTAR CONEXÃO

O padrão do PC é `http://127.0.0.1:8787`.

No celular use um endpoint HTTPS acessível pelo celular. A URL não é sincronizada entre aparelhos de propósito.

## Atualização

O Service Worker desta versão usa cache `jordan-v0.9.0`.

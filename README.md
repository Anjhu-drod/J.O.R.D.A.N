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

## V0.9.1 — Semantic + Offline + Presence Core

- Corrige fallback de voz no celular quando o Voice Core está apontando para localhost/127.0.0.1.
- Voice Lock com terceiros permitidos mantém conversa e conhecimento geral em rota read-only.
- Offline Knowledge Core: 16 disciplinas e mais de 150 conceitos locais, além de aritmética básica, porcentagem e raiz quadrada.
- Semantic Brain resolve relações como “meu nome” pelo contexto do usuário em vez de depender só de respostas prontas.
- Language Learning aprende palavras e regras ensinadas pelo chat; em voz, só pergunta palavra desconhecida quando a confiança do reconhecimento é alta.
- Presence Core: Boa noite = Sleep Mode; Bom dia = acordar; Socorro permanece disponível; Jordan silêncio = Silence Mode.
- Personalidade extrovertida deixa de repetir prompts aleatórios; só faz um check curto após silêncio e atividade de áudio recente.
- Creator Voice Lab: Jhuan pode ajustar speed/pitch/brightness/energy/expressiveness globalmente em `lineageConfig/voice`.
- Voice Server aceita tuning compartilhado.

Versão do cache PWA: `jordan-v0.9.1`.

# JORDAN V0.9.2 — REASONING REPAIR / MESSAGES / VOICE RELIABILITY

Projeto acumulado até a V0.9.2. Para atualização incremental, aplique o patch V0.9.2 sobre a V0.9.1.

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

## V0.9.2 — Reasoning Repair / Messages / Voice Reliability

Esta versão corrige o roteamento que fazia perguntas contextuais caírem na Wikipédia.

Principais mudanças:

- Semantic Brain passa a resolver primeiro usuário, JORDAN, memória, contexto e interface antes de consultar internet.
- Perguntas como “quem sou eu?”, “qual o seu nome?”, “onde eu moro?”, “qual idioma estou falando?” e “como acesso o calendário?” não viram pesquisa externa.
- Perguntas atuais dependentes de contexto, como “quem é o presidente do país?”, primeiro resolvem o país salvo do usuário.
- Offline Knowledge continua disponível e agora recebe prioridade antes da internet para perguntas compatíveis.
- Voice Identity V2 fica conservadora: uma única diferença de microfone não transforma o dono logado em terceiro.
- JORDAN Spark Neural permanece a voz oficial. A voz do dispositivo não é usada silenciosamente; contingência do dispositivo é opt-in.
- Nova aba MSG com mensagens individuais e broadcast para toda a linhagem.
- “Bom dia” gera briefing com agenda do dia e mensagens novas.
- Pedidos de música usam YouTube por padrão; “na biblioteca” força JORDAN Music. A fonte padrão pode ser alterada em SYS.
- Recorrências de calendário suportam diariamente, semanalmente, mensalmente e intervalos como “a cada 20 dias”. Se faltar a data inicial, JORDAN pergunta apenas a data de início e preserva o restante do pedido.
- Cache PWA: `jordan-v0.9.2`.

### Firestore

Publique novamente o `firestore.rules` desta versão. A coleção `lineageMessages` é nova e as mensagens são imutáveis para membros normais; cada usuário autenticado vê as próprias mensagens, broadcasts e mensagens enviadas. O creator mantém administração.

# JORDAN V0.6 — PATCH sobre a V0.5

Esta versão amplia a JORDAN como assistente geral, sem transformar o projeto em outro sistema do zero.

## Destaques

- Ordens básicas em português por verbo:
  - diga / fale / repita
  - pergunte
  - pesquise / procure / busque
  - toque / reproduza
  - cante
  - abra apps/sites conhecidos
  - como chegar / rota / me leve
  - perguntas reconhecidas de física e circuitos
- Player lateral integrado com Spotify via OAuth PKCE.
- Pesquisa de faixas pelo Spotify Web API e player incorporado na interface.
- Painel auxiliar lateral com MEDIA, RESEARCH, NAV e PHYSICS LAB.
- Rotas com GPS + Google Maps e geocodificação online.
- Abertura de YouTube, X, Instagram, Spotify, WhatsApp, TikTok, Discord, Reddit, GitHub, Maps e Gmail.
- Physics Lab offline:
  - Lei de Ohm
  - potência elétrica
  - resistores em série/paralelo
  - energia cinética
  - momento linear
  - força
  - estimativa hidrodinâmica didática para perguntas como corrida sobre água
- Pesquisa online explícita por “pesquise...”.
- Mais temas visuais:
  - Crimson Core
  - Eclipse
  - Sakura Protocol
  - Cursed Energy
  - Cyber Shinobi
- Novo HUD decorativo com caracteres, radar e painéis sci-fi.
- Reconhecimento de fala local experimental quando o navegador oferece SpeechRecognition on-device.
- Novos comandos de sistema em inglês:
  - Open the player
  - Open the research
  - Open the navigation
  - Open the lab
  - Close the panel

## Música e canto

A JORDAN não baixa nem copia letras integrais de músicas comerciais para reproduzi-las com a própria voz.

Quando você pede para tocar uma música, ela usa o player integrado com Spotify.

Quando você pede para cantar algo sem especificar uma obra comercial, ela usa um pequeno improviso original criado para a própria JORDAN e aplica uma prosódia de “canto” simples no SpeechSynthesis.

## Configurar Spotify

1. Entre em https://developer.spotify.com/dashboard
2. Crie um app.
3. Copie o Client ID.
4. No app do Spotify, adicione como Redirect URI exatamente a URL onde a JORDAN roda.

Exemplo GitHub Pages:

https://SEU-USUARIO.github.io/JORDAN/

Exemplo local:

http://127.0.0.1:5500/

Observação: o Spotify não aceita `localhost` como Redirect URI; use 127.0.0.1 no teste local.

5. Na JORDAN abra SYS > MÍDIA / PLAYER.
6. Cole o Client ID.
7. Clique SALVAR CLIENT ID.
8. Clique CONECTAR SPOTIFY.
9. Autorize a JORDAN.

Não existe Client Secret no frontend. A autenticação usa Authorization Code + PKCE.

## Exemplos

- Diga “boa noite, mundo”.
- Me pergunte alguma coisa.
- Pesquise buracos negros.
- Abra o YouTube.
- Toque Numb Linkin Park.
- Toque uma música qualquer.
- Cante alguma coisa.
- Como chegar no shopping?
- Me leve para o posto mais próximo.
- 12 volts e 6 ohms, qual é a corrente?
- Quanto dá 10 e 20 ohms em paralelo?
- Qual a velocidade uma pessoa de 105 quilos teria que correr para correr sobre a água?

## Offline

A interface, calendário, memória, histórias, parser de comandos e Physics Lab continuam disponíveis pelo cache PWA.

O reconhecimento de voz normal pode depender da internet em alguns navegadores. A V0.6 detecta a API experimental de reconhecimento local e oferece o botão PREPARAR PT-BR LOCAL quando houver suporte.

Pesquisa web, Spotify, geocodificação e rotas externas precisam de internet.

## Voz

A voz atual ainda usa SpeechSynthesis como base. Para ter exatamente a mesma voz da JORDAN em PC, iPhone e Android, o próximo passo correto é um motor neural próprio/original servido pela JORDAN API ou embarcado localmente. Não é possível garantir um timbre fixo entre aparelhos usando somente as vozes fornecidas por cada navegador.

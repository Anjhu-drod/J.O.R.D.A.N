# JORDAN V0.3 — Personality + Knowledge + Voice Upgrade

JORDAN é uma assistente pessoal web local feita com HTML, CSS e JavaScript puro. A V0.3 continua diretamente em cima da V0.2.

## Novidades da V0.3

### Voz
- silêncio para envio caiu de 3 s para 2 s
- seleção automática prioriza `Google` + `pt-BR` quando essa voz é exposta pelo navegador
- voz padrão mais rápida, leve e aguda
- prosódia por pontuação:
  - `!` = mais energia e pitch
  - `?` = final mais lento/agudo para simular entonação de pergunta
  - `...` = final mais lento
- clique baixo ao iniciar a escuta
- correção do caso em que um resultado provisório reconhece `Jordan`, mas o resultado final entrega apenas o resto do comando
- tocar no microfone/núcleo enquanto JORDAN fala interrompe a fala e começa a ouvir
- em modo contínuo, existe uma tentativa de *barge-in*: dizer `Jordan` enquanto ela fala pode interromper a resposta

> A Web Speech API usa as vozes que o navegador/sistema disponibiliza. Se `Google Português do Brasil` estiver disponível, ela recebe prioridade. A transformação jovem/infantil nesta versão é feita com pitch, velocidade e segmentação de frases; uma voz neural realmente customizada exigirá a etapa online/TTS.

### Personalidades
Padrão: **Extrovertida** + diálogo **informal**.

Disponíveis:
- Extrovertida
- Introvertida
- Equilibrada
- Brincalhona
- Profissional

Exemplos:
- `Jordan, seja extrovertida`
- `Jordan, seja introvertida`
- `Jordan, seja brincalhona`
- `Jordan, seja profissional`
- `Jordan, fale com gírias`
- `Jordan, fique mais formal`

A extrovertida e a brincalhona podem puxar assunto depois de um período sem interação.

### Horários ambíguos
De 1 até 6, se não houver período, JORDAN pergunta antes de marcar:

`Jordan, marque dentista amanhã às 6`

Resposta:

`Você quis dizer 6 da manhã ou 6 da noite?`

- 7 a 11 sem período → manhã
- 12 → meio-dia
- 13 a 23 → horário de 24 h normal
- `6 da noite` → 18:00
- `6 da manhã` → 06:00

### Ajuda rápida
`Jordan, ajuda`

Abre um painel com o número prioritário e um botão de ligação. A ligação **nunca começa automaticamente**.

Padrão: `190`.

Alterar:

`Jordan, defina meu número de ajuda como 999999999`

Consultar:

`Jordan, qual meu número de ajuda?`

Conhecimento local de números brasileiros:
- Polícia Militar: 190
- SAMU: 192
- Bombeiros: 193
- Central de Atendimento à Mulher: 180
- Direitos Humanos: 100
- Defesa Civil: 199

### Tutorial
O antigo conceito de “ajuda = lista de comandos” foi removido.

Agora use:

`Jordan, o que você pode fazer?`

Isso abre um painel visual com comandos de agenda, memória, personalidade, conversa, sistema e ajuda.

### Conhecimento local
Perguntas de sistema:
- `Aonde eu altero sua voz?`
- `Onde fica seu calendário?`
- `Como faço backup?`
- `Você tem internet?`

### Anime offline
A V0.3 recebeu um módulo local inicial com informações de:
- One Piece
- Naruto
- Hunter x Hunter
- Berserk
- Jujutsu Kaisen
- Demon Slayer
- Bleach
- Dragon Ball
- Attack on Titan
- Death Note
- Solo Leveling

Exemplos:
- `Qual é a fruta do Luffy?`
- `Por que o Pain não reviveu o Jiraiya?`
- `Qual é a história do Gon?`
- `Quais são os poderes do Gojo?`
- `Fala sobre Guts`
- `Quem venceria Goku ou Luffy?`

Esse módulo é deliberadamente offline. Ele não consegue conhecer literalmente todo anime nem fatos novos. A próxima fase planejada é acesso à internet/IA.

### Histórias
- `Jordan, vou te contar uma história`
- fale a história na próxima resposta
- JORDAN guarda uma versão anonimizada na memória
- ao recontar, tenta substituir primeira pessoa e nomes por referências como `uma pessoa`

Também existem histórias curtas internas inspiradas em resumos de anime.

Comandos:
- `Jordan, conte uma história`
- `Jordan, conte uma história que eu te contei`

## Teste recomendado

1. Rode via Live Server ou GitHub Pages.
2. Faça hard refresh depois do deploy (`Ctrl + F5`).
3. Teste voz:
   - `Jordan ajuda`
   - `Jordan, qual o número da polícia?`
   - `Jordan, aonde eu altero sua voz?`
4. Teste interrupção:
   - peça uma resposta longa sobre Gon
   - enquanto ela fala, toque no microfone
   - dê outro comando
5. Ative `MODO JORDAN` e tente dizer `Jordan` durante uma resposta.
6. Teste horário ambíguo:
   - `Jordan, marque dentista amanhã às 6`
   - responda `da noite`
   - confirme a duração
7. Teste personalidades.
8. Teste `Jordan, o que você pode fazer?`.
9. Teste histórias.

## Arquivos criados na V0.3
- `js/knowledgeBase.js`
- `js/personalityService.js`
- `js/storyService.js`

## Principais arquivos alterados
- `index.html`
- `css/styles.css`
- `js/app.js`
- `js/assistant.js`
- `js/dateParser.js`
- `js/ui.js`
- `js/voice.js`
- `sw.js`
- `README.md`

## Arquivos mantidos sem alteração funcional nesta versão
- `js/calendarService.js`
- `js/db.js`
- `js/eventProfiles.js`
- `js/memoryService.js`
- `js/reminderService.js`
- `js/utils.js`
- `manifest.webmanifest`
- `assets/jordan-symbol.png`
- `assets/icon-192.png`
- `assets/icon-512.png`

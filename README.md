# JORDAN V0.4 — PATCH para V0.3

Este pacote contém SOMENTE arquivos criados ou alterados em relação à JORDAN V0.3.

## Como atualizar no GitHub

1. Abra o ZIP.
2. Copie as pastas/arquivos mantendo exatamente os mesmos caminhos.
3. Arquivos marcados como ALTERADOS devem substituir os antigos.
4. Arquivos marcados como CRIADOS devem ser adicionados.
5. Não apague os demais arquivos da V0.3.
6. Depois do deploy no GitHub Pages, faça Ctrl + F5 no PC. No celular/PWA, feche e abra novamente para o Service Worker atualizar o cache.

## ALTERADOS

- index.html
- css/styles.css
- js/app.js
- js/assistant.js
- js/dateParser.js
- js/knowledgeBase.js
- js/ui.js
- js/voice.js
- sw.js
- README.md

## CRIADOS

- js/internetService.js
- js/languageService.js
- js/locationService.js
- js/mediaService.js
- js/semanticLexicon.js

## Principais mudanças da V0.4

### Internet
- InternetService integrado.
- Pesquisa pública via Wikipedia sem API key.
- Alternância de internet em SYS.
- Links de fonte aparecem no chat.
- O fallback online só acontece depois dos handlers locais e do fallback semântico.

### Idiomas
- Português, inglês, espanhol e japonês.
- Modo automático e modos manuais em SYS.
- O reconhecimento usa até 5 alternativas fornecidas pelo navegador.
- O idioma detectado influencia a próxima rodada do microfone e a voz de resposta.

### Correção de reconhecimento
- Correções contextuais para nomes de anime.
- Exemplos: Lucy/Luci/Lufi -> Luffy, Zorro -> Zoro, Narto -> Naruto, Sasuki -> Sasuke.
- Variações comuns de “Jordan” também são tratadas como wake word.

### Conversa / memória
- Ao ensinar anime favorito, a personalidade extrovertida/brincalhona pergunta o personagem favorito.
- Personagem favorito também é salvo.
- JORDAN tenta responder com uma curiosidade local; se não souber e a internet estiver ativa, tenta pesquisar.

### Localização
- Busca sob demanda de posto de combustível, farmácia, hospital, supermercado e restaurante.
- Usa GPS somente quando solicitado.
- Usa OpenStreetMap/Overpass para encontrar locais próximos.
- Retorna links de mapa.

### Mídia
- Prepara buscas no YouTube Music, Spotify ou YouTube.
- Provedor padrão pode ser escolhido em SYS.
- Esta versão abre a busca; controle direto da reprodução virá com integração de API/autenticação.

### Semantic Lexicon
- Mais de 2.000 entradas semânticas.
- Inclui cerca de 1.000 valores numéricos e centenas de termos/aliases.
- Fallback por conceitos como ASK, USER, HAVE, GREET_PERSON, LOCATION, NEAR, ANIME e MUSIC.
- É usado somente depois dos handlers específicos.

## Internet no GitHub Pages

Para a internet básica desta versão não é necessário criar chave de API.

1. Publique no GitHub Pages.
2. Use HTTPS.
3. Abra SYS.
4. Confirme que INTERNET CORE está ativa.
5. Teste:
   - Jordan, quem foi Nikola Tesla?
   - Hi Jordan, who is Alan Turing?
   - Hola Jordan, quién es Messi?
   - Jordan, qual a farmácia mais próxima?

Para IA avançada, Spotify controlável e serviços com chaves privadas, a próxima etapa deve usar um backend JORDAN API. Nunca coloque chaves secretas diretamente no JavaScript público do GitHub Pages.

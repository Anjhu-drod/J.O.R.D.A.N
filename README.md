# JORDAN V0.5 — Voice / Manual Language / English System Control

Patch incremental sobre a V0.4.

## Regras desta versão

- Conversa padrão: Português do Brasil.
- Troca de idioma: somente manual em SYS (PT-BR / EN-US / ES / JA).
- Áudio contínuo: ligado por padrão.
- Com áudio contínuo ligado não é necessário dizer “Jordan”. Após ~2 s de silêncio a frase é enviada.
- Comandos que alteram o sistema são frases curtas em inglês.
- Variações aceitas são deliberadamente pequenas para evitar comandos acidentais.
- Cada comando de sistema aparece em SYS com botão de pronúncia.
- Criador da JORDAN: Jhuan, pronunciado “Ruan”. Esta memória é CORE e protegida.

## Voz

A V0.5 cria o perfil ORIGINAL `JORDAN Spark · PT-BR`: jovem, agudo, rápido e expressivo, com prosódia controlada por script para perguntas, exclamações e diferentes estados emocionais.

Importante: esta versão ainda usa `SpeechSynthesis` como fonte do timbre-base. Por isso o timbre pode variar entre Windows, iPhone e Android. O script controla ritmo, pitch, entonação, segmentação e emoção, mas não consegue fabricar sozinho um timbre neural humano idêntico em todos os aparelhos. Para isso, o próximo passo é integrar um modelo TTS neural próprio/licenciado, local ou pela JORDAN API.

## Comandos do sistema

Principais frases:

- Open the audio
- Turn off the audio
- Shut up
- Open the calendar
- Open the memory
- Open the settings
- Go home
- Open the tutorial
- Turn on the internet
- Turn off the internet
- Mute the voice
- Unmute the voice
- Volume up
- Volume down
- Clear the chat

No SYS, cada frase possui descrição, aproximação de pronúncia e botão `PRONÚNCIA`.

## Atualização do GitHub

Este update deve ser distribuído como patch. Substitua os arquivos ALTERADOS e adicione os CRIADOS, mantendo todos os outros arquivos da V0.4.

Após o deploy:

1. Faça `Ctrl + F5` no PC.
2. No celular/PWA, feche e abra novamente.
3. O Service Worker usa o cache `jordan-v0.5.0`.
4. Na primeira abertura desta versão, o áudio contínuo é migrado para ligado uma única vez. Depois, a escolha do usuário passa a ser respeitada.

## Segurança de chaves

Nunca coloque API keys privadas diretamente no JavaScript publicado no GitHub Pages. Serviços com segredos (IA privada, Spotify controlável, TTS neural pago etc.) devem passar pela futura JORDAN API/backend.

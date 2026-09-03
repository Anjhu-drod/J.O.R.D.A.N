# JORDAN V0.6.1 — JORDAN Music

Correção incremental feita em cima da V0.6.

## Correção principal

A integração do Spotify foi removida do player. A JORDAN agora possui uma biblioteca e um player próprios chamados **JORDAN Music**.

## Como funciona o JORDAN Music

1. Abra `SYS`.
2. Em `JORDAN MUSIC`, clique em `+ ADICIONAR MÚSICAS`.
3. Selecione arquivos de áudio do seu PC/celular.
4. Os arquivos são salvos no IndexedDB do próprio navegador/dispositivo.
5. Abra o painel `MEDIA` para ver biblioteca, player, volume, progresso, shuffle e repeat.
6. Você também pode falar/escrever:
   - `Toque uma música qualquer.`
   - `Toque Numb.`
   - `Toque uma música do Kamaitachi.`

A pesquisa acontece na biblioteca local. Se a faixa não estiver importada, a JORDAN avisa em vez de abrir Spotify/YouTube automaticamente.

### Nome dos arquivos

Para organizar automaticamente artista e título, prefira:

`Artista - Música.mp3`

Exemplo:

`Linkin Park - Numb.mp3`

## Controles do player

- Play/Pause
- Próxima
- Anterior
- Shuffle
- Repeat off / all / one
- Volume
- Timeline / seek
- Favorita
- Busca na biblioteca

Quando a JORDAN fala, a música abaixa temporariamente para a voz ficar clara e volta ao volume anterior ao terminar.

## Comandos de sistema em inglês adicionados

- `Pause the music`
- `Play the music`
- `Next track`
- `Previous track`
- `Shuffle the music`

Eles aparecem automaticamente na lista de comandos do SYS com o botão de pronúncia.

## Importante sobre armazenamento

A biblioteca é local por dispositivo/navegador. Músicas importadas no PC não aparecem automaticamente no iPhone. Sincronização entre aparelhos deve ser feita futuramente pela JORDAN API, mas arquivos musicais grandes devem ter uma estratégia separada para não sobrecarregar o servidor.

O navegador também pode limitar ou limpar armazenamento local em certas situações. Mantenha os arquivos originais guardados no aparelho.

## Arquivo que deve ser APAGADO da V0.6

`js/spotifyService.js`

Ele não é mais importado nem usado.

## Bug da V0.6 corrigido

Alguns blocos adicionados à V0.6 ficaram com sequências literais `\\n` dentro de `app.js` e `voice.js`. Esses trechos foram restaurados para quebras de linha reais.

## Cache

Service Worker:

`jordan-v0.6.1`

# JORDAN V0.12 — Spark V2 Local / Manual Core

A V0.12 separa completamente o cérebro da voz.

- **Manual Core**: roda dentro do navegador. Não usa API, chave, Python ou servidor.
- **JORDAN Spark V2**: voz local opcional, servida pelo `voice_server/`.
- **Fallback do dispositivo**: continua disponível se o Voice Core não estiver aberto.

## Manual Core

Não existe instalação do cérebro. Depois de publicar os arquivos da V0.12 e recarregar a página, abra `SYS > JORDAN MANUAL CORE`.

O status correto é:

`JORDAN MANUAL CORE V1.0 · LOCAL · READY`

O botão `TESTAR MANUAL CORE` roda testes locais de interpretação, cálculo, xadrez, localização e contexto. Ele não faz chamada externa.

## Spark V2 no Windows

Se quiser a voz neural local:

1. Instale Python 3.11 ou 3.12.
2. Execute `voice_server/SETUP_WINDOWS.bat`.
3. Execute `voice_server/RUN_VOICE_SERVER.bat`.
4. Na JORDAN, abra `SYS > JORDAN VOICE CORE` e clique em `TESTAR CONEXÃO`.

O padrão no PC continua sendo `http://127.0.0.1:8787`.

Nenhuma `OPENAI_API_KEY` é necessária.

## Como a Spark V2 funciona

A voz usa Kokoro local, mistura de embeddings definida em `voice_server/config/voice_recipe.json` e pós-processamento de prosódia para speed, pitch, brightness, energy e expressiveness.

Os arquivos `jordan_spark_v2_<emotion>.pt` ficam em `voice_server/model/`. O setup tenta construí-los antecipadamente; se algum estiver faltando, o Voice Core tenta reconstruí-lo quando a voz for usada.

No Windows, o Kokoro pode precisar do eSpeak NG para pronúncia/fonética.

## Endpoints do Voice Core

- `GET /health`
- `POST /speak`

O Manual Core não possui endpoint porque ele roda diretamente no navegador.

## Celular

O Manual Core funciona normalmente no celular sem servidor. Para usar a Spark V2 do PC em outro aparelho, o Voice Core precisa estar exposto em um endereço HTTPS acessível por esse aparelho. Caso contrário, ative a contingência de voz do dispositivo.

# JORDAN V0.9 — Voice Core Setup

A V0.9 usa a voz própria **JORDAN Spark Neural V1** sempre que o Voice Server estiver disponível. O sintetizador do navegador fica apenas como fallback.

## PC — primeira configuração

1. Abra a pasta `voice_server`.
2. Instale Python 3.11 ou 3.12.
3. Instale eSpeak NG 64-bit no Windows.
4. Execute `voice_server/SETUP_WINDOWS.bat`.
5. A primeira execução baixa o Kokoro-82M e gera os embeddings da JORDAN.
6. Execute `voice_server/RUN_VOICE_SERVER.bat`.
7. O servidor ficará em `http://127.0.0.1:8787`.
8. Na JORDAN, abra `SYS > JORDAN VOICE CORE` e clique em `TESTAR CONEXÃO`.

## Celular

`127.0.0.1` no celular significa **o próprio celular**, não o PC. Para usar a mesma voz no celular, o Voice Server precisa estar em um endereço HTTPS acessível pelo aparelho.

No `SYS > JORDAN VOICE CORE`, cole o endpoint HTTPS do servidor e salve. O endpoint fica salvo somente naquele dispositivo, porque PC e celular podem usar endereços diferentes.

## Fallback

Se o Voice Server estiver desligado ou sem conexão:

1. JORDAN tenta o Voice Core neural.
2. Falhou? Usa `speechSynthesis` do navegador.
3. A assistente continua funcionando normalmente.

## API

- `GET /health`
- `POST /speak`

Exemplo:

```json
{
  "text": "Oi Jhuan! Eu sou a JORDAN. Pronta?",
  "emotion": "auto"
}
```

Emoções suportadas: `auto`, `neutral`, `happy`, `excited`, `curious`, `playful`, `surprised`, `serious`, `concerned`, `soft`, `whisper`, `annoyed`.

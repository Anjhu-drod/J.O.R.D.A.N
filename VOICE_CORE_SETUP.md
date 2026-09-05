# JORDAN V0.11 — Spark V2 / Voice Core Setup

A V0.11 usa a identidade vocal **JORDAN Spark V2**. Ela foi redesenhada para soar feminina jovem-adulta, luminosa, rápida, carismática e muito expressiva, mas sem copiar uma personagem, dubladora ou pessoa real.

A identidade é original, porém o sintetizador não foi treinado neuralmente do zero: no modo `auto`, o JORDAN Core prioriza o TTS neural configurado no `.env` e mantém o Kokoro local como contingência. Treinar um modelo acústico literalmente do zero exigiria um dataset de gravações próprio/licenciado.

## Windows — primeira configuração

1. Instale Python 3.11 ou 3.12.
2. Execute `voice_server/SETUP_WINDOWS.bat`.
3. Execute `voice_server/CONFIGURE_AGENT_CORE.bat` e informe sua `OPENAI_API_KEY`.
4. Execute `voice_server/RUN_VOICE_SERVER.bat`.
5. Na JORDAN, abra `SYS > JORDAN VOICE CORE` e clique em `TESTAR CONEXÃO`.
6. Em `SYS > JORDAN AUTONOMOUS AGENT CORE`, clique em `TESTAR AGENT CORE`.

O padrão no PC é `http://127.0.0.1:8787`.

## Como a Spark V2 escolhe a voz

No arquivo privado `voice_server/.env`:

```env
JORDAN_TTS_PROVIDER=auto
JORDAN_TTS_MODEL=gpt-4o-mini-tts
JORDAN_TTS_VOICE=coral
```

- `auto`: tenta a voz neural cloud; se falhar, usa a Spark V2 local.
- `openai`: prioriza a voz neural cloud e ainda tenta o local se a síntese falhar.
- `local`: força o núcleo Kokoro local.

A contingência do dispositivo no SYS é a última camada, usada quando o JORDAN Core inteiro não consegue entregar áudio.

## Fallback local

O fallback local usa Kokoro e embeddings `jordan_spark_v2_<emotion>.pt`. O servidor consegue construí-los na primeira fala, mas `SETUP_WINDOWS.bat` tenta preconstruí-los para reduzir a primeira espera.

No Windows, o núcleo local pode depender do eSpeak NG. A parte cloud não depende dele.

## Celular

`127.0.0.1` no celular é o próprio celular. Para usar o mesmo JORDAN Core em outro aparelho, publique/encaminhe o servidor por um endpoint HTTPS acessível ao aparelho e salve essa URL em `SYS > JORDAN VOICE CORE`.

## Endpoints

- `GET /health`
- `POST /speak`
- `GET /agent/health`
- `GET /agent/diagnose`
- `POST /agent/turn`

Emoções suportadas: `auto`, `neutral`, `happy`, `excited`, `curious`, `playful`, `surprised`, `serious`, `concerned`, `soft`, `whisper`, `annoyed`.

# JORDAN Spark V2 — Local Voice Core

A Spark V2 é a identidade vocal original da JORDAN. A direção artística é feminina jovem-adulta, clara, brilhante, rápida, espontânea e expressiva, sem copiar personagem, dubladora, celebridade ou pessoa real.

Na V0.12 a voz não depende de OpenAI API. O servidor usa somente o núcleo local Kokoro + embeddings Spark V2 + pós-processamento de prosódia.

## Instalação

1. Execute `SETUP_WINDOWS.bat`.
2. Execute `RUN_VOICE_SERVER.bat`.
3. Abra `http://127.0.0.1:8787/health`.

O cérebro **Manual Core** não depende deste servidor; ele roda no navegador mesmo com o BAT fechado.

## Embeddings locais V2

`model/` recebe arquivos como:

- `jordan_spark_v2_neutral.pt`
- `jordan_spark_v2_happy.pt`
- `jordan_spark_v2_excited.pt`
- `jordan_spark_v2_curious.pt`
- `jordan_spark_v2_playful.pt`
- `jordan_spark_v2_serious.pt`

Os `.pt` podem ser reconstruídos. Para reconstruir manualmente:

```bat
python scripts\build_voice.py
```

## Ajustes

A direção vocal fica em `config/voice_recipe.json`. O Creator Voice Lab do site aplica `speed`, `pitch`, `brightness`, `energy` e `expressiveness` no runtime.

## Limitação técnica

A Spark V2 é uma identidade vocal original por voice design e direção de TTS. Não é um modelo acústico treinado literalmente do zero com horas de gravação próprias. Um modelo totalmente exclusivo exigiria um dataset próprio/licenciado e treinamento ou fine-tuning apropriado.

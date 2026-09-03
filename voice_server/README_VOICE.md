# JORDAN VOICE V1 — JORDAN Spark

Este pacote cria uma **identidade vocal original** para a JORDAN, com direção artística feminina, jovem, brilhante, rápida, carismática e muito expressiva.

A inspiração é a energia juvenil e brincalhona que você descreveu. **Não é uma cópia exata da voz de Mabel, nem da dubladora.** O objetivo é uma voz própria da JORDAN.

## O que é este pacote

Ele usa o modelo open-weight **Kokoro-82M** como sintetizador e cria embeddings próprios chamados:

- `jordan_spark_v1_neutral.pt`
- `jordan_spark_v1_happy.pt`
- `jordan_spark_v1_excited.pt`
- `jordan_spark_v1_curious.pt`
- `jordan_spark_v1_playful.pt`
- `jordan_spark_v1_surprised.pt`
- `jordan_spark_v1_serious.pt`
- `jordan_spark_v1_concerned.pt`
- `jordan_spark_v1_soft.pt`
- `jordan_spark_v1_whisper.pt`
- `jordan_spark_v1_annoyed.pt`

Esses arquivos são gerados de forma reproduzível a partir de uma mistura ponderada de embeddings do Kokoro. Assim a JORDAN mantém uma identidade consistente e não depende da voz do Windows/iPhone/Android.

## Importante

O ZIP não inclui os 327 MB dos pesos base do Kokoro. Na primeira execução, o Kokoro/Hugging Face baixa os pesos e as vozes necessárias. Depois disso, o uso local pode funcionar com os arquivos em cache.

## Windows — passo a passo

1. Instale **Python 3.11 ou 3.12**.
2. Instale **eSpeak NG 64-bit** pelo release oficial:
   https://github.com/espeak-ng/espeak-ng/releases
3. Extraia este ZIP.
4. Execute:
   `SETUP_WINDOWS.bat`
5. Aguarde. A primeira execução baixa dependências e o modelo.
6. Quando terminar, abra `samples/`.
7. Ouça os WAVs.
8. Para iniciar o servidor:
   `RUN_VOICE_SERVER.bat`

Servidor:
`http://127.0.0.1:8787`

Teste:
`http://127.0.0.1:8787/health`

## API

POST `/speak`

JSON:
```json
{
  "text": "Oi Jhuan! Eu sou a JORDAN. Pronta?",
  "emotion": "auto"
}
```

Retorno: `audio/wav`.

Emoções:
`auto`, `neutral`, `happy`, `excited`, `curious`, `playful`, `surprised`, `serious`, `concerned`, `soft`, `whisper`, `annoyed`.

## Como a personalidade é construída

A identidade é majoritariamente PT-BR (`pf_dora`) e recebe pequenas contribuições de outros embeddings femininos permissivos do mesmo ecossistema Kokoro. O resultado é processado com:

- velocidade por emoção
- elevação moderada de pitch
- brilho/presença
- ganho dinâmico
- subida no final de perguntas
- energia adicional em exclamações
- pausas diferentes para `.`, `!`, `?` e `...`

O objetivo é uma jovem adulta/adolescente aparente, não uma criança pequena.

## Pronúncia

Edite:

`config/pronunciation.json`

Exemplo:

```json
"Jhuan": "Ruan"
```

O texto visual pode continuar como `Jhuan`; somente o texto enviado ao TTS é adaptado.

## Ajustar a voz

Edite:

`config/voice_recipe.json`

Os campos mais úteis são:

- `identity_mix`
- `emotion_mix`
- `speed`
- `pitch_semitones`
- `gain`
- `brightness`

Depois execute novamente:

`python scripts/build_voice.py`

e gere os samples:

`python scripts/generate_samples.py`

## Integração futura com JORDAN

O arquivo:

`integration/jordanTTSService.js`

já é a primeira camada para substituir o `speechSynthesis` da JORDAN.

Na próxima etapa, integramos isso ao `voice.js` da JORDAN V0.8.x e deixamos o `speechSynthesis` apenas como fallback.

## Licença/base

Kokoro-82M é disponibilizado com pesos Apache-2.0 segundo o model card oficial. Verifique também as notas/licenças do repositório e de qualquer voz-base antes de redistribuir o pacote final.

## Limitação honesta

Isto cria uma **nova identidade vocal reproduzível por voice design**, mas não é um treinamento neural completo "do zero" com horas de gravação próprias. Se você quiser uma voz ainda mais exclusiva no futuro, podemos usar esta V1 como protótipo e depois treinar/fine-tunar um modelo com gravações próprias/licenciadas.

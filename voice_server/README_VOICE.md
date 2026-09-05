# JORDAN Spark V2

A Spark V2 é a nova identidade vocal da JORDAN. A direção artística é feminina jovem-adulta, clara, brilhante, rápida, espontânea, inteligente e altamente expressiva. A referência de energia pode lembrar uma protagonista de animação muito animada, mas **a voz não tenta copiar nenhuma personagem, dubladora, celebridade ou pessoa real**.

## Arquitetura híbrida

O Voice Core V2 tem duas rotas:

1. **Neural cloud** — usada em `JORDAN_TTS_PROVIDER=auto` quando existe uma `OPENAI_API_KEY` válida.
2. **Spark Local** — Kokoro como contingência, com embeddings próprios V2 e pós-processamento de prosódia.

Se a cloud falhar no meio de uma fala e o núcleo local estiver disponível, o servidor tenta o local em vez de deixar a JORDAN muda.

## Embeddings locais V2

`model/` recebe arquivos como:

- `jordan_spark_v2_neutral.pt`
- `jordan_spark_v2_happy.pt`
- `jordan_spark_v2_excited.pt`
- `jordan_spark_v2_curious.pt`
- `jordan_spark_v2_playful.pt`
- `jordan_spark_v2_serious.pt`
- e as demais emoções definidas em `config/voice_recipe.json`.

Os `.pt` são ignorados pelo Git e podem ser reconstruídos. O servidor também faz auto-repair quando um deles estiver faltando.

## Instalação

1. Execute `SETUP_WINDOWS.bat`.
2. Execute `CONFIGURE_AGENT_CORE.bat`.
3. Execute `RUN_VOICE_SERVER.bat`.
4. Abra `http://127.0.0.1:8787/health` para verificar o Core.

## Ajustes

A direção vocal fica em `config/voice_recipe.json`. O Creator Voice Lab do site continua aplicando `speed`, `pitch`, `brightness`, `energy` e `expressiveness` no runtime.

Para reconstruir manualmente os embeddings locais:

```bat
python scripts\build_voice.py
```

## Limitação técnica

A Spark V2 é uma **identidade vocal original por voice design e direção de TTS**. Não é um modelo acústico treinado literalmente do zero com horas de gravação próprias. Para chegar nesse nível de exclusividade, o próximo passo futuro seria gravar um dataset próprio/licenciado e treinar/fine-tunar um modelo apropriado.

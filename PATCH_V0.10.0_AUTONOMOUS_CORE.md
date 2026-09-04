# JORDAN V0.10.0 — Autonomous Agent Core + Voice Self-Repair

Patch incremental sobre a V0.9.2. Não refaz Player/Cloud/Calendar/Memory/Voice Lock nem remove os handlers antigos: o novo Agent Core fica acima deles e usa os serviços existentes como ferramentas.

## O que mudou

### 1. Cérebro autônomo real

Quando `OPENAI_API_KEY` está configurada no `voice_server/.env`, a conversa principal passa pelo **JORDAN Autonomous Agent Core**.

Ele recebe contexto do dispositivo e pode escolher ferramentas reais para:

- ler/criar/remover eventos do calendário;
- pesquisar/salvar/esquecer memórias não protegidas;
- ler/enviar mensagens da linhagem;
- abrir apps/sites cadastrados;
- abrir telas internas da JORDAN;
- procurar locais próximos;
- preparar rotas;
- usar pesquisa web atual;
- delegar capacidades antigas especializadas sem transformar a conversa normal em respostas prontas.

Se o Agent Core estiver desligado, sem chave, sem servidor ou der erro, a JORDAN volta automaticamente ao cérebro local da V0.9.2.

### 2. Continuidade de conversa

O navegador mantém o `response_id` do Agent Core. Assim referências de conversa como “isso”, “amanhã”, “o segundo”, “faz igual” e perguntas seguintes podem usar o histórico em vez de serem tratadas como frases isoladas.

O botão **REINICIAR CONTEXTO** apaga apenas esse contexto temporário do modelo. Calendário e memórias persistentes NÃO são apagados.

### 3. Voz que se autorrepara

O ZIP da V0.9.2 veio com `voice_server/model/` sem os arquivos `.pt`. Antes, `/health` podia dizer que o servidor estava online e `/speak` falhava depois.

Agora o `tts_engine.py`:

- detecta embeddings de emoção ausentes;
- baixa as vozes-base necessárias quando houver internet;
- reconstrói o embedding da JORDAN Spark usando `voice_recipe.json`;
- grava o `.pt` gerado em `voice_server/model/` para os próximos usos;
- expõe no `/health` se a voz já está pronta ou se entrará em auto-repair.

O timeout da primeira síntese foi ampliado porque o primeiro reparo pode precisar baixar recursos. Respostas longas também são divididas em blocos naturais antes de chegar ao endpoint, evitando a antiga falha acima de 1600 caracteres.

### 4. Contingência de voz

A contingência de `speechSynthesis` passa a vir ligada por padrão em instalações novas. JORDAN Spark continua sendo a voz oficial; a voz do dispositivo só evita silêncio quando o Voice Core não consegue falar.

## Como ativar o cérebro autônomo

1. Substitua no GitHub somente os arquivos deste patch, mantendo as pastas.
2. No PC do JORDAN Core, rode novamente `voice_server/SETUP_WINDOWS.bat` para instalar a dependência `openai`.
3. Execute `voice_server/CONFIGURE_AGENT_CORE.bat`.
4. Cole sua `OPENAI_API_KEY`.
5. Execute `voice_server/RUN_VOICE_SERVER.bat`.
6. Na JORDAN abra `SYS > JORDAN AUTONOMOUS AGENT CORE` e toque em **TESTAR AGENT CORE**.
7. Se o front estiver no celular, o endpoint do JORDAN Core precisa ser HTTPS e acessível por ele, exatamente como já era necessário para a voz neural.

A chave fica em `voice_server/.env`. Esse arquivo está no `.gitignore` e NÃO deve ser enviado ao GitHub.

## Arquivos ALTERADOS

- `index.html`
- `sw.js`
- `js/app.js`
- `js/ui.js`
- `js/voice.js`
- `js/jordanTTSService.js`
- `voice_server/server/app.py`
- `voice_server/server/tts_engine.py`
- `voice_server/requirements.txt`
- `voice_server/RUN_VOICE_SERVER.bat`

## Arquivos CRIADOS

- `js/autonomousAgentService.js`
- `voice_server/server/agent_engine.py`
- `voice_server/CONFIGURE_AGENT_CORE.bat`
- `voice_server/.env.example`
- `voice_server/.gitignore`
- `PATCH_V0.10.0_AUTONOMOUS_CORE.md`

## Arquivos REMOVIDOS

- Nenhum.

## Validação

Antes de empacotar o patch:

- `node --check` em todos os JS do projeto;
- `python -m py_compile` nos módulos Python;
- conferência de imports locais;
- conferência dos novos IDs de interface;
- Service Worker atualizado para cache `jordan-v0.10.0`.

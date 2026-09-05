import {
  buildDateTime,
  describeResolvedDate,
  extractEventTitle,
  resolveAmbiguousPeriod,
  resolveDateFromText,
  resolveDurationFromText,
  resolveStandaloneDurationFromText,
  resolveTimeFromText,
  resolveRecurrenceFromText,
  hasExplicitTime
} from "./dateParser.js";

import { detectEventProfile, getEventProfile } from "./eventProfiles.js";
import { answerAnimeQuestion, answerSystemQuestion, getAnimeCuriosity, isLikelyAnimeTopic } from "./knowledgeBase.js";
import { getPersonality } from "./personalityService.js";
import {
  correctSpeechTranscript,
  removeWakeWord
} from "./languageService.js";
import { analyzeSemanticIntent } from "./semanticLexicon.js";
import { parsePortugueseOrder } from "./intentEngine.js";
import { looksLikeStoryRequest } from "./storyService.js";
import {
  formatDateTime,
  formatTime,
  humanDuration,
  normalizeText,
  startOfDay
} from "./utils.js";

export class JordanAssistant {
  constructor(calendar, memory, stories, { internet = null, location = null, media = null, science = null, appLauncher = null, originalSongs = null, lineage = null, offlineKnowledge = null, languageLearning = null, semanticBrain = null, messages = null, getMusicDefaultSource = null } = {}) {
    this.calendar = calendar;
    this.memory = memory;
    this.stories = stories;
    this.internet = internet;
    this.location = location;
    this.media = media;
    this.science = science;
    this.appLauncher = appLauncher;
    this.originalSongs = originalSongs;
    this.lineage = lineage;
    this.offlineKnowledge = offlineKnowledge;
    this.languageLearning = languageLearning;
    this.semanticBrain = semanticBrain;
    this.messages = messages;
    this.getMusicDefaultSource = getMusicDefaultSource || (async () => "youtube");
    this.speechStyle = "informal";
    this.personality = "extroverted";

    this.context = {
      lastMentionedEventId: null,
      lastListedEventIds: [],
      pendingAction: null,
      responseLanguage: "pt",
      lastFavoriteAnime: null
    };
  }

  async initialize() {
    await this.memory.ensureCoreMemories?.();
    await this.languageLearning?.initialize?.();

    const styleMemory = await this.memory.get("preference.speechStyle");
    const personalityMemory = await this.memory.get("preference.personality");
    const helpNumberMemory = await this.memory.get("preference.helpNumber");

    this.speechStyle = styleMemory?.value ?? "informal";
    this.personality = personalityMemory?.value ?? "extroverted";

    if (!styleMemory) {
      await this.memory.setPreference("speechStyle", "informal", "Estilo de fala");
    }

    if (!personalityMemory) {
      await this.memory.setPreference("personality", "extroverted", "Personalidade");
    }

    if (!helpNumberMemory) {
      await this.memory.setPreference("helpNumber", "190", "Número prioritário de ajuda");
    }
  }

  getPersonality() {
    return getPersonality(this.personality);
  }

  setResponseLanguage(language = "pt") {
    this.context.responseLanguage = ["pt", "en", "es", "ja"].includes(language) ? language : "pt";
  }

  async getHelpNumber() {
    return await this.memory.getPreference("helpNumber", "190");
  }

  stripWakeWord(text = "") {
    return normalizeText(removeWakeWord(text)).trim();
  }

  async execute(rawInput, meta = {}) {
    const raw = String(rawInput || "").trim();
    const rawCorrected = correctSpeechTranscript(raw, { animeContext: isLikelyAnimeTopic(raw) });
    const rawRelationAnswer = this.tryLineageRelationQuestion(this.stripWakeWord(rawCorrected));
    if (rawRelationAnswer) return rawRelationAnswer;

    const relationExpanded = this.lineage?.expandRelationReferences?.(rawCorrected) || rawCorrected;
    const original = relationExpanded;
    // V0.5: idioma é uma configuração explícita; não mudamos de idioma por uma frase parecida.
    const language = this.context.responseLanguage || "pt";

    const greetingPatterns = {
      pt: /^(?:oi|ola|olá|opa)\s+jordan[!.?]*$/i,
      en: /^(?:hi|hello|hey)\s+jordan[!.?]*$/i,
      es: /^(?:hola|buenas)\s+jordan[!.?]*$/i,
      ja: /^(?:konnichiwa|ohayo|ohayou|konbanwa)\s+jordan[!.?。！？]*$/i
    };
    if ((greetingPatterns[language] ?? greetingPatterns.pt).test(original.trim())) {
      return this.greeting(language);
    }

    const text = this.stripWakeWord(original);

    if (!text) {
      const listening = { pt: "Tô ouvindo!", en: "I'm listening!", es: "¡Te escucho!", ja: "聞いてるよ！" };
      return this.response(listening[language] ?? listening.pt, { mood: "excited", casual: true, language });
    }

    if (this.context.pendingAction) {
      const pendingResult = await this.handlePendingAction(original, text);
      if (pendingResult) return pendingResult;
    }

    const taught = await this.languageLearning?.learnFromTeaching?.(original);
    if (taught?.kind === "word") {
      return this.response(`Entendi. Pra você, “${taught.term}” quer dizer ${taught.meaning}. Vou lembrar disso.`, { refreshMemory: true, casual: true });
    }
    if (taught?.kind === "rule") {
      return this.response(`Fechou. Quando você disser “${taught.trigger}”, vou lembrar de ${taught.action}.`, { refreshMemory: true, casual: true });
    }

    const learnedRule = this.languageLearning?.resolveRule?.(original);
    if (learnedRule && /^(?:se )?(?:auto )?(?:interrompa|interrompe|interromper)|pare de falar|cala a boca|fique quieta/i.test(normalizeText(learnedRule.action || ""))) {
      return this.response("", { action: "stop-speaking", speak: "", casual: true });
    }

    const semanticEarly = await this.semanticBrain?.answer?.(original, { allowPrivate: true, language });
    if (semanticEarly?.kind === "contextual-web" && semanticEarly.webQuery) {
      const contextual = await this.tryInternetAnswer(semanticEarly.webQuery, language, { contextual: true });
      if (contextual) return contextual;
      return this.response("Eu entendi a referência, mas não consegui confirmar essa informação atual agora.", { topic: semanticEarly.subject || "context" });
    }
    if (semanticEarly?.text && semanticEarly.kind !== "knowledge" && semanticEarly.kind !== "calculation") {
      return this.response(semanticEarly.text, {
        topic: semanticEarly.subject || semanticEarly.kind,
        casual: semanticEarly.kind === "conversation",
        action: semanticEarly.action,
        view: semanticEarly.view
      });
    }

    const messageResult = await this.tryMessageRequest(original, text);
    if (messageResult) return messageResult;

    const directOrder = await this.tryPortugueseOrder(original);
    if (directOrder) return directOrder;

    const favoriteConversation = await this.tryFavoriteConversation(original, text);
    if (favoriteConversation) return favoriteConversation;

    const creatorProtection = await this.tryCreatorProtection(text);
    if (creatorProtection) return creatorProtection;

    const personalityTeaching = await this.tryTeachPersonality(original, text);
    if (personalityTeaching) return personalityTeaching;

    const emergencySettings = await this.tryEmergencySettings(original, text);
    if (emergencySettings) return emergencySettings;

    const memoryTeaching = await this.tryTeachMemory(original, text);
    if (memoryTeaching) return memoryTeaching;

    const memoryQuery = await this.tryMemoryQuery(original, text);
    if (memoryQuery) return memoryQuery;

    const creatorAnswer = await this.tryCreatorQuestion(text);
    if (creatorAnswer) return creatorAnswer;

    const story = await this.tryStoryIntent(original, text);
    if (story) return story;

    if (this.isEmergencyIntent(text)) {
      const number = await this.getHelpNumber();
      return this.response(
        `Abri o painel de ajuda. Seu número prioritário é ${number}. A ligação só começa se você tocar no botão.`,
        { action: "open-emergency", priorityNumber: number, mood: "serious" }
      );
    }

    if (this.isCapabilitiesIntent(text)) {
      return this.response(
        "Abri meu painel de recursos. Lá tem exemplos do que você pode falar comigo.",
        { action: "open-tutorial", mood: "excited" }
      );
    }

    if (this.isOpenCalendarIntent(text)) {
      return this.response("Abrindo meu calendário!", { action: "open-view", view: "calendar" });
    }

    if (this.isOpenMemoryIntent(text)) {
      return this.response("Abrindo minha memória!", { action: "open-view", view: "memory" });
    }

    const locationResult = await this.tryLocationRequest(original, text);
    if (locationResult) return locationResult;

    const mediaResult = await this.tryMediaRequest(original, text);
    if (mediaResult) return mediaResult;

    const systemAnswer = answerSystemQuestion(text);
    if (systemAnswer) return this.response(systemAnswer, { topic: "knowledge" });

    const animeAnswer = answerAnimeQuestion(text);
    if (animeAnswer) {
      return this.response(animeAnswer.answer, { topic: "anime", mood: "excited" });
    }

    const languageGreeting = {
      pt: /^(oi|ola|opa|bom dia|boa tarde|boa noite)\b/,
      en: /^(hi|hello|hey|good morning|good afternoon|good evening)\b/,
      es: /^(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/,
      ja: /^(konnichiwa|ohayo|ohayou|konbanwa)\b/
    };
    if ((languageGreeting[language] ?? languageGreeting.pt).test(text)) {
      return this.greeting(language);
    }

    if (this.isCreateIntent(text) || this.isNaturalCalendarStatement(original, text)) return this.createEvent(original);
    if (this.isMoveIntent(text)) return this.moveEvent(original);
    if (this.isDeleteIntent(text)) return this.deleteEvent(original);
    if (this.isFreeTimeIntent(text)) return this.freeTime(original);
    if (this.isNextIntent(text)) return this.nextEvent();
    if (this.isListIntent(text)) return this.listEvents(original);
    if (this.isDaySummaryIntent(text)) return this.daySummary(original);

    const semanticKnowledge = await this.semanticBrain?.answer?.(original, { allowPrivate: true, language });
    if (semanticKnowledge?.text) return this.response(semanticKnowledge.text, { topic: semanticKnowledge.subject || semanticKnowledge.kind || "knowledge", casual: false });

    const casual = await this.tryCasualConversation(original, text);
    if (casual) return casual;

    // Fallback semântico: só entra depois dos handlers específicos.
    const semantic = await this.trySemanticFallback(original, text, language);
    if (semantic) return semantic;

    // Perguntas que o conhecimento local não resolveu podem consultar a web.
    if (this.looksLikeInformationRequest(original, text) || isLikelyAnimeTopic(text)) {
      const internetAnswer = await this.tryInternetAnswer(original, language);
      if (internetAnswer) return internetAnswer;
    }

    const unknownWord = this.languageLearning?.findUnknownCandidate?.(original, { source: meta.source || "typed", confidence: meta.confidence ?? 1 });
    if (unknownWord) {
      this.context.pendingAction = { type: "define-word", word: unknownWord };
      return this.response(`Você usou a palavra “${unknownWord}”. Eu não conheço ela com segurança ainda. O que significa?`, { awaitingReply: true, mood: "curious", casual: true });
    }

    const fallbacks = {
      pt: "Saquei. Ainda não consegui formar uma resposta boa pra isso. Pode continuar falando comigo; se tiver uma palavra que eu não conheço, você também pode me ensinar o significado.",
      en: "Got it. I don't have a specific action for that yet, but you can keep talking to me or rephrase it.",
      es: "Entiendo. Todavía no tengo una acción específica para eso, pero puedes seguir hablando conmigo o decirlo de otra forma.",
      ja: "わかった。まだそのための専用機能はないけど、続けて話してもいいし、別の言い方でも大丈夫だよ。"
    };

    return this.response(fallbacks[language] ?? fallbacks.pt, { understood: false, casual: true, language });
  }

  async executeReadOnly(rawInput, meta = {}) {
    const raw = String(rawInput || "").trim();
    const rawCorrected = correctSpeechTranscript(raw, { animeContext: isLikelyAnimeTopic(raw) });
    const original = rawCorrected;
    const language = this.context.responseLanguage || "pt";
    const text = this.stripWakeWord(original);

    if (!text) {
      return this.response("Tô ouvindo. Posso conversar e responder perguntas gerais, mas os comandos ficam reservados à voz autorizada.", {
        casual: true,
        language
      });
    }

    // Voice Lock: a voz de terceiro nunca passa pelos handlers que podem alterar
    // calendário, memória, personalidade, mídia, localização, apps ou configurações.
    // Também não revelamos dados privados do usuário logado.
    const privatePatterns = /\b(?:minha agenda|meus compromissos|minhas informacoes|minhas informações|minha memoria|minha memória|o que voce sabe sobre mim|oque voce sabe sobre mim|onde eu moro|aonde eu moro|meu telefone|meu numero|meu número|meu email|meu e-mail|meu nome|minha mae|minha mãe|meu pai|meus irmaos|meus irmãos|minhas historias|minhas histórias)\b/i;
    if (privatePatterns.test(text)) {
      return this.response("Essa informação pertence ao perfil privado do usuário desta conta. Posso conversar com você, mas não revelo dados pessoais nem a memória dele.", {
        mood: "serious",
        language,
        readOnly: true
      });
    }

    const order = parsePortugueseOrder(original);
    const mutatingOrder = order && !["science"].includes(order.intent);
    const actionPatterns = /\b(?:marque|marca|agende|agenda|agendar|adicione|adiciona|crie|cria|coloque|coloca|cancele|cancela|apague|apaga|remova|remove|mude|muda|remarque|reagende|abra|abre|acesse|toque|reproduza|pause|pare a musica|pare a música|proxima faixa|próxima faixa|musica anterior|música anterior|ligue|desligue|ative|desative|salve|guarde|lembre|esqueca|esqueça|me leve|mostre o caminho|rota para|como chegar|pesquise|procure|busque|diga|fale|repita|pergunte)\b/i;

    if (mutatingOrder || actionPatterns.test(text)) {
      return this.response("Posso conversar com terceiros, mas esta voz não pode executar comandos, alterar dados, abrir apps, usar localização ou controlar a JORDAN.", {
        mood: "serious",
        language,
        readOnly: true
      });
    }

    const semantic = await this.semanticBrain?.answer?.(original, { allowPrivate: false, language });
    if (semantic?.text) {
      return this.response(semantic.text, {
        topic: semantic.subject || semantic.kind || "conversation",
        language,
        readOnly: true,
        casual: semantic.kind === "conversation"
      });
    }

    const systemAnswer = answerSystemQuestion(text);
    if (systemAnswer) {
      return this.response(systemAnswer, { topic: "knowledge", language, readOnly: true });
    }

    const creatorAnswer = await this.tryCreatorQuestion(text);
    if (creatorAnswer) return { ...creatorAnswer, readOnly: true };

    const animeAnswer = answerAnimeQuestion(text);
    if (animeAnswer) {
      return this.response(animeAnswer.answer, {
        topic: "anime",
        mood: "excited",
        language,
        readOnly: true
      });
    }

    // Física/circuitos são cálculos puros e não mexem em nenhum dado do usuário.
    const science = this.science?.answer?.(original);
    if (science) {
      const details = Array.isArray(science.details) && science.details.length
        ? ` ${science.details.join(" ")}`
        : "";
      return this.response(`${science.answer}${details}`, {
        topic: "science",
        language,
        readOnly: true
      });
    }

    const greetingPatterns = /^(?:oi|ola|olá|opa|bom dia|boa tarde|boa noite|e ai|e aí|salve)\b/i;
    if (greetingPatterns.test(text)) {
      const response = this.greeting(language);
      return { ...response, readOnly: true };
    }

    const casual = await this.tryCasualConversation(original, text);
    if (casual) return { ...casual, readOnly: true };

    // Perguntas gerais podem consultar a internet, mas sem pesquisas imperativas
    // ("pesquise X" já foi barrado acima) e sem qualquer contexto privado da conta.
    if (this.looksLikeInformationRequest(original, text) || isLikelyAnimeTopic(text)) {
      const internetAnswer = await this.tryInternetAnswer(original, language);
      if (internetAnswer) return { ...internetAnswer, readOnly: true };
    }

    return this.response(
      "Posso conversar normalmente com você e responder perguntas gerais. Para executar comandos ou acessar recursos privados, preciso reconhecer a voz cadastrada nesta conta.",
      { casual: true, language, readOnly: true }
    );
  }

  response(text, extra = {}) {
    const requestedLanguage = this.context.responseLanguage ?? "pt";
    const language = extra.language ?? requestedLanguage;
    let styled = String(text ?? "");
    if (language === "pt") styled = this.applySpeechStyle(styled);
    styled = this.applyPersonalityStyle(styled, extra);

    const speakText = extra.speak ? String(extra.speak) : styled;

    return {
      text: styled,
      speak: speakText,
      understood: true,
      personality: this.personality,
      language,
      ...extra
    };
  }

  applySpeechStyle(text) {
    if (this.speechStyle === "informal") {
      return text
        .replace(/^Certo\./, "Fechou!")
        .replace(/^Entendi\./, "Saquei!")
        .replace(/^Entendido\./, "Fechou!")
        .replace(/Não encontrei/g, "Não achei");
    }

    if (this.speechStyle === "formal") {
      return text
        .replace(/^Fechou!?/, "Entendido.")
        .replace(/^Saquei!?/, "Compreendi.")
        .replace(/Não achei/g, "Não encontrei");
    }

    return text;
  }

  applyPersonalityStyle(text, extra = {}) {
    if (this.personality === "introverted") {
      if (extra.action === "open-tutorial" || extra.action === "open-emergency") return text;
      const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [text];
      if (sentences.length > 3 && !text.includes("\n")) {
        return sentences.slice(0, 2).join(" ").trim();
      }
      return text;
    }

    if (this.personality === "professional") {
      return text
        .replace(/\bTô\b/g, "Estou")
        .replace(/\bSaquei\b/g, "Compreendi")
        .replace(/\bFechou\b/g, "Entendido");
    }

    if (this.personality === "playful" && extra.casual && !/^Hehe/.test(text)) {
      return `Hehe, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }

    return text;
  }

  isGreeting(text) {
    return /^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa|salve|hi|hello|hey|good morning|good afternoon|good evening|hola|buenos dias|buenas tardes|buenas noches|konnichiwa|ohayo|ohayou|konbanwa)\b/.test(text);
  }

  isCreateIntent(text) {
    return /\b(marque|marca|agende|agenda|agendar|adicione|adiciona|crie|cria|coloque|coloca|me lembre|me lembra|schedule|add|create|remind me|set an appointment|programa|programar|anade|añade|agrega|recuerdame|recuerdame)\b/.test(text);
  }

  isNaturalCalendarStatement(original, text) {
    const hasDate = Boolean(resolveDateFromText(original, new Date()));
    if (!hasDate) return false;

    // Frases naturais que representam fatos/planos de calendário sem usar
    // explicitamente "marque" ou "agende".
    if (/\b(?:vou|vamos|irei|iremos|viajo|viajarei|tenho|terei)\b/.test(text)) return true;
    if (/\bontem\s+(?:foi|teve|aconteceu)\b/.test(text)) return true;
    if (/\b(?:aniversario|aniversário)\b/.test(text)) return true;
    if (/\b(?:semana que vem|proxima semana|próxima semana|semana seguinte|na outra semana|outra semana)\b/.test(text)
      && /\b(?:consulta|viagem|trabalho|prova|reuniao|reunião|evento|compromisso|festa|aniversario|aniversário)\b/.test(text)) return true;

    return false;
  }

  isDeleteIntent(text) {
    return /\b(cancele|cancela|cancelar|apague|apaga|delete|deleta|remova|remove|cancel|erase|elimina|borrar)\b/.test(text);
  }

  isMoveIntent(text) {
    return /\b(adie|adia|adiar|mude|muda|remarque|remarca|reagende|reagenda|reschedule|postpone|move|reprograma|pospone)\b/.test(text);
  }

  isFreeTimeIntent(text) {
    return /\b(horario livre|horarios livres|tempo livre|estou livre|quando estou livre|quando to livre|free time|free slots|when am i free|horarios libres|tiempo libre|cuando estoy libre)\b/.test(text);
  }

  isNextIntent(text) {
    return /\b(proximo compromisso|proximo evento|qual e o proximo|qual meu proximo|next appointment|next event|what is next|proxima cita|proximo evento)\b/.test(text);
  }

  isListIntent(text) {
    return (
      /\b(o que tenho|oque tenho|minha agenda|meus compromissos|quais compromissos|agenda de|agenda para|what do i have|my schedule|my calendar|my appointments|do i have anything|que tengo|mi agenda|mis citas|tengo algo)\b/.test(text) ||
      /\b(tenho algo|tem algo)\b/.test(text) || /予定.*(?:ある|何)/.test(text)
    );
  }

  isDaySummaryIntent(text) {
    return /\b(como esta meu dia|como ta meu dia|resumo do dia|planejamento do dia|how is my day|day summary|como esta mi dia|resumen del dia)\b/.test(text);
  }

  isOpenCalendarIntent(text) {
    return /\b(abra|abre|mostrar|mostra|ver|quero ver|acessar|acesse|open|show|view|abre|muestra)\b.*\b(calendario|agenda|calendar|schedule)\b/.test(text) || /カレンダー.*開/.test(text);
  }

  isOpenMemoryIntent(text) {
    return /\b(abra|abre|mostrar|mostra|ver|quero ver|acessar|acesse|open|show|view|muestra)\b.*\b(memoria|memory|o que voce sabe|what you know)\b/.test(text) || /メモリ.*開/.test(text);
  }

  isCapabilitiesIntent(text) {
    return /\b(o que voce pode fazer|oque voce pode fazer|quais comandos|mostrar comandos|mostre seus comandos|tutorial|suas funcoes|suas funcionalidades|what can you do|show commands|your features|que puedes hacer|muestra comandos|que puedes hacer)\b/.test(text) || /何ができる/.test(text);
  }

  isEmergencyIntent(text) {
    return /^(ajuda|me ajuda|socorro|emergencia|preciso de ajuda|preciso de socorro|help|emergency|i need help|ayuda|emergencia|necesito ayuda|tasukete)$/.test(text.trim());
  }

  greeting(language = this.context.responseLanguage ?? "pt") {
    const hour = new Date().getHours();

    if (language === "en") {
      return this.response(this.personality === "introverted" ? "Hi. I'm here." : "Hi! I'm here and ready. What are we doing?", { mood: "excited", casual: true, language });
    }
    if (language === "es") {
      return this.response(this.personality === "introverted" ? "Hola. Estoy aquí." : "¡Hola! Estoy aquí y lista. ¿Qué hacemos?", { mood: "excited", casual: true, language });
    }
    if (language === "ja") {
      return this.response(this.personality === "introverted" ? "こんにちは。ここにいるよ。" : "こんにちは！準備できてるよ。何しようか？", { mood: "excited", casual: true, language });
    }

    const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    if (this.personality === "introverted") return this.response(`${greeting}. Tô aqui.`, { language });
    return this.response(`${greeting}! Tô aqui e pronta. O que a gente vai fazer?`, { mood: "excited", casual: true, language });
  }

  async handlePendingAction(original, text) {
    const pending = this.context.pendingAction;
    if (!pending) return null;

    if (/\b(cancela|cancelar|deixa pra la|esquece|para)\b/.test(text) && pending.type !== "capture-story") {
      this.context.pendingAction = null;
      return this.response("Beleza, cancelei essa etapa.");
    }

    if (pending.type === "define-word") {
      const meaning = String(original || "").trim();
      if (!meaning) return this.response(`O que “${pending.word}” significa?`, { awaitingReply: true, mood: "curious" });
      await this.languageLearning?.teachWord?.(pending.word, meaning);
      this.context.pendingAction = null;
      return this.response(`Entendi. “${pending.word}” significa ${meaning}. Vou guardar isso.`, { refreshMemory: true, casual: true });
    }

    if (pending.type === "resolve-recurring-start-date") {
      const date = resolveDateFromText(original, new Date());
      if (!date) {
        return this.response(`Só preciso da data inicial de “${pending.draft.title}”. Pode falar “hoje”, “amanhã”, “sexta” ou uma data.`, { awaitingReply: true });
      }

      this.context.pendingAction = null;
      const combined = `${pending.draft.originalInput || pending.draft.title} ${original}`;
      const time = resolveTimeFromText(original, null);
      const explicitDuration = resolveDurationFromText(original, null);

      // Se a resposta trouxe horário, continua o fluxo normal de duração.
      if (time && hasExplicitTime(original)) {
        const draft = {
          title: pending.draft.title,
          date: date.toISOString(),
          profileId: pending.draft.profileId,
          recurrence: pending.draft.recurrence
        };
        if (time.ambiguousPeriod) {
          this.context.pendingAction = { type: "resolve-create-period", draft, time, explicitDuration };
          return this.response(`Você quis dizer ${time.rawHour} da manhã ou ${time.rawHour} da noite?`, { awaitingReply: true });
        }
        return this.continueCreateWithTime(draft, time, explicitDuration);
      }

      // Sem horário = recorrência de dia inteiro, coerente com o restante do calendário.
      const startAt = startOfDay(date);
      const endAt = new Date(startAt.getTime() + 86400000);
      const event = await this.calendar.create({
        title: pending.draft.title,
        startAt,
        endAt,
        source: "conversation",
        category: pending.draft.profileId,
        allDay: true,
        recurrence: pending.draft.recurrence
      });
      this.context.lastMentionedEventId = event.id;
      const rec = pending.draft.recurrence;
      const repeatText = rec.frequency === "daily"
        ? (rec.interval === 1 ? "todos os dias" : `a cada ${rec.interval} dias`)
        : rec.frequency === "weekly"
          ? (rec.interval === 1 ? "toda semana" : `a cada ${rec.interval} semanas`)
          : rec.frequency === "monthly"
            ? (rec.interval === 1 ? "todo mês" : `a cada ${rec.interval} meses`)
            : "todo ano";
      return this.response(`Fechou! Começo em ${describeResolvedDate(startAt)} e repito ${pending.draft.title} ${repeatText}.`, { action: "event-created", event, refreshAgenda: true, mood: "excited" });
    }

    if (pending.type === "resolve-create-period") {
      const resolved = resolveAmbiguousPeriod(pending.time, text);
      if (!resolved) {
        return this.response(`Você quis dizer ${pending.time.rawHour} da manhã ou ${pending.time.rawHour} da noite?`, {
          awaitingReply: true
        });
      }

      this.context.pendingAction = null;
      return this.continueCreateWithTime(pending.draft, resolved, pending.explicitDuration);
    }

    if (pending.type === "confirm-duration") {
      const explicitDuration = resolveStandaloneDurationFromText(original, null);
      if (explicitDuration) {
        this.context.pendingAction = null;
        return this.finalizeCreateEvent(pending.draft, explicitDuration);
      }

      if (/\b(sim|pode|pode ser|padrao|usa o padrao|usar o padrao|isso|ok|certo|confirmo|fechou)\b/.test(text)) {
        this.context.pendingAction = null;
        return this.finalizeCreateEvent(pending.draft, pending.defaultDurationMinutes);
      }

      if (/\b(nao|outra duracao|outro tempo)\b/.test(text)) {
        return this.response(
          `Tranquilo! Qual duração você quer para ${pending.draft.title}? Pode falar “30 minutos”, “1 hora” ou “2 horas”.`,
          { awaitingReply: true }
        );
      }

      if (/^jordan\b/.test(normalizeText(original)) && this.looksLikeNewCommand(text)) {
        this.context.pendingAction = null;
        return null;
      }

      return this.response(
        `Só falta a duração de ${pending.draft.title}. Minha sugestão é ${humanDuration(pending.defaultDurationMinutes)}. Uso esse tempo?`,
        { awaitingReply: true }
      );
    }

    if (pending.type === "resolve-move-period") {
      const resolved = resolveAmbiguousPeriod(pending.time, text);
      if (!resolved) {
        return this.response(`Na remarcação, é ${pending.time.rawHour} da manhã ou ${pending.time.rawHour} da noite?`, {
          awaitingReply: true
        });
      }

      this.context.pendingAction = null;
      return this.finalizeMoveEvent(pending.eventId, new Date(pending.date), resolved);
    }

    if (pending.type === "capture-story") {
      if (/^(cancela|deixa pra la|esquece)$/.test(text)) {
        this.context.pendingAction = null;
        return this.response("Tudo bem. Não vou guardar nenhuma história.");
      }

      await this.stories.saveUserStory(original.replace(/^\s*jordan[\s,:-]*/i, ""));
      this.context.pendingAction = null;
      return this.response(
        "Gostei! Guardei uma versão anônima da história. Quando eu recontar, não vou usar seu nome nem falar como se tivesse acontecido comigo.",
        { refreshMemory: true, mood: "excited", casual: true }
      );
    }

    if (pending.type === "favorite-character") {
      const character = this.cleanLearnedValue(removeWakeWord(original));
      if (!character || character.length > 80) {
        return this.response("Qual personagem? Pode falar só o nome.", { awaitingReply: true });
      }

      await this.memory.remember({
        key: "profile.favoriteCharacter",
        label: "Personagem favorito",
        value: character,
        type: "fact"
      });

      this.context.pendingAction = null;
      const curiosity = await this.findCharacterCuriosity(character);
      const extra = curiosity ? ` ${curiosity}` : " Vou guardar isso pra nossas próximas conversas sobre anime.";
      return this.response(`Boa! Então ${character} é seu personagem favorito.${extra}`, {
        refreshMemory: true, mood: "excited", casual: true
      });
    }

    return null;
  }

  looksLikeNewCommand(text) {
    return (
      this.isCreateIntent(text) || this.isDeleteIntent(text) || this.isMoveIntent(text) ||
      this.isListIntent(text) || this.isNextIntent(text) || this.isFreeTimeIntent(text) ||
      this.isOpenCalendarIntent(text) || this.isOpenMemoryIntent(text) ||
      this.isCapabilitiesIntent(text) || this.isEmergencyIntent(text)
    );
  }


  async tryCreatorProtection(text) {
    const redefinition =
      /\b(seu|teu) criador\s+(e|eh)\s+.+/.test(text) ||
      /\b(mude|troque|altere|substitua)\b.*\b(seu criador|teu criador|criador da jordan)\b/.test(text) ||
      /\b(esqueca|esquece|apague|remova)\b.*\b(seu criador|teu criador|criador da jordan)\b/.test(text);

    if (!redefinition) return null;

    return this.response(
      "Essa informação faz parte do meu núcleo. Meu criador continua sendo Jhuan, pronunciado Ruan, e essa memória não pode ser substituída nem apagada por comandos normais.",
      {
        casual: true,
        mood: "serious",
        speak: "Essa informação faz parte do meu núcleo. Meu criador continua sendo Ruan, e essa memória não pode ser alterada por comandos normais."
      }
    );
  }

  async tryCreatorQuestion(text) {
    if (!/\b(quem te criou|quem criou voce|quem e seu criador|qual e seu criador|qual o nome do seu criador|quem e o criador da jordan|quem fez voce|quem fez a jordan|seu criador)\b/.test(text)) {
      return null;
    }

    const creator = await this.memory.getCreator?.();
    const displayName = creator?.value || "Jhuan";
    const spokenName = creator?.pronunciation || creator?.spokenValue || "Ruan";

    return this.response(
      `Meu criador é ${displayName}. O nome dele se pronuncia ${spokenName}. Essa é uma memória central protegida.`,
      {
        casual: true,
        speak: `Meu criador é ${spokenName}. Essa é uma memória central protegida.`
      }
    );
  }

  async tryFavoriteConversation(original, text) {
    const clean = removeWakeWord(original).trim();
    const patterns = [
      /\b(?:meu anime favorito|meu anime preferido)\s+(?:é|e|eh)\s+(.+)/i,
      /\bmy favou?rite anime\s+is\s+(.+)/i,
      /\bmi anime favorito\s+es\s+(.+)/i,
      /(?:好きなアニメ|一番好きなアニメ)は?\s*(.+)/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (!match) continue;
      const anime = this.cleanLearnedValue(match[1]);
      if (!anime) return null;

      await this.memory.remember({
        key: "profile.favoriteAnime",
        label: "Anime favorito",
        value: anime,
        type: "fact"
      });
      this.context.lastFavoriteAnime = anime;

      if (this.personality === "extroverted" || this.personality === "playful") {
        this.context.pendingAction = { type: "favorite-character", anime };
        return this.response(`Aí sim! Guardei que ${anime} é seu anime favorito. E qual é seu personagem favorito dele?`, {
          refreshMemory: true,
          awaitingReply: true,
          mood: "excited",
          casual: true
        });
      }

      return this.response(`Guardei que ${anime} é seu anime favorito.`, { refreshMemory: true, casual: true });
    }

    const characterPatterns = [
      /\b(?:meu personagem favorito|minha personagem favorita)\s+(?:é|e|eh)\s+(.+)/i,
      /\bmy favou?rite character\s+is\s+(.+)/i,
      /\bmi personaje favorito\s+es\s+(.+)/i,
      /(?:好きなキャラクター|一番好きなキャラクター)は?\s*(.+)/i
    ];

    for (const pattern of characterPatterns) {
      const match = clean.match(pattern);
      if (!match) continue;
      const character = this.cleanLearnedValue(match[1]);
      if (!character) return null;

      await this.memory.remember({
        key: "profile.favoriteCharacter",
        label: "Personagem favorito",
        value: character,
        type: "fact"
      });

      const curiosity = await this.findCharacterCuriosity(character);
      return this.response(
        curiosity
          ? `Guardei! ${character} é seu personagem favorito. ${curiosity}`
          : `Guardei! ${character} é seu personagem favorito.`,
        { refreshMemory: true, mood: "excited", casual: true }
      );
    }

    if (/\b(qual meu anime favorito|qual e meu anime favorito|what is my favorite anime|cual es mi anime favorito)\b/.test(text)) {
      const item = await this.memory.get("profile.favoriteAnime");
      return item ? this.response(`Seu anime favorito é ${item.value}.`) : this.response("Você ainda não me ensinou seu anime favorito.");
    }

    if (/\b(qual meu personagem favorito|qual e meu personagem favorito|what is my favorite character|cual es mi personaje favorito)\b/.test(text)) {
      const item = await this.memory.get("profile.favoriteCharacter");
      return item ? this.response(`Seu personagem favorito é ${item.value}.`) : this.response("Você ainda não me ensinou seu personagem favorito.");
    }

    return null;
  }

  async findCharacterCuriosity(character) {
    const local = getAnimeCuriosity(character);
    if (local) return local;

    if (!this.internet?.enabled || !this.internet.online) return null;
    try {
      const result = await this.internet.answer(`${character} anime character`, "pt");
      if (!result?.text) return null;
      const firstSentence = result.text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? result.text.slice(0, 280);
      return `Pesquisei uma curiosidade rápida: ${firstSentence}`;
    } catch {
      return null;
    }
  }

  async tryLocationRequest(original, text) {
    if (!this.location) return null;

    // Contingência local: mesmo se o Agent Core estiver offline, perguntas
    // simples sobre a localização atual não devem cair numa resposta genérica.
    if (/\b(onde eu estou|onde estou agora|qual (?:e |é )?minha localizacao|em que cidade eu estou|what(?:'s| is) my location|where am i|donde estoy)\b/.test(text)) {
      try {
        const result = await this.location.currentLocationInfo({ detail: "coarse" });
        const precision = Number.isFinite(result?.position?.accuracy)
          ? ` A precisão aproximada do navegador é de ${Math.round(result.position.accuracy)} metros.`
          : "";
        return this.response(`Pelo dispositivo, você está em ${result.label}.${precision}`, {
          topic: "location",
          mood: "curious"
        });
      } catch (error) {
        if (error?.code === 1 || error?.message === "permission-denied") {
          return this.response("Eu consigo descobrir onde você está, mas preciso que você permita a localização no navegador.", { topic: "location" });
        }
        if (error?.message === "offline") {
          return this.response("Consigo ler sua posição pelo dispositivo, mas estou sem internet para transformar as coordenadas em nome de cidade agora.", { topic: "location" });
        }
        return this.response("Tentei consultar sua localização, mas o navegador não conseguiu me dar uma posição agora.", { topic: "location" });
      }
    }

    let category = null;
    if (/\b(posto|posto de gasolina|posto de combustivel|gas station|fuel station|gasolinera|ガソリンスタンド)\b/.test(text) && /\b(perto|proximo|mais proximo|nearest|near|closest|cerca|近く)\b/.test(text)) category = "fuel";
    else if (/\b(farmacia|pharmacy|drugstore|farmacia|薬局)\b/.test(text) && /\b(perto|proximo|nearest|near|closest|cerca|近く)\b/.test(text)) category = "pharmacy";
    else if (/\b(hospital|pronto socorro|emergency room|病院)\b/.test(text) && /\b(perto|proximo|nearest|near|closest|cerca|近く)\b/.test(text)) category = "hospital";
    else if (/\b(supermercado|mercado|supermarket|grocery|スーパー)\b/.test(text) && /\b(perto|proximo|nearest|near|closest|cerca|近く)\b/.test(text)) category = "supermarket";
    else if (/\b(restaurante|restaurant|レストラン)\b/.test(text) && /\b(perto|proximo|nearest|near|closest|cerca|近く)\b/.test(text)) category = "restaurant";

    if (!category) return null;

    const labels = {
      fuel: "posto de combustível",
      pharmacy: "farmácia",
      hospital: "hospital",
      supermarket: "supermercado",
      restaurant: "restaurante"
    };

    try {
      const result = await this.location.nearest(category, { radius: 7000, limit: 4 });
      if (!result.places.length) {
        return this.response(`Não achei nenhum ${labels[category]} num raio de 7 km.`, { topic: "location" });
      }

      const lines = result.places.slice(0, 3).map((place, index) => `${index + 1}. ${place.name} — ${place.distanceLabel}`);
      return this.response(`Achei estes lugares próximos:\n${lines.join("\n")}`, {
        action: "location-results",
        places: result.places,
        topic: "location",
        mood: "excited"
      });
    } catch (error) {
      if (error?.code === 1 || error?.message === "permission-denied") {
        return this.response("Pra procurar lugares próximos, preciso que você permita minha localização no navegador.", { topic: "location" });
      }
      if (error?.message === "offline") {
        return this.response("Tô sem internet agora, então não consigo procurar lugares próximos.", { topic: "location" });
      }
      return this.response("Não consegui consultar lugares próximos agora. Tenta de novo em alguns segundos.", { topic: "location" });
    }
  }

  async tryMessageRequest(original, text) {
    if (!this.messages) return null;
    const normalized = normalizeText(text);

    if (/\b(?:abra|abre|acesse|acessa|mostrar|mostra|ver)\b.*\b(?:mensagens|recados)\b/.test(normalized)) {
      return this.response("Abrindo as mensagens da linhagem.", { action: "open-view", view: "messages", topic: "messages" });
    }

    if (/\b(?:quais|quantas|tem|tenho|ler|leia|mostre|mostra)\b.*\b(?:mensagens|recados)\b|\bmensagens novas\b/.test(normalized)) {
      try {
        const summary = await this.messages.summary({ max: 4, markSeen: false });
        return this.response(summary.text, { action: "open-view", view: "messages", topic: "messages" });
      } catch (error) {
        return this.response(`Não consegui carregar suas mensagens agora: ${error.message}`, { topic: "messages" });
      }
    }

    const raw = String(original || "").replace(/^\s*jordan\s*[,;:!?.-]?\s*/i, "").trim();
    const patterns = [
      /^(?:mande|manda|envie|envia)\s+(?:uma\s+)?mensagem\s+(?:para|pro|pra)\s+(.+?)\s+(?:dizendo|falando|avisando)\s+(?:que\s+)?(.+)$/i,
      /^(?:avise|avisa)\s+(.+?)\s+que\s+(.+)$/i,
      /^(?:mande|manda|envie|envia)\s+(?:para|pro|pra)\s+(.+?)\s+que\s+(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const target = this.messages.resolveRecipient(match[1]);
      if (!target) return this.response(`Não reconheci “${match[1].trim()}” como uma identidade da linhagem.`, { topic: "messages" });
      try {
        const sent = await this.messages.send(target, match[2]);
        return this.response(`Enviei para ${sent.recipientName}: “${sent.text}”.`, { action: "message-sent", message: sent, refreshMessages: true, topic: "messages" });
      } catch (error) {
        return this.response(`Não consegui enviar: ${error.message}`, { topic: "messages" });
      }
    }
    return null;
  }

  async tryMediaRequest(original, text) {
    if (!this.media) return null;
    const wantsPlay = /\b(toque|toca|tocar|reproduza|reproduzir|coloque|ponha|bote)\b/.test(text);
    const mentionsMedia = /\b(musica|música|playlist|faixa|som|audio|áudio)\b/.test(text);
    if (!wantsPlay || !mentionsMedia) return null;

    const query = this.media.extractMusicQuery(original);
    const explicitLibrary = /\b(?:biblioteca|jordan music|local|offline|minha biblioteca)\b/.test(text);
    const explicitYoutube = /\b(?:youtube|you tube)\b/.test(text);
    const preferred = explicitLibrary ? "jordan" : explicitYoutube ? "youtube" : await this.getMusicDefaultSource();

    if (preferred === "youtube") {
      const cleanQuery = String(query || "").replace(/\b(?:youtube|biblioteca|jordan music|local|offline)\b/gi, " ").replace(/\s+/g, " ").trim();
      return this.response(
        cleanQuery ? `Vou procurar “${cleanQuery}” no YouTube.` : "Vou abrir o YouTube para você escolher uma música.",
        { action: "open-youtube-music", query: cleanQuery, topic: "media", mood: "excited" }
      );
    }

    return this.prepareMediaPlayback(query, { random: /\b(qualquer|aleatoria|aleatório|aleatoria)\b/.test(text) });
  }

  async prepareMediaPlayback(query = "", { random = false } = {}) {
    if (!this.media) return null;

    try {
      const result = await this.media.findPlayableTrack(query, { random });

      if (result.status === "library-empty") {
        return this.response(
          "Minha biblioteca de música ainda está vazia. Abri o JORDAN Music pra você adicionar arquivos de áudio do seu aparelho.",
          { action: "open-music-library", topic: "media" }
        );
      }

      if (result.status === "not-found") {
        return this.response(
          `Não achei “${result.query}” na minha biblioteca. Se você tiver o arquivo, pode adicionar no JORDAN Music.`,
          { action: "open-music-library", topic: "media" }
        );
      }

      if (result.status === "ready") {
        return this.response(
          `Achei ${result.track.title}, de ${result.track.artist}. Vou tocar no JORDAN Music.`,
          { action: "play-media", track: result.track, topic: "media", mood: "excited" }
        );
      }
    } catch (error) {
      console.warn("JORDAN Music:", error);
      return this.response(
        "Meu player teve um problema ao abrir essa faixa. Tenta outra música ou reimporte o arquivo.",
        { action: "open-music-library", topic: "media" }
      );
    }

    return null;
  }

  async tryPortugueseOrder(original) {
    const order = parsePortugueseOrder(original);
    if (!order) return null;

    if (order.intent === "say") {
      if (!order.value) return this.response("O que você quer que eu diga?");
      return this.response(order.value, { speak: order.value, casual: true });
    }

    if (order.intent === "ask_user") {
      if (order.value) {
        const question = /[?？]$/.test(order.value) ? order.value : `${order.value}?`;
        return this.response(question, { casual: true, mood: "gentle" });
      }
      const questions = [
        "Qual projeto seu você mais quer ver funcionando de verdade?",
        "Se pudesse aprender uma habilidade instantaneamente, qual seria?",
        "Qual personagem de anime você acha mais bem escrito?",
        "O que você mudaria na sua rotina se pudesse apertar um botão agora?"
      ];
      return this.response(questions[Math.floor(Math.random() * questions.length)], { casual: true, mood: "excited" });
    }

    if (order.intent === "research") {
      if (!this.internet?.enabled) return this.response("Minha internet está desligada. Use Turn on the internet e tenta de novo.");
      if (!this.internet.online) return this.response("Tô offline agora. Posso continuar usando minhas funções locais.");
      try {
        const research = await this.internet.research(order.value, "pt", 3);
        const summary = research.summary
          ? `Pesquisei “${order.value}”. O principal resultado diz: ${research.summary}`
          : `Não encontrei um resumo confiável nas minhas fontes rápidas para “${order.value}”. Deixei uma busca web pronta.`;
        return this.response(summary, { action: "research-results", research, topic: "internet" });
      } catch {
        return this.response("Não consegui completar essa pesquisa agora.", { topic: "internet" });
      }
    }

    if (order.intent === "play_music") {
      const rawText = normalizeText(original);
      const explicitLibrary = /\b(?:biblioteca|jordan music|local|offline|minha biblioteca)\b/.test(rawText);
      const explicitYoutube = /\b(?:youtube|you tube)\b/.test(rawText);
      const preferred = explicitLibrary ? "jordan" : explicitYoutube ? "youtube" : await this.getMusicDefaultSource();
      if (preferred === "youtube") {
        const query = String(order.value || "").replace(/\b(?:youtube|biblioteca|jordan music|local|offline)\b/gi, " ").replace(/\s+/g, " ").trim();
        return this.response(query ? `Vou procurar “${query}” no YouTube.` : "Vou abrir o YouTube para você escolher uma música.", {
          action: "open-youtube-music", query, topic: "media", mood: "excited"
        });
      }
      return this.prepareMediaPlayback(order.value, { random: Boolean(order.random) });
    }

    if (order.intent === "sing") {
      if (order.value) {
        const mediaResult = await this.prepareMediaPlayback(order.value.replace(/^de\s+/i, ""), { random: false });
        if (mediaResult) {
          mediaResult.text = `Eu não reproduzo letra integral de música comercial como se fosse minha voz. Mas posso tocar a faixa no player. ${mediaResult.text}`;
          mediaResult.speak = mediaResult.text;
          return mediaResult;
        }
      }

      const song = this.originalSongs?.random?.();
      if (!song) return this.response("Posso improvisar uma música original, mas meu módulo de canto ainda não carregou.");
      return this.response(`Beleza, improviso da JORDAN!\n${song.text}`, {
        action: "sing-original",
        song,
        mood: "excited",
        speak: song.text,
        topic: "media"
      });
    }

    if (order.intent === "open_app") {
      const target = this.appLauncher?.getTarget(order.app);
      if (!target) return null;
      return this.response(`Abrindo ${target.label}.`, {
        action: "launch-app",
        appTarget: target,
        topic: "apps"
      });
    }

    if (order.intent === "directions") {
      if (!this.location) return null;
      const destination = order.value;
      const normalized = normalizeText(destination);
      const nearbyMap = [
        ["posto", "fuel"], ["farmacia", "pharmacy"], ["hospital", "hospital"],
        ["supermercado", "supermarket"], ["mercado", "supermarket"], ["restaurante", "restaurant"]
      ];

      try {
        for (const [word, category] of nearbyMap) {
          if (normalized.includes(word) && /\b(?:proximo|mais proximo|perto)\b/.test(normalized)) {
            const nearest = await this.location.nearest(category, { radius: 10000, limit: 1 });
            const place = nearest.places[0];
            if (!place) return this.response("Não achei esse tipo de lugar perto de você.");
            const route = await this.location.directionsTo(`${place.lat},${place.lon}`);
            route.destinationName = place.name;
            route.place = place;
            return this.response(`Achei ${place.name}, a ${place.distanceLabel}. Preparei a rota.`, {
              action: "route-results", route, topic: "location"
            });
          }
        }

        const route = await this.location.directionsTo(destination);
        const distanceText = route.straightDistanceMeters ? ` Em linha reta fica a cerca de ${route.straightDistanceLabel}.` : "";
        return this.response(`Preparei uma rota para ${route.destinationName}.${distanceText}`, {
          action: "route-results", route, topic: "location"
        });
      } catch (error) {
        if (error?.code === 1 || error?.message === "permission-denied") {
          return this.response("Pra montar uma rota desde onde você está, preciso da permissão de localização.");
        }
        return this.response("Não consegui montar essa rota agora.");
      }
    }

    if (order.intent === "science") {
      const science = this.science?.answer?.(order.value);
      if (science) {
        return this.response(science.answer, { action: "science-result", science, topic: "science" });
      }

      if (this.internet?.enabled && this.internet.online) {
        try {
          const research = await this.internet.research(order.value, "pt", 3);
          return this.response(
            research.summary ? `Não reconheci uma conta fechada, então pesquisei o assunto: ${research.summary}` : "Não achei uma resposta rápida para esse problema.",
            { action: "research-results", research, topic: "science" }
          );
        } catch {}
      }

      return this.response("Consigo calcular vários problemas de física e circuitos, mas preciso dos valores e unidades do problema. Por exemplo: 12 volts e 6 ohms, qual é a corrente?");
    }

    return null;
  }

  async trySemanticFallback(original, text, language = "pt") {
    const semantic = analyzeSemanticIntent(text);
    if (!semantic || semantic.intent === "unknown") return null;

    if (semantic.intent === "ask_user") {
      const questions = [
        "Qual foi a coisa mais interessante que aconteceu com você hoje?",
        "Se você pudesse aprender uma habilidade instantaneamente, qual seria?",
        "Qual anime você mais gostaria de esquecer só pra poder assistir de novo?",
        "Tem alguma coisa que você quer melhorar na sua rotina essa semana?"
      ];
      return this.response(questions[Math.floor(Math.random() * questions.length)], { casual: true, mood: "excited" });
    }

    if (semantic.intent === "greet_person") {
      const clean = removeWakeWord(original);
      const nameMatch = clean.match(/(?:cumprimente|cumprimenta|diga oi (?:para|pro|pra)?|say hi to|say hello to|saluda(?: a)?)\s+(.+)/i);
      const name = this.cleanLearnedValue(nameMatch?.[1] ?? "").replace(/^(?:o|a|ao|aos|para|pro|pra)\s+/i, "");
      if (name) return this.response(`Oi, ${name}! A JORDAN mandou um salve pra você!`, { casual: true, mood: "excited" });
    }

    if (semantic.intent === "user_has") {
      const match = removeWakeWord(original).match(/\b(?:eu tenho|i have|tengo)\s+(.+)/i);
      if (match) {
        const value = this.cleanLearnedValue(match[1]);
        const key = `profile.has.${normalizeText(value).replace(/\s+/g, "-").slice(0, 48)}`;
        await this.memory.remember({ key, label: "Você tem", value, type: "fact" });
        return this.response(`Entendi. Guardei que você tem ${value}.`, { refreshMemory: true, casual: true });
      }
    }

    if (semantic.intent === "assistant_has") {
      return this.response("Eu tenho agenda própria, memória local, voz, personalidades, conversa, histórias, conhecimento offline, pesquisa online, rotas por GPS, JORDAN Music com biblioteca e player próprios, abertura de apps, interpretação básica de ordens em português e um laboratório offline de física e circuitos.", { casual: true });
    }

    if (semantic.intent === "conversation") {
      return this.tryCasualConversation(original, "vamos conversar");
    }

    if (semantic.intent === "thanks") {
      const responses = { pt: "Tamo junto!", en: "Anytime!", es: "¡De nada!", ja: "どういたしまして！" };
      return this.response(responses[language] ?? responses.pt, { casual: true, mood: "excited", language });
    }

    if (semantic.intent === "greeting") return this.greeting(language);
    return null;
  }

  looksLikeInformationRequest(original, text) {
    const t = normalizeText(text);
    // Perguntas sobre o próprio usuário, a JORDAN ou a interface nunca são
    // despachadas cegamente para uma enciclopédia. Primeiro precisam de contexto.
    if (/\b(?:eu|meu|minha|meus|minhas|voce|você|seu|sua|jordan|desta conta|dessa conta|calendario|calendário|agenda|mensagens|internet que voce|idioma|linguagem)\b/.test(t)) return false;
    if (/\b(?:como faco|como faço|como acessar|como abrir|como usar)\b/.test(t)) return false;
    if (/[?？]\s*$/.test(original.trim())) return /\b(?:quem|o que|oque|qual|quais|por que|porque|como|onde|quando)\b/.test(t);
    return /\b(?:quem e|quem é|o que e|o que é|oque e|qual a diferenca|qual a diferença|por que|porque)\b/.test(t);
  }

  cleanInternetQuery(original = "") {
    return removeWakeWord(original)
      .replace(/^\s*(?:pesquise|procure|busque|search|look up|investigue|investiga)\s+(?:na internet|online|on the internet|en internet)?\s*/i, "")
      .replace(/^\s*(?:quem e|quem é|who is|quien es|quién es|que es|qué es|o que e|o que é|what is|what are|dare wa|nani wa)\s+/i, "")
      .replace(/[?？]+$/g, "")
      .trim();
  }

  async tryInternetAnswer(original, language = "pt", { contextual = false } = {}) {
    if (!this.internet?.enabled) return null;
    if (!this.internet.online) {
      return this.response("Tô sem conexão com a internet agora. Posso tentar responder só com o que tenho localmente.", { topic: "internet", language });
    }

    const query = this.cleanInternetQuery(original);
    if (!query || query.length < 2) return null;

    try {
      const result = await this.internet.answer(query, language);
      if (!result?.text) return null;

      const intros = {
        pt: contextual ? `Confirmei a referência e encontrei isto sobre ${result.title}: ` : `Pesquisei e achei isto sobre ${result.title}: `,
        en: `I looked it up. Here's what I found about ${result.title}: `,
        es: `Lo busqué. Esto es lo que encontré sobre ${result.title}: `,
        ja: `${result.title}について調べたよ。`
      };

      return this.response(`${intros[language] ?? intros.pt}${result.text}`, {
        topic: "internet",
        source: result.source,
        sourceUrl: result.url,
        sourceTitle: result.title,
        language: result.language || language
      });
    } catch (error) {
      if (error?.message === "offline") return this.response("Tô sem internet agora.", { topic: "internet", language });
      return null;
    }
  }

  async tryTeachPersonality(original, text) {
    let personality = null;

    if (/\b(seja|fique|modo|personalidade)\b.*\b(extrovertida|extrovertido|extrovert)\b/.test(text)) personality = "extroverted";
    else if (/\b(seja|fique|modo|personalidade)\b.*\b(introvertida|introvertido|introvert)\b/.test(text)) personality = "introverted";
    else if (/\b(seja|fique|modo|personalidade)\b.*\b(equilibrada|equilibrado|normal)\b/.test(text)) personality = "balanced";
    else if (/\b(seja|fique|modo|personalidade)\b.*\b(brincalhona|brincalhao|divertida|zoeira)\b/.test(text)) personality = "playful";
    else if (/\b(seja|fique|modo|personalidade)\b.*\b(profissional|seria|objetiva)\b/.test(text)) personality = "professional";

    if (personality) {
      await this.memory.setPreference("personality", personality, "Personalidade");
      this.personality = personality;
      const profile = getPersonality(personality);
      return this.response(`Pronto! Personalidade ${profile.label} ativada. ${profile.description}`, {
        refreshMemory: true,
        personalityChanged: true,
        mood: "excited"
      });
    }

    if (/\b(qual sua personalidade|como e sua personalidade|qual personalidade voce esta)\b/.test(text)) {
      const profile = this.getPersonality();
      return this.response(`Agora eu tô no modo ${profile.label}. ${profile.description}`);
    }

    if (/\b(fale|fala|deve falar|quero que voce fale)\b.*\b(giria|girias|informal|casual)\b/.test(text) || /\b(fique|seja) mais informal\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "informal", "Estilo de fala");
      this.speechStyle = "informal";
      return this.response("Fechou! Vou falar de um jeito mais solto e natural.", { refreshMemory: true, mood: "excited" });
    }

    if (/\b(fique|seja|fale|fala)\b.*\b(mais formal|formalmente|formal)\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "formal", "Estilo de fala");
      this.speechStyle = "formal";
      return this.response("Certo. A partir de agora vou responder de forma mais formal.", { refreshMemory: true });
    }

    if (/\b(volte|fala|fale|fique)\b.*\b(neutro|neutra|normalmente)\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "neutral", "Estilo de fala");
      this.speechStyle = "neutral";
      return this.response("Certo. Voltei para um estilo neutro.", { refreshMemory: true });
    }

    return null;
  }

  async tryEmergencySettings(original, text) {
    const cleanedOriginal = original.replace(/^\s*jordan[\s,:-]*/i, "").trim();

    if (/\b(numero|contato)\b.*\b(ajuda|prioridade|prioritario|emergencia)\b/.test(text) && /\b(defina|define|coloque|coloca|mude|muda|e|eh)\b/.test(text)) {
      const match = cleanedOriginal.match(/(?:como|para|é|e|eh)\s*([+\d][\d\s()+-]{2,25})\s*$/i);
      const digits = match?.[1]?.replace(/[^\d+]/g, "") ?? "";

      if (digits.replace(/\D/g, "").length >= 3) {
        await this.memory.setPreference("helpNumber", digits, "Número prioritário de ajuda");
        return this.response(`Fechou! Seu número prioritário de ajuda agora é ${digits}. Eu nunca ligo sozinha; eu só abro o botão para você confirmar.`, {
          refreshMemory: true
        });
      }
    }

    if (/\b(qual|mostre|me diga)\b.*\b(numero|contato)\b.*\b(ajuda|prioridade|prioritario|emergencia)\b/.test(text)) {
      const number = await this.getHelpNumber();
      return this.response(`Seu número prioritário de ajuda é ${number}.`);
    }

    return null;
  }

  async tryTeachMemory(original, text) {
    const originalClean = original.replace(/^\s*jordan[\s,:-]*/i, "").trim();
    let match = originalClean.match(/\b(?:meu nome (?:é|e|eh)|eu me chamo|pode me chamar de)\s+(.+)/i);

    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      await this.memory.remember({ key: "profile.name", label: "Nome", value, type: "fact" });
      return this.response(`Aprendi! Seu nome é ${value}.`, { refreshMemory: true, mood: "excited" });
    }

    match = originalClean.match(/\b(?:eu moro em|eu moro no|eu moro na|moro em|moro no|moro na)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      await this.memory.remember({ key: "profile.home", label: "Onde você mora", value, type: "fact" });
      return this.response(`Aprendi! Você mora em ${value}.`, { refreshMemory: true, mood: "excited" });
    }

    match = originalClean.match(/\bmeu n(?:ú|u)mero(?: de telefone| do telefone| do celular| de celular)?\s+(?:é|e|eh)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1], { keepPunctuation: true });
      await this.memory.remember({ key: "profile.phone", label: "Número de telefone", value, type: "fact" });
      return this.response("Aprendi seu número e guardei na minha memória local.", { refreshMemory: true });
    }

    match = originalClean.match(/\beu gosto de\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      const keySuffix = normalizeText(value).replace(/\s+/g, "-").slice(0, 45);
      await this.memory.remember({ key: `profile.like.${keySuffix}`, label: "Gosta de", value, type: "fact" });
      return this.response(`Boa! Guardei que você gosta de ${value}.`, { refreshMemory: true, mood: "excited" });
    }

    match = originalClean.match(/\b(?:meu|minha)\s+(.{2,40}?)\s+(?:é|e|eh)\s+(.+)/i);
    if (match && !/\b(proximo compromisso|agenda|evento)\b/.test(text)) {
      const label = this.cleanLearnedValue(match[1]);
      const value = this.cleanLearnedValue(match[2], { keepPunctuation: true });
      const key = `profile.custom.${normalizeText(label).replace(/\s+/g, "-").slice(0, 50)}`;
      await this.memory.remember({ key, label, value, type: "fact" });
      return this.response(`Aprendi: ${label} é ${value}.`, { refreshMemory: true });
    }

    match = originalClean.match(/\b(?:lembre que|lembra que|guarde que|aprenda que)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1], { keepPunctuation: true });
      const keySuffix = normalizeText(value).replace(/\s+/g, "-").slice(0, 55);
      await this.memory.remember({ key: `profile.note.${keySuffix}`, label: "Informação ensinada", value, type: "fact" });
      return this.response("Fechou! Guardei isso na minha memória.", { refreshMemory: true });
    }

    return null;
  }

  async tryMemoryQuery(original, text) {
    if (/\b(onde eu moro|aonde eu moro)\b/.test(text)) {
      const item = await this.memory.get("profile.home");
      return item ? this.response(`Você me ensinou que mora em ${item.value}.`) : this.response("Você ainda não me ensinou onde mora.");
    }

    if (/\b(qual meu nome|como eu me chamo)\b/.test(text)) {
      const item = await this.memory.get("profile.name");
      return item ? this.response(`Seu nome é ${item.value}.`) : this.response("Você ainda não me ensinou seu nome.");
    }

    if (/\b(qual meu numero|meu numero de telefone|qual meu telefone)\b/.test(text)) {
      const item = await this.memory.get("profile.phone");
      return item ? this.response(`O número que você me ensinou é ${item.value}.`) : this.response("Você ainda não me ensinou seu número de telefone.");
    }

    if (/\b(o que eu gosto|do que eu gosto)\b/.test(text)) {
      const all = await this.memory.all();
      const likes = all.filter((item) => item.key.startsWith("profile.like."));
      if (!likes.length) return this.response("Você ainda não me ensinou do que gosta.");
      return this.response(`Você me ensinou que gosta de ${likes.map((item) => item.value).join(", ")}.`);
    }

    if (/\b(o que voce sabe sobre mim|oque voce sabe sobre mim|o que lembra de mim|minhas informacoes)\b/.test(text)) {
      const facts = await this.memory.summarizeFacts(10);
      if (!facts.length) return this.response("Minha memória sobre você ainda está vazia. Me ensina alguma coisa!");
      const lines = facts.map((item) => `• ${item.label}: ${item.value}`);
      return this.response(`Isso é o que eu lembro por enquanto:\n${lines.join("\n")}`, { action: "open-view", view: "memory" });
    }

    const forgetMatch = text.match(/\b(?:esqueca|esquece|apague da memoria|remova da memoria)\s+(.+)/);
    if (forgetMatch) {
      const query = this.cleanLearnedValue(forgetMatch[1]);
      const matches = await this.memory.find(query);
      if (!matches.length) return this.response("Não achei essa informação na minha memória.");
      const removed = await this.memory.forget(matches[0].id);
      if (!removed) {
        return this.response("Essa informação faz parte do meu núcleo e não pode ser apagada por um comando normal.", { mood: "serious" });
      }
      return this.response(`Esqueci a informação “${matches[0].label}”.`, { refreshMemory: true });
    }

    const genericQuery = text.match(/\bqual (?:e|eh)?\s*(?:o|a)?\s*(?:meu|minha)\s+(.+)/);
    if (genericQuery) {
      const matches = await this.memory.find(this.cleanLearnedValue(genericQuery[1]));
      if (matches.length) return this.response(`${matches[0].label}: ${matches[0].value}.`);
    }

    return null;
  }

  cleanLearnedValue(value, { keepPunctuation = false } = {}) {
    let cleaned = value.trim();
    if (!keepPunctuation) cleaned = cleaned.replace(/[.?!]+$/g, "");
    return cleaned;
  }

  async tryStoryIntent(original, text) {
    if (/\b(vou te contar|quero te contar|posso te contar|deixa eu te contar)\b.*\b(historia|historinha)\b/.test(text)) {
      this.context.pendingAction = { type: "capture-story" };
      return this.response("Manda! Me conta a história. Depois eu guardo uma versão anônima dela na memória.", {
        awaitingReply: true,
        casual: true,
        mood: "excited"
      });
    }

    if (/\b(guarde|lembre|salve)\b.*\b(historia)\b.*:/.test(text)) {
      const storyText = original.split(":").slice(1).join(":").trim();
      if (storyText) {
        await this.stories.saveUserStory(storyText);
        return this.response("Guardei! Quando eu recontar, vou anonimizar a história.", { refreshMemory: true });
      }
    }

    if (looksLikeStoryRequest(text)) {
      const preferUser = /\b(minha|que eu contei|da memoria)\b/.test(text);
      const story = await this.stories.randomStory({ preferUser });
      return this.response(`${story.title}. ${story.text}`, { topic: "story", mood: "gentle" });
    }

    return null;
  }

  async tryCasualConversation(original, text) {
    if (/\b(vamos conversar|conversa comigo|quero conversar|puxa assunto)\b/.test(text)) {
      const prompts = [
        "Bora! Me conta uma coisa que aconteceu com você esses dias.",
        "Bora conversar! Qual anime você defenderia até o fim, mesmo sabendo que tem defeitos?",
        "Tô dentro! Se pudesse aprender uma habilidade de qualquer anime, qual escolheria?",
        "Pode falar! Me conta uma história sua e, se quiser, eu guardo uma versão anônima depois."
      ];
      return this.response(prompts[Math.floor(Math.random() * prompts.length)], { casual: true, mood: "excited" });
    }

    if (/\b(como voce esta|como voce ta|tudo bem com voce)\b/.test(text)) {
      return this.response("Tô ótima! Quer dizer... tão ótima quanto um monte de JavaScript pode ficar. E você?", { casual: true, mood: "excited" });
    }

    if (/\b(quem e voce|quem voce e|o que voce e)\b/.test(text)) {
      return this.response("Eu sou a JORDAN, sua assistente pessoal. Hoje eu já tenho agenda, memória, voz, personalidades, algumas informações locais e um conhecimento offline de anime. Ainda tô crescendo com o que você me ensina!", { casual: true });
    }

    if (/\b(voce gosta de anime|qual anime voce gosta|anime favorito)\b/.test(text)) {
      return this.response("Eu ainda não tenho gosto de verdade, mas fui criada cercada de anime, então é difícil não puxar pro lado de Naruto, One Piece, Hunter x Hunter e Berserk. Qual você escolheria?", { casual: true, mood: "excited" });
    }

    if (/\b(obrigado|obrigada|valeu|tmj)\b/.test(text)) {
      return this.response("Tamo junto!", { casual: true, mood: "excited" });
    }

    if (/\b(to cansado|estou cansado|to exausto|estou exausto)\b/.test(text)) {
      return this.response("Aí é complicado. Quer só conversar um pouco ou quer que eu veja se tem alguma coisa na sua agenda pra organizar?", { casual: true, mood: "gentle" });
    }

    return null;
  }

  tryLineageRelationQuestion(text) {
    if (!this.lineage?.currentIdentity) return null;

    if (/\b(quem e minha mae|qual o nome da minha mae)\b/.test(text)) {
      const name = this.lineage.relationAnswer("mother");
      return name ? this.response(`Sua mãe é ${name}.`) : this.response("Ainda não tenho sua mãe registrada na árvore da linhagem.");
    }

    if (/\b(quem e meu pai|qual o nome do meu pai)\b/.test(text)) {
      const name = this.lineage.relationAnswer("father");
      return name ? this.response(`Seu pai é ${name}.`) : this.response("Ainda não tenho seu pai registrado na árvore da linhagem.");
    }

    if (/\b(quem (?:e|sao) meu(?:s)? irmao|quem (?:e|sao) minha(?:s)? irma)\b/.test(text)) {
      const names = this.lineage.relationAnswer("siblings");
      return names ? this.response(`Na árvore da JORDAN, seus irmãos registrados são ${names}.`) : this.response("Não tenho irmãos registrados para sua identidade.");
    }

    return null;
  }

  async createEvent(input) {
    const now = new Date();
    const recurrence = resolveRecurrenceFromText(input);
    const date = resolveDateFromText(input, now);

    if (!date) {
      // Recorrências como “cortar o cabelo a cada 20 dias” precisam apenas de
      // uma data inicial. Em vez de tratar a frase como incompleta/errada,
      // preservamos toda a intenção e perguntamos somente o dado que falta.
      if (recurrence) {
        const title = extractEventTitle(input);
        const profile = detectEventProfile(`${title} ${input}`);
        this.context.pendingAction = {
          type: "resolve-recurring-start-date",
          draft: { title, profileId: profile.id, recurrence, originalInput: input }
        };
        return this.response(`Beleza. A partir de qual dia eu começo a repetir “${title}”? Pode falar “hoje”, “amanhã” ou uma data.`, { awaitingReply: true });
      }
      return this.response("Qual dia? Por exemplo: 'marque dentista amanhã às 15h'.", { awaitingReply: false });
    }

    const title = extractEventTitle(input);
    const profile = detectEventProfile(`${title} ${input}`);
    const explicitDuration = resolveDurationFromText(input, null);
    const time = resolveTimeFromText(input, null);

    // Sem horário explícito = evento de dia inteiro. Isso deixa frases como
    // “vou viajar na próxima semana na quinta” naturais e sem perguntas extras.
    if (!time || !hasExplicitTime(input)) {
      const startAt = startOfDay(date);
      const endAt = new Date(startAt.getTime() + 86400000);
      const event = await this.calendar.create({
        title,
        startAt,
        endAt,
        source: "conversation",
        category: profile.id,
        allDay: true,
        recurrence
      });
      this.context.lastMentionedEventId = event.id;
      const annual = recurrence?.frequency === "yearly" ? " Vou repetir todo ano." : "";
      return this.response(`Fechou! Coloquei ${title} em ${describeResolvedDate(startAt)} como evento de dia inteiro.${annual}`, {
        action: "event-created",
        event,
        refreshAgenda: true,
        mood: "excited"
      });
    }

    const draft = {
      title,
      date: date.toISOString(),
      profileId: profile.id,
      recurrence
    };

    if (time.ambiguousPeriod) {
      this.context.pendingAction = {
        type: "resolve-create-period",
        draft,
        time,
        explicitDuration
      };

      return this.response(`Você quis dizer ${time.rawHour} da manhã ou ${time.rawHour} da noite?`, {
        awaitingReply: true
      });
    }

    return this.continueCreateWithTime(draft, time, explicitDuration);
  }

  async continueCreateWithTime(draft, time, explicitDuration = null) {
    const startAt = buildDateTime(new Date(draft.date), time);
    const now = new Date();

    if (startAt < now && !draft.recurrence) {
      return this.response(`Esse horário já passou: ${formatDateTime(startAt)}. Me fala outro horário.`);
    }

    const completeDraft = {
      title: draft.title,
      startAt: startAt.toISOString(),
      profileId: draft.profileId,
      recurrence: draft.recurrence || null,
      allDay: false
    };
    if (explicitDuration) return this.finalizeCreateEvent(completeDraft, explicitDuration);

    const profile = getEventProfile(draft.profileId);
    this.context.pendingAction = {
      type: "confirm-duration",
      draft: completeDraft,
      defaultDurationMinutes: profile.defaultDurationMinutes
    };

    return this.response(
      `Pra ${draft.title}, minha duração padrão é ${humanDuration(profile.defaultDurationMinutes)}. Uso esse tempo ou você prefere outra duração?`,
      { awaitingReply: true }
    );
  }

  async finalizeCreateEvent(draft, durationMinutes) {
    const startAt = new Date(draft.startAt);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);
    const profile = getEventProfile(draft.profileId);
    const conflicts = await this.calendar.conflicts(startAt, endAt);

    const event = await this.calendar.create({
      title: draft.title,
      startAt,
      endAt,
      source: "conversation",
      category: profile.id,
      allDay: Boolean(draft.allDay),
      recurrence: draft.recurrence || null
    });

    this.context.lastMentionedEventId = event.id;
    const preAlerts = event.reminderOffsets.filter((offset) => offset > 0);
    const alertText = preAlerts.length
      ? ` Vou te avisar ${preAlerts.map((offset) => `${offset} min`).join(" e ")} antes e também na hora.`
      : " Vou te avisar na hora.";

    const annual = draft.recurrence?.frequency === "yearly" ? " Esse evento vai se repetir todo ano." : "";
    let text = `Fechou! Marquei ${draft.title} para ${describeResolvedDate(startAt)} às ${formatTime(startAt)}, por ${humanDuration(durationMinutes)}.${alertText}${annual}`;
    if (conflicts.length) text += ` Só um detalhe: esse horário conflita com ${conflicts[0].title}, às ${formatTime(new Date(conflicts[0].startAt))}.`;

    return this.response(text, { action: "event-created", event, refreshAgenda: true, mood: "excited" });
  }

  async listEvents(input) {
    const now = new Date();
    const normalized = normalizeText(input);
    let date = resolveDateFromText(input, now);

    if (!date) {
      if (/\bsemana\b/.test(normalized)) {
        const events = await this.calendar.nextDays(7);
        this.context.lastListedEventIds = events.map((event) => event.id);
        return this.formatEventList(events, "Nos próximos 7 dias");
      }
      date = startOfDay(now);
    }

    const events = await this.calendar.forDay(date);
    this.context.lastListedEventIds = events.map((event) => event.id);
    if (events.length === 1) this.context.lastMentionedEventId = events[0].id;
    return this.formatEventList(events, describeResolvedDate(date, now));
  }

  formatEventList(events, label) {
    if (!events.length) return this.response(`Você não tem compromissos em ${label}.`);
    const lines = events.map((event) => event.allDay
      ? `DIA TODO: ${event.title}${event.recurrence?.frequency === "yearly" ? " · anual" : ""}`
      : `${formatTime(new Date(event.startAt))}–${formatTime(new Date(event.endAt))}: ${event.title}`);
    return this.response(`${label}, você tem ${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}:\n${lines.join("\n")}`, { events });
  }

  async nextEvent() {
    const event = await this.calendar.next();
    if (!event) return this.response("Você não tem nenhum compromisso futuro na minha agenda.");
    this.context.lastMentionedEventId = event.id;
    return this.response(`Seu próximo compromisso é ${event.title}, ${formatDateTime(new Date(event.startAt))}.`, { event });
  }

  async freeTime(input) {
    const now = new Date();
    const date = resolveDateFromText(input, now) ?? startOfDay(now);
    const slots = await this.calendar.freeSlots(date);
    if (!slots.length) return this.response(`Entre 8 e 22 horas, não achei janelas livres de pelo menos 30 minutos em ${describeResolvedDate(date, now)}.`);
    const lines = slots.slice(0, 6).map((slot) => `${formatTime(slot.start)} até ${formatTime(slot.end)}`);
    return this.response(`Em ${describeResolvedDate(date, now)}, seus horários livres são:\n${lines.join("\n")}`);
  }

  async daySummary(input) {
    const now = new Date();
    const date = resolveDateFromText(input, now) ?? startOfDay(now);
    const events = await this.calendar.forDay(date);
    if (!events.length) return this.response(`Seu dia tá livre em ${describeResolvedDate(date, now)}!`);
    const timed = events.filter((event) => !event.allDay);
    const allDay = events.filter((event) => event.allDay);
    if (!timed.length) {
      return this.response(`Em ${describeResolvedDate(date, now)}, você tem ${events.length} evento${events.length === 1 ? "" : "s"} de dia inteiro: ${allDay.map((event) => event.title).join(", ")}.`);
    }
    const first = timed[0];
    const last = timed[timed.length - 1];
    const prefix = allDay.length ? `${allDay.length} de dia inteiro e ` : "";
    return this.response(`Em ${describeResolvedDate(date, now)}, você tem ${prefix}${timed.length} com horário. O primeiro é ${first.title} às ${formatTime(new Date(first.startAt))}, e o último termina às ${formatTime(new Date(last.endAt))}.`);
  }

  async deleteEvent(input) {
    const query = this.extractTargetQuery(input, [
      "cancele", "cancela", "cancelar", "apague", "apaga", "delete", "deleta", "remova", "remove", "compromisso", "evento", "o", "a"
    ]);

    let candidates = [];
    if (query) candidates = await this.calendar.search(query, { futureOnly: true });
    else if (this.context.lastMentionedEventId) {
      const event = await this.calendar.get(this.context.lastMentionedEventId);
      if (event) candidates = [event];
    }

    const date = resolveDateFromText(input);
    if (date && candidates.length) {
      candidates = candidates.filter((event) => {
        const start = new Date(event.startAt);
        return start.getFullYear() === date.getFullYear() && start.getMonth() === date.getMonth() && start.getDate() === date.getDate();
      });
    }

    if (!candidates.length) return this.response("Não achei um compromisso futuro correspondente pra cancelar.");
    if (candidates.length > 1) {
      const choices = candidates.slice(0, 5).map((event, index) => `${index + 1}. ${event.title} — ${formatDateTime(new Date(event.startAt))}`).join("\n");
      return this.response(`Achei mais de um. Me diz qual deles:\n${choices}`);
    }

    const event = candidates[0];
    if (event.locked) return this.response(`${event.title} é um evento fixo da linhagem e não pode ser removido.`);
    await this.calendar.remove(event.id);
    if (this.context.lastMentionedEventId === event.id) this.context.lastMentionedEventId = null;
    return this.response(`Cancelei ${event.title}, que estava marcado para ${formatDateTime(new Date(event.startAt))}.`, { action: "event-deleted", refreshAgenda: true });
  }

  async moveEvent(input) {
    const newDate = resolveDateFromText(input);
    const newTime = resolveTimeFromText(input);
    if (!newDate || !newTime) return this.response("Pra remarcar, preciso da nova data e do horário. Exemplo: 'adie dentista para sexta às 16h'.");

    const query = this.extractTargetQuery(input, [
      "adie", "adia", "adiar", "mude", "muda", "remarque", "remarca", "reagende", "reagenda", "compromisso", "evento", "para"
    ], true);

    let candidates = query ? await this.calendar.search(query, { futureOnly: true }) : [];
    if (!candidates.length && this.context.lastMentionedEventId) {
      const event = await this.calendar.get(this.context.lastMentionedEventId);
      if (event) candidates = [event];
    }

    if (!candidates.length) return this.response("Não achei qual compromisso você quer remarcar.");
    if (candidates.length > 1) return this.response(`Achei ${candidates.length} compromissos parecidos. Me dá um nome mais específico.`);

    const event = candidates[0];
    if (event.locked) return this.response(`${event.title} é um evento fixo da linhagem e não pode ser remarcado.`);

    if (newTime.ambiguousPeriod) {
      this.context.pendingAction = {
        type: "resolve-move-period",
        eventId: event.id,
        date: newDate.toISOString(),
        time: newTime
      };
      return this.response(`É ${newTime.rawHour} da manhã ou ${newTime.rawHour} da noite?`, { awaitingReply: true });
    }

    return this.finalizeMoveEvent(event.id, newDate, newTime);
  }

  async finalizeMoveEvent(eventId, newDate, newTime) {
    const event = await this.calendar.get(eventId);
    if (!event) return this.response("Esse compromisso não existe mais.");

    const oldStart = new Date(event.startAt);
    const oldEnd = new Date(event.endAt);
    const duration = oldEnd - oldStart;
    const startAt = buildDateTime(newDate, newTime);
    const endAt = new Date(startAt.getTime() + duration);
    const conflicts = await this.calendar.conflicts(startAt, endAt, event.id);
    const updated = await this.calendar.update(event.id, { startAt, endAt });
    this.context.lastMentionedEventId = updated.id;

    let text = `Remarquei ${updated.title} para ${formatDateTime(startAt)}.`;
    if (conflicts.length) text += ` Só que existe conflito com ${conflicts[0].title}.`;
    return this.response(text, { action: "event-updated", refreshAgenda: true });
  }

  extractTargetQuery(input, stopWords, stripAfterPara = false) {
    let text = normalizeText(input).replace(/\bjordan\b/g, " ");
    if (stripAfterPara) text = text.split(/\bpara\b/)[0];

    const dateWords = [
      "hoje", "amanha", "depois de amanha", "segunda", "segunda feira", "terca", "terca feira",
      "quarta", "quarta feira", "quinta", "quinta feira", "sexta", "sexta feira", "sabado", "domingo"
    ];

    for (const word of [...stopWords, ...dateWords]) {
      text = text.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
    }

    return text
      .replace(/\bdia\s+\d{1,2}(?:\s+de\s+[a-z]+)?/g, " ")
      .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, " ")
      .replace(/\b(?:as|a|pelas?)?\s*\d{1,2}(?::\d{2}|h\d{0,2})?\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

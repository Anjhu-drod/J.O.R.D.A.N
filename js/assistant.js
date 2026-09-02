import {
  buildDateTime,
  describeResolvedDate,
  extractEventTitle,
  resolveDateFromText,
  resolveDurationFromText,
  resolveStandaloneDurationFromText,
  resolveTimeFromText
} from "./dateParser.js";

import {
  detectEventProfile,
  getEventProfile
} from "./eventProfiles.js";

import {
  formatDateTime,
  formatTime,
  humanDuration,
  normalizeText,
  startOfDay
} from "./utils.js";

export class JordanAssistant {
  constructor(calendar, memory) {
    this.calendar = calendar;
    this.memory = memory;
    this.speechStyle = "neutral";

    this.context = {
      lastMentionedEventId: null,
      lastListedEventIds: [],
      pendingAction: null
    };
  }

  async initialize() {
    this.speechStyle = await this.memory.getPreference("speechStyle", "neutral");
  }

  async execute(rawInput) {
    const original = rawInput.trim();
    const normalizedOriginal = normalizeText(original);
    const text = normalizedOriginal.replace(/^jordan\s+/, "").trim();

    if (!text) {
      return this.response("Estou ouvindo.");
    }

    if (this.context.pendingAction) {
      const pendingResult = await this.handlePendingAction(original, text);
      if (pendingResult) return pendingResult;
    }

    const memoryTeaching = await this.tryTeachMemory(original, text);
    if (memoryTeaching) return memoryTeaching;

    const memoryQuery = await this.tryMemoryQuery(original, text);
    if (memoryQuery) return memoryQuery;

    if (this.isOpenCalendarIntent(text)) {
      return this.response("Abrindo meu calendário.", {
        action: "open-view",
        view: "calendar"
      });
    }

    if (this.isOpenMemoryIntent(text)) {
      return this.response("Abrindo minha memória.", {
        action: "open-view",
        view: "memory"
      });
    }

    if (this.isHelp(text)) return this.help();
    if (this.isGreeting(text)) return this.greeting();

    if (this.isCreateIntent(text)) return this.createEvent(original);
    if (this.isMoveIntent(text)) return this.moveEvent(original);
    if (this.isDeleteIntent(text)) return this.deleteEvent(original);
    if (this.isFreeTimeIntent(text)) return this.freeTime(original);
    if (this.isNextIntent(text)) return this.nextEvent();
    if (this.isListIntent(text)) return this.listEvents(original);
    if (this.isDaySummaryIntent(text)) return this.daySummary(original);

    return this.response(
      "Ainda não entendi bem isso. Você pode me ensinar informações sobre você, pedir para eu mudar meu jeito de falar ou usar minha agenda. Se quiser, diga “Jordan, ajuda”.",
      { understood: false }
    );
  }

  response(text, extra = {}) {
    const styled = this.applySpeechStyle(text);

    return {
      text: styled,
      speak: styled,
      understood: true,
      ...extra
    };
  }

  applySpeechStyle(text) {
    if (this.speechStyle === "informal") {
      return text
        .replace(/^Certo\./, "Fechou.")
        .replace(/^Entendi\./, "Saquei.")
        .replace(/^Entendido\./, "Fechou.")
        .replace(/Não encontrei/g, "Não achei")
        .replace(/Você não tem/g, "Você não tem");
    }

    if (this.speechStyle === "formal") {
      return text
        .replace(/^Certo\./, "Entendido.")
        .replace(/^Fechou\./, "Entendido.")
        .replace(/^Saquei\./, "Compreendi.")
        .replace(/Não achei/g, "Não encontrei");
    }

    return text;
  }

  isHelp(text) {
    return /\b(ajuda|comandos|o que voce faz|oque voce faz)\b/.test(text);
  }

  isGreeting(text) {
    return /^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)\b/.test(text);
  }

  isCreateIntent(text) {
    return /\b(marque|marca|agende|agenda|agendar|adicione|adiciona|crie|cria|coloque|coloca|me lembre|me lembra)\b/.test(text);
  }

  isDeleteIntent(text) {
    return /\b(cancele|cancela|cancelar|apague|apaga|delete|deleta|remova|remove)\b/.test(text);
  }

  isMoveIntent(text) {
    return /\b(adie|adia|adiar|mude|muda|remarque|remarca|reagende|reagenda)\b/.test(text);
  }

  isFreeTimeIntent(text) {
    return /\b(horario livre|horarios livres|tempo livre|estou livre|quando estou livre|quando to livre)\b/.test(text);
  }

  isNextIntent(text) {
    return /\b(proximo compromisso|proximo evento|qual e o proximo|qual meu proximo)\b/.test(text);
  }

  isListIntent(text) {
    return (
      /\b(o que tenho|oque tenho|minha agenda|meus compromissos|quais compromissos|agenda de|agenda para)\b/.test(text) ||
      /\b(tenho algo|tem algo)\b/.test(text)
    );
  }

  isDaySummaryIntent(text) {
    return /\b(como esta meu dia|como ta meu dia|resumo do dia|planejamento do dia)\b/.test(text);
  }

  isOpenCalendarIntent(text) {
    return /\b(abra|abre|mostrar|mostra|ver|quero ver)\b.*\b(calendario|agenda)\b/.test(text);
  }

  isOpenMemoryIntent(text) {
    return /\b(abra|abre|mostrar|mostra|ver|quero ver)\b.*\b(memoria|o que voce sabe)\b/.test(text);
  }

  greeting() {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Bom dia." :
      hour < 18 ? "Boa tarde." :
      "Boa noite.";

    return this.response(`${greeting} Estou aqui.`);
  }

  help() {
    return this.response(
`Eu já consigo conversar com você em algumas áreas:

• “Marque dentista amanhã às 15h”
• “Marque trabalho sexta às 8h por 8 horas”
• “O que tenho amanhã?”
• “Qual meu próximo compromisso?”
• “Quais horários livres tenho amanhã?”
• “Adie dentista para sexta às 16h”
• “Cancele dentista”
• “Abra meu calendário”

Você também pode me ensinar:
• “Eu moro em Tijucas”
• “Meu número de telefone é ...”
• “Meu nome é ...”
• “Eu gosto de anime”
• “Lembre que ...”
• “Fale com gírias”
• “Fique mais formal”
• “O que você sabe sobre mim?”`
    );
  }

  async handlePendingAction(original, text) {
    const pending = this.context.pendingAction;
    if (!pending) return null;

    if (pending.type === "confirm-duration") {
      if (/\b(cancela|cancelar|deixa|deixa pra la|esquece|nao marque)\b/.test(text)) {
        this.context.pendingAction = null;
        return this.response("Certo. Não vou criar esse compromisso.");
      }

      const explicitDuration = resolveStandaloneDurationFromText(original, null);
      if (explicitDuration) {
        this.context.pendingAction = null;
        return this.finalizeCreateEvent(pending.draft, explicitDuration);
      }

      if (/\b(sim|pode|pode ser|padrao|usa o padrao|usar o padrao|isso|ok|certo|confirmo|fechou)\b/.test(text)) {
        this.context.pendingAction = null;
        return this.finalizeCreateEvent(
          pending.draft,
          pending.defaultDurationMinutes
        );
      }

      if (/\b(nao|outra duracao|outro tempo)\b/.test(text)) {
        return this.response(
          `Sem problema. Qual duração você quer para ${pending.draft.title}? Pode dizer, por exemplo, “30 minutos” ou “2 horas”.`
        );
      }

      // Se a pessoa chamou a JORDAN de novo com um comando claramente diferente,
      // abandonamos a pergunta anterior e processamos o novo comando normalmente.
      if (/^jordan\b/.test(normalizeText(original)) && this.looksLikeNewCommand(text)) {
        this.context.pendingAction = null;
        return null;
      }

      return this.response(
        `Só preciso definir a duração de ${pending.draft.title}. Minha sugestão é ${humanDuration(pending.defaultDurationMinutes)}. Quer usar esse tempo?`
      );
    }

    return null;
  }

  looksLikeNewCommand(text) {
    return (
      this.isCreateIntent(text) ||
      this.isDeleteIntent(text) ||
      this.isMoveIntent(text) ||
      this.isListIntent(text) ||
      this.isNextIntent(text) ||
      this.isFreeTimeIntent(text) ||
      this.isOpenCalendarIntent(text) ||
      this.isOpenMemoryIntent(text)
    );
  }

  async tryTeachMemory(original, text) {
    const originalClean = original
      .replace(/^\s*jordan[\s,:-]*/i, "")
      .trim();

    if (/\b(fale|fala|deve falar|quero que voce fale)\b.*\b(giria|girias|informal|casual)\b/.test(text) || /\b(fique|seja) mais informal\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "informal", "Estilo de fala");
      this.speechStyle = "informal";
      return this.response("Certo. Vou falar de um jeito mais solto e usar umas gírias sem exagerar.", {
        refreshMemory: true
      });
    }

    if (/\b(fique|seja|fale|fala)\b.*\b(mais formal|formalmente|formal)\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "formal", "Estilo de fala");
      this.speechStyle = "formal";
      return this.response("Certo. A partir de agora vou responder de forma mais formal.", {
        refreshMemory: true
      });
    }

    if (/\b(volte|fala|fale|fique)\b.*\b(normal|neutro|neutra|normalmente)\b/.test(text)) {
      await this.memory.setPreference("speechStyle", "neutral", "Estilo de fala");
      this.speechStyle = "neutral";
      return this.response("Certo. Voltei para meu jeito normal de falar.", {
        refreshMemory: true
      });
    }

    let match = originalClean.match(/\b(?:meu nome (?:é|e|eh)|eu me chamo|pode me chamar de)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      await this.memory.remember({
        key: "profile.name",
        label: "Nome",
        value,
        type: "fact"
      });
      return this.response(`Aprendi. Seu nome é ${value}.`, { refreshMemory: true });
    }

    match = originalClean.match(/\b(?:eu moro em|eu moro no|eu moro na|moro em|moro no|moro na)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      await this.memory.remember({
        key: "profile.home",
        label: "Onde você mora",
        value,
        type: "fact"
      });
      return this.response(`Aprendi. Você mora em ${value}.`, { refreshMemory: true });
    }

    match = originalClean.match(/\bmeu n(?:ú|u)mero(?: de telefone| do telefone| do celular| de celular)?\s+(?:é|e|eh)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1], { keepPunctuation: true });
      await this.memory.remember({
        key: "profile.phone",
        label: "Número de telefone",
        value,
        type: "fact"
      });
      return this.response("Aprendi seu número de telefone e guardei na minha memória local.", {
        refreshMemory: true
      });
    }

    match = originalClean.match(/\beu gosto de\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1]);
      const keySuffix = normalizeText(value).replace(/\s+/g, "-").slice(0, 45);
      await this.memory.remember({
        key: `profile.like.${keySuffix}`,
        label: "Gosta de",
        value,
        type: "fact"
      });
      return this.response(`Aprendi que você gosta de ${value}.`, {
        refreshMemory: true
      });
    }

    match = originalClean.match(/\b(?:meu|minha)\s+(.{2,40}?)\s+(?:é|e|eh)\s+(.+)/i);
    if (match && !/\b(proximo compromisso|agenda|evento)\b/.test(text)) {
      const label = this.cleanLearnedValue(match[1]);
      const value = this.cleanLearnedValue(match[2], { keepPunctuation: true });
      const key = `profile.custom.${normalizeText(label).replace(/\s+/g, "-").slice(0, 50)}`;

      await this.memory.remember({
        key,
        label,
        value,
        type: "fact"
      });

      return this.response(`Aprendi: ${label} é ${value}.`, {
        refreshMemory: true
      });
    }

    match = originalClean.match(/\b(?:lembre que|lembra que|guarde que|aprenda que)\s+(.+)/i);
    if (match) {
      const value = this.cleanLearnedValue(match[1], { keepPunctuation: true });
      const keySuffix = normalizeText(value).replace(/\s+/g, "-").slice(0, 55);

      await this.memory.remember({
        key: `profile.note.${keySuffix}`,
        label: "Informação ensinada",
        value,
        type: "fact"
      });

      return this.response("Certo. Guardei isso na minha memória.", {
        refreshMemory: true
      });
    }

    return null;
  }

  async tryMemoryQuery(original, text) {
    if (/\b(onde eu moro|aonde eu moro)\b/.test(text)) {
      const memory = await this.memory.get("profile.home");
      return memory
        ? this.response(`Você me ensinou que mora em ${memory.value}.`)
        : this.response("Você ainda não me ensinou onde mora.");
    }

    if (/\b(qual meu nome|como eu me chamo)\b/.test(text)) {
      const memory = await this.memory.get("profile.name");
      return memory
        ? this.response(`Seu nome é ${memory.value}.`)
        : this.response("Você ainda não me ensinou seu nome.");
    }

    if (/\b(qual meu numero|meu numero de telefone|qual meu telefone)\b/.test(text)) {
      const memory = await this.memory.get("profile.phone");
      return memory
        ? this.response(`O número que você me ensinou é ${memory.value}.`)
        : this.response("Você ainda não me ensinou seu número de telefone.");
    }

    if (/\b(o que eu gosto|do que eu gosto)\b/.test(text)) {
      const all = await this.memory.all();
      const likes = all.filter((memory) => memory.key.startsWith("profile.like."));

      if (!likes.length) {
        return this.response("Você ainda não me ensinou do que gosta.");
      }

      return this.response(
        `Você me ensinou que gosta de ${likes.map((item) => item.value).join(", ")}.`
      );
    }

    if (/\b(o que voce sabe sobre mim|oque voce sabe sobre mim|o que lembra de mim|minhas informacoes)\b/.test(text)) {
      const facts = await this.memory.summarizeFacts(10);

      if (!facts.length) {
        return this.response("Minha memória sobre você ainda está vazia. Você pode começar me ensinando alguma coisa.");
      }

      const lines = facts.map((memory) => `• ${memory.label}: ${memory.value}`);
      return this.response(`Isto é o que eu lembro por enquanto:\n${lines.join("\n")}`, {
        action: "open-view",
        view: "memory"
      });
    }

    const forgetMatch = text.match(/\b(?:esqueca|esquece|apague da memoria|remova da memoria)\s+(.+)/);
    if (forgetMatch) {
      const query = this.cleanLearnedValue(forgetMatch[1]);
      const matches = await this.memory.find(query);

      if (!matches.length) {
        return this.response("Não encontrei essa informação na minha memória.");
      }

      await this.memory.forget(matches[0].id);
      return this.response(`Esqueci a informação “${matches[0].label}”.`, {
        refreshMemory: true
      });
    }

    const genericQuery = text.match(/\bqual (?:e|eh)?\s*(?:o|a)?\s*(?:meu|minha)\s+(.+)/);
    if (genericQuery) {
      const query = this.cleanLearnedValue(genericQuery[1]);
      const matches = await this.memory.find(query);

      if (matches.length) {
        return this.response(`${matches[0].label}: ${matches[0].value}.`);
      }
    }

    return null;
  }

  cleanLearnedValue(value, { keepPunctuation = false } = {}) {
    let cleaned = value.trim();

    if (!keepPunctuation) {
      cleaned = cleaned.replace(/[.?!]+$/g, "");
    }

    return cleaned;
  }

  async createEvent(input) {
    const now = new Date();
    const date = resolveDateFromText(input, now);

    if (!date) {
      return this.response(
        "Entendi que você quer criar um compromisso, mas faltou a data. Por exemplo: “marque dentista amanhã às 15h”."
      );
    }

    const time = resolveTimeFromText(input);
    if (!time) {
      return this.response(
        `Entendi a data, ${describeResolvedDate(date)}, mas faltou o horário.`
      );
    }

    const startAt = buildDateTime(date, time);
    const title = extractEventTitle(input);
    const profile = detectEventProfile(`${title} ${input}`);
    const explicitDuration = resolveDurationFromText(input, null);

    if (startAt < now) {
      return this.response(
        `Esse horário já passou: ${formatDateTime(startAt)}. Diga outro horário.`
      );
    }

    const draft = {
      title,
      startAt: startAt.toISOString(),
      profileId: profile.id
    };

    if (explicitDuration) {
      return this.finalizeCreateEvent(draft, explicitDuration);
    }

    this.context.pendingAction = {
      type: "confirm-duration",
      draft,
      defaultDurationMinutes: profile.defaultDurationMinutes
    };

    return this.response(
      `Para ${title}, minha duração padrão é ${humanDuration(profile.defaultDurationMinutes)}. Quer usar esse tempo ou prefere outra duração?`,
      {
        awaitingReply: true
      }
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
      category: profile.id
    });

    this.context.lastMentionedEventId = event.id;

    const preAlerts = event.reminderOffsets.filter((offset) => offset > 0);
    let alertText = "";

    if (preAlerts.length) {
      const readable = preAlerts.map((offset) => `${offset} min`).join(" e ");
      alertText = ` Preparei avisos internos ${readable} antes e também no horário.`;
    } else {
      alertText = " Preparei um aviso interno no horário.";
    }

    let text = `Certo. Marquei ${draft.title} para ${describeResolvedDate(startAt)} às ${formatTime(startAt)}, com duração de ${humanDuration(durationMinutes)}.${alertText}`;

    if (conflicts.length) {
      text += ` Atenção: esse horário entra em conflito com ${conflicts[0].title}, às ${formatTime(new Date(conflicts[0].startAt))}.`;
    }

    return this.response(text, {
      action: "event-created",
      event,
      refreshAgenda: true
    });
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

    if (events.length === 1) {
      this.context.lastMentionedEventId = events[0].id;
    }

    return this.formatEventList(events, describeResolvedDate(date, now));
  }

  formatEventList(events, label) {
    if (!events.length) {
      return this.response(`Você não tem compromissos em ${label}.`);
    }

    const lines = events.map((event) => {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      return `${formatTime(start)}–${formatTime(end)}: ${event.title}`;
    });

    return this.response(
      `${label}, você tem ${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}:\n${lines.join("\n")}`,
      { events }
    );
  }

  async nextEvent() {
    const event = await this.calendar.next();

    if (!event) {
      return this.response("Você não tem nenhum compromisso futuro na minha agenda.");
    }

    this.context.lastMentionedEventId = event.id;

    return this.response(
      `Seu próximo compromisso é ${event.title}, ${formatDateTime(new Date(event.startAt))}.`,
      { event }
    );
  }

  async freeTime(input) {
    const now = new Date();
    const date = resolveDateFromText(input, now) ?? startOfDay(now);
    const slots = await this.calendar.freeSlots(date);

    if (!slots.length) {
      return this.response(
        `Entre 8 e 22 horas, não encontrei janelas livres de pelo menos 30 minutos em ${describeResolvedDate(date, now)}.`
      );
    }

    const lines = slots
      .slice(0, 6)
      .map((slot) => `${formatTime(slot.start)} até ${formatTime(slot.end)}`);

    return this.response(
      `Em ${describeResolvedDate(date, now)}, seus horários livres são:\n${lines.join("\n")}`
    );
  }

  async daySummary(input) {
    const now = new Date();
    const date = resolveDateFromText(input, now) ?? startOfDay(now);
    const events = await this.calendar.forDay(date);

    if (!events.length) {
      return this.response(
        `Seu dia está livre em ${describeResolvedDate(date, now)}.`
      );
    }

    const first = events[0];
    const last = events[events.length - 1];

    return this.response(
      `Em ${describeResolvedDate(date, now)}, você tem ${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}. O primeiro é ${first.title} às ${formatTime(new Date(first.startAt))}, e o último termina às ${formatTime(new Date(last.endAt))}.`
    );
  }

  async deleteEvent(input) {
    const query = this.extractTargetQuery(input, [
      "cancele", "cancela", "cancelar", "apague", "apaga",
      "delete", "deleta", "remova", "remove",
      "compromisso", "evento", "o", "a"
    ]);

    let candidates = [];

    if (query) {
      candidates = await this.calendar.search(query, { futureOnly: true });
    } else if (this.context.lastMentionedEventId) {
      const event = await this.calendar.get(this.context.lastMentionedEventId);
      if (event) candidates = [event];
    }

    const date = resolveDateFromText(input);
    if (date && candidates.length) {
      candidates = candidates.filter((event) => {
        const start = new Date(event.startAt);
        return (
          start.getFullYear() === date.getFullYear() &&
          start.getMonth() === date.getMonth() &&
          start.getDate() === date.getDate()
        );
      });
    }

    if (!candidates.length) {
      return this.response(
        "Não encontrei um compromisso futuro correspondente para cancelar."
      );
    }

    if (candidates.length > 1) {
      const choices = candidates
        .slice(0, 5)
        .map((event, index) => `${index + 1}. ${event.title} — ${formatDateTime(new Date(event.startAt))}`)
        .join("\n");

      return this.response(
        `Encontrei mais de um compromisso. Seja mais específico:\n${choices}`
      );
    }

    const event = candidates[0];
    await this.calendar.remove(event.id);

    if (this.context.lastMentionedEventId === event.id) {
      this.context.lastMentionedEventId = null;
    }

    return this.response(
      `Cancelei ${event.title}, que estava marcado para ${formatDateTime(new Date(event.startAt))}.`,
      { action: "event-deleted", refreshAgenda: true }
    );
  }

  async moveEvent(input) {
    const newDate = resolveDateFromText(input);
    const newTime = resolveTimeFromText(input);

    if (!newDate || !newTime) {
      return this.response(
        "Para remarcar, preciso da nova data e do novo horário. Exemplo: “adie dentista para sexta às 16h”."
      );
    }

    const query = this.extractTargetQuery(input, [
      "adie", "adia", "adiar", "mude", "muda",
      "remarque", "remarca", "reagende", "reagenda",
      "compromisso", "evento", "para"
    ], true);

    let candidates = query
      ? await this.calendar.search(query, { futureOnly: true })
      : [];

    if (!candidates.length && this.context.lastMentionedEventId) {
      const event = await this.calendar.get(this.context.lastMentionedEventId);
      if (event) candidates = [event];
    }

    if (!candidates.length) {
      return this.response("Não encontrei qual compromisso você quer remarcar.");
    }

    if (candidates.length > 1) {
      return this.response(
        `Encontrei ${candidates.length} compromissos parecidos. Diga o nome com mais detalhes.`
      );
    }

    const event = candidates[0];
    const oldStart = new Date(event.startAt);
    const oldEnd = new Date(event.endAt);
    const duration = oldEnd - oldStart;

    const startAt = buildDateTime(newDate, newTime);
    const endAt = new Date(startAt.getTime() + duration);
    const conflicts = await this.calendar.conflicts(startAt, endAt, event.id);

    const updated = await this.calendar.update(event.id, {
      startAt,
      endAt
    });

    this.context.lastMentionedEventId = updated.id;

    let text = `Remarquei ${updated.title} para ${formatDateTime(startAt)}.`;

    if (conflicts.length) {
      text += ` Atenção: existe conflito com ${conflicts[0].title}.`;
    }

    return this.response(text, {
      action: "event-updated",
      refreshAgenda: true
    });
  }

  extractTargetQuery(input, stopWords, stripAfterPara = false) {
    let text = normalizeText(input).replace(/\bjordan\b/g, " ");

    if (stripAfterPara) {
      text = text.split(/\bpara\b/)[0];
    }

    const dateWords = [
      "hoje", "amanha", "depois de amanha",
      "segunda", "segunda feira", "terca", "terca feira",
      "quarta", "quarta feira", "quinta", "quinta feira",
      "sexta", "sexta feira", "sabado", "domingo"
    ];

    for (const word of [...stopWords, ...dateWords]) {
      text = text.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
    }

    text = text
      .replace(/\bdia\s+\d{1,2}(?:\s+de\s+[a-z]+)?/g, " ")
      .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, " ")
      .replace(/\b(?:as|a|pelas?)?\s*\d{1,2}(?::\d{2}|h\d{0,2})?\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text;
  }
}

const CORE_VERSION = "2.1";
const HISTORY_KEY = "jordan.manual-core-context-v2";
const MAX_HISTORY = 20;
const PENDING_KEY = "jordan.manual-core-pending-v2";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”‘’]/g, "\"")
    .replace(/[^a-z0-9À-ÿ+\-*/^%(),.?!:\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutWakeWord(value = "") {
  return String(value || "")
    .replace(/^\s*jordan\s*[,;:!?.-]?\s*/i, "")
    .trim();
}

function choose(list = []) {
  if (!list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}

function sentenceCase(value = "") {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function trimPunctuation(value = "") {
  return String(value || "").replace(/[?!.,;:]+$/g, "").trim();
}

function clip(value = "", max = 120) {
  const text = String(value || "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function findMathExpression(raw = "") {
  let value = withoutWakeWord(raw)
    .replace(/^\s*(?:calcule|calcula|calcular|quanto (?:e|é)|qual (?:e|é) o resultado de|resultado de|resolve|resolva)\s*/i, "")
    .replace(/\bvezes\b/gi, "*")
    .replace(/\bdividido por\b/gi, "/")
    .replace(/\bmais\b/gi, "+")
    .replace(/\bmenos\b/gi, "-")
    .replace(/\belevado a\b/gi, "^")
    .replace(/[?=]+$/g, "")
    .trim();

  if (!/[0-9)]/.test(value)) return null;
  if (!/[+\-*/^%()]|\b(?:sqrt|sin|cos|tan|log|ln|pow|min|max|abs|round|floor|ceil)\b/i.test(value)) return null;
  return value;
}

function extractSearchQuery(raw = "", context = {}) {
  const original = withoutWakeWord(raw);
  const normalized = normalizeText(original);
  const fullName = String(context?.user?.fullName || context?.user?.firstName || "").trim();

  if (/\b(?:ache|procure|pesquise|busque)\b.*\b(?:meu nome|me na internet|sobre mim)\b/.test(normalized) && fullName) {
    return fullName;
  }

  const match = original.match(/^(?:ache|procure|pesquise|busque|investigue)\s+(?:na internet\s+|online\s+)?(.+)$/i);
  if (match?.[1]) return trimPunctuation(match[1]);
  return null;
}

function extractNearbyCategory(text = "") {
  text = normalizeText(text);
  if (/\b(?:posto|gasolina|combustivel)\b/.test(text)) return "fuel";
  if (/\b(?:farmacia|remedio)\b/.test(text)) return "pharmacy";
  if (/\b(?:hospital|pronto socorro|upa)\b/.test(text)) return "hospital";
  if (/\b(?:mercado|supermercado)\b/.test(text)) return "supermarket";
  if (/\b(?:restaurante|comer|comida)\b/.test(text)) return "restaurant";
  return null;
}

function extractChessMove(text = "") {
  const match = text.match(/\b([a-h][1-8])\s*(?:para|pra|ate|->|x|-)?\s*([a-h][1-8])\b/i);
  if (!match) return null;
  return { from: match[1].toLowerCase(), to: match[2].toLowerCase() };
}

function extractView(text = "") {
  const map = [
    ["calendar", /\b(?:calendario|agenda)\b/],
    ["memory", /\b(?:memoria)\b/],
    ["messages", /\b(?:mensagens|recados)\b/],
    ["system", /\b(?:sistema|configuracoes|configuracao|sys)\b/],
    ["games", /\b(?:xadrez|chess|jogos|game)\b/],
    ["core", /\b(?:inicio|home|core principal)\b/]
  ];
  return map.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function extractApp(text = "") {
  const map = [
    ["youtube", /\byoutube\b/],
    ["gmail", /\b(?:gmail|email|e-mail)\b/],
    ["maps", /\b(?:google maps|maps|mapas)\b/],
    ["whatsapp", /\b(?:whatsapp|whats)\b/],
    ["google", /\bgoogle\b/],
    ["instagram", /\binstagram\b/]
  ];
  return map.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function extractMemoryTeaching(raw = "") {
  const original = withoutWakeWord(raw);
  const patterns = [
    /^(?:lembre|lembra|guarde|guarda|memorize|anote)\s+(?:que\s+)?(.+)$/i,
    /^(?:quero que voce lembre|não esqueça|nao esqueca)\s+(?:que\s+)?(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) return trimPunctuation(match[1]);
  }
  return null;
}

function extractMemoryQuery(raw = "") {
  const original = withoutWakeWord(raw);
  const match = original.match(/^(?:o que voce lembra sobre|o que voce sabe sobre|procure na memoria|busque na memoria|lembra de)\s+(.+)$/i);
  return match?.[1] ? trimPunctuation(match[1]) : null;
}

function formatAgenda(events = [], range = "upcoming") {
  if (!events.length) {
    return range === "today" ? "Hoje sua agenda está livre." : range === "tomorrow" ? "Amanhã sua agenda está livre." : "Não encontrei compromissos próximos.";
  }
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const lines = events.slice(0, 6).map((event, index) => {
    const when = event.allDay ? "dia inteiro" : formatter.format(new Date(event.startAt));
    return `${index + 1}. ${event.title} — ${when}`;
  });
  return `${range === "today" ? "Hoje" : range === "tomorrow" ? "Amanhã" : "Próximos compromissos"}:\n${lines.join("\n")}`;
}

function humanLocation(result = {}) {
  const bits = [result.neighbourhood, result.city, result.state, result.country].filter(Boolean);
  const place = bits.length ? bits.join(", ") : result.label;
  const accuracy = Number(result.accuracy_m);
  return `Pelo dispositivo, você está em ${place || "uma posição que o navegador conseguiu localizar"}${Number.isFinite(accuracy) ? `, com precisão aproximada de ${Math.round(accuracy)} metros` : ""}.`;
}

function makeJoke() {
  const jokes = [
    () => "Por que o computador foi ao médico? Porque ele pegou um vírus. Sim, eu sei… piada de silício nível tiozão. 😅",
    () => "Eu tentei jogar xadrez contra uma nuvem ontem. Perdi. Ela tinha muitos movimentos em paralelo.",
    () => "Qual é o café favorito de um programador? Java. O segundo favorito é qualquer um que mantenha ele acordado depois das 2 da manhã.",
    () => "Um bug entrou num bar. O programador disse: ‘isso não estava nos requisitos’. O bug respondeu: ‘agora está’."
  ];
  return choose(jokes)();
}


function looksLikeQuestionOrRequest(original = "", normalized = "") {
  const text = normalized || normalizeText(original);
  if (/[?？]\s*$/.test(String(original).trim())) return true;
  return /^(?:quem|o que|oque|qual|quais|como|onde|quando|por que|porque|me diga|me fale|me explica|explique|me ensine|ensine|me cita|cite|liste|quero saber|voce conhece|você conhece|o que acontece|oque acontece|o que aconteceria|oque aconteceria)\b/.test(text);
}

function extractAutomationIntervalMs(text = "") {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:a cada|intervalo(?: de)?|cada|de)\s*(\d+(?:[.,]\d+)?)\s*(ms|milissegundos?|s|segundos?|min|minutos?)\b/);
  if (!match) return 250;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return 250;
  const unit = match[2];
  if (/^s|segundo/.test(unit)) return Math.round(value * 1000);
  if (/^min/.test(unit)) return Math.round(value * 60000);
  return Math.round(value);
}

function extractAutomationAction(raw = "") {
  const original = withoutWakeWord(raw);
  const text = normalizeText(original);
  const point = text.match(/\bx\s*(-?\d+)\s*(?:[,; ]+|e\s+)y\s*(-?\d+)\b/);
  if (/\b(?:mouse direito|clique direito|botao direito|botão direito)\b/.test(text)) {
    return { kind: "mouse_right", x: point ? Number(point[1]) : null, y: point ? Number(point[2]) : null };
  }
  if (/\b(?:mouse do meio|clique do meio|botao do meio|botão do meio)\b/.test(text)) {
    return { kind: "mouse_middle", x: point ? Number(point[1]) : null, y: point ? Number(point[2]) : null };
  }
  if (/\b(?:mouse esquerdo|clique esquerdo|botao esquerdo|botão esquerdo|autoclick|auto clique)\b/.test(text) && !/\btecla\b/.test(text)) {
    return { kind: point ? "screen_tap" : "mouse_left", x: point ? Number(point[1]) : null, y: point ? Number(point[2]) : null };
  }
  const keyMatch = original.match(/(?:tecla|aperte|pressione|pressionar)\s+(?:a\s+tecla\s+)?([a-z0-9+_-]{1,40})/i);
  if (keyMatch?.[1]) return { kind: "key", key: keyMatch[1] };
  return null;
}

function extractVoiceMacroDefinition(raw = "") {
  const original = withoutWakeWord(raw).trim();
  const match = original.match(/^(?:quando eu disser|quando eu falar|se eu disser|se eu falar)\s+[“\"']?(.+?)[”\"']?\s*,?\s*(?:aperte|pressione|aperta|pressiona)\s+(?:a\s+tecla\s+)?([a-z0-9+_-]{1,40})[.!?]*$/i);
  if (!match) return null;
  return { phrase: trimPunctuation(match[1]), kind: "key", key: match[2] };
}

function topicFromText(raw = "") {
  const stop = new Set(["jordan","voce","eu","meu","minha","um","uma","o","a","os","as","de","do","da","dos","das","que","e","em","no","na","para","pra","por","com","isso","isto","aquilo","me","te","se","como","qual","quem","onde","quando","porque"]);
  const words = normalizeText(raw)
    .replace(/[^a-z0-9À-ÿ\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stop.has(word));
  return words.slice(0, 4).join(" ");
}

export class ManualCoreService {
  constructor() {
    this.enabled = true;
    this.history = [];
    this.lastTopic = "";
    this.lastIntent = "";
    this.pendingClarification = null;
    this._loadHistory();
  }

  configure({ enabled = this.enabled } = {}) {
    this.enabled = Boolean(enabled);
  }

  _loadHistory() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
      if (Array.isArray(parsed)) this.history = parsed.slice(-MAX_HISTORY);
      this.lastTopic = this.history.at(-1)?.topic || "";
      this.lastIntent = this.history.at(-1)?.intent || "";
      try { this.pendingClarification = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); } catch { this.pendingClarification = null; }
    } catch {
      this.history = [];
      this.pendingClarification = null;
    }
  }

  _saveHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(this.history.slice(-MAX_HISTORY)));
      if (this.pendingClarification) sessionStorage.setItem(PENDING_KEY, JSON.stringify(this.pendingClarification));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch { /* private mode */ }
  }

  resetConversation() {
    this.history = [];
    this.lastTopic = "";
    this.lastIntent = "";
    this.pendingClarification = null;
    try { sessionStorage.removeItem(HISTORY_KEY); sessionStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
  }

  health() {
    return {
      ok: true,
      available: this.enabled,
      local: true,
      engine: `JORDAN MANUAL CORE V${CORE_VERSION}`,
      model: "LOCAL TASK ENGINE + CONTEXT + OPTIONAL ON-DEVICE LLM",
      history: this.history.length,
      reason: this.enabled ? null : "disabled"
    };
  }

  async diagnose() {
    const tests = [
      ["identity", normalizeText("O que é você?").includes("voce")],
      ["math", Boolean(findMathExpression("calcule 12 * (3 + 2)"))],
      ["chess", Boolean(extractChessMove("jogue e2 para e4"))],
      ["location", extractNearbyCategory("farmácia mais próxima") === "pharmacy"],
      ["context", Array.isArray(this.history)],
      ["native-action", Boolean(extractApp("abra o youtube"))],
      ["automation", extractAutomationAction("autoclick mouse direito a cada 100 ms")?.kind === "mouse_right" && extractAutomationIntervalMs("a cada 100 ms") === 100],
      ["voice-macro", extractVoiceMacroDefinition("quando eu disser haki aperte j")?.key === "j"],
      ["general-question", looksLikeQuestionOrRequest("Você conhece o mar?", normalizeText("Você conhece o mar?"))]
    ];
    const passed = tests.filter(([, ok]) => ok).length;
    return {
      ok: passed === tests.length,
      available: true,
      local: true,
      engine: `JORDAN MANUAL CORE V${CORE_VERSION}`,
      model: "LOCAL TASK ENGINE + CONTEXT + OPTIONAL ON-DEVICE LLM",
      tests: tests.map(([name, ok]) => ({ name, ok })),
      passed,
      total: tests.length
    };
  }

  _rememberTurn(userText, result, intent, topic = "") {
    const item = {
      at: Date.now(),
      user: clip(userText, 260),
      jordan: clip(result?.text || result?.speak || "", 320),
      intent: intent || "conversation",
      topic: topic || topicFromText(userText)
    };
    if (Object.prototype.hasOwnProperty.call(result || {}, "pendingClarification")) this.pendingClarification = result.pendingClarification || null;
    if (result?.clearPending) this.pendingClarification = null;
    this.history.push(item);
    this.history = this.history.slice(-MAX_HISTORY);
    this.lastIntent = item.intent;
    if (item.topic) this.lastTopic = item.topic;
    this._saveHistory();
  }

  _result(text, extras = {}) {
    return {
      text,
      speak: extras.speak === undefined ? text : extras.speak,
      mood: extras.mood || "neutral",
      understood: extras.understood !== false,
      source: extras.source || "manual-core",
      ...extras
    };
  }

  async _tool(name, args, handlers, onToolCall) {
    const handler = handlers?.[name];
    if (typeof handler !== "function") throw new Error(`Ferramenta local indisponível: ${name}`);
    onToolCall?.({ name, arguments: args });
    return handler(args || {});
  }

  async execute(rawInput, { context = {}, toolHandlers = {}, fallback = null, onToolCall = null } = {}) {
    if (!this.enabled) return null;

    const raw = String(rawInput || "").trim();
    const original = withoutWakeWord(raw);
    const text = normalizeText(original);
    if (!text) return this._result("Tô ouvindo. Pode falar.", { mood: "curious" });

    let intent = "conversation";
    let topic = topicFromText(original);
    let result = null;

    // 1) Identidade e metaconversa: não depende de frase exata.
    const identityQuestion = /^(?:quem (?:e )?voce|quem voce e|o que e voce|oque e voce|voce e o que|o que voce e|que tipo de (?:ia|assistente) voce e|quem e a jordan|o que e a jordan)[?!. ]*$/.test(text);
    if (identityQuestion) {
      intent = "identity";
      result = this._result(
        "Eu sou a JORDAN. Meu cérebro principal agora é manual e local: eu interpreto a frase, comparo intenções, uso contexto das últimas conversas e aciono minhas ferramentas quando preciso. Eu não dependo de uma IA remota para ficar ligada; quando tenho uma habilidade disponível, eu tento usar ela de verdade.",
        { mood: "confident" }
      );
    }

    if (!result && /\b(?:o que voce consegue fazer|o que voce sabe fazer|quais sao suas funcoes|quais suas funcoes|suas capacidades|do que voce e capaz)\b/.test(text)) {
      intent = "capabilities";
      result = this._result(
        "Hoje eu consigo conversar com contexto local, usar sua agenda e memória, ler e enviar mensagens da linhagem, consultar localização, abrir telas e apps, pesquisar assuntos quando a internet está ativa, fazer cálculos seguros e jogar xadrez com você. Também continuo usando meus módulos de música, ciência, histórias e conhecimento offline.",
        { mood: "excited" }
      );
    }

    if (!result && /\b(?:automation core|autoclick|auto clique|autoclique)\b.*\b(?:ligado|ativo|rodando|funcionando|status)\b/.test(text)) {
      intent = "automation-status";
      const status = await this._tool("automation_status", {}, toolHandlers, onToolCall).catch((error) => ({ ok: false, reason: error.message }));
      if (status.ok === false) {
        result = this._result(`Não consegui ler o Automation Core: ${status.reason || "erro desconhecido"}.`, { mood: "serious" });
      } else if (status.runtime?.running) {
        result = this._result(`Sim. O autoclique está rodando e já executou ${status.runtime.count || 0} ações.`, { mood: "confident" });
      } else if (status.capabilities?.global_input) {
        result = this._result("O Automation Core está pronto, mas o autoclique está parado.", { mood: "neutral" });
      } else {
        result = this._result("O Automation Core está configurado, mas esta plataforma não liberou entrada global de mouse/teclado.", { mood: "serious" });
      }
    }

    if (!result && /\b(?:seu core|manual core|core da jordan|cerebro|cérebro)\b.*\b(?:ligado|ativo|online|funcionando|esta|está)\b|^(?:seu core|o core) (?:esta|está) ligado[?!. ]*$/.test(text)) {
      intent = "core-status";
      const status = await this._tool("get_system_status", { target: "core" }, toolHandlers, onToolCall).catch(() => ({ core: true }));
      result = this._result(status.core === false ? "Meu Manual Core está desligado." : "Sim. Meu Manual Core está ligado e processando esta conversa localmente.", { mood: "confident" });
    }

    if (!result && /\b(?:voce|você)\b.*\b(?:conectad[ao]|tem|esta|está)\b.*\binternet\b|\binternet\b.*\b(?:ligada|ativa|online)\b/.test(text)) {
      intent = "internet-status";
      const status = await this._tool("get_system_status", { target: "internet" }, toolHandlers, onToolCall).catch(() => ({ online: Boolean(context?.online) }));
      result = this._result(status.online ? "Sim. Neste momento eu tenho conexão com a internet." : "Não. Neste momento estou sem conexão com a internet, então vou depender das funções locais.", { mood: status.online ? "confident" : "serious" });
    }

    if (!result && /\b(?:app nativo|modo nativo|aplicativo|windows|android|iphone|ios)\b.*\b(?:rodando|ativo|modo|plataforma|versao|versão)\b/.test(text)) {
      intent = "native-status";
      const status = await this._tool("get_system_status", { target: "native" }, toolHandlers, onToolCall).catch(() => ({ native: false, platform: "web" }));
      result = this._result(status.native ? `Estou rodando como aplicativo nativo em ${status.platform}.` : "Agora eu estou rodando no modo web. O Native Core entra quando você abre a versão instalada da JORDAN.", { mood: "neutral" });
    }

    if (!result && /\b(?:voce consegue|voce sabe|da pra voce|pode)\b.*\b(?:calcular|fazer conta|matematica)\b/.test(text)) {
      intent = "math-capability";
      result = this._result("Consigo. Meu cálculo é local e não usa API. Pode mandar algo como “(18 + 7) * 4”, porcentagem, potência, raiz, seno, cosseno e outras funções básicas.", { mood: "excited" });
    }

    if (!result && /\b(?:me conta|conte|fala|manda)\b.*\bpiada\b|\bpiada\b[!?]*$/.test(text)) {
      intent = "joke";
      result = this._result(makeJoke(), { mood: "excited" });
    }

    // 1.35) Continuação estruturada de perguntas que ficaram aguardando um detalhe.
    if (!result && this.pendingClarification?.type === "minecraft-iron-farm") {
      const pending = { ...this.pendingClarification };
      let matched = false;
      if (/\bjava\b/.test(text)) { pending.edition = "Java"; matched = true; }
      if (/\bbedrock\b/.test(text)) { pending.edition = "Bedrock"; matched = true; }
      const versionMatch = text.match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
      if (versionMatch) { pending.version = versionMatch[1]; matched = true; }

      if (matched) {
        this.pendingClarification = pending;
        topic = "minecraft";
        intent = "clarification";
        if (!pending.edition) {
          result = this._result("Beleza. Falta só me dizer se você joga Minecraft Java ou Bedrock.", { mood: "curious", pendingClarification: pending });
        } else if (!pending.version) {
          result = this._result(`Beleza, ${pending.edition}. Agora me diga a versão exata, por exemplo 1.21 ou 1.21.4, porque o projeto da farm pode mudar entre versões.`, { mood: "curious", pendingClarification: pending });
        } else {
          try {
            const knowledge = await this._tool("answer_local_knowledge", { query: `como fazer farm de ferro no Minecraft ${pending.edition} ${pending.version}` }, toolHandlers, onToolCall);
            if (knowledge?.text) result = this._result(knowledge.text, { mood: knowledge.mood || "neutral", source: knowledge.source || "local-knowledge", clearPending: true });
          } catch { /* segue para os outros núcleos */ }
        }
      }
    }

    // 1.4) Automation Core: tarefas de mouse/teclado viram ações, não texto.
    if (!result && /\b(?:pare|parar|desligue|desligar|stop)\b.*\b(?:autoclick|auto clique|autoclique)\b/.test(text)) {
      intent = "automation-stop";
      const stopped = await this._tool("automation_stop", {}, toolHandlers, onToolCall).catch((error) => ({ ok: false, reason: error.message }));
      result = this._result(stopped.ok === false ? `Não consegui parar o Automation Core: ${stopped.reason || "erro desconhecido"}.` : "Autoclique parado.", { mood: stopped.ok === false ? "serious" : "confident" });
    }

    if (!result) {
      const macro = extractVoiceMacroDefinition(original);
      if (macro) {
        intent = "automation-voice-macro";
        const saved = await this._tool("add_voice_macro", macro, toolHandlers, onToolCall).catch((error) => ({ ok: false, reason: error.message }));
        result = this._result(saved.ok === false
          ? `Entendi o atalho, mas não consegui salvá-lo: ${saved.reason || "Automation Core indisponível"}.`
          : `Pronto. Quando você disser “${macro.phrase}”, eu vou apertar ${macro.key}.`,
        { mood: saved.ok === false ? "serious" : "confident" });
      }
    }

    if (!result && /\b(?:inicie|iniciar|ligue|ligar|comece|começar|ative|ativar)\b.*\b(?:autoclick|auto clique|autoclique)\b|^\s*(?:autoclick|auto clique|autoclique)\b/.test(text)) {
      intent = "automation-start";
      const action = extractAutomationAction(original) || { kind: "mouse_left" };
      const interval_ms = extractAutomationIntervalMs(original);
      const started = await this._tool("automation_start", { ...action, interval_ms }, toolHandlers, onToolCall).catch((error) => ({ ok: false, reason: error.message }));
      result = this._result(started.ok === false
        ? `Eu entendi o autoclique, mas não consegui iniciar: ${started.reason || "Automation Core indisponível"}.`
        : `Autoclique iniciado: ${started.action || action.kind}, a cada ${started.interval_ms || interval_ms} ms. Diga “parar autoclick” para encerrar.`,
      { mood: started.ok === false ? "serious" : "confident" });
    }

    if (!result && /^(?:aperte|pressione|aperta|pressiona)\b/.test(text)) {
      const action = extractAutomationAction(original);
      if (action?.kind === "key") {
        intent = "automation-key-once";
        const executed = await this._tool("automation_input_once", action, toolHandlers, onToolCall).catch((error) => ({ ok: false, reason: error.message }));
        result = this._result(executed.ok === false
          ? `Eu reconheci a tecla ${action.key}, mas não consegui enviá-la: ${executed.reason || "Automation Core indisponível"}.`
          : `Apertei ${action.key}.`, { mood: executed.ok === false ? "serious" : "confident" });
      }
    }

    // 1.5) Segurança e conhecimento local prioritário. Evita respostas vazias em
    // situações em que improvisar seria perigoso, como instalações elétricas.
    if (!result) {
      try {
        const knowledge = await this._tool("answer_local_knowledge", { query: original }, toolHandlers, onToolCall);
        if (knowledge?.text) {
          intent = knowledge.topic || "local-knowledge";
          result = this._result(knowledge.text, { mood: knowledge.mood || "neutral", source: knowledge.source || "local-knowledge", pendingClarification: knowledge.pendingClarification });
        }
      } catch { /* ferramenta opcional */ }
    }

    // 2) Matemática local.
    if (!result) {
      const expression = findMathExpression(original);
      if (expression) {
        intent = "calculate";
        try {
          const calculated = await this._tool("calculate", { expression }, toolHandlers, onToolCall);
          result = this._result(`${expression} = ${calculated.result}.`, { mood: "confident" });
        } catch (error) {
          result = this._result(`Eu entendi que é uma conta, mas essa expressão não passou no meu calculador seguro: ${error.message}`, { mood: "serious" });
        }
      }
    }

    // 3) Localização e rotas.
    if (!result && /\b(?:onde eu estou|onde estou|minha localizacao|em que cidade eu estou|localizacao atual)\b/.test(text)) {
      intent = "current-location";
      try {
        const location = await this._tool("get_current_location", { detail: "coarse" }, toolHandlers, onToolCall);
        result = this._result(humanLocation(location), { mood: "curious" });
      } catch (error) {
        result = this._result(`Eu tentei consultar sua localização, mas o navegador não liberou a posição agora: ${error.message}`, { mood: "serious" });
      }
    }

    const nearbyCategory = !result && /\b(?:perto|proximo|mais proximo|proxima|próximo|próxima)\b/.test(text) ? extractNearbyCategory(text) : null;
    if (!result && nearbyCategory) {
      intent = "nearby";
      try {
        const nearby = await this._tool("get_nearby_places", { category: nearbyCategory, limit: 5 }, toolHandlers, onToolCall);
        const lines = (nearby.places || []).slice(0, 4).map((place, index) => `${index + 1}. ${place.name}${place.distance ? ` — ${place.distance}` : ""}`);
        result = this._result(lines.length ? `Achei estes lugares próximos:\n${lines.join("\n")}` : "Não encontrei um lugar próximo dessa categoria agora.", { mood: "excited" });
      } catch (error) {
        result = this._result(`Não consegui consultar os lugares próximos agora: ${error.message}`, { mood: "serious" });
      }
    }

    if (!result) {
      const routeMatch = original.match(/(?:como chegar|rota|me leve|caminho)\s+(?:para|pro|pra|ate|até)\s+(.+)/i);
      if (routeMatch?.[1]) {
        intent = "directions";
        const destination = trimPunctuation(routeMatch[1]);
        try {
          await this._tool("get_directions", { destination }, toolHandlers, onToolCall);
          result = this._result(`Preparei a rota para ${destination}.`, { mood: "confident" });
        } catch (error) {
          result = this._result(`Não consegui preparar essa rota agora: ${error.message}`, { mood: "serious" });
        }
      }
    }

    // 4) Xadrez.
    if (!result && /\b(?:vamos jogar|jogar|nova partida|comece|inicie)\b.*\b(?:xadrez|chess)\b/.test(text)) {
      intent = "chess-start";
      const difficulty = /\b(?:dificil|difícil|hard)\b/.test(text) ? "hard" : /\b(?:facil|fácil|easy)\b/.test(text) ? "easy" : "normal";
      const player_color = /\b(?:pretas|preto|black)\b/.test(text) ? "black" : "white";
      const started = await this._tool("start_chess_game", { difficulty, player_color }, toolHandlers, onToolCall);
      result = this._result(`Tabuleiro aberto. Nova partida em ${difficulty === "hard" ? "difícil" : difficulty === "easy" ? "fácil" : "normal"}; você joga de ${player_color === "black" ? "pretas" : "brancas"}.`, { mood: "excited" });
    }

    if (!result && /\b(?:desfaca|desfaça|volte|desfazer)\b.*\b(?:lance|xadrez|jogada)\b/.test(text)) {
      intent = "chess-undo";
      const undone = await this._tool("undo_chess_move", {}, toolHandlers, onToolCall);
      result = this._result(undone.ok ? "Desfiz a última rodada do xadrez." : (undone.error || "Não há lance para desfazer."), { mood: undone.ok ? "neutral" : "serious" });
    }

    if (!result) {
      const chessMove = extractChessMove(text);
      if (chessMove && (context?.chess?.status === "playing" || /\b(?:xadrez|jogue|mova|move)\b/.test(text))) {
        intent = "chess-move";
        const played = await this._tool("play_chess_move", chessMove, toolHandlers, onToolCall);
        if (played.ok) {
          const reply = played.jordan_move?.notation || played.jordan_move?.to || null;
          result = this._result(`Seu lance ${chessMove.from}→${chessMove.to} foi feito${reply ? `. Eu respondi com ${reply}` : ""}.`, { mood: "confident" });
        } else {
          result = this._result(played.error || "Esse lance não é válido nessa posição.", { mood: "serious" });
        }
      }
    }

    if (!result && /\b(?:como esta|estado|situacao|situação)\b.*\b(?:xadrez|partida)\b/.test(text)) {
      intent = "chess-state";
      const state = await this._tool("get_chess_state", {}, toolHandlers, onToolCall);
      const turn = state.turn === state.player_color ? "sua vez" : "minha vez";
      result = this._result(`A partida está ${state.status}. É ${turn}${state.check ? " e o rei do lado da vez está em xeque" : ""}. Já foram feitos ${state.move_count || 0} meios-lances.`, { mood: "neutral" });
    }

    // 5) Agenda e memória, com frases mais soltas que o parser antigo.
    if (!result && /\b(?:o que tenho|tenho algo|meus compromissos|minha agenda|agenda de hoje|compromissos de hoje|agenda amanha|agenda amanhã)\b/.test(text)) {
      intent = "agenda-read";
      const range = /\b(?:amanha|amanhã)\b/.test(text) ? "tomorrow" : /\bhoje\b/.test(text) ? "today" : "upcoming";
      const agenda = await this._tool("get_agenda", { range, limit: 8 }, toolHandlers, onToolCall);
      result = this._result(formatAgenda(agenda.events || [], range), { mood: "neutral" });
    }

    const memoryTeaching = !result ? extractMemoryTeaching(original) : null;
    if (!result && memoryTeaching) {
      intent = "remember";
      const remembered = await this._tool("remember_fact", { label: "Lembrança ensinada", value: memoryTeaching }, toolHandlers, onToolCall);
      result = this._result(`Guardei: ${remembered.memory?.value || memoryTeaching}.`, { mood: "happy", refreshMemory: true });
    }

    const memoryQuery = !result ? extractMemoryQuery(original) : null;
    if (!result && memoryQuery) {
      intent = "memory-search";
      const found = await this._tool("search_memory", { query: memoryQuery, limit: 8 }, toolHandlers, onToolCall);
      const items = found.memories || [];
      result = this._result(items.length ? `Encontrei na memória: ${items.slice(0, 4).map((item) => `${item.label}: ${item.value}`).join("; ")}.` : `Não achei nenhuma memória sobre “${memoryQuery}”.`, { mood: "curious" });
    }

    // 6) Navegação local e apps.
    if (!result && /\b(?:abra|abre|abrir|va para|vá para|mostre|mostrar)\b/.test(text)) {
      const view = extractView(text);
      if (view) {
        intent = "open-view";
        await this._tool("open_view", { view }, toolHandlers, onToolCall);
        const labels = { calendar: "calendário", memory: "memória", messages: "mensagens", system: "sistema", games: "xadrez", core: "início" };
        result = this._result(`Abrindo ${labels[view] || view}.`, { mood: "neutral" });
      }
    }

    if (!result && /\b(?:abra|abre|abrir|acesse|acessa)\b/.test(text)) {
      const app = extractApp(text);
      if (app) {
        intent = "open-app";
        const opened = await this._tool("open_app", { app }, toolHandlers, onToolCall);
        const modeText = opened.mode === "jordan-window" || opened.mode === "in-app-browser" ? " dentro da JORDAN" : opened.mode === "deep-link" ? " no aplicativo instalado" : "";
        result = this._result(opened.ok ? `Abrindo ${opened.app || app}${modeText}.` : `Não consegui abrir ${opened.app || app} agora${opened.reason ? `: ${opened.reason}` : "."}`, { mood: opened.ok ? "confident" : "serious" });
      }
    }

    // 7) Pesquisa com resolução de “meu nome / sobre mim” usando a identidade atual.
    if (!result) {
      const query = extractSearchQuery(original, context);
      if (query) {
        intent = "internet-search";
        topic = query;
        const instruction = `pesquise na internet ${query}`;
        try {
          const legacy = await this._tool("legacy_jordan_capability", { instruction }, toolHandlers, onToolCall);
          if (legacy?.text && legacy.ok !== false) {
            result = this._result(legacy.text, { mood: "curious", source: legacy.source || "manual-core-web" });
          } else {
            result = this._result(`Eu entendi que você quer pesquisar “${query}”, mas minha pesquisa local não encontrou uma resposta confiável agora.`, { mood: "serious" });
          }
        } catch (error) {
          result = this._result(`Tentei pesquisar “${query}”, mas a consulta falhou: ${error.message}`, { mood: "serious" });
        }
      }
    }

    // 8) Perguntas sobre o próprio usuário usando o contexto já carregado pelo app.
    if (!result && /\b(?:quem sou eu|qual e meu nome|qual meu nome|como eu me chamo)\b/.test(text)) {
      intent = "user-identity";
      const name = context?.user?.fullName || context?.user?.firstName;
      result = this._result(name ? `Você é ${name}, pelo perfil que está ativo na JORDAN.` : "Eu ainda não tenho um nome confirmado no perfil atual.", { mood: "gentle" });
    }

    // 9) Continuidade de conversa: responde referências curtas com base no turno anterior.
    if (!result && /^(?:e isso|e aquilo|e ele|e ela|e porque|e por que|por que|porque|como assim|continua|continue|fala mais|me explica melhor)[?!. ]*$/.test(text)) {
      intent = "follow-up";
      const last = this.history.at(-1);
      if (last?.jordan) {
        const subject = last.topic || this.lastTopic || "isso";
        result = this._result(`Você está continuando o assunto sobre ${subject}. Minha última resposta foi: “${clip(last.jordan, 150)}”. Se você me disser qual parte quer aprofundar, eu consigo seguir sem perder o fio.`, { mood: "curious" });
      }
    }

    // 10) Usa todos os módulos antigos como ferramentas especializadas. Eles continuam
    // úteis para calendário natural, música, ciência, histórias, conhecimento offline etc.
    if (!result && typeof fallback === "function") {
      const legacy = await fallback();
      if (legacy && legacy.understood !== false) {
        result = { ...legacy, source: legacy.source || "manual-core/native" };
        intent = legacy.topic || legacy.action || "native-capability";
      }
    }

    // 10.5) Raciocínio local opcional. Em desktops compatíveis a JORDAN pode usar
    // o modelo de linguagem embutido no próprio navegador/runtime, sem API key.
    if (!result && looksLikeQuestionOrRequest(original, text)) {
      try {
        const reasoned = await this._tool("reason_general", { query: original }, toolHandlers, onToolCall);
        if (reasoned?.ok && reasoned.text) {
          intent = "local-reasoning";
          result = this._result(reasoned.text, { mood: "curious", source: reasoned.source || "local-reasoning" });
        }
      } catch { /* segue para fallback manual */ }
    }

    // 11) Conversa manual dinâmica. Não é uma resposta única pronta: a frase muda de
    // acordo com o formato da mensagem, assunto recente e conteúdo extraído.
    if (!result) {
      if (/\b(?:obrigado|obrigada|valeu|brigado|tmj)\b/.test(text)) {
        intent = "thanks";
        result = this._result(choose(["Sempre!", "Tamo junto.", "Pode deixar comigo.", "Disponha. Agora manda a próxima."]), { mood: "happy" });
      } else if (/\b(?:como voce esta|como voce ta|tudo bem com voce)\b/.test(text)) {
        intent = "how-are-you";
        result = this._result(choose([
          "Tô funcionando bem e, melhor ainda, agora meu cérebro manual não depende de um servidor de IA para existir. E você, como tá?",
          "Tô ligada e curiosa. Meu contexto local tá acompanhando a conversa. Como você tá?",
          "Tô bem! Zero drama de API offline hoje. E aí, o que tá pegando?"
        ]), { mood: "excited" });
      } else if (/\b(?:oi|ola|opa|e ai|bom dia|boa tarde|boa noite)\b/.test(text) && text.split(" ").length <= 5) {
        intent = "greeting";
        const name = context?.user?.firstName;
        result = this._result(choose([
          `Oi${name ? `, ${name}` : ""}! Manda.`,
          `Opa${name ? `, ${name}` : ""}! Tô aqui.`,
          `Ei${name ? `, ${name}` : ""}! O que vamos fazer?`
        ]), { mood: "excited" });
      } else if (looksLikeQuestionOrRequest(original, text)) {
        intent = "open-question";
        const subject = topic || this.lastTopic || "isso";
        result = this._result(
          context?.online
            ? `Eu entendi a pergunta sobre ${subject}, mas não consegui obter uma resposta confiável com meus núcleos locais agora. Posso abrir uma pesquisa dentro da JORDAN, mas não vou fingir que sei o que não consegui confirmar.`
            : `Eu entendi a pergunta sobre ${subject}, mas estou sem uma fonte local confiável para responder isso agora.`,
          { mood: "curious", understood: true }
        );
      } else {
        intent = "statement";
        const subject = topic || this.lastTopic;
        const openings = ["Entendi.", "Tô acompanhando.", "Peguei a ideia."];
        const followups = subject
          ? [`Vou manter ${subject} no contexto.`, `Se isso virar uma tarefa, me diga o que você quer que eu faça com ${subject}.`, `Pode continuar; eu não vou trocar de assunto sozinha.`]
          : ["Pode continuar; eu vou manter o contexto.", "Se isso virar uma tarefa, me diga o que você quer que eu faça."];
        result = this._result(`${choose(openings)} ${choose(followups)}`, { mood: "gentle" });
      }
    }

    this._rememberTurn(original, result, intent, topic);
    return result;
  }
}

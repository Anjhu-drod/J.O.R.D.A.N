import { normalizeText } from "./utils.js";

const SELF = Object.freeze({
  name: "JORDAN",
  projectStartedAt: "1 de setembro de 2026",
  primaryLanguage: "português brasileiro"
});

const BRAZIL_HINTS = [
  "brasil", "brazil", "tijucas", "santa catarina", " sc", "parana", "paraná", "rio grande do sul",
  "sao paulo", "são paulo", "rio de janeiro", "minas gerais", "bahia", "goias", "goiás", "brasilia", "brasília"
];

function stripWake(raw = "") {
  return String(raw || "").trim().replace(/^\s*jordan\s*[,;:!?.-]?\s*/i, "").trim();
}

function inferCountry(home = "") {
  const t = ` ${normalizeText(home)} `;
  return BRAZIL_HINTS.some((hint) => t.includes(normalizeText(hint))) ? "Brasil" : null;
}

function languageLabel(language = "pt") {
  return ({ pt: "português brasileiro", en: "inglês", es: "espanhol", ja: "japonês" })[language] || SELF.primaryLanguage;
}

function networkDescription() {
  if (typeof navigator === "undefined") return "Estou usando a conexão de internet deste dispositivo.";
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return "Estou usando a conexão deste dispositivo. O navegador não me deixa ver o nome do Wi‑Fi nem o provedor.";
  }
  const details = [];
  if (connection.type) details.push(String(connection.type));
  if (connection.effectiveType) details.push(`perfil ${connection.effectiveType}`);
  if (Number.isFinite(connection.downlink)) details.push(`cerca de ${connection.downlink} Mbps estimados`);
  return `Estou usando a conexão deste dispositivo${details.length ? ` (${details.join(", ")})` : ""}. O navegador não me fornece a senha, o nome do Wi‑Fi nem o provedor com segurança.`;
}

function appHelp(t = "") {
  if (/\b(?:como|onde).*(?:marcar|agendar|criar).*(?:compromisso|evento|consulta|agenda)\b/.test(t)) {
    return {
      text: "Você pode me falar o compromisso do jeito que falaria com uma pessoa, por exemplo: “marque dentista amanhã às 15h”. Também dá para abrir CAL e criar manualmente.",
      kind: "app-help",
      subject: "calendar"
    };
  }
  if (/\b(?:como|onde).*(?:acessar|abrir|ver).*(?:calendario|calendário|agenda)\b|\b(?:seu|seu próprio) calendario\b/.test(t)) {
    return {
      text: "Seu calendário fica na aba CAL. Se quiser, eu também posso abrir direto quando você disser “abra o calendário”.",
      kind: "app-help",
      subject: "calendar"
    };
  }
  if (/\b(?:como|onde).*(?:acessar|abrir|ver).*(?:mensagens|recados)\b/.test(t)) {
    return {
      text: "As mensagens ficam na aba MSG. Lá você pode escrever para uma pessoa da linhagem ou para todos.",
      kind: "app-help",
      subject: "messages"
    };
  }
  return null;
}

export class SemanticBrainService {
  constructor({ memory, lineage, offlineKnowledge, languageLearning } = {}) {
    this.memory = memory;
    this.lineage = lineage;
    this.offlineKnowledge = offlineKnowledge;
    this.languageLearning = languageLearning;
  }

  async profileName() {
    const explicit = await this.memory?.get?.("profile.name");
    return explicit?.value || this.lineage?.currentIdentity?.firstName || null;
  }

  async homeValue() {
    const home = await this.memory?.get?.("profile.home");
    return home?.value || null;
  }

  async answer(raw = "", { allowPrivate = true, language = "pt" } = {}) {
    const original = stripWake(raw);
    const t = normalizeText(original);
    if (!t) return null;

    // 1) Conhecimento que o próprio usuário ensinou sempre vem antes de fontes externas.
    const meaning = t.match(/^(?:o que|oque)\s+(?:significa|quer dizer)\s+(.+?)[?!.]*$/);
    if (meaning) {
      const learned = this.languageLearning?.lookup?.(meaning[1]);
      if (learned) {
        return { text: `Do jeito que você me ensinou, “${learned.term}” significa ${learned.meaning}.`, kind: "learned" };
      }
    }

    // 2) Modelo de si mesma. Essas perguntas nunca devem virar busca na Wikipedia.
    if (/\b(?:qual(?: e| é)?|como(?: e| é)?|diga)\s+(?:o )?seu nome\b|\bcomo voce se chama\b/.test(t)) {
      return { text: `Meu nome é ${SELF.name}.`, kind: "self", subject: "identity" };
    }
    if (/\bquem (?:e|é) voce\b|\bo que voce e\b/.test(t)) {
      return { text: `Eu sou a ${SELF.name}, a assistente desta linhagem.`, kind: "self", subject: "identity" };
    }
    if (/\bquando\b.*\b(?:voce|jordan)\b.*\b(?:criada|criado|nasceu|surgiu|comecou|começou)\b|\bquando voce foi criada\b/.test(t)) {
      return { text: `Minha primeira construção começou em ${SELF.projectStartedAt}. Desde então eu venho sendo atualizada por versões.`, kind: "self", subject: "history" };
    }
    if (/\bqual\b.*\b(?:linguagem|idioma|lingua|língua)\b.*\b(?:estou|to|tô|a gente)\b.*\b(?:falando|usando)\b/.test(t)) {
      return { text: `Você está falando ${languageLabel(language)} comigo.`, kind: "context", subject: "language" };
    }
    if (/\bqual\b.*\b(?:internet|conexao|conexão|rede)\b.*\b(?:voce|jordan)\b.*\b(?:usa|usando|conectada|conectado)\b|\bqual a internet que voce esta usando\b/.test(t)) {
      return { text: networkDescription(), kind: "context", subject: "network" };
    }

    // 3) Referências em primeira pessoa são resolvidas contra a identidade logada, não contra a web.
    if (/^(?:quem sou eu|quem e eu|quem é eu)[?!.]*$|\bquem (?:e|é) (?:o )?usuario desta conta\b|\bquem (?:e|é) (?:o )?usuario dessa conta\b/.test(t)) {
      if (!allowPrivate) return { text: "Essa é uma informação privada da conta logada.", kind: "private" };
      const name = await this.profileName();
      return { text: name ? `Você é ${name}, a pessoa vinculada a esta JORDAN ID.` : "Ainda não consegui resolver o nome desta identidade.", kind: "personal", subject: "identity" };
    }
    if (/(?:\bqual\b.*\bmeu nome\b|\bcomo eu me chamo\b|\bme diga meu nome\b)/.test(t)) {
      if (!allowPrivate) return { text: "O nome do usuário desta conta é privado.", kind: "private" };
      const name = await this.profileName();
      return { text: name ? `Você se chama ${name}.` : "Ainda não tenho seu nome salvo com segurança.", kind: "personal", subject: "identity" };
    }
    if (/\b(?:onde|aonde)\b.*\b(?:eu moro|moro|minha casa)\b/.test(t)) {
      if (!allowPrivate) return { text: "O local de moradia do usuário é informação privada.", kind: "private" };
      const home = await this.homeValue();
      return { text: home ? `Você me ensinou que mora em ${home}.` : "Você ainda não me ensinou onde mora.", kind: "personal", subject: "home" };
    }
    if (/\b(?:eu moro em que pais|em que pais eu moro|qual pais eu moro|qual e o meu pais|qual é o meu país)\b/.test(t)) {
      if (!allowPrivate) return { text: "O país de residência do usuário é informação privada.", kind: "private" };
      const countryMemory = await this.memory?.get?.("profile.country");
      const home = await this.homeValue();
      const country = countryMemory?.value || inferCountry(home || "");
      return { text: country ? `Pelo que tenho salvo, você mora no ${country}.` : "Ainda não tenho informação suficiente para afirmar em que país você mora.", kind: "personal", subject: "country" };
    }
    if (/\b(?:qual|como)\b.*\bmeu (?:numero|número|telefone)\b/.test(t)) {
      if (!allowPrivate) return { text: "O telefone do usuário é informação privada.", kind: "private" };
      const m = await this.memory?.get?.("profile.phone");
      if (m?.value) return { text: `Seu telefone salvo é ${m.value}.`, kind: "personal" };
    }

    // 4) Pergunta atual que depende do país do usuário: resolve o referente antes de ir à web.
    if (/\b(?:quem e|quem é|qual e|qual é)\b.*\b(?:atual )?presidente\b.*\b(?:do pais|do país|daqui)\b/.test(t)) {
      if (!allowPrivate) return { text: "Qual país você quer consultar?", kind: "clarify" };
      const countryMemory = await this.memory?.get?.("profile.country");
      const home = await this.homeValue();
      const country = countryMemory?.value || inferCountry(home || "");
      if (!country) return { text: "De qual país você está falando?", kind: "clarify" };
      return { kind: "contextual-web", webQuery: `presidente atual do ${country}`, subject: "current-affairs" };
    }

    // 5) Ajuda sobre a própria interface vem antes de qualquer busca externa.
    const help = appHelp(t);
    if (help) return help;

    // 6) Cumprimentos são compostos pelo contexto, sem assumir que "meu" é o nome de alguém.
    if (/\b(?:cumprimente|cumprimenta|manda um oi|diga oi|de um oi|dê um oi)\b/.test(t)) {
      const userName = allowPrivate ? await this.profileName() : null;
      if (/\bmeu cachorro\b/.test(t)) {
        return { text: `Oi, amigão! Eu sou a JORDAN${userName ? `, assistente do ${userName}` : ""}.`, kind: "conversation" };
      }
      if (/\bmeu|minha\b.*\bamig[oa]\b/.test(t)) {
        return { text: `Oi! Prazer, eu sou a JORDAN${userName ? `, assistente do ${userName}` : ""}.`, kind: "conversation" };
      }
      const m = original.match(/(?:cumprimente|cumprimenta|manda um oi para|diga oi para|dê um oi para)\s+(.+)/i);
      if (m) return { text: `Oi, ${m[1].replace(/[.!?]+$/g, "").trim()}! Prazer, eu sou a JORDAN.`, kind: "conversation" };
    }

    if (/\b(?:me pergunte|faz uma pergunta|pergunta alguma coisa)\b/.test(t)) {
      const qs = [
        "Qual coisa você mais quer aprender agora?",
        "Que parte da sua rotina você mais queria automatizar?",
        "Qual assunto você consegue conversar por horas sem cansar?",
        "O que aconteceu hoje que mais ficou na sua cabeça?"
      ];
      return { text: qs[Math.floor(Math.random() * qs.length)], kind: "conversation" };
    }

    if (/\bvoce tem\b/.test(t)) {
      return { text: "Tenho calendário, memória sincronizada, mensagens da linhagem, conhecimento offline, pesquisa online, música, localização e ferramentas de sistema. Também consigo aprender palavras, hábitos e preferências que você me ensina.", kind: "capabilities" };
    }

    // 7) Conhecimento local vem antes da internet.
    const knowledge = this.offlineKnowledge?.answer?.(original);
    if (knowledge) return { ...knowledge };
    return null;
  }
}

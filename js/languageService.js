import { normalizeText } from "./utils.js";

export const SUPPORTED_LANGUAGES = {
  auto: { id: "auto", label: "Automático", locale: "pt-BR", short: "AUTO" },
  pt: { id: "pt", label: "Português (Brasil)", locale: "pt-BR", short: "PT" },
  en: { id: "en", label: "English (US)", locale: "en-US", short: "EN" },
  ja: { id: "ja", label: "日本語", locale: "ja-JP", short: "JA" },
  es: { id: "es", label: "Español", locale: "es-ES", short: "ES" }
};

const LANGUAGE_MARKERS = {
  pt: [
    "voce", "você", "eu", "meu", "minha", "onde", "aonde", "como", "porque", "por que",
    "qual", "quero", "preciso", "tenho", "tem", "hoje", "amanha", "amanhã", "obrigado",
    "fala", "fale", "marque", "agenda", "calendario", "calendário", "perto", "proximo", "próximo"
  ],
  en: [
    "hi", "hello", "hey", "where", "what", "who", "when", "why", "how", "please", "thanks",
    "thank", "my", "i am", "i have", "i want", "can you", "tell me", "show me", "near", "nearest",
    "today", "tomorrow", "calendar", "schedule", "gas station", "favorite", "favourite"
  ],
  es: [
    "hola", "buenos", "buenas", "donde", "dónde", "que", "qué", "quien", "quién", "cuando", "cuándo",
    "por que", "por qué", "como", "cómo", "gracias", "por favor", "tengo", "quiero", "necesito",
    "hoy", "mañana", "calendario", "agenda", "cerca", "favorito", "favorita"
  ],
  ja: [
    "konnichiwa", "ohayo", "ohayou", "konbanwa", "arigato", "arigatou", "doko", "nani", "dare",
    "itsu", "naze", "dou", "watashi", "boku", "ore", "suki", "anime", "yotei", "kyou", "ashita"
  ]
};

const WAKE_ALIASES = [
  "jordan", "jordon", "jordan", "jordam", "jordã", "jordao", "jordão", "joudan", "jodan", "gordan", "gordon"
];

const COMMON_CORRECTIONS = [
  { pattern: /\blucy\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\blufi\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\bluffy\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\bzorro\b/gi, value: "Zoro", domain: "anime" },
  { pattern: /\broronoa zorro\b/gi, value: "Roronoa Zoro", domain: "anime" },
  { pattern: /\bnarto\b/gi, value: "Naruto", domain: "anime" },
  { pattern: /\bnarulto\b/gi, value: "Naruto", domain: "anime" },
  { pattern: /\bsasuki\b/gi, value: "Sasuke", domain: "anime" },
  { pattern: /\bitati\b/gi, value: "Itachi", domain: "anime" },
  { pattern: /\biraia\b/gi, value: "Jiraiya", domain: "anime" },
  { pattern: /\bjiraya\b/gi, value: "Jiraiya", domain: "anime" },
  { pattern: /\bquilua\b/gi, value: "Killua", domain: "anime" },
  { pattern: /\bkilua\b/gi, value: "Killua", domain: "anime" },
  { pattern: /\bgatsu\b/gi, value: "Guts", domain: "anime" },
  { pattern: /\bgás station\b/gi, value: "gas station", domain: "general" },
  { pattern: /\bgas estation\b/gi, value: "gas station", domain: "general" }
];

const ANIME_CONTEXT = /\b(anime|manga|one piece|naruto|hunter|berserk|personagem|character|fruta|devil fruit|akuma|haki|nen|chakra|luffy|lucy|zoro|sasuke|itachi|jiraiya|gon|killua|guts)\b/i;

function hasJapaneseScript(text = "") {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function normalizedForDetection(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectLanguages(text = "") {
  const raw = String(text || "");
  const normalized = normalizedForDetection(raw);
  const scores = { pt: 0, en: 0, ja: 0, es: 0 };

  if (hasJapaneseScript(raw)) scores.ja += 12;

  for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) {
    for (const marker of markers) {
      const clean = normalizedForDetection(marker);
      if (normalized.includes(clean)) scores[lang] += clean.includes(" ") ? 3 : 1;
    }
  }

  // Pequenas pistas ortográficas que ajudam em frases sem palavras interrogativas.
  if (/\b(the|and|is|are|with|from|this|that|your|you|of|to)\b/.test(normalized)) scores.en += 2;
  if (/\b(el|la|los|las|una|uno|con|para|tu|usted|de)\b/.test(normalized)) scores.es += 1.5;
  if (/\b(o|a|os|as|um|uma|com|para|pra|seu|sua|de)\b/.test(normalized)) scores.pt += 1;
  if (/\b(desu|masu|wa|ga|no|ni|wo|o|kara|made)\b/.test(normalized)) scores.ja += 1.5;

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0);

  if (!sorted.length) return [{ id: "pt", locale: "pt-BR", score: 0 }];

  const topScore = sorted[0][1];
  return sorted
    .filter(([, score]) => score >= Math.max(1, topScore * 0.35))
    .map(([id, score]) => ({ id, locale: SUPPORTED_LANGUAGES[id].locale, score }));
}

export function detectLanguage(text = "", fallback = "pt") {
  return detectLanguages(text)[0]?.id ?? fallback;
}

export function localeForLanguage(language = "pt") {
  return SUPPORTED_LANGUAGES[language]?.locale ?? SUPPORTED_LANGUAGES.pt.locale;
}

export function languageForLocale(locale = "pt-BR") {
  const lower = String(locale).toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("es")) return "es";
  return "pt";
}

export function containsWakeWord(text = "") {
  const normalized = normalizeText(text);
  return WAKE_ALIASES.some((alias) => new RegExp(`\\b${normalizeText(alias)}\\b`, "i").test(normalized));
}

export function normalizeWakeWord(text = "") {
  let result = String(text || "");
  for (const alias of WAKE_ALIASES) {
    const regex = new RegExp(`\\b${alias}\\b`, "gi");
    result = result.replace(regex, "Jordan");
  }
  return result;
}

export function correctSpeechTranscript(text = "", { animeContext = false } = {}) {
  let result = normalizeWakeWord(text);
  const useAnime = animeContext || ANIME_CONTEXT.test(result);

  for (const correction of COMMON_CORRECTIONS) {
    if (correction.domain === "anime" && !useAnime) continue;
    result = result.replace(correction.pattern, correction.value);
  }

  return result.replace(/\s+/g, " ").trim();
}

export function scoreRecognitionCandidate(text = "", confidence = 0, { animeContext = false } = {}) {
  const corrected = correctSpeechTranscript(text, { animeContext });
  const normalized = normalizeText(corrected);
  let score = Number.isFinite(confidence) ? confidence * 10 : 0;

  if (containsWakeWord(corrected)) score += 7;
  if (ANIME_CONTEXT.test(corrected)) score += 3;
  if (/\b(marque|agenda|calendar|schedule|remember|lembre|hola|hello|hi|gas station|posto|anime|personagem)\b/i.test(corrected)) score += 2;
  if (normalized.length > 2) score += Math.min(2, normalized.split(/\s+/).length * 0.15);

  // Penaliza lixo comum de reconhecimento isolado.
  if (/^(uh|um|hum|hmm|ah|a|o)$/i.test(normalized)) score -= 4;
  return { text: corrected, score };
}

export function responseLanguageForInput(text = "") {
  const langs = detectLanguages(text);
  const primary = langs[0]?.id ?? "pt";
  return primary;
}

export function greetingForLanguage(language = "pt") {
  const greetings = {
    pt: "Oi",
    en: "Hi",
    es: "Hola",
    ja: "こんにちは"
  };
  return greetings[language] ?? greetings.pt;
}

export function isEnglishGreeting(text = "") {
  return /^(hi|hello|hey)(\s+jordan)?\b/i.test(text.trim());
}

export function isSpanishGreeting(text = "") {
  return /^(hola|buenos dias|buenas tardes|buenas noches)(\s+jordan)?\b/i.test(normalizedForDetection(text).trim());
}

export function isJapaneseGreeting(text = "") {
  const raw = text.trim();
  const normalized = normalizedForDetection(raw);
  return /^(こんにちは|おはよう|こんばんは)/.test(raw) || /^(konnichiwa|ohayo|ohayou|konbanwa)(\s+jordan)?\b/.test(normalized);
}

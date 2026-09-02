import { normalizeText } from "./utils.js";

export const SUPPORTED_LANGUAGES = {
  auto: { id: "auto", label: "Automático · PT / EN / ES / JA", locale: "pt-BR", short: "AUTO" },
  pt: { id: "pt", label: "Português (Brasil)", locale: "pt-BR", short: "PT" },
  en: { id: "en", label: "English (US)", locale: "en-US", short: "EN" },
  es: { id: "es", label: "Español", locale: "es-ES", short: "ES" },
  ja: { id: "ja", label: "日本語", locale: "ja-JP", short: "JA" }
};

const LANGUAGE_MARKERS = {
  pt: ["voce","você","eu","meu","minha","onde","aonde","como","porque","por que","qual","quero","preciso","tenho","hoje","amanha","obrigado","fala","fale","marque","agenda","calendario","perto","proximo"],
  en: ["hi","hello","hey","where","what","who","when","why","how","please","thanks","my","i am","i have","i want","can you","tell me","show me","near","nearest","today","tomorrow","calendar","schedule","gas station","favorite","favourite"],
  es: ["hola","buenos","buenas","donde","dónde","que","qué","quien","quién","cuando","cuándo","por que","por qué","como","cómo","gracias","por favor","tengo","quiero","necesito","hoy","mañana","calendario","agenda","cerca","favorito","favorita"],
  ja: ["konnichiwa","ohayo","ohayou","konbanwa","arigato","arigatou","doko","nani","dare","itsu","naze","dou","watashi","boku","ore","suki","anime","yotei","kyou","ashita"]
};

const WAKE_ALIASES = [
  "jordan","jordon","jordam","jordã","jordao","jordão","joudan","jodan","gordan","gordon","jorden"
];

const COMMON_CORRECTIONS = [
  { pattern: /\blucy\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\bluci\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\blufi\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\bluffi\b/gi, value: "Luffy", domain: "anime" },
  { pattern: /\bzorro\b/gi, value: "Zoro", domain: "anime" },
  { pattern: /\broronoa zorro\b/gi, value: "Roronoa Zoro", domain: "anime" },
  { pattern: /\bnarto\b/gi, value: "Naruto", domain: "anime" },
  { pattern: /\bnarulto\b/gi, value: "Naruto", domain: "anime" },
  { pattern: /\bsasuki\b/gi, value: "Sasuke", domain: "anime" },
  { pattern: /\bitati\b/gi, value: "Itachi", domain: "anime" },
  { pattern: /\bjiraya\b/gi, value: "Jiraiya", domain: "anime" },
  { pattern: /\biraia\b/gi, value: "Jiraiya", domain: "anime" },
  { pattern: /\bquilua\b/gi, value: "Killua", domain: "anime" },
  { pattern: /\bkilua\b/gi, value: "Killua", domain: "anime" },
  { pattern: /\bgatsu\b/gi, value: "Guts", domain: "anime" },
  { pattern: /\bgas estation\b/gi, value: "gas station", domain: "general" },
  { pattern: /\bgás station\b/gi, value: "gas station", domain: "general" }
];

const ANIME_CONTEXT = /\b(anime|manga|one piece|naruto|hunter|berserk|personagem|character|fruta|devil fruit|akuma|haki|nen|chakra|luffy|lucy|luci|zoro|sasuke|itachi|jiraiya|gon|killua|guts|gojo|sukuna)\b/i;

function normalizedForDetection(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasJapaneseScript(text = "") {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

export function detectLanguages(text = "") {
  const raw = String(text || "");
  const normalized = normalizedForDetection(raw);
  const scores = { pt: 0, en: 0, es: 0, ja: 0 };

  if (hasJapaneseScript(raw)) scores.ja += 14;

  for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) {
    for (const marker of markers) {
      const clean = normalizedForDetection(marker);
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const markerRegex = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`);
      if (markerRegex.test(normalized)) scores[lang] += clean.includes(" ") ? 3 : 1;
    }
  }

  if (/\b(the|and|is|are|with|from|this|that|your|you|of|to|for|at)\b/.test(normalized)) scores.en += 2;
  if (/\b(el|la|los|las|una|uno|con|para|tu|usted|de|del)\b/.test(normalized)) scores.es += 1.5;
  if (/\b(o|a|os|as|um|uma|com|para|pra|seu|sua|de|do|da)\b/.test(normalized)) scores.pt += 1;
  if (/\b(desu|masu|konnichiwa|ohayou|arigatou|doko|nani|dare|naze|ashita|kyou)\b/.test(normalized)) scores.ja += 2;

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
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("ja")) return "ja";
  return "pt";
}

export function containsWakeWord(text = "") {
  const normalized = normalizeText(text);
  return WAKE_ALIASES.some((alias) => new RegExp(`\\b${normalizeText(alias)}\\b`, "i").test(normalized));
}

export function normalizeWakeWord(text = "") {
  let result = String(text || "");
  for (const alias of WAKE_ALIASES) {
    result = result.replace(new RegExp(`\\b${alias}\\b`, "gi"), "Jordan");
  }
  return result;
}

export function removeWakeWord(text = "") {
  return normalizeWakeWord(text)
    .replace(/^\s*(?:hi|hello|hey|hola|oi|ola|olá|opa|salve)?\s*jordan\s*[,;:!\-]?\s*/i, "")
    .replace(/^\s*jordan\s*[,;:!\-]?\s*/i, "")
    .trim();
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
  if (/\b(marque|agenda|calendar|schedule|remember|lembre|hola|hello|hi|gas station|posto|anime|personagem|favorite|favorito)\b/i.test(corrected)) score += 2;
  if (normalized.length > 2) score += Math.min(2, normalized.split(/\s+/).length * 0.15);
  if (/^(uh|um|hum|hmm|ah|a|o)$/i.test(normalized)) score -= 4;

  return { text: corrected, score };
}

export function pickBestRecognitionAlternative(result, context = {}) {
  if (!result?.length) return { text: "", score: -Infinity, confidence: 0 };

  const candidates = [];
  for (let index = 0; index < result.length; index++) {
    const alt = result[index];
    const scored = scoreRecognitionCandidate(alt?.transcript || "", alt?.confidence || 0, context);
    candidates.push({ ...scored, confidence: alt?.confidence || 0, index });
  }

  return candidates.sort((a, b) => b.score - a.score)[0] ?? { text: "", score: -Infinity, confidence: 0 };
}

export function responseLanguageForInput(text = "") {
  return detectLanguage(text, "pt");
}

export function greetingForLanguage(language = "pt") {
  return ({ pt: "Oi", en: "Hi", es: "Hola", ja: "こんにちは" })[language] ?? "Oi";
}

export function basicLocalizedText(key, language = "pt") {
  const table = {
    ready: { pt: "Sistema pronto.", en: "System ready.", es: "Sistema listo.", ja: "準備できました。" },
    listening: { pt: "Estou ouvindo...", en: "I'm listening...", es: "Estoy escuchando...", ja: "聞いています…" },
    processing: { pt: "Processando...", en: "Processing...", es: "Procesando...", ja: "処理中…" },
    online: { pt: "Internet online", en: "Internet online", es: "Internet en línea", ja: "インターネット接続中" },
    offline: { pt: "Sem internet", en: "Offline", es: "Sin internet", ja: "オフライン" }
  };
  return table[key]?.[language] ?? table[key]?.pt ?? key;
}

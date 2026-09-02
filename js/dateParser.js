import { addDays, capitalize, normalizeText, startOfDay } from "./utils.js";

const MONTHS = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11
};

const WEEKDAYS = {
  domingo: 0,
  segunda: 1,
  "segunda feira": 1,
  terca: 2,
  "terca feira": 2,
  quarta: 3,
  "quarta feira": 3,
  quinta: 4,
  "quinta feira": 4,
  sexta: 5,
  "sexta feira": 5,
  sabado: 6
};

const NUMBER_WORDS = {
  zero: 0,
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  "vinte e uma": 21,
  "vinte e um": 21,
  "vinte e duas": 22,
  "vinte e dois": 22,
  "vinte e tres": 23
};

export function resolveDateFromText(input, now = new Date()) {
  const text = normalizeText(input);
  const base = startOfDay(now);

  if (/\bdepois de amanha\b/.test(text)) return addDays(base, 2);
  if (/\bamanha\b/.test(text)) return addDays(base, 1);
  if (/\bhoje\b/.test(text)) return base;

  const numeric = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;

    const candidate = new Date(year, month, day);
    if (!numeric[3] && candidate < base) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return startOfDay(candidate);
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const named = text.match(new RegExp(`\\bdia\\s+(\\d{1,2})(?:\\s+de)?\\s+(${monthNames})(?:\\s+de\\s+(\\d{4}))?\\b`));
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2]];
    let year = named[3] ? Number(named[3]) : now.getFullYear();

    const candidate = new Date(year, month, day);
    if (!named[3] && candidate < base) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return startOfDay(candidate);
  }

  const dayOnly = text.match(/\bdia\s+(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    let candidate = new Date(now.getFullYear(), now.getMonth(), day);

    if (candidate < base) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }

    return startOfDay(candidate);
  }

  for (const [weekdayText, weekday] of Object.entries(WEEKDAYS)) {
    const regex = new RegExp(`\\b${weekdayText}\\b`);
    if (regex.test(text)) {
      let diff = (weekday - base.getDay() + 7) % 7;

      const wantsNext = new RegExp(`\\b(proxima|proximo)\\s+${weekdayText}\\b`).test(text);
      if (diff === 0 || wantsNext) diff += 7;

      return addDays(base, diff);
    }
  }

  return null;
}

export function resolveTimeFromText(input, fallback = null) {
  const text = normalizeText(input);

  if (/\bmeio dia\b/.test(text)) return { hour: 12, minute: 0 };
  if (/\bmeia noite\b/.test(text)) return { hour: 0, minute: 0 };

  let match = text.match(/\b(?:as|a|pelas?)?\s*(\d{1,2})[:h](\d{2})\b/);
  if (match) {
    return normalizeTime(Number(match[1]), Number(match[2]), text);
  }

  match = text.match(/\b(?:as|a|pelas?)\s+(\d{1,2})(?:\s*(?:h|horas?))?\b/);
  if (match) {
    return normalizeTime(Number(match[1]), 0, text);
  }

  match = text.match(/\b(\d{1,2})\s*(?:h|horas?)\b/);
  if (match) {
    return normalizeTime(Number(match[1]), 0, text);
  }

  const wordKeys = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const word of wordKeys) {
    const regex = new RegExp(`\\b(?:as|a|pelas?)?\\s*${word}\\s*(?:horas?)?(?:\\s+da\\s+(?:manha|tarde|noite))?\\b`);
    if (regex.test(text)) {
      return normalizeTime(NUMBER_WORDS[word], 0, text);
    }
  }

  return fallback;
}

function normalizeTime(hour, minute, text) {
  if (/\bda tarde\b/.test(text) && hour >= 1 && hour <= 11) hour += 12;
  if (/\bda noite\b/.test(text) && hour >= 1 && hour <= 11) hour += 12;
  if (/\bda manha\b/.test(text) && hour === 12) hour = 0;

  hour = Math.max(0, Math.min(23, hour));
  minute = Math.max(0, Math.min(59, minute));

  return { hour, minute };
}

export function resolveDurationFromText(input, fallbackMinutes = null) {
  const text = normalizeText(input);

  const hourMinute = text.match(/\bpor\s+(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(\d+)?\s*(?:min(?:utos?)?)?/);
  if (hourMinute) {
    return Number(hourMinute[1]) * 60 + Number(hourMinute[2] || 0);
  }

  const hours = text.match(/\bpor\s+(\d+(?:[.,]\d+)?)\s*horas?\b/);
  if (hours) {
    return Math.round(Number(hours[1].replace(",", ".")) * 60);
  }

  const minutes = text.match(/\bpor\s+(\d+)\s*minutos?\b/);
  if (minutes) {
    return Number(minutes[1]);
  }

  if (/\bpor\s+meia\s+hora\b/.test(text)) return 30;
  if (/\bpor\s+uma\s+hora\b/.test(text)) return 60;
  if (/\bpor\s+duas\s+horas\b/.test(text)) return 120;
  if (/\bpor\s+tres\s+horas\b/.test(text)) return 180;
  if (/\bpor\s+quatro\s+horas\b/.test(text)) return 240;
  if (/\bpor\s+oito\s+horas\b/.test(text)) return 480;

  return fallbackMinutes;
}

export function resolveStandaloneDurationFromText(input, fallbackMinutes = null) {
  const text = normalizeText(input);

  const hourMinute = text.match(/\b(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(\d+)?\s*(?:min(?:utos?)?)?\b/);
  if (hourMinute) {
    return Number(hourMinute[1]) * 60 + Number(hourMinute[2] || 0);
  }

  const hours = text.match(/\b(\d+(?:[.,]\d+)?)\s*horas?\b/);
  if (hours) {
    return Math.round(Number(hours[1].replace(",", ".")) * 60);
  }

  const minutes = text.match(/\b(\d+)\s*minutos?\b/);
  if (minutes) return Number(minutes[1]);

  if (/\bmeia\s+hora\b/.test(text)) return 30;
  if (/\buma\s+hora\b/.test(text)) return 60;
  if (/\bduas\s+horas\b/.test(text)) return 120;
  if (/\btres\s+horas\b/.test(text)) return 180;
  if (/\bquatro\s+horas\b/.test(text)) return 240;
  if (/\boito\s+horas\b/.test(text)) return 480;

  return fallbackMinutes;
}

export function buildDateTime(date, time, fallbackHour = 9) {
  const result = new Date(date);
  result.setHours(time?.hour ?? fallbackHour, time?.minute ?? 0, 0, 0);
  return result;
}

export function extractEventTitle(input) {
  let text = normalizeText(input);

  const removals = [
    /\bjordan\b/g,
    /\b(por favor)\b/g,
    /\b(me lembre de|me lembra de|lembre me de)\b/g,
    /\b(marque|marca|agende|agenda|agendar|adicione|adiciona|crie|cria|coloque|coloca)\b/g,
    /\b(um|uma)?\s*(compromisso|evento|lembrete)\b/g,
    /\b(hoje|amanha|depois de amanha)\b/g,
    /\b(proxima|proximo)?\s*(segunda feira|segunda|terca feira|terca|quarta feira|quarta|quinta feira|quinta|sexta feira|sexta|sabado|domingo)\b/g,
    /\bdia\s+\d{1,2}(?:\s+de\s+[a-z]+(?:\s+de\s+\d{4})?)?/g,
    /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,
    /\b(?:as|a|pelas?)?\s*\d{1,2}[:h]\d{2}\b/g,
    /\b(?:as|a|pelas?)\s+\d{1,2}(?:\s*(?:h|horas?))?\b/g,
    /\b\d{1,2}\s*(?:h|horas?)\b/g,
    /\bpor\s+\d+(?:[.,]\d+)?\s*(?:horas?|minutos?)\b/g,
    /\bpor\s+(?:meia|uma|duas|tres)\s+horas?\b/g,
    /\bda\s+(manha|tarde|noite)\b/g
  ];

  for (const regex of removals) {
    text = text.replace(regex, " ");
  }

  for (const word of Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(`\\b(?:as|a|pelas?)?\\s*${word}\\s*(?:horas?)?\\b`, "g"), " ");
  }

  text = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(de|para|pra|no|na|em|por)\b$/g, "")
    .trim();

  return capitalize(text || "Compromisso");
}

export function describeResolvedDate(date, now = new Date()) {
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diff = Math.round((target - today) / 86400000);

  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === 2) return "depois de amanhã";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

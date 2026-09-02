import { normalizeText } from "./utils.js";

function cleanValue(value = "") {
  return String(value)
    .replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, "")
    .trim();
}

const APP_ALIASES = {
  youtube: ["youtube", "you tube"],
  x: ["x", "twitter"],
  instagram: ["instagram", "insta"],
  spotify: ["spotify"],
  whatsapp: ["whatsapp", "whats", "zap"],
  tiktok: ["tiktok", "tik tok"],
  discord: ["discord"],
  reddit: ["reddit"],
  github: ["github", "git hub"],
  maps: ["google maps", "maps", "mapas"],
  gmail: ["gmail", "email", "e mail"]
};

function detectApp(text) {
  const normalized = normalizeText(text);
  for (const [id, aliases] of Object.entries(APP_ALIASES)) {
    if (aliases.some((alias) => normalized === normalizeText(alias) || normalized.endsWith(` ${normalizeText(alias)}`))) {
      return id;
    }
  }
  return null;
}

function stripWakeWord(input = "") {
  return String(input).replace(/^\s*jordan\s*[,;:!?.-]?\s*/i, "").trim();
}

export function parsePortugueseOrder(input = "") {
  const raw = stripWakeWord(input);
  const text = normalizeText(raw);
  if (!text) return null;

  let match = raw.match(/^\s*(?:diga|fale|repita|pronuncie)\s+(.+)/i);
  if (match) {
    return { intent: "say", value: cleanValue(match[1]), confidence: 1 };
  }

  match = raw.match(/^\s*(?:me\s+)?(?:pergunte|pergunta)\s*(.*)$/i);
  if (match) {
    return { intent: "ask_user", value: cleanValue(match[1]), confidence: 0.98 };
  }

  match = raw.match(/^\s*(?:pesquise|pesquisa|procure|busque|investigue)\s+(?:na\s+internet\s+|online\s+)?(.+)/i);
  if (match) {
    return { intent: "research", value: cleanValue(match[1]), confidence: 1 };
  }

  match = raw.match(/^\s*(?:toque|toca|reproduza|reproduzir|coloque|ponha|bote)\s+(.*)$/i);
  if (match) {
    let value = cleanValue(match[1])
      .replace(/^(?:uma|a)\s+(?:musica|música|faixa|playlist)\s*/i, "")
      .replace(/^qualquer\s+(?:musica|música|faixa)\s*/i, "")
      .trim();
    const random = /\bqualquer\b/i.test(match[1]) || !value;
    return { intent: "play_music", value, random, confidence: 0.99 };
  }

  match = raw.match(/^\s*(?:cante|canta)\s*(.*)$/i);
  if (match) {
    let value = cleanValue(match[1])
      .replace(/^(?:uma|a|alguma)\s+(?:musica|música|canção|cancao)\s*/i, "")
      .trim();
    const random = /\bqualquer\b/i.test(value) || /^(?:alguma coisa|qualquer coisa|algo)$/i.test(value) || !value;
    value = value.replace(/\bqualquer\b/gi, "").replace(/^(?:alguma coisa|qualquer coisa|algo)$/i, "").trim();
    return { intent: "sing", value, random, confidence: 0.99 };
  }

  match = raw.match(/^\s*(?:abra|abre|abrir|inicie|inicia|acesse|acessa)\s+(?:o|a)?\s*(.+)$/i);
  if (match) {
    const app = detectApp(match[1]);
    if (app) return { intent: "open_app", app, confidence: 0.99 };
  }

  match = raw.match(/^\s*(?:como\s+(?:eu\s+)?chego\s+(?:em|no|na|ao|a)|como\s+chegar\s+(?:em|no|na|ao|a)|me\s+leve\s+(?:para|pro|pra|ao|a)|trace\s+(?:uma\s+)?rota\s+(?:para|pro|pra|ate|até)|rota\s+(?:para|pro|pra|ate|até)|caminho\s+(?:para|pro|pra|ate|até)|direc(?:ao|ão|oes|ões)\s+(?:para|pro|pra|ate|até)|navegue\s+(?:para|pro|pra|ate|até))\s+(.+)/i);
  if (match) {
    return { intent: "directions", value: cleanValue(match[1]), confidence: 1 };
  }

  if (/\b(?:fisica|física|circuito|circuitos|resistor|resistencia|resistência|corrente|tensao|tensão|voltagem|potencia|potência|velocidade|energia cinetica|energia cinética|momento linear|forca|força|aceleracao|aceleração|ohm)\b/i.test(raw)) {
    return { intent: "science", value: raw, confidence: 0.92 };
  }

  return null;
}

export function isGeneralPortugueseOrder(input = "") {
  return Boolean(parsePortugueseOrder(input));
}

import { normalizeText } from "./utils.js";

export const EVENT_PROFILES = [
  {
    id: "work",
    label: "trabalho",
    defaultDurationMinutes: 480,
    reminderOffsets: [60, 15, 0],
    patterns: ["trabalho", "trabalhar", "turno", "expediente", "servico"]
  },
  {
    id: "gaming",
    label: "tempo de jogo",
    defaultDurationMinutes: 30,
    reminderOffsets: [10, 2, 0],
    patterns: ["jogo", "jogar", "game", "gaming", "videogame", "partida"]
  },
  {
    id: "appointment",
    label: "compromisso",
    defaultDurationMinutes: 60,
    reminderOffsets: [30, 10, 0],
    patterns: [
      "dentista", "medico", "consulta", "compromisso", "reuniao", "entrevista",
      "barbeiro", "cabeleireiro", "exame", "fisioterapia"
    ]
  },
  {
    id: "gym",
    label: "treino",
    defaultDurationMinutes: 60,
    reminderOffsets: [30, 10, 0],
    patterns: ["academia", "treino", "treinar", "corrida", "correr"]
  },
  {
    id: "study",
    label: "estudo",
    defaultDurationMinutes: 120,
    reminderOffsets: [30, 10, 0],
    patterns: ["estudar", "estudo", "aula", "curso", "prova", "trabalho da escola"]
  },
  {
    id: "meal",
    label: "refeição",
    defaultDurationMinutes: 45,
    reminderOffsets: [15, 5, 0],
    patterns: ["almoco", "jantar", "cafe", "lanche", "comer"]
  },
  {
    id: "default",
    label: "compromisso",
    defaultDurationMinutes: 60,
    reminderOffsets: [30, 10, 0],
    patterns: []
  }
];

export function detectEventProfile(text = "") {
  const normalized = normalizeText(text);

  return EVENT_PROFILES.find((profile) =>
    profile.id !== "default" &&
    profile.patterns.some((pattern) => normalized.includes(normalizeText(pattern)))
  ) ?? EVENT_PROFILES.find((profile) => profile.id === "default");
}

export function getEventProfile(profileId = "default") {
  return EVENT_PROFILES.find((profile) => profile.id === profileId)
    ?? EVENT_PROFILES.find((profile) => profile.id === "default");
}

export function buildReminderOffsets(profile, startAt, createdAt = new Date()) {
  const start = new Date(startAt);
  const created = new Date(createdAt);
  const minutesUntilStart = Math.floor((start - created) / 60000);

  if (minutesUntilStart < 0) return [];

  const minimumLeadMs = 60 * 1000;
  const selected = [];

  for (const offset of profile.reminderOffsets) {
    if (offset === 0) {
      selected.push(0);
      continue;
    }

    const fireAt = new Date(start.getTime() - offset * 60000);
    if (fireAt.getTime() >= created.getTime() + minimumLeadMs) {
      selected.push(offset);
    }
  }

  // Se o compromisso foi criado muito em cima da hora e todos os pré-avisos
  // normais já passaram, cria um único aviso intermediário, desde que exista
  // espaço suficiente para ele não disparar imediatamente.
  const hasPreAlert = selected.some((offset) => offset > 0);
  if (!hasPreAlert && minutesUntilStart >= 4) {
    const dynamicOffset = Math.max(1, Math.floor(minutesUntilStart / 2));
    const dynamicFireAt = new Date(start.getTime() - dynamicOffset * 60000);

    if (dynamicFireAt.getTime() >= created.getTime() + minimumLeadMs) {
      selected.unshift(dynamicOffset);
    }
  }

  return [...new Set(selected)].sort((a, b) => b - a);
}

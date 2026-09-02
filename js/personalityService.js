export const PERSONALITIES = {
  extroverted: {
    id: "extroverted",
    label: "Extrovertida",
    description: "Falante, rápida, espontânea e puxa assunto quando o silêncio fica longo.",
    voice: { rate: 1.18, pitch: 1.34 },
    idleMinMs: 26000,
    idleMaxMs: 42000,
    idlePrompts: [
      "Ei, tô por aqui! Se quiser começar, é só falar Jordan e mandar o comando.",
      "Silêncio suspeito por aqui... quer organizar alguma coisa ou conversar um pouco?",
      "Pode falar comigo, viu? Agenda, memória, anime, história... manda aí.",
      "Tô esperando você inventar alguma missão pra mim!",
      "Se quiser, me conta alguma coisa. Eu também posso puxar um assunto."
    ]
  },
  introverted: {
    id: "introverted",
    label: "Introvertida",
    description: "Respostas curtas, objetivas e quase nenhum comentário extra.",
    voice: { rate: 1.08, pitch: 1.30 },
    idleMinMs: 0,
    idleMaxMs: 0,
    idlePrompts: []
  },
  balanced: {
    id: "balanced",
    label: "Equilibrada",
    description: "Conversa normalmente sem ser muito falante nem muito seca.",
    voice: { rate: 1.12, pitch: 1.32 },
    idleMinMs: 70000,
    idleMaxMs: 110000,
    idlePrompts: [
      "Se precisar de mim, é só chamar.",
      "Ainda estou aqui. Quer continuar?"
    ]
  },
  playful: {
    id: "playful",
    label: "Brincalhona",
    description: "Mais expressiva, energética e com comentários leves.",
    voice: { rate: 1.20, pitch: 1.38 },
    idleMinMs: 23000,
    idleMaxMs: 38000,
    idlePrompts: [
      "Jordan parada é desperdício de processamento, hein! Me dá alguma coisa pra fazer.",
      "Alô? Eu prometo não dominar o mundo hoje. Pode falar.",
      "Quer falar de anime? Porque eu aceito facilmente essa missão.",
      "Manda um comando aí. Tô começando a conversar com meus próprios pixels."
    ]
  },
  professional: {
    id: "professional",
    label: "Profissional",
    description: "Direta, organizada e focada em tarefas.",
    voice: { rate: 1.10, pitch: 1.28 },
    idleMinMs: 0,
    idleMaxMs: 0,
    idlePrompts: []
  }
};

export function getPersonality(id = "extroverted") {
  return PERSONALITIES[id] ?? PERSONALITIES.extroverted;
}

export function randomIdleDelay(profile) {
  if (!profile?.idleMinMs || !profile?.idleMaxMs) return 0;
  const min = profile.idleMinMs;
  const max = Math.max(min, profile.idleMaxMs);
  return Math.round(min + Math.random() * (max - min));
}

export function randomIdlePrompt(profile) {
  const prompts = profile?.idlePrompts ?? [];
  if (!prompts.length) return null;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

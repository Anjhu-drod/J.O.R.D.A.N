// JORDAN Spark PT-BR
// Perfil ORIGINAL de prosódia da JORDAN. Ele não clona a identidade vocal de
// nenhuma personagem/pessoa. Enquanto o projeto estiver 100% web sem um modelo
// neural próprio, o timbre-base ainda vem do sintetizador disponível no aparelho.

export const JORDAN_VOICE_PROFILE = Object.freeze({
  id: "jordan-spark-ptbr-v1",
  label: "JORDAN Spark · PT-BR",
  locale: "pt-BR",
  baseRate: 1.20,
  basePitch: 1.34,
  excitementRate: 0.045,
  excitementPitch: 0.08,
  seriousRate: -0.045,
  seriousPitch: -0.045,
  gentleRate: -0.025,
  gentlePitch: 0.025,
  questionTailPitch: 0.12,
  questionTailRate: -0.055,
  exclamationPitch: 0.11,
  exclamationRate: 0.04
});

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function chooseJordanBaseVoice(voices = [], locale = "pt-BR") {
  if (!voices.length) return null;
  const expected = locale.toLowerCase();
  const base = expected.split("-")[0];
  const candidates = voices.filter((voice) => (voice.lang || "").toLowerCase().startsWith(base));
  if (!candidates.length) return null;

  const feminine = [
    "google", "female", "feminina", "luciana", "francisca", "maria", "helena",
    "leticia", "camila", "fernanda", "vitoria", "bruna", "samantha", "victoria",
    "monica", "paulina"
  ];
  const masculine = /male|mascul|felipe|daniel|ricardo|antonio|joao|thiago|jorge|diego|carlos|david/;

  const score = (voice) => {
    const name = normalizeName(voice.name);
    const lang = (voice.lang || "").toLowerCase();
    let value = lang === expected ? 150 : 45;
    if (name.includes("google")) value += 180;
    feminine.forEach((hint, index) => {
      if (name.includes(hint)) value += Math.max(15, 80 - index * 3);
    });
    if (masculine.test(name)) value -= 240;
    return value;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0] || null;
}

export function buildJordanProsody(text = "", {
  rate = JORDAN_VOICE_PROFILE.baseRate,
  pitch = JORDAN_VOICE_PROFILE.basePitch,
  mood = "neutral"
} = {}) {
  let moodRate = rate;
  let moodPitch = pitch;

  if (mood === "excited") {
    moodRate += JORDAN_VOICE_PROFILE.excitementRate;
    moodPitch += JORDAN_VOICE_PROFILE.excitementPitch;
  } else if (mood === "serious") {
    moodRate += JORDAN_VOICE_PROFILE.seriousRate;
    moodPitch += JORDAN_VOICE_PROFILE.seriousPitch;
  } else if (mood === "gentle") {
    moodRate += JORDAN_VOICE_PROFILE.gentleRate;
    moodPitch += JORDAN_VOICE_PROFILE.gentlePitch;
  }

  const clean = String(text)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n+/g, ". ")
    .replace(/•/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = clean.match(/[^.!?…]+[.!?…]?/g) ?? [clean];
  const segments = [];

  for (const item of sentences) {
    const sentence = item.trim();
    if (!sentence) continue;
    const punctuation = /[.!?…]/.test(sentence.slice(-1)) ? sentence.slice(-1) : "";
    const body = punctuation ? sentence.slice(0, -1).trim() : sentence;

    if (punctuation === "?") {
      const words = body.split(/\s+/);
      const tailSize = Math.min(3, Math.max(1, words.length));
      const main = words.slice(0, -tailSize).join(" ");
      const tail = words.slice(-tailSize).join(" ");
      if (main) segments.push({ text: main, rate: moodRate, pitch: moodPitch });
      segments.push({
        text: `${tail}?`,
        rate: Math.max(0.75, moodRate + JORDAN_VOICE_PROFILE.questionTailRate),
        pitch: Math.min(2, moodPitch + JORDAN_VOICE_PROFILE.questionTailPitch)
      });
      continue;
    }

    if (punctuation === "!") {
      segments.push({
        text: `${body}!`,
        rate: Math.min(2, moodRate + JORDAN_VOICE_PROFILE.exclamationRate),
        pitch: Math.min(2, moodPitch + JORDAN_VOICE_PROFILE.exclamationPitch)
      });
      continue;
    }

    if (punctuation === "…") {
      segments.push({ text: `${body}...`, rate: Math.max(0.75, moodRate - 0.08), pitch: Math.max(0.6, moodPitch - 0.04) });
      continue;
    }

    segments.push({ text: punctuation === "." ? `${body}.` : body, rate: moodRate, pitch: moodPitch });
  }

  return segments;
}

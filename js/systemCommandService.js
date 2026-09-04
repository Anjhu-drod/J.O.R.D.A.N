import { normalizeText } from "./utils.js";

const COMMANDS = [
  {
    id: "audio_on",
    phrase: "Open the audio",
    hint: "ôu-pen dhi ó-dio",
    description: "Ativa a escuta contínua.",
    aliases: ["open audio", "open de audio", "open di audio", "turn on the audio", "turn the audio on"]
  },
  {
    id: "audio_off",
    phrase: "Turn off the audio",
    hint: "târn óf dhi ó-dio",
    description: "Desativa a escuta contínua.",
    aliases: ["turn the audio off", "turn off de audio", "turn off di audio", "close the audio"]
  },
  {
    id: "stop_speaking",
    phrase: "Shut up",
    hint: "shât âp",
    description: "Interrompe a fala atual da JORDAN.",
    aliases: ["stop talking", "be quiet", "chat up", "shut app", "cala a boca", "para de falar", "pare de falar", "fica quieta", "silencio", "silêncio", "jordan silencio", "jordan silêncio"]
  },
  {
    id: "open_calendar",
    phrase: "Open the calendar",
    hint: "ôu-pen dhi ké-len-dâr",
    description: "Abre o calendário.",
    aliases: ["open calendar", "open de calendar"]
  },
  {
    id: "open_memory",
    phrase: "Open the memory",
    hint: "ôu-pen dhi mé-mo-ri",
    description: "Abre a memória.",
    aliases: ["open memory", "open de memory"]
  },
  {
    id: "open_settings",
    phrase: "Open the settings",
    hint: "ôu-pen dhi sé-tings",
    description: "Abre as configurações.",
    aliases: ["open settings", "open de settings"]
  },
  {
    id: "go_home",
    phrase: "Go home",
    hint: "gôu rôum",
    description: "Volta para o núcleo principal.",
    aliases: ["open home"]
  },
  {
    id: "open_tutorial",
    phrase: "Open the tutorial",
    hint: "ôu-pen dhi tu-tó-ri-al",
    description: "Abre o tutorial de recursos.",
    aliases: ["show commands"]
  },
  {
    id: "internet_on",
    phrase: "Turn on the internet",
    hint: "târn ón dhi ín-ter-net",
    description: "Ativa o Internet Core.",
    aliases: ["turn the internet on", "turn on de internet"]
  },
  {
    id: "internet_off",
    phrase: "Turn off the internet",
    hint: "târn óf dhi ín-ter-net",
    description: "Desativa o Internet Core.",
    aliases: ["turn the internet off", "turn off de internet"]
  },
  {
    id: "voice_mute",
    phrase: "Mute the voice",
    hint: "miút dhi vóis",
    description: "Desativa as respostas faladas, mantendo o chat.",
    aliases: ["mute voice", "mute de voice"]
  },
  {
    id: "voice_unmute",
    phrase: "Unmute the voice",
    hint: "ân-miút dhi vóis",
    description: "Reativa as respostas faladas.",
    aliases: ["unmute voice", "unmute de voice"]
  },
  {
    id: "volume_up",
    phrase: "Volume up",
    hint: "vó-lium âp",
    description: "Aumenta o volume da JORDAN.",
    aliases: ["speak louder"]
  },
  {
    id: "volume_down",
    phrase: "Volume down",
    hint: "vó-lium dáun",
    description: "Diminui o volume da JORDAN.",
    aliases: ["speak quieter"]
  },
  {
    id: "open_player",
    phrase: "Open the player",
    hint: "ôu-pen dhi plêi-er",
    description: "Abre o painel de música.",
    aliases: ["open player", "open de player"]
  },
  {
    id: "music_pause",
    phrase: "Pause the music",
    hint: "póz dhi miú-zik",
    description: "Pausa a música atual.",
    aliases: ["pause music", "pause de music"]
  },
  {
    id: "music_resume",
    phrase: "Play the music",
    hint: "plêi dhi miú-zik",
    description: "Continua a música carregada.",
    aliases: ["play music", "play de music", "resume the music"]
  },
  {
    id: "music_next",
    phrase: "Next track",
    hint: "nékst trék",
    description: "Vai para a próxima música da biblioteca.",
    aliases: ["next music", "next song"]
  },
  {
    id: "music_previous",
    phrase: "Previous track",
    hint: "prí-vi-âs trék",
    description: "Volta para a música anterior.",
    aliases: ["previous music", "previous song"]
  },
  {
    id: "music_shuffle",
    phrase: "Shuffle the music",
    hint: "shâ-fol dhi miú-zik",
    description: "Liga ou desliga a ordem aleatória.",
    aliases: ["shuffle music", "shuffle de music"]
  },
  {
    id: "open_research",
    phrase: "Open the research",
    hint: "ôu-pen dhi ri-sârtch",
    description: "Abre o painel de pesquisa.",
    aliases: ["open research", "open de research"]
  },
  {
    id: "open_navigation",
    phrase: "Open the navigation",
    hint: "ôu-pen dhi na-vi-gêi-shon",
    description: "Abre o painel de navegação.",
    aliases: ["open navigation", "open de navigation"]
  },
  {
    id: "open_lab",
    phrase: "Open the lab",
    hint: "ôu-pen dhi léb",
    description: "Abre o laboratório de física.",
    aliases: ["open lab", "open de lab"]
  },
  {
    id: "close_panel",
    phrase: "Close the panel",
    hint: "clôuz dhi pé-nel",
    description: "Fecha o painel lateral auxiliar.",
    aliases: ["close panel", "close de panel"]
  },
  {
    id: "clear_chat",
    phrase: "Clear the chat",
    hint: "clír dhi tchét",
    description: "Limpa somente o histórico visual do chat.",
    aliases: ["clear chat", "clear de chat"]
  }
];

function clean(text = "") {
  return normalizeText(String(text))
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a, b) {
  const left = clean(a);
  const right = clean(b);
  if (left === right) return 0;
  const m = left.length;
  const n = right.length;
  if (!m) return n;
  if (!n) return m;

  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const old = row[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = old;
    }
  }
  return row[n];
}

function isVeryClose(input, target) {
  const a = clean(input);
  const b = clean(target);
  if (!a || !b) return false;
  if (a === b) return true;
  // Tolerância pequena apenas para erros óbvios do reconhecimento.
  const max = b.length <= 8 ? 1 : b.length <= 16 ? 2 : 3;
  return distance(a, b) <= max;
}

export function getSystemCommands() {
  return COMMANDS.map((command) => ({ ...command, aliases: [...command.aliases] }));
}

export function matchSystemCommand(text = "") {
  const input = clean(text);
  if (!input) return null;

  // 1) Exato sempre ganha. Isso impede que pares muito parecidos, como
  // "turn on" e "turn off", sejam confundidos pela tolerância fonética.
  for (const command of COMMANDS) {
    for (const phrase of [command.phrase, ...command.aliases]) {
      if (input === clean(phrase)) {
        return { ...command, matchedPhrase: phrase, exact: true };
      }
    }
  }

  // 2) Só depois usamos tolerância pequena para erros óbvios do ASR.
  let best = null;
  for (const command of COMMANDS) {
    for (const phrase of [command.phrase, ...command.aliases]) {
      const target = clean(phrase);
      const d = distance(input, target);
      const max = target.length <= 8 ? 1 : target.length <= 16 ? 2 : 3;
      if (d > max) continue;

      if (!best || d < best.distance) {
        best = { command, phrase, distance: d };
      } else if (best && d === best.distance && best.command.id !== command.id) {
        // Empate entre ações diferentes: melhor não adivinhar um comando de sistema.
        best.ambiguous = true;
      }
    }
  }

  if (!best || best.ambiguous) return null;
  return { ...best.command, matchedPhrase: best.phrase, exact: false };
}

export function isImmediateStopCommand(text = "") {
  const matched = matchSystemCommand(text);
  return matched?.id === "stop_speaking";
}

export function systemCommandScore(text = "") {
  const input = clean(text);
  if (!input) return 0;
  let best = 0;
  for (const command of COMMANDS) {
    for (const phrase of [command.phrase, ...command.aliases]) {
      const target = clean(phrase);
      if (input === target) return 100;
      const d = distance(input, target);
      const score = Math.max(0, 35 - d * 8);
      if (score > best) best = score;
    }
  }
  return best;
}

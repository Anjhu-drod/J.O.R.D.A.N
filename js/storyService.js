import { createId, normalizeText } from "./utils.js";

const BUILT_IN_STORIES = [
  {
    id: "naruto-jiraiya",
    title: "O mestre que deixou uma mensagem",
    series: "Naruto",
    text: "Um ninja experiente entrou sozinho em território inimigo para descobrir o segredo de um adversário quase impossível de enfrentar. Mesmo percebendo que talvez não voltasse, ele continuou investigando. No fim, usou seus últimos momentos para deixar uma mensagem codificada para as pessoas que viriam depois. A informação que conseguiu acabou sendo decisiva para que seu aluno entendesse o inimigo e protegesse a vila."
  },
  {
    id: "one-piece-dream",
    title: "O garoto que saiu para o mar",
    series: "One Piece",
    text: "Um garoto partiu para o mar com um objetivo absurdo: chegar ao maior tesouro do mundo e se tornar o Rei dos Piratas. No caminho, ele não escolheu sua tripulação pela força apenas. Foi encontrando pessoas com sonhos próprios, e cada uma passou a fazer parte de uma família improvável. Quanto maior o mundo ficava, mais claro ficava que liberdade, amizade e vontade eram tão importantes quanto qualquer tesouro."
  },
  {
    id: "hxh-gon",
    title: "A jornada de um garoto caçador",
    series: "Hunter x Hunter",
    text: "Um garoto deixou sua ilha para se tornar Hunter e descobrir por que seu pai escolheu uma vida de aventuras. A busca começou como uma curiosidade, mas virou uma jornada cheia de amizade, perigo e escolhas difíceis. Ele conheceu um melhor amigo que vinha de uma família de assassinos, enfrentou criaturas muito mais fortes que ele e descobriu que determinação sem limite também pode cobrar um preço muito alto."
  },
  {
    id: "berserk-guts",
    title: "O espadachim que continua andando",
    series: "Berserk",
    text: "Um guerreiro que cresceu em campos de batalha passou boa parte da vida acreditando que só podia confiar na própria espada. Quando encontrou um grupo que finalmente parecia uma família, começou a imaginar que talvez pudesse escolher seu próprio caminho. Uma tragédia destruiu quase tudo, mas ele continuou avançando. A história passou a ser menos sobre vencer todas as lutas e mais sobre continuar humano mesmo carregando raiva, perda e cicatrizes."
  },
  {
    id: "aot-freedom",
    title: "O preço da liberdade",
    series: "Attack on Titan",
    text: "Uma pessoa cresceu olhando para muralhas e imaginando o mundo que existia além delas. O desejo de liberdade começou simples, mas cada descoberta mostrou que o mundo era muito mais complicado do que parecia. Amigos viraram inimigos, inimigos ganharam motivos compreensíveis e a busca por liberdade passou a exigir decisões cada vez mais pesadas."
  }
];

export class StoryService {
  constructor(memory) {
    this.memory = memory;
  }

  async saveUserStory(rawStory) {
    const sanitized = await this.anonymizeStory(rawStory);
    const id = createId("story");

    await this.memory.remember({
      key: `story.user.${id}`,
      label: "História ensinada",
      value: sanitized,
      type: "story",
      source: "conversation"
    });

    return sanitized;
  }

  async getUserStories() {
    const all = await this.memory.all();
    return all.filter((item) => item.type === "story" || item.key.startsWith("story.user."));
  }

  async randomStory({ preferUser = false } = {}) {
    const userStories = await this.getUserStories();

    if (preferUser && userStories.length) {
      const chosen = userStories[Math.floor(Math.random() * userStories.length)];
      return { title: "Uma história que você me contou", series: "Memória", text: chosen.value, userStory: true };
    }

    const pool = [
      ...BUILT_IN_STORIES,
      ...userStories.map((item) => ({
        id: item.id,
        title: "Uma história que alguém me contou",
        series: "Memória",
        text: item.value,
        userStory: true
      }))
    ];

    return pool[Math.floor(Math.random() * pool.length)] ?? BUILT_IN_STORIES[0];
  }

  getBuiltInStories() {
    return BUILT_IN_STORIES;
  }

  async anonymizeStory(rawStory) {
    let text = String(rawStory || "").trim();
    const profileName = (await this.memory.getProfileName())?.trim();

    if (profileName) {
      const escaped = profileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "uma pessoa");
    }

    // Primeiro tratamos construções em primeira pessoa para a frase continuar
    // soando natural quando JORDAN recontar a história.
    // As expressões acima são declaradas como texto para manter compatibilidade
    // ampla com navegadores antigos.
    const replacements = [
      [/\bEu fui\b/g, "Uma pessoa foi"], [/\beu fui\b/g, "uma pessoa foi"],
      [/\bEu estava\b/g, "Uma pessoa estava"], [/\beu estava\b/g, "uma pessoa estava"],
      [/\bEu tinha\b/g, "Uma pessoa tinha"], [/\beu tinha\b/g, "uma pessoa tinha"],
      [/\bEu fiz\b/g, "Uma pessoa fez"], [/\beu fiz\b/g, "uma pessoa fez"],
      [/\bEu vi\b/g, "Uma pessoa viu"], [/\beu vi\b/g, "uma pessoa viu"],
      [/\bEu encontrei\b/g, "Uma pessoa encontrou"], [/\beu encontrei\b/g, "uma pessoa encontrou"],
      [/\bEu conheci\b/g, "Uma pessoa conheceu"], [/\beu conheci\b/g, "uma pessoa conheceu"],
      [/\bEu comecei\b/g, "Uma pessoa começou"], [/\beu comecei\b/g, "uma pessoa começou"],
      [/\bEu queria\b/g, "Uma pessoa queria"], [/\beu queria\b/g, "uma pessoa queria"]
    ];

    for (const [pattern, replacement] of replacements) {
      text = text.replace(pattern, replacement);
    }

    text = text
      .replace(/\be encontrei\b/gi, "e encontrou")
      .replace(/\be vi\b/gi, "e viu")
      .replace(/\be fiz\b/gi, "e fez")
      .replace(/\be conheci\b/gi, "e conheceu")
      .replace(/\be comecei\b/gi, "e começou")
      .replace(/\be fui\b/gi, "e foi");

    text = text
      .replace(/\bmeu nome (?:é|e|eh)\s+[\p{L} '-]+/giu, "uma pessoa")
      .replace(/\beu e meu amigo\b/giu, "duas pessoas")
      .replace(/\beu e minha amiga\b/giu, "duas pessoas")
      .replace(/\bmeu amigo\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+/gu, "um amigo")
      .replace(/\bminha amiga\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+/gu, "uma amiga");

    // Depois removemos nomes próprios restantes no meio das frases. A primeira
    // palavra de cada frase é preservada para palavras comuns como "Ontem".
    text = text.replace(
      /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+){0,2})\b/gu,
      (match, _group, offset, whole) => {
        const before = whole.slice(0, offset).trimEnd();
        if (!before || /[.!?]$/.test(before)) return match;
        return "uma pessoa";
      }
    );

    text = text
      .replace(/\bcomigo\b/giu, "com essa pessoa")
      .replace(/\bmeus\b/giu, "os")
      .replace(/\bminhas\b/giu, "as")
      .replace(/\bmeu\b/giu, "o")
      .replace(/\bminha\b/giu, "a")
      .replace(/\bmim\b/giu, "essa pessoa")
      .replace(/\bme\b/giu, "essa pessoa")
      .replace(/\beu\b/giu, "uma pessoa")
      .replace(/\s+/g, " ")
      .trim();

    if (!/[.!?]$/.test(text)) text += ".";
    return text;
  }

}

export function looksLikeStoryRequest(text = "") {
  const normalized = normalizeText(text);
  return /\b(conte|conta|contar)\b.*\b(historia|historinha)\b/.test(normalized);
}

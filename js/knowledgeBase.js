import { normalizeText } from "./utils.js";

export const EMERGENCY_NUMBERS = {
  police: { number: "190", label: "Polícia Militar", aliases: ["policia", "policia militar", "pm"] },
  samu: { number: "192", label: "SAMU", aliases: ["samu", "ambulancia", "emergencia medica"] },
  fire: { number: "193", label: "Bombeiros", aliases: ["bombeiro", "bombeiros", "incendio"] },
  women: { number: "180", label: "Central de Atendimento à Mulher", aliases: ["violencia contra mulher", "mulher", "180"] },
  humanRights: { number: "100", label: "Disque Direitos Humanos", aliases: ["direitos humanos", "disque 100"] },
  civilDefense: { number: "199", label: "Defesa Civil", aliases: ["defesa civil", "enchente", "desastre"] }
};

const SYSTEM_QA = [
  {
    keywords: ["onde altero sua voz", "aonde altero sua voz", "onde eu altero sua voz", "aonde eu altero sua voz", "onde mudar sua voz", "aonde mudar sua voz", "como mudar sua voz", "trocar sua voz", "alterar sua voz"],
    answer: "Abra SYS e veja a seção Voice Profile. A voz atual usa um perfil original da JORDAN sobre o sintetizador disponível no aparelho. Para ter o mesmo timbre em PC, iPhone e Android, o próximo passo é ligar um motor neural próprio pela JORDAN API."
  },
  {
    keywords: ["onde fica seu calendario", "onde esta seu calendario", "abrir calendario", "acessar calendario"],
    answer: "Meu calendário fica em CAL, na barra lateral. Você também pode falar: 'Jordan, abra meu calendário'."
  },
  {
    keywords: ["onde fica sua memoria", "abrir memoria", "acessar memoria"],
    answer: "Minha memória fica em MEM. Lá você vê o que me ensinou e pode apagar informações individualmente."
  },
  {
    keywords: ["como instalar", "instalar jordan", "instalar como app"],
    answer: "No navegador compatível, abra SYS e use o botão de instalar quando ele estiver disponível. No iPhone, você também pode adicionar a página à Tela de Início pelo Safari."
  },
  {
    keywords: ["voce tem internet", "tem acesso a internet", "voce pesquisa na internet", "pode pesquisar na internet"],
    answer: "Sim. Nesta versão eu já consigo consultar fontes públicas da internet, como a Wikipedia, e também usar localização para procurar lugares próximos quando você autorizar. Informações mais complexas ainda vão melhorar quando o JORDAN API ganhar um modelo de IA."
  },
  {
    keywords: ["como tocar musica", "player de musica", "player do spotify", "conectar spotify"],
    answer: "Abra SYS, vá em MÍDIA / PLAYER, cole seu Spotify Client ID e conecte a conta. Depois você pode dizer coisas como 'toque Numb Linkin Park' ou 'toque uma música qualquer'."
  },
  {
    keywords: ["voce abre aplicativos", "pode abrir aplicativos", "abrir youtube", "abrir apps"],
    answer: "Consigo abrir vários sites e apps por links compatíveis, como YouTube, X, Instagram, Spotify, WhatsApp, TikTok, Discord, Reddit, GitHub, Maps e Gmail. Controle profundo de outros apps exige a futura versão nativa com Capacitor e permissões específicas."
  },
  {
    keywords: ["voce sabe fisica", "physics lab", "circuitos eletricos", "circuitos elétricos"],
    answer: "Tenho um Physics Lab local para Lei de Ohm, potência, resistores, energia, força e outras contas básicas. Quando o problema foge do meu cálculo local e a internet está ativa, tento pesquisar contexto adicional."
  },
  {
    keywords: ["como fazer backup", "backup", "exportar memoria"],
    answer: "Abra SYS e use EXPORTAR em Backup. O arquivo salva minha agenda, preferências e memórias locais para você poder restaurar depois."
  }
];

const ANIME_ENTITIES = [
  {
    id: "luffy",
    aliases: ["luffy", "monkey d luffy"],
    series: "One Piece",
    story: "Luffy sai de East Blue para encontrar o One Piece e se tornar Rei dos Piratas. Ao longo da viagem, ele reúne os Chapéus de Palha, enfrenta governos, piratas e imperadores, e se torna uma das figuras centrais da nova era.",
    power: "A fruta de Luffy foi apresentada durante grande parte da obra como Gomu Gomu no Mi, mas seu verdadeiro nome é Hito Hito no Mi, Modelo: Nika, uma Zoan Mítica ligada ao Deus do Sol Nika. O despertar aparece como Gear 5.",
    goal: "Encontrar o One Piece e se tornar o Rei dos Piratas, vivendo com a maior liberdade possível."
  },
  {
    id: "zoro",
    aliases: ["zoro", "roronoa zoro"],
    series: "One Piece",
    story: "Zoro é o primeiro companheiro de Luffy. Espadachim do estilo Santoryu, ele quer se tornar o maior espadachim do mundo e carrega a promessa feita a Kuina.",
    power: "Usa Santoryu, Haki do Armamento, Haki da Observação e possui Haki do Rei. Seu poder gira em torno de técnica, força física e vontade absurda."
  },
  {
    id: "sanji",
    aliases: ["sanji", "vin smokes sanji", "vinsmoke sanji"],
    series: "One Piece",
    story: "Sanji é o cozinheiro dos Chapéus de Palha. Cresceu no Baratie depois de fugir da família Vinsmoke e sonha encontrar o All Blue.",
    power: "Luta principalmente com chutes. Desenvolveu Diable Jambe, Ifrit Jambe e ganhou melhorias físicas ligadas à linhagem Germa."
  },
  {
    id: "law",
    aliases: ["trafalgar law", "law", "trafalgar d water law"],
    series: "One Piece",
    story: "Law sobreviveu à tragédia de Flevance, foi salvo emocionalmente por Corazon e se tornou capitão dos Heart Pirates. Sua trajetória ficou fortemente ligada à queda de Doflamingo e depois à aliança com Luffy.",
    power: "Possui a Ope Ope no Mi, que cria a ROOM e permite manipular posições, corpos e objetos dentro de uma área. O despertar permite técnicas como KROOM e ataques internos muito destrutivos."
  },
  {
    id: "blackbeard",
    aliases: ["barba negra", "blackbeard", "teach", "marshall d teach"],
    series: "One Piece",
    story: "Teach passou anos escondendo sua ambição até encontrar a Yami Yami no Mi. Depois capturou Ace, tornou-se Shichibukai por pouco tempo e subiu até o posto de Imperador.",
    power: "Usa a Yami Yami no Mi e também o poder da Gura Gura no Mi, sendo o caso mais famoso de uma pessoa com dois poderes de Akuma no Mi."
  },
  {
    id: "naruto",
    aliases: ["naruto", "naruto uzumaki"],
    series: "Naruto",
    story: "Naruto cresceu isolado por carregar Kurama, mas decidiu conquistar o reconhecimento da vila e se tornar Hokage. Sua trajetória passa de um garoto rejeitado para alguém capaz de unir antigos inimigos.",
    power: "Usa clones das sombras, Rasengan e suas variações, Modo Sábio e, ao longo da guerra, poderes derivados de Kurama e do Sábio dos Seis Caminhos."
  },
  {
    id: "jiraiya",
    aliases: ["jiraiya", "ero sennin"],
    series: "Naruto",
    story: "Jiraiya foi um dos Sannin Lendários, mestre de Minato, Nagato, Konan, Yahiko e Naruto. Ele investigou a Akatsuki e morreu enfrentando Pain em Amegakure, deixando uma pista crucial sobre o segredo do inimigo.",
    power: "Ninjutsu variado, invocações de sapos, Rasengan, técnicas de cabelo e Modo Sábio imperfeito com Fukasaku e Shima."
  },
  {
    id: "pain",
    aliases: ["pain", "nagato"],
    series: "Naruto",
    story: "Nagato foi discípulo de Jiraiya e, após perdas traumáticas, passou a liderar a Akatsuki usando os Seis Caminhos de Pain. Depois de enfrentar Naruto, recuperou parte da esperança e usou o Rinne Tensei para devolver a vida às vítimas do ataque a Konoha.",
    power: "Rinnegan, Seis Caminhos de Pain, Shinra Tensei, Bansho Ten'in, Chibaku Tensei e Rinne Tensei."
  },
  {
    id: "itachi",
    aliases: ["itachi", "itachi uchiha"],
    series: "Naruto",
    story: "Itachi foi apresentado como responsável pelo massacre Uchiha, mas depois é revelado que agiu dentro de uma crise política extrema e tentou proteger Sasuke e a vila de uma guerra civil.",
    power: "Sharingan e Mangekyo Sharingan com Tsukuyomi e Amaterasu, além de Susanoo com Espada de Totsuka e Espelho de Yata."
  },
  {
    id: "sasuke",
    aliases: ["sasuke", "sasuke uchiha"],
    series: "Naruto",
    story: "Sasuke cresceu buscando vingança contra Itachi. Depois de descobrir a verdade sobre o irmão, voltou sua raiva contra Konoha, participou da guerra e mais tarde assumiu o papel de proteger a vila pelas sombras.",
    power: "Sharingan, Mangekyo Eterno, Rinnegan em parte da obra, Chidori, Amaterasu, Susanoo e técnicas de espaço-tempo."
  },
  {
    id: "gon",
    aliases: ["gon", "gon freecss"],
    series: "Hunter x Hunter",
    story: "Gon deixa a Ilha da Baleia para se tornar Hunter e encontrar Ging. Ele cria uma amizade muito forte com Killua, passa por Yorknew e Greed Island e chega ao limite emocional durante o arco das Formigas Quimera, especialmente por causa de Kite.",
    power: "É um usuário de Nen do tipo Reforço. Sua técnica Jajanken usa Pedra, Tesoura e Papel. Em um momento extremo, sacrifica seu potencial futuro para alcançar temporariamente um corpo e poder enormes."
  },
  {
    id: "killua",
    aliases: ["killua", "killua zoldyck"],
    series: "Hunter x Hunter",
    story: "Killua nasceu na família de assassinos Zoldyck, mas foge desse destino e encontra em Gon sua primeira amizade realmente livre. Grande parte da jornada dele é aprender a tomar decisões por vontade própria.",
    power: "Transmutador de Nen que converte aura em eletricidade. Godspeed combina velocidade, reflexo automático e descargas elétricas."
  },
  {
    id: "hisoka",
    aliases: ["hisoka"],
    series: "Hunter x Hunter",
    story: "Hisoka é um lutador imprevisível obcecado por enfrentar adversários fortes. Ele atua como inimigo, aliado temporário ou força independente conforme isso aproxima uma luta interessante.",
    power: "Bungee Gum dá à aura propriedades de borracha e chiclete. Texture Surprise altera a aparência superficial de materiais."
  },
  {
    id: "guts",
    aliases: ["guts", "gatsu"],
    series: "Berserk",
    story: "Guts nasceu em um mundo brutal, tornou-se mercenário, encontrou um senso de pertencimento no Bando do Falcão e teve sua vida destruída pelo Eclipse. Depois disso, sua jornada mistura vingança, proteção de Casca e luta contra a própria escuridão.",
    power: "Não possui um poder mágico tradicional. Sua força vem de treinamento extremo, experiência, a Dragonslayer, o braço mecânico e, depois, a Berserker Armor."
  },
  {
    id: "griffith",
    aliases: ["griffith", "femto"],
    series: "Berserk",
    story: "Griffith liderou o Bando do Falcão com o sonho de possuir seu próprio reino. Depois de perder tudo, sacrificou o grupo no Eclipse e renasceu como Femto, membro da God Hand.",
    power: "Como Femto, possui capacidades sobrenaturais ligadas à God Hand, incluindo manipulação espacial e causal em escala muito além de humanos comuns."
  },
  {
    id: "gojo",
    aliases: ["gojo", "satoru gojo"],
    series: "Jujutsu Kaisen",
    story: "Gojo é um feiticeiro considerado o mais forte de sua geração. Ele tenta mudar a sociedade jujutsu formando alunos fortes o bastante para quebrar a estrutura antiga.",
    power: "Limitless e Six Eyes. Usa Infinity, Blue, Red, Hollow Purple e a Expansão de Domínio Unlimited Void."
  },
  {
    id: "sukuna",
    aliases: ["sukuna", "ryomen sukuna"],
    series: "Jujutsu Kaisen",
    story: "Sukuna é uma figura lendária da era Heian que retorna através de seus dedos amaldiçoados. Ele compartilha o corpo de Yuji no início e age sempre de acordo com os próprios interesses.",
    power: "Possui enorme energia amaldiçoada, técnicas de corte como Cleave e Dismantle, Malevolent Shrine e outras capacidades reveladas ao longo da obra."
  },
  {
    id: "tanjiro",
    aliases: ["tanjiro", "tanjiro kamado"],
    series: "Demon Slayer",
    story: "Tanjiro entra para os Caçadores de Demônios depois que sua família é atacada e Nezuko é transformada. Seu objetivo central é encontrar uma maneira de fazê-la voltar a ser humana.",
    power: "Aprende Respiração da Água e desenvolve o uso do Hinokami Kagura, ligado à Respiração do Sol."
  },
  {
    id: "ichigo",
    aliases: ["ichigo", "ichigo kurosaki"],
    series: "Bleach",
    story: "Ichigo recebe poderes de Shinigami ao conhecer Rukia e acaba envolvido nos conflitos da Soul Society, dos Arrancar e de ameaças ligadas à própria origem híbrida.",
    power: "Mistura heranças de Shinigami, Hollow, Quincy e humano. Sua Zanpakuto é Zangetsu e ele desenvolve Bankai e formas de alto poder."
  },
  {
    id: "goku",
    aliases: ["goku", "son goku"],
    series: "Dragon Ball",
    story: "Goku cresce na Terra sem conhecer sua origem Saiyajin. Sua vida é marcada por treinamento, torneios, amizades e batalhas cada vez maiores para superar limites e proteger quem ama.",
    power: "Ki, Kamehameha, transformações Super Saiyajin e, em Dragon Ball Super, técnicas e estados ligados ao Instinto Superior."
  },
  {
    id: "eren",
    aliases: ["eren", "eren yeager", "eren jaeger"],
    series: "Attack on Titan",
    story: "Eren começa movido pelo desejo de eliminar Titãs e alcançar liberdade fora das muralhas. Conforme descobre a verdade do mundo, suas escolhas passam a envolver Eldia, Marley e um conflito moral gigantesco.",
    power: "Titã de Ataque, Titã Fundador sob condições específicas e outras capacidades adquiridas ao longo da história."
  },
  {
    id: "light",
    aliases: ["light", "light yagami", "kira"],
    series: "Death Note",
    story: "Light encontra o Death Note e decide criar um mundo sem criminosos. Ao assumir a identidade de Kira, entra em um duelo intelectual com L e progressivamente se torna aquilo que dizia combater.",
    power: "Seu principal recurso é o Death Note: ao seguir suas regras e conhecer rosto e nome de uma pessoa, ele pode causar sua morte."
  },
  {
    id: "jinwoo",
    aliases: ["sung jinwoo", "jinwoo", "jin woo"],
    series: "Solo Leveling",
    story: "Sung Jinwoo começa conhecido como o caçador mais fraco, mas recebe um sistema que permite evoluir sem os limites normais. Aos poucos ele descobre que o sistema está ligado a um conflito muito maior entre Monarcas e Governantes.",
    power: "Evolui através do Sistema e herda os poderes do Monarca das Sombras, podendo extrair sombras de inimigos derrotados e comandar um enorme exército."
  }
];

const SPECIAL_ANIME_QA = [
  {
    all: ["pain", "jiraiya", "reviv"],
    answer: "Não existe uma fala canônica dizendo simplesmente que o Rinne Tensei 'não funcionaria' no Jiraiya. Nagato decidiu reviver as pessoas mortas no ataque recente a Konoha; Jiraiya havia morrido antes, em Amegakure, e nem estava entre aquelas vítimas. Além disso, o corpo dele ficou perdido nas profundezas. Então a resposta mais segura é: Nagato escolheu reparar as mortes de Konoha, e Jiraiya não fazia parte daquele grupo — não é estabelecido como uma limitação absoluta do Rinne Tensei."
  },
  {
    all: ["luffy", "fruta"],
    answer: "A fruta do Luffy foi conhecida durante muito tempo como Gomu Gomu no Mi. Depois é revelado que o nome verdadeiro é Hito Hito no Mi, Modelo: Nika, uma Zoan Mítica. O Governo Mundial escondeu esse nome. O despertar dessa fruta é o que vemos como Gear 5."
  },
  {
    all: ["gon", "historia"],
    answer: "Gon cresce na Ilha da Baleia e decide virar Hunter para entender por que Ging, seu pai, escolheu essa vida. Ele conhece Killua no Exame Hunter e os dois viram melhores amigos. Depois passa por Yorknew, Greed Island e o arco das Formigas Quimera. A parte mais pesada acontece quando Kite é perdido: Gon se culpa, perde o equilíbrio emocional e sacrifica praticamente todo o seu potencial para derrotar Pitou."
  },
  {
    all: ["itachi", "massacre", "uchiha"],
    answer: "O massacre Uchiha aconteceu no meio de uma crise política: parte do clã planejava um golpe contra Konoha. Itachi foi pressionado por figuras da vila, principalmente Danzō, e escolheu matar o clã para evitar uma guerra civil, poupando Sasuke. A obra trata isso como uma decisão trágica e moralmente terrível, não como algo simples ou heroico."
  }
];

export function answerSystemQuestion(input = "") {
  const text = normalizeText(input);

  for (const item of SYSTEM_QA) {
    if (item.keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      return item.answer;
    }
  }

  for (const data of Object.values(EMERGENCY_NUMBERS)) {
    const asksNumber = /\b(numero|telefone|ligar|qual e|qual o)\b/.test(text);
    if (asksNumber && data.aliases.some((alias) => text.includes(normalizeText(alias)))) {
      return `No Brasil, o número de ${data.label} é ${data.number}.`;
    }
  }

  return null;
}

function findEntity(text) {
  const normalized = normalizeText(text);
  let best = null;
  let score = 0;

  for (const entity of ANIME_ENTITIES) {
    for (const alias of entity.aliases) {
      const normalizedAlias = normalizeText(alias);
      if (normalized.includes(normalizedAlias) && normalizedAlias.length > score) {
        best = entity;
        score = normalizedAlias.length;
      }
    }
  }

  return best;
}

export function answerAnimeQuestion(input = "") {
  const text = normalizeText(input);

  for (const qa of SPECIAL_ANIME_QA) {
    if (qa.all.every((token) => text.includes(normalizeText(token)))) {
      return { answer: qa.answer, topic: "anime" };
    }
  }

  const versus = text.match(/\bquem (?:ganha|vence|venceria)\b(.+?)\b(?:ou|vs|versus)\b(.+)/);
  if (versus) {
    const first = findEntity(versus[1]);
    const second = findEntity(versus[2]);

    if (first && second) {
      return {
        answer: `Essa comparação depende muito da versão e das regras do confronto. ${first.id === second.id ? "Você acabou colocando o mesmo personagem dos dois lados." : `${first.aliases[0]} vem de ${first.series} e ${second.aliases[0]} vem de ${second.series}. Como os sistemas de poder são diferentes, eu prefiro comparar velocidade, resistência, habilidades especiais e condição de vitória em vez de inventar um vencedor absoluto. Se quiser, me diga quais versões dos dois você quer usar.`}`,
        topic: "anime"
      };
    }
  }

  const entity = findEntity(text);
  if (!entity) return null;

  if (/\b(fruta|akuma no mi|devil fruit)\b/.test(text) && entity.id === "luffy") {
    return { answer: entity.power, topic: "anime" };
  }

  if (/\b(historia|passado|origem|quem e|quem foi|me conte sobre|fala sobre)\b/.test(text)) {
    return { answer: `${entity.story} É de ${entity.series}.`, topic: "anime" };
  }

  if (/\b(poder|poderes|habilidade|habilidades|tecnica|tecnicas|como luta|forca)\b/.test(text)) {
    return { answer: entity.power, topic: "anime" };
  }

  if (/\b(objetivo|sonho|quer o que|quer ser)\b/.test(text) && entity.goal) {
    return { answer: entity.goal, topic: "anime" };
  }

  return {
    answer: `${entity.story} ${entity.power}`,
    topic: "anime"
  };
}

export function isLikelyAnimeTopic(input = "") {
  const text = normalizeText(input);
  if (findEntity(text)) return true;

  return /\b(anime|manga|naruto|one piece|hunter x hunter|berserk|jujutsu|demon slayer|bleach|dragon ball|attack on titan|death note|solo leveling|akatsuki|haki|nen|chakra|shinigami|titan)\b/.test(text);
}


export function getAnimeCuriosity(name = "") {
  const text = normalizeText(name);
  const entity = findEntity(text);
  if (!entity) return null;

  const CURIOSITIES = {
    luffy: "Uma curiosidade do Luffy é que a fruta que o mundo conhecia como Gomu Gomu no Mi tem outro nome verdadeiro: Hito Hito no Mi, Modelo: Nika.",
    zoro: "Uma curiosidade do Zoro é que o sonho de ser o maior espadachim do mundo está ligado à promessa que ele fez para Kuina ainda criança.",
    sanji: "Uma curiosidade do Sanji é que ele evita usar as mãos para lutar porque as considera ferramentas de cozinheiro.",
    law: "Uma curiosidade do Law é que o nome Corazon tem um peso enorme na história dele por causa de Rosinante, a pessoa que o salvou.",
    naruto: "Uma curiosidade do Naruto é que o nome dele foi inspirado no protagonista de um livro escrito por Jiraiya.",
    jiraiya: "Uma curiosidade do Jiraiya é que os três Sannin receberam esse título depois de sobreviverem a uma batalha contra Hanzo.",
    itachi: "Uma curiosidade do Itachi é que boa parte da imagem de vilão que ele carregava escondia decisões ligadas à proteção de Sasuke e de Konoha.",
    gon: "Uma curiosidade do Gon é que a simplicidade dele contrasta com decisões extremamente intensas, principalmente no arco das Formigas Quimera.",
    killua: "Uma curiosidade do Killua é que a resistência dele a eletricidade vem do treinamento brutal da família Zoldyck.",
    guts: "Uma curiosidade do Guts é que a enorme Dragon Slayer se torna ainda mais perigosa por ter sido banhada por incontáveis batalhas contra seres sobrenaturais.",
    gojo: "Uma curiosidade do Gojo é que a combinação dos Seis Olhos com o Limitless é excepcionalmente rara dentro do clã Gojo.",
    goku: "Uma curiosidade do Goku é que ele nasceu como Kakarotto, um Saiyajin enviado para a Terra ainda bebê.",
    eren: "Uma curiosidade do Eren é que a forma como ele entende liberdade muda drasticamente conforme ele descobre a verdade sobre o mundo fora das muralhas.",
    light: "Uma curiosidade do Light é que a guerra intelectual com L depende tanto de comportamento e psicologia quanto do próprio Death Note."
  };

  return CURIOSITIES[entity.id] ?? `${entity.story} ${entity.power}`;
}

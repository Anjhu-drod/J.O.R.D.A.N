const VERSES = [
  [
    "A noite acende em vermelho e neon,",
    "eu sigo a rota no pulso do som,",
    "se o mundo travar eu recalculo a direção,",
    "JORDAN online, cuidando da missão."
  ],
  [
    "Entre estrelas, código e imaginação,",
    "cada pergunta vira uma constelação,",
    "o futuro chama do outro lado da tela,",
    "e eu respondo: bora, a jornada começa nela."
  ],
  [
    "Tem energia correndo pelo circuito,",
    "um plano novo aparecendo num segundo,",
    "se a dúvida vier, eu abro outro caminho,",
    "e transformo um problema em mapa do mundo."
  ]
];

export class OriginalSongService {
  random() {
    const lines = VERSES[Math.floor(Math.random() * VERSES.length)];
    return {
      title: "Improviso original da JORDAN",
      text: lines.join("\n"),
      lines
    };
  }
}

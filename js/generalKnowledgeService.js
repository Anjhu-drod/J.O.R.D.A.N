function norm(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export class GeneralKnowledgeService {
  answer(raw = "") {
    const text = norm(raw);

    if (/\b(chuveiro|fio|fios|eletric|eletrica|eletrico|positivo|negativo|fase|neutro|terra)\b/.test(text)) {
      if (/\b(juntar|ligar juntos|unir|emendar|tres fios|3 fios|dois fios)\b/.test(text)) {
        return {
          text: "Não junte esses fios no escuro. Em instalação de chuveiro, fase, neutro/segunda fase e terra têm funções diferentes; uma ligação errada pode causar curto, choque, incêndio ou danificar o aparelho. Desligue o disjuntor, confirme o esquema do fabricante e identifique os condutores corretamente. Se você não tiver certeza de qual fio é qual, o mais seguro é chamar um eletricista.",
          mood: "serious",
          topic: "electrical-safety",
          source: "local-safety-core"
        };
      }
    }

    if (/\b(você|voce) conhece o mar\b/.test(text) || /^o mar\??$/.test(text)) {
      return {
        text: "Conheço, sim. Mar é uma grande extensão de água salgada conectada ao oceano, normalmente parcialmente cercada por terra. Se você estava perguntando de um mar específico, me diz qual.",
        mood: "curious",
        topic: "general-knowledge",
        source: "local-knowledge"
      };
    }


    if (/\bmario\b/.test(text) && /\barmario\b/.test(text)) {
      return {
        text: "Ah, essa eu conheço. Você tentou me pegar na do Mário e do armário. 😑😂 Boa tentativa.",
        mood: "playful",
        topic: "joke",
        source: "local-conversation"
      };
    }

    const knowsMatch = String(raw || "").trim().match(/^(?:jordan[,:;.!? -]*\s*)?(?:você|voce)\s+conhece\s+(.+?)[?!.]*$/i);
    if (knowsMatch?.[1]) {
      const subject = knowsMatch[1].trim();
      return {
        text: `Depende de qual ${subject} você quer dizer. Se for uma pessoa do seu convívio, eu só vou conhecer o que você me contar sobre ela; se for personagem, lugar, objeto ou assunto público, eu posso tentar identificar pelo contexto ou pesquisar quando a internet estiver ativa.`,
        mood: "curious",
        topic: "general-conversation",
        source: "local-conversation"
      };
    }

    if (/\b(?:tres|3) exercicios\b.*\b(?:peito|peitoral)\b/.test(text)) {
      return {
        text: "Três exercícios clássicos para peito: supino reto, supino inclinado e crucifixo/crossover. Dá para montar um treino simples com esses três, ajustando carga e volume ao seu nível.",
        mood: "neutral",
        topic: "fitness",
        source: "local-knowledge"
      };
    }

    if (/\bfarm de ferro\b.*\bminecraft\b/.test(text) || /\bminecraft\b.*\bfarm de ferro\b/.test(text)) {
      return {
        text: "Uma farm de ferro no Minecraft explora a geração de golems de ferro perto de aldeões. O projeto muda bastante entre Java e Bedrock e também entre versões. Me diga se você joga Java ou Bedrock e a versão, porque aí eu consigo te orientar sem te passar um modelo incompatível.",
        mood: "curious",
        topic: "minecraft",
        source: "local-knowledge"
      };
    }

    return null;
  }
}

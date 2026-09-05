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
      const edition = /\bjava\b/.test(text) ? "Java" : /\bbedrock\b/.test(text) ? "Bedrock" : null;
      const version = text.match(/\b(\d+\.\d+(?:\.\d+)?)\b/)?.[1] || null;

      if (edition && version) {
        return {
          text: edition === "Java"
            ? `Beleza: Minecraft Java ${version}. A lógica mais comum de farm de ferro usa aldeões em uma vila artificial, uma condição que provoque a geração dos golems, uma plataforma válida de spawn e um sistema para empurrar os golems até a coleta com funis. Como detalhes de camas, distância, visão do zumbi e área de spawn mudam entre versões, eu já manteria Java ${version} preso no contexto e, se você disser “passo a passo”, eu continuo desse ponto em vez de perguntar tudo de novo.`
            : `Beleza: Minecraft Bedrock ${version}. Em Bedrock a lógica de vila e geração de golems é diferente da Java, então eu não vou misturar os dois projetos. A base é montar uma vila artificial válida, controlar onde os golems podem nascer e canalizá-los para a coleta. Se você disser “passo a passo”, eu continuo considerando Bedrock ${version}.`,
          mood: "confident",
          topic: "minecraft",
          source: "local-knowledge"
        };
      }

      if (edition && !version) {
        return {
          text: `Beleza, você joga Minecraft ${edition}. Falta só a versão exata, por exemplo 1.21 ou 1.21.4, porque isso evita eu te passar um layout incompatível.`,
          mood: "curious",
          topic: "minecraft",
          source: "local-knowledge",
          pendingClarification: { type: "minecraft-iron-farm", edition, version: null }
        };
      }

      return {
        text: "Uma farm de ferro no Minecraft explora a geração de golems de ferro perto de aldeões. O projeto muda bastante entre Java e Bedrock e também entre versões. Me diga se você joga Java ou Bedrock e a versão; eu vou manter essas respostas no contexto para não te fazer repetir tudo.",
        mood: "curious",
        topic: "minecraft",
        source: "local-knowledge",
        pendingClarification: { type: "minecraft-iron-farm", edition: null, version: null }
      };
    }

    return null;
  }
}

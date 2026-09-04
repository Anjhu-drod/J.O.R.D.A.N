import { normalizeText } from "./utils.js";

export class SemanticBrainService {
  constructor({memory,lineage,offlineKnowledge,languageLearning}={}){ this.memory=memory; this.lineage=lineage; this.offlineKnowledge=offlineKnowledge; this.languageLearning=languageLearning; }
  async answer(raw="",{allowPrivate=true}={}){
    const original=String(raw||"").trim(); const t=normalizeText(original).replace(/^jordan\s*/,"");
    if(!t) return null;

    const meaning=t.match(/^(?:o que|oque)\s+(?:significa|quer dizer)\s+(.+?)[?!.]*$/);
    if(meaning){ const learned=this.languageLearning?.lookup(meaning[1]); if(learned) return {text:`Do jeito que você me ensinou, “${learned.term}” significa ${learned.meaning}.`,kind:"learned"}; }

    if(allowPrivate && /\b(?:qual|como)\b.*\bmeu nome\b|\bcomo eu me chamo\b/.test(t)){
      const m=await this.memory.get("profile.name"); if(m?.value) return {text:`Você se chama ${m.value}.`,kind:"personal"};
    }
    if(allowPrivate && /\b(?:qual|como)\b.*\bmeu (?:numero|número|telefone)\b/.test(t)){
      const m=await this.memory.get("profile.phone"); if(m?.value) return {text:`Seu telefone salvo é ${m.value}.`,kind:"personal"};
    }
    if(allowPrivate && /\b(?:onde|aonde)\b.*\b(?:moro|minha casa)\b/.test(t)){
      const m=await this.memory.get("profile.home"); if(m?.value) return {text:`Você me ensinou que mora em ${m.value}.`,kind:"personal"};
    }

    if(/\b(?:cumprimente|cumprimenta|manda um oi|diga oi|de um oi|dê um oi)\b/.test(t)){
      const userName=allowPrivate?(await this.memory.get("profile.name"))?.value:null;
      if(/\b(?:meu|minha) amigo\b/.test(t)) return {text:userName?`Oi! Prazer, sou a JORDAN. Amigo do ${userName}, fica à vontade por aqui.`:"Oi! Prazer, sou a JORDAN. Fica à vontade por aqui.",kind:"conversation"};
      const m=original.match(/(?:cumprimente|cumprimenta|manda um oi para|diga oi para|dê um oi para)\s+(.+)/i);
      if(m) return {text:`Oi, ${m[1].replace(/[.!?]+$/g,"").trim()}! Prazer, sou a JORDAN.`,kind:"conversation"};
    }

    if(/\b(?:me pergunte|faz uma pergunta|pergunta alguma coisa)\b/.test(t)){
      const qs=["Qual coisa você mais quer aprender agora?","Se pudesse melhorar uma habilidade sua hoje, qual seria?","Que assunto você consegue conversar por horas sem cansar?","Qual foi a coisa mais interessante que aconteceu com você esses dias?"];
      return {text:qs[Math.floor(Math.random()*qs.length)],kind:"conversation"};
    }
    if(/\bvoce tem\b|\bvocê tem\b/.test(t)) return {text:"Tenho calendário, memória sincronizada, conhecimento offline, pesquisa online, música local, física, localização e algumas ações de sistema. E eu continuo aprendendo palavras e preferências que você me ensina.",kind:"capabilities"};

    const knowledge=this.offlineKnowledge?.answer(original); if(knowledge) return {...knowledge};
    return null;
  }
}

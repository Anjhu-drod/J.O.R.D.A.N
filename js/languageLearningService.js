import { normalizeText } from "./utils.js";

const COMMON = new Set((`a o os as um uma uns umas eu voce você ele ela nos nós voces vocês eles elas meu minha meus minhas seu sua seus suas
isso isto aquilo aqui ai aí la lá hoje ontem amanha amanhã agora depois antes sim nao não talvez porque por que como qual quais quanto quantos onde aonde
quem quando que de do da dos das em no na nos nas para pra pro por com sem e ou mas se so só muito mais menos bem mal bom boa oi ola olá opa mano manos
vei véi velho cara tipo ne né ue ué tlgd ta tá to tô tava vai vou quero queria saber diga fale fala dizer diz me mim comigo gente coisa alguma algum amigo amiga
jordan calendario calendário agenda memoria memória internet musica música tocar toque abrir fecha fechar ajuda socorro bom dia noite tarde silencio silêncio
matematica matemática portugues português fisica física quimica química biologia historia história geografia filosofia sociologia ingles inglês espanhol literatura
redacao redação artes tecnologia educacao educação logaritmo mitose energia força velocidade corrente tensao tensão resistor resistencia resistência`).split(/\s+/).filter(Boolean));

function slug(value="") { return normalizeText(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "termo"; }

export class LanguageLearningService {
  constructor(memory){ this.memory=memory; this.words=new Map(); this.rules=[]; }

  async initialize(){
    const all = await this.memory.all().catch(()=>[]);
    for(const item of all){
      if(item.key?.startsWith("language.word.")) {
        const term=item.meta?.term || item.label?.replace(/^Palavra aprendida:\s*/i,"") || item.key.split(".").pop();
        this.words.set(normalizeText(term), {term, meaning:item.value});
      }
      if(item.key?.startsWith("language.rule.")) {
        try { const data=JSON.parse(item.value); if(data?.trigger&&data?.action) this.rules.push(data); } catch{}
      }
    }
  }

  parseTeaching(raw=""){
    const text=String(raw||"").trim().replace(/^jordan[\s,:-]*/i,"");
    const normalized=normalizeText(text);
    if(/^(?:o que|oque|qual|como|voce sabe|você sabe)\b/.test(normalized) || /\?$/.test(text)) return null;
    let m=text.match(/^["“]?([^"”]{2,40}?)["”]?\s+(?:significa|quer dizer|e o mesmo que|é o mesmo que)\s+(.+)$/i);
    if(m) return {kind:"word",term:m[1].trim(),meaning:m[2].trim()};
    m=text.match(/^(?:quando eu (?:falar|disser)|toda vez que eu (?:falar|disser))\s+["“]?(.+?)["”]?\s*(?:,|\s+voce\s+|\s+você\s+)(?:deve\s+|tem que\s+)?(.+)$/i);
    if(m) return {kind:"rule",trigger:m[1].trim(),action:m[2].trim()};
    m=text.match(/^(?:quando eu (?:falar|disser)|toda vez que eu (?:falar|disser))\s+["“]?(.+?)["”]?\s*,\s*(.+)$/i);
    if(m) return {kind:"rule",trigger:m[1].trim(),action:m[2].trim()};
    return null;
  }

  async learnFromTeaching(raw=""){
    const parsed=this.parseTeaching(raw); if(!parsed) return null;
    if(parsed.kind==="word") { await this.teachWord(parsed.term,parsed.meaning); return {kind:"word",...parsed}; }
    const rule={trigger:parsed.trigger,action:parsed.action,triggerNormalized:normalizeText(parsed.trigger)};
    await this.memory.remember({ key:`language.rule.${slug(parsed.trigger)}`, label:`Regra aprendida: ${parsed.trigger}`, value:JSON.stringify(rule), type:"preference", source:"conversation" });
    this.rules=this.rules.filter(r=>r.triggerNormalized!==rule.triggerNormalized); this.rules.push(rule);
    return {kind:"rule",...parsed};
  }

  async teachWord(term,meaning){
    const clean=String(term||"").trim(); const def=String(meaning||"").trim(); if(!clean||!def) return null;
    await this.memory.remember({ key:`language.word.${slug(clean)}`, label:`Palavra aprendida: ${clean}`, value:def, type:"fact", source:"conversation", meta:{term:clean,meaning:def} });
    this.words.set(normalizeText(clean),{term:clean,meaning:def}); return {term:clean,meaning:def};
  }
  lookup(term=""){ return this.words.get(normalizeText(term)) || null; }
  resolveRule(raw=""){ const t=normalizeText(raw); return this.rules.find(r=>t===r.triggerNormalized || t.includes(r.triggerNormalized)) || null; }

  findUnknownCandidate(raw="",{source="voice",confidence=0}={}){
    if(source==="voice" && Number(confidence||0)<0.88) return null;
    const rawWords=String(raw||"").match(/[A-Za-zÀ-ÿ]{5,}/g)||[];
    const normalized=rawWords.map(w=>({raw:w,n:normalizeText(w)}));
    for(const w of normalized){
      if(COMMON.has(w.n)||this.words.has(w.n)) continue;
      if(/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(w.raw)) continue;
      if(/(?:tion|mente|acao|ação|ismo|ista|ando|endo|indo|dade|vel)$/i.test(w.raw)) continue;
      return w.raw;
    }
    return null;
  }
}

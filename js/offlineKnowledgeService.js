import { normalizeText } from "./utils.js";

const SUBJECTS = {
  "Matemática": [
    ["logaritmo","Logaritmo é o expoente ao qual uma base deve ser elevada para produzir um número. Por exemplo, log₂ 8 = 3 porque 2³ = 8."],
    ["funcao","Função é uma relação em que cada valor do domínio associa-se a um único valor no contradomínio."],
    ["funcao quadratica","Uma função quadrática tem forma f(x)=ax²+bx+c, com a diferente de zero. Seu gráfico é uma parábola."],
    ["bhaskara","A fórmula de Bhaskara resolve ax²+bx+c=0: x=(-b ± √Δ)/(2a), com Δ=b²-4ac."],
    ["progressao aritmetica","Progressão aritmética é uma sequência em que a diferença entre termos consecutivos é constante."],
    ["progressao geometrica","Progressão geométrica é uma sequência em que cada termo é obtido multiplicando o anterior por uma razão constante."],
    ["porcentagem","Porcentagem representa uma razão por 100. 25% de 80, por exemplo, é 20."],
    ["probabilidade","Probabilidade mede a chance de um evento ocorrer. Em casos equiprováveis, é casos favoráveis dividido por casos possíveis."],
    ["combinatoria","Análise combinatória estuda contagens de possibilidades usando princípios como produto, permutação, arranjo e combinação."],
    ["trigonometria","Trigonometria relaciona ângulos e lados. No triângulo retângulo: seno=oposto/hipotenusa, cosseno=adjacente/hipotenusa e tangente=oposto/adjacente."],
    ["geometria analitica","Geometria analítica representa figuras por coordenadas e equações no plano cartesiano."],
    ["media aritmetica","Média aritmética é a soma dos valores dividida pela quantidade de valores."],
  ],
  "Português": [
    ["sujeito","Sujeito é o termo sobre o qual se declara algo na oração e pode ser simples, composto, oculto, indeterminado ou inexistente."],
    ["predicado","Predicado é aquilo que se declara sobre o sujeito e contém o verbo da oração."],
    ["verbo","Verbo é a classe de palavra que pode indicar ação, estado, fenômeno ou mudança e varia em tempo, modo, número e pessoa."],
    ["pronome","Pronome acompanha ou substitui um nome, podendo marcar pessoa, posse, demonstração, indefinição e outras relações."],
    ["concordancia verbal","Concordância verbal é a adequação do verbo ao sujeito em número e pessoa."],
    ["concordancia nominal","Concordância nominal é a adequação de artigos, adjetivos, pronomes e numerais ao substantivo."],
    ["crase","Crase é a fusão de dois sons de a, geralmente a preposição a com o artigo feminino a, indicada pelo acento grave."],
    ["figura de linguagem","Figuras de linguagem são recursos expressivos, como metáfora, comparação, hipérbole, ironia, metonímia e personificação."],
    ["oracao subordinada","Oração subordinada depende sintaticamente de outra e pode exercer função substantiva, adjetiva ou adverbial."],
    ["coesao","Coesão é a ligação formal entre partes do texto por conectivos, pronomes, substituições e outros mecanismos."],
    ["coerencia","Coerência é a relação lógica de sentido entre as ideias de um texto."],
  ],
  "Literatura": [
    ["romantismo","Romantismo valorizou emoção, subjetividade, nacionalismo e idealização, no Brasil especialmente no século XIX."],
    ["realismo","Realismo reagiu à idealização romântica, buscando observação crítica da sociedade e análise psicológica."],
    ["naturalismo","Naturalismo radicalizou aspectos realistas, enfatizando determinismo, ambiente e hereditariedade."],
    ["modernismo","Modernismo brasileiro rompeu convenções acadêmicas e buscou linguagem mais livre e identidade cultural brasileira."],
    ["barroco","Barroco explora contrastes, conflito entre matéria e espírito, linguagem ornamentada e jogos de ideias."],
    ["arcadismo","Arcadismo valorizou simplicidade, equilíbrio, racionalidade e ideal de vida pastoril inspirado nos clássicos."],
    ["simbolismo","Simbolismo valoriza musicalidade, subjetividade, espiritualidade e sugestão em vez de descrição direta."],
    ["parnasianismo","Parnasianismo enfatiza forma, precisão vocabular, objetividade e arte pela arte."],
    ["machado de assis","Machado de Assis é um dos principais autores brasileiros, conhecido por ironia, análise psicológica e crítica social."],
  ],
  "Redação": [
    ["tese","Tese é a ideia central que o texto argumentativo pretende defender."],
    ["argumento","Argumento é uma razão, evidência ou relação lógica usada para sustentar uma tese."],
    ["introducao","A introdução apresenta o tema, contextualiza o problema e normalmente indica a tese."],
    ["desenvolvimento","O desenvolvimento organiza e explica os argumentos, relacionando causas, consequências, exemplos e evidências."],
    ["conclusao","A conclusão retoma a linha argumentativa e fecha o raciocínio; no ENEM, costuma incluir proposta de intervenção quando pertinente."],
    ["proposta de intervencao","Proposta de intervenção apresenta ação, agente, meio, finalidade e detalhamento para enfrentar o problema discutido."],
    ["repertorio sociocultural","Repertório sociocultural é conhecimento de história, ciência, arte, leis ou sociedade usado de forma pertinente para fortalecer a argumentação."],
    ["conectivos","Conectivos articulam relações como causa, oposição, conclusão, adição e exemplificação entre partes do texto."],
  ],
  "Física": [
    ["velocidade","Velocidade média é deslocamento dividido pelo intervalo de tempo. Sua unidade no SI é metro por segundo."],
    ["aceleracao","Aceleração é a taxa de variação da velocidade ao longo do tempo."],
    ["primeira lei de newton","A primeira lei de Newton diz que um corpo tende a manter repouso ou movimento retilíneo uniforme se a força resultante for zero."],
    ["segunda lei de newton","A segunda lei de Newton relaciona força resultante, massa e aceleração: F = m·a."],
    ["terceira lei de newton","A terceira lei de Newton afirma que forças surgem em pares de ação e reação, com mesma intensidade e sentidos opostos em corpos diferentes."],
    ["energia cinetica","Energia cinética é a energia associada ao movimento: Ec = m·v²/2."],
    ["energia potencial gravitacional","Perto da superfície da Terra, a energia potencial gravitacional pode ser aproximada por Epg = m·g·h."],
    ["potencia","Potência é a taxa de transformação ou transferência de energia: P = E/Δt."],
    ["lei de ohm","Lei de Ohm relaciona tensão, corrente e resistência: V = R·I."],
    ["lei de coulomb","A lei de Coulomb descreve a força elétrica entre cargas puntiformes: F = k·|q1q2|/r²."],
    ["campo eletrico","Campo elétrico é força elétrica por unidade de carga de prova: E = F/q."],
    ["ondas","Ondas transportam energia sem transporte líquido de matéria; velocidade, frequência e comprimento de onda obedecem v = λf."],
    ["optica","Óptica estuda luz, reflexão, refração, formação de imagens e fenômenos ondulatórios luminosos."],
  ],
  "Química": [
    ["atomo","Átomo é a unidade básica de um elemento químico, composto por núcleo com prótons e nêutrons e eletrosfera com elétrons."],
    ["tabela periodica","A tabela periódica organiza elementos por número atômico e propriedades recorrentes."],
    ["ligacao ionica","Ligação iônica envolve atração eletrostática entre íons formados por transferência de elétrons."],
    ["ligacao covalente","Ligação covalente ocorre pelo compartilhamento de pares de elétrons entre átomos."],
    ["mol","Mol é a quantidade de matéria que contém aproximadamente 6,022×10²³ entidades elementares."],
    ["estequiometria","Estequiometria relaciona quantidades de reagentes e produtos usando a proporção indicada pela equação química balanceada."],
    ["ph","pH mede a acidez ou basicidade de uma solução em escala logarítmica relacionada à concentração de H+ ou H3O+."],
    ["oxidacao reducao","Reações de oxirredução envolvem transferência de elétrons: oxidação perde elétrons e redução ganha."],
    ["entalpia","Entalpia é uma função de estado útil para descrever trocas de calor em processos a pressão constante."],
    ["equilibrio quimico","Equilíbrio químico dinâmico ocorre quando as velocidades das reações direta e inversa se igualam."],
    ["quimica organica","Química orgânica estuda principalmente compostos de carbono, suas funções, estruturas e reações."],
  ],
  "Biologia": [
    ["mitose","Mitose é a divisão celular que, em geral, produz duas células-filhas geneticamente semelhantes à célula original."],
    ["meiose","Meiose é uma divisão celular em duas etapas que reduz o número de cromossomos e aumenta variabilidade genética, formando gametas em muitos organismos."],
    ["dna","DNA é a molécula que armazena grande parte da informação genética dos seres vivos."],
    ["rna","RNA participa de processos como expressão gênica e síntese de proteínas, com diferentes tipos e funções."],
    ["fotossintese","Fotossíntese converte energia luminosa em energia química, usando dióxido de carbono e água e liberando oxigênio em plantas e outros organismos."],
    ["respiracao celular","Respiração celular libera energia química de moléculas orgânicas para produzir ATP."],
    ["genetica mendeliana","Genética mendeliana estuda padrões de herança associados à segregação e combinação de alelos."],
    ["selecao natural","Seleção natural favorece, ao longo das gerações, características hereditárias que aumentam sucesso reprodutivo em determinado ambiente."],
    ["ecossistema","Ecossistema reúne seres vivos e fatores não vivos em interação numa região."],
    ["cadeia alimentar","Cadeia alimentar representa transferência de matéria e energia entre produtores, consumidores e decompositores."],
    ["sistema nervoso","Sistema nervoso recebe, processa e transmite informações por redes de neurônios e outras células."],
    ["imunidade","Sistema imune reconhece e combate agentes estranhos por mecanismos inatos e adaptativos."],
  ],
  "História": [
    ["revolucao francesa","A Revolução Francesa, iniciada em 1789, derrubou estruturas do Antigo Regime e difundiu princípios de cidadania, liberdade e igualdade política."],
    ["revolucao industrial","A Revolução Industrial transformou produção, trabalho, urbanização e tecnologia a partir do século XVIII."],
    ["primeira guerra mundial","A Primeira Guerra Mundial ocorreu de 1914 a 1918 e envolveu grandes alianças europeias, nacionalismos, imperialismo e guerra industrial."],
    ["segunda guerra mundial","A Segunda Guerra Mundial ocorreu de 1939 a 1945 e envolveu Eixo e Aliados, genocídio nazista e ampla mobilização militar e econômica."],
    ["guerra fria","Guerra Fria foi a disputa geopolítica entre Estados Unidos e União Soviética após a Segunda Guerra, marcada por rivalidade ideológica, corrida armamentista e conflitos indiretos."],
    ["brasil colonia","Brasil Colônia corresponde ao período de domínio português, marcado por exploração econômica, escravidão e formação territorial."],
    ["independencia do brasil","A Independência do Brasil foi declarada em 1822, rompendo formalmente a relação colonial com Portugal."],
    ["republica velha","República Velha ou Primeira República brasileira vai de 1889 a 1930 e foi marcada por federalismo oligárquico e grande poder regional."],
    ["era vargas","Era Vargas refere-se ao período de forte influência política de Getúlio Vargas, incluindo 1930-1945 e seu governo eleito posterior."],
    ["ditadura militar brasileira","A ditadura militar brasileira durou de 1964 a 1985, com restrição de direitos políticos, censura e repressão, além de diferentes fases econômicas."],
  ],
  "Geografia": [
    ["globalizacao","Globalização é a intensificação de fluxos econômicos, informacionais, culturais e produtivos em escala mundial."],
    ["urbanizacao","Urbanização é o aumento da população urbana e da importância econômica e espacial das cidades."],
    ["demografia","Demografia estuda populações por tamanho, distribuição, idade, natalidade, mortalidade e migração."],
    ["clima","Clima é o padrão de condições atmosféricas observado por longos períodos numa região."],
    ["efeito estufa","Efeito estufa é um processo natural de retenção de calor; sua intensificação por gases emitidos por atividades humanas contribui para o aquecimento global."],
    ["placas tectonicas","A litosfera é dividida em placas tectônicas cujo movimento está associado a terremotos, vulcanismo e formação de montanhas."],
    ["relevo","Relevo é o conjunto de formas da superfície terrestre, moldado por processos internos e externos."],
    ["geopolitica","Geopolítica analisa relações de poder ligadas a territórios, recursos, fronteiras e estratégias entre atores."],
    ["brics","BRICS é um agrupamento de cooperação entre economias emergentes cuja composição se expandiu ao longo do tempo."],
    ["matriz energetica","Matriz energética é o conjunto de fontes usadas para suprir as necessidades de energia de uma sociedade."],
    ["capital do brasil","A capital do Brasil é Brasília."],
  ],
  "Filosofia": [
    ["socrates","Sócrates é associado ao diálogo crítico e ao exame de conceitos e crenças por perguntas."],
    ["platao","Platão desenvolveu uma filosofia sobre conhecimento, justiça, política e a relação entre mundo sensível e formas inteligíveis."],
    ["aristoteles","Aristóteles investigou lógica, ética, política, natureza, metafísica e muitos outros campos."],
    ["etica","Ética investiga fundamentos e critérios das ações humanas, valores, deveres e vida boa."],
    ["racionalismo","Racionalismo enfatiza o papel da razão na formação do conhecimento."],
    ["empirismo","Empirismo enfatiza a experiência e os sentidos como fontes fundamentais de conhecimento."],
    ["kant","Kant investigou os limites do conhecimento e propôs uma ética baseada em autonomia e dever racional."],
    ["existencialismo","Existencialismo reúne correntes que enfatizam existência concreta, liberdade, responsabilidade, escolha e sentido."],
  ],
  "Sociologia": [
    ["cultura","Cultura reúne valores, símbolos, práticas, conhecimentos e hábitos socialmente aprendidos e compartilhados."],
    ["socializacao","Socialização é o processo pelo qual pessoas aprendem normas, papéis e práticas de uma sociedade."],
    ["desigualdade social","Desigualdade social envolve distribuição desigual de recursos, oportunidades, poder e condições de vida."],
    ["classe social","Classe social é uma categoria usada para analisar posições econômicas e sociais e suas relações."],
    ["durkheim","Durkheim estudou fatos sociais, coesão, divisão do trabalho e formas de integração social."],
    ["marx","Marx analisou capitalismo, classes, trabalho, propriedade e conflito social."],
    ["weber","Weber estudou ação social, racionalização, burocracia, dominação e relações entre cultura e economia."],
    ["cidadania","Cidadania envolve pertencimento político e acesso a direitos civis, políticos e sociais, acompanhado de deveres."],
  ],
  "Inglês": [
    ["present simple","Present Simple é usado para hábitos, fatos e rotinas; na terceira pessoa do singular, o verbo geralmente recebe -s ou -es."],
    ["present continuous","Present Continuous usa am/is/are + verbo com -ing para ações em andamento ou situações temporárias."],
    ["simple past","Simple Past descreve ações concluídas no passado; verbos regulares usam -ed e irregulares têm formas próprias."],
    ["present perfect","Present Perfect usa have/has + particípio e conecta uma experiência ou ação passada ao presente."],
    ["future will","Will + verbo base pode expressar previsões, decisões instantâneas, promessas e outros sentidos de futuro."],
    ["conditional","Conditionals relacionam condições e consequências, como zero, first, second e third conditional."],
    ["passive voice","Passive voice destaca o receptor da ação e usa uma forma de be + particípio passado."],
    ["modal verbs","Modal verbs como can, could, may, might, must e should expressam possibilidade, capacidade, obrigação e conselho."],
  ],
  "Espanhol": [
    ["presente espanhol","No espanhol, o presente do indicativo expressa hábitos, fatos e ações atuais, com conjugações por pessoa."],
    ["preterito perfecto","Pretérito perfecto composto usa haber + participio para fatos passados relacionados ao presente em muitos usos."],
    ["preterito indefinido","Pretérito indefinido expressa normalmente ações concluídas em um tempo passado delimitado."],
    ["muy mucho","Muy costuma modificar adjetivos e advérbios; mucho pode atuar como adjetivo, pronome ou advérbio conforme o contexto."],
    ["ser estar","Ser tende a indicar identidade e características; estar, estados e localizações, embora existam nuances e exceções."],
    ["falsos cognatos","Falsos cognatos são palavras parecidas entre idiomas que têm significados diferentes."],
    ["subjuntivo espanhol","O subjuntivo espanhol aparece em contextos de desejo, dúvida, possibilidade, avaliação e dependência de certas estruturas."],
  ],
  "Artes": [
    ["renascimento","Renascimento valorizou estudos clássicos, humanismo, perspectiva e novas investigações sobre natureza e figura humana."],
    ["impressionismo","Impressionismo buscou registrar efeitos de luz, cor e percepção momentânea com pinceladas visíveis."],
    ["expressionismo","Expressionismo privilegia intensidade emocional e deformação expressiva em vez de representação fiel."],
    ["cubismo","Cubismo fragmenta e reorganiza formas e pontos de vista, explorando a construção geométrica da imagem."],
    ["arte moderna","Arte moderna reúne movimentos que romperam convenções acadêmicas e experimentaram novas linguagens nos séculos XIX e XX."],
    ["arte contemporanea","Arte contemporânea engloba práticas recentes e frequentemente mistura mídias, conceitos, participação e crítica social."],
    ["teoria das cores","Teoria das cores estuda relações de matiz, saturação, luminosidade, contraste, harmonias e percepção."],
  ],
  "Educação Física": [
    ["frequencia cardiaca","Frequência cardíaca é o número de batimentos do coração por minuto e varia com esforço, condicionamento e outros fatores."],
    ["aerobico","Exercício aeróbico depende predominantemente do metabolismo oxidativo e pode ser sustentado por períodos maiores."],
    ["anaerobico","Exercício anaeróbico envolve esforços intensos em que vias energéticas rápidas têm grande participação."],
    ["forca muscular","Força muscular é a capacidade de produzir tensão contra uma resistência."],
    ["resistencia muscular","Resistência muscular é a capacidade de sustentar ou repetir contrações por certo tempo."],
    ["flexibilidade","Flexibilidade é a amplitude possível de movimento em articulações, influenciada por vários tecidos e fatores."],
    ["principio da sobrecarga","Princípio da sobrecarga indica que adaptações exigem estímulos acima do nível habitual, aplicados de forma progressiva e recuperável."],
  ],
  "Tecnologia": [
    ["algoritmo","Algoritmo é uma sequência finita e organizada de passos para resolver um problema ou executar uma tarefa."],
    ["programacao","Programação é a criação de instruções executáveis por computadores usando linguagens, estruturas de dados e algoritmos."],
    ["variavel","Variável é um nome associado a um valor que pode ser usado e, dependendo do contexto, alterado durante a execução."],
    ["funcao programacao","Função em programação encapsula um bloco reutilizável de lógica que pode receber parâmetros e retornar um resultado."],
    ["banco de dados","Banco de dados organiza informação para armazenamento, consulta e atualização de maneira controlada."],
    ["internet","Internet é uma rede global de redes que usa protocolos padronizados, especialmente a família TCP/IP."],
    ["http","HTTP é um protocolo de aplicação usado para troca de recursos entre clientes e servidores na Web."],
    ["api","API é uma interface definida para que sistemas ou componentes se comuniquem de forma previsível."],
    ["inteligencia artificial","Inteligência artificial reúne técnicas para sistemas executarem tarefas associadas a percepção, linguagem, aprendizado, planejamento e decisão."],
    ["machine learning","Machine learning é uma área da IA em que modelos aprendem padrões a partir de dados para fazer previsões ou decisões."],
    ["seguranca digital","Segurança digital envolve proteger confidencialidade, integridade e disponibilidade de sistemas e dados."],
    ["circuito eletrico","Circuito elétrico é um caminho de componentes interligados que permite controlar corrente e tensão para realizar funções."],
  ]
};

const NUMBERS = {zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100};

function wordsToNumber(chunk="") {
  const t=normalizeText(chunk).trim(); if(/^[-+]?\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(",","."));
  let total=0, used=false; for(const w of t.split(/\s+/)){ if(w==="e") continue; if(NUMBERS[w]!==undefined){total+=NUMBERS[w];used=true;} else return NaN; } return used?total:NaN;
}
function fmt(n){ if(!Number.isFinite(n)) return null; if(Math.abs(n-Math.round(n))<1e-10) return String(Math.round(n)); return String(Number(n.toFixed(8))).replace(".",","); }
function arithmetic(text="") {
  const t=normalizeText(text).replace(/quanto (?:e|é)|calcule|calcula|quanto da|quanto dá/g,"").trim();
  let m=t.match(/^(.+?)\s+(mais|menos|vezes|multiplicado por|dividido por)\s+(.+?)[?!.]*$/);
  if(m){ const a=wordsToNumber(m[1]), b=wordsToNumber(m[3]); if(Number.isFinite(a)&&Number.isFinite(b)){ const op=m[2]; const r=op==="mais"?a+b:op==="menos"?a-b:(op==="vezes"||op==="multiplicado por")?a*b:b!==0?a/b:NaN; return Number.isFinite(r)?`Dá ${fmt(r)}.`:"Não dá para dividir por zero."; } }
  m=t.match(/^([-+]?\d+(?:[.,]\d+)?)\s*([+\-*/x×])\s*([-+]?\d+(?:[.,]\d+)?)[?!.]*$/);
  if(m){ const a=Number(m[1].replace(",",".")),b=Number(m[3].replace(",",".")),op=m[2]; const r=op==="+"?a+b:op==="-"?a-b:(op==="*"||op==="x"||op==="×")?a*b:b!==0?a/b:NaN; return Number.isFinite(r)?`Dá ${fmt(r)}.`:"Não dá para dividir por zero."; }
  m=t.match(/(?:raiz quadrada de|raiz de)\s+([\d.,]+)/); if(m){ const v=Number(m[1].replace(",",".")); if(v>=0) return `A raiz quadrada é ${fmt(Math.sqrt(v))}.`; }
  m=t.match(/([\d.,]+)\s*%\s*(?:de)\s*([\d.,]+)/); if(m){ return `${fmt(Number(m[1].replace(",","."))*Number(m[2].replace(",","."))/100)}.`; }
  return null;
}

export class OfflineKnowledgeService {
  constructor(){ this.entries=[]; for(const [subject,items] of Object.entries(SUBJECTS)) for(const [topic,answer] of items) this.entries.push({subject,topic,normalized:normalizeText(topic),answer}); }
  stats(){ return {subjects:Object.keys(SUBJECTS).length,concepts:this.entries.length}; }
  answer(raw=""){
    const calc=arithmetic(raw); if(calc) return {text:calc,subject:"Matemática",kind:"calculation"};
    const text=normalizeText(raw);
    if (/\b(?:juntar|encostar|ligar|unir|conectar)\b.*\b(?:fio|terminal|polo)?\s*(?:positivo|mais)\b.*\b(?:fio|terminal|polo)?\s*(?:negativo|menos)\b|\bcurto[- ]?circuito\b/.test(text)) {
      return {
        text: "Se você ligar diretamente o positivo ao negativo com pouca resistência, cria um curto-circuito: a corrente pode subir muito, aquecer fios, danificar a fonte ou a bateria e até causar incêndio. Em um circuito correto, a corrente deve passar por uma carga e pelas proteções adequadas.",
        subject: "Física",
        topic: "curto-circuito",
        kind: "knowledge"
      };
    }
    const matches=this.entries.map(e=>{ let score=0; if(text.includes(e.normalized)) score+=100+e.normalized.length; for(const w of e.normalized.split(" ")) if(w.length>3&&text.includes(w)) score+=3; return {e,score}; }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(matches[0]?.score>=8) return {text:matches[0].e.answer,subject:matches[0].e.subject,topic:matches[0].e.topic,kind:"knowledge"};
    return null;
  }
}

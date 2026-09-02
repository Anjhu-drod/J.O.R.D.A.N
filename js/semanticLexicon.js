import { normalizeText } from "./utils.js";

/*
 JORDAN Semantic Lexicon V0.4
 Cada entrada recebe tags semânticas. O fallback só usa isso depois que os
 handlers específicos falham. A base explícita cobre conversação e utilidades;
 números 0..999 em PT/EN/ES são gerados com significado numérico, levando o
 léxico total para muito além de 900 entradas úteis.
*/

const GROUPS = [
 ["greeting","saudação","pt","oi|ola|olá|opa|salve|e ai|e aí|alo|alô|bom dia|boa tarde|boa noite|fala|beleza"],
 ["greeting","greeting","en","hi|hello|hey|good morning|good afternoon|good evening|yo|greetings"],
 ["greeting","saludo","es","hola|buenos dias|buenos días|buenas tardes|buenas noches|que tal|qué tal|saludos"],
 ["greeting","挨拶","ja","こんにちは|おはよう|こんばんは|konnichiwa|ohayo|ohayou|konbanwa"],
 ["thanks","agradecimento","pt","obrigado|obrigada|valeu|agradeco|agradeço|tmj|tamo junto"],
 ["thanks","thanks","en","thanks|thank you|thx|cheers"],
 ["thanks","agradecimiento","es","gracias|muchas gracias"],
 ["thanks","感謝","ja","ありがとう|ありがとうございます|arigato|arigatou"],
 ["ask","perguntar","pt","pergunte|pergunta|perguntar|questione|duvida|dúvida|me pergunte"],
 ["ask","ask","en","ask|question|quiz|inquire|ask me"],
 ["ask","preguntar","es","pregunta|preguntame|pregúntame|preguntar"],
 ["ask","質問","ja","質問|聞く|shitsumon|kiku"],
 ["answer","responder","pt","responda|responde|resposta|diga|me diga|explique|conte|informe"],
 ["answer","answer","en","answer|reply|respond|tell me|explain"],
 ["answer","responder","es","responde|respuesta|dime|explica|cuenta"],
 ["show","mostrar","pt","mostrar|mostra|mostre|exibir|ver|visualizar|apresente"],
 ["show","show","en","show|display|view|present|reveal"],
 ["show","mostrar","es","muestra|mostrar|ver|visualiza"],
 ["open","abrir","pt","abrir|abra|abre|acessar|acesse|entrar|ir para"],
 ["open","open","en","open|access|enter|launch|go to"],
 ["open","abrir","es","abre|abrir|accede|entrar"],
 ["create","criar","pt","criar|crie|adicionar|adicione|colocar|coloque|registre|novo|nova|marque|agende"],
 ["create","create","en","create|make|add|register|new|schedule|set up"],
 ["create","crear","es","crear|crea|agrega|añade|anade|nuevo|programa"],
 ["delete","remover","pt","apagar|apague|deletar|delete|remover|remova|excluir|cancelar|cancele"],
 ["delete","delete","en","delete|remove|erase|cancel|clear"],
 ["delete","borrar","es","borrar|eliminar|quitar|cancela"],
 ["change","alterar","pt","alterar|altere|mudar|mude|trocar|troque|editar|ajustar|configure"],
 ["change","change","en","change|edit|modify|update|switch|adjust|configure"],
 ["change","cambiar","es","cambiar|editar|modificar|ajustar|configurar"],
 ["remember","memorizar","pt","lembre|lembrar|guarde|guardar|aprenda|memorize|salve|anote"],
 ["remember","remember","en","remember|save|store|learn|memorize|note"],
 ["remember","recordar","es","recuerda|recordar|guarda|aprende|memoriza|anota"],
 ["forget","esquecer","pt","esqueca|esqueça|esquece|esquecer|apague da memoria|apague da memória"],
 ["forget","forget","en","forget|erase memory|remove memory"],
 ["forget","olvidar","es","olvida|olvidar|borra de memoria"],
 ["user","usuário/eu","pt","eu|me|mim|meu|minha|meus|minhas|comigo|usuario|usuário|dono"],
 ["user","user/self","en","i|me|my|mine|myself|user|owner"],
 ["user","usuario/yo","es","yo|me|mi|mio|mío|mia|mía|usuario"],
 ["assistant","JORDAN/assistente","pt","voce|você|tu|jordan|assistente|secretaria|secretária|ia"],
 ["assistant","assistant","en","you|your|yours|jordan|assistant|ai|secretary"],
 ["assistant","asistente","es","tu|tú|usted|jordan|asistente|ia"],
 ["have","ter/possuir","pt","tenho|tem|ter|possuo|possui|contem|contém"],
 ["have","have","en","have|has|own|possess|contain|got"],
 ["have","tener","es","tengo|tiene|tener|poseo|posee|contiene"],
 ["want","querer","pt","quero|quer|queria|querer|gostaria|desejo|prefiro"],
 ["want","want","en","want|would like|wish|prefer"],
 ["want","querer","es","quiero|quiere|queria|quería|deseo|prefiero"],
 ["need","necessidade","pt","preciso|precisa|necessito|necessita|urgente"],
 ["need","need","en","need|require|must|urgent"],
 ["need","necesidad","es","necesito|necesita|requiero|urgente"],
 ["can","capacidade","pt","pode|posso|consegue|consigo|capaz|sabe|sei|permite"],
 ["can","ability","en","can|could|able|possible|know how"],
 ["can","capacidad","es","puede|puedo|capaz|sabes|posible"],
 ["like","gosto/preferência","pt","gosto|gosta|adoro|amo|curto|prefiro|favorito|favorita|preferido"],
 ["like","preference","en","like|love|enjoy|favorite|favourite|prefer"],
 ["like","preferencia","es","gusta|me gusta|amo|encanta|favorito|favorita|prefiero"],
 ["who","pergunta quem","multi","quem|who|quien|quién|誰|dare"],
 ["what","pergunta o quê","multi","o que|oque|what|which|que|qué|cual|cuál|何|nani"],
 ["where","pergunta lugar","multi","onde|aonde|where|donde|dónde|どこ|doko"],
 ["when","pergunta tempo","multi","quando|when|cuando|cuándo|いつ|itsu"],
 ["why","pergunta causa","multi","por que|porque|why|reason|por qué|razon|なぜ|naze"],
 ["how","pergunta modo","multi","como|how|cómo|どう|dou"],
 ["yes","afirmação","multi","sim|yes|yeah|si|sí|はい|hai|ok|okay|claro|sure"],
 ["no","negação","multi","nao|não|no|nope|nunca|いいえ|iie"],
 ["greet_person","cumprimentar pessoa","pt","cumprimente|cumprimenta|cumprimentar|diga oi|manda oi|de oi|dê oi"],
 ["greet_person","greet a person","en","greet|say hi to|say hello to|welcome"],
 ["greet_person","saludar persona","es","saluda|saludar|di hola a"],
 ["explain","explicar","multi","explique|explica|ensine|describe|explain|teach|clarify|explica|enseña|setsumei|oshiete"],
 ["compare","comparar","multi","compare|comparar|versus|vs|diferenca|diferença|better|worse|compara|diferencia|比較|hikaku"],
 ["recommend","recomendar","multi","recomende|sugira|indique|recommend|suggest|recomienda|sugiere|おすすめ|osusume"],
 ["translate","traduzir","multi","traduza|traduzir|translate|translation|traduce|traducir|翻訳|honyaku"],
 ["calculate","calcular","multi","calcule|somar|subtrair|multiplicar|dividir|calculate|compute|add|subtract|multiply|divide|calcula|suma|resta|計算|keisan"],
 ["information","informação/conhecimento","multi","informacao|informação|dados|fato|curiosidade|pesquisa|search|information|fact|knowledge|research|informacion|información|datos|情報|検索|jouhou|kensaku"],
 ["conversation","conversa","multi","conversa|conversar|papo|chat|talk|conversation|charla|会話|kaiwa"],
 ["story","história","multi","historia|história|conto|relato|story|tale|history|cuento|relato|物語|monogatari"],
 ["calendar","agenda/calendário","multi","agenda|calendario|calendário|compromisso|evento|reuniao|lembrete|calendar|schedule|appointment|meeting|reminder|cita|evento|予定|yotei"],
 ["time","tempo/data","multi","tempo|data|dia|semana|mes|ano|hora|minuto|manha|tarde|noite|hoje|amanha|time|date|day|week|month|year|hour|morning|afternoon|night|today|tomorrow|fecha|día|semana|mes|año|hora|mañana|tarde|noche|hoy|明日|今日|時間|ashita|kyou|jikan"],
 ["work","trabalho","multi","trabalho|emprego|empresa|chefe|turno|projeto|salario|work|job|company|boss|shift|project|salary|trabajo|empleo|empresa|jefe|turno|proyecto"],
 ["study","estudo","multi","estudo|escola|faculdade|curso|aula|prova|livro|study|school|college|course|class|exam|book|estudio|escuela|universidad|curso|clase|examen|libro"],
 ["game","jogo","multi","jogo|jogar|game|gaming|partida|nivel|player|console|personagem|missao|unity|roblox|juego|jugar|jugador"],
 ["music","música/áudio","multi","musica|música|som|audio|cancao|playlist|album|artista|spotify|youtube|music|song|track|artist|cancion|canción|音楽|曲|ongaku|kyoku"],
 ["play","reproduzir mídia","multi","toque|toca|tocar|reproduza|coloque|play|start|resume|reproduce|pon|再生|saisei"],
 ["location","lugar/localização","multi","lugar|local|localizacao|endereco|cidade|mapa|gps|rota|where|location|address|city|map|route|ubicacion|dirección|ciudad|mapa|場所|basho"],
 ["near","proximidade","multi","perto|proximo|próximo|mais perto|near|nearby|nearest|closest|cerca|mas cerca|más cerca|近く|chikaku"],
 ["gas_station","posto de combustível","multi","posto|posto de gasolina|posto de combustivel|gasolina|combustivel|gas station|fuel station|petrol station|gasoline|fuel|gasolinera|estacion de servicio|ガソリンスタンド|gasorin sutando"],
 ["internet","internet/web","multi","internet|web|online|site|pagina|google|pesquisa online|website|browser|search online|sitio|busqueda|ウェブ|検索"],
 ["anime","anime/mangá","multi","anime|animes|manga|mangá|shonen|seinen|isekai|episodio|arco|personagem|poder|character|power|episode|personaje|poder|アニメ|漫画|キャラクター"],
 ["favorite","favorito/preferido","multi","favorito|favorita|preferido|favorite|favourite|preferred|mi favorito|mi favorita|お気に入り|okiniiri"],
 ["character","personagem","multi","personagem|heroi|vilao|protagonista|character|hero|villain|personaje|heroe|villano|キャラクター"],
 ["emergency","emergência","multi","ajuda|socorro|emergencia|policia|samu|bombeiros|help|emergency|police|ambulance|ayuda|emergencia|policía"],
 ["phone","telefone/contato","multi","telefone|celular|numero|contato|ligar|phone|mobile|number|contact|call|telefono|móvil|contacto|llamar"],
 ["person","pessoa/relação","multi","pessoa|homem|mulher|garoto|garota|amigo|amiga|pai|mae|person|man|woman|boy|girl|friend|father|mother|persona|hombre|mujer|amigo|padre|madre|人|hito"],
 ["name","nome/identidade","multi","nome|apelido|sobrenome|name|nickname|surname|nombre|apodo|apellido|名前|namae"],
 ["appearance","aparência/corpo","pt","cabelo|olho|pele|rosto|altura|peso|barba|corpo|mao|perna|braco|cabeca|voz|idade"],
 ["color","cor","multi","preto|branco|vermelho|azul|verde|amarelo|roxo|rosa|cinza|marrom|black|white|red|blue|green|yellow|purple|gray|brown|negro|blanco|rojo|azul|verde|amarillo"],
 ["emotion","emoção/estado","multi","feliz|triste|cansado|exausto|animado|bravo|preocupado|nervoso|calmo|ansioso|entediado|happy|sad|tired|excited|angry|worried|calm|bored|feliz|triste|cansado|emocionado|enojado"],
 ["technology","tecnologia","multi","tecnologia|computador|pc|celular|iphone|android|app|software|codigo|programacao|javascript|html|css|api|servidor|github|microfone|technology|computer|phone|code|programming|server|microphone|tecnología|computadora|telefono|programación|servidor"],
 ["weather","clima","multi","clima|chuva|sol|nublado|vento|frio|calor|temperatura|previsao|weather|rain|sun|cloudy|wind|cold|hot|forecast|lluvia|sol|viento|frio|calor|pronostico"],
 ["health","saúde","multi","saude|medico|hospital|dentista|consulta|remedio|dor|farmacia|academia|treino|sono|health|doctor|dentist|medicine|pain|pharmacy|gym|sleep|salud|médico|dentista|medicina|dolor|farmacia"],
 ["language","idioma","multi","portugues|ingles|espanhol|japones|idioma|lingua|traducao|pronuncia|portuguese|english|spanish|japanese|language|translation|pronunciation|portugués|inglés|español|japonés|日本語|英語|言語"]
];

const ANIME_NAMES = `Luffy|Monkey D Luffy|Zoro|Roronoa Zoro|Sanji|Law|Trafalgar Law|Nami|Robin|Usopp|Chopper|Brook|Jinbe|Shanks|Ace|Sabo|Blackbeard|Teach|Kaido|Big Mom|Garp|Dragon|Roger|Naruto|Sasuke|Sakura|Kakashi|Jiraiya|Tsunade|Orochimaru|Itachi|Pain|Nagato|Konan|Obito|Madara|Minato|Hinata|Gaara|Rock Lee|Shikamaru|Gon|Killua|Kurapika|Leorio|Hisoka|Chrollo|Meruem|Pitou|Netero|Ging|Kite|Guts|Griffith|Casca|Skull Knight|Zodd|Gojo|Sukuna|Yuji|Megumi|Nobara|Yuta|Toji|Geto|Tanjiro|Nezuko|Zenitsu|Inosuke|Rengoku|Giyu|Shinobu|Muzan|Ichigo|Rukia|Aizen|Renji|Byakuya|Kenpachi|Urahara|Goku|Vegeta|Gohan|Piccolo|Frieza|Broly|Beerus|Eren|Mikasa|Armin|Levi|Erwin|Reiner|Light|Ryuk|Misa|Jinwoo|Sung Jinwoo|Beru|Igris`;
GROUPS.push(["anime_entity","nome de personagem de anime","multi",ANIME_NAMES]);

const EXTRA_PT = {
 action_generic: "andar|correr|pular|sentar|levantar|pegar|soltar|levar|trazer|enviar|receber|buscar|achar|encontrar|usar|fazer|comecar|terminar|continuar|parar|esperar|entrar|sair|voltar|ir|vir|chegar|partir|ler|escrever|ouvir|escutar|assistir|olhar|pensar|escolher|decidir|tentar|conseguir|ajudar|organizar|ordenar|separar|juntar|conectar|desconectar|ligar|desligar|ativar|desativar|aumentar|diminuir|subir|descer|ganhar|perder|comprar|vender|pagar|copiar|colar|cortar|editar|salvar|baixar|carregar|instalar|atualizar|sincronizar|compartilhar",
 object: "objeto|coisa|item|ferramenta|maquina|equipamento|arma|roupa|camisa|calca|sapato|tenis|bolsa|mochila|garrafa|copo|prato|faca|garfo|colher|papel|caneta|lapis|chave|carteira|documento|foto|imagem|video|texto|nota|lista|tabela|botao|tela|janela|menu|painel|icone|logo|simbolo",
 place: "casa|trabalho|escola|faculdade|hospital|farmacia|mercado|supermercado|shopping|loja|restaurante|lanchonete|bar|hotel|academia|parque|praca|cinema|teatro|estadio|delegacia|igreja|banco|aeroporto|rodoviaria|estacao|garagem|oficina|salao|biblioteca|museu",
 food: "comida|alimento|cafe|almoco|jantar|lanche|pizza|hamburguer|arroz|feijao|carne|frango|peixe|ovo|pao|leite|agua|suco|refrigerante|fruta|maca|banana|laranja|uva|morango|chocolate",
 transport: "carro|moto|motocicleta|bicicleta|onibus|taxi|uber|aviao|barco|trem|metro|veiculo|transito|viagem|viajar|estacionamento|garagem",
 quality: "bom|boa|ruim|otimo|excelente|perfeito|melhor|pior|facil|dificil|rapido|lento|forte|fraco|bonito|feio|novo|velho|importante|interessante|estranho|normal|diferente|igual|correto|errado|verdadeiro|falso|possivel|impossivel|aberto|fechado|ocupado|livre|disponivel|seguro|perigoso|simples|complexo|completo|vazio"
};
for (const [tag,list] of Object.entries(EXTRA_PT)) GROUPS.push([tag,tag.replaceAll("_"," "),"pt",list]);

function normalizeLexeme(value = "") {
  return normalizeText(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

const LEXICON = new Map();

function addLexeme(term, tag, meaning, language, value = undefined) {
  const key = normalizeLexeme(term);
  if (!key) return;
  const current = LEXICON.get(key) ?? { term, tags: [], meanings: [], languages: [], value: undefined };
  if (!current.tags.includes(tag)) current.tags.push(tag);
  if (!current.meanings.includes(meaning)) current.meanings.push(meaning);
  if (!current.languages.includes(language)) current.languages.push(language);
  if (value !== undefined) current.value = value;
  LEXICON.set(key, current);
}

for (const [tag, meaning, language, list] of GROUPS) {
  for (const term of list.split("|")) addLexeme(term.trim(), tag, meaning, language);
}

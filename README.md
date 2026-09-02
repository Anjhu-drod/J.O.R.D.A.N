# JORDAN V0.2

Segunda versão incremental do JORDAN. Continua sendo um projeto web puro (HTML/CSS/JavaScript), mas agora o foco visual é o assistente e não somente o calendário.

## Principais mudanças da V0.2

- Nova identidade visual em vermelho + preto
- Símbolo oficial enviado pelo usuário como núcleo central
- Animações circulares/ondas quando JORDAN escuta ou fala
- Navegação separada: Core, Calendar, Memory e System
- Voz configurada para procurar automaticamente uma voz feminina PT-BR
- Ajuste de pitch/rate para um perfil mais jovem e menos mecânico
- Reconhecimento de voz com `interimResults`
- Envio automático após 3 segundos sem novas palavras
- Memória ensinável por conversa
- Preferências de fala: informal/gírias, formal ou neutra
- Consulta do que JORDAN aprendeu
- Exclusão manual de memórias
- Calendário próprio mantido no IndexedDB
- Duração contextual dos eventos
- Pergunta de confirmação de duração quando a duração não foi informada
- Perfis iniciais de duração:
  - trabalho: 8 horas
  - jogo: 30 minutos
  - compromisso/consulta/dentista: 1 hora
  - treino: 1 hora
  - estudo: 2 horas
  - refeição: 45 minutos
- Alertas internos em etapas, variando por categoria
- Notification API opcional no navegador
- Backup agora inclui agenda + memória

## Exemplos de conversa

### Agenda

- `Jordan, marque dentista amanhã às 15h`
- JORDAN pergunta se pode usar a duração padrão de 1 hora.
- Responda `pode usar o padrão` ou `30 minutos`.

Também funciona:

- `Jordan, marque trabalho sexta às 8h por 8 horas`
- `Jordan, marque tempo de jogo amanhã às 20h`
- `Jordan, o que tenho amanhã?`
- `Jordan, qual meu próximo compromisso?`
- `Jordan, adie dentista para sexta às 16h`
- `Jordan, cancele dentista`
- `Jordan, abra meu calendário`

### Memória

- `Jordan, eu moro em Tijucas`
- `Jordan, meu nome é Jhuan`
- `Jordan, meu número de telefone é ...`
- `Jordan, eu gosto de anime`
- `Jordan, lembre que ...`
- `Jordan, o que você sabe sobre mim?`
- `Jordan, onde eu moro?`
- `Jordan, qual meu número de telefone?`

### Personalidade

- `Jordan, fale com gírias`
- `Jordan, fique mais formal`
- `Jordan, volte ao normal`

## Rodar localmente

Use Live Server no VS Code ou outro servidor HTTP. Não abra `index.html` apenas com duplo clique.

### Live Server

1. Abra a pasta no VS Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html`.
4. Use **Open with Live Server**.

### Python

```bash
python -m http.server 5500
```

Abra `http://localhost:5500`.

## GitHub Pages

Substitua os arquivos antigos do repositório pelos arquivos desta versão e publique a branch normalmente.

Como o nome do cache do Service Worker mudou para `jordan-v0.2.0`, o navegador deve atualizar os arquivos. Se ainda aparecer a interface antiga, faça um reload forçado ou remova os dados do site uma vez.

## Limitações atuais importantes

### Voz humana

JORDAN escolhe a melhor voz feminina em português disponível no próprio sistema/navegador. A qualidade muda conforme Windows, iPhone, Android e navegador. Sem uma API de TTS externa, não é possível garantir exatamente uma voz humana de 18 anos em todos os aparelhos.

### Segundo plano e alertas

Nesta versão web, os alertas falados são confiáveis enquanto JORDAN está aberta. Browser Notifications também dependem do navegador e das permissões. Alertas exatos com o app totalmente fechado serão tratados futuramente com backend/Web Push e/ou Capacitor Local Notifications.

### Memória entre dispositivos

A memória ainda é local. O PC e o iPhone têm bancos diferentes. A futura Jordan API vai sincronizar uma única memória entre todos os dispositivos.

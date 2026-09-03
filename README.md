# JORDAN V0.8 — Lineage Protocol / Calendar Intelligence / Voice Lock

Patch incremental sobre a V0.7.2.

## Direção da V0.8

A JORDAN deixa de ser tratada como um app público genérico. A instalação é destinada à linhagem cadastrada no próprio projeto.

### Acesso em três etapas

1. **Family Gate** — senha familiar (o build atual usa o PIN definido para o projeto; o hash, não o PIN em texto, fica em `js/lineageConfig.js`).
2. **JORDAN ID** — Firebase Authentication por e-mail/senha ou Google.
3. **Identidade da linhagem** — escolha de uma identidade e confirmação pelo segundo nome.

Identidades cadastradas:

- Alef · confirmação: Macedo
- Jhuan · confirmação: Alexandre · creator/admin
- Kauan · confirmação: Kewen
- Poliana · confirmação: Santana
- Laerte · confirmação: Geraldo

Cada identidade pode ser vinculada a apenas um Firebase UID por meio de `lineageBindings/{identityId}`. A identidade **Jhuan precisa ser vinculada primeiro** para ancorar o creator; depois disso os outros membros podem reivindicar seus perfis.

> O Family Gate e o segundo nome são uma barreira de interface, não autenticação criptográfica forte, pois um site estático pode ser inspecionado. A autenticação real continua sendo Firebase Auth + Firestore Rules. Para uma versão futura ainda mais rígida, use aprovação do creator/backend ou allowlist de contas.

## Árvore de relações

A JORDAN conhece relações familiares básicas para resolver referências naturais:

- Laerte é pai de Jhuan e Kauan.
- Poliana é mãe de Jhuan, Kauan e Alef.
- Jhuan, Kauan e Alef estão registrados como irmãos entre si na árvore operacional da JORDAN.

Exemplos:

- `Quem é minha mãe?`
- `Qual o nome do meu pai?`
- `Marque o aniversário da minha mãe...`

## Creator Console

A identidade `jhuan` é o **creator/admin do aplicativo**. O creator pode abrir o console administrativo de memória da linhagem e ler os dados sincronizados dos perfis vinculados para manutenção/recuperação. Essa condição é informada na tela de cadastro.

Outros usuários não têm a tela de memória exposta; a memória continua funcionando normalmente em segundo plano.

As permissões de creator são permissões do aplicativo. Operações sensíveis/destrutivas continuam devendo usar confirmação e controles de segurança adequados.

## Calendário V0.8

- Visual mensal com mês, ano e dias da semana.
- Navegação mês anterior / próximo / hoje.
- Seleção visual de um dia.
- Eventos de dia inteiro.
- Eventos anuais.
- Linguagem de datas mais natural.

Exemplos:

- `Vou viajar na próxima semana na quinta-feira.` → quinta da próxima semana, dia inteiro.
- `Na outra semana na quinta tenho uma reunião.` → quinta da semana posterior à próxima.
- `Ontem foi revisão do projeto.` → registra ontem.
- `Dia 10 de outubro é aniversário do Pedro.` → evento anual.

### Aniversários fixos da linhagem

- Alef — 14 de março
- Jhuan — 20 de junho
- Kauan — 19 de agosto
- Laerte — 20 de agosto
- Poliana — 27 de maio

Eles são eventos anuais virtuais, protegidos e aparecem automaticamente em todos os calendários.

## Functional Orbits

Os três elementos em órbita do CORE agora representam estado real:

- **NET** — verde; escurece offline e acelera conforme a qualidade/velocidade estimada da conexão.
- **MEM** — vermelho; brilho e velocidade acompanham a capacidade livre do armazenamento local do site.
- **EXEC** — ponto neon; lento em idle, rápido enquanto a JORDAN processa/fala e esverdeado enquanto o usuário fala.

## Voice Lock experimental

A V0.8 pode cadastrar uma impressão espectral local da voz do usuário naquele dispositivo.

- Perfil de voz fica **local** e não vai para o Firestore.
- Com Voice Lock ligado, uma voz não reconhecida nunca entra no executor normal de comandos.
- Se `Permitir conversas de terceiros` estiver ligado, terceiros recebem uma rota `read-only`: podem conversar e fazer perguntas gerais, mas não podem alterar calendário/memória, abrir apps, controlar música, usar GPS ou executar comandos.
- Se a opção estiver desligada, uma voz não reconhecida é bloqueada.

Isso é um recurso experimental de conveniência, não autenticação biométrica forte. Firebase Authentication continua sendo a identidade real da conta.

## Firebase

O projeto continua usando:

- Firebase Authentication
- Cloud Firestore
- Persistent Local Cache
- sincronização offline/online

**Publique o novo `firestore.rules` desta versão.** As regras V0.8 criam `lineageBindings` e permitem ao creator Jhuan leitura administrativa, mantendo escrita somente pelo dono de cada perfil.

Leia `FIREBASE_SETUP.md`.

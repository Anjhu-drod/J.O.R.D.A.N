# JORDAN V0.8 — Firebase / Lineage Setup

A V0.8 usa Firebase Authentication + Cloud Firestore no projeto `jordan-a8722`.

## 1. Authentication

Firebase Console → Authentication → Sign-in method.

Mantenha ativos:

- Email/Password
- Google

Em Authentication → Settings → Authorized domains, mantenha também o domínio do GitHub Pages, por exemplo:

`SEUUSUARIO.github.io`

## 2. Firestore

Firebase Console → Firestore Database.

O banco `(default)` deve estar criado.

## 3. Publique as NOVAS Rules da V0.8

Abra Firestore Database → Rules e substitua o conteúdo pelo arquivo `firestore.rules` deste patch.

Depois clique em **Publish**.

Isso é obrigatório porque a V0.8 adiciona:

- `lineageBindings/{identityId}`
- vínculo único entre uma identidade da linhagem e um Firebase UID
- leitura administrativa do creator
- dados de cada usuário em `users/{uid}/...`

### Modelo de acesso

- membro normal: lê/escreve apenas o próprio `users/{uid}/...`
- creator Jhuan: pode ler os perfis vinculados para o console administrativo
- creator não escreve diretamente no banco privado de outro membro através dessa regra
- qualquer usuário não autenticado: sem acesso ao Firestore privado

## 4. Primeiro acesso da V0.8

Quando ainda não existe sessão vinculada:

1. Family Gate.
2. E-mail/senha ou Google.
3. No primeiro provisionamento da linhagem, **Jhuan deve vincular a identidade dele primeiro**.
4. Depois, cada membro escolhe uma das identidades disponíveis.
5. Informar o segundo nome correspondente.
6. A JORDAN cria o binding daquela identidade.

Depois disso a sessão Firebase permanece salva normalmente. Ao reabrir o mesmo dispositivo, a JORDAN reconhece a conta e a identidade sem repetir toda a sequência.

Ao usar `SAIR DA CONTA`, a sessão e o Family Gate daquele dispositivo são encerrados.

## 5. Importante sobre o Family Gate

O Family Gate serve para impedir entrada casual na tela de autenticação/claim. Como a JORDAN ainda é um site estático no GitHub Pages, JavaScript e hashes podem ser inspecionados. Portanto ele NÃO substitui Firebase Authentication.

O mesmo vale para o segundo nome de confirmação: é uma confirmação de identidade do fluxo familiar, enquanto a segurança de dados é feita por Firebase Auth + Rules.

Se no futuro você quiser tornar a reivindicação de identidades mais rígida, a evolução recomendada é aprovação do creator por backend/Cloud Function ou uma allowlist de contas previamente aprovada.

## 6. Dados e offline

Memórias, agenda e configurações continuam usando Firestore com cache persistente.

Sem internet:

- JORDAN usa o cache já sincronizado;
- gravações compatíveis ficam pendentes;
- quando a rede volta, o Firestore tenta sincronizar.

JORDAN Music e Voice Lock continuam locais por dispositivo. Arquivos de áudio e impressão experimental de voz não são enviados ao Firestore.

## 7. Teste rápido

1. Publique `firestore.rules`.
2. Atualize os arquivos da V0.8 no GitHub.
3. Abra a JORDAN com `?v=080` uma vez.
4. Passe pelo Family Gate.
5. Entre com Firebase.
6. Escolha sua identidade e informe o segundo nome de confirmação.
7. Crie um evento: `Vou viajar na próxima semana na quinta-feira.`
8. Veja o calendário mensal.
9. Abra SYS e teste o Voice Lock.
10. Em outro dispositivo, entre na mesma conta/identidade e confira a sincronização.

---

## V0.9 — vários dispositivos / mesmo e-mail

A identidade da linhagem pertence ao **Firebase UID**, não ao computador ou celular. O mesmo UID pode permanecer autenticado simultaneamente em vários dispositivos.

A V0.9 adiciona a coleção:

`userIdentityClaims/{uid}`

Ela funciona como um mapa rápido UID -> identidade e evita depender do cache de outro dispositivo. Publique novamente o `firestore.rules` fornecido na V0.9.

### Importante sobre Google e senha

Google e E-mail/Senha são provedores diferentes. Para conseguir usar qualquer um deles sem criar outra conta, abra `SYS > JORDAN ID` e vincule os dois métodos à **mesma conta Firebase**.

- Conta criada com E-mail/Senha: use `VINCULAR GOOGLE`.
- Conta criada com Google: informe uma senha em `Senha multidispositivo` e use `VINCULAR SENHA`.

Depois disso, PC e celular podem entrar pelo mesmo UID usando Google ou E-mail/Senha.

# JORDAN V0.7.1 — Firestore Offline Boot Fix

Patch incremental para a JORDAN V0.7.

## ALTERADOS
- js/cloudDataService.js
- js/legacyMigrationService.js
- js/app.js
- js/authService.js
- sw.js

## CORREÇÃO PRINCIPAL
A V0.7 podia falhar ao iniciar com:
`Failed to get document because the client is offline.`

A V0.7.1 trata leituras Firestore offline como cache vazio quando o documento ainda nunca foi sincronizado, sem derrubar o boot da JORDAN.

Também:
- leituras tentam cache Firestore quando a rede não responde;
- escritas não congelam a interface enquanto aguardam ACK do servidor;
- a migração do JordanDB antigo nunca apaga o banco antes da confirmação do backend;
- a migração é adiada e tentada novamente quando a internet volta;
- o botão de sincronização possui timeout em vez de ficar preso;
- login continua válido durante uma indisponibilidade temporária do Firestore;
- o listener cloud agora inclui configurações;
- cache do Service Worker atualizado para jordan-v0.7.1.

## INSTALAÇÃO
Substitua os cinco arquivos acima no GitHub mantendo os caminhos.
Depois faça Ctrl+F5 no PC. No PWA/celular, feche totalmente e abra novamente.

# Usar a mesma voz no celular durante os testes

O celular não consegue usar `127.0.0.1` do PC. Para testes, você pode criar um Quick Tunnel HTTPS gratuito com Cloudflare.

1. Instale `cloudflared` no PC.
2. Inicie `RUN_VOICE_SERVER.bat` e confirme que `http://127.0.0.1:8787/health` abre.
3. Em outro terminal, execute:

```bash
cloudflared tunnel --url http://localhost:8787
```

4. O Cloudflare imprimirá uma URL temporária parecida com:

`https://palavras-aleatorias.trycloudflare.com`

5. No celular, abra JORDAN > SYS > JORDAN VOICE CORE e cole essa URL em VOICE SERVER URL.
6. Clique TESTAR CONEXÃO e depois OUVIR JORDAN.

Quick Tunnels são para desenvolvimento e a URL muda quando o processo reinicia. Para uso contínuo, depois criaremos um endpoint persistente.

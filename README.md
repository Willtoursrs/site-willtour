# site-willtour
Site institucional Will Tour 

## Rodar localmente (macOS)

O site é HTML + JS puro, sem build. Basta servir a pasta com o Python que já vem no Mac:

```bash
cd site-willtour
python3 -m http.server 8000
```

Acesse http://localhost:8000 (ex.: http://localhost:8000/login.html). Para parar, `Ctrl+C`.

> O login com Google em `login.html` só funciona via `http://localhost:8000` ou no domínio publicado — abrindo o arquivo direto (`file://`) aparece apenas o botão de modo local de teste.

## Atualizar dados do dashboard

O Pax Pro é chamado ao vivo pelo navegador. Só o Agendor, que não libera CORS, passa por `dashboard/atualizar_dashboard.js` (Node 18+, sem dependências), que gera `atendimento.js` às 10h e 18h:

```bash
node dashboard/atualizar_dashboard.js
```

As rotas de API ficam em `dashboard/api/` (`agendor.js` e `transform.js`). As chaves ficam fora do repositório, em `~/.willtour/paxpro_api_code` e `~/.willtour/agendor_token` — nunca no JS do site.

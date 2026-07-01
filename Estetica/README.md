# Painel da Estética — App (Next.js + Supabase)

SaaS de gestão para estéticas automotivas. Frontend em Next.js (App Router),
banco e autenticação no Supabase, deploy na Vercel.

## 1. Pré-requisito: banco

Antes de rodar o app, prepare o banco no Supabase rodando os scripts do
**outro pacote** (`supabase-estetica.zip`), na ordem indicada no README de lá.
Para desenvolvimento, desligue a confirmação de e-mail em
Authentication > Providers > Email > "Confirm email".

## 2. Rodar localmente

```bash
npm install
cp .env.local.example .env.local   # preencha os valores
npm run dev
```

Acesse http://localhost:3000 — cai no cadastro/login.

### Variáveis de ambiente (.env.local)

| Variável | Onde achar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API (anon/publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API (service_role — **secreto**) |
| `CRON_SECRET` | uma string aleatória longa (você inventa) |

> A `SUPABASE_SERVICE_ROLE_KEY` é usada só no servidor (envio de WhatsApp).
> Nunca a exponha no navegador nem suba o `.env.local` para o GitHub.

## 3. Deploy na Vercel

1. Suba este projeto para um repositório no GitHub.
2. Em vercel.com, **Add New > Project** e importe o repositório.
3. Em **Environment Variables**, adicione as quatro variáveis acima.
4. Deploy. A Vercel detecta Next.js automaticamente.
5. No Supabase, em Authentication > URL Configuration, adicione a URL da
   Vercel em **Site URL** e **Redirect URLs** (inclua `.../auth/confirm`).

O `vercel.json` já agenda o cron de lembretes (todo dia às 9h de Brasília).
Ele só passa a rodar depois do deploy, e usa a `CRON_SECRET`.

## 4. Estrutura

```
app/            telas e rotas (login, dashboard, ordens, agenda, etc.)
  */actions.ts  Server Actions (lógica de cada tela)
utils/supabase/ clientes Supabase (navegador, servidor, service role)
lib/whatsapp.ts envio de notificações via Cloud API
middleware.ts   sessão + proteção de rotas
```

## Notas

- `next.config.mjs` está com lint/erros de tipo afrouxados para o primeiro
  deploy não travar. Recomendado reativar quando for endurecer o projeto.
- WhatsApp exige WABA verificada e templates aprovados pela Meta (ver a
  tela `/config/whatsapp`, que mostra os textos para submeter).
- O app está fixado no fuso de Brasília (sem horário de verão).

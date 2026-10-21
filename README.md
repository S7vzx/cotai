# Cotaí

Plataforma de cotação de produtos para clientes B2B. O cliente manda a foto e o preço-alvo, a equipe cota com fornecedores e o cliente recebe a cotação por e-mail e WhatsApp, e aprova pela web.

**Stack:** React 19 + Vite + TypeScript + Tailwind 4 · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions em Deno) · TanStack Query · Vitest + PGlite + Playwright.

---

## O que já está pronto

| Área | Conteúdo |
|---|---|
| **Site público** | Landing com hero animado, formulário de pedido em 3 etapas (fotos comprimidas no celular, vários produtos, cupom, Pix), página de acompanhamento e página da cotação com comparação alvo × encontrado, escolha de opção, aprovação e recusa |
| **Painel** | Dashboard, kanban de cotações com arrastar e soltar e tempo real, detalhe do pedido (opções A/B/C, margem, alerta de margem mínima, envio por e-mail e WhatsApp com prévia, comentários com @menção, histórico), kanban de compras com anexos, clientes |
| **Administração** | Empresa e marca, cobrança (fixo, por produto ou faixas, cupons, isentos), regras de cotação, textos da landing e FAQ, mensagens com prévia, integrações, equipe e permissões, categorias, fornecedores e logs com CSV |
| **Banco** | 5 migrações com RLS em todas as tabelas, regras de status, cálculo de taxa, auditoria e funções públicas por token |
| **Edge Functions** | 13 funções: pedido, upload, taxa, acompanhamento, cotação pública, envio, notificações, Pix (Asaas/Mercado Pago), webhook, convites, lembretes e status das integrações |
| **Testes** | 52 testes de unidade e de banco (Postgres real em memória) e 28 testes ponta a ponta (desktop e celular) |

---

## Rodar localmente

Pré-requisitos: **Node 20+** e **Docker** (para o Supabase local).

```bash
npm install
npx supabase start          # sobe Postgres, Auth, Storage e Studio (aplica migrações e seed)
cp .env.example .env.local  # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (o comando acima mostra)
npm run functions:serve     # em outro terminal: Edge Functions
npm run dev                 # http://localhost:5173
```

- **Login local:** `admin@cotai.local` / `cotai12345` (criado pelo `supabase/seed.sql`).
- **Studio do banco:** http://localhost:54323
- **E-mails locais** (convites, recuperação de senha): http://localhost:54324
- No primeiro acesso, o admin passa pelo assistente de configuração (empresa, cobrança e contato).

Para as Edge Functions locais, crie `supabase/functions/.env` com os secrets que quiser testar (veja `.env.example`). Sem nenhum secret, tudo funciona: e-mail e WhatsApp ficam como "não configurado" e o Pix é manual.

---

## Publicar em produção

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Ligue e envie o banco:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push            # aplica supabase/migrations (o seed.sql NÃO roda em produção)
   npx supabase functions deploy   # publica as 13 Edge Functions
   ```
3. Em **Authentication → URL Configuration**, defina o **Site URL** (ex.: `https://cotai.com.br`) e adicione `https://cotai.com.br/admin/nova-senha` e `https://cotai.com.br/minhas-cotacoes` às Redirect URLs.
4. Em **Authentication → Providers → Email**, desligue o cadastro público ("Allow new users to sign up"). A equipe entra por convite.
5. Crie o primeiro usuário em **Authentication → Users → Add user**. **O primeiro usuário vira administrador automaticamente.**

### 2. Secrets das Edge Functions
```bash
npx supabase secrets set SITE_URL=https://cotai.com.br
npx supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="Cotaí <cotacoes@cotai.com.br>"
# WhatsApp (opcional): zapi | evolution | meta
npx supabase secrets set WHATSAPP_PROVIDER=zapi ZAPI_INSTANCE=... ZAPI_TOKEN=... ZAPI_CLIENT_TOKEN=...
# Pix automático (opcional): asaas | mercadopago
npx supabase secrets set PAYMENT_PROVIDER=asaas PAYMENT_ENV=producao ASAAS_API_KEY=... PAYMENT_WEBHOOK_SECRET=uma-senha-longa
# Tarefa agendada
npx supabase secrets set CRON_SECRET=outra-senha-longa
```
Depois, em **Ajustes → Integrações** no painel, confira se tudo aparece como configurado e use **Enviar teste**.

**Webhook do Pix:**
- **Asaas:** cadastre `https://SEU_PROJECT_REF.supabase.co/functions/v1/payment-webhook` e use o mesmo valor de `PAYMENT_WEBHOOK_SECRET` como token de autenticação.
- **Mercado Pago:** a URL é enviada automaticamente em cada cobrança.

### 3. Tarefa agendada (lembretes e expiração de pedidos não pagos)
No SQL Editor do Supabase, com as extensões `pg_cron` e `pg_net` ativadas:
```sql
select cron.schedule('cotai-expire-unpaid', '0 * * * *', $$
  select net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/expire-unpaid',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'MESMO_VALOR_DO_CRON_SECRET'),
    body := '{}'::jsonb
  );
$$);
```

### 4. Site (Vercel, Netlify ou similar)
- **Build:** `npm run build` · **Pasta:** `dist`
- **Variáveis:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`
- Configure o fallback de SPA (todas as rotas → `index.html`). Na Vercel, isso é automático para Vite. Na Netlify, crie `public/_redirects` com a linha `/* /index.html 200`.

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Site em modo desenvolvimento |
| `npm run check` | Tipos + lint + testes de unidade e de banco |
| `npm run test:db` | Testa migrações, RLS e regras de negócio num Postgres em memória (não precisa de Docker) |
| `npm run test:e2e` | Testes ponta a ponta com Supabase simulado (`npx playwright install chromium` na primeira vez) |
| `npm run functions:check` | Checa os tipos das Edge Functions (precisa do [Deno](https://deno.com)) |
| `npm run db:types` | Gera `src/types/database.ts` a partir do banco local |

---

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `CLAUDE.md` | Regras para continuar o projeto com o Claude Code |
| `docs/` | Especificação, roadmap, marca, decisões e pendências |
| `src/pages` | Telas: `public/`, `auth/`, `painel/`, `admin/` |
| `src/features` | Dados por domínio (consultas e mutações) |
| `src/components` | `ui/` (base estilo Apple), `shared/`, `brand/` |
| `supabase/migrations` | Schema, RLS, funções e valores padrão |
| `supabase/functions` | Edge Functions + `_shared/` (e-mail, WhatsApp, Pix, templates, validação) |
| `tests/db` | Testes do banco com PGlite |
| `tests/e2e` | Playwright + Supabase simulado |
| `brand/` | Logos SVG/PNG |

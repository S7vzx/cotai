# CLAUDE.md — Cotaí

Instruções permanentes para o Claude Code neste repositório. Leia este arquivo inteiro antes de qualquer tarefa.

## O que é o projeto

**Cotaí** é uma plataforma de cotação de produtos para clientes B2B. O cliente envia a foto do produto e um preço-alvo, a equipe cota com fornecedores, e o cliente recebe a cotação por e-mail e WhatsApp e aprova ou recusa pela web.

## Documentos de referência (fonte da verdade)

| Arquivo | Conteúdo |
|---|---|
| `docs/ESPECIFICACAO.md` | Especificação completa: telas, fluxos, banco, Edge Functions, regras e critérios de aceite |
| `docs/MARCA.md` | Identidade visual, cores, logo, tipografia e regras de uso |
| `docs/ROADMAP.md` | Fases de construção, com checklist. **Marque os itens conforme concluir** |
| `brand/` | Logos SVG/PNG finais. Não redesenhe o logo |
| `public/` | Favicon, ícones PWA e `site.webmanifest` já prontos |

Em caso de dúvida, a ordem de prioridade é: pedido do usuário no chat → `CLAUDE.md` → `docs/ESPECIFICACAO.md` → `docs/MARCA.md`. Se a especificação for ambígua, escolha a opção mais simples, siga em frente e registre a decisão em `docs/DECISOES.md`.

## Como trabalhar

1. Faça uma mudança por vez. Para algo grande, quebre em etapas e acrescente-as ao final do `docs/ROADMAP.md`.
2. Antes de mexer numa área, releia a seção correspondente da especificação e o código existente.
3. Ao terminar: rode `npm run check` (e `npm run test:e2e` se mexeu em telas); corrija tudo; faça um commit em português no formato `feat(area): descrição curta` ou `fix(area): ...`.
4. Diga ao usuário em poucas linhas o que foi feito e o que ele precisa configurar (secrets, contas), se houver.
5. Nunca deixe `TODO` silencioso: se algo ficou pendente, registre em `docs/PENDENCIAS.md`.

## Stack

- **Front-end:** React 19 + Vite 8 + TypeScript (strict) + Tailwind CSS 4 + componentes próprios em `src/components/ui` (Radix por baixo, estilo Apple)
- **Rotas:** React Router 7 (`createBrowserRouter`, páginas com lazy loading)
- **Dados:** TanStack Query v5 + cliente Supabase (`@supabase/supabase-js` v2)
- **Formulários:** React Hook Form + Zod (`@hookform/resolvers`)
- **Back-end:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions em Deno)
- **UI auxiliar:** lucide-react (ícones, `strokeWidth={1.75}`), sonner (toasts), @dnd-kit (kanban), Recharts (gráficos), Framer Motion (só onde a especificação pede), date-fns com `ptBR`
- **Testes:** Vitest (unidade), Vitest + PGlite (banco, RLS e regras) e Playwright (fluxos ponta a ponta)
- **Qualidade:** oxlint + Prettier (`.prettierrc`: sem ponto e vírgula, aspas simples, 140 colunas)

Não adicione outras bibliotecas sem necessidade clara. Se adicionar, justifique em `docs/DECISOES.md`.

## Estado atual

As fases 0 a 12 do `docs/ROADMAP.md` **já foram implementadas e testadas**. O trabalho daqui em diante é evoluir o produto: ajustes pedidos pelo cliente, integrações reais (WhatsApp, Pix) e os itens de `docs/PENDENCIAS.md`. Antes de mudar algo, leia o código existente da área e mantenha os padrões dele.

## Comandos

```bash
npm install
npx supabase start        # banco local (Docker); aplica migrações e seed
npm run functions:serve   # Edge Functions locais
npm run dev               # site em http://localhost:5173
npm run check             # tipos + lint + testes de unidade e de banco
npm run test:e2e          # Playwright com Supabase simulado
npm run functions:check   # tipos das Edge Functions (Deno)
```

- Login local: `admin@cotai.local` / `cotai12345`
- Os testes de banco (`tests/db`) rodam as migrações num Postgres em memória (PGlite): não precisam de Docker. **Toda mudança de schema deve vir com teste ali.**
- Os testes ponta a ponta usam `tests/e2e/mock-supabase.ts`. Ao criar uma tela ou consulta nova, adicione os dados em `tests/e2e/fixtures.ts`.
- Se o Playwright não conseguir baixar o navegador, aponte `CHROMIUM_PATH` para um Chromium instalado.
- Capturas de tela para revisão visual: `SCREENSHOTS=1 npm run test:e2e` (salvas em `screenshots/`).

## Estrutura de pastas

```
src/
  app/            # providers, router, layout raiz
  pages/          # uma pasta por área: public/, painel/, admin/
  components/
    ui/           # base: Button, Input/Field, Dialog (sheet no celular), Switch, Segmented, Group/Row...
    brand/        # Logo, Simbolo
    shared/       # StatusBadge, MoneyInput, PhoneInput, EmptyState, PageHeader...
  features/       # lógica por domínio: quotes/, purchases/, customers/, settings/, team/
    <dominio>/    # api.ts (queries/mutations), hooks.ts, schemas.ts, components/
  lib/            # supabase.ts, format.ts (moeda, datas, telefone), masks.ts, utils.ts
  types/          # database.ts (gerado), domain.ts
supabase/
  migrations/     # SQL versionado: schema, RLS, funções, triggers, seed estrutural
  functions/      # Edge Functions (uma pasta cada) + _shared/ (cors, whatsapp, email, templates)
  seed.sql        # dados iniciais (admin, settings, FAQ, unidades, templates)
tests/
  e2e/            # Playwright
docs/
brand/
public/
```

## Regras de banco e segurança (obrigatórias)

- **Todo schema vive em `supabase/migrations/`.** Nunca altere o banco "na mão". Uma migração por mudança lógica, com nome descritivo
- **RLS ligado em todas as tabelas**, com policies explícitas para cada papel (ver especificação, seção 11)
- O usuário anônimo **nunca** lê ou escreve tabelas diretamente: só via Edge Functions ou RPCs `security definer` que validam o `public_token`
- Campos internos (`cost_price`, `supplier_contact`, `internal_notes`, margens) **nunca** saem em rotas públicas
- Segredos (Resend, WhatsApp, gateway de pagamento) só em secrets do Supabase (`supabase secrets set`) e em `.env.local`, nunca no front-end, no banco ou no git. Mantenha o `.env.example` atualizado
- O valor da taxa de cotação **nunca** é calculado só no front: a fonte é a Edge Function `calculate-fee`
- **Nenhum valor de negócio fixo no código** (taxa, prazos, textos da landing, contatos). Tudo vem de `settings` e é editável no Painel de Administração
- Depois de mudar o schema, atualize `src/types/domain.ts` (ou rode `npm run db:types`) e corrija os erros de tipo
- Regras que existem nos dois lados (transições de status, preview da taxa) têm teste de paridade em `tests/db`: se mudar uma, mude a outra
- Assinaturas de tempo real sempre via `useRealtime()` (`src/lib/realtime.ts`), nunca `supabase.channel()` direto

## Regras de UI (resumo; detalhes em `docs/MARCA.md` e na seção 3 da especificação)

- Visual Apple/HIG: fundo `#FFFFFF`/`#F5F5F7`, texto `#1D1D1F`, **uma única cor de destaque** `#00A878` (verde Cotaí; `#00875F` para links e textos pequenos; `#2BC48F` no modo escuro)
- **Proibido fonte serifada** em qualquer lugar. Pilha: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Helvetica Neue", sans-serif`
- Proibido: gradientes chamativos, blobs/glow, emojis decorativos na interface, grade de cards com ícone em círculo colorido, sombras pesadas, textos clichê
- Configure as cores como tokens CSS (`--background`, `--foreground`, `--primary`...) no tema do shadcn, com modo escuro real
- Mobile primeiro: tudo precisa funcionar em 360 px. Alvos de toque com no mínimo 44 px
- Toda interface em português do Brasil. Moeda com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Todo carregamento tem skeleton, toda lista tem estado vazio, todo erro tem mensagem amigável
- Use `<Field label=...>` em volta de cada campo: ele liga o rótulo ao input automaticamente (acessibilidade e testes)
- Nenhuma página pode ter rolagem horizontal no celular (há teste para isso). Em grids, use `grid-cols-1` e `min-w-0` nas colunas

## Convenções de código

- Componentes em PascalCase, hooks `useAlgo`, arquivos de feature em kebab-case
- Nomes de tabelas/colunas em inglês snake_case (como na especificação); textos de interface em português
- Sem `any`. Tipos do banco vêm de `src/types/database.ts`
- Queries e mutations sempre via hooks em `features/<dominio>/`, nunca chamadas soltas ao Supabase dentro de componentes de página
- Validações Zod compartilhadas entre formulário e Edge Function quando possível (`supabase/functions/_shared/schemas.ts`)

## Testes mínimos por mudança

- Funções puras (cálculo de taxa, formatação, máscaras, transições de status): testes Vitest
- Policies de RLS: testes SQL ou scripts que provem que anon/cotador/comprador **não** acessam o que não devem
- Fluxos críticos em Playwright: enviar pedido pelo celular (viewport 390×844), cotar e enviar, aprovar pela página pública, alterar a taxa no admin e ver refletir no formulário

## Git

- Commits pequenos, em português, um por fase ou subfase
- Nunca commitar `.env*` (exceto `.env.example`), `node_modules`, `supabase/.temp`
- Antes de commitar: `npm run typecheck && npm run lint && npm run test`

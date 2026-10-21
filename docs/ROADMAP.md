# Roadmap de construção — Cotaí

Marque `[x]` ao concluir cada item. Uma fase só termina quando typecheck, lint e testes passam.

> **Status (20/10/2026):** fases 0 a 12 implementadas e testadas. O que depende de contas reais (Resend, WhatsApp, Asaas/Mercado Pago) está pronto no código, mas precisa ser validado com as credenciais do cliente. Veja `docs/PENDENCIAS.md`.
Os números entre parênteses apontam para as seções de `docs/ESPECIFICACAO.md`.

## Fase 0 — Fundação
- [x] Projeto Vite + React + TS criado; Tailwind e shadcn configurados
- [x] Tokens de cor (claro/escuro) e tipografia sem serifa aplicados ao tema (3, `docs/MARCA.md`)
- [x] Componentes `<Logo />` e `<Simbolo />` a partir de `brand/svg/`; `<head>` com favicon, manifest e Open Graph
- [x] oxlint, Prettier, Vitest e Playwright configurados; scripts do `CLAUDE.md` no `package.json`
- [x] `supabase init`, `.env.example` e cliente Supabase em `src/lib/supabase.ts`
- [x] Componentes base: `StatusBadge`, `MoneyInput`, `PhoneInput`, `CnpjInput`, `EmptyState`, `PageHeader`, skeletons
- [x] Utilitários `format.ts` (moeda, data, telefone E.164) com testes

## Fase 1 — Banco de dados e segurança (11)
- [x] Migrações de todas as tabelas, enums, sequence do código `COT-000000`, triggers de `updated_at`
- [x] Funções `has_role()` e `can()`; tabela `role_permissions` com a matriz padrão
- [x] RLS em todas as tabelas; view `public_settings`; RPCs públicas por `public_token`
- [x] Trigger de `status_history` e de `audit_log` (alterações em configurações)
- [x] Buckets `product-photos` (privado), `purchase-attachments` (privado), `branding` (público) com policies
- [x] `seed.sql`: admin inicial, `settings` com **cobrança desativada**, textos da landing, FAQ, unidades, templates
- [x] Tipos gerados em `src/types/database.ts`
- [x] Testes provando que `anon` não lê tabelas e que `comprador` não vê custos

## Fase 2 — Landing page (5)
- [x] Todas as seções, com textos lidos de `public_settings` e `faq_items`
- [x] Passos de pagamento e valor da taxa só aparecem se a cobrança estiver ativa
- [x] Responsiva em 360 px; SEO e Open Graph

## Fase 3 — Formulário de pedido (7) e Edge Functions públicas (12)
- [x] Stepper de 3 etapas; vários produtos; upload com compressão e câmera no celular
- [x] Campos ocultos/opcionais/obrigatórios conforme `form_fields_config`
- [x] Edge Functions `get-upload-url`, `calculate-fee` (com testes), `create-quote-request` (honeypot + rate limit)
- [x] Cupom de desconto e cliente isento
- [x] Tela de sucesso e página de acompanhamento `/pedido/:codigo` (8)

## Fase 4 — Autenticação e layout do painel (10.1, 10.2)
- [x] Login, recuperação de senha, rotas protegidas por papel
- [x] Sidebar estilo macOS, topbar translúcida, busca global, drawer no mobile, alternância de tema
- [x] Assistente de primeiro acesso do admin (Empresa → Cobrança → Contato)

## Fase 5 — Kanban e detalhe da cotação (10.4, 10.5)
- [x] Kanban com arrastar e soltar, validação de transições, filtros, visão lista e Realtime
- [x] Detalhe: galeria com zoom, assumir tarefa, opções A/B/C, margem e alerta de margem mínima
- [x] Confirmação manual de pagamento; comentários com @menção; histórico

## Fase 6 — Página pública da cotação (9)
- [x] Proposta com comparação alvo × encontrado, escolha de opção, total, desconto da taxa se configurado
- [x] Aprovar/recusar via Edge Function `public-quote`, criando `purchase_tasks`
- [x] Expiração pela validade; impressão/PDF

## Fase 7 — Notificações (12, 13)
- [x] `_shared/email.ts` (Resend) e `_shared/whatsapp.ts` (Z-API, Evolution, Meta, ou fallback wa.me)
- [x] Templates com variáveis lidos de `settings`; `send-quote`, `send-test-notification`
- [x] `notifications_log` e reenvio das falhas

## Fase 8 — Pagamento (7, 12)
- [x] Pix manual (chave + confirmação no painel)
- [x] `create-pix-charge` e `payment-webhook` (Asaas ou Mercado Pago) em sandbox
- [x] `expire-unpaid` agendada (cancelamento e lembretes)

## Fase 9 — Compras e clientes (10.6, 10.7)
- [x] Kanban de compras com anexos e rastreio; aviso opcional ao cliente
- [x] Lista e detalhe de clientes com histórico

## Fase 10 — Dashboard (10.3)
- [x] Cards, gráfico de 30 dias, atrasados por SLA, "minhas tarefas"; receita só para quem tem permissão

## Fase 11 — Painel de Administração (10.9)
- [x] Layout estilo Ajustes, salvar com detecção de alterações, aviso ao sair, auditoria
- [x] Empresa e marca · Cobrança (modelos, cupons, isentos, preview) · Regras de cotação
- [x] Landing · Mensagens (editor + preview + variáveis) · Integrações (status dos secrets + testes)
- [x] Equipe (convites + matriz de permissões; proteção do último admin) · Categorias e unidades · Fornecedores · Logs com CSV

## Fase 12 — Acabamento e entrega
- [x] Todos os critérios de aceite da seção 16 verificados (de preferência com Playwright)
- [x] Revisão de acessibilidade, estados vazios/erro e modo escuro em todas as telas
- [x] Auditoria final: nenhum valor de negócio fixo no código, nenhum segredo no front
- [x] `README.md` atualizado com deploy (Supabase + Vercel/Netlify) e lista de secrets

## Próximas etapas (pós-entrega)
- [ ] Configurar Supabase de produção, secrets e domínio (README → Publicar em produção)
- [ ] Validar e-mail (Resend) com domínio verificado
- [ ] Escolher e validar o provedor de WhatsApp com o número do cliente
- [ ] Validar o Pix automático em sandbox e depois em produção
- [ ] Rodar os testes ponta a ponta contra um Supabase local real (`npx supabase start`) uma vez
- [x] Portal do cliente: login por código em `/login`, lista em `/minhas-cotacoes`; equipe entra por `/admin`
- [x] Hero refeito (celular em modo câmera, cartão do produto, ícone do app, notificação com ícone do WhatsApp)
- [ ] Publicar as Edge Functions no projeto de produção (`supabase functions deploy --use-api`)
- [ ] Configurar no Supabase: modelos de e-mail com `{{ .Token }}`, Redirect URLs, SMTP do Resend

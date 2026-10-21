# Decisões

Decisões tomadas onde a especificação deixava espaço, com o motivo.

| Data | Decisão | Motivo |
|---|---|---|
| 20/10/2026 | Cobrança começa **desativada**; nenhum valor fixo no código | O valor (R$ 50) era só exemplo do cliente. O admin define tudo no assistente de primeiro acesso |
| 20/10/2026 | O **primeiro usuário** criado vira administrador; cadastro público desligado | Permite configurar sem SQL manual e impede que estranhos criem conta |
| 20/10/2026 | `calculate_fee`, `create_quote_request`, `respond_quote` e as regras de status ficam **no banco** (PL/pgSQL) | Fonte única da verdade, testável sem Docker (PGlite) e impossível de burlar pelo front |
| 20/10/2026 | Páginas públicas falam só com **Edge Functions** (nunca com tabelas) | Os RPCs públicos ficam restritos ao service_role; o token do pedido é validado no servidor, e as fotos privadas saem com URL assinada |
| 20/10/2026 | Comprador não lê `quote_options`; usa `quote_options_for_staff()` e `purchase_board()` | Custo e contato do fornecedor só aparecem para quem tem a permissão "ver custo e margem" |
| 20/10/2026 | Arrastar no kanban não envia nem aprova | Enviar ao cliente e aprovar têm efeitos (mensagens, tarefas de compra); por isso exigem a ação explícita |
| 20/10/2026 | Sem provedor de WhatsApp, o painel oferece "Enviar pelo meu WhatsApp" (link wa.me com a mensagem pronta) | O sistema funciona desde o primeiro dia, antes de contratar a API |
| 20/10/2026 | Texto branco no botão verde (#00A878) usa **19 px bold** | Contraste 3:1 só passa no WCAG AA como texto grande. Links e textos pequenos em verde usam #00875F |
| 20/10/2026 | Logo principal = nome; símbolo "ć" sozinho. Nunca os dois juntos | Lado a lado vira "ć cotaí", com o "c" repetido |
| 20/10/2026 | Componentes de UI próprios (Radix + Tailwind) em vez do CLI do shadcn | Controle total do visual Apple e sem dependência do registro do shadcn |
| 20/10/2026 | oxlint em vez de ESLint | Já vem no template do Vite 8, é muito mais rápido e não precisa de configuração |
| 20/10/2026 | Testes ponta a ponta com Supabase **simulado** | Rodam em qualquer máquina e no CI sem Docker; o banco real é coberto pelos testes de `tests/db` |
| 20/10/2026 | Portal do cliente em `/login` → `/minhas-cotacoes`, com **código por e-mail** (Supabase Auth OTP); equipe entra por `/admin`, sem link no site; o painel continua em `/painel` | Pedido do cliente. Sem senha para o comprador lembrar; a lista usa o RPC `my_quote_requests()`, que só devolve pedidos do e-mail **confirmado** e só campos públicos |
| 20/10/2026 | O perfil da equipe não nasce mais do `user_metadata`: só o primeiro usuário vira admin pelo gatilho; convidados ganham o perfil na Edge Function `invite-user` | Com o login do cliente o cadastro no Auth fica aberto, e o `user_metadata` é escolhido pelo próprio usuário |
| 20/10/2026 | Textos, prazo e perguntas da landing **fixos no código** (`src/pages/public/landing-content.ts`), exceção temporária à regra de "nada fixo"; a taxa continua vindo do banco | Pedido do cliente: a página inicial ficava em skeleton esperando `get_public_settings`. A tela Ajustes → Landing passa a valer só para SEO e imagem de compartilhamento |
| 20/10/2026 | CPF ou CNPJ **obrigatório** em todo pedido, guardado na coluna `customers.cnpj` (formatado) | Pedido do cliente. Renomear a coluna mexeria em muitas telas sem ganho; o campo saiu de Regras de cotação porque deixou de ser configurável. O Asaas aceita os dois no mesmo campo (`cpfCnpj`) |

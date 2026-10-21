# Pendências

O que ainda não foi verificado ou depende de algo externo.

## Precisa de contas ou credenciais do cliente
- **Resend:** o código de envio está pronto e com tipos checados, mas não foi testado contra a API real. Precisa de um domínio verificado.
- **WhatsApp (Z-API, Evolution ou Meta):** os três adaptadores seguem a documentação pública de cada provedor, mas nenhum foi testado com um número real. Valide com o botão **Enviar teste** em Ajustes → Integrações.
- **Pix automático (Asaas e Mercado Pago):** criação de cobrança e webhook implementados conforme a documentação, mas não testados em sandbox. No Asaas de produção, o cliente pode precisar informar CNPJ ou CPF; deixe o CNPJ como obrigatório em Regras de cotação se for o caso.

## Não executado neste ambiente
- **`deno check`** das Edge Functions: o Deno não está instalado nesta máquina; a `invite-user` foi alterada no portal do cliente sem checagem de tipos do Deno.
- **Produção (`Cotai`, ref `tuswxtkyicllszlxrmqt`), situação em 20/10/2026:** migrações 1 a 7 aplicadas e as 13 Edge Functions publicadas (conferido: `calculate-fee` responde lendo `settings`). **Faltam os secrets** (só existem os padrões do Supabase): `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` e os do WhatsApp/Pix quando forem escolhidos. Numa rede só IPv4, o `db push` usa o pooler: `--db-url "postgresql://postgres.tuswxtkyicllszlxrmqt:SENHA@aws-1-us-west-2.pooler.supabase.com:5432/postgres"`. Não rode o `seed.sql` lá: crie o primeiro usuário em Authentication → Add user (ele vira administrador).
- **Supabase local completo** (`supabase start`): não havia Docker disponível. As migrações foram validadas num Postgres em memória (PGlite) com 35 testes de banco, mas vale rodar uma vez no Supabase real (Auth, Storage e Realtime de verdade).
- **Edge Functions em execução:** os tipos foram checados com `deno check`, e a validação, os templates e o cálculo da taxa têm testes. A execução ponta a ponta das funções contra o Supabase real ainda não foi feita.
- **`supabase/seed.sql`:** o usuário de desenvolvimento é criado direto em `auth.users`. Se a versão do Supabase local mudar o formato dessa tabela, crie o usuário pelo Studio. Ele depende das migrações: rodá-lo sozinho no editor SQL dá `relation "public.categories" does not exist`.

## Portal do cliente (precisa configurar no Supabase)
- Em **Authentication → Emails**, inclua o código `{{ .Token }}` nos modelos **Magic Link** e **Confirm signup** (o padrão só traz o link; os dois funcionam).
- **SMTP de produção (20/10/2026):** provisório pelo Gmail (`smtp.gmail.com`, porta 465, senha de app); envio do código de login testado e entregue. Limite de ~500 e-mails/dia e remetente `@gmail.com`. Quando houver domínio próprio, troque pelo Resend (`smtp.resend.com`, porta 465, usuário `resend`, senha = API key).
- **E-mail das cotações:** as Edge Functions enviam pela API do Resend, que exige domínio verificado. Até lá, a cotação chega só pelo WhatsApp e pelo link público. Faltam os secrets `RESEND_API_KEY`, `EMAIL_FROM` e `SITE_URL`.
- Mantenha **Confirm email** ligado em Authentication → Providers → Email: o portal só mostra pedidos de e-mails confirmados.

## Decisões temporárias para desfazer
- **Landing com textos fixos** (`src/pages/public/landing-content.ts`): para voltar a editar pelo painel sem a página esperar o banco, use os textos fixos como valor inicial e troque pelos do banco quando chegarem (sem skeleton).

## Melhorias possíveis (fora do escopo pedido)
- Notificar por e-mail o usuário mencionado em comentários (hoje a menção destaca o comentário para ele no painel)
- Exportar a cotação em PDF no servidor (hoje é pelo "Imprimir / Salvar PDF" do navegador)

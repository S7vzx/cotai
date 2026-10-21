# Pendências

O que ainda não foi verificado ou depende de algo externo.

## Precisa de contas ou credenciais do cliente
- **Resend:** o código de envio está pronto e com tipos checados, mas não foi testado contra a API real. Precisa de um domínio verificado.
- **WhatsApp (Z-API, Evolution ou Meta):** os três adaptadores seguem a documentação pública de cada provedor, mas nenhum foi testado com um número real. Valide com o botão **Enviar teste** em Ajustes → Integrações.
- **Pix automático (Asaas e Mercado Pago):** criação de cobrança e webhook implementados conforme a documentação, mas não testados em sandbox. No Asaas de produção, o cliente pode precisar informar CNPJ ou CPF; deixe o CNPJ como obrigatório em Regras de cotação se for o caso.

## Não executado neste ambiente
- **Migrações no projeto Supabase de produção** (`Cotai`, ref `tuswxtkyicllszlxrmqt`): o projeto já está ligado (`supabase link`), mas o `db push` ainda não rodou. O host direto do banco só funciona por IPv6; numa rede só IPv4, use o pooler: `npx supabase db push --db-url "postgresql://postgres.tuswxtkyicllszlxrmqt:SENHA@aws-1-us-west-2.pooler.supabase.com:5432/postgres"`. Não rode o `seed.sql` lá: crie o primeiro usuário em Authentication → Add user (ele vira administrador).
- **Supabase local completo** (`supabase start`): não havia Docker disponível. As migrações foram validadas num Postgres em memória (PGlite) com 35 testes de banco, mas vale rodar uma vez no Supabase real (Auth, Storage e Realtime de verdade).
- **Edge Functions em execução:** os tipos foram checados com `deno check`, e a validação, os templates e o cálculo da taxa têm testes. A execução ponta a ponta das funções contra o Supabase real ainda não foi feita.
- **`supabase/seed.sql`:** o usuário de desenvolvimento é criado direto em `auth.users`. Se a versão do Supabase local mudar o formato dessa tabela, crie o usuário pelo Studio. Ele depende das migrações: rodá-lo sozinho no editor SQL dá `relation "public.categories" does not exist`.

## Portal do cliente (precisa configurar no Supabase)
- Em **Authentication → Email Templates → Magic Link**, inclua o código `{{ .Token }}` no texto (o padrão só traz o link; os dois funcionam).
- O e-mail padrão do Supabase tem limite baixo por hora: configure SMTP próprio (Resend) em **Authentication → SMTP Settings** antes de divulgar.
- Mantenha **Confirm email** ligado em Authentication → Providers → Email: o portal só mostra pedidos de e-mails confirmados.

## Melhorias possíveis (fora do escopo pedido)
- Notificar por e-mail o usuário mencionado em comentários (hoje a menção destaca o comentário para ele no painel)
- Exportar a cotação em PDF no servidor (hoje é pelo "Imprimir / Salvar PDF" do navegador)

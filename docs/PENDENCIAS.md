# Pendências

O que ainda não foi verificado ou depende de algo externo.

## Precisa de contas ou credenciais do cliente
- **Resend:** o código de envio está pronto e com tipos checados, mas não foi testado contra a API real. Precisa de um domínio verificado.
- **WhatsApp (Z-API, Evolution ou Meta):** os três adaptadores seguem a documentação pública de cada provedor, mas nenhum foi testado com um número real. Valide com o botão **Enviar teste** em Ajustes → Integrações.
- **Pix automático (Asaas e Mercado Pago):** criação de cobrança e webhook implementados conforme a documentação, mas não testados em sandbox. No Asaas de produção, o cliente pode precisar informar CNPJ ou CPF; deixe o CNPJ como obrigatório em Regras de cotação se for o caso.

## Não executado neste ambiente
- **`deno check`** das Edge Functions: o Deno não está instalado nesta máquina; a `invite-user` foi alterada no portal do cliente sem checagem de tipos do Deno.
- **Produção (`Cotai`, ref `tuswxtkyicllszlxrmqt`), situação em 20/10/2026:** o usuário recebeu um SQL único com as migrações 1 a 6 para colar no SQL Editor (confirmar se rodou). A migração `20261020000007_customer_portal.sql` ainda precisa ser aplicada lá. **Nenhuma Edge Function está publicada** (por isso o formulário dava "Failed to send a request to the Edge Function"): rodar `npx supabase functions deploy --use-api --project-ref tuswxtkyicllszlxrmqt`. Numa rede só IPv4, o `db push` usa o pooler: `--db-url "postgresql://postgres.tuswxtkyicllszlxrmqt:SENHA@aws-1-us-west-2.pooler.supabase.com:5432/postgres"`. Não rode o `seed.sql` lá: crie o primeiro usuário em Authentication → Add user (ele vira administrador).
- **Supabase local completo** (`supabase start`): não havia Docker disponível. As migrações foram validadas num Postgres em memória (PGlite) com 35 testes de banco, mas vale rodar uma vez no Supabase real (Auth, Storage e Realtime de verdade).
- **Edge Functions em execução:** os tipos foram checados com `deno check`, e a validação, os templates e o cálculo da taxa têm testes. A execução ponta a ponta das funções contra o Supabase real ainda não foi feita.
- **`supabase/seed.sql`:** o usuário de desenvolvimento é criado direto em `auth.users`. Se a versão do Supabase local mudar o formato dessa tabela, crie o usuário pelo Studio. Ele depende das migrações: rodá-lo sozinho no editor SQL dá `relation "public.categories" does not exist`.

## Portal do cliente (precisa configurar no Supabase)
- Em **Authentication → Emails**, inclua o código `{{ .Token }}` nos modelos **Magic Link** e **Confirm signup** (o padrão só traz o link; os dois funcionam).
- O e-mail padrão do Supabase só entrega para membros da organização e tem limite baixo por hora: configure SMTP próprio (Resend: `smtp.resend.com`, porta 465, usuário `resend`, senha = API key) antes de divulgar.
- Mantenha **Confirm email** ligado em Authentication → Providers → Email: o portal só mostra pedidos de e-mails confirmados.

## Melhorias possíveis (fora do escopo pedido)
- Notificar por e-mail o usuário mencionado em comentários (hoje a menção destaca o comentário para ele no painel)
- Exportar a cotação em PDF no servidor (hoje é pelo "Imprimir / Salvar PDF" do navegador)

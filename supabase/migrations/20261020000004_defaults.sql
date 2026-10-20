-- =====================================================================
-- Cotaí — valores padrão (necessários também em produção)
-- A cobrança começa DESATIVADA: o admin define tudo no primeiro acesso.
-- =====================================================================

insert into public.role_permissions (role, permission, allowed) values
  ('cotador', 'view_revenue', false),
  ('cotador', 'view_costs', true),
  ('cotador', 'confirm_payment', true),
  ('cotador', 'send_quote', true),
  ('cotador', 'delete_request', false),
  ('cotador', 'manage_purchases', true),
  ('cotador', 'manage_customers', true),
  ('comprador', 'view_revenue', false),
  ('comprador', 'view_costs', false),
  ('comprador', 'confirm_payment', false),
  ('comprador', 'send_quote', false),
  ('comprador', 'delete_request', false),
  ('comprador', 'manage_purchases', true),
  ('comprador', 'manage_customers', false)
on conflict do nothing;

insert into public.units (code, label, position) values
  ('un', 'Unidade', 0), ('cx', 'Caixa', 1), ('pct', 'Pacote', 2), ('kg', 'Quilo', 3),
  ('m', 'Metro', 4), ('par', 'Par', 5), ('l', 'Litro', 6)
on conflict do nothing;

insert into public.faq_items (question, answer, position) values
  ('O que está incluso na taxa de cotação?',
   'A pesquisa com fornecedores para cada produto do pedido e uma proposta com preço, prazo e condições. Se você aprovar a compra, a taxa pode ser abatida do total, conforme as condições informadas no pedido.', 0),
  ('Em quanto tempo recebo a cotação?',
   'Normalmente dentro do prazo informado no formulário. Você acompanha cada etapa pelo link que enviamos no WhatsApp e no e-mail.', 1),
  ('E se não encontrarem pelo meu preço?',
   'Avisamos você com as melhores alternativas encontradas, ou informamos que não foi possível atender ao preço-alvo.', 2),
  ('Posso cotar vários produtos?',
   'Sim. Adicione quantos produtos precisar no mesmo pedido, cada um com suas fotos e seu preço-alvo.', 3),
  ('Como recebo a cotação?',
   'Por WhatsApp e por e-mail, com um link para ver os detalhes e aprovar a compra em poucos toques.', 4);

insert into public.settings (
  id, display_name, eta_text, terms_text, form_fields_config, landing_content,
  seo_title, seo_description, email_templates, whatsapp_templates, notification_toggles,
  reminders_config, fee_tiers
) values (
  true,
  'Cotaí',
  'em até 48 horas úteis',
  E'Ao enviar o pedido, você autoriza o contato por WhatsApp e e-mail sobre esta cotação.\n\nOs preços cotados dependem da disponibilidade dos fornecedores e valem até a data de validade informada na proposta.\n\nA taxa de cotação, quando houver, remunera o trabalho de pesquisa e não é reembolsável depois que a cotação for enviada.',
  '{"cnpj": "opcional", "reference_url": "opcional", "unit": "opcional", "notes": "opcional", "category": "oculto"}',
  '{
    "hero": {
      "title": "Mande a foto. A gente acha o preço.",
      "subtitle": "Você diz quanto quer pagar, nossa equipe pesquisa os fornecedores e te responde no WhatsApp.",
      "cta_primary": "Solicitar cotação",
      "cta_secondary": "Como funciona"
    },
    "steps": [
      {"title": "Envie a foto e o preço-alvo", "text": "Tire uma foto do produto, diga a quantidade e quanto quer pagar por unidade.", "active": true, "payment": false},
      {"title": "Pague a taxa de cotação", "text": "Pix na hora. Assim que confirmamos, seu pedido entra na fila.", "active": true, "payment": true},
      {"title": "A gente pesquisa", "text": "Nossa equipe procura o produto na nossa rede de fornecedores.", "active": true, "payment": false},
      {"title": "Receba e aprove", "text": "A cotação chega no WhatsApp e no e-mail. Você aprova com um toque.", "active": true, "payment": false}
    ],
    "benefits": [
      {"title": "Menos tempo procurando", "text": "Você manda uma foto e volta ao seu trabalho. A pesquisa fica com a gente."},
      {"title": "Rede de fornecedores", "text": "Comparamos opções que você dificilmente acharia sozinho."},
      {"title": "Resposta rápida", "text": "Prazo claro desde o primeiro minuto, com acompanhamento em tempo real."},
      {"title": "Tudo registrado", "text": "Pedidos, propostas e aprovações organizados em um só lugar."}
    ],
    "cta_final": {
      "title": "Tem um produto em mente?",
      "text": "Mande a foto agora e receba a cotação no seu WhatsApp.",
      "button": "Solicitar cotação"
    }
  }',
  'Cotaí — cotação de produtos para empresas',
  'Envie a foto do produto e o preço que quer pagar. A gente pesquisa os fornecedores e te responde no WhatsApp.',
  '{
    "pedido_recebido": {"subject": "Recebemos seu pedido {{codigo}}", "body": "Olá, {{nome}}!\n\nRecebemos seu pedido de cotação {{codigo}}. Nossa equipe já vai começar a pesquisar. Prazo: {{prazo}}.\n\nAcompanhe por aqui: {{link}}"},
    "pagamento_confirmado": {"subject": "Pagamento confirmado: {{codigo}}", "body": "Olá, {{nome}}!\n\nConfirmamos o pagamento da taxa de cotação do pedido {{codigo}}. Ele já está na fila da nossa equipe.\n\nAcompanhe por aqui: {{link}}"},
    "cotacao_pronta": {"subject": "Sua cotação {{codigo}} está pronta", "body": "Olá, {{nome}}!\n\nSua cotação {{codigo}} está pronta.\nTotal: {{total}}\nVálida até {{validade}}.\n\n{{mensagem}}\n\nVeja os detalhes e aprove por aqui: {{link}}"},
    "nao_encontrado": {"subject": "Sobre o pedido {{codigo}}", "body": "Olá, {{nome}}.\n\nInfelizmente não encontramos o produto do pedido {{codigo}} pelo preço-alvo informado.\n\n{{mensagem}}\n\nQualquer dúvida, é só responder este e-mail."},
    "aprovacao_recebida": {"subject": "Recebemos sua aprovação: {{codigo}}", "body": "Olá, {{nome}}!\n\nRecebemos a aprovação da cotação {{codigo}}. Em breve entraremos em contato para combinar a compra."},
    "lembrete_pagamento": {"subject": "Seu pedido {{codigo}} aguarda pagamento", "body": "Olá, {{nome}}!\n\nSeu pedido {{codigo}} ainda aguarda o pagamento da taxa de cotação ({{taxa}}).\n\nPague por aqui: {{link}}"},
    "lembrete_resposta": {"subject": "Sua cotação {{codigo}} aguarda resposta", "body": "Olá, {{nome}}!\n\nSua cotação {{codigo}} está esperando sua resposta e vale até {{validade}}.\n\nVeja por aqui: {{link}}"},
    "compra_atualizada": {"subject": "Atualização da compra {{codigo}}", "body": "Olá, {{nome}}!\n\n{{mensagem}}\n\nPedido: {{codigo}}"},
    "interno_novo_pedido": {"subject": "Novo pedido {{codigo}} de {{empresa}}", "body": "Novo pedido de cotação {{codigo}}.\nCliente: {{nome}} ({{empresa}})\n\nAbrir no painel: {{link}}"},
    "interno_aprovada": {"subject": "Cotação {{codigo}} aprovada", "body": "{{nome}} ({{empresa}}) aprovou a cotação {{codigo}}. Total: {{total}}.\n\nAbrir no painel: {{link}}"},
    "interno_recusada": {"subject": "Cotação {{codigo}} recusada", "body": "{{nome}} ({{empresa}}) recusou a cotação {{codigo}}.\nMotivo: {{mensagem}}\n\nAbrir no painel: {{link}}"}
  }',
  '{
    "pedido_recebido": "Olá, {{nome}}!\nRecebemos seu pedido de cotação *{{codigo}}*.\nNossa equipe já vai começar a pesquisar. Prazo: {{prazo}}.\nAcompanhe aqui: {{link}}",
    "pagamento_confirmado": "Olá, {{nome}}! Pagamento do pedido *{{codigo}}* confirmado. Ele já está na fila da nossa equipe.\nAcompanhe aqui: {{link}}",
    "cotacao_pronta": "Olá, {{nome}}! Sua cotação *{{codigo}}* está pronta.\nTotal: *{{total}}*\nVálida até {{validade}}.\nVeja os detalhes e aprove por aqui: {{link}}",
    "nao_encontrado": "Olá, {{nome}}. Sobre o pedido *{{codigo}}*: infelizmente não encontramos o produto pelo preço-alvo informado.\n{{mensagem}}\nQualquer dúvida, é só responder esta mensagem.",
    "aprovacao_recebida": "Olá, {{nome}}! Recebemos a aprovação da cotação *{{codigo}}*. Em breve entraremos em contato para combinar a compra.",
    "lembrete_pagamento": "Olá, {{nome}}! Seu pedido *{{codigo}}* ainda aguarda o pagamento da taxa ({{taxa}}).\nPague por aqui: {{link}}",
    "lembrete_resposta": "Olá, {{nome}}! Sua cotação *{{codigo}}* aguarda sua resposta e vale até {{validade}}.\n{{link}}",
    "compra_atualizada": "Olá, {{nome}}! {{mensagem}}\nPedido *{{codigo}}*."
  }',
  '{
    "pedido_recebido": {"email": true, "whatsapp": true},
    "pagamento_confirmado": {"email": true, "whatsapp": true},
    "cotacao_pronta": {"email": true, "whatsapp": true},
    "nao_encontrado": {"email": true, "whatsapp": true},
    "aprovacao_recebida": {"email": true, "whatsapp": true},
    "lembrete_pagamento": {"email": true, "whatsapp": true},
    "lembrete_resposta": {"email": true, "whatsapp": false},
    "compra_atualizada": {"email": false, "whatsapp": true},
    "interno_novo_pedido": {"email": true, "whatsapp": false},
    "interno_aprovada": {"email": true, "whatsapp": false},
    "interno_recusada": {"email": true, "whatsapp": false}
  }',
  '{"payment_reminder_enabled": true, "payment_reminder_hours": 12, "response_reminder_enabled": true, "response_reminder_days": 2}',
  '[{"from": 1, "to": 3, "amount": 0}, {"from": 4, "to": 10, "amount": 0}, {"from": 11, "to": null, "amount": 0}]'
) on conflict (id) do nothing;

-- O seed acima não deve gerar entradas de auditoria (não há usuário).
delete from public.audit_log;

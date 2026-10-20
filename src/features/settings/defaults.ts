// Textos padrão das mensagens (iguais a supabase/migrations/20261020000004_defaults.sql).
// Usados pelo botão "Restaurar padrão" em Administração → Mensagens.
import type { NotificationEvent } from '@/types/domain'

export const DEFAULT_EMAIL_TEMPLATES: Record<NotificationEvent, { subject: string; body: string }> = {
  pedido_recebido: {
    subject: 'Recebemos seu pedido {{codigo}}',
    body: 'Olá, {{nome}}!\n\nRecebemos seu pedido de cotação {{codigo}}. Nossa equipe já vai começar a pesquisar. Prazo: {{prazo}}.\n\nAcompanhe por aqui: {{link}}',
  },
  pagamento_confirmado: {
    subject: 'Pagamento confirmado: {{codigo}}',
    body: 'Olá, {{nome}}!\n\nConfirmamos o pagamento da taxa de cotação do pedido {{codigo}}. Ele já está na fila da nossa equipe.\n\nAcompanhe por aqui: {{link}}',
  },
  cotacao_pronta: {
    subject: 'Sua cotação {{codigo}} está pronta',
    body: 'Olá, {{nome}}!\n\nSua cotação {{codigo}} está pronta.\nTotal: {{total}}\nVálida até {{validade}}.\n\n{{mensagem}}\n\nVeja os detalhes e aprove por aqui: {{link}}',
  },
  nao_encontrado: {
    subject: 'Sobre o pedido {{codigo}}',
    body: 'Olá, {{nome}}.\n\nInfelizmente não encontramos o produto do pedido {{codigo}} pelo preço-alvo informado.\n\n{{mensagem}}\n\nQualquer dúvida, é só responder este e-mail.',
  },
  aprovacao_recebida: {
    subject: 'Recebemos sua aprovação: {{codigo}}',
    body: 'Olá, {{nome}}!\n\nRecebemos a aprovação da cotação {{codigo}}. Em breve entraremos em contato para combinar a compra.',
  },
  lembrete_pagamento: {
    subject: 'Seu pedido {{codigo}} aguarda pagamento',
    body: 'Olá, {{nome}}!\n\nSeu pedido {{codigo}} ainda aguarda o pagamento da taxa de cotação ({{taxa}}).\n\nPague por aqui: {{link}}',
  },
  lembrete_resposta: {
    subject: 'Sua cotação {{codigo}} aguarda resposta',
    body: 'Olá, {{nome}}!\n\nSua cotação {{codigo}} está esperando sua resposta e vale até {{validade}}.\n\nVeja por aqui: {{link}}',
  },
  compra_atualizada: {
    subject: 'Atualização da compra {{codigo}}',
    body: 'Olá, {{nome}}!\n\n{{mensagem}}\n\nPedido: {{codigo}}',
  },
  interno_novo_pedido: {
    subject: 'Novo pedido {{codigo}} de {{empresa}}',
    body: 'Novo pedido de cotação {{codigo}}.\nCliente: {{nome}} ({{empresa}})\n\nAbrir no painel: {{link}}',
  },
  interno_aprovada: {
    subject: 'Cotação {{codigo}} aprovada',
    body: '{{nome}} ({{empresa}}) aprovou a cotação {{codigo}}. Total: {{total}}.\n\nAbrir no painel: {{link}}',
  },
  interno_recusada: {
    subject: 'Cotação {{codigo}} recusada',
    body: '{{nome}} ({{empresa}}) recusou a cotação {{codigo}}.\nMotivo: {{mensagem}}\n\nAbrir no painel: {{link}}',
  },
}

export const DEFAULT_WHATSAPP_TEMPLATES: Partial<Record<NotificationEvent, string>> = {
  pedido_recebido:
    'Olá, {{nome}}!\nRecebemos seu pedido de cotação *{{codigo}}*.\nNossa equipe já vai começar a pesquisar. Prazo: {{prazo}}.\nAcompanhe aqui: {{link}}',
  pagamento_confirmado:
    'Olá, {{nome}}! Pagamento do pedido *{{codigo}}* confirmado. Ele já está na fila da nossa equipe.\nAcompanhe aqui: {{link}}',
  cotacao_pronta:
    'Olá, {{nome}}! Sua cotação *{{codigo}}* está pronta.\nTotal: *{{total}}*\nVálida até {{validade}}.\nVeja os detalhes e aprove por aqui: {{link}}',
  nao_encontrado:
    'Olá, {{nome}}. Sobre o pedido *{{codigo}}*: infelizmente não encontramos o produto pelo preço-alvo informado.\n{{mensagem}}\nQualquer dúvida, é só responder esta mensagem.',
  aprovacao_recebida:
    'Olá, {{nome}}! Recebemos a aprovação da cotação *{{codigo}}*. Em breve entraremos em contato para combinar a compra.',
  lembrete_pagamento: 'Olá, {{nome}}! Seu pedido *{{codigo}}* ainda aguarda o pagamento da taxa ({{taxa}}).\nPague por aqui: {{link}}',
  lembrete_resposta: 'Olá, {{nome}}! Sua cotação *{{codigo}}* aguarda sua resposta e vale até {{validade}}.\n{{link}}',
  compra_atualizada: 'Olá, {{nome}}! {{mensagem}}\nPedido *{{codigo}}*.',
}

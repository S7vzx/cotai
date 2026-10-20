import { emailConfigured, sendEmail, sendWhatsApp, whatsappConfigured, type SendResult } from './channels.ts'
import { admin, getSettings, publicUrl, SITE_URL } from './supabase.ts'
import { brDate, brl, emailHtml, renderTemplate, type TemplateVars } from './templates.ts'

export type NotificationEvent =
  | 'pedido_recebido'
  | 'pagamento_confirmado'
  | 'cotacao_pronta'
  | 'nao_encontrado'
  | 'aprovacao_recebida'
  | 'lembrete_pagamento'
  | 'lembrete_resposta'
  | 'compra_atualizada'
  | 'interno_novo_pedido'
  | 'interno_aprovada'
  | 'interno_recusada'

const INTERNAL = new Set<NotificationEvent>(['interno_novo_pedido', 'interno_aprovada', 'interno_recusada'])

const BUTTON: Partial<Record<NotificationEvent, string>> = {
  pedido_recebido: 'Acompanhar pedido',
  pagamento_confirmado: 'Acompanhar pedido',
  cotacao_pronta: 'Ver cotação',
  lembrete_pagamento: 'Pagar agora',
  lembrete_resposta: 'Ver cotação',
  interno_novo_pedido: 'Abrir no painel',
  interno_aprovada: 'Abrir no painel',
  interno_recusada: 'Abrir no painel',
}

export interface NotifyOptions {
  mensagem?: string
  /** Força canais (ex.: checkboxes do modal "Enviar ao cliente"). */
  channels?: { email?: boolean; whatsapp?: boolean }
}

export interface NotifyResult {
  email: SendResult | null
  whatsapp: SendResult | null
  whatsapp_text: string | null
  wa_link: string | null
}

/** Soma da opção escolhida (ou da mais barata) de cada produto, com frete à parte. */
export async function quoteTotal(requestId: string): Promise<number> {
  const { data: items } = await admin
    .from('quote_items')
    .select('id, quantity, not_found, quote_options(sale_price, freight_included, freight_value, selected_by_customer)')
    .eq('request_id', requestId)
  let total = 0
  for (const item of items ?? []) {
    if (item.not_found) continue
    const opts = (item.quote_options ?? []) as {
      sale_price: number
      freight_included: boolean
      freight_value: number
      selected_by_customer: boolean
    }[]
    if (opts.length === 0) continue
    const chosen = opts.find((o) => o.selected_by_customer) ?? opts.reduce((a, b) => (Number(a.sale_price) <= Number(b.sale_price) ? a : b))
    total += Number(chosen.sale_price) * item.quantity + (chosen.freight_included ? 0 : Number(chosen.freight_value || 0))
  }
  return total
}

export async function notify(requestId: string, event: NotificationEvent, opts: NotifyOptions = {}): Promise<NotifyResult> {
  const settings = await getSettings()
  const { data: req, error } = await admin.from('quote_requests').select('*, customers(*)').eq('id', requestId).single()
  if (error || !req) throw error ?? new Error('Pedido não encontrado')
  const customer = req.customers as { name: string; company: string; email: string | null; whatsapp: string | null }

  const trackingLink = `${SITE_URL}/pedido/${req.code}?t=${req.public_token}`
  const quoteLink = `${SITE_URL}/cotacao/${req.public_token}`
  const panelLink = `${SITE_URL}/painel/tarefas/${req.id}`
  const link = INTERNAL.has(event)
    ? panelLink
    : ['cotacao_pronta', 'lembrete_resposta', 'aprovacao_recebida'].includes(event)
      ? quoteLink
      : trackingLink

  const vars: TemplateVars = {
    nome: customer.name.split(' ')[0],
    empresa: customer.company,
    codigo: req.code,
    link,
    total: brl(await quoteTotal(requestId)),
    taxa: brl(Number(req.fee_amount) - Number(req.fee_discount)),
    validade: brDate(req.valid_until),
    prazo: settings.eta_text,
    mensagem: opts.mensagem ?? req.customer_message ?? req.decline_reason ?? '',
  }
  // Para eventos internos, {{nome}} é o nome completo do cliente
  if (INTERNAL.has(event)) vars.nome = customer.name

  const toggles = (settings.notification_toggles?.[event] ?? { email: true, whatsapp: true }) as { email: boolean; whatsapp: boolean }
  const wantEmail = opts.channels?.email ?? toggles.email
  const wantWhats = !INTERNAL.has(event) && (opts.channels?.whatsapp ?? toggles.whatsapp)

  const result: NotifyResult = { email: null, whatsapp: null, whatsapp_text: null, wa_link: null }
  const log = (channel: 'email' | 'whatsapp', recipient: string, r: SendResult, payload: unknown) =>
    admin.from('notifications_log').insert({
      request_id: requestId,
      event,
      channel,
      recipient,
      status: r.status,
      error: r.error ?? null,
      payload,
    })

  // ---- e-mail
  const emailTpl = settings.email_templates?.[event] as { subject: string; body: string } | undefined
  if (wantEmail && emailTpl) {
    let recipients: string[] = []
    if (INTERNAL.has(event)) {
      recipients = settings.team_notification_emails ?? []
      if (recipients.length === 0) {
        const { data: admins } = await admin.from('profiles').select('email').eq('role', 'admin').eq('active', true)
        recipients = (admins ?? []).map((a) => a.email).filter(Boolean) as string[]
      }
    } else if (customer.email) {
      recipients = [customer.email]
    }
    if (recipients.length > 0) {
      const subject = renderTemplate(emailTpl.subject, vars)
      const text = renderTemplate(emailTpl.body, vars)
      const html = emailHtml({
        body: text,
        brandName: settings.display_name || 'Cotaí',
        logoUrl: publicUrl('branding', settings.logo_light_path),
        buttonUrl: BUTTON[event] ? link : undefined,
        buttonLabel: BUTTON[event],
      })
      result.email = await sendEmail({ to: recipients, subject, html, text, fromName: settings.email_from_name })
      await log('email', recipients.join(', '), result.email, { subject })
    }
  }

  // ---- WhatsApp
  const waTpl = settings.whatsapp_templates?.[event] as string | undefined
  if (!INTERNAL.has(event) && waTpl && customer.whatsapp) {
    const text = renderTemplate(waTpl, vars)
    result.whatsapp_text = text
    result.wa_link = `https://wa.me/${customer.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
    if (wantWhats) {
      result.whatsapp = await sendWhatsApp(customer.whatsapp, text)
      await log('whatsapp', customer.whatsapp, result.whatsapp, { text })
    }
  }

  return result
}

export function integrationStatus() {
  return {
    email: emailConfigured(),
    whatsapp: whatsappConfigured(),
  }
}

// Envio por e-mail (Resend) e WhatsApp (Z-API, Evolution API ou WhatsApp Cloud API).
// Os segredos ficam em `supabase secrets`; nunca no banco nem no front-end.

export type SendResult = { status: 'enviado' | 'falhou' | 'nao_configurado'; error?: string; id?: string }

const env = (k: string) => Deno.env.get(k) ?? ''

export function emailConfigured() {
  return Boolean(env('RESEND_API_KEY') && env('EMAIL_FROM'))
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  text: string
  fromName?: string | null
}): Promise<SendResult> {
  if (!emailConfigured()) return { status: 'nao_configurado', error: 'RESEND_API_KEY/EMAIL_FROM não configurados' }
  let from = env('EMAIL_FROM')
  // Permite trocar só o nome exibido pelo painel
  if (opts.fromName) {
    const addr = /<([^>]+)>/.exec(from)?.[1] ?? from
    from = `${opts.fromName} <${addr}>`
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { status: 'falhou', error: body?.message ?? `HTTP ${res.status}` }
    return { status: 'enviado', id: body?.id }
  } catch (err) {
    return { status: 'falhou', error: String(err) }
  }
}

export type WhatsappProvider = 'zapi' | 'evolution' | 'meta' | 'none'

export function whatsappProvider(): WhatsappProvider {
  const p = env('WHATSAPP_PROVIDER') as WhatsappProvider
  return ['zapi', 'evolution', 'meta'].includes(p) ? p : 'none'
}

export function whatsappConfigured(): boolean {
  switch (whatsappProvider()) {
    case 'zapi':
      return Boolean(env('ZAPI_INSTANCE') && env('ZAPI_TOKEN'))
    case 'evolution':
      return Boolean(env('EVOLUTION_URL') && env('EVOLUTION_KEY') && env('EVOLUTION_INSTANCE'))
    case 'meta':
      return Boolean(env('META_TOKEN') && env('META_PHONE_ID'))
    default:
      return false
  }
}

/** Envia texto por WhatsApp. `to` em E.164 (+5579...). */
export async function sendWhatsApp(to: string, message: string): Promise<SendResult> {
  const provider = whatsappProvider()
  if (!whatsappConfigured()) return { status: 'nao_configurado', error: 'Provedor de WhatsApp não configurado' }
  const phone = to.replace(/\D/g, '')
  try {
    let res: Response
    if (provider === 'zapi') {
      res = await fetch(`https://api.z-api.io/instances/${env('ZAPI_INSTANCE')}/token/${env('ZAPI_TOKEN')}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(env('ZAPI_CLIENT_TOKEN') ? { 'Client-Token': env('ZAPI_CLIENT_TOKEN') } : {}) },
        body: JSON.stringify({ phone, message }),
      })
    } else if (provider === 'evolution') {
      res = await fetch(`${env('EVOLUTION_URL').replace(/\/$/, '')}/message/sendText/${env('EVOLUTION_INSTANCE')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env('EVOLUTION_KEY') },
        body: JSON.stringify({ number: phone, text: message }),
      })
    } else {
      res = await fetch(`https://graph.facebook.com/v21.0/${env('META_PHONE_ID')}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('META_TOKEN')}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message, preview_url: true } }),
      })
    }
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { status: 'falhou', error: body?.message ?? body?.error?.message ?? `HTTP ${res.status}` }
    return { status: 'enviado', id: body?.messageId ?? body?.key?.id ?? body?.messages?.[0]?.id }
  } catch (err) {
    return { status: 'falhou', error: String(err) }
  }
}

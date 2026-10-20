// Teste de e-mail ou WhatsApp a partir de Administração → Integrações.
import { sendEmail, sendWhatsApp } from '../_shared/channels.ts'
import { handler, HttpError, json } from '../_shared/http.ts'
import { getSettings, requireAdmin } from '../_shared/supabase.ts'
import { emailHtml } from '../_shared/templates.ts'
import { toE164 } from '../_shared/validation.ts'

Deno.serve(
  handler(async (req, body) => {
    await requireAdmin(req)
    const settings = await getSettings()
    const to = String(body.to ?? '').trim()
    const text = `Teste do ${settings.display_name || 'Cotaí'}: se você recebeu esta mensagem, a integração está funcionando.`

    if (body.channel === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, 'E-mail inválido')
      const r = await sendEmail({
        to,
        subject: 'Teste de e-mail',
        text,
        html: emailHtml({ body: text, brandName: settings.display_name || 'Cotaí' }),
        fromName: settings.email_from_name,
      })
      return json(r)
    }
    if (body.channel === 'whatsapp') {
      const phone = toE164(to)
      if (!phone) throw new HttpError(400, 'Número inválido')
      return json(await sendWhatsApp(phone, text))
    }
    throw new HttpError(400, 'Canal inválido')
  }),
)

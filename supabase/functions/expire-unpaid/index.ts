// Tarefa agendada (a cada hora): cancela pedidos não pagos no prazo e envia lembretes.
// Agende em Supabase → Integrations → Cron, ou com pg_cron + pg_net (ver README).
import { handler, HttpError, json } from '../_shared/http.ts'
import { notify } from '../_shared/notify.ts'
import { admin, getSettings } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (req) => {
    const secret = Deno.env.get('CRON_SECRET')
    const auth = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (auth !== `Bearer ${serviceKey}` && (!secret || req.headers.get('x-cron-secret') !== secret)) {
      throw new HttpError(401, 'Não autorizado')
    }

    const settings = await getSettings()
    const cfg = settings.reminders_config ?? {}
    const now = Date.now()
    let reminders = 0

    // 1) lembrete de pagamento
    if (cfg.payment_reminder_enabled) {
      const before = new Date(now - (cfg.payment_reminder_hours ?? 12) * 3600_000).toISOString()
      const { data } = await admin
        .from('quote_requests')
        .select('id')
        .eq('status', 'aguardando_pagamento')
        .eq('payment_status', 'pendente')
        .is('payment_reminder_sent_at', null)
        .lt('created_at', before)
        .limit(50)
      for (const r of data ?? []) {
        await notify(r.id, 'lembrete_pagamento').catch((e) => console.error(e))
        await admin.from('quote_requests').update({ payment_reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
        reminders++
      }
    }

    // 2) lembrete de cotação sem resposta
    if (cfg.response_reminder_enabled) {
      const before = new Date(now - (cfg.response_reminder_days ?? 2) * 86400_000).toISOString()
      const { data } = await admin
        .from('quote_requests')
        .select('id')
        .eq('status', 'enviado')
        .is('response_reminder_sent_at', null)
        .lt('sent_at', before)
        .limit(50)
      for (const r of data ?? []) {
        await notify(r.id, 'lembrete_resposta').catch((e) => console.error(e))
        await admin.from('quote_requests').update({ response_reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
        reminders++
      }
    }

    // 3) cancela os vencidos
    const { data: expired, error } = await admin.rpc('expire_unpaid_requests')
    if (error) throw error
    return json({ expired, reminders })
  }),
)

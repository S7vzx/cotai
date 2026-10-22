// Recebe a confirmação do Asaas, do Mercado Pago ou da AbacatePay e libera o pedido.
import { handler, HttpError, json } from '../_shared/http.ts'
import { notify } from '../_shared/notify.ts'
import { parseWebhook } from '../_shared/payments.ts'
import { admin } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (req, body) => {
    let parsed
    try {
      parsed = await parseWebhook(req, body)
    } catch (err) {
      throw new HttpError(401, (err as Error).message)
    }
    if (!parsed) return json({ ignored: true })

    const { data: before } = await admin.from('quote_requests').select('payment_status').eq('id', parsed.requestId).maybeSingle()
    if (!before) return json({ ignored: true })
    if (before.payment_status === 'pago') return json({ ok: true, duplicate: true })

    const { error } = await admin.rpc('mark_request_paid', {
      p_request_id: parsed.requestId,
      p_method: parsed.method,
      p_payment_id: parsed.paymentId,
    })
    if (error) throw error
    await notify(parsed.requestId, 'pagamento_confirmado').catch((e) => console.error(e))
    return json({ ok: true })
  }),
)

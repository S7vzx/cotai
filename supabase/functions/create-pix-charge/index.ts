// (Re)gera a cobrança Pix de um pedido pendente, a partir da página de acompanhamento.
import { handler, HttpError, json } from '../_shared/http.ts'
import { createPixCharge, paymentProvider } from '../_shared/payments.ts'
import { admin } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (_req, body) => {
    const code = String(body.code ?? '').toUpperCase()
    const token = String(body.token ?? '')
    const { data: q } = await admin
      .from('quote_requests')
      .select('*, customers(*)')
      .eq('code', code)
      .eq('public_token', token)
      .maybeSingle()
    if (!q) throw new HttpError(404, 'Pedido não encontrado')
    if (q.payment_status !== 'pendente') throw new HttpError(400, 'Este pedido não tem pagamento pendente')
    if (paymentProvider() === 'none') return json({ manual: true })

    // Reaproveita a cobrança existente se ainda for válida
    const existing = q.payment_payload as { expires_at?: string } | null
    if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) return json(existing)

    const charge = await createPixCharge({
      requestId: q.id,
      code: q.code,
      amount: Number(q.fee_amount) - Number(q.fee_discount),
      customer: q.customers,
      notificationUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook?token=${Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? ''}`,
    })
    await admin
      .from('quote_requests')
      .update({ payment_id: charge.payment_id, payment_method: `pix_${charge.provider}`, payment_payload: charge })
      .eq('id', q.id)
    return json(charge)
  }),
)

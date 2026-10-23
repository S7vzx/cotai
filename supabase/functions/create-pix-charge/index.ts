// (Re)gera a cobrança de um pedido pendente (Pix ou cartão), a partir da página de acompanhamento.
import { handler, HttpError, json } from '../_shared/http.ts'
import { confirmPaid } from '../_shared/paid.ts'
import { chargeMatches, createPixCharge, parsePayMethod, PaymentDeclined, paymentProvider, type PixCharge } from '../_shared/payments.ts'
import { admin, SITE_URL } from '../_shared/supabase.ts'

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

    // Sem forma pedida, mantém a da cobrança atual (ou Pix)
    const existing = q.payment_payload as PixCharge | null
    const method = body.method ? parsePayMethod(body.method) : existing?.method?.startsWith('cartao') ? 'card' : 'pix'

    // Reaproveita a cobrança existente se for da mesma forma e ainda for válida
    if (existing && chargeMatches(existing, method) && (!existing.expires_at || new Date(existing.expires_at) > new Date()))
      return json(existing)

    const charge = await createPixCharge({
      requestId: q.id,
      code: q.code,
      amount: Number(q.fee_amount) - Number(q.fee_discount),
      method,
      cardToken: typeof body.card_token === 'string' ? body.card_token : undefined,
      customer: q.customers,
      notificationUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook?token=${Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? ''}`,
      returnUrl: `${SITE_URL}/pedido/${q.code}?t=${q.public_token}`,
    }).catch((err) => {
      console.error('Falha ao gerar a cobrança', err)
      if (err instanceof PaymentDeclined) throw new HttpError(402, err.message)
      throw new HttpError(502, 'Não foi possível gerar o pagamento agora. Tente de novo em instantes.')
    })
    await admin
      .from('quote_requests')
      .update({ payment_id: charge.payment_id, payment_method: charge.method, payment_payload: charge })
      .eq('id', q.id)
    // Cartão aprovado na hora: confirma e o pedido entra na fila
    if (charge.status === 'APPROVED' || charge.status === 'PAID') await confirmPaid(q.id, charge)
    return json(charge)
  }),
)

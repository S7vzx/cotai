// Recebe o pedido público, valida, grava (via public.create_quote_request) e notifica.
import { clientIp, handler, HttpError, json } from '../_shared/http.ts'
import { notify } from '../_shared/notify.ts'
import { createPixCharge, parsePayMethod, paymentProvider } from '../_shared/payments.ts'
import { admin, getSettings, SITE_URL } from '../_shared/supabase.ts'
import { parseOrder } from '../_shared/validation.ts'

Deno.serve(
  handler(async (req, body) => {
    // honeypot: robôs preenchem o campo invisível "website"
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json({ error: 'Não foi possível enviar o pedido' }, 400)
    }

    const settings = await getSettings()
    let order
    try {
      order = parseOrder(body, settings.form_fields_config ?? {})
    } catch (err) {
      throw new HttpError(400, (err as Error).message)
    }

    const { data, error } = await admin.rpc('create_quote_request', {
      p_payload: order,
      p_rate_key: `ip:${clientIp(req)}`,
    })
    if (error) throw error
    const created = data as { id: string; code: string; public_token: string; status: string; fee: { total: number } }

    // Pagamento automático (Pix ou cartão, como o cliente escolheu no resumo), se houver provedor
    let payment: unknown = null
    let paymentError = false
    if (Number(created.fee.total) > 0 && paymentProvider() !== 'none') {
      try {
        const charge = await createPixCharge({
          requestId: created.id,
          code: created.code,
          amount: Number(created.fee.total),
          method: parsePayMethod(body.payment_method),
          customer: {
            name: order.customer.name,
            email: order.customer.email,
            whatsapp: order.customer.whatsapp,
            cnpj: order.customer.cnpj,
          },
          notificationUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook?token=${Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? ''}`,
          returnUrl: `${SITE_URL}/pedido/${created.code}?t=${created.public_token}`,
        })
        await admin
          .from('quote_requests')
          .update({ payment_id: charge.payment_id, payment_method: charge.method, payment_payload: charge })
          .eq('id', created.id)
        payment = charge
      } catch (err) {
        // Não perde o pedido: a página do pedido tenta gerar a cobrança de novo
        console.error('Falha ao gerar a cobrança', err)
        paymentError = true
      }
    }

    // Notificações não podem derrubar o pedido
    const notifications = Promise.allSettled([notify(created.id, 'pedido_recebido'), notify(created.id, 'interno_novo_pedido')])
    // @ts-ignore EdgeRuntime existe no Supabase
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(notifications)
    else await notifications

    return json({
      code: created.code,
      token: created.public_token,
      status: created.status,
      fee: created.fee,
      payment,
      payment_error: paymentError,
      tracking_url: `${SITE_URL}/pedido/${created.code}?t=${created.public_token}`,
      // Chave Pix manual só quando não há provedor configurado
      pix_manual:
        Number(created.fee.total) > 0 && paymentProvider() === 'none'
          ? {
              key: settings.pix_key,
              key_type: settings.pix_key_type,
              receiver: settings.pix_receiver_name,
              instructions: settings.pix_instructions,
            }
          : null,
    })
  }),
)

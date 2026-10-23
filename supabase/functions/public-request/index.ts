// Página de acompanhamento: dados do pedido por código + token.
import { handler, HttpError, json } from '../_shared/http.ts'
import { confirmPaid } from '../_shared/paid.ts'
import { isChargePaid, paymentProvider, type PixCharge } from '../_shared/payments.ts'
import { admin, signPaths } from '../_shared/supabase.ts'

interface Tracking {
  id?: string
  status: string
  payment: {
    charge: PixCharge | null
    pix_key?: string | null
    pix_key_type?: string | null
    pix_receiver_name?: string | null
    pix_instructions?: string | null
  } | null
  items?: { photos: string[] }[]
}

async function load(code: string, token: string): Promise<Tracking> {
  const { data, error } = await admin.rpc('get_request_tracking', { p_code: code, p_token: token })
  if (error) throw error
  if (!data) throw new HttpError(404, 'Pedido não encontrado')
  return data as Tracking
}

Deno.serve(
  handler(async (_req, body) => {
    const code = String(body.code ?? '').slice(0, 20)
    const token = String(body.token ?? '').slice(0, 80)
    if (!code || !token) throw new HttpError(400, 'Link incompleto')

    let data = await load(code, token)

    // Pagamento pendente: pergunta ao provedor se já caiu, para confirmar na hora sem esperar o webhook
    const charge = data.payment?.charge
    if (data.status === 'aguardando_pagamento' && charge && (await isChargePaid(charge).catch(() => false))) {
      const { data: q } = await admin.from('quote_requests').select('id').eq('code', code.toUpperCase()).eq('public_token', token).single()
      await confirmPaid(q!.id, charge)
      data = await load(code, token)
    }

    // Com provedor configurado, a chave Pix manual não aparece mais para o cliente
    if (data.payment && paymentProvider() !== 'none') {
      data.payment.pix_key = null
      data.payment.pix_key_type = null
      data.payment.pix_receiver_name = null
      data.payment.pix_instructions = null
    }

    const items = data.items ?? []
    const signed = await signPaths(items.flatMap((i) => i.photos))
    for (const it of items) (it as { photo_urls?: string[] }).photo_urls = it.photos.map((p) => signed[p]).filter(Boolean)
    return json(data)
  }),
)

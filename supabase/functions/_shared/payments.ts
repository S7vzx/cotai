// Cobrança Pix automática: Asaas ou Mercado Pago (escolhido por PAYMENT_PROVIDER).
// Sem provedor configurado, o sistema funciona com Pix manual (chave + confirmação no painel).

const env = (k: string) => Deno.env.get(k) ?? ''

export type PaymentProvider = 'asaas' | 'mercadopago' | 'none'

export function paymentProvider(): PaymentProvider {
  const p = env('PAYMENT_PROVIDER')
  if (p === 'asaas' && env('ASAAS_API_KEY')) return 'asaas'
  if (p === 'mercadopago' && env('MERCADOPAGO_ACCESS_TOKEN')) return 'mercadopago'
  return 'none'
}

export interface PixCharge {
  provider: PaymentProvider
  payment_id: string
  qr_code: string // copia e cola
  qr_code_image: string | null // base64 PNG
  expires_at: string | null
}

interface ChargeInput {
  requestId: string
  code: string
  amount: number
  customer: { name: string; email: string | null; whatsapp: string | null; cnpj: string | null }
  notificationUrl: string
}

export async function createPixCharge(input: ChargeInput): Promise<PixCharge> {
  const provider = paymentProvider()
  if (provider === 'asaas') return asaas(input)
  if (provider === 'mercadopago') return mercadoPago(input)
  throw new Error('Nenhum provedor de pagamento configurado')
}

async function asaas(input: ChargeInput): Promise<PixCharge> {
  const base = env('PAYMENT_ENV') === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
  const headers = { 'Content-Type': 'application/json', access_token: env('ASAAS_API_KEY'), 'User-Agent': 'cotai' }
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(base + path, { ...init, headers })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.errors?.[0]?.description ?? `Asaas HTTP ${res.status}`)
    return body
  }
  const customer = await call('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.customer.name,
      email: input.customer.email,
      mobilePhone: input.customer.whatsapp?.replace(/^\+55/, ''),
      cpfCnpj: input.customer.cnpj?.replace(/\D/g, '') || undefined,
      externalReference: input.requestId,
    }),
  })
  const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
  const payment = await call('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customer.id,
      billingType: 'PIX',
      value: input.amount,
      dueDate: due,
      description: `Taxa de cotação ${input.code}`,
      externalReference: input.requestId,
    }),
  })
  const qr = await call(`/payments/${payment.id}/pixQrCode`)
  return {
    provider: 'asaas',
    payment_id: payment.id,
    qr_code: qr.payload,
    qr_code_image: qr.encodedImage ?? null,
    expires_at: qr.expirationDate ?? null,
  }
}

async function mercadoPago(input: ChargeInput): Promise<PixCharge> {
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env('MERCADOPAGO_ACCESS_TOKEN')}`,
      'X-Idempotency-Key': `cotai-${input.requestId}`,
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount.toFixed(2)),
      description: `Taxa de cotação ${input.code}`,
      payment_method_id: 'pix',
      external_reference: input.requestId,
      notification_url: input.notificationUrl,
      payer: { email: input.customer.email ?? 'cliente@example.com', first_name: input.customer.name.split(' ')[0] },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message ?? `Mercado Pago HTTP ${res.status}`)
  const td = body.point_of_interaction?.transaction_data ?? {}
  return {
    provider: 'mercadopago',
    payment_id: String(body.id),
    qr_code: td.qr_code,
    qr_code_image: td.qr_code_base64 ?? null,
    expires_at: body.date_of_expiration ?? null,
  }
}

/**
 * Interpreta o webhook do provedor. Devolve o id do pedido (externalReference)
 * quando o pagamento foi confirmado, ou null se o evento não interessa.
 */
export async function parseWebhook(req: Request, body: Record<string, unknown>): Promise<{ requestId: string; paymentId: string } | null> {
  const provider = paymentProvider()
  const secret = env('PAYMENT_WEBHOOK_SECRET')

  if (provider === 'asaas') {
    if (secret && req.headers.get('asaas-access-token') !== secret) throw new Error('Webhook não autorizado')
    const event = String(body.event ?? '')
    const payment = body.payment as { id: string; externalReference?: string } | undefined
    if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) || !payment?.externalReference) return null
    return { requestId: payment.externalReference, paymentId: payment.id }
  }

  if (provider === 'mercadopago') {
    if (secret && new URL(req.url).searchParams.get('token') !== secret) throw new Error('Webhook não autorizado')
    const data = body.data as { id?: string } | undefined
    if (body.type !== 'payment' || !data?.id) return null
    // Nunca confie no corpo: consulta o pagamento na API
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${env('MERCADOPAGO_ACCESS_TOKEN')}` },
    })
    const p = await res.json()
    if (p.status !== 'approved' || !p.external_reference) return null
    return { requestId: p.external_reference, paymentId: String(p.id) }
  }

  return null
}

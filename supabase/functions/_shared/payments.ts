// Cobrança automática: Pix do Asaas ou do Mercado Pago, ou checkout hospedado da AbacatePay
// (Pix, cartão e boleto), escolhido por PAYMENT_PROVIDER.
// Sem provedor configurado, o sistema funciona com Pix manual (chave + confirmação no painel).

const env = (k: string) => Deno.env.get(k) ?? ''

export type PaymentProvider = 'asaas' | 'mercadopago' | 'abacatepay' | 'none'

export function paymentProvider(): PaymentProvider {
  const p = env('PAYMENT_PROVIDER')
  if (p === 'asaas' && env('ASAAS_API_KEY')) return 'asaas'
  if (p === 'mercadopago' && env('MERCADOPAGO_ACCESS_TOKEN')) return 'mercadopago'
  if (p === 'abacatepay' && env('ABACATEPAY_API_KEY')) return 'abacatepay'
  return 'none'
}

export interface PixCharge {
  provider: PaymentProvider
  method: string // gravado em quote_requests.payment_method
  payment_id: string
  qr_code: string | null // copia e cola (Pix direto)
  qr_code_image: string | null // base64 PNG
  checkout_url: string | null // página de pagamento hospedada (AbacatePay)
  expires_at: string | null
}

interface ChargeInput {
  requestId: string
  code: string
  amount: number
  customer: { name: string; email: string | null; whatsapp: string | null; cnpj: string | null }
  notificationUrl: string
  returnUrl: string // página de acompanhamento do pedido
}

export async function createPixCharge(input: ChargeInput): Promise<PixCharge> {
  const provider = paymentProvider()
  if (provider === 'asaas') return asaas(input)
  if (provider === 'mercadopago') return mercadoPago(input)
  if (provider === 'abacatepay') return abacatePay(input)
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
    method: 'pix_asaas',
    payment_id: payment.id,
    qr_code: qr.payload,
    qr_code_image: qr.encodedImage ?? null,
    checkout_url: null,
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
    method: 'pix_mercadopago',
    payment_id: String(body.id),
    qr_code: td.qr_code,
    qr_code_image: td.qr_code_base64 ?? null,
    checkout_url: null,
    expires_at: body.date_of_expiration ?? null,
  }
}

// AbacatePay (API v2). O checkout cobra produtos, não um valor avulso: cada pedido ganha um
// produto com o valor da taxa. A chave de Dev mode e a de produção usam a mesma URL.
const ABACATE = 'https://api.abacatepay.com/v2'

async function abacateCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ABACATE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('ABACATEPAY_API_KEY')}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.success === false) throw new Error(String(body?.error ?? `AbacatePay HTTP ${res.status}`))
  return body.data as T
}

async function abacatePay(input: ChargeInput): Promise<PixCharge> {
  const cents = Math.round(input.amount * 100)
  // O externalId inclui o valor: se a taxa mudar, nasce outro produto em vez de reaproveitar o preço antigo
  const externalId = `taxa-${input.requestId}-${cents}`
  const product = await abacateCall<{ id: string }>('/products/create', {
    method: 'POST',
    body: JSON.stringify({ externalId, name: `Taxa de cotação ${input.code}`, price: cents, currency: 'BRL' }),
  }).catch(() => abacateCall<{ id: string }>(`/products/get?externalId=${encodeURIComponent(externalId)}`))

  // O cliente é opcional no checkout, mas pré-preenche os dados na página de pagamento
  let customerId: string | undefined
  if (input.customer.email) {
    customerId = await abacateCall<{ id: string }>('/customers/create', {
      method: 'POST',
      body: JSON.stringify({
        email: input.customer.email,
        name: input.customer.name,
        cellphone: input.customer.whatsapp ?? undefined,
        taxId: input.customer.cnpj?.replace(/\D/g, '') || undefined,
      }),
    })
      .then((c) => c.id)
      .catch((err) => {
        console.error('AbacatePay: cliente não criado', err)
        return undefined
      })
  }

  const checkout = await abacateCall<{ id: string; url: string }>('/checkouts/create', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: product.id, quantity: 1 }],
      methods: abacateMethods(),
      customerId,
      externalId: input.requestId,
      returnUrl: input.returnUrl,
      completionUrl: input.returnUrl,
      metadata: { code: input.code },
    }),
  })
  return {
    provider: 'abacatepay',
    method: 'checkout_abacatepay',
    payment_id: checkout.id,
    qr_code: null,
    qr_code_image: null,
    checkout_url: checkout.url,
    expires_at: null,
  }
}

// Formas aceitas no checkout (ABACATEPAY_METHODS=PIX,CARD,BOLETO). Padrão: Pix e cartão.
function abacateMethods(): string[] {
  const list = env('ABACATEPAY_METHODS')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m) => ['PIX', 'CARD', 'BOLETO'].includes(m))
  return list.length ? list : ['PIX', 'CARD']
}

const ABACATE_METHOD: Record<string, string> = { PIX: 'pix_abacatepay', CARD: 'cartao_abacatepay', BOLETO: 'boleto_abacatepay' }

/**
 * Interpreta o webhook do provedor. Devolve o id do pedido (externalReference)
 * quando o pagamento foi confirmado, ou null se o evento não interessa.
 */
export async function parseWebhook(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ requestId: string; paymentId: string; method: string } | null> {
  const provider = paymentProvider()
  const secret = env('PAYMENT_WEBHOOK_SECRET')

  if (provider === 'asaas') {
    if (secret && req.headers.get('asaas-access-token') !== secret) throw new Error('Webhook não autorizado')
    const event = String(body.event ?? '')
    const payment = body.payment as { id: string; externalReference?: string } | undefined
    if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) || !payment?.externalReference) return null
    return { requestId: payment.externalReference, paymentId: payment.id, method: 'pix_asaas' }
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
    return { requestId: p.external_reference, paymentId: String(p.id), method: 'pix_mercadopago' }
  }

  if (provider === 'abacatepay') {
    // O secret cadastrado no webhook da AbacatePay chega como ?webhookSecret=. Sem secret, recusa tudo.
    if (!secret || new URL(req.url).searchParams.get('webhookSecret') !== secret) throw new Error('Webhook não autorizado')
    if (body.event !== 'checkout.completed') return null
    const data = body.data as { checkout?: { id?: string }; payerInformation?: { method?: string } } | undefined
    if (!data?.checkout?.id) return null
    // Nunca confie no corpo: consulta o checkout na API (a chave só enxerga o próprio ambiente)
    const c = await abacateCall<{ id: string; status: string; externalId: string | null }>(
      `/checkouts/get?id=${encodeURIComponent(data.checkout.id)}`,
    )
    if (c.status !== 'PAID' || !c.externalId) return null
    return {
      requestId: c.externalId,
      paymentId: c.id,
      method: ABACATE_METHOD[data.payerInformation?.method ?? ''] ?? 'checkout_abacatepay',
    }
  }

  return null
}

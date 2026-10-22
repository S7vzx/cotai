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

// Forma escolhida pelo cliente no resumo do pedido. Asaas e Mercado Pago só fazem Pix.
export type PayMethod = 'pix' | 'card'

export function parsePayMethod(v: unknown): PayMethod {
  return v === 'card' ? 'card' : 'pix'
}

/** A cobrança já gerada serve para a forma pedida? (cartão = checkout hospedado) */
export function chargeMatches(charge: { method?: string } | null | undefined, method: PayMethod): boolean {
  if (!charge?.method) return method === 'pix'
  return method === 'card' ? !charge.method.startsWith('pix') : charge.method.startsWith('pix')
}

interface ChargeInput {
  requestId: string
  code: string
  amount: number
  method: PayMethod
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

// AbacatePay (API v2). Pix: QR Code direto (checkout transparente), mostrado na nossa página.
// Cartão: checkout hospedado, que cobra produtos e não um valor avulso, então cada pedido ganha
// um produto com o valor da taxa. A chave de Dev mode e a de produção usam a mesma URL.
const ABACATE = 'https://api.abacatepay.com/v2'

async function abacateCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ABACATE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('ABACATEPAY_API_KEY')}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.success === false) {
    const msg = typeof body?.error === 'string' ? body.error : JSON.stringify(body?.error ?? body)
    throw new Error(`AbacatePay ${path.split('?')[0]} (HTTP ${res.status}): ${msg}`)
  }
  return body.data as T
}

function abacateCustomer(c: ChargeInput['customer']) {
  return {
    email: c.email ?? undefined,
    name: c.name,
    cellphone: c.whatsapp ?? undefined,
    taxId: c.cnpj?.replace(/\D/g, '') || undefined,
  }
}

async function abacatePay(input: ChargeInput): Promise<PixCharge> {
  return input.method === 'card' ? abacateCard(input) : abacatePix(input)
}

async function abacatePix(input: ChargeInput): Promise<PixCharge> {
  const pix = await abacateCall<{ id: string; brCode: string; brCodeBase64: string | null; expiresAt: string | null }>(
    '/transparents/create',
    {
      method: 'POST',
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: Math.round(input.amount * 100),
          description: `Taxa de cotação ${input.code}`,
          expiresIn: 24 * 3600,
          customer: input.customer.email ? abacateCustomer(input.customer) : undefined,
          metadata: { requestId: input.requestId, code: input.code },
        },
      }),
    },
  )
  return {
    provider: 'abacatepay',
    method: 'pix_abacatepay',
    payment_id: pix.id,
    qr_code: pix.brCode,
    // a página monta o data URL; a API já devolve com o prefixo
    qr_code_image: pix.brCodeBase64?.replace(/^data:image\/\w+;base64,/, '') ?? null,
    checkout_url: null,
    expires_at: pix.expiresAt,
  }
}

async function abacateCard(input: ChargeInput): Promise<PixCharge> {
  const cents = Math.round(input.amount * 100)
  // O externalId inclui o valor: se a taxa mudar, nasce outro produto em vez de reaproveitar o preço antigo
  const externalId = `taxa-${input.requestId}-${cents}`
  const product = await abacateCall<{ id: string }>('/products/create', {
    method: 'POST',
    body: JSON.stringify({ externalId, name: `Taxa de cotação ${input.code}`, price: cents, currency: 'BRL' }),
  }).catch((err) =>
    // Produto já criado numa tentativa anterior; se nem assim achar, vale o erro original
    abacateCall<{ id: string }>(`/products/get?externalId=${encodeURIComponent(externalId)}`).catch(() => {
      throw err
    }),
  )

  // O cliente é opcional no checkout, mas pré-preenche os dados na página de pagamento
  let customerId: string | undefined
  if (input.customer.email) {
    customerId = await abacateCall<{ id: string }>('/customers/create', {
      method: 'POST',
      body: JSON.stringify(abacateCustomer(input.customer)),
    })
      .then((c) => c.id)
      .catch((err) => {
        console.error('AbacatePay: cliente não criado', err)
        return undefined
      })
  }

  const installments = Math.min(12, Math.max(1, Number(env('ABACATEPAY_MAX_INSTALLMENTS')) || 1))
  const checkout = await abacateCall<{ id: string; url: string }>('/checkouts/create', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: product.id, quantity: 1 }],
      methods: ['CARD'],
      card: { maxInstallments: installments },
      customerId,
      externalId: input.requestId,
      returnUrl: input.returnUrl,
      completionUrl: input.returnUrl,
      metadata: { code: input.code },
    }),
  })
  return {
    provider: 'abacatepay',
    method: 'cartao_abacatepay',
    payment_id: checkout.id,
    qr_code: null,
    qr_code_image: null,
    checkout_url: checkout.url,
    expires_at: null,
  }
}

/**
 * Consulta na AbacatePay se a cobrança já foi paga. Usado pela página do pedido enquanto o
 * pagamento está pendente, para confirmar na hora mesmo se o webhook atrasar ou não chegar.
 * Para Asaas e Mercado Pago, a confirmação continua só pelo webhook.
 */
export async function isChargePaid(charge: { provider?: string; payment_id?: string } | null | undefined): Promise<boolean> {
  if (!charge?.payment_id || charge.provider !== 'abacatepay' || paymentProvider() !== 'abacatepay') return false
  const id = encodeURIComponent(charge.payment_id)
  if (charge.payment_id.startsWith('pix_')) {
    const p = await abacateCall<{ status: string }>(`/transparents/check?id=${id}`)
    return p.status === 'PAID'
  }
  const c = await abacateCall<{ status: string }>(`/checkouts/get?id=${id}`)
  return c.status === 'PAID'
}

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

    // Cartão (checkout hospedado)
    if (body.event === 'checkout.completed') {
      const data = body.data as { checkout?: { id?: string } } | undefined
      if (!data?.checkout?.id) return null
      // Nunca confie no corpo: consulta o checkout na API (a chave só enxerga o próprio ambiente)
      const c = await abacateCall<{ id: string; status: string; externalId: string | null }>(
        `/checkouts/get?id=${encodeURIComponent(data.checkout.id)}`,
      )
      if (c.status !== 'PAID' || !c.externalId) return null
      return { requestId: c.externalId, paymentId: c.id, method: 'cartao_abacatepay' }
    }

    // Pix (QR Code na nossa página)
    if (body.event === 'transparent.completed') {
      const data = body.data as { transparent?: { id?: string; metadata?: { requestId?: string } } } | undefined
      const t = data?.transparent
      if (!t?.id?.startsWith('pix_') || !t.metadata?.requestId) return null
      const p = await abacateCall<{ status: string }>(`/transparents/check?id=${encodeURIComponent(t.id)}`)
      if (p.status !== 'PAID') return null
      return { requestId: t.metadata.requestId, paymentId: t.id, method: 'pix_abacatepay' }
    }
  }

  return null
}

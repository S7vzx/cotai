// Validação do pedido público (sem dependências: roda no Deno e no Vitest).

export interface OrderInput {
  customer: { name: string; company: string; cnpj: string; whatsapp: string; email: string }
  items: {
    name: string
    description: string | null
    reference_url: string | null
    category_id: string | null
    quantity: number
    unit: string
    target_price: number
    notes: string | null
    photos: string[]
  }[]
  coupon: string | null
  accepted_terms: boolean
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const opt = (v: unknown, max: number) => str(v, max) || null

export function toE164(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d.length === 10 || d.length === 11 ? `+55${d}` : null
}

/** Dígitos verificadores de CPF (11 dígitos) ou CNPJ (14 dígitos). */
export function isValidCpf(input: string): boolean {
  const d = input.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function isValidCnpj(input: string): boolean {
  const d = input.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export const isValidDocument = (input: string) => isValidCpf(input) || isValidCnpj(input)

/** "12345678909" → "123.456.789-09"; 14 dígitos → "11.222.333/0001-81" */
export function formatDocument(input: string): string {
  const d = input.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return d
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normaliza e valida; lança Error com mensagem para o usuário. */
export function parseOrder(body: Record<string, unknown>, fieldModes: Record<string, string> = {}): OrderInput {
  const c = (body.customer ?? {}) as Record<string, unknown>
  const name = str(c.name, 120)
  const email = str(c.email, 160).toLowerCase()
  const whatsapp = toE164(str(c.whatsapp, 30))
  const company = str(c.company, 160)
  const doc = str(c.cnpj, 20)

  if (name.length < 2) throw new Error('Informe seu nome')
  if (!company) throw new Error('Informe o nome da empresa')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido')
  if (!whatsapp) throw new Error('WhatsApp inválido')
  // CPF ou CNPJ, sempre obrigatório (guardado na coluna cnpj)
  if (!doc) throw new Error('Informe o CPF ou CNPJ')
  if (!isValidDocument(doc)) throw new Error('CPF ou CNPJ inválido')
  const cnpj = formatDocument(doc)

  const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : []
  if (rawItems.length === 0) throw new Error('Adicione pelo menos um produto')

  const items = rawItems.map((it, i) => {
    const label = `Produto ${i + 1}`
    const itemName = str(it.name, 200)
    if (!itemName) throw new Error(`${label}: informe o nome`)
    const quantity = Math.floor(Number(it.quantity))
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`${label}: quantidade inválida`)
    const target = Number(it.target_price)
    if (!Number.isFinite(target) || target <= 0) throw new Error(`${label}: informe o preço-alvo`)
    const photos = (Array.isArray(it.photos) ? it.photos : []).filter(
      (p): p is string => typeof p === 'string' && /^pedidos\/[0-9a-f-]{36}\/\d+\.\w+$/.test(p),
    )
    const reference = opt(it.reference_url, 500)
    if (reference && !/^https?:\/\//i.test(reference)) throw new Error(`${label}: o link deve começar com http`)
    const category = opt(it.category_id, 40)
    for (const [field, value] of [
      ['reference_url', reference],
      ['notes', opt(it.notes, 1)],
      ['category', category],
    ] as const) {
      if (fieldModes[field] === 'obrigatorio' && !value) throw new Error(`${label}: campo obrigatório não preenchido`)
    }
    return {
      name: itemName,
      description: opt(it.description, 2000),
      reference_url: reference,
      category_id: category && UUID.test(category) ? category : null,
      quantity: Math.min(quantity, 1_000_000),
      unit: str(it.unit, 10) || 'un',
      target_price: Math.round(target * 100) / 100,
      notes: opt(it.notes, 2000),
      photos,
    }
  })

  return {
    customer: { name, company, cnpj, whatsapp, email },
    items,
    coupon: opt(body.coupon, 40),
    accepted_terms: body.accepted_terms === true,
  }
}

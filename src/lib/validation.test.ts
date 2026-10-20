import { describe, expect, it } from 'vitest'
import { parseOrder } from '../../supabase/functions/_shared/validation'

const base = {
  customer: { name: 'Ana Souza', company: 'Loja', whatsapp: '(79) 99999-8888', email: 'ANA@Loja.com ' },
  items: [
    {
      name: 'Cadeira',
      quantity: '3',
      unit: 'un',
      target_price: 120.456,
      photos: ['pedidos/7a6f1d2e-1111-4222-8333-944455556666/0.jpg', '../hack.jpg'],
    },
  ],
  accepted_terms: true,
}

describe('validação do pedido público (Edge Function)', () => {
  it('normaliza contato, quantidade, preço e fotos', () => {
    const o = parseOrder(base)
    expect(o.customer.whatsapp).toBe('+5579999998888')
    expect(o.customer.email).toBe('ana@loja.com')
    expect(o.items[0].quantity).toBe(3)
    expect(o.items[0].target_price).toBe(120.46)
    expect(o.items[0].photos).toEqual(['pedidos/7a6f1d2e-1111-4222-8333-944455556666/0.jpg'])
  })

  it('recusa dados inválidos com mensagem em português', () => {
    expect(() => parseOrder({ ...base, customer: { ...base.customer, email: 'x' } })).toThrow('E-mail inválido')
    expect(() => parseOrder({ ...base, customer: { ...base.customer, whatsapp: '123' } })).toThrow('WhatsApp inválido')
    expect(() => parseOrder({ ...base, items: [] })).toThrow('Adicione pelo menos um produto')
    expect(() => parseOrder({ ...base, items: [{ ...base.items[0], target_price: 0 }] })).toThrow('Produto 1: informe o preço-alvo')
    expect(() => parseOrder({ ...base, items: [{ ...base.items[0], reference_url: 'javascript:alert(1)' }] })).toThrow(
      'o link deve começar com http',
    )
  })

  it('respeita campos obrigatórios configurados no painel', () => {
    expect(() => parseOrder(base, { cnpj: 'obrigatorio' })).toThrow('Informe o CNPJ')
    expect(() => parseOrder(base, { notes: 'obrigatorio' })).toThrow('campo obrigatório')
  })
})

import { describe, expect, it } from 'vitest'
import { previewFee, validateTiers } from './fee'
import { date, money, phone, toE164, waLink } from './format'
import { isValidCnpj, maskCnpj, maskDocument, maskMoney, maskPhone, moneyToInput, parseMoney } from './masks'
import { canTransition, nextStatuses } from './status'
import { renderTemplate } from '../../supabase/functions/_shared/templates'

describe('format', () => {
  it('formata moeda em reais', () => {
    expect(money(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(money('10')).toContain('10,00')
    expect(money(null)).toContain('0,00')
  })

  it('normaliza telefone para E.164 e volta', () => {
    expect(toE164('(79) 99999-8888')).toBe('+5579999998888')
    expect(toE164('+55 79 99999-8888')).toBe('+5579999998888')
    expect(toE164('3333-4444')).toBeNull()
    expect(phone('+5579999998888')).toBe('(79) 99999-8888')
    expect(waLink('+5579999998888', 'Olá')).toBe('https://wa.me/5579999998888?text=Ol%C3%A1')
  })

  it('não desloca datas puras por fuso horário', () => {
    expect(date('2026-10-20')).toBe('20/10/2026')
  })
})

describe('masks', () => {
  it('telefone', () => {
    expect(maskPhone('79999998888')).toBe('(79) 99999-8888')
    expect(maskPhone('7933334444')).toBe('(79) 3333-4444')
  })

  it('CNPJ', () => {
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
  })

  it('CPF ou CNPJ', () => {
    expect(maskDocument('5299822')).toBe('529.982.2')
    expect(maskDocument('52998224725')).toBe('529.982.247-25')
    expect(maskDocument('112223330001819')).toBe('11.222.333/0001-81')
  })

  it('moeda', () => {
    expect(maskMoney('123456')).toBe('1.234,56')
    expect(maskMoney('5')).toBe('0,05')
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(moneyToInput(50)).toBe('50,00')
    expect(moneyToInput(0.1)).toBe('0,10')
  })
})

describe('taxa (preview)', () => {
  const base = { enabled: true, fixed: 30, per_item: 12, per_item_max: 50, tiers: [] }

  it('desligada = zero', () => {
    expect(previewFee({ ...base, enabled: false, model: 'fixo_pedido' }, 3)).toBe(0)
  })
  it('fixo', () => expect(previewFee({ ...base, model: 'fixo_pedido' }, 7)).toBe(30))
  it('por produto com teto', () => {
    expect(previewFee({ ...base, model: 'por_produto' }, 2)).toBe(24)
    expect(previewFee({ ...base, model: 'por_produto' }, 9)).toBe(50)
  })
  it('faixas', () => {
    const tiers = [
      { from: 1, to: 3, amount: 20 },
      { from: 4, to: null, amount: 40 },
    ]
    expect(previewFee({ ...base, model: 'faixas', tiers }, 3)).toBe(20)
    expect(previewFee({ ...base, model: 'faixas', tiers }, 30)).toBe(40)
  })
  it('valida faixas', () => {
    expect(
      validateTiers([
        { from: 1, to: 3, amount: 1 },
        { from: 4, to: null, amount: 2 },
      ]),
    ).toBeNull()
    expect(
      validateTiers([
        { from: 1, to: 3, amount: 1 },
        { from: 5, to: null, amount: 2 },
      ]),
    ).toMatch(/buraco/)
    expect(validateTiers([{ from: 2, to: null, amount: 1 }])).toMatch(/começar em 1/)
  })
})

describe('transições de status (espelho do banco)', () => {
  it('segue o fluxo', () => {
    expect(canTransition('novo', 'em_cotacao')).toBe(true)
    expect(canTransition('novo', 'aprovado')).toBe(false)
    expect(canTransition('enviado', 'aprovado')).toBe(true)
    expect(nextStatuses('aprovado')).toEqual(['cancelado'])
  })
})

describe('templates de mensagem', () => {
  it('substitui variáveis e remove as desconhecidas', () => {
    expect(renderTemplate('Olá, {{nome}}! Pedido {{ codigo }}. {{nada}}', { nome: 'Ana', codigo: 'COT-000001' })).toBe(
      'Olá, Ana! Pedido COT-000001. ',
    )
  })
  it('limpa linhas vazias repetidas', () => {
    expect(renderTemplate('A\n\n{{mensagem}}\n\nB', { mensagem: '' })).toBe('A\n\nB')
  })
})

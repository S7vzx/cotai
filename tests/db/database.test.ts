import { beforeEach, describe, expect, it } from 'vitest'
import { as, createDb, createUser, type Db } from './harness'

let db: Db
let admin: string
let cotador: string
let comprador: string

const svc = { role: 'service_role' as const }

async function setSettings(sql: string) {
  await db.exec(`update public.settings set ${sql}`)
}

function payload(over: Record<string, unknown> = {}) {
  return {
    customer: { name: 'Ana Souza', company: 'Loja da Ana', whatsapp: '+5579999990001', email: 'ana@loja.com' },
    items: [
      { name: 'Cadeira de escritório', quantity: 10, unit: 'un', target_price: 250, photos: ['tmp/a.jpg'] },
      { name: 'Mesa', quantity: 2, unit: 'un', target_price: 900, photos: [] },
    ],
    accepted_terms: true,
    ...over,
  }
}

async function createRequest(over: Record<string, unknown> = {}, rateKey: string | null = null) {
  const r = await as(db, svc, () =>
    db.query<{ r: { id: string; code: string; public_token: string; status: string; fee: { total: number } } }>(
      'select public.create_quote_request($1, $2) as r',
      [JSON.stringify(payload(over)), rateKey],
    ),
  )
  return r.rows[0].r
}

beforeEach(async () => {
  db = await createDb()
  admin = await createUser(db, 'admin@cotai.com')
  cotador = await createUser(db, 'cotador@cotai.com', 'cotador')
  comprador = await createUser(db, 'comprador@cotai.com', 'comprador')
}, 60_000)

describe('perfis e papéis', () => {
  it('o primeiro usuário vira admin e os demais recebem o papel do convite', async () => {
    const r = await db.query<{ email: string; role: string }>('select email, role from public.profiles order by email')
    expect(r.rows).toEqual([
      { email: 'admin@cotai.com', role: 'admin' },
      { email: 'comprador@cotai.com', role: 'comprador' },
      { email: 'cotador@cotai.com', role: 'cotador' },
    ])
  })

  it('um cotador não consegue se promover a admin', async () => {
    await expect(
      as(db, { role: 'authenticated', userId: cotador }, () =>
        db.query(`update public.profiles set role = 'admin' where id = $1`, [cotador]),
      ),
    ).rejects.toThrow(/Somente administradores/)
  })

  it('o último admin não pode ser rebaixado nem desativado', async () => {
    await expect(
      as(db, { role: 'authenticated', userId: admin }, () => db.query(`update public.profiles set active = false where id = $1`, [admin])),
    ).rejects.toThrow(/pelo menos um administrador/)
  })

  it('can() respeita a matriz de permissões', async () => {
    const q = (u: string, p: string) =>
      as(db, { role: 'authenticated', userId: u }, () => db.query<{ ok: boolean }>('select public.can($1) as ok', [p]))
    expect((await q(admin, 'view_revenue')).rows[0].ok).toBe(true)
    expect((await q(cotador, 'view_revenue')).rows[0].ok).toBe(false)
    expect((await q(cotador, 'send_quote')).rows[0].ok).toBe(true)
    expect((await q(comprador, 'manage_purchases')).rows[0].ok).toBe(true)
    expect((await q(comprador, 'view_costs')).rows[0].ok).toBe(false)
  })
})

describe('cálculo da taxa', () => {
  const fee = async (n: number, coupon: string | null = null) =>
    (
      await db.query<{ f: { base: number; discount: number; total: number; coupon_error: string | null } }>(
        'select public.calculate_fee($1, $2) as f',
        [n, coupon],
      )
    ).rows[0].f

  it('é zero com a cobrança desativada (padrão)', async () => {
    expect((await fee(3)).total).toBe(0)
  })

  it('valor fixo por pedido', async () => {
    await setSettings(`charge_enabled = true, fee_model = 'fixo_pedido', fee_fixed = 35`)
    expect((await fee(1)).total).toBe(35)
    expect((await fee(8)).total).toBe(35)
  })

  it('valor por produto com teto', async () => {
    await setSettings(`charge_enabled = true, fee_model = 'por_produto', fee_per_item = 15, fee_per_item_max = 60`)
    expect((await fee(2)).total).toBe(30)
    expect((await fee(10)).total).toBe(60)
  })

  it('faixas por quantidade', async () => {
    await setSettings(`charge_enabled = true, fee_model = 'faixas',
      fee_tiers = '[{"from":1,"to":3,"amount":20},{"from":4,"to":10,"amount":45},{"from":11,"to":null,"amount":80}]'`)
    expect((await fee(2)).total).toBe(20)
    expect((await fee(4)).total).toBe(45)
    expect((await fee(25)).total).toBe(80)
  })

  it('aplica cupom percentual e fixo, e recusa cupom esgotado', async () => {
    await setSettings(`charge_enabled = true, fee_model = 'fixo_pedido', fee_fixed = 40`)
    await db.exec(`insert into public.coupons (code, discount_type, value) values ('METADE', 'percent', 50)`)
    await db.exec(`insert into public.coupons (code, discount_type, value) values ('DEZ', 'fixed', 10)`)
    await db.exec(`insert into public.coupons (code, discount_type, value, max_uses, used_count) values ('FIM', 'fixed', 10, 1, 1)`)
    expect((await fee(1, 'metade')).total).toBe(20)
    expect((await fee(1, 'DEZ')).total).toBe(30)
    expect((await fee(1, 'FIM')).coupon_error).toBe('Cupom esgotado')
    expect((await fee(1, 'NAOEXISTE')).coupon_error).toBe('Cupom inválido')
  })
})

describe('criação de pedido', () => {
  it('sem cobrança, o pedido nasce como "novo" e isento', async () => {
    const r = await createRequest()
    expect(r.status).toBe('novo')
    expect(r.code).toMatch(/^COT-\d{6}$/)
    const items = await db.query('select * from public.quote_items where request_id = $1', [r.id])
    expect(items.rows).toHaveLength(2)
    const photos = await db.query('select * from public.quote_item_photos')
    expect(photos.rows).toHaveLength(1)
  })

  it('com cobrança antes de cotar, aguarda pagamento até a confirmação', async () => {
    await setSettings(`charge_enabled = true, fee_fixed = 50`)
    const r = await createRequest()
    expect(r.status).toBe('aguardando_pagamento')

    // não dá para pular o pagamento
    await expect(
      as(db, { role: 'authenticated', userId: cotador }, () =>
        db.query(`update public.quote_requests set status = 'novo' where id = $1`, [r.id]),
      ),
    ).rejects.toThrow(/Confirme o pagamento/)

    await as(db, { role: 'authenticated', userId: cotador }, () => db.query('select public.mark_request_paid($1)', [r.id]))
    const after = await db.query<{ status: string; payment_status: string }>(
      'select status, payment_status from public.quote_requests where id = $1',
      [r.id],
    )
    expect(after.rows[0]).toEqual({ status: 'novo', payment_status: 'pago' })
  })

  it('reaproveita o cliente pelo e-mail', async () => {
    await createRequest()
    await createRequest({ customer: { name: 'Ana S.', whatsapp: '+5579999990002', email: 'ANA@loja.com' } })
    const c = await db.query('select * from public.customers')
    expect(c.rows).toHaveLength(1)
  })

  it('cliente isento não paga', async () => {
    await setSettings(`charge_enabled = true, fee_fixed = 50`)
    await createRequest()
    await db.exec(`update public.customers set fee_exempt = true`)
    const r = await createRequest()
    expect(r.status).toBe('novo')
    expect(Number(r.fee.total)).toBe(0)
  })

  it('bloqueia excesso de pedidos pela mesma chave', async () => {
    for (let i = 0; i < 5; i++) await createRequest({}, 'ip:1.2.3.4')
    await expect(createRequest({}, 'ip:1.2.3.4')).rejects.toThrow(/Muitos pedidos/)
  })

  it('exige aceite dos termos', async () => {
    await expect(createRequest({ accepted_terms: false })).rejects.toThrow(/aceitar os termos/)
  })

  it('distribui por rodízio quando configurado', async () => {
    await setSettings(`assignment_mode = 'rodizio'`)
    const r = await createRequest()
    const q = await db.query<{ assigned_to: string }>('select assigned_to from public.quote_requests where id = $1', [r.id])
    expect(q.rows[0].assigned_to).toBe(cotador)
  })

  it('pedidos não pagos expiram depois do prazo', async () => {
    await setSettings(`charge_enabled = true, fee_fixed = 50`)
    const r = await createRequest()
    await db.query(`update public.quote_requests set payment_due_at = now() - interval '1 hour' where id = $1`, [r.id])
    const n = await db.query<{ n: number }>('select public.expire_unpaid_requests() as n')
    expect(n.rows[0].n).toBe(1)
    const h = await db.query<{ note: string }>(`select note from public.status_history where to_status = 'cancelado'`)
    expect(h.rows[0].note).toBe('Prazo de pagamento expirado')
  })
})

describe('segurança (RLS)', () => {
  it('anon não lê nenhuma tabela', async () => {
    await createRequest()
    for (const t of ['quote_requests', 'customers', 'settings', 'quote_options', 'profiles']) {
      await expect(as(db, { role: 'anon' }, () => db.query(`select * from public.${t}`))).rejects.toThrow(/permission denied/)
    }
  })

  it('anon só executa get_public_settings', async () => {
    const r = await as(db, { role: 'anon' }, () => db.query<{ s: { display_name: string } }>('select public.get_public_settings() as s'))
    expect(r.rows[0].s.display_name).toBe('Cotaí')
    await expect(as(db, { role: 'anon' }, () => db.query(`select public.create_quote_request('{}')`))).rejects.toThrow(/permission denied/)
    await expect(as(db, { role: 'anon' }, () => db.query(`select public.get_public_quote('x')`))).rejects.toThrow(/permission denied/)
  })

  it('comprador não lê opções (custos) direto da tabela', async () => {
    const r = await createRequest()
    await db.query(
      `insert into public.quote_options (item_id, supplier_name, cost_price, sale_price)
                    select id, 'Fornecedor X', 100, 200 from public.quote_items where request_id = $1`,
      [r.id],
    )
    const rows = await as(db, { role: 'authenticated', userId: comprador }, () => db.query('select * from public.quote_options'))
    expect(rows.rows).toHaveLength(0)
    const viaFn = await as(db, { role: 'authenticated', userId: comprador }, () =>
      db.query<{ o: Record<string, unknown> }>('select public.quote_options_for_staff($1) as o', [r.id]),
    )
    expect(viaFn.rows).toHaveLength(2)
    expect(viaFn.rows[0].o).not.toHaveProperty('cost_price')
    expect(viaFn.rows[0].o).toHaveProperty('sale_price')
  })

  it('somente admin altera configurações', async () => {
    const upd = (u: string) =>
      as(db, { role: 'authenticated', userId: u }, () => db.query(`update public.settings set fee_fixed = 99 returning fee_fixed`))
    expect((await upd(cotador)).rows).toHaveLength(0)
    expect((await upd(admin)).rows).toHaveLength(1)
  })

  it('usuário inativo perde o acesso', async () => {
    await db.query('update public.profiles set active = false where id = $1', [cotador])
    await createRequest()
    const r = await as(db, { role: 'authenticated', userId: cotador }, () => db.query('select * from public.quote_requests'))
    expect(r.rows).toHaveLength(0)
  })
})

describe('transições de status', () => {
  it('impede pular etapas', async () => {
    const r = await createRequest()
    await expect(
      as(db, { role: 'authenticated', userId: cotador }, () =>
        db.query(`update public.quote_requests set status = 'aprovado' where id = $1`, [r.id]),
      ),
    ).rejects.toThrow(/Transição de status não permitida/)
  })

  it('registra o histórico com o autor', async () => {
    const r = await createRequest()
    await as(db, { role: 'authenticated', userId: cotador }, () =>
      db.query(`update public.quote_requests set status = 'em_cotacao' where id = $1`, [r.id]),
    )
    const h = await db.query<{ from_status: string; to_status: string; changed_by: string }>(
      'select from_status, to_status, changed_by from public.status_history where entity_id = $1 order by created_at',
      [r.id],
    )
    expect(h.rows.map((x) => x.to_status)).toEqual(['novo', 'em_cotacao'])
    expect(h.rows[1].changed_by).toBe(cotador)
  })
})

describe('cotação pública', () => {
  async function sentQuote() {
    const r = await createRequest()
    await db.query(
      `insert into public.quote_options (item_id, label, supplier_name, cost_price, sale_price, internal_notes, position)
                    select id, l.label, 'Fornecedor', 100, l.price, 'segredo', l.pos
                    from public.quote_items i
                    cross join (values ('A', 240, 0), ('B', 230, 1)) as l(label, price, pos)
                    where i.request_id = $1`,
      [r.id],
    )
    await db.query(`update public.quote_requests set status = 'em_cotacao' where id = $1`, [r.id])
    await db.query(`update public.quote_requests set status = 'cotado' where id = $1`, [r.id])
    await db.query(`update public.quote_requests set status = 'enviado', valid_until = current_date + 7, sent_at = now() where id = $1`, [
      r.id,
    ])
    return r
  }

  it('não expõe campos internos', async () => {
    const r = await sentQuote()
    const q = await as(db, svc, () => db.query<{ q: unknown }>('select public.get_public_quote($1) as q', [r.public_token]))
    const json = JSON.stringify(q.rows[0].q)
    expect(json).not.toContain('cost_price')
    expect(json).not.toContain('segredo')
    expect(json).not.toContain('Fornecedor')
    expect(json).toContain('sale_price')
  })

  it('só aparece depois de enviada', async () => {
    const r = await createRequest()
    const q = await as(db, svc, () => db.query<{ q: unknown }>('select public.get_public_quote($1) as q', [r.public_token]))
    expect(q.rows[0]?.q ?? null).toBeNull()
  })

  it('aprovação exige uma opção por produto e cria as tarefas de compra', async () => {
    const r = await sentQuote()
    await expect(as(db, svc, () => db.query(`select public.respond_quote($1, 'aprovar', '{}')`, [r.public_token]))).rejects.toThrow(
      /Escolha uma opção/,
    )

    const opts = await db.query<{ item_id: string; id: string }>(`select o.item_id, o.id from public.quote_options o where o.label = 'B'`)
    const selections = Object.fromEntries(opts.rows.map((o) => [o.item_id, o.id]))
    const res = await as(db, svc, () =>
      db.query<{ r: { status: string; purchase_tasks: number } }>(`select public.respond_quote($1, 'aprovar', $2) as r`, [
        r.public_token,
        JSON.stringify(selections),
      ]),
    )
    expect(res.rows[0].r).toMatchObject({ status: 'aprovado', purchase_tasks: 2 })

    const tasks = await db.query('select * from public.purchase_tasks')
    expect(tasks.rows).toHaveLength(2)

    // o comprador vê o quadro de compras, mas sem custo
    const board = await as(db, { role: 'authenticated', userId: comprador }, () =>
      db.query<{ b: { option: Record<string, unknown>; code: string } }>('select public.purchase_board() as b'),
    )
    expect(board.rows).toHaveLength(2)
    expect(board.rows[0].b.option.sale_price).toBe(230)
    expect(board.rows[0].b.option.cost_price).toBeNull()
    const adminBoard = await as(db, { role: 'authenticated', userId: admin }, () =>
      db.query<{ b: { option: Record<string, unknown> } }>('select public.purchase_board() as b'),
    )
    expect(adminBoard.rows[0].b.option.cost_price).toBe(100)
    // e pode atualizar o status da compra
    const upd = await as(db, { role: 'authenticated', userId: comprador }, () =>
      db.query(`update public.purchase_tasks set status = 'comprado' returning id`),
    )
    expect(upd.rows).toHaveLength(2)
    await expect(as(db, svc, () => db.query(`select public.respond_quote($1, 'recusar')`, [r.public_token]))).rejects.toThrow(
      /já foi respondida/,
    )
  })

  it('recusa guarda o motivo', async () => {
    const r = await sentQuote()
    await as(db, svc, () => db.query(`select public.respond_quote($1, 'recusar', '{}', 'Caro demais')`, [r.public_token]))
    const q = await db.query<{ status: string; decline_reason: string }>('select status, decline_reason from public.quote_requests')
    expect(q.rows[0]).toEqual({ status: 'recusado', decline_reason: 'Caro demais' })
  })

  it('cotação expirada não pode ser aprovada', async () => {
    const r = await sentQuote()
    await db.query(`update public.quote_requests set valid_until = current_date - 1`)
    await expect(as(db, svc, () => db.query(`select public.respond_quote($1, 'recusar')`, [r.public_token]))).rejects.toThrow(/expirou/)
  })

  it('acompanhamento exige código e token corretos', async () => {
    const r = await createRequest()
    const ok = await as(db, svc, () =>
      db.query<{ t: { code: string } | null }>('select public.get_request_tracking($1, $2) as t', [r.code.toLowerCase(), r.public_token]),
    )
    expect(ok.rows[0].t?.code).toBe(r.code)
    const bad = await as(db, svc, () => db.query<{ t: unknown }>('select public.get_request_tracking($1, $2) as t', [r.code, 'errado']))
    expect(bad.rows[0]?.t ?? null).toBeNull()
  })
})

describe('auditoria', () => {
  it('registra cada campo alterado nas configurações', async () => {
    await as(db, { role: 'authenticated', userId: admin }, () =>
      db.query(`update public.settings set fee_fixed = 42, charge_enabled = true`),
    )
    const a = await db.query<{ field: string; user_id: string }>(
      `select field, user_id from public.audit_log where entity = 'settings' order by field`,
    )
    expect(a.rows.map((r) => r.field)).toEqual(['charge_enabled', 'fee_fixed'])
    expect(a.rows[0].user_id).toBe(admin)
  })

  it('cria o fornecedor automaticamente ao usar um nome novo', async () => {
    const r = await createRequest()
    await db.query(
      `insert into public.quote_options (item_id, supplier_name, sale_price)
                    select id, 'Atacado Sergipe', 10 from public.quote_items where request_id = $1`,
      [r.id],
    )
    const s = await db.query('select name from public.suppliers')
    expect(s.rows).toEqual([{ name: 'Atacado Sergipe' }])
  })
})

describe('catálogos', () => {
  it('não aceita duas categorias com o mesmo nome, ignorando maiúsculas e espaços', async () => {
    await db.exec(`insert into public.categories (name) values ('Informática')`)
    await expect(db.exec(`insert into public.categories (name) values (' informática ')`)).rejects.toThrow(/categories_name_key/)
    await db.exec(`insert into public.categories (name) values ('INFORMÁTICA') on conflict do nothing`)
    const c = await db.query('select name from public.categories')
    expect(c.rows).toEqual([{ name: 'Informática' }])
  })
})

describe('painel', () => {
  it('dashboard_stats esconde a receita de quem não tem permissão', async () => {
    await createRequest()
    const forCotador = await as(db, { role: 'authenticated', userId: cotador }, () =>
      db.query<{ s: { fee_revenue_month: number | null; new_today: number } }>('select public.dashboard_stats() as s'),
    )
    expect(forCotador.rows[0].s.fee_revenue_month).toBeNull()
    expect(forCotador.rows[0].s.new_today).toBe(1)
    const forAdmin = await as(db, { role: 'authenticated', userId: admin }, () =>
      db.query<{ s: { fee_revenue_month: number | null } }>('select public.dashboard_stats() as s'),
    )
    expect(forAdmin.rows[0].s.fee_revenue_month).toBe(0)
  })
})

describe('paridade entre banco e front-end', () => {
  it('transições de status são idênticas às de src/lib/status.ts', async () => {
    const { canTransition } = await import('../../src/lib/status')
    const statuses = [
      'aguardando_pagamento',
      'novo',
      'em_cotacao',
      'cotado',
      'enviado',
      'aprovado',
      'recusado',
      'nao_encontrado',
      'cancelado',
    ] as const
    const r = await db.query<{ a: string; b: string; ok: boolean }>(
      `select a::text, b::text, public.quote_transition_allowed(a, b) as ok
       from unnest(enum_range(null::public.quote_status)) a, unnest(enum_range(null::public.quote_status)) b`,
    )
    expect(r.rows).toHaveLength(statuses.length ** 2)
    for (const row of r.rows) {
      expect([row.a, row.b, canTransition(row.a as never, row.b as never)]).toEqual([row.a, row.b, row.ok])
    }
  })

  it('o preview da taxa bate com public.calculate_fee', async () => {
    const { previewFee } = await import('../../src/lib/fee')
    const configs = [
      { model: 'fixo_pedido', fixed: 47.5, per_item: 0, per_item_max: null, tiers: [] },
      { model: 'por_produto', fixed: 0, per_item: 12.3, per_item_max: 80, tiers: [] },
      { model: 'por_produto', fixed: 0, per_item: 9.99, per_item_max: null, tiers: [] },
      {
        model: 'faixas',
        fixed: 0,
        per_item: 0,
        per_item_max: null,
        tiers: [
          { from: 1, to: 2, amount: 15 },
          { from: 3, to: 9, amount: 39.9 },
          { from: 10, to: null, amount: 70 },
        ],
      },
    ] as const
    for (const c of configs) {
      await db.query(
        `update public.settings set charge_enabled = true, fee_model = $1, fee_fixed = $2, fee_per_item = $3, fee_per_item_max = $4, fee_tiers = $5`,
        [c.model, c.fixed, c.per_item, c.per_item_max, JSON.stringify(c.tiers)],
      )
      for (const n of [1, 2, 3, 9, 10, 25]) {
        const r = await db.query<{ f: { total: number } }>('select public.calculate_fee($1) as f', [n])
        expect(Number(r.rows[0].f.total)).toBeCloseTo(previewFee({ enabled: true, ...c, tiers: [...c.tiers] }, n), 2)
      }
    }
  })
})

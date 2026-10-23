import { expect, test, type Page } from '@playwright/test'
import { COMPRADOR_ID, publicSettings, tracking } from './fixtures'
import { mockSupabase, signIn } from './mock-supabase'

// Capturas de tela opcionais (SCREENSHOTS=1) para revisão visual.
async function shot(page: Page, name: string, fullPage = true) {
  if (!process.env.SCREENSHOTS) return
  if (fullPage) {
    // rola a página para disparar as animações de entrada das seções
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      window.scrollTo(0, 0)
    })
  }
  await page.waitForTimeout(2600) // animações de entrada
  await page.screenshot({ path: `screenshots/${test.info().project.name}-${name}.png`, fullPage })
}

// Pedido com cobrança: Pix automático e cartão liberados em Ajustes → Cobrança
const payWithCard = { ...publicSettings, charge: { ...publicSettings.charge, methods: ['pix_auto', 'cartao'] } }
const pending = { ...tracking, status: 'aguardando_pagamento', history: [{ status: 'aguardando_pagamento', at: tracking.created_at }] }
const created = (payment: Record<string, unknown> | null) => ({
  code: 'COT-000129',
  token: 'tok129',
  status: 'aguardando_pagamento',
  fee: { total: 35, base: 35, discount: 0 },
  payment,
  payment_error: false,
  pix_manual: null,
  tracking_url: 'http://localhost:5173/pedido/COT-000129?t=tok129',
})

// Formulário de cartão da AbacatePay simulado: um campo e um token fixo
async function mockCardForm(page: Page) {
  await page.route('https://abacatepay.com/abacatepay.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.AbacatePay = { create: () => ({
        mount: (el) => { el.innerHTML = '<label>Número do cartão <input value="4242 4242 4242 4242"></label>'; return Promise.resolve() },
        tokenize: (payer) => { window.__payer = payer; return Promise.resolve({ token: 'ctok_e2e', brand: 'VISA', lastFour: '4242' }) },
        destroy: () => {},
      }) }`,
    }),
  )
}

async function fillOrder(page: Page) {
  await page.goto('/cotar')
  await page.getByLabel('Nome completo').fill('Bruno Carvalho')
  await page.getByLabel('Empresa').fill('Clínica Vida')
  await page.getByLabel('WhatsApp').fill('79977776666')
  await page.getByLabel('E-mail').fill('bruno@clinicavida.com.br')
  await page.getByLabel('CPF ou CNPJ').fill('52998224725')
  await page.getByRole('button', { name: 'Continuar' }).click()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file][multiple]').first().setInputFiles({ name: 'cadeira.png', mimeType: 'image/png', buffer: png })
  await page.getByLabel('Qual é o produto?').fill('Cadeira de escritório')
  await page.getByLabel('Quantidade').fill('2')
  await page.locator('input[inputmode=numeric][placeholder="0,00"]').fill('16000')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('complementary', { name: 'Pagamento' })).toBeVisible()
}

test.describe('site público', () => {
  test('landing mostra os textos fixos e a taxa vinda das configurações', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mande a foto. A gente acha o preço.')
    await expect(page.getByRole('link', { name: /Solicitar cotação — R\$\s?35,00/ }).first()).toBeVisible()
    await expect(page.getByText('Como funciona.', { exact: true })).toBeVisible()
    // nenhuma fonte serifada
    const fonts = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,p,a,button')].map((el) => getComputedStyle(el).fontFamily),
    )
    expect(fonts.some((f) => /serif/i.test(f) && !/sans-serif/i.test(f))).toBe(false)
    await shot(page, 'landing')
  })

  test('cliente envia um pedido completo pelo formulário', async ({ page }) => {
    const calls = await mockSupabase(page, { overrides: { '/functions/v1/public-request': pending } })
    await page.goto('/cotar')
    await shot(page, 'cotar-1-dados', false)

    // etapa 1 — validação
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe seu nome')).toBeVisible()
    await page.getByLabel('Nome completo').fill('Bruno Carvalho')
    await page.getByLabel('Empresa').fill('Clínica Vida')
    await page.getByLabel('WhatsApp').fill('79977776666')
    await expect(page.getByLabel('WhatsApp')).toHaveValue('(79) 97777-6666')
    await page.getByLabel('E-mail').fill('bruno@clinicavida.com.br')
    await page.getByLabel('CPF ou CNPJ').fill('52998224724')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('CPF ou CNPJ inválido')).toBeVisible()
    await page.getByLabel('CPF ou CNPJ').fill('52998224725')
    await expect(page.getByLabel('CPF ou CNPJ')).toHaveValue('529.982.247-25')
    await page.getByRole('button', { name: 'Continuar' }).click()

    // etapa 2 — produto com foto
    await expect(page.getByRole('heading', { name: 'Produto 1' })).toBeVisible()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    await page.locator('input[type=file][multiple]').first().setInputFiles({ name: 'cadeira.png', mimeType: 'image/png', buffer: png })
    await page.getByLabel('Qual é o produto?').fill('Cadeira de escritório')
    await page.getByLabel('Quantidade').fill('20')
    await page.locator('input[inputmode=numeric][placeholder="0,00"]').fill('16000')
    await expect(page.getByText(/Total-alvo:/)).toContainText('3.200,00')
    // estado aceito: "Novo" vem marcado; sem nenhum, não avança
    await expect(page.getByRole('button', { name: 'Novo', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Novo', exact: true }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Escolha pelo menos um estado')).toBeVisible()
    await page.getByRole('button', { name: 'Seminovo' }).click()
    await expect(page.getByText('Escolha pelo menos um estado')).toHaveCount(0)
    await page.getByRole('button', { name: 'Seminovo' }).click()
    await page.getByRole('button', { name: 'Seminovo' }).click()
    await page.getByRole('button', { name: '99% novo' }).click()
    await shot(page, 'cotar-2-produtos', false)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // etapa 3 — resumo, cupom e envio
    await expect(page.getByText('Taxa de cotação')).toBeVisible()
    await page.getByRole('button', { name: 'Tenho um cupom' }).click()
    await page.getByPlaceholder('Código do cupom').fill('BEMVINDO')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText(/de desconto/)).toBeVisible()
    await page.getByRole('button', { name: /^Pagar R\$/ }).click()
    await expect(page.getByText('É preciso aceitar os termos')).toBeVisible()
    await page.getByRole('checkbox').click()
    await shot(page, 'cotar-3-resumo', false)
    await page.getByRole('button', { name: /^Pagar R\$/ }).click()

    await expect(page.getByRole('heading', { name: 'Falta só o pagamento' })).toBeVisible()
    await expect(page.getByText('COT-000129')).toBeVisible()
    await expect(page.getByText('Pagamento via Pix')).toBeVisible()
    await shot(page, 'cotar-4-sucesso')

    const sent = calls.find((c) => c.path.includes('create-quote-request'))?.body as {
      customer: { whatsapp: string }
      items: { photos: string[]; target_price: number; accepted_conditions: string[] }[]
      coupon: string
    }
    expect(sent.customer.whatsapp).toBe('+5579977776666')
    expect(sent.items[0].target_price).toBe(160)
    expect(sent.items[0].photos).toHaveLength(1)
    expect(sent.items[0].accepted_conditions).toEqual(['quase_novo', 'seminovo'])
    expect(sent.coupon).toBe('BEMVINDO')
  })

  test('cartão: o cliente digita o cartão no resumo e o pagamento é confirmado na hora', async ({ page }) => {
    await mockCardForm(page)
    const calls = await mockSupabase(page, {
      overrides: {
        '/rest/v1/rpc/get_public_settings': payWithCard,
        '/functions/v1/create-quote-request': {
          ...created({
            provider: 'abacatepay',
            method: 'cartao_abacatepay',
            payment_id: 'card_abc123',
            qr_code: null,
            qr_code_image: null,
            checkout_url: null,
            expires_at: null,
            status: 'APPROVED',
            card: { brand: 'VISA', last_four: '4242' },
          }),
          status: 'novo',
        },
      },
    })
    await fillOrder(page)

    const methods = page.getByRole('radiogroup', { name: 'Forma de pagamento' })
    await expect(methods.getByRole('radio', { name: /Pix/ })).toHaveAttribute('aria-checked', 'true')
    await methods.getByRole('radio', { name: /Cartão de crédito/ }).click()
    await expect(page.getByLabel('Número do cartão')).toBeVisible()
    await shot(page, 'cotar-3-cartao', false)
    await page.getByRole('checkbox', { name: /termos/ }).click()
    await page.getByRole('button', { name: /^Pagar R\$/ }).click()

    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible()
    await shot(page, 'cotar-4-cartao-aprovado')
    const sent = calls.find((c) => c.path.includes('create-quote-request'))?.body as { payment_method: string; card_token: string }
    expect(sent.payment_method).toBe('card')
    expect(sent.card_token).toBe('ctok_e2e')
    // o pagador vai completo para o abacatepay.js (a cobrança exige os quatro campos)
    expect(await page.evaluate(() => (window as unknown as { __payer: unknown }).__payer)).toEqual({
      name: 'Bruno Carvalho',
      email: 'bruno@clinicavida.com.br',
      taxId: '529.982.247-25',
      cellphone: '+5579977776666',
    })
  })

  test('cartão recusado: o pedido fica salvo e o cliente paga com Pix', async ({ page }) => {
    await mockCardForm(page)
    await mockSupabase(page, {
      overrides: {
        '/rest/v1/rpc/get_public_settings': payWithCard,
        '/functions/v1/create-quote-request': {
          ...created(null),
          payment_error: 'Cartão recusado. Confira os dados ou use outro cartão.',
        },
        '/functions/v1/create-pix-charge': {
          provider: 'abacatepay',
          method: 'pix_abacatepay',
          payment_id: 'pix_char_abc123',
          qr_code: '00020126580014BR.GOV.BCB.PIX0136cotai-teste',
          qr_code_image: null,
          checkout_url: null,
          expires_at: null,
        },
        '/functions/v1/public-request': pending,
      },
    })
    await fillOrder(page)
    await page
      .getByRole('radiogroup', { name: 'Forma de pagamento' })
      .getByRole('radio', { name: /Cartão de crédito/ })
      .click()
    await expect(page.getByLabel('Número do cartão')).toBeVisible()
    await page.getByRole('checkbox', { name: /termos/ }).click()
    await page.getByRole('button', { name: /^Pagar R\$/ }).click()

    await expect(page.getByRole('heading', { name: 'Pagamento não concluído' })).toBeVisible()
    await expect(page.getByText('Cartão recusado. Confira os dados ou use outro cartão.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tentar com outro cartão' })).toBeVisible()
    await shot(page, 'cotar-4-cartao-recusado')
    await page.getByRole('button', { name: 'Pagar com Pix' }).click()
    await expect(page.getByText('00020126580014BR.GOV.BCB.PIX0136cotai-teste')).toBeVisible()
  })

  test('Pix: mostra o QR Code e confirma o pagamento sozinho', async ({ page }) => {
    let polls = 0
    const calls = await mockSupabase(page, {
      overrides: {
        '/rest/v1/rpc/get_public_settings': payWithCard,
        '/functions/v1/create-quote-request': created({
          provider: 'abacatepay',
          method: 'pix_abacatepay',
          payment_id: 'pix_char_abc123',
          qr_code: '00020126580014BR.GOV.BCB.PIX0136cotai-teste',
          qr_code_image: null,
          checkout_url: null,
          expires_at: null,
        }),
      },
    })
    // As duas primeiras consultas ainda pendentes; depois o servidor confirma o pagamento
    await page.route('**/functions/v1/public-request', (route) => {
      polls += 1
      const body =
        polls <= 2 ? pending : { ...tracking, status: 'novo', history: [...pending.history, { status: 'novo', at: tracking.created_at }] }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } })
    })
    await fillOrder(page)
    await page.getByRole('checkbox', { name: /termos/ }).click()
    await page.getByRole('button', { name: /^Pagar R\$/ }).click()

    await expect(page.getByRole('heading', { name: 'Falta só o pagamento' })).toBeVisible()
    await expect(page.getByText('00020126580014BR.GOV.BCB.PIX0136cotai-teste')).toBeVisible()
    await expect(page.getByText('Chave Pix')).toHaveCount(0)
    await shot(page, 'cotar-4-pix')
    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible({ timeout: 15_000 })
    await shot(page, 'cotar-5-confirmado')

    const sent = calls.find((c) => c.path.includes('create-quote-request'))?.body as { payment_method: string }
    expect(sent.payment_method).toBe('pix')
  })

  test('acompanhamento mostra o pagamento confirmado', async ({ page }) => {
    await mockSupabase(page, {
      overrides: {
        '/functions/v1/public-request': {
          ...tracking,
          history: [{ status: 'aguardando_pagamento', at: tracking.created_at }, ...tracking.history],
        },
      },
    })
    await page.goto('/pedido/COT-000125?t=tok125')
    await expect(page.getByText('Pagamento confirmado')).toBeVisible()
  })

  test('acompanhamento do pedido', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/pedido/COT-000125?t=tok125')
    await expect(page.getByRole('heading', { name: /COT-000125/ })).toBeVisible()
    await expect(page.getByText('Em cotação')).toBeVisible()
    await shot(page, 'pedido')
  })

  test('acompanhamento leva ao checkout da AbacatePay quando o pagamento está pendente', async ({ page }) => {
    const checkoutUrl = 'https://app.abacatepay.com/pay/bill_abc123xyz'
    await mockSupabase(page, {
      overrides: {
        '/functions/v1/public-request': {
          ...tracking,
          status: 'aguardando_pagamento',
          payment: {
            amount: 35,
            due_at: null,
            pix_key: null,
            pix_key_type: null,
            pix_receiver_name: null,
            pix_instructions: null,
            moment: 'antes',
            charge: {
              provider: 'abacatepay',
              method: 'checkout_abacatepay',
              payment_id: 'bill_abc123xyz',
              qr_code: null,
              qr_code_image: null,
              checkout_url: checkoutUrl,
              expires_at: null,
            },
          },
        },
      },
    })
    await page.goto('/pedido/COT-000125?t=tok125')
    await expect(page.getByText('Pagamento da taxa')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pagar agora' })).toHaveAttribute('href', checkoutUrl)
  })

  test('cliente entra com código e vê as próprias cotações', async ({ page }) => {
    const calls = await mockSupabase(page)
    await page.goto('/')
    await expect(page.getByText('Área da equipe')).toHaveCount(0)
    await page.goto('/minhas-cotacoes')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('E-mail').fill('bruno@clinicavida.com.br')
    await page.getByRole('button', { name: 'Enviar código' }).click()
    const otp = calls.find((c) => c.path.startsWith('/auth/v1/otp'))?.body as { email: string; data: { kind: string } }
    expect(otp.email).toBe('bruno@clinicavida.com.br')
    expect(otp.data.kind).toBe('customer')

    await page.getByLabel('Código').fill('000000')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Código inválido ou expirado')).toBeVisible()
    await page.getByLabel('Código').fill('123456')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { name: 'Minhas cotações' })).toBeVisible()
    await expect(page.getByText('Cotação pronta')).toBeVisible()
    await expect(page.getByRole('link', { name: /COT-000123/ })).toHaveAttribute('href', '/cotacao/tok123')
    await expect(page.getByRole('link', { name: /COT-000125/ })).toHaveAttribute('href', '/pedido/COT-000125?t=tok125')
    await expect(page.getByText('Recompra de COT-000122')).toBeVisible()
    await expect(page.getByText('Confirmando preço')).toBeVisible()
    await shot(page, 'minhas-cotacoes')

    // recompra: tira a touca, muda a quantidade do avental
    await page.getByRole('button', { name: 'Comprar de novo' }).click()
    await expect(page.getByText('Fabricante na China')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Incluir Touca descartável' }).click()
    await page.getByLabel('Quantidade').first().fill('40')
    await expect(page.getByText('R$ 900,00')).toBeVisible()
    await shot(page, 'recompra', false)
    await page.getByRole('button', { name: 'Pedir recompra' }).click()
    await expect(page.getByText(/Recompra COT-000131 enviada/)).toBeVisible()
    const sent = calls.find((c) => c.path.endsWith('/rpc/create_rebuy'))?.body as { p_code: string; p_items: unknown }
    expect(sent).toEqual({ p_code: 'COT-000122', p_items: [{ item_id: 'i8', quantity: 40 }] })
  })

  test('equipe entra por /admin', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/painel')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Área da equipe' })).toBeVisible()
  })

  test('cliente compara opções e aprova a cotação', async ({ page }) => {
    const calls = await mockSupabase(page)
    await page.goto('/cotacao/tok123')
    await expect(page.getByRole('heading', { name: 'Cotação COT-000123' })).toBeVisible()
    // opção mais barata pré-selecionada; total com taxa abatida
    await expect(page.getByText('Taxa de cotação abatida')).toBeVisible()
    await expect(page.getByText('Não encontramos este produto pelo preço-alvo.')).toBeVisible()
    await expect(page.getByText('Fabricante na China')).toBeVisible()
    await shot(page, 'cotacao')
    await page.getByRole('radio', { name: /Opção B/ }).check()
    await page.getByRole('button', { name: /Aprovar/ }).click()
    await expect
      .poll(() => {
        const approve = calls.find((c) => c.path.includes('public-quote') && (c.body as { action?: string }).action === 'aprovar')
        return (approve?.body as { selections?: Record<string, string> } | undefined)?.selections
      })
      .toEqual({ q1: 'qo2', q2: 'qo3' })
  })
})

test.describe('painel', () => {
  test('dashboard', async ({ page }) => {
    await signIn(page)
    await mockSupabase(page)
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: /Marina/ })).toBeVisible()
    await expect(page.getByText('Receita de taxas no mês')).toBeVisible()
    await shot(page, 'painel-dashboard')
  })

  test('kanban de cotações', async ({ page }) => {
    await signIn(page)
    await mockSupabase(page)
    await page.goto('/painel/tarefas')
    await expect(page.getByRole('heading', { name: 'Cotações' })).toBeVisible()
    await expect(page.getByText('Clínica Vida').first()).toBeVisible()
    await shot(page, 'painel-kanban', false)
    await page.getByRole('radio', { name: /Lista/ }).click()
    await expect(page.getByRole('columnheader', { name: /Código/ })).toBeVisible()
    await shot(page, 'painel-lista', false)
  })

  test('detalhe do pedido e envio da cotação', async ({ page }) => {
    await signIn(page)
    const calls = await mockSupabase(page)
    await page.goto('/painel/tarefas/r127')
    await expect(page.getByRole('heading', { name: 'COT-000127' })).toBeVisible()
    await expect(page.getByText('Opção A').first()).toBeVisible()
    // margem calculada e alerta de margem baixa na opção B (5%)
    await expect(page.getByText(/Margem abaixo de 10%/)).toBeVisible()
    await expect(page.getByText('Novo, 99% novo').first()).toBeVisible()
    await expect(page.getByLabel('Origem').nth(1)).toHaveValue('agente_compra')
    await shot(page, 'painel-tarefa')
    await page.getByRole('button', { name: /Enviar ao cliente/ }).click()
    await expect(page.getByText('Prévia do WhatsApp')).toBeVisible()
    await shot(page, 'painel-enviar', false)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByRole('link', { name: /Enviar pelo meu WhatsApp/ })).toBeVisible()
    expect(calls.some((c) => c.path.includes('send-quote'))).toBe(true)
  })

  test('equipe confirma uma recompra', async ({ page }) => {
    await signIn(page)
    const calls = await mockSupabase(page)
    await page.goto('/painel/tarefas/r124')
    await expect(page.getByRole('link', { name: 'COT-000122' })).toBeVisible()
    await expect(page.getByText('Preço na compra anterior: R$ 29,90/un')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar recompra' }).click()
    await expect(page.getByText(/Recompra confirmada/)).toBeVisible()
    expect(calls.find((c) => c.path.endsWith('/rpc/confirm_rebuy'))?.body).toEqual({ p_request_id: 'r124' })
  })

  test('compras', async ({ page }) => {
    await signIn(page)
    await mockSupabase(page)
    await page.goto('/painel/compras')
    await expect(page.getByText('Monitor 24"')).toBeVisible()
    await shot(page, 'painel-compras', false)
  })

  test('comprador não vê Cotações nem Ajustes', async ({ page }) => {
    await signIn(page, COMPRADOR_ID)
    await mockSupabase(page, { userId: COMPRADOR_ID })
    await page.goto('/painel/admin')
    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByRole('link', { name: 'Ajustes' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Cotações' })).toHaveCount(0)
  })
})

test.describe('administração', () => {
  test('cobrança: alterar a taxa exige salvar e grava só o que mudou', async ({ page }) => {
    await signIn(page)
    const calls = await mockSupabase(page)
    await page.goto('/painel/admin/cobranca')
    await expect(page.getByRole('heading', { name: 'Cobrança' })).toBeVisible()
    await shot(page, 'admin-cobranca')
    const fee = page.locator('input[placeholder="0,00"]').first()
    await fee.fill('4990')
    await expect(page.getByText('Alterações não salvas')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect
      .poll(() => calls.find((c) => c.method === 'PATCH' && c.path.startsWith('/rest/v1/settings'))?.body)
      .toEqual({ fee_fixed: 49.9 })
  })

  test('mensagens com prévia', async ({ page }) => {
    await signIn(page)
    await mockSupabase(page)
    await page.goto('/painel/admin/mensagens')
    await expect(page.getByText('Prévia').first()).toBeVisible()
    await shot(page, 'admin-mensagens', false)
  })

  test('equipe e permissões', async ({ page }) => {
    await signIn(page)
    await mockSupabase(page)
    await page.goto('/painel/admin/equipe')
    await expect(page.getByText('Permissões por papel')).toBeVisible()
    await shot(page, 'admin-equipe', false)
  })
})

test.describe('layout responsivo', () => {
  const pages = [
    '/',
    '/cotar',
    '/pedido/COT-000125?t=tok125',
    '/cotacao/tok123',
    '/painel',
    '/painel/tarefas',
    '/painel/tarefas/r127',
    '/painel/compras',
    '/painel/clientes',
    '/painel/clientes/c1',
    '/painel/admin/empresa',
    '/painel/admin/cobranca',
    '/painel/admin/cotacao',
    '/painel/admin/landing',
    '/painel/admin/mensagens',
    '/painel/admin/integracoes',
    '/painel/admin/equipe',
    '/painel/admin/logs',
  ]
  test('nenhuma página tem rolagem horizontal', async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page)
    await mockSupabase(page)
    const problems: string[] = []
    for (const p of pages) {
      await page.goto(p)
      await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(400)
      // o kanban rola horizontalmente dentro do próprio contêiner, não a página
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      if (sw > cw + 1) problems.push(`${p}: ${sw}px > ${cw}px`)
    }
    expect(problems).toEqual([])
  })
})

test('botões fixos cabem na tela do celular', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'só no celular')
  await mockSupabase(page)
  await page.goto('/cotacao/tok123')
  const btn = page.getByRole('button', { name: /Aprovar/ })
  await expect(btn).toBeVisible()
  const box = (await btn.boundingBox())!
  const vw = page.viewportSize()!.width
  expect(box.x + box.width).toBeLessThanOrEqual(vw)
})

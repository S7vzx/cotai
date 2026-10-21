import { expect, test, type Page } from '@playwright/test'
import { COMPRADOR_ID } from './fixtures'
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
    const calls = await mockSupabase(page)
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
    await shot(page, 'cotar-2-produtos', false)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // etapa 3 — resumo, cupom e envio
    await expect(page.getByText('Taxa de cotação')).toBeVisible()
    await page.getByRole('button', { name: 'Tenho um cupom' }).click()
    await page.getByPlaceholder('Código do cupom').fill('BEMVINDO')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText(/de desconto/)).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByText('É preciso aceitar os termos')).toBeVisible()
    await page.getByRole('checkbox').click()
    await shot(page, 'cotar-3-resumo', false)
    await page.getByRole('button', { name: 'Confirmar e pagar' }).click()

    await expect(page.getByRole('heading', { name: 'Pedido recebido' })).toBeVisible()
    await expect(page.getByText('COT-000129')).toBeVisible()
    await expect(page.getByText('Pagamento via Pix')).toBeVisible()
    await shot(page, 'cotar-4-sucesso')

    const sent = calls.find((c) => c.path.includes('create-quote-request'))?.body as {
      customer: { whatsapp: string }
      items: { photos: string[]; target_price: number }[]
      coupon: string
    }
    expect(sent.customer.whatsapp).toBe('+5579977776666')
    expect(sent.items[0].target_price).toBe(160)
    expect(sent.items[0].photos).toHaveLength(1)
    expect(sent.coupon).toBe('BEMVINDO')
  })

  test('acompanhamento do pedido', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/pedido/COT-000125?t=tok125')
    await expect(page.getByRole('heading', { name: /COT-000125/ })).toBeVisible()
    await expect(page.getByText('Em cotação')).toBeVisible()
    await shot(page, 'pedido')
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
    await shot(page, 'minhas-cotacoes')
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
    await shot(page, 'painel-tarefa')
    await page.getByRole('button', { name: /Enviar ao cliente/ }).click()
    await expect(page.getByText('Prévia do WhatsApp')).toBeVisible()
    await shot(page, 'painel-enviar', false)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByRole('link', { name: /Enviar pelo meu WhatsApp/ })).toBeVisible()
    expect(calls.some((c) => c.path.includes('send-quote'))).toBe(true)
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

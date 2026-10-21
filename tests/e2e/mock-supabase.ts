import type { Page, Route } from '@playwright/test'
import * as fx from './fixtures'

export const SUPABASE_URL = 'http://localhost:54321'

/** Imagem de produto de exemplo (SVG simples, tom neutro). */
function photoSvg(seed: string) {
  const hues = [28, 200, 150, 340, 260, 45, 10, 180]
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hues[h % hues.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="hsl(${hue} 18% 92%)"/>
<ellipse cx="200" cy="320" rx="120" ry="16" fill="hsl(${hue} 15% 80%)"/>
<rect x="120" y="110" width="160" height="190" rx="28" fill="hsl(${hue} 35% 52%)"/>
<rect x="140" y="130" width="120" height="60" rx="14" fill="hsl(${hue} 40% 70%)"/>
</svg>`
}

type Json = unknown

/** Sessão salva no localStorage para entrar no painel sem login real. */
export async function signIn(page: Page, userId = fx.ADMIN_ID) {
  const user = fx.team.find((t) => t.id === userId)!
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    user: {
      id: user.id,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: { full_name: user.full_name },
      created_at: user.created_at,
    },
  }
  await page.addInitScript((s) => {
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s))
  }, session)
  return user
}

/**
 * Simula o Supabase (REST, RPC, Edge Functions, Storage e Auth) com os
 * dados de fixtures.ts. Devolve a lista de chamadas para asserções.
 */
export async function mockSupabase(page: Page, opts: { userId?: string; overrides?: Record<string, Json> } = {}) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const userId = opts.userId ?? fx.ADMIN_ID

  const reply = (route: Route, data: Json, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    })

  await page.route('**/__photo/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: photoSvg(route.request().url()) }))

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return reply(route, {})
    const url = new URL(req.url())
    const path = url.pathname
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    let body: unknown = null
    try {
      body = req.postDataJSON()
    } catch {
      body = req.postData()
    }
    calls.push({ method: req.method(), path: path + url.search, body })

    const ov = opts.overrides?.[path]
    if (ov !== undefined) return reply(route, ov)

    // ---- Auth
    if (path.startsWith('/auth/v1/user')) return reply(route, { id: userId, email: fx.team.find((t) => t.id === userId)?.email })
    if (path.startsWith('/auth/v1/verify')) {
      const token = (body as { token?: string })?.token
      if (token !== '123456') return reply(route, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403)
      return reply(route, {
        access_token: 'customer-access-token',
        refresh_token: 'customer-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: fx.CUSTOMER_USER_ID,
          email: (body as { email?: string }).email,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: { kind: 'customer' },
          created_at: new Date().toISOString(),
        },
      })
    }
    if (path.startsWith('/auth/v1/')) return reply(route, {})

    // ---- Storage
    if (path.startsWith('/storage/v1/object/sign/') && req.method() === 'POST') {
      const p = path.replace('/storage/v1/object/sign/', '')
      return reply(route, { signedURL: `/object/sign/${p}?token=x` })
    }
    if (path.startsWith('/storage/v1/object/upload/')) return reply(route, { Key: path.split('/upload/sign/')[1] ?? 'x' })
    if (path.startsWith('/storage/v1/object/')) return route.fulfill({ contentType: 'image/svg+xml', body: photoSvg(path) })

    // ---- Edge Functions
    if (path.startsWith('/functions/v1/')) {
      const fn = path.split('/')[3]
      switch (fn) {
        case 'calculate-fee': {
          const coupon = (body as { coupon?: string })?.coupon
          const base = 35
          const discount = coupon === 'BEMVINDO' ? 17.5 : 0
          return reply(route, {
            charge_enabled: true,
            exempt: false,
            base,
            discount,
            total: base - discount,
            coupon_id: null,
            coupon_error: coupon && !discount ? 'Cupom inválido' : null,
            charge_moment: 'antes',
          })
        }
        case 'get-upload-url': {
          const files = (body as { files: unknown[] }).files
          return reply(route, {
            uploads: files.map((_, i) => ({
              path: `pedidos/00000000-0000-4000-8000-000000000000/${i}.jpg`,
              token: 't',
              signedUrl: `${SUPABASE_URL}/storage/v1/object/upload/sign/x`,
            })),
          })
        }
        case 'create-quote-request':
          return reply(route, {
            code: 'COT-000129',
            token: 'tok129',
            status: 'aguardando_pagamento',
            fee: { total: 35, base: 35, discount: 0 },
            payment: null,
            pix_manual: { key: fx.settings.pix_key, receiver: fx.settings.pix_receiver_name, instructions: null },
            tracking_url: 'http://localhost:5173/pedido/COT-000129?t=tok129',
          })
        case 'public-request':
          return reply(route, fx.tracking)
        case 'public-quote':
          if ((body as { action?: string }).action === 'aprovar') return reply(route, { status: 'aprovado', purchase_tasks: 2 })
          return reply(route, fx.publicQuote)
        case 'integration-status':
          return reply(route, {
            email: { configured: true, secrets: { RESEND_API_KEY: true, EMAIL_FROM: true } },
            whatsapp: { configured: false, provider: 'none', secrets: { WHATSAPP_PROVIDER: false } },
            payment: {
              configured: false,
              provider: 'none',
              env: 'sandbox',
              webhook_url: `${SUPABASE_URL}/functions/v1/payment-webhook`,
              secrets: { PAYMENT_PROVIDER: false },
            },
          })
        case 'send-quote':
          return reply(route, {
            email: { status: 'enviado' },
            whatsapp: { status: 'nao_configurado' },
            whatsapp_text: 'Olá!',
            wa_link: 'https://wa.me/5579977776666?text=Ol%C3%A1',
          })
        default:
          return reply(route, { ok: true })
      }
    }

    // ---- RPC
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/')[4]
      const rpc: Record<string, Json> = {
        get_public_settings: fx.publicSettings,
        dashboard_stats: fx.dashboard,
        quote_options_for_staff: fx.options,
        purchase_board: fx.purchases,
        mark_request_paid: {},
        my_quote_requests: fx.myRequests,
        can: true,
      }
      return reply(route, rpc[fn] ?? null)
    }

    // ---- Tabelas
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/')[3]
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (req.method() !== 'GET') return reply(route, single ? {} : [])
      const tables: Record<string, Json> = {
        profiles: id ? (fx.team.find((t) => t.id === id) ?? null) : fx.team,
        role_permissions: fx.rolePermissions,
        settings: fx.settings,
        quote_requests: id ? fx.requestDetail(id) : fx.board,
        customer_overview: id ? fx.customerOverview.find((c) => c.id === id) : fx.customerOverview,
        customers: fx.customers.filter((c) => (url.search.includes('fee_exempt=eq.true') ? c.fee_exempt : true)),
        comments: fx.comments,
        status_history: fx.history,
        notifications_log: fx.notificationsLog,
        suppliers: fx.suppliers,
        categories: [],
        units: fx.units,
        faq_items: fx.faq,
        coupons: fx.coupons,
        audit_log: fx.audit,
        quote_options: fx.options,
        quote_items: [],
      }
      const data = tables[table] ?? []
      return reply(route, single && Array.isArray(data) ? (data[0] ?? null) : data)
    }

    return reply(route, {})
  })

  return calls
}

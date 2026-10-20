import { useQuery } from '@tanstack/react-query'
import { Bell, Inbox, LayoutGrid, LogOut, Menu as MenuIcon, Search, Settings2, ShoppingBag, Users, X } from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo, Simbolo } from '@/components/brand/logo'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Avatar } from '@/components/shared/media'
import { StatusBadge } from '@/components/shared/badges'
import { useAuth } from '@/features/auth/auth'
import { useSettings } from '@/features/settings/api'
import { ThemeToggle } from '@/features/theme/theme'
import { useBoard } from '@/features/quotes/api'
import { ago } from '@/lib/format'
import { supabase, unwrap } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/domain'

const ROLE_LABEL = { admin: 'Administrador', cotador: 'Cotador', comprador: 'Comprador' } as const

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, profile } = useAuth()
  const isBuyer = profile?.role === 'comprador'
  const items = [
    { to: '/painel', label: 'Dashboard', icon: LayoutGrid, end: true, show: true },
    { to: '/painel/tarefas', label: 'Cotações', icon: Inbox, show: !isBuyer },
    { to: '/painel/compras', label: 'Compras', icon: ShoppingBag, show: true },
    { to: '/painel/clientes', label: 'Clientes', icon: Users, show: !isBuyer },
  ]
  const link = (active: boolean) =>
    cn(
      'flex h-9 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors',
      active
        ? 'bg-[color-mix(in_srgb,var(--fg)_9%,transparent)] font-medium text-fg'
        : 'text-fg-2 hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] hover:text-fg',
    )
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      {items
        .filter((i) => i.show)
        .map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={({ isActive }) => link(isActive)}>
            <i.icon className="size-[18px]" strokeWidth={1.75} />
            {i.label}
          </NavLink>
        ))}
      {isAdmin && (
        <>
          <div className="my-3 h-px bg-line" />
          <p className="px-3 pb-1 text-[12px] font-medium text-fg-3">Administração</p>
          <NavLink to="/painel/admin" onClick={onNavigate} className={({ isActive }) => link(isActive)}>
            <Settings2 className="size-[18px]" strokeWidth={1.75} />
            Ajustes
          </NavLink>
        </>
      )}
    </nav>
  )
}

function GlobalSearch() {
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const term = q.trim()

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`
      const [byCode, byCustomer, byItem] = await Promise.all([
        supabase.from('quote_requests').select('id, code, status, customers(name, company)').ilike('code', like).limit(5),
        supabase
          .from('customers')
          .select('id, name, company, quote_requests(id, code, status)')
          .or(`name.ilike.${like},company.ilike.${like}`)
          .limit(5),
        supabase
          .from('quote_items')
          .select('name, quote_requests(id, code, status, customers(name, company))')
          .ilike('name', like)
          .limit(5),
      ])
      type Hit = { id: string; code: string; status: QuoteStatus; title: string; subtitle: string }
      const hits = new Map<string, Hit>()
      for (const r of (unwrap(byCode) ?? []) as unknown as {
        id: string
        code: string
        status: QuoteStatus
        customers: { name: string; company: string }
      }[])
        hits.set(r.id, {
          id: r.id,
          code: r.code,
          status: r.status,
          title: r.code,
          subtitle: `${r.customers.name} · ${r.customers.company}`,
        })
      for (const c of (unwrap(byCustomer) ?? []) as unknown as {
        name: string
        company: string
        quote_requests: { id: string; code: string; status: QuoteStatus }[]
      }[])
        for (const r of c.quote_requests.slice(0, 3))
          hits.set(r.id, { id: r.id, code: r.code, status: r.status, title: `${c.name}`, subtitle: `${r.code} · ${c.company}` })
      for (const i of (unwrap(byItem) ?? []) as unknown as {
        name: string
        quote_requests: { id: string; code: string; status: QuoteStatus; customers: { name: string } }
      }[])
        hits.set(i.quote_requests.id, {
          id: i.quote_requests.id,
          code: i.quote_requests.code,
          status: i.quote_requests.status,
          title: i.name,
          subtitle: `${i.quote_requests.code} · ${i.quote_requests.customers.name}`,
        })
      return [...hits.values()].slice(0, 8)
    },
  })

  return (
    <div className="relative w-full max-w-[360px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar código, cliente ou produto"
        aria-label="Busca"
        className="h-9 w-full rounded-[10px] bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] pl-9 pr-3 text-[15px] outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-[var(--accent-soft)]"
      />
      {open && term.length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-[14px] border border-line bg-surface shadow-xl">
          {isFetching && !data ? (
            <p className="px-4 py-3 text-[15px] text-fg-3">Buscando…</p>
          ) : (data ?? []).length === 0 ? (
            <p className="px-4 py-3 text-[15px] text-fg-3">Nada encontrado</p>
          ) : (
            <ul>
              {data!.map((h) => (
                <li key={h.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false)
                      setQ('')
                      navigate(`/painel/tarefas/${h.id}`)
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{h.title}</span>
                      <span className="block truncate text-[13px] text-fg-2">{h.subtitle}</span>
                    </span>
                    <StatusBadge status={h.status} short />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { profile } = useAuth()
  const { data } = useBoard()
  const key = `cotai-seen-${profile?.id}`
  const [seen, setSeen] = React.useState(() => {
    try {
      return localStorage.getItem(key) ?? new Date(0).toISOString()
    } catch {
      return new Date(0).toISOString()
    }
  })
  if (profile?.role === 'comprador') return null
  const fresh = (data ?? []).filter((r) => ['novo', 'aguardando_pagamento'].includes(r.status)).slice(0, 8)
  const unread = fresh.filter((r) => r.created_at > seen).length
  return (
    <Menu
      onOpenChange={(o) => {
        if (!o) return
        const now = new Date().toISOString()
        setSeen(now)
        try {
          localStorage.setItem(key, now)
        } catch {
          /* ignore */
        }
      }}
    >
      <MenuTrigger
        className="relative flex size-9 items-center justify-center rounded-full text-fg-2 hover:bg-surface-2 hover:text-fg"
        aria-label="Novos pedidos"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--status-red)] px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuLabel>Novos pedidos</MenuLabel>
        {fresh.length === 0 && <p className="px-3 py-2 text-[15px] text-fg-3">Nenhum pedido novo</p>}
        {fresh.map((r) => (
          <MenuItem key={r.id} asChild className="h-auto py-2">
            <Link to={`/painel/tarefas/${r.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.customers.company || r.customers.name}</span>
                <span className="block text-[12px] opacity-70">
                  {r.code} · {ago(r.created_at)}
                </span>
              </span>
            </Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function UserMenu() {
  const { profile, signOut } = useAuth()
  return (
    <Menu>
      <MenuTrigger className="rounded-full" aria-label="Conta">
        <Avatar name={profile?.full_name} url={profile?.avatar_url} className="size-8 text-[12px]" />
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="px-3 py-2">
          <p className="truncate font-semibold">{profile?.full_name}</p>
          <p className="truncate text-[13px] text-fg-2">
            {profile?.email} · {profile ? ROLE_LABEL[profile.role] : ''}
          </p>
        </div>
        <MenuSeparator />
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[15px]">Tema</span>
          <ThemeToggle />
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" /> Sair
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export default function PainelLayout() {
  const { isAdmin } = useAuth()
  const { data: settings } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = React.useState(false)

  // primeiro acesso do admin: assistente de configuração
  React.useEffect(() => {
    if (isAdmin && settings && !settings.onboarding_completed && location.pathname !== '/painel/boas-vindas') {
      navigate('/painel/boas-vindas', { replace: true })
    }
  }, [isAdmin, settings, location.pathname, navigate])

  React.useEffect(() => setDrawer(false), [location.pathname])

  return (
    <div className="min-h-dvh bg-bg-alt">
      {/* sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-sidebar px-3 py-4 backdrop-blur-xl lg:flex">
        <Link to="/painel" className="mb-6 px-3 pt-1">
          <Logo className="h-[22px]" />
        </Link>
        <NavItems />
        <div className="mt-auto px-3 text-[12px] text-fg-3">{settings?.display_name ?? 'Cotaí'}</div>
      </aside>

      {/* drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-[var(--overlay)]" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-surface px-3 py-4 shadow-2xl"
            style={{ animation: 'slide-in 240ms reverse' }}
          >
            <div className="mb-6 flex items-center justify-between px-3">
              <Logo className="h-[22px]" />
              <button
                onClick={() => setDrawer(false)}
                className="flex size-8 items-center justify-center rounded-full bg-surface-2"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-chrome px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
          <button
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menu"
          >
            <MenuIcon className="size-5" strokeWidth={1.75} />
          </button>
          <Link to="/painel" className="lg:hidden" aria-label="Dashboard">
            <Simbolo className="size-7" />
          </Link>
          <div className="flex flex-1 justify-center lg:justify-start">
            <GlobalSearch />
          </div>
          <Notifications />
          <UserMenu />
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  )
}

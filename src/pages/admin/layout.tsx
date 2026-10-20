import {
  Building2,
  ChevronLeft,
  CreditCard,
  FileClock,
  LayoutTemplate,
  ListChecks,
  MessageSquareText,
  Plug,
  Shapes,
  Truck,
  UsersRound,
  Gauge,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export const ADMIN_SECTIONS = [
  { to: '/painel/admin', label: 'Visão geral', icon: Gauge, end: true },
  { to: '/painel/admin/empresa', label: 'Empresa e marca', icon: Building2 },
  { to: '/painel/admin/cobranca', label: 'Cobrança', icon: CreditCard },
  { to: '/painel/admin/cotacao', label: 'Regras de cotação', icon: ListChecks },
  { to: '/painel/admin/landing', label: 'Landing page', icon: LayoutTemplate },
  { to: '/painel/admin/mensagens', label: 'Mensagens', icon: MessageSquareText },
  { to: '/painel/admin/integracoes', label: 'Integrações', icon: Plug },
  { to: '/painel/admin/equipe', label: 'Equipe', icon: UsersRound },
  { to: '/painel/admin/categorias', label: 'Categorias e unidades', icon: Shapes },
  { to: '/painel/admin/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/painel/admin/logs', label: 'Logs', icon: FileClock },
]

export default function AdminLayout() {
  const location = useLocation()
  const atRoot = location.pathname.replace(/\/$/, '') === '/painel/admin'

  return (
    <div className="flex gap-8">
      {/* lista de seções (no celular, só aparece na raiz) */}
      <aside className={cn('w-full shrink-0 md:block md:w-[240px]', atRoot ? 'block' : 'hidden')}>
        <h1 className="mb-4 px-1 text-[28px] font-semibold md:hidden">Ajustes</h1>
        <nav className="overflow-hidden rounded-[14px] bg-surface md:sticky md:top-20" aria-label="Seções de administração">
          {ADMIN_SECTIONS.map((s, i) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 px-4 text-[15px] transition-colors',
                  i > 0 && 'border-t border-line',
                  isActive ? 'bg-accent text-on-accent font-medium md:rounded-none' : 'hover:bg-surface-2/60',
                  s.end && 'hidden md:flex',
                )
              }
            >
              <s.icon className="size-[18px]" strokeWidth={1.75} />
              {s.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className={cn('min-w-0 flex-1', atRoot ? 'hidden md:block' : 'block')}>
        {!atRoot && (
          <NavLink to="/painel/admin" className="mb-4 inline-flex items-center gap-0.5 text-[17px] text-accent-text md:hidden">
            <ChevronLeft className="size-5" /> Ajustes
          </NavLink>
        )}
        <Outlet />
      </section>
    </div>
  )
}

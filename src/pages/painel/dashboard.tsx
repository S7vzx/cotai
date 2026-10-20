import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/controls'
import { StatusBadge } from '@/components/shared/badges'
import { ErrorState, PageHeader } from '@/components/shared/states'
import { useAuth } from '@/features/auth/auth'
import { ago, money } from '@/lib/format'
import { supabase, unwrap } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/domain'

interface Stats {
  new_today: number
  in_progress: number
  awaiting_payment: number
  awaiting_response: number
  approved_month: number
  approval_rate: number | null
  fee_revenue_month: number | null
  per_day: { day: string; count: number }[]
  late: { id: string; code: string; status: QuoteStatus; created_at: string; customer: string; company: string }[]
  mine: { id: string; code: string; status: QuoteStatus; created_at: string; customer: string; company: string }[]
  sla_hours: number
}

function Stat({ label, value, to, tone }: { label: string; value: string | number; to?: string; tone?: 'alert' }) {
  const body = (
    <div className={cn('h-full rounded-2xl bg-surface p-4 transition-colors sm:p-5', to && 'hover:bg-surface-2/40')}>
      <p className="text-[13px] text-fg-2">{label}</p>
      <p className={cn('mt-1 text-[28px] font-semibold leading-tight tabular', tone === 'alert' && 'text-[var(--status-red)]')}>{value}</p>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function RequestList({ title, rows, empty, late }: { title: string; rows: Stats['late']; empty: string; late?: boolean }) {
  return (
    <section className="rounded-2xl bg-surface">
      <h2 className="flex items-center gap-2 px-5 pt-5 text-[17px] font-semibold">
        {late && rows.length > 0 && <AlertCircle className="size-4 text-[var(--status-red)]" />}
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-[15px] text-fg-3">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/painel/tarefas/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.company || r.customer}</span>
                  <span className={cn('block text-[13px] tabular', late ? 'text-[var(--status-red)]' : 'text-fg-2')}>
                    {r.code} · {ago(r.created_at)}
                  </span>
                </span>
                <StatusBadge status={r.status} short />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { profile, can } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => unwrap(await supabase.rpc('dashboard_stats')) as Stats,
    refetchInterval: 60_000,
  })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <>
      <PageHeader title={`${greeting}, ${profile?.full_name.split(' ')[0] ?? ''}`} subtitle="Resumo das cotações" />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Novos hoje" value={data.new_today} to="/painel/tarefas" />
            <Stat label="Em cotação" value={data.in_progress} to="/painel/tarefas" />
            <Stat label="Aguardando pagamento" value={data.awaiting_payment} to="/painel/tarefas" />
            <Stat label="Enviados, sem resposta" value={data.awaiting_response} to="/painel/tarefas" />
            <Stat label="Aprovados no mês" value={data.approved_month} />
            <Stat label="Taxa de aprovação" value={data.approval_rate == null ? '—' : `${String(data.approval_rate).replace('.', ',')}%`} />
            {can('view_revenue') && data.fee_revenue_month != null && (
              <Stat label="Receita de taxas no mês" value={money(data.fee_revenue_month)} />
            )}
            <Stat label="Atrasados" value={data.late.length} tone={data.late.length ? 'alert' : undefined} />
          </div>

          <section className="rounded-2xl bg-surface p-5">
            <h2 className="text-[17px] font-semibold">Pedidos por dia</h2>
            <p className="text-[13px] text-fg-2">Últimos 30 dias</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.per_day} margin={{ left: -24, right: 4, top: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d: string) => d.slice(8, 10)}
                    tick={{ fill: 'var(--fg-3)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--fg-3)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'var(--accent-soft)' }}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }}
                    labelFormatter={(d) => {
                      const s = String(d)
                      return `${s.slice(8, 10)}/${s.slice(5, 7)}`
                    }}
                    formatter={(v) => [v, 'Pedidos']}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <RequestList title={`Atrasados (mais de ${data.sla_hours}h)`} rows={data.late} empty="Nenhum pedido atrasado." late />
            <RequestList title="Minhas tarefas" rows={data.mine} empty="Nada com você agora." />
          </div>
        </div>
      )}
    </>
  )
}

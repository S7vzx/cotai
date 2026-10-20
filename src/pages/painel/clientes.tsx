import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader } from '@/components/shared/states'
import { date, money, phone } from '@/lib/format'
import { supabase, unwrap } from '@/lib/supabase'
import type { CustomerOverview } from '@/types/domain'

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () =>
      unwrap(
        await supabase.from('customer_overview').select('*').order('last_request_at', { ascending: false, nullsFirst: false }),
      ) as CustomerOverview[],
  })
}

export default function Clientes() {
  const { data, isLoading, error, refetch } = useCustomers()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const term = q.trim().toLowerCase()
  const rows = (data ?? []).filter(
    (c) => !term || [c.name, c.company, c.email, c.whatsapp, c.cnpj].some((v) => v?.toLowerCase().includes(term)),
  )

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={data ? `${data.length} clientes` : undefined}
        actions={
          <Input
            placeholder="Buscar cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-64 rounded-[10px] bg-surface text-[15px]"
          />
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={term ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
          text={term ? undefined : 'Os clientes são cadastrados automaticamente no primeiro pedido.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[820px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] uppercase tracking-[0.03em] text-fg-2">
              <tr>
                <th className="h-10 px-4 font-medium">Cliente</th>
                <th className="h-10 px-4 font-medium">WhatsApp</th>
                <th className="h-10 px-4 font-medium">E-mail</th>
                <th className="h-10 px-4 text-right font-medium">Pedidos</th>
                <th className="h-10 px-4 text-right font-medium">Aprovados</th>
                <th className="h-10 px-4 text-right font-medium">Total aprovado</th>
                <th className="h-10 px-4 text-right font-medium">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="h-[52px] cursor-pointer hover:bg-surface-2/60"
                  onClick={() => navigate(`/painel/clientes/${c.id}`)}
                >
                  <td className="px-4">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-[13px] text-fg-2">{c.company}</span>
                  </td>
                  <td className="px-4 tabular">{phone(c.whatsapp)}</td>
                  <td className="max-w-[220px] truncate px-4">{c.email ?? '—'}</td>
                  <td className="px-4 text-right tabular">{c.request_count}</td>
                  <td className="px-4 text-right tabular">{c.approved_count}</td>
                  <td className="px-4 text-right tabular">{money(c.approved_total)}</td>
                  <td className="px-4 text-right tabular text-fg-2">{date(c.last_request_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Check, Clock } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { EmptyState } from '@/components/shared/states'
import { QUOTE_STATUS } from '@/lib/status'
import { dateTime, money } from '@/lib/format'
import { invoke } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/domain'
import { SearchX } from 'lucide-react'
import { PixBox, type PixCharge } from './pix-box'
import { PublicFooter, PublicHeader, useDocumentTitle } from './public-layout'

interface Tracking {
  code: string
  status: QuoteStatus
  created_at: string
  customer_name: string
  eta_text: string
  quote_token: string | null
  payment: {
    amount: number
    due_at: string | null
    pix_key: string | null
    pix_key_type: string | null
    pix_receiver_name: string | null
    pix_instructions: string | null
    charge: PixCharge | null
    moment: 'antes' | 'depois'
  } | null
  items: { id: string; name: string; quantity: number; unit: string; target_price: number; photo_urls?: string[] }[]
  history: { status: QuoteStatus; at: string }[]
}

const FLOW: { key: string; label: string; statuses: QuoteStatus[] }[] = [
  { key: 'recebido', label: 'Pedido recebido', statuses: ['aguardando_pagamento', 'novo'] },
  { key: 'cotacao', label: 'Em cotação', statuses: ['em_cotacao', 'cotado'] },
  { key: 'pronta', label: 'Cotação pronta', statuses: ['enviado'] },
  { key: 'fim', label: 'Concluído', statuses: ['aprovado', 'recusado', 'nao_encontrado'] },
]

export default function Pedido() {
  const { codigo = '' } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  useDocumentTitle(`Pedido ${codigo.toUpperCase()}`)

  const { data, isLoading, error } = useQuery({
    queryKey: ['tracking', codigo, token],
    queryFn: () => invoke<Tracking>('public-request', { code: codigo, token }),
    enabled: !!token,
    refetchInterval: (q) => (q.state.data && ['aguardando_pagamento', 'novo', 'em_cotacao', 'cotado'].includes(q.state.data.status) ? 20_000 : false),
    retry: false,
  })

  const needsCharge = !!data?.payment && !data.payment.charge
  const { data: charge } = useQuery({
    queryKey: ['pix', codigo, token],
    enabled: needsCharge,
    queryFn: () => invoke<PixCharge & { manual?: boolean }>('create-pix-charge', { code: codigo, token }),
    retry: false,
  })

  if (!token || error)
    return (
      <Shell>
        <EmptyState icon={SearchX} title="Pedido não encontrado" text="Confira se o link está completo. Ele foi enviado no WhatsApp e no e-mail." />
      </Shell>
    )

  if (isLoading || !data)
    return (
      <Shell>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-40" />
      </Shell>
    )

  const currentIdx = FLOW.findIndex((f) => f.statuses.includes(data.status))
  const cancelled = data.status === 'cancelado'
  const pixCharge = data.payment?.charge ?? (charge && !charge.manual ? charge : null)

  return (
    <Shell>
      <p className="text-[15px] text-fg-2">Olá, {data.customer_name.split(' ')[0]}</p>
      <h1 className="mt-1 text-[34px] font-semibold leading-tight">
        Pedido <span className="tabular">{data.code}</span>
      </h1>
      <p className="mt-1 text-[15px] text-fg-2">Enviado em {dateTime(data.created_at)}</p>

      {data.quote_token && (
        <Button asChild className="mt-6 w-full sm:w-auto">
          <Link to={`/cotacao/${data.quote_token}`}>Ver cotação</Link>
        </Button>
      )}

      {data.payment && data.status === 'aguardando_pagamento' && (
        <div className="mt-8">
          <PixBox
            amount={data.payment.amount}
            charge={pixCharge}
            manual={{ key: data.payment.pix_key, receiver: data.payment.pix_receiver_name, instructions: data.payment.pix_instructions }}
          />
        </div>
      )}

      <section className="mt-8 rounded-[22px] bg-surface p-6">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Andamento</h2>
        {cancelled ? (
          <p className="mt-4 text-[17px]">Este pedido foi cancelado. Se precisar, faça um novo pedido ou fale com a gente.</p>
        ) : (
          <ol className="mt-5 space-y-0">
            {FLOW.map((f, i) => {
              const done = i < currentIdx || (i === currentIdx && i === FLOW.length - 1)
              const active = i === currentIdx && !done
              const label = i === currentIdx ? QUOTE_STATUS[data.status].label : f.label
              return (
                <li key={f.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full',
                        done ? 'bg-accent text-on-accent' : active ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-fg-3',
                      )}
                    >
                      {done ? <Check className="size-4" strokeWidth={3} /> : active ? <Clock className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    {i < FLOW.length - 1 && <span className={cn('my-1 w-px flex-1 min-h-6', i < currentIdx ? 'bg-accent' : 'bg-line')} />}
                  </div>
                  <div className="pb-6">
                    <p className={cn('text-[17px]', active || done ? 'font-semibold' : 'text-fg-3')}>{label}</p>
                    {active && data.status !== 'aguardando_pagamento' && i < 2 && (
                      <p className="text-[13px] text-fg-2">Previsão: {data.eta_text}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="mt-4 rounded-[22px] bg-surface p-6">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Produtos</h2>
        <ul className="mt-3 divide-y divide-line">
          {data.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              {it.photo_urls?.[0] ? (
                <img src={it.photo_urls[0]} alt="" className="size-14 rounded-xl object-cover" />
              ) : (
                <div className="size-14 rounded-xl bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.name}</p>
                <p className="text-[13px] text-fg-2 tabular">
                  {it.quantity} {it.unit} · alvo {money(it.target_price)}/un
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-alt">
      <PublicHeader links={false} />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10 sm:px-6">{children}</main>
      <PublicFooter />
    </div>
  )
}

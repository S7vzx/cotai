import { ChevronRight, Inbox } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Badge } from '@/components/shared/badges'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { useAuth } from '@/features/auth/auth'
import { type MyRequest, useMyRequests } from '@/features/portal/api'
import { date } from '@/lib/format'
import { TONE_VAR } from '@/lib/status'
import type { QuoteStatus } from '@/types/domain'
import { PublicFooter, PublicHeader, useDocumentTitle } from './public-layout'

/** Situação do pedido na linguagem do cliente. */
const CUSTOMER_STATUS: Record<QuoteStatus, { label: string; tone: keyof typeof TONE_VAR }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'orange' },
  novo: { label: 'Recebido', tone: 'blue' },
  em_cotacao: { label: 'Em cotação', tone: 'yellow' },
  cotado: { label: 'Em cotação', tone: 'yellow' },
  enviado: { label: 'Cotação pronta', tone: 'green' },
  aprovado: { label: 'Aprovada', tone: 'green' },
  recusado: { label: 'Recusada', tone: 'red' },
  nao_encontrado: { label: 'Não encontrado', tone: 'gray' },
  cancelado: { label: 'Cancelado', tone: 'dark' },
}

export default function MinhasCotacoes() {
  const { session, loading, signOut } = useAuth()
  useDocumentTitle('Minhas cotações')
  const { data, isLoading, error, refetch } = useMyRequests(!!session)

  if (!loading && !session) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh flex-col bg-bg-alt">
      <PublicHeader links={false} />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-tight">Minhas cotações</h1>
            <p className="mt-1 truncate text-[15px] text-fg-2">{session?.user.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>

        <div className="mt-8">
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading || loading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-[22px] bg-surface">
              <EmptyState
                icon={Inbox}
                title="Nenhuma cotação ainda"
                text="Os pedidos feitos com este e-mail aparecem aqui."
                action={
                  <Button asChild>
                    <Link to="/cotar">Fazer cotação</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {data.map((r) => (
                <RequestRow key={r.code} r={r} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

function RequestRow({ r }: { r: MyRequest }) {
  const s = CUSTOMER_STATUS[r.status]
  const to = r.quote_token ? `/cotacao/${r.quote_token}` : `/pedido/${r.code}?t=${r.token}`
  const names = r.items.map((i) => i.name).join(', ')
  return (
    <li>
      <Link to={to} className="flex min-h-11 items-center gap-4 rounded-[22px] bg-surface p-5 transition-colors hover:bg-surface-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular">{r.code}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
            {r.payment_pending && r.status === 'aguardando_pagamento' && <span className="text-[13px] text-fg-2">Pague o Pix para começar</span>}
          </div>
          <p className="mt-1 truncate text-[15px] text-fg-2">{names || 'Sem produtos'}</p>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {r.items.length} {r.items.length === 1 ? 'produto' : 'produtos'} · pedido em {date(r.created_at)}
            {r.status === 'enviado' && r.valid_until && ` · válida até ${date(r.valid_until)}`}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-fg-3" strokeWidth={1.75} aria-hidden />
      </Link>
    </li>
  )
}

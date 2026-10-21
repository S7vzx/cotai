import { ChevronRight, Inbox, RotateCcw } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/shared/badges'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Checkbox, Skeleton } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth'
import { type MyRequest, type RebuyItem, useCreateRebuy, useMyRequests } from '@/features/portal/api'
import { date, money } from '@/lib/format'
import { TONE_VAR } from '@/lib/status'
import { errorMessage } from '@/lib/utils'
import type { QuoteStatus } from '@/types/domain'
import { OPTION_ORIGINS, PRODUCT_CONDITIONS } from '../../../supabase/functions/_shared/validation'
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
  const [rebuyOpen, setRebuyOpen] = React.useState(false)
  const s = r.rebuy_of_code && r.status === 'cotado' ? { label: 'Confirmando preço', tone: 'yellow' as const } : CUSTOMER_STATUS[r.status]
  const to = r.quote_token ? `/cotacao/${r.quote_token}` : `/pedido/${r.code}?t=${r.token}`
  const names = r.items.map((i) => i.name).join(', ')
  return (
    <li className="rounded-[22px] bg-surface">
      <Link to={to} className="flex min-h-11 items-center gap-4 rounded-[22px] p-5 transition-colors hover:bg-surface-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular">{r.code}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
            {r.rebuy_of_code && <Badge tone="purple">Recompra de {r.rebuy_of_code}</Badge>}
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
      {r.rebuy_items.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <Button variant="secondary" size="sm" onClick={() => setRebuyOpen(true)}>
            <RotateCcw className="size-4" strokeWidth={1.75} /> Comprar de novo
          </Button>
        </div>
      )}
      {rebuyOpen && <RebuyDialog code={r.code} items={r.rebuy_items} onClose={() => setRebuyOpen(false)} />}
    </li>
  )
}

/** Escolhe os produtos e as quantidades da recompra. */
function RebuyDialog({ code, items, onClose }: { code: string; items: RebuyItem[]; onClose: () => void }) {
  const create = useCreateRebuy()
  const [chosen, setChosen] = React.useState<Record<string, { on: boolean; quantity: number }>>(() =>
    Object.fromEntries(items.map((i) => [i.item_id, { on: true, quantity: i.quantity }])),
  )
  const selected = items.filter((i) => chosen[i.item_id].on)
  const valid = selected.length > 0 && selected.every((i) => chosen[i.item_id].quantity >= 1)
  const total = selected.reduce((acc, i) => acc + i.sale_price * chosen[i.item_id].quantity, 0)

  async function submit() {
    try {
      const res = await create.mutateAsync({
        code,
        items: selected.map((i) => ({ item_id: i.item_id, quantity: chosen[i.item_id].quantity })),
      })
      toast.success(`Recompra ${res.code} enviada. A equipe confirma o preço e segue para a compra.`)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Comprar de novo"
        description="Mesma opção e mesmo preço da compra anterior. A equipe confirma com o fornecedor e avisa você."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!valid} loading={create.isPending}>
              Pedir recompra
            </Button>
          </>
        }
      >
        <ul className="divide-y divide-line">
          {items.map((i) => {
            const c = chosen[i.item_id]
            const set = (patch: Partial<typeof c>) => setChosen((x) => ({ ...x, [i.item_id]: { ...c, ...patch } }))
            const details = [i.condition && PRODUCT_CONDITIONS[i.condition], i.origin && OPTION_ORIGINS[i.origin]].filter(Boolean).join(' · ')
            return (
              <li key={i.item_id} className="flex items-start gap-3 py-4">
                <Checkbox className="mt-0.5" checked={c.on} onCheckedChange={(v) => set({ on: v === true })} aria-label={`Incluir ${i.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-[13px] text-fg-2 tabular">
                    {money(i.sale_price)}/{i.unit}
                    {details && ` · ${details}`}
                  </p>
                </div>
                <Field label="Quantidade" className="w-24 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="tabular"
                    disabled={!c.on}
                    value={c.quantity || ''}
                    onChange={(e) => set({ quantity: Math.max(0, Math.floor(Number(e.target.value))) })}
                  />
                </Field>
              </li>
            )
          })}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-3">
          <span className="text-fg-2">Total estimado</span>
          <span className="font-semibold tabular">{money(total)}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

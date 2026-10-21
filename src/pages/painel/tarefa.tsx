import { addDays, format } from 'date-fns'
import { ArrowLeft, Copy, ExternalLink, MessageCircle, MoreHorizontal, SearchX, Send } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox, Skeleton } from '@/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { Avatar, PhotoGallery } from '@/components/shared/media'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { useAuth } from '@/features/auth/auth'
import { useCatalog } from '@/features/catalog/api'
import {
  useAddComment,
  useComments,
  useConfirmPayment,
  useConfirmRebuy,
  useDeleteRequest,
  useHistory,
  useOptions,
  useRequest,
  useSaveOptions,
  useSendQuote,
  useSetStatus,
  useUpdateRequest,
  type SendResult,
} from '@/features/quotes/api'
import { useSettings } from '@/features/settings/api'
import { useTeam, useTeamMap } from '@/features/team/api'
import { dateTime, money, phone, waLink } from '@/lib/format'
import { PRIORITY, QUOTE_STATUS } from '@/lib/status'
import { SITE_URL } from '@/lib/supabase'
import { cn, errorMessage } from '@/lib/utils'
import type { Priority, QuoteStatus } from '@/types/domain'
import { brDate, brl, renderTemplate } from '../../../supabase/functions/_shared/templates'
import { PRODUCT_CONDITIONS } from '../../../supabase/functions/_shared/validation'
import { ItemOptionsEditor, toDraft, type OptionDraft } from './tarefa-options'

const EDITABLE: QuoteStatus[] = ['novo', 'em_cotacao', 'cotado', 'enviado']

export default function Tarefa() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile, can } = useAuth()
  const { data: r, isLoading, error, refetch } = useRequest(id)
  const { data: options } = useOptions(id)
  const { data: settings } = useSettings()
  const { data: team } = useTeam()
  const { data: suppliers } = useCatalog('suppliers')
  const update = useUpdateRequest()
  const setStatus = useSetStatus()
  const saveOptions = useSaveOptions(id)
  const confirmPayment = useConfirmPayment(id)
  const confirmRebuy = useConfirmRebuy(id)
  const del = useDeleteRequest()

  const [drafts, setDrafts] = React.useState<Record<string, OptionDraft[]>>({})
  const [notFound, setNotFound] = React.useState<Record<string, boolean>>({})
  const [dirty, setDirty] = React.useState(false)
  const [validUntil, setValidUntil] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [sendOpen, setSendOpen] = React.useState<null | 'quote' | 'not_found'>(null)
  const [confirm, setConfirm] = React.useState<null | 'cancel' | 'delete' | 'pay'>(null)

  // carrega o rascunho a partir do servidor (sem sobrescrever edições em andamento)
  React.useEffect(() => {
    if (!r || !options || dirty) return
    const d: Record<string, OptionDraft[]> = {}
    const nf: Record<string, boolean> = {}
    for (const it of r.quote_items) {
      d[it.id] = options.filter((o) => o.item_id === it.id).map(toDraft)
      nf[it.id] = it.not_found
    }
    setDrafts(d)
    setNotFound(nf)
    setMessage(r.customer_message ?? '')
    setValidUntil(r.valid_until ?? format(addDays(new Date(), settings?.default_validity_days ?? 7), 'yyyy-MM-dd'))
  }, [r, options, settings?.default_validity_days, dirty])

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (isLoading || !r)
    return isLoading ? (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    ) : (
      <EmptyState
        icon={SearchX}
        title="Pedido não encontrado"
        action={
          <Button asChild variant="secondary">
            <Link to="/painel/tarefas">Voltar</Link>
          </Button>
        }
      />
    )

  const isBuyer = profile?.role === 'comprador'
  const readOnly = isBuyer || !EDITABLE.includes(r.status)
  const showCosts = can('view_costs')
  const c = r.customers
  const trackingUrl = `${SITE_URL}/pedido/${r.code}?t=${r.public_token}`
  const quoteUrl = `${SITE_URL}/cotacao/${r.public_token}`
  const feeTotal = Number(r.fee_amount) - Number(r.fee_discount)

  async function save(opts: { silent?: boolean } = {}) {
    const upserts = r!.quote_items.flatMap((it) =>
      (drafts[it.id] ?? []).map((d, i) => ({
        ...(d.id ? { id: d.id } : {}),
        item_id: it.id,
        label: d.label,
        position: i,
        supplier_name: d.supplier_name.trim(),
        sale_price: d.sale_price,
        lead_time_days: d.lead_time_days,
        payment_terms: d.payment_terms || null,
        freight_included: d.freight_included,
        freight_value: d.freight_included ? 0 : d.freight_value,
        customer_notes: d.customer_notes || null,
        internal_notes: d.internal_notes || null,
        condition: d.condition || null,
        origin: d.origin || null,
        ...(showCosts ? { supplier_contact: d.supplier_contact || null, cost_price: d.cost_price || null } : {}),
      })),
    )
    const keep = new Set(upserts.map((u) => u.id).filter(Boolean))
    const deletes = (options ?? []).map((o) => o.id).filter((oid) => !keep.has(oid))
    const itemFlags = r!.quote_items
      .filter((it) => it.not_found !== !!notFound[it.id])
      .map((it) => ({ id: it.id, not_found: !!notFound[it.id] }))
    await saveOptions.mutateAsync({ upserts, deletes, itemFlags })
    await update.mutateAsync({ id: r!.id, patch: { customer_message: message || null, valid_until: validUntil || null } })
    setDirty(false)
    if (!opts.silent) toast.success('Rascunho salvo')
  }

  const mark = (fn: () => void) => () => {
    setDirty(true)
    fn()
  }

  async function changeStatus(to: QuoteStatus, note?: string) {
    try {
      await setStatus.mutateAsync({ id: r!.id, status: to })
      toast.success(note ?? `Status: ${QUOTE_STATUS[to].label}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function onConfirmRebuy() {
    try {
      if (dirty) await save({ silent: true })
      await confirmRebuy.mutateAsync()
      setDirty(false)
      toast.success('Recompra confirmada: os produtos foram para Compras')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function takeTask() {
    try {
      await update.mutateAsync({
        id: r!.id,
        patch: { assigned_to: profile!.id, ...(r!.status === 'novo' ? { status: 'em_cotacao' } : {}) },
      })
      toast.success('Tarefa assumida')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const hasOptions = r.quote_items.some((it) => !notFound[it.id] && (drafts[it.id] ?? []).some((d) => d.sale_price > 0))
  const assignee = team?.find((p) => p.id === r.assigned_to)

  return (
    <div className="pb-24">
      <Link to="/painel/tarefas" className="mb-3 inline-flex items-center gap-1 text-[15px] text-accent-text">
        <ArrowLeft className="size-4" /> Cotações
      </Link>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tabular sm:text-[34px]">{r.code}</h1>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-1 text-[15px] text-fg-2">
            {c.company || c.name} · criado em {dateTime(r.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isBuyer && r.status === 'novo' && (
            <Button size="sm" onClick={takeTask} loading={update.isPending}>
              Assumir tarefa
            </Button>
          )}
          <Menu>
            <MenuTrigger
              className="flex size-9 items-center justify-center rounded-full bg-surface hover:bg-surface-2"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="size-5" />
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => window.open(trackingUrl, '_blank')}>
                <ExternalLink className="size-4" /> Página de acompanhamento
              </MenuItem>
              {['enviado', 'aprovado', 'recusado'].includes(r.status) && (
                <MenuItem onSelect={() => window.open(quoteUrl, '_blank')}>
                  <ExternalLink className="size-4" /> Ver cotação como cliente
                </MenuItem>
              )}
              <MenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(['enviado', 'aprovado', 'recusado'].includes(r.status) ? quoteUrl : trackingUrl)
                  toast.success('Link copiado')
                }}
              >
                <Copy className="size-4" /> Copiar link do cliente
              </MenuItem>
              {!isBuyer && (
                <>
                  <MenuSeparator />
                  {['enviado', 'recusado', 'nao_encontrado'].includes(r.status) && (
                    <MenuItem onSelect={() => changeStatus('em_cotacao', 'Pedido reaberto para cotação')}>Reabrir cotação</MenuItem>
                  )}
                  {r.status === 'cancelado' && (
                    <MenuItem onSelect={() => changeStatus('novo', 'Pedido restaurado')}>Restaurar pedido</MenuItem>
                  )}
                  {r.status !== 'cancelado' && (
                    <MenuItem destructive onSelect={() => setConfirm('cancel')}>
                      Cancelar pedido
                    </MenuItem>
                  )}
                  {can('delete_request') && (
                    <MenuItem destructive onSelect={() => setConfirm('delete')}>
                      Excluir pedido
                    </MenuItem>
                  )}
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </header>

      {r.rebuy_of && (
        <section className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">
              Recompra
              {r.rebuy_source && (
                <>
                  {' '}
                  de{' '}
                  <Link to={`/painel/tarefas/${r.rebuy_of}`} className="text-accent-text hover:underline">
                    {r.rebuy_source.code}
                  </Link>
                </>
              )}
            </h2>
            <p className="mt-1 text-[15px] text-fg-2">
              {r.status === 'cotado'
                ? 'O cliente pediu de novo com a opção e o preço da compra anterior. Confira com o fornecedor: se o preço se mantiver ou baixar, confirme e o pedido vai direto para Compras. Se subir, ajuste a opção e envie ao cliente para aprovar.'
                : 'O cliente pediu de novo os produtos de uma compra anterior.'}
            </p>
          </div>
          {!isBuyer && r.status === 'cotado' && can('send_quote') && (
            <Button className="shrink-0" onClick={onConfirmRebuy} loading={confirmRebuy.isPending}>
              Confirmar recompra
            </Button>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------------- coluna do pedido */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl bg-surface p-5">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Cliente</h2>
            <Link to={`/painel/clientes/${c.id}`} className="mt-2 block text-[19px] font-semibold hover:underline">
              {c.name}
            </Link>
            <p className="text-[15px] text-fg-2">
              {c.company}
              {c.cnpj && ` · ${c.cnpj}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.whatsapp && (
                <Button asChild size="sm" variant="secondary">
                  <a href={waLink(c.whatsapp)!} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> {phone(c.whatsapp)}
                  </a>
                </Button>
              )}
              {c.email && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="max-w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(c.email!)
                    toast.success('E-mail copiado')
                  }}
                >
                  <Copy className="size-4" /> <span className="truncate">{c.email}</span>
                </Button>
              )}
            </div>
          </section>

          {(feeTotal > 0 || r.payment_status !== 'isento') && (
            <section className="rounded-2xl bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Taxa de cotação</h2>
                <PaymentBadge status={r.payment_status} />
              </div>
              <p className="mt-2 text-[24px] font-semibold tabular">{money(feeTotal)}</p>
              {Number(r.fee_discount) > 0 && <p className="text-[13px] text-fg-2 tabular">Desconto de {money(r.fee_discount)} (cupom)</p>}
              {r.paid_at && (
                <p className="text-[13px] text-fg-2">
                  Pago em {dateTime(r.paid_at)}
                  {r.payment_method ? ` · ${r.payment_method.replace('_', ' ')}` : ''}
                </p>
              )}
              {r.payment_status === 'pendente' && can('confirm_payment') && (
                <Button size="sm" className="mt-3" onClick={() => setConfirm('pay')}>
                  Confirmar pagamento manualmente
                </Button>
              )}
              {r.payment_status === 'pendente' && r.payment_due_at && (
                <p className="mt-2 text-[13px] text-fg-3">Vence em {dateTime(r.payment_due_at)}</p>
              )}
            </section>
          )}

          {r.quote_items.map((it, i) => (
            <section key={it.id} className="rounded-2xl bg-surface p-5">
              <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Produto {i + 1}</p>
              <h3 className="mt-1 text-[19px] font-semibold">{it.name}</h3>
              <PhotoGallery className="mt-3" photos={it.quote_item_photos.map((p) => ({ path: p.storage_path, alt: it.name }))} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[15px]">
                <div>
                  <dt className="text-[13px] text-fg-2">Quantidade</dt>
                  <dd className="font-medium tabular">
                    {it.quantity} {it.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-fg-2">Preço-alvo</dt>
                  <dd className="font-medium tabular">
                    {money(it.target_price)}/un · {money(it.target_price * it.quantity)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[13px] text-fg-2">Estado aceito</dt>
                  <dd className="font-medium">{it.accepted_conditions.map((c) => PRODUCT_CONDITIONS[c]).join(', ')}</dd>
                </div>
              </dl>
              {it.description && <p className="mt-3 whitespace-pre-line text-[15px]">{it.description}</p>}
              {it.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-[15px]">{it.notes}</p>}
              {it.reference_url && (
                <a
                  href={it.reference_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 break-all text-[15px] text-accent-text"
                >
                  <ExternalLink className="size-4 shrink-0" /> Link de referência
                </a>
              )}
            </section>
          ))}
        </div>

        {/* ---------------- coluna da cotação */}
        <div className="min-w-0 space-y-4">
          {!isBuyer && (
            <section className="grid gap-3 rounded-2xl bg-surface p-5 sm:grid-cols-2">
              <Field label="Responsável">
                <NativeSelect
                  value={r.assigned_to ?? ''}
                  onChange={(e) =>
                    update.mutate(
                      { id: r.id, patch: { assigned_to: e.target.value || null } },
                      { onError: (er) => toast.error(errorMessage(er)) },
                    )
                  }
                >
                  <option value="">Ninguém</option>
                  {(team ?? [])
                    .filter((p) => p.active && p.role !== 'comprador')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field label="Prioridade">
                <NativeSelect
                  value={r.priority}
                  onChange={(e) =>
                    update.mutate(
                      { id: r.id, patch: { priority: e.target.value as Priority } },
                      { onError: (er) => toast.error(errorMessage(er)) },
                    )
                  }
                >
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {assignee && r.status === 'novo' && (
                <p className="text-[13px] text-fg-2 sm:col-span-2">
                  <Avatar name={assignee.full_name} className="mr-1.5 size-5 align-middle text-[9px]" />
                  {assignee.full_name} ainda não começou
                </p>
              )}
            </section>
          )}

          {r.status === 'aguardando_pagamento' && (
            <div className="rounded-2xl bg-surface p-5 text-[15px] text-fg-2">
              Este pedido entra na fila depois que o pagamento for confirmado.
            </div>
          )}

          {r.status !== 'aguardando_pagamento' && (
            <>
              <h2 className="px-1 pt-2 text-[22px] font-semibold">Cotação</h2>
              {r.quote_items.map((it) => (
                <ItemOptionsEditor
                  key={it.id}
                  item={it}
                  drafts={drafts[it.id] ?? []}
                  notFound={!!notFound[it.id]}
                  onChange={(ds) => mark(() => setDrafts((all) => ({ ...all, [it.id]: ds })))()}
                  onNotFound={(v) => mark(() => setNotFound((all) => ({ ...all, [it.id]: v })))()}
                  maxOptions={settings?.max_options_per_item ?? 3}
                  minMargin={Number(settings?.min_margin_alert ?? 10)}
                  showCosts={showCosts}
                  readOnly={readOnly}
                  suppliers={suppliers ?? []}
                />
              ))}

              <section className="space-y-4 rounded-2xl bg-surface p-5">
                <Field label="Válida até">
                  <Input type="date" value={validUntil} disabled={readOnly} onChange={(e) => mark(() => setValidUntil(e.target.value))()} />
                </Field>
                <Field label="Mensagem para o cliente" hint="Aparece no topo da cotação">
                  <Textarea value={message} disabled={readOnly} onChange={(e) => mark(() => setMessage(e.target.value))()} />
                </Field>
              </section>
            </>
          )}

          <Tabs defaultValue="comentarios" className="pt-4">
            <TabsList>
              <TabsTrigger value="comentarios">Comentários</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="comentarios" className="mt-4">
              <CommentsPanel requestId={r.id} />
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <HistoryPanel requestId={r.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* barra de ações */}
      {!readOnly && r.status !== 'aguardando_pagamento' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-chrome pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:left-[232px]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
            {dirty && <span className="mr-auto text-[13px] text-fg-2">Alterações não salvas</span>}
            <Button variant="ghost" size="sm" onClick={() => setSendOpen('not_found')}>
              <SearchX className="size-4" /> Não encontrado
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save()} loading={saveOptions.isPending} disabled={!dirty}>
              Salvar rascunho
            </Button>
            {r.status === 'em_cotacao' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasOptions}
                onClick={async () => {
                  try {
                    await save({ silent: true })
                    await changeStatus('cotado', 'Marcado como cotado')
                  } catch (e) {
                    toast.error(errorMessage(e))
                  }
                }}
              >
                Marcar como cotado
              </Button>
            )}
            {can('send_quote') && (
              <Button
                size="sm"
                className="h-9 px-4 text-[15px]"
                disabled={!hasOptions || r.status === 'novo'}
                title={r.status === 'novo' ? 'Assuma a tarefa primeiro' : undefined}
                onClick={async () => {
                  try {
                    if (dirty) await save({ silent: true })
                    setSendOpen('quote')
                  } catch (e) {
                    toast.error(errorMessage(e))
                  }
                }}
              >
                <Send className="size-4" /> {r.status === 'enviado' ? 'Reenviar ao cliente' : 'Enviar ao cliente'}
              </Button>
            )}
          </div>
        </div>
      )}

      <SendDialog
        mode={sendOpen}
        onClose={() => setSendOpen(null)}
        requestId={r.id}
        code={r.code}
        customerName={c.name}
        customerWhats={c.whatsapp}
        customerEmail={c.email}
        message={message}
        validUntil={validUntil}
        total={r.quote_items.reduce((acc, it) => {
          if (notFound[it.id]) return acc
          const ds = (drafts[it.id] ?? []).filter((d) => d.sale_price > 0)
          if (ds.length === 0) return acc
          const best = ds.reduce((a, b) => (a.sale_price <= b.sale_price ? a : b))
          return acc + best.sale_price * it.quantity + (best.freight_included ? 0 : best.freight_value)
        }, 0)}
        link={quoteUrl}
      />

      <ConfirmDialog
        open={confirm === 'pay'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Confirmar pagamento?"
        description={`O pedido ${r.code} entra na fila e o cliente é avisado.`}
        confirmLabel="Confirmar"
        loading={confirmPayment.isPending}
        onConfirm={() =>
          confirmPayment.mutate(undefined, {
            onSuccess: () => {
              toast.success('Pagamento confirmado')
              setConfirm(null)
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Cancelar pedido?"
        description="O pedido sai do quadro. Você pode restaurá-lo depois."
        confirmLabel="Cancelar pedido"
        destructive
        onConfirm={async () => {
          await changeStatus('cancelado', 'Pedido cancelado')
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Excluir pedido definitivamente?"
        description="Isso apaga o pedido, as fotos vinculadas, as cotações e o histórico. Não dá para desfazer."
        confirmLabel="Excluir"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(r.id, {
            onSuccess: () => {
              toast.success('Pedido excluído')
              navigate('/painel/tarefas')
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />

      {/* evita perder edição ao sair */}
      <UnsavedGuard when={dirty} />
    </div>
  )
}

function UnsavedGuard({ when }: { when: boolean }) {
  React.useEffect(() => {
    if (!when) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [when])
  return null
}

function SendDialog({
  mode,
  onClose,
  requestId,
  code,
  customerName,
  customerWhats,
  customerEmail,
  message,
  validUntil,
  total,
  link,
}: {
  mode: null | 'quote' | 'not_found'
  onClose: () => void
  requestId: string
  code: string
  customerName: string
  customerWhats: string | null
  customerEmail: string | null
  message: string
  validUntil: string
  total: number
  link: string
}) {
  const { data: settings } = useSettings()
  const send = useSendQuote(requestId)
  const [channels, setChannels] = React.useState({ email: true, whatsapp: true })
  const [nfMessage, setNfMessage] = React.useState('')
  const [result, setResult] = React.useState<SendResult | null>(null)

  React.useEffect(() => {
    if (mode) {
      setResult(null)
      setChannels({ email: !!customerEmail, whatsapp: !!customerWhats })
    }
  }, [mode, customerEmail, customerWhats])

  if (!mode) return null
  const event = mode === 'quote' ? 'cotacao_pronta' : 'nao_encontrado'
  const vars = {
    nome: customerName.split(' ')[0],
    codigo: code,
    link,
    total: brl(total),
    validade: brDate(validUntil),
    prazo: settings?.eta_text,
    mensagem: mode === 'quote' ? message : nfMessage,
  }
  const waText = renderTemplate(settings?.whatsapp_templates?.[event] ?? '', vars)
  const emailTpl = settings?.email_templates?.[event]
  const emailSubject = renderTemplate(emailTpl?.subject ?? '', vars)
  const emailBody = renderTemplate(emailTpl?.body ?? '', vars)

  async function submit() {
    if (mode === 'quote' && !validUntil) return toast.error('Defina a validade da cotação')
    try {
      const res = await send.mutateAsync({
        mode: mode!,
        channels,
        message: mode === 'quote' ? message : nfMessage,
        valid_until: validUntil,
      })
      setResult(res)
      const parts: string[] = []
      if (res.email)
        parts.push(
          `E-mail: ${res.email.status === 'enviado' ? 'enviado' : res.email.status === 'nao_configurado' ? 'não configurado' : 'falhou'}`,
        )
      if (res.whatsapp)
        parts.push(
          `WhatsApp: ${res.whatsapp.status === 'enviado' ? 'enviado' : res.whatsapp.status === 'nao_configurado' ? 'não configurado' : 'falhou'}`,
        )
      const ok = [res.email, res.whatsapp].every((r) => !r || r.status === 'enviado')
      if (ok) toast.success(mode === 'quote' ? 'Cotação enviada' : 'Cliente avisado', { description: parts.join(' · ') })
      else toast.warning('Status atualizado, mas algum envio não saiu', { description: parts.join(' · ') })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const waManual = result && (!result.whatsapp || result.whatsapp.status !== 'enviado') && result.wa_link

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={mode === 'quote' ? 'Enviar cotação ao cliente' : 'Avisar que não foi encontrado'}
        description={`Pedido ${code} · ${customerName}`}
        footer={
          result ? (
            <>
              {waManual && (
                <Button asChild variant="secondary">
                  <a href={result.wa_link!} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> Enviar pelo meu WhatsApp
                  </a>
                </Button>
              )}
              <Button onClick={onClose}>Concluir</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={submit} loading={send.isPending} variant={mode === 'quote' ? 'primary' : 'danger'}>
                {mode === 'quote' ? 'Enviar' : 'Marcar e avisar'}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <ul className="space-y-2 text-[17px]">
            {result.email && (
              <li>
                E-mail: <ResultLabel status={result.email.status} error={result.email.error} />
              </li>
            )}
            {result.whatsapp && (
              <li>
                WhatsApp: <ResultLabel status={result.whatsapp.status} error={result.whatsapp.error} />
              </li>
            )}
            {!result.email && !result.whatsapp && <li className="text-fg-2">Nenhum canal selecionado. O status foi atualizado.</li>}
            {waManual && <li className="text-[15px] text-fg-2">Use o botão abaixo para mandar a mensagem pronta do seu WhatsApp.</li>}
          </ul>
        ) : (
          <div className="space-y-5">
            {mode === 'not_found' && (
              <Field label="Mensagem para o cliente" hint="Ex.: alternativas encontradas, ou por que não foi possível">
                <Textarea value={nfMessage} onChange={(e) => setNfMessage(e.target.value)} />
              </Field>
            )}
            <div className="flex flex-wrap gap-6">
              <label className={cn('flex items-center gap-2 text-[17px]', !customerEmail && 'opacity-50')}>
                <Checkbox
                  checked={channels.email}
                  disabled={!customerEmail}
                  onCheckedChange={(v) => setChannels((c) => ({ ...c, email: v === true }))}
                />
                E-mail
              </label>
              <label className={cn('flex items-center gap-2 text-[17px]', !customerWhats && 'opacity-50')}>
                <Checkbox
                  checked={channels.whatsapp}
                  disabled={!customerWhats}
                  onCheckedChange={(v) => setChannels((c) => ({ ...c, whatsapp: v === true }))}
                />
                WhatsApp
              </label>
            </div>
            {channels.whatsapp && waText && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-fg-2">Prévia do WhatsApp</p>
                <div className="rounded-2xl bg-[#e7fbe6] p-4 text-[15px] leading-snug whitespace-pre-line text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
                  {waText.replace(/\*(.+?)\*/g, '$1')}
                </div>
              </div>
            )}
            {channels.email && emailTpl && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-fg-2">Prévia do e-mail</p>
                <div className="rounded-2xl border border-line p-4">
                  <p className="font-semibold">{emailSubject}</p>
                  <p className="mt-2 whitespace-pre-line text-[15px] text-fg-2">{emailBody}</p>
                </div>
              </div>
            )}
            {mode === 'quote' && (
              <p className="text-[13px] text-fg-3">
                Total mostrado: soma da opção mais barata de cada produto. O cliente escolhe as opções na página da cotação.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResultLabel({ status, error }: { status: string; error?: string }) {
  if (status === 'enviado') return <b className="text-accent-text">enviado</b>
  if (status === 'nao_configurado') return <b className="text-fg-2">não configurado</b>
  return (
    <b className="text-[var(--status-red)]" title={error}>
      falhou{error ? ` — ${error}` : ''}
    </b>
  )
}

function CommentsPanel({ requestId }: { requestId: string }) {
  const { profile } = useAuth()
  const team = useTeamMap()
  const { data } = useComments(requestId)
  const add = useAddComment(requestId)
  const [body, setBody] = React.useState('')
  const [suggest, setSuggest] = React.useState<string | null>(null)

  const members = [...team.values()].filter((p) => p.active)
  const matches = suggest !== null ? members.filter((p) => p.full_name.toLowerCase().includes(suggest.toLowerCase())).slice(0, 5) : []

  function onChange(v: string) {
    setBody(v)
    const m = /@([\p{L}\s]{0,20})$/u.exec(v)
    setSuggest(m ? m[1] : null)
  }

  async function submit() {
    const text = body.trim()
    if (!text || !profile) return
    const mentions = members.filter((p) => text.includes(`@${p.full_name}`)).map((p) => p.id)
    try {
      await add.mutateAsync({ body: text, mentions, authorId: profile.id })
      setBody('')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      {(data ?? []).length === 0 && <p className="text-[15px] text-fg-3">Nenhum comentário ainda.</p>}
      <ul className="space-y-3">
        {(data ?? []).map((cm) => {
          const author = cm.author_id ? team.get(cm.author_id) : null
          const mentioned = profile && cm.mentions.includes(profile.id)
          return (
            <li key={cm.id} className={cn('flex gap-3 rounded-2xl bg-surface p-4', mentioned && 'ring-1 ring-accent')}>
              <Avatar name={author?.full_name} url={author?.avatar_url} />
              <div className="min-w-0">
                <p className="text-[13px] text-fg-2">
                  <b className="text-fg">{author?.full_name ?? 'Usuário removido'}</b> · {dateTime(cm.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-line text-[15px]">
                  {cm.body.split(/(@[\p{L}]+(?:\s[\p{L}]+)?)/u).map((part, i) =>
                    part.startsWith('@') ? (
                      <span key={i} className="font-semibold text-accent-text">
                        {part}
                      </span>
                    ) : (
                      part
                    ),
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="relative rounded-2xl bg-surface p-3">
        <Textarea
          rows={2}
          placeholder="Escreva um comentário. Use @ para mencionar alguém."
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
          }}
          className="bg-transparent focus:shadow-none focus:ring-0"
        />
        {matches.length > 0 && (
          <ul className="absolute bottom-full left-3 z-10 mb-1 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] hover:bg-surface-2"
                  onClick={() => {
                    setBody((b) => b.replace(/@([\p{L}\s]{0,20})$/u, `@${p.full_name} `))
                    setSuggest(null)
                  }}
                >
                  <Avatar name={p.full_name} className="size-6 text-[10px]" /> {p.full_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} loading={add.isPending} disabled={!body.trim()}>
            Comentar
          </Button>
        </div>
      </div>
    </div>
  )
}

const EVENT_LABEL: Record<string, string> = {
  pedido_recebido: 'Confirmação do pedido',
  pagamento_confirmado: 'Pagamento confirmado',
  cotacao_pronta: 'Cotação enviada',
  nao_encontrado: 'Aviso de não encontrado',
  aprovacao_recebida: 'Confirmação de aprovação',
  lembrete_pagamento: 'Lembrete de pagamento',
  lembrete_resposta: 'Lembrete de resposta',
  compra_atualizada: 'Atualização da compra',
  interno_novo_pedido: 'Aviso interno: novo pedido',
  interno_aprovada: 'Aviso interno: aprovada',
  interno_recusada: 'Aviso interno: recusada',
}

function HistoryPanel({ requestId }: { requestId: string }) {
  const team = useTeamMap()
  const { data } = useHistory(requestId)
  if (!data) return <Skeleton className="h-32" />
  const rows = [
    ...data.history.map((h) => ({
      at: h.created_at,
      text: (
        <>
          {h.from_status ? 'Status alterado para ' : 'Pedido criado como '}
          <b>{QUOTE_STATUS[h.to_status as QuoteStatus]?.label ?? h.to_status}</b>
          {h.note && <span className="text-fg-2"> · {h.note}</span>}
        </>
      ),
      who: h.changed_by ? (team.get(h.changed_by)?.full_name ?? 'Equipe') : 'Cliente / sistema',
    })),
    ...data.notifications.map((n) => ({
      at: n.created_at,
      text: (
        <>
          {n.channel === 'email' ? 'E-mail' : 'WhatsApp'}: {EVENT_LABEL[n.event] ?? n.event} —{' '}
          <b className={n.status === 'enviado' ? 'text-accent-text' : n.status === 'falhou' ? 'text-[var(--status-red)]' : 'text-fg-2'}>
            {n.status === 'nao_configurado' ? 'não configurado' : n.status}
          </b>
          {n.error && n.status === 'falhou' && <span className="text-fg-2"> ({n.error})</span>}
        </>
      ),
      who: n.recipient,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <ol className="space-y-0 rounded-2xl bg-surface p-5">
      {rows.map((row, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 size-2 rounded-full bg-fg-3" />
            {i < rows.length - 1 && <span className="w-px flex-1 bg-line" />}
          </div>
          <div className="pb-4">
            <p className="text-[15px]">{row.text}</p>
            <p className="text-[13px] text-fg-3">
              {dateTime(row.at)} · {row.who}
            </p>
          </div>
        </li>
      ))}
      {rows.length === 0 && <p className="text-[15px] text-fg-3">Sem histórico.</p>}
    </ol>
  )
}

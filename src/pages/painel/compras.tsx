import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { FileText, Paperclip, ShoppingBag, Trash2, Upload } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { PurchaseBadge } from '@/components/shared/badges'
import { Avatar, StorageImage } from '@/components/shared/media'
import { EmptyState, ErrorState, PageHeader } from '@/components/shared/states'
import { useAuth } from '@/features/auth/auth'
import { notifyPurchase, useAttachments, usePurchases, useUpdatePurchase, type PurchaseRow } from '@/features/purchases/api'
import { useTeam, useTeamMap } from '@/features/team/api'
import { date, money } from '@/lib/format'
import { PURCHASE_ORDER, PURCHASE_STATUS } from '@/lib/status'
import { signedUrl } from '@/lib/supabase'
import { cn, errorMessage } from '@/lib/utils'
import type { PurchaseStatus } from '@/types/domain'
import { OPTION_ORIGINS, PRODUCT_CONDITIONS } from '../../../supabase/functions/_shared/validation'

const MESSAGES: Partial<Record<PurchaseStatus, (r: PurchaseRow) => string>> = {
  comprado: (r) => `Boa notícia: compramos ${r.item_name} (${r.quantity} ${r.unit}) do seu pedido.`,
  em_transito: (r) =>
    `${r.item_name} está a caminho.${r.tracking_code ? ` Código de rastreio: ${r.tracking_code}.` : ''}${r.expected_delivery ? ` Previsão de entrega: ${date(r.expected_delivery)}.` : ''}`,
  entregue: (r) => `${r.item_name} foi entregue. Obrigado pela confiança!`,
}

function Card({ r }: { r: PurchaseRow }) {
  const team = useTeamMap()
  const a = r.assigned_to ? team.get(r.assigned_to) : null
  return (
    <div className="rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:shadow-soft">
      <div className="flex gap-3">
        <StorageImage path={r.photo ?? undefined} className="size-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-snug">{r.item_name}</p>
          <p className="truncate text-[13px] text-fg-2">{r.option?.supplier_name || 'Fornecedor não informado'}</p>
          <p className="truncate text-[13px] text-fg-3">
            {r.customer_company || r.customer_name} · {r.code}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <span className="tabular text-fg-2">
          {r.quantity} {r.unit}
          {r.option && ` · ${money(r.option.sale_price * r.quantity)}`}
        </span>
        <span className="flex items-center gap-2">
          {r.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-fg-3">
              <Paperclip className="size-3.5" />
              {r.attachments.length}
            </span>
          )}
          {a && <Avatar name={a.full_name} className="size-6 text-[10px]" />}
        </span>
      </div>
    </div>
  )
}

function Draggable({ r, onOpen }: { r: PurchaseRow; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: r.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 40 } : undefined}
      className={cn('cursor-grab touch-manipulation outline-none', isDragging && 'scale-[1.02] opacity-90 shadow-xl')}
    >
      <Card r={r} />
    </div>
  )
}

function Column({ status, items, onOpen }: { status: PurchaseStatus; items: PurchaseRow[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[284px] shrink-0 flex-col rounded-2xl bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] p-2',
        isOver && 'bg-accent-soft',
      )}
    >
      <header className="flex items-center justify-between px-2 pb-2 pt-1">
        <h2 className="text-[13px] font-semibold">{PURCHASE_STATUS[status].label}</h2>
        <span className="text-[13px] text-fg-3 tabular">{items.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((r) => (
          <Draggable key={r.id} r={r} onOpen={() => onOpen(r.id)} />
        ))}
        {items.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-fg-3">Vazio</p>}
      </div>
    </section>
  )
}

export default function Compras() {
  const { can } = useAuth()
  const { data, isLoading, error, refetch } = usePurchases()
  const update = useUpdatePurchase()
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [notifyFor, setNotifyFor] = React.useState<{ row: PurchaseRow; status: PurchaseStatus } | null>(null)
  const canEdit = can('manage_purchases')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const active = (data ?? []).filter((r) => r.status !== 'cancelado')

  function onDragEnd(e: DragEndEvent) {
    const r = active.find((x) => x.id === e.active.id)
    const to = e.over?.id as PurchaseStatus | undefined
    if (!r || !to || r.status === to) return
    if (!canEdit) return toast.error('Você não tem permissão para mover compras')
    update.mutate(
      {
        id: r.id,
        patch: { status: to, ...(to === 'comprado' && !r.purchased_at ? { purchased_at: new Date().toISOString().slice(0, 10) } : {}) },
      },
      {
        onSuccess: () => {
          if (MESSAGES[to] && r.customer_whatsapp) setNotifyFor({ row: { ...r, status: to }, status: to })
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <>
      <PageHeader title="Compras" subtitle="Cotações aprovadas pelos clientes viram tarefas de compra." />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex gap-3">
          {PURCHASE_ORDER.map((s) => (
            <Skeleton key={s} className="h-80 w-[284px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma compra ainda"
          text="Quando um cliente aprovar uma cotação, cada produto aparece aqui para ser comprado."
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {PURCHASE_ORDER.map((s) => (
              <Column key={s} status={s} items={active.filter((r) => r.status === s)} onOpen={setOpenId} />
            ))}
          </div>
        </DndContext>
      )}

      <PurchaseSheet
        row={(data ?? []).find((r) => r.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        canEdit={canEdit}
        onStatusChanged={(row, status) => {
          if (MESSAGES[status] && row.customer_whatsapp) setNotifyFor({ row: { ...row, status }, status })
        }}
      />
      <NotifyDialog value={notifyFor} onClose={() => setNotifyFor(null)} />
    </>
  )
}

function NotifyDialog({ value, onClose }: { value: { row: PurchaseRow; status: PurchaseStatus } | null; onClose: () => void }) {
  const [msg, setMsg] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (value) setMsg(MESSAGES[value.status]?.(value.row) ?? '')
  }, [value])
  if (!value) return null
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="sm"
        title="Avisar o cliente?"
        description={`${value.row.customer_name} · ${PURCHASE_STATUS[value.status].label}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Agora não
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await notifyPurchase(value.row.request_id, msg)
                  toast.success('Cliente avisado')
                  onClose()
                } catch (e) {
                  toast.error(errorMessage(e))
                } finally {
                  setBusy(false)
                }
              }}
            >
              Enviar
            </Button>
          </>
        }
      >
        <Field label="Mensagem">
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Field>
      </DialogContent>
    </Dialog>
  )
}

function PurchaseSheet({
  row,
  onClose,
  canEdit,
  onStatusChanged,
}: {
  row: PurchaseRow | null
  onClose: () => void
  canEdit: boolean
  onStatusChanged: (row: PurchaseRow, status: PurchaseStatus) => void
}) {
  const update = useUpdatePurchase()
  const { data: team } = useTeam()
  const { can } = useAuth()
  const att = useAttachments(row?.id ?? '')
  const [form, setForm] = React.useState<Partial<PurchaseRow>>({})

  React.useEffect(() => {
    if (row)
      setForm({
        purchased_at: row.purchased_at,
        supplier_order_number: row.supplier_order_number,
        tracking_code: row.tracking_code,
        expected_delivery: row.expected_delivery,
        notes: row.notes,
        assigned_to: row.assigned_to,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id])

  if (!row) return null
  const o = row.option
  const save = () =>
    update.mutate(
      {
        id: row.id,
        patch: {
          purchased_at: form.purchased_at || null,
          supplier_order_number: form.supplier_order_number || null,
          tracking_code: form.tracking_code || null,
          expected_delivery: form.expected_delivery || null,
          notes: form.notes || null,
          assigned_to: form.assigned_to || null,
        },
      },
      { onSuccess: () => toast.success('Compra atualizada'), onError: (e) => toast.error(errorMessage(e)) },
    )

  return (
    <Dialog open onOpenChange={(op) => !op && onClose()}>
      <DialogContent
        variant="side"
        title={row.item_name}
        description={`${row.code} · ${row.customer_company || row.customer_name}`}
        footer={
          canEdit ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Fechar
              </Button>
              <Button onClick={save} loading={update.isPending}>
                Salvar
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {PURCHASE_ORDER.map((s) => (
              <button
                key={s}
                disabled={!canEdit}
                onClick={() =>
                  s !== row.status &&
                  update.mutate(
                    { id: row.id, patch: { status: s } },
                    { onSuccess: () => onStatusChanged(row, s), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
                className={cn('rounded-full', s === row.status ? '' : 'opacity-40 hover:opacity-80')}
              >
                <PurchaseBadge status={s} />
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-[15px]">
            <div>
              <dt className="text-[13px] text-fg-2">Quantidade</dt>
              <dd className="tabular">
                {row.quantity} {row.unit}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-fg-2">Fornecedor</dt>
              <dd>
                {o?.supplier_name || '—'} {o && <span className="text-fg-3">(opção {o.label})</span>}
              </dd>
            </div>
            {o && (
              <div>
                <dt className="text-[13px] text-fg-2">Preço ao cliente</dt>
                <dd className="tabular">{money(o.sale_price)}/un</dd>
              </div>
            )}
            {o && can('view_costs') && o.cost_price != null && (
              <div>
                <dt className="text-[13px] text-fg-2">Custo</dt>
                <dd className="tabular">{money(o.cost_price)}/un</dd>
              </div>
            )}
            {o?.supplier_contact && (
              <div className="col-span-2">
                <dt className="text-[13px] text-fg-2">Contato do fornecedor</dt>
                <dd>{o.supplier_contact}</dd>
              </div>
            )}
            {o?.condition && (
              <div>
                <dt className="text-[13px] text-fg-2">Estado</dt>
                <dd>{PRODUCT_CONDITIONS[o.condition]}</dd>
              </div>
            )}
            {o?.origin && (
              <div>
                <dt className="text-[13px] text-fg-2">Origem</dt>
                <dd>{OPTION_ORIGINS[o.origin]}</dd>
              </div>
            )}
            {o?.payment_terms && (
              <div>
                <dt className="text-[13px] text-fg-2">Pagamento</dt>
                <dd>{o.payment_terms}</dd>
              </div>
            )}
            {o && (
              <div>
                <dt className="text-[13px] text-fg-2">Frete</dt>
                <dd className="tabular">{o.freight_included ? 'Incluso' : money(o.freight_value)}</dd>
              </div>
            )}
            {o?.internal_notes && (
              <div className="col-span-2">
                <dt className="text-[13px] text-fg-2">Notas internas</dt>
                <dd className="whitespace-pre-line">{o.internal_notes}</dd>
              </div>
            )}
          </dl>

          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsável" className="sm:col-span-2">
              <NativeSelect value={form.assigned_to ?? ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value || null })}>
                <option value="">Ninguém</option>
                {(team ?? [])
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Data da compra">
              <Input type="date" value={form.purchased_at ?? ''} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
            </Field>
            <Field label="Nº do pedido no fornecedor">
              <Input
                value={form.supplier_order_number ?? ''}
                onChange={(e) => setForm({ ...form, supplier_order_number: e.target.value })}
              />
            </Field>
            <Field label="Código de rastreio">
              <Input value={form.tracking_code ?? ''} onChange={(e) => setForm({ ...form, tracking_code: e.target.value })} />
            </Field>
            <Field label="Previsão de entrega">
              <Input
                type="date"
                value={form.expected_delivery ?? ''}
                onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
              />
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </fieldset>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Anexos</h3>
              {canEdit && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[15px] text-accent-text">
                  <Upload className="size-4" /> Adicionar
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,application/pdf,.xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      if (f.size > 20 * 1024 * 1024) return toast.error('Arquivo maior que 20 MB')
                      att.upload.mutate(f, {
                        onSuccess: () => toast.success('Anexo enviado'),
                        onError: (er) => toast.error(errorMessage(er)),
                      })
                    }}
                  />
                </label>
              )}
            </div>
            {row.attachments.length === 0 ? (
              <p className="text-[15px] text-fg-3">Nota fiscal, comprovante ou outros arquivos.</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl bg-surface-2">
                {row.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText className="size-4 shrink-0 text-fg-2" />
                    <button
                      className="min-w-0 flex-1 truncate text-left text-[15px] hover:underline"
                      onClick={async () => {
                        const url = await signedUrl('purchase-attachments', a.storage_path)
                        if (url) window.open(url, '_blank')
                      }}
                    >
                      {a.file_name}
                    </button>
                    {canEdit && (
                      <button
                        className="text-fg-3 hover:text-[var(--status-red)]"
                        aria-label="Remover anexo"
                        onClick={() => att.remove.mutate(a)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {att.upload.isPending && <p className="mt-2 text-[13px] text-fg-2">Enviando…</p>}
          </div>

          <Link to={`/painel/tarefas/${row.request_id}`} className="inline-block text-[15px] text-accent-text">
            Ver pedido {row.code} ›
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

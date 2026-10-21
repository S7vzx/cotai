import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ArrowDown, ArrowUp, Inbox, LayoutGrid, List } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Segmented, Skeleton } from '@/components/ui/controls'
import { Input, NativeSelect } from '@/components/ui/input'
import { Badge, PriorityBadge, StatusBadge } from '@/components/shared/badges'
import { Avatar, StorageImage } from '@/components/shared/media'
import { EmptyState, ErrorState, PageHeader } from '@/components/shared/states'
import { useAuth } from '@/features/auth/auth'
import { useBoard, useSetStatus, type BoardItem } from '@/features/quotes/api'
import { useSettings } from '@/features/settings/api'
import { useTeamMap } from '@/features/team/api'
import { ago, dateTime, hoursSince, money } from '@/lib/format'
import { canTransition, DRAG_BLOCKED, KANBAN_COLUMNS, QUOTE_STATUS } from '@/lib/status'
import { cn, errorMessage } from '@/lib/utils'
import type { Priority, QuoteStatus } from '@/types/domain'

type View = 'kanban' | 'lista'

function readView(): View {
  try {
    return localStorage.getItem('cotai-board-view') === 'lista' ? 'lista' : 'kanban'
  } catch {
    return 'kanban'
  }
}

const targetTotal = (r: BoardItem) => r.quote_items.reduce((a, i) => a + i.quantity * Number(i.target_price), 0)
const firstPhoto = (r: BoardItem) =>
  r.quote_items.flatMap((i) => [...i.quote_item_photos].sort((a, b) => a.position - b.position))[0]?.storage_path

function TaskCard({ r, sla, overlay }: { r: BoardItem; sla: number; overlay?: boolean }) {
  const team = useTeamMap()
  const assignee = r.assigned_to ? team.get(r.assigned_to) : null
  const late = ['novo', 'em_cotacao'].includes(r.status) && hoursSince(r.created_at) > sla
  const photo = firstPhoto(r)
  return (
    <div
      className={cn(
        'rounded-xl bg-surface p-3 transition-shadow duration-200',
        overlay ? 'scale-[1.02] shadow-xl' : 'shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:shadow-soft',
      )}
    >
      <div className="flex gap-3">
        <StorageImage path={photo} className="size-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-fg-2 tabular">{r.code}</span>
            <span className="flex items-center gap-1">
              {r.rebuy_of && <Badge tone="purple">Recompra</Badge>}
              <PriorityBadge priority={r.priority} hideNormal />
            </span>
          </div>
          <p className="truncate text-[15px] font-semibold leading-snug">{r.customers.company || r.customers.name}</p>
          <p className="truncate text-[13px] text-fg-2">{r.customers.name}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="text-fg-2 tabular">
          {r.quote_items.length} {r.quote_items.length === 1 ? 'produto' : 'produtos'} · {money(targetTotal(r))}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn('tabular', late ? 'font-semibold text-[var(--status-red)]' : 'text-fg-3')} title={dateTime(r.created_at)}>
            {ago(r.created_at).replace('há ', '')}
          </span>
          {assignee && <Avatar name={assignee.full_name} url={assignee.avatar_url} className="size-6 text-[10px]" />}
        </span>
      </div>
    </div>
  )
}

function DraggableCard({ r, sla }: { r: BoardItem; sla: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: r.id, data: { status: r.status } })
  const navigate = useNavigate()
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/painel/tarefas/${r.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/painel/tarefas/${r.id}`)}
      className={cn('cursor-grab touch-manipulation outline-none active:cursor-grabbing', isDragging && 'opacity-30')}
      aria-label={`Pedido ${r.code}`}
    >
      <TaskCard r={r} sla={sla} />
    </div>
  )
}

function Column({ id, title, items, sla }: { id: string; title: string; items: BoardItem[]; sla: number }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[284px] shrink-0 flex-col rounded-2xl bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] p-2 transition-colors',
        isOver && 'bg-accent-soft',
      )}
    >
      <header className="flex items-center justify-between px-2 pb-2 pt-1">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="text-[13px] text-fg-3 tabular">{items.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2 overflow-y-auto">
        {items.map((r) => (
          <DraggableCard key={r.id} r={r} sla={sla} />
        ))}
        {items.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-fg-3">Vazio</p>}
      </div>
    </section>
  )
}

type SortKey = 'code' | 'customer' | 'status' | 'items' | 'target' | 'created_at'

function ListView({ items, sla }: { items: BoardItem[]; sla: number }) {
  const team = useTeamMap()
  const navigate = useNavigate()
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'created_at', dir: -1 })
  const value = (r: BoardItem, k: SortKey): string | number => {
    switch (k) {
      case 'code':
        return r.code
      case 'customer':
        return (r.customers.company || r.customers.name).toLowerCase()
      case 'status':
        return Object.keys(QUOTE_STATUS).indexOf(r.status)
      case 'items':
        return r.quote_items.length
      case 'target':
        return targetTotal(r)
      default:
        return r.created_at
    }
  }
  const sorted = [...items].sort((a, b) => (value(a, sort.key) > value(b, sort.key) ? sort.dir : -sort.dir))
  const th = (k: SortKey, label: string, right?: boolean) => (
    <th className={cn('h-10 px-4 font-medium', right && 'text-right')}>
      <button
        className="inline-flex items-center gap-1 hover:text-fg"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : 1 }))}
      >
        {label}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  )
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[760px] text-left text-[15px]">
        <thead className="border-b border-line text-[13px] uppercase tracking-[0.03em] text-fg-2">
          <tr>
            {th('code', 'Código')}
            {th('customer', 'Cliente')}
            {th('status', 'Status')}
            {th('items', 'Itens', true)}
            {th('target', 'Alvo', true)}
            <th className="h-10 px-4 font-medium">Responsável</th>
            {th('created_at', 'Criado', true)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((r) => {
            const a = r.assigned_to ? team.get(r.assigned_to) : null
            const late = ['novo', 'em_cotacao'].includes(r.status) && hoursSince(r.created_at) > sla
            return (
              <tr key={r.id} className="h-[52px] cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/painel/tarefas/${r.id}`)}>
                <td className="px-4 font-medium tabular">
                  <Link to={`/painel/tarefas/${r.id}`} onClick={(e) => e.stopPropagation()}>
                    {r.code}
                  </Link>
                </td>
                <td className="px-4">
                  <span className="block truncate font-medium">{r.customers.company || r.customers.name}</span>
                  <span className="block truncate text-[13px] text-fg-2">{r.customers.name}</span>
                </td>
                <td className="px-4">
                  <span className="flex items-center gap-1">
                    <StatusBadge status={r.status} short />
                    {r.rebuy_of && <Badge tone="purple">Recompra</Badge>}
                  </span>
                </td>
                <td className="px-4 text-right tabular">{r.quote_items.length}</td>
                <td className="px-4 text-right tabular">{money(targetTotal(r))}</td>
                <td className="px-4">
                  {a ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={a.full_name} className="size-6 text-[10px]" />
                      {a.full_name}
                    </span>
                  ) : (
                    <span className="text-fg-3">—</span>
                  )}
                </td>
                <td className={cn('px-4 text-right tabular', late ? 'font-semibold text-[var(--status-red)]' : 'text-fg-2')}>
                  {ago(r.created_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const PERIODS = { '7': 7, '30': 30, '90': 90, todos: 0 } as const

export default function Tarefas() {
  const { profile } = useAuth()
  const { data: settings } = useSettings()
  const team = useTeamMap()
  const [view, setViewState] = React.useState<View>(readView)
  const [period, setPeriod] = React.useState<keyof typeof PERIODS>('30')
  const [assignee, setAssignee] = React.useState('')
  const [priority, setPriority] = React.useState<Priority | ''>('')
  const [mine, setMine] = React.useState(false)
  const [q, setQ] = React.useState('')
  const since = PERIODS[period] ? new Date(Date.now() - PERIODS[period] * 86400_000).toISOString() : undefined
  const { data, isLoading, error, refetch } = useBoard({ since })
  const setStatus = useSetStatus()
  const [dragging, setDragging] = React.useState<BoardItem | null>(null)
  const sla = settings?.sla_hours ?? 24

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('cotai-board-view', v)
    } catch {
      /* ignore */
    }
  }

  const term = q.trim().toLowerCase()
  const items = (data ?? []).filter(
    (r) =>
      r.status !== 'cancelado' &&
      (!assignee || r.assigned_to === assignee) &&
      (!priority || r.priority === priority) &&
      (!mine || r.assigned_to === profile?.id) &&
      (!term ||
        r.code.toLowerCase().includes(term) ||
        r.customers.name.toLowerCase().includes(term) ||
        r.customers.company.toLowerCase().includes(term) ||
        r.quote_items.some((i) => i.name.toLowerCase().includes(term))),
  )

  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const r = (data ?? []).find((x) => x.id === e.active.id)
    const col = KANBAN_COLUMNS.find((c) => c.id === e.over?.id)
    if (!r || !col || col.statuses.includes(r.status)) return
    const to = col.statuses[0] as QuoteStatus
    if (DRAG_BLOCKED[to]) return toast.info(DRAG_BLOCKED[to])
    if (!canTransition(r.status, to))
      return toast.error(`Não dá para mover de "${QUOTE_STATUS[r.status].short}" para "${QUOTE_STATUS[to].short}"`)
    if (r.status === 'aguardando_pagamento' && r.payment_status !== 'pago') return toast.info('Confirme o pagamento no detalhe do pedido')
    setStatus.mutate({ id: r.id, status: to }, { onError: (err) => toast.error(errorMessage(err)) })
  }

  return (
    <>
      <PageHeader
        title="Cotações"
        subtitle={data ? `${items.length} pedidos` : undefined}
        actions={
          <Segmented<View>
            aria-label="Visualização"
            value={view}
            onChange={setView}
            options={[
              {
                value: 'kanban',
                label: (
                  <>
                    <LayoutGrid className="size-4" /> Kanban
                  </>
                ),
              },
              {
                value: 'lista',
                label: (
                  <>
                    <List className="size-4" /> Lista
                  </>
                ),
              },
            ]}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-full rounded-[10px] bg-surface text-[15px] sm:w-56"
        />
        <NativeSelect
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          aria-label="Responsável"
        >
          <option value="">Todos os responsáveis</option>
          {[...team.values()]
            .filter((p) => p.active && p.role !== 'comprador')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | '')}
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          aria-label="Prioridade"
        >
          <option value="">Todas as prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </NativeSelect>
        <Segmented
          size="sm"
          aria-label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7', label: '7 dias' },
            { value: '30', label: '30 dias' },
            { value: '90', label: '90 dias' },
            { value: 'todos', label: 'Tudo' },
          ]}
        />
        <label className="ml-1 flex items-center gap-2 text-[15px] text-fg-2">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Somente meus
        </label>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-[284px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum pedido ainda" text="Quando um cliente pedir uma cotação, ela aparece aqui na hora." />
      ) : view === 'lista' ? (
        <ListView items={items} sla={sla} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDragging((data ?? []).find((r) => r.id === e.active.id) ?? null)}
          onDragCancel={() => setDragging(null)}
          onDragEnd={onDragEnd}
        >
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {KANBAN_COLUMNS.filter(
              (c) => c.id !== 'aguardando_pagamento' || settings?.charge_enabled || items.some((r) => r.status === 'aguardando_pagamento'),
            ).map((c) => (
              <Column key={c.id} id={c.id} title={c.title} items={items.filter((r) => c.statuses.includes(r.status))} sla={sla} />
            ))}
          </div>
          <DragOverlay>{dragging && <TaskCard r={dragging} sla={sla} overlay />}</DragOverlay>
        </DndContext>
      )}
    </>
  )
}

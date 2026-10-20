import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/lib/realtime'
import { invoke, supabase, unwrap } from '@/lib/supabase'
import type {
  Comment,
  Customer,
  NotificationLog,
  Priority,
  QuoteItem,
  QuoteItemPhoto,
  QuoteOption,
  QuoteRequest,
  QuoteStatus,
  StatusHistory,
} from '@/types/domain'

export interface BoardItem extends QuoteRequest {
  customers: Pick<Customer, 'name' | 'company'>
  quote_items: (Pick<QuoteItem, 'id' | 'quantity' | 'target_price' | 'name'> & {
    quote_item_photos: Pick<QuoteItemPhoto, 'storage_path' | 'position'>[]
  })[]
}

const BOARD_SELECT = '*, customers(name, company), quote_items(id, name, quantity, target_price, quote_item_photos(storage_path, position))'

/** Pedidos para o kanban/lista, com atualização em tempo real. */
export function useBoard(filters: { since?: string } = {}) {
  const qc = useQueryClient()
  useRealtime('quote_requests', () => {
    qc.invalidateQueries({ queryKey: ['board'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  })

  return useQuery({
    queryKey: ['board', filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('quote_requests').select(BOARD_SELECT).order('created_at', { ascending: false }).limit(500)
      // encerrados antigos saem do quadro; os ativos ficam sempre
      if (filters.since) q = q.or(`created_at.gte.${filters.since},status.in.(aguardando_pagamento,novo,em_cotacao,cotado,enviado)`)
      return unwrap(await q) as BoardItem[]
    },
  })
}

export interface RequestDetail extends QuoteRequest {
  customers: Customer
  quote_items: (QuoteItem & { quote_item_photos: QuoteItemPhoto[] })[]
}

export function useRequest(id: string | undefined) {
  const qc = useQueryClient()
  useRealtime('quote_requests', () => qc.invalidateQueries({ queryKey: ['request', id] }), { filter: `id=eq.${id}`, enabled: !!id })
  useRealtime('comments', () => qc.invalidateQueries({ queryKey: ['comments', id] }), {
    event: 'INSERT',
    filter: `request_id=eq.${id}`,
    enabled: !!id,
  })

  return useQuery({
    queryKey: ['request', id],
    enabled: !!id,
    queryFn: async () => {
      const r = unwrap(
        await supabase.from('quote_requests').select('*, customers(*), quote_items(*, quote_item_photos(*))').eq('id', id!).maybeSingle(),
      ) as RequestDetail | null
      if (r) {
        r.quote_items.sort((a, b) => a.position - b.position)
        r.quote_items.forEach((i) => i.quote_item_photos.sort((a, b) => a.position - b.position))
      }
      return r
    },
  })
}

/** Opções (via função que esconde custo de quem não pode ver). */
export function useOptions(requestId: string | undefined) {
  return useQuery({
    queryKey: ['options', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc('quote_options_for_staff', { p_request_id: requestId })) as unknown[]
      return rows as QuoteOption[]
    },
  })
}

export function useUpdateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QuoteRequest> }) =>
      unwrap(await supabase.from('quote_requests').update(patch).eq('id', id).select('*').single()) as QuoteRequest,
    onMutate: async ({ id, patch }) => {
      // otimista no quadro (arrastar e soltar sem atraso)
      await qc.cancelQueries({ queryKey: ['board'] })
      const snapshots = qc.getQueriesData<BoardItem[]>({ queryKey: ['board'] })
      for (const [key, data] of snapshots) {
        if (data)
          qc.setQueryData(
            key,
            data.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          )
      }
      return { snapshots }
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['board'] })
      qc.invalidateQueries({ queryKey: ['request', id] })
      qc.invalidateQueries({ queryKey: ['history', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSetStatus() {
  const update = useUpdateRequest()
  return {
    ...update,
    mutate: (vars: { id: string; status: QuoteStatus }, opts?: Parameters<typeof update.mutate>[1]) =>
      update.mutate({ id: vars.id, patch: { status: vars.status } }, opts),
    mutateAsync: (vars: { id: string; status: QuoteStatus }) => update.mutateAsync({ id: vars.id, patch: { status: vars.status } }),
  }
}

export function useAssign() {
  const update = useUpdateRequest()
  return (id: string, assigned_to: string | null, priority?: Priority) =>
    update.mutateAsync({ id, patch: { assigned_to, ...(priority ? { priority } : {}) } })
}

export function useSaveOptions(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      upserts,
      deletes,
      itemFlags,
    }: {
      upserts: Partial<QuoteOption>[]
      deletes: string[]
      itemFlags: { id: string; not_found: boolean }[]
    }) => {
      if (deletes.length) unwrap(await supabase.from('quote_options').delete().in('id', deletes))
      const inserts = upserts.filter((o) => !o.id)
      const updates = upserts.filter((o) => o.id)
      if (inserts.length) unwrap(await supabase.from('quote_options').insert(inserts))
      for (const o of updates) {
        const { id, ...rest } = o
        unwrap(await supabase.from('quote_options').update(rest).eq('id', id!))
      }
      for (const f of itemFlags) unwrap(await supabase.from('quote_items').update({ not_found: f.not_found }).eq('id', f.id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['options', requestId] })
      qc.invalidateQueries({ queryKey: ['request', requestId] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}

export function useConfirmPayment(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(await supabase.rpc('mark_request_paid', { p_request_id: requestId, p_method: 'pix_manual' }))
      // avisa o cliente (não bloqueia se a mensagem falhar)
      await invoke('notify-customer', { request_id: requestId, event: 'pagamento_confirmado' }).catch(() => null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', requestId] })
      qc.invalidateQueries({ queryKey: ['board'] })
      qc.invalidateQueries({ queryKey: ['history', requestId] })
    },
  })
}

export interface SendResult {
  email: { status: string; error?: string } | null
  whatsapp: { status: string; error?: string } | null
  whatsapp_text: string | null
  wa_link: string | null
}

export function useSendQuote(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      mode: 'quote' | 'not_found'
      channels: { email: boolean; whatsapp: boolean }
      message: string
      valid_until?: string
    }) => invoke<SendResult>('send-quote', { request_id: requestId, ...vars }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['request', requestId] })
      qc.invalidateQueries({ queryKey: ['board'] })
      qc.invalidateQueries({ queryKey: ['history', requestId] })
      qc.invalidateQueries({ queryKey: ['notifications', requestId] })
    },
  })
}

export function useComments(requestId: string) {
  return useQuery({
    queryKey: ['comments', requestId],
    queryFn: async () => unwrap(await supabase.from('comments').select('*').eq('request_id', requestId).order('created_at')) as Comment[],
  })
}

export function useAddComment(requestId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, mentions, authorId }: { body: string; mentions: string[]; authorId: string }) =>
      unwrap(await supabase.from('comments').insert({ request_id: requestId, body, mentions, author_id: authorId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', requestId] }),
  })
}

export function useHistory(requestId: string) {
  return useQuery({
    queryKey: ['history', requestId],
    queryFn: async () => {
      const [history, notifications] = await Promise.all([
        supabase.from('status_history').select('*').eq('entity_type', 'quote').eq('entity_id', requestId).order('created_at'),
        supabase.from('notifications_log').select('*').eq('request_id', requestId).order('created_at'),
      ])
      return {
        history: unwrap(history) as StatusHistory[],
        notifications: unwrap(notifications) as NotificationLog[],
      }
    },
  })
}

export function useDeleteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('quote_requests').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }),
  })
}

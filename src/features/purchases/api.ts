import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/lib/realtime'
import { invoke, supabase, unwrap } from '@/lib/supabase'
import type { OptionOrigin, ProductCondition, PurchaseStatus, PurchaseTask } from '@/types/domain'

export interface PurchaseRow {
  id: string
  status: PurchaseStatus
  request_id: string
  item_id: string
  assigned_to: string | null
  purchased_at: string | null
  supplier_order_number: string | null
  tracking_code: string | null
  expected_delivery: string | null
  notes: string | null
  created_at: string
  updated_at: string
  code: string
  customer_name: string
  customer_company: string
  customer_whatsapp: string | null
  item_name: string
  quantity: number
  unit: string
  photo: string | null
  option: {
    label: string
    supplier_name: string
    sale_price: number
    lead_time_days: number | null
    payment_terms: string | null
    freight_included: boolean
    freight_value: number
    condition: ProductCondition | null
    origin: OptionOrigin | null
    cost_price: number | null
    supplier_contact: string | null
    internal_notes: string | null
  } | null
  attachments: { id: string; storage_path: string; file_name: string; created_at: string }[]
}

export function usePurchases() {
  const qc = useQueryClient()
  useRealtime('purchase_tasks', () => qc.invalidateQueries({ queryKey: ['purchases'] }))
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => unwrap(await supabase.rpc('purchase_board')) as unknown as PurchaseRow[],
  })
}

export function useUpdatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PurchaseTask> }) =>
      unwrap(await supabase.from('purchase_tasks').update(patch).eq('id', id).select('id').single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['purchases'] })
      const prev = qc.getQueryData<PurchaseRow[]>(['purchases'])
      if (prev)
        qc.setQueryData(
          ['purchases'],
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['purchases'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  })
}

export function useAttachments(taskId: string) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['purchases'] })
  return {
    upload: useMutation({
      mutationFn: async (file: File) => {
        const safe = file.name
          .normalize('NFD')
          .replace(/[^\w.-]+/g, '_')
          .slice(-80)
        const path = `compras/${taskId}/${crypto.randomUUID()}-${safe}`
        const { error } = await supabase.storage.from('purchase-attachments').upload(path, file, { contentType: file.type })
        if (error) throw error
        unwrap(await supabase.from('purchase_attachments').insert({ purchase_task_id: taskId, storage_path: path, file_name: file.name }))
      },
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (a: { id: string; storage_path: string }) => {
        await supabase.storage.from('purchase-attachments').remove([a.storage_path])
        unwrap(await supabase.from('purchase_attachments').delete().eq('id', a.id))
      },
      onSuccess: done,
    }),
  }
}

export function notifyPurchase(requestId: string, message: string) {
  return invoke('notify-customer', {
    request_id: requestId,
    event: 'compra_atualizada',
    message,
    channels: { whatsapp: true, email: true },
  })
}

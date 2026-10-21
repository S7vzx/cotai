import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { OptionOrigin, ProductCondition, QuoteStatus } from '@/types/domain'

export interface MyRequest {
  code: string
  token: string
  status: QuoteStatus
  created_at: string
  sent_at: string | null
  valid_until: string | null
  quote_token: string | null
  payment_pending: boolean
  items: { name: string; quantity: number; unit: string }[]
  /** Código do pedido original, quando este é uma recompra. */
  rebuy_of_code: string | null
  /** Produtos aprovados que podem ser comprados de novo (só em cotações aprovadas). */
  rebuy_items: RebuyItem[]
}

export interface RebuyItem {
  item_id: string
  name: string
  quantity: number
  unit: string
  sale_price: number
  condition: ProductCondition | null
  origin: OptionOrigin | null
}

/** Pede de novo os produtos escolhidos, com a opção e o preço anteriores. */
export function useCreateRebuy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { code: string; items: { item_id: string; quantity: number }[] }) =>
      unwrap(await supabase.rpc('create_rebuy', { p_code: vars.code, p_items: vars.items })) as unknown as { code: string; token: string },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-requests'] }),
  })
}

/** Pedidos do cliente logado (pelo e-mail confirmado no login). */
export function useMyRequests(enabled: boolean) {
  return useQuery({
    queryKey: ['my-requests'],
    enabled,
    queryFn: async () => unwrap(await supabase.rpc('my_quote_requests')) as unknown as MyRequest[],
  })
}

/** Envia o código de acesso por e-mail (cria o usuário do cliente se for o primeiro acesso). */
export async function sendLoginCode(email: string, redirectTo: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { kind: 'customer' }, emailRedirectTo: redirectTo },
  })
  if (error) throw error
}

export async function verifyLoginCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

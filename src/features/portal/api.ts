import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { QuoteStatus } from '@/types/domain'

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

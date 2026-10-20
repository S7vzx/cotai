import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

/** Cliente com service_role: ignora RLS. Use só depois de validar o pedido. */
export const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

/** Cliente com o JWT do usuário (respeita RLS) + dados do perfil. */
export async function requireStaff(req: Request, permission?: string) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error } = await userClient.auth.getUser()
  if (error || !userData.user) throw new HttpError(401, 'Faça login novamente')

  const { data: profile } = await admin.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
  if (!profile || !profile.active) throw new HttpError(403, 'Acesso negado')

  if (permission) {
    const { data: allowed } = await userClient.rpc('can', { p_permission: permission })
    if (!allowed) throw new HttpError(403, 'Você não tem permissão para isso')
  }
  return { user: userData.user, profile, client: userClient }
}

export async function requireAdmin(req: Request) {
  const ctx = await requireStaff(req)
  if (ctx.profile.role !== 'admin') throw new HttpError(403, 'Somente administradores')
  return ctx
}

export async function getSettings() {
  const { data, error } = await admin.from('settings').select('*').single()
  if (error) throw error
  return data
}

export function publicUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Troca caminhos de fotos por URLs assinadas (1 dia). */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await admin.storage.from('product-photos').createSignedUrls(paths, 60 * 60 * 24)
  const out: Record<string, string> = {}
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl
  return out
}

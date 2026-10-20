import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin

/** Chama uma Edge Function e devolve o JSON, lançando a mensagem de erro dela. */
export async function invoke<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} })
  if (error) {
    // FunctionsHttpError traz a resposta original no contexto
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json()
        if (payload?.error) throw new Error(payload.error)
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner
      }
    }
    throw new Error(error.message || 'Falha ao falar com o servidor')
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

/** Lança o erro do Supabase ou devolve os dados. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

const signedCache = new Map<string, { url: string; expires: number }>()

/** URL assinada (1h) para arquivos privados, com cache em memória. */
export async function signedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}/${path}`
  const hit = signedCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (!data?.signedUrl) return null
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + 3300_000 })
  return data.signedUrl
}

export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

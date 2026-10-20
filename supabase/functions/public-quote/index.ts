// Página pública da cotação: ver, aprovar ou recusar.
import { handler, HttpError, json } from '../_shared/http.ts'
import { notify } from '../_shared/notify.ts'
import { admin, publicUrl, signPaths } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (_req, body) => {
    const token = String(body.token ?? '').slice(0, 80)
    const action = String(body.action ?? 'get')
    if (!token) throw new HttpError(400, 'Link incompleto')

    if (action === 'aprovar' || action === 'recusar') {
      const { data, error } = await admin.rpc('respond_quote', {
        p_token: token,
        p_action: action,
        p_selections: (body.selections ?? {}) as Record<string, string>,
        p_reason: typeof body.reason === 'string' ? body.reason.slice(0, 1000) : null,
      })
      if (error) throw error
      const requestId = (data as { request_id: string }).request_id
      const jobs = Promise.allSettled(
        action === 'aprovar'
          ? [notify(requestId, 'aprovacao_recebida'), notify(requestId, 'interno_aprovada')]
          : [notify(requestId, 'interno_recusada')],
      )
      // @ts-ignore EdgeRuntime existe no Supabase
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(jobs)
      else await jobs
      return json(data)
    }

    const { data, error } = await admin.rpc('get_public_quote', { p_token: token })
    if (error) throw error
    if (!data) throw new HttpError(404, 'Cotação não encontrada ou ainda não enviada')

    const items = (data.items ?? []) as { photos: string[]; photo_urls?: string[] }[]
    const signed = await signPaths(items.flatMap((i) => i.photos))
    for (const it of items) it.photo_urls = it.photos.map((p) => signed[p]).filter(Boolean)
    data.company.logo_url = publicUrl('branding', data.company.logo_light_path)
    return json(data)
  }),
)

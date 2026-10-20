// Página de acompanhamento: dados do pedido por código + token.
import { handler, HttpError, json } from '../_shared/http.ts'
import { admin, signPaths } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (_req, body) => {
    const code = String(body.code ?? '').slice(0, 20)
    const token = String(body.token ?? '').slice(0, 80)
    if (!code || !token) throw new HttpError(400, 'Link incompleto')

    const { data, error } = await admin.rpc('get_request_tracking', { p_code: code, p_token: token })
    if (error) throw error
    if (!data) throw new HttpError(404, 'Pedido não encontrado')

    const items = (data.items ?? []) as { photos: string[] }[]
    const signed = await signPaths(items.flatMap((i) => i.photos))
    for (const it of items) (it as { photo_urls?: string[] }).photo_urls = it.photos.map((p) => signed[p]).filter(Boolean)
    return json(data)
  }),
)

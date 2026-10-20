// Gera URLs assinadas para o cliente enviar fotos direto ao Storage (bucket privado).
import { handler, HttpError, json } from '../_shared/http.ts'
import { admin, getSettings } from '../_shared/supabase.ts'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

Deno.serve(
  handler(async (_req, body) => {
    const files = Array.isArray(body.files) ? (body.files as { type?: string; size?: number }[]) : []
    const settings = await getSettings()
    const maxFiles = settings.max_items_per_request * settings.max_photos_per_item
    if (files.length === 0) throw new HttpError(400, 'Nenhum arquivo informado')
    if (files.length > Math.min(maxFiles, 50)) throw new HttpError(400, 'Fotos demais em um único envio')

    const batch = crypto.randomUUID()
    const out = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f.type || !ALLOWED.includes(f.type)) throw new HttpError(400, 'Envie apenas imagens (JPG, PNG, WEBP ou HEIC)')
      if (!f.size || f.size > settings.max_photo_mb * 1024 * 1024) {
        throw new HttpError(400, `Cada foto pode ter no máximo ${settings.max_photo_mb} MB`)
      }
      const ext = f.type.split('/')[1].replace('jpeg', 'jpg')
      const path = `pedidos/${batch}/${i}.${ext}`
      const { data, error } = await admin.storage.from('product-photos').createSignedUploadUrl(path)
      if (error) throw error
      out.push({ path, token: data.token, signedUrl: data.signedUrl })
    }
    return json({ uploads: out })
  }),
)

import imageCompression from 'browser-image-compression'
import { invoke, supabase } from '@/lib/supabase'

/** Comprime no navegador (máx. 1600px, ~80%) antes de enviar. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') return file
  try {
    const out = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      initialQuality: 0.8,
      maxSizeMB: 2,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
    return new File([out], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/**
 * Envia as fotos para o Storage usando URLs assinadas (o bucket é privado).
 * Devolve os caminhos na mesma ordem dos arquivos.
 */
export async function uploadPhotos(files: File[], onProgress?: (done: number, total: number) => void): Promise<string[]> {
  if (files.length === 0) return []
  const { uploads } = await invoke<{ uploads: { path: string; token: string }[] }>('get-upload-url', {
    files: files.map((f) => ({ type: f.type, size: f.size })),
  })
  let done = 0
  onProgress?.(0, files.length)
  await Promise.all(
    files.map(async (file, i) => {
      const { path, token } = uploads[i]
      const { error } = await supabase.storage.from('product-photos').uploadToSignedUrl(path, token, file, {
        contentType: file.type,
      })
      if (error) throw new Error('Falha ao enviar uma das fotos. Verifique sua conexão e tente de novo.')
      onProgress?.(++done, files.length)
    }),
  )
  return uploads.map((u) => u.path)
}

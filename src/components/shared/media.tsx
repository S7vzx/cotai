import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, ImageOff, X, ZoomIn } from 'lucide-react'
import * as React from 'react'
import { signedUrl } from '@/lib/supabase'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Imagem de bucket privado (URL assinada) ou URL já pronta. */
export function StorageImage({
  bucket = 'product-photos',
  path,
  url,
  alt = '',
  className,
}: {
  bucket?: string
  path?: string
  url?: string
  alt?: string
  className?: string
}) {
  const { data: src, isLoading } = useQuery({
    queryKey: ['signed', bucket, path],
    queryFn: () => signedUrl(bucket, path!),
    enabled: !url && !!path,
    staleTime: 50 * 60 * 1000,
  })
  const finalSrc = url ?? src
  if (isLoading) return <div className={cn('animate-pulse bg-surface-2', className)} />
  if (!finalSrc)
    return (
      <div className={cn('flex items-center justify-center bg-surface-2 text-fg-3', className)}>
        <ImageOff className="size-5" strokeWidth={1.5} />
      </div>
    )
  return <img src={finalSrc} alt={alt} loading="lazy" className={cn('bg-surface-2 object-cover', className)} />
}

export interface GalleryPhoto {
  path?: string
  url?: string
  alt?: string
}

/** Galeria em miniaturas com lightbox, zoom e download. */
export function PhotoGallery({ photos, className, thumbClass }: { photos: GalleryPhoto[]; className?: string; thumbClass?: string }) {
  const [open, setOpen] = React.useState<number | null>(null)
  if (photos.length === 0) return <p className="text-[15px] text-fg-3">Sem fotos</p>
  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        {photos.map((p, i) => (
          <button
            key={(p.path ?? p.url ?? '') + i}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative overflow-hidden rounded-xl"
            aria-label={`Ampliar foto ${i + 1}`}
          >
            <StorageImage path={p.path} url={p.url} alt={p.alt} className={cn('size-20 rounded-xl', thumbClass)} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
              <ZoomIn className="size-5" />
            </span>
          </button>
        ))}
      </div>
      <Lightbox photos={photos} index={open} onIndexChange={setOpen} />
    </>
  )
}

function Lightbox({
  photos,
  index,
  onIndexChange,
}: {
  photos: GalleryPhoto[]
  index: number | null
  onIndexChange: (i: number | null) => void
}) {
  const [zoom, setZoom] = React.useState(false)
  const p = index !== null ? photos[index] : null
  const { data: src } = useQuery({
    queryKey: ['signed', 'product-photos', p?.path],
    queryFn: () => signedUrl('product-photos', p!.path!),
    enabled: !!p?.path && !p.url,
  })
  const finalSrc = p?.url ?? src
  const go = (d: number) => index !== null && onIndexChange((index + d + photos.length) % photos.length)

  React.useEffect(() => setZoom(false), [index])

  return (
    <DialogPrimitive.Root open={index !== null} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
        >
          <DialogPrimitive.Title className="sr-only">Foto do produto</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Use as setas para navegar entre as fotos</DialogPrimitive.Description>
          <div className="absolute right-4 top-4 flex gap-2">
            {finalSrc && (
              <a
                href={finalSrc}
                download
                target="_blank"
                rel="noreferrer"
                className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Baixar foto"
              >
                <Download className="size-5" />
              </a>
            )}
            <DialogPrimitive.Close
              className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          {photos.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
                aria-label="Anterior"
              >
                <ChevronLeft />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
                aria-label="Próxima"
              >
                <ChevronRight />
              </button>
            </>
          )}
          <div className={cn('max-h-[88dvh] max-w-[92vw]', zoom ? 'overflow-auto' : 'overflow-hidden')}>
            {finalSrc && (
              <img
                src={finalSrc}
                alt={p?.alt ?? ''}
                onClick={() => setZoom((z) => !z)}
                className={cn(
                  'transition-transform duration-300',
                  zoom
                    ? 'max-w-none cursor-zoom-out scale-[1.8] origin-center'
                    : 'max-h-[88dvh] max-w-[92vw] cursor-zoom-in object-contain',
                )}
              />
            )}
          </div>
          {photos.length > 1 && index !== null && (
            <div className="absolute bottom-6 text-[13px] text-white/70 tabular">
              {index + 1} de {photos.length}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function Avatar({ name, url, className }: { name?: string | null; url?: string | null; className?: string }) {
  return (
    <span
      title={name ?? undefined}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] text-[11px] font-semibold text-fg-2',
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  )
}

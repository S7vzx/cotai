import { cn } from '@/lib/utils'

// Geometria copiada de brand/svg/ (não redesenhe o logo).
const WORD_A =
  'M129.05 91.84 A66 66 0 1 0 129.05 180.16 L105.27 158.75 A34 34 0 1 1 105.27 113.25 Z M156 136 A66 66 0 1 0 288 136 A66 66 0 1 0 156 136 Z M188 136 A34 34 0 1 1 256 136 A34 34 0 1 1 188 136 Z'
const WORD_B = 'M324 40H354V200H324Z M300 72H382V98H300Z M496 72H526V200H496Z M552 72H582V200H552Z'
const WORD_C = 'M394 136 A66 66 0 1 0 526 136 A66 66 0 1 0 394 136 Z M426 136 A34 34 0 1 1 494 136 A34 34 0 1 1 426 136 Z'
const WORD_ACCENT = 'M552 58H582L601.63 24H571.63Z'

const SYMBOL_C = 'M188.41 90.43 A88 88 0 1 0 188.41 203.57 L154.71 175.28 A44 44 0 1 1 154.71 118.72 Z'
const SYMBOL_ACCENT = 'M161 59H201L222.94 21H182.94Z'

type Variant = 'cor' | 'mono'

interface Props {
  className?: string
  /** "cor": letras na cor do texto + acento verde. "mono": tudo na cor do texto. */
  variant?: Variant
  title?: string
}

/** Logo principal (nome). Herda a cor do texto via currentColor. */
export function Logo({ className, variant = 'cor', title = 'Cotaí' }: Props) {
  return (
    <svg viewBox="10 36 596 184" role="img" aria-label={title} className={cn('h-7 w-auto', className)}>
      <g fill="currentColor">
        <path fillRule="evenodd" d={WORD_A} />
        <path d={WORD_B} />
        <path fillRule="evenodd" d={WORD_C} />
      </g>
      <path d={WORD_ACCENT} fill={variant === 'cor' ? 'var(--accent)' : 'currentColor'} />
    </svg>
  )
}

/** Símbolo "ć" para espaços pequenos. Nunca use ao lado do nome. */
export function Simbolo({ className, variant = 'cor', title = 'Cotaí' }: Props) {
  return (
    <svg viewBox="16 16 216 224" role="img" aria-label={title} className={cn('size-8', className)}>
      <path d={SYMBOL_C} fill="currentColor" />
      <path d={SYMBOL_ACCENT} fill={variant === 'cor' ? 'var(--accent)' : 'currentColor'} />
    </svg>
  )
}

/** Logo enviado pelo admin (se houver) ou o logo do Cotaí. */
export function BrandLogo({ src, className, alt }: { src?: string | null; className?: string; alt?: string }) {
  if (src) return <img src={src} alt={alt ?? 'Logo'} className={cn('h-7 w-auto object-contain', className)} />
  return <Logo className={className} />
}

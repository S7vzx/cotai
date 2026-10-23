import * as React from 'react'
import { Skeleton } from '@/components/ui/controls'

// Formulário de cartão da AbacatePay (abacatepay.js): os campos ficam num iframe seguro da
// AbacatePay e o número do cartão nunca passa pelo nosso código. Devolve um token ctok_ (60 s).
// A chave pública (pk_) é feita para ficar no navegador; sem ela, o cartão não aparece no resumo.
export const ABACATEPAY_PUBLIC_KEY = (import.meta.env.VITE_ABACATEPAY_PUBLIC_KEY as string | undefined) ?? ''

const SCRIPT_URL = 'https://abacatepay.com/abacatepay.js'

interface Payer {
  name: string
  email: string
  taxId: string
  cellphone: string
}

interface AbacateCheckout {
  mount(target: HTMLElement): Promise<void>
  tokenize(payer: Payer): Promise<{ token: string; brand: string; lastFour: string }>
  destroy(): void
}

declare global {
  interface Window {
    AbacatePay?: {
      create(options: {
        publicKey: string
        amount: number
        locale?: 'pt'
        icons?: boolean
        onCardChange?: (state: { canTokenize: boolean }) => void
      }): AbacateCheckout
    }
  }
}

let loading: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.AbacatePay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      s.remove()
      reject(new Error('PROVIDER_LOAD'))
    }
    document.head.appendChild(s)
  })
  return loading
}

const ERRORS: Record<string, string> = {
  CARD_INCOMPLETE: 'Preencha todos os dados do cartão.',
  CARD_INVALID: 'Confira os dados do cartão.',
  THREE_DS_FAILED: 'O banco não confirmou a compra. Tente de novo ou use outro cartão.',
  PAYER_INVALID: 'Confira seu nome, e-mail e CPF ou CNPJ.',
  NETWORK: 'Falha de conexão. Tente de novo.',
  PROVIDER_LOAD: 'O formulário do cartão não carregou. Desative bloqueadores de anúncio ou pague com Pix.',
  NOT_MOUNTED: 'O formulário do cartão ainda está carregando.',
}

/** Mensagem em português para os erros do abacatepay.js. */
export function cardErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string }
  return (e?.code && ERRORS[e.code]) || (e?.message && ERRORS[e.message]) || e?.message || 'Não foi possível validar o cartão.'
}

export interface CardFormHandle {
  /** Valida o cartão (com 3DS se o banco pedir) e devolve o token. Chame só no clique de pagar. */
  tokenize(payer: Payer): Promise<string>
}

export const CardForm = React.forwardRef<CardFormHandle, { amount: number }>(function CardForm({ amount }, ref) {
  const area = React.useRef<HTMLDivElement>(null)
  const checkout = React.useRef<AbacateCheckout | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = React.useState('')
  const cents = Math.round(amount * 100)

  React.useEffect(() => {
    let cancelled = false
    // um elemento por montagem: o StrictMode monta duas vezes
    const host = area.current!.appendChild(document.createElement('div'))
    setState('loading')
    loadScript()
      .then(() => {
        if (cancelled) return
        const instance = window.AbacatePay!.create({ publicKey: ABACATEPAY_PUBLIC_KEY, amount: cents, locale: 'pt', icons: true })
        checkout.current = instance
        return instance.mount(host).then(() => !cancelled && setState('ready'))
      })
      .catch((err) => {
        if (cancelled) return
        setError(cardErrorMessage(err))
        setState('error')
      })
    return () => {
      cancelled = true
      checkout.current?.destroy()
      checkout.current = null
      host.remove()
    }
  }, [cents])

  React.useImperativeHandle(ref, () => ({
    async tokenize(payer) {
      if (!checkout.current || state !== 'ready') throw new Error(error || ERRORS.NOT_MOUNTED)
      try {
        return (await checkout.current.tokenize(payer)).token
      } catch (err) {
        throw new Error(cardErrorMessage(err))
      }
    },
  }))

  return (
    <div>
      {state === 'loading' && <Skeleton className="h-40" />}
      <div ref={area} className={state === 'ready' ? undefined : 'hidden'} data-testid="card-form" />
      {state === 'error' && (
        <p role="alert" className="text-[13px] text-[var(--status-red)]">
          {error}
        </p>
      )}
    </div>
  )
})

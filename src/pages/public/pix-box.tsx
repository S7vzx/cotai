import { Check, Copy } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { money } from '@/lib/format'

// Forma de pagamento escolhida pelo cliente no resumo do pedido
export type PayMethod = 'pix' | 'card'

export interface PixCharge {
  method?: string // pix_abacatepay, cartao_abacatepay, pix_asaas...
  qr_code: string | null
  qr_code_image: string | null
  // Checkout hospedado (AbacatePay): o cliente paga numa página do provedor e volta para o acompanhamento
  checkout_url?: string | null
  expires_at?: string | null
  status?: string // cartão: APPROVED na hora ou PENDING enquanto o banco responde
  card?: { brand: string; last_four: string }
}

export interface PixManual {
  key: string | null
  key_type?: string | null
  receiver?: string | null
  instructions?: string | null
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-1.5 pl-4">
      <code className="min-w-0 flex-1 truncate text-[13px] text-fg-2" title={value}>
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            toast.success(`${label} copiado`)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            toast.error('Não foi possível copiar. Selecione o texto manualmente.')
          }
        }}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 text-[14px] font-semibold shadow-soft"
      >
        {copied ? <Check className="size-4 text-accent-text" /> : <Copy className="size-4" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export function PixBox({ amount, charge, manual }: { amount: number; charge?: PixCharge | null; manual?: PixManual | null }) {
  const checkoutUrl = charge?.checkout_url
  return (
    <div className="rounded-[22px] bg-surface p-6 shadow-soft">
      <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">
        {charge?.card ? 'Pagamento com cartão' : checkoutUrl ? 'Pagamento da taxa' : 'Pagamento via Pix'}
      </p>
      <p className="mt-1 text-[34px] font-semibold tabular">{money(amount)}</p>
      {charge?.card ? (
        <p className="mt-4 text-[15px] text-fg-2">
          Cartão {charge.card.brand} final {charge.card.last_four} em análise pelo banco. Esta página atualiza sozinha.
        </p>
      ) : checkoutUrl ? (
        <div className="mt-4 space-y-3">
          <Button asChild className="w-full">
            <a href={checkoutUrl}>Pagar agora</a>
          </Button>
          <p className="text-[13px] text-fg-3">
            Você vai para a página segura de pagamento e volta para cá no final. A confirmação é automática.
          </p>
        </div>
      ) : charge?.qr_code ? (
        <div className="mt-4 space-y-4">
          {charge.qr_code_image && (
            <img
              src={`data:image/png;base64,${charge.qr_code_image}`}
              alt="QR Code do Pix"
              className="mx-auto size-52 rounded-xl bg-white p-2"
            />
          )}
          <CopyField value={charge.qr_code} label="Código Pix" />
          <p className="text-[13px] text-fg-3">A confirmação é automática. Esta página atualiza sozinha.</p>
        </div>
      ) : manual?.key ? (
        <div className="mt-4 space-y-3">
          <CopyField value={manual.key} label="Chave Pix" />
          <p className="text-[15px] text-fg-2">
            {manual.receiver && (
              <>
                Recebedor: <b className="text-fg">{manual.receiver}</b>
                <br />
              </>
            )}
            {manual.instructions || 'Assim que confirmarmos o pagamento, sua cotação entra na fila.'}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[15px] text-fg-2">Nossa equipe vai enviar os dados de pagamento pelo WhatsApp.</p>
      )}
    </div>
  )
}

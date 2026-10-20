import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileSearch, Printer } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/states'
import { date, money, phone, waLink } from '@/lib/format'
import { invoke } from '@/lib/supabase'
import { cn, errorMessage } from '@/lib/utils'
import type { QuoteStatus } from '@/types/domain'
import { useDocumentTitle } from './public-layout'

interface PublicOption {
  id: string
  label: string
  sale_price: number
  lead_time_days: number | null
  payment_terms: string | null
  freight_included: boolean
  freight_value: number
  customer_notes: string | null
  selected: boolean
}

interface PublicQuote {
  id: string
  code: string
  status: QuoteStatus
  created_at: string
  sent_at: string | null
  valid_until: string | null
  expired: boolean
  customer_message: string | null
  decline_reason: string | null
  customer: { name: string; company: string }
  fee: { paid: boolean; amount: number; deduct: boolean }
  company: { display_name: string; logo_url: string | null; contact_whatsapp: string | null; contact_email: string | null }
  items: {
    id: string
    name: string
    description: string | null
    quantity: number
    unit: string
    target_price: number
    not_found: boolean
    photo_urls?: string[]
    options: PublicOption[]
  }[]
}

/** Diferença entre o preço encontrado e o alvo. */
export function Comparison({ target, found }: { target: number; found: number }) {
  const diff = found - target
  const pct = target > 0 ? diff / target : 0
  const better = diff <= 0
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular')}
      style={{
        color: better ? 'var(--accent-text)' : 'var(--status-orange)',
        backgroundColor: better ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--status-orange) 13%, transparent)',
      }}
    >
      {diff === 0 ? 'No alvo' : `${better ? '−' : '+'}${money(Math.abs(diff))} (${better ? '−' : '+'}${Math.abs(pct * 100).toFixed(1).replace('.', ',')}%)`}
    </span>
  )
}

export default function Cotacao() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-quote', token],
    queryFn: () => invoke<PublicQuote>('public-quote', { token }),
    retry: false,
  })
  useDocumentTitle(data ? `Cotação ${data.code}` : 'Cotação')

  const [selection, setSelection] = React.useState<Record<string, string>>({})
  const [declineOpen, setDeclineOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')

  React.useEffect(() => {
    if (!data) return
    // seleção inicial: a já escolhida, ou a única opção, ou a mais barata
    const init: Record<string, string> = {}
    for (const it of data.items) {
      if (it.not_found || it.options.length === 0) continue
      const chosen = it.options.find((o) => o.selected) ?? [...it.options].sort((a, b) => a.sale_price - b.sale_price)[0]
      init[it.id] = chosen.id
    }
    setSelection(init)
  }, [data])

  const respond = useMutation({
    mutationFn: (action: 'aprovar' | 'recusar') =>
      invoke('public-quote', { token, action, selections: selection, reason: action === 'recusar' ? reason : null }),
    onSuccess: (_d, action) => {
      toast.success(action === 'aprovar' ? 'Cotação aprovada!' : 'Resposta enviada')
      setDeclineOpen(false)
      qc.invalidateQueries({ queryKey: ['public-quote', token] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (error)
    return (
      <main className="min-h-dvh bg-bg-alt">
        <EmptyState icon={FileSearch} title="Cotação não encontrada" text="O link pode estar incompleto ou a cotação ainda não foi enviada." className="pt-32" />
      </main>
    )
  if (isLoading || !data)
    return (
      <main className="mx-auto max-w-[820px] space-y-4 px-4 py-12">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </main>
    )

  const available = data.items.filter((i) => !i.not_found && i.options.length > 0)
  const lineTotal = (it: PublicQuote['items'][number]) => {
    const o = it.options.find((x) => x.id === selection[it.id])
    if (!o) return 0
    return o.sale_price * it.quantity + (o.freight_included ? 0 : Number(o.freight_value || 0))
  }
  const subtotal = available.reduce((acc, it) => acc + lineTotal(it), 0)
  const deduction = data.fee.deduct ? Math.min(data.fee.amount, subtotal) : 0
  const total = subtotal - deduction
  const canRespond = data.status === 'enviado' && !data.expired
  const wa = waLink(data.company.contact_whatsapp, `Olá! Tenho uma dúvida sobre a cotação ${data.code}.`)

  return (
    <div className="min-h-dvh bg-bg-alt print:bg-white">
      <main className="mx-auto max-w-[820px] px-4 pb-40 pt-8 sm:px-6 sm:pt-12 print:pb-8">
        {/* cabeçalho da proposta */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo src={data.company.logo_url} className="h-7" alt={data.company.display_name} />
            <h1 className="mt-6 text-[34px] font-semibold leading-tight">Cotação {data.code}</h1>
            <p className="mt-1 text-[17px] text-fg-2">
              Para {data.customer.name}
              {data.customer.company && ` · ${data.customer.company}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[15px] sm:text-right">
            <dt className="text-fg-2">Enviada em</dt>
            <dd className="tabular">{date(data.sent_at ?? data.created_at)}</dd>
            <dt className="text-fg-2">Válida até</dt>
            <dd className={cn('tabular', data.expired && 'text-[var(--status-red)]')}>{date(data.valid_until)}</dd>
          </dl>
        </header>

        {data.status === 'aprovado' && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-accent-soft p-4 text-accent-text">
            <Check className="size-5" strokeWidth={2.5} />
            <p className="font-semibold">Você aprovou esta cotação. Em breve entraremos em contato para combinar a compra.</p>
          </div>
        )}
        {data.status === 'recusado' && (
          <div className="mt-8 rounded-2xl bg-surface p-4 text-fg-2">Você recusou esta cotação{data.decline_reason ? `: “${data.decline_reason}”` : '.'}</div>
        )}
        {data.expired && data.status === 'enviado' && (
          <div className="mt-8 rounded-2xl p-4 text-[var(--status-red)]" style={{ background: 'color-mix(in srgb, var(--status-red) 10%, transparent)' }}>
            Cotação expirada — solicite uma atualização pelo WhatsApp.
          </div>
        )}
        {data.customer_message && <p className="mt-8 whitespace-pre-line rounded-2xl bg-surface p-5 text-[17px]">{data.customer_message}</p>}

        {/* produtos */}
        <div className="mt-8 space-y-4">
          {data.items.map((it) => (
            <article key={it.id} className="rounded-[22px] bg-surface p-5 sm:p-6 print:break-inside-avoid print:border print:border-line">
              <div className="flex gap-4">
                {it.photo_urls?.[0] ? (
                  <img src={it.photo_urls[0]} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="size-20 shrink-0 rounded-xl bg-surface-2" />
                )}
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold leading-snug">{it.name}</h2>
                  <p className="mt-1 text-[15px] text-fg-2 tabular">
                    {it.quantity} {it.unit} · preço-alvo {money(it.target_price)}/un
                  </p>
                </div>
              </div>

              {it.not_found || it.options.length === 0 ? (
                <p className="mt-4 rounded-xl bg-surface-2 p-4 text-[15px] text-fg-2">Não encontramos este produto pelo preço-alvo.</p>
              ) : (
                <div className="mt-5 space-y-2" role="radiogroup" aria-label={`Opções para ${it.name}`}>
                  {it.options.map((o) => {
                    const checked = selection[it.id] === o.id
                    const showRadio = it.options.length > 1 && canRespond
                    return (
                      <label
                        key={o.id}
                        className={cn(
                          'block rounded-2xl border p-4 transition-colors',
                          checked ? 'border-accent bg-accent-soft/40' : 'border-line',
                          showRadio && 'cursor-pointer hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]',
                          !checked && !canRespond && data.status !== 'enviado' && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {showRadio && (
                            <input
                              type="radio"
                              name={`opt-${it.id}`}
                              className="mt-1.5 size-5 accent-[var(--accent)]"
                              checked={checked}
                              onChange={() => setSelection((s) => ({ ...s, [it.id]: o.id }))}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Opção {o.label}</span>
                              <Comparison target={it.target_price} found={o.sale_price} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[24px] font-semibold tabular">
                                {money(o.sale_price)}
                                <span className="text-[15px] font-normal text-fg-2">/un</span>
                              </span>
                              <span className="text-[15px] text-fg-2 tabular">Subtotal {money(o.sale_price * it.quantity)}</span>
                            </div>
                            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-fg-2">
                              {o.lead_time_days != null && <div>Prazo: <b className="font-medium text-fg">{o.lead_time_days} dias</b></div>}
                              {o.payment_terms && <div>Pagamento: <b className="font-medium text-fg">{o.payment_terms}</b></div>}
                              <div>
                                Frete: <b className="font-medium text-fg">{o.freight_included ? 'incluso' : money(o.freight_value)}</b>
                              </div>
                            </dl>
                            {o.customer_notes && <p className="mt-2 text-[15px]">{o.customer_notes}</p>}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </article>
          ))}
        </div>

        {/* total */}
        {available.length > 0 && (
          <section className="mt-6 rounded-[22px] bg-surface p-6 print:border print:border-line">
            {deduction > 0 && (
              <>
                <div className="flex justify-between text-[17px]">
                  <span className="text-fg-2">Subtotal</span>
                  <span className="tabular">{money(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[17px]">
                  <span className="text-fg-2">Taxa de cotação abatida</span>
                  <span className="tabular text-accent-text">−{money(deduction)}</span>
                </div>
              </>
            )}
            <div className={cn('flex items-baseline justify-between', deduction > 0 && 'mt-3 border-t border-line pt-3')}>
              <span className="text-[19px] font-semibold">Total</span>
              <span className="text-[34px] font-semibold tabular">{money(total)}</span>
            </div>
          </section>
        )}

        <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-4 text-[15px]">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-accent-text">
            <Printer className="size-4" /> Baixar PDF
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="text-accent-text">
              Tirar dúvidas no WhatsApp {data.company.contact_whatsapp ? `· ${phone(data.company.contact_whatsapp)}` : ''}
            </a>
          )}
        </div>
      </main>

      {canRespond && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-chrome pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[820px] items-center gap-3 px-4 py-3 sm:px-6">
            <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
              Recusar
            </Button>
            <Button className="min-w-0 flex-1" loading={respond.isPending} disabled={available.length === 0} onClick={() => respond.mutate('aprovar')}>
              <span className="truncate">
                Aprovar<span className="hidden sm:inline"> cotação</span> · {money(total)}
              </span>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent
          title="Recusar cotação"
          description="Conte o motivo, se quiser. Isso nos ajuda a melhorar."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeclineOpen(false)}>Voltar</Button>
              <Button variant="danger" loading={respond.isPending} onClick={() => respond.mutate('recusar')}>Recusar</Button>
            </>
          }
        >
          <Field label="Motivo (opcional)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: preço acima do esperado" />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  )
}

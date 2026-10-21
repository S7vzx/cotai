import { Plus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePublicSettings } from '@/features/settings/api'
import { previewFee } from '@/lib/fee'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { HeroFlow } from './hero-flow'
import { LANDING, LANDING_ETA, LANDING_FAQ } from './landing-content'
import { PublicFooter, PublicHeader, useDocumentTitle } from './public-layout'

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={shown ? { animation: 'rise 700ms cubic-bezier(0.25,0.1,0.25,1) both' } : { opacity: 0 }}>
      {children}
    </div>
  )
}

/** Miniaturas da interface usadas no "Como funciona" (a própria UI, não ilustração). */
function StepVisual({ index }: { index: number }) {
  const card = 'w-full max-w-[320px] rounded-[22px] bg-surface p-5 shadow-soft'
  switch (index) {
    case 0:
      return (
        <div className={card}>
          <div className="flex gap-3">
            <div className="flex size-16 items-center justify-center rounded-xl bg-surface-2 text-[11px] text-fg-3">foto</div>
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-surface-2" />
              <div className="h-3 w-1/2 rounded bg-surface-2" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
            <span className="text-[13px] text-fg-2">Preço-alvo</span>
            <span className="tabular font-semibold">R$ 160,00</span>
          </div>
        </div>
      )
    case 1:
      return (
        <div className={card}>
          <p className="text-[13px] text-fg-2">Taxa de cotação</p>
          <div className="mx-auto my-4 grid size-28 grid-cols-5 gap-1 rounded-xl bg-surface-2 p-3">
            {Array.from({ length: 25 }).map((_, i) => (
              <span key={i} className={cn('rounded-[2px]', [0, 2, 4, 6, 8, 11, 12, 13, 16, 18, 20, 22, 24].includes(i) ? 'bg-fg' : 'bg-transparent')} />
            ))}
          </div>
          <p className="text-center text-[13px] text-fg-2">Pix copia e cola</p>
        </div>
      )
    case 2:
      return (
        <div className={cn(card, 'space-y-2')}>
          {['Fornecedor A', 'Fornecedor B', 'Fornecedor C'].map((f, i) => (
            <div key={f} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[15px]">
              <span className="text-fg-2">{f}</span>
              <span className={cn('tabular font-semibold', i === 2 && 'text-accent-text')}>{['R$ 189', 'R$ 174', 'R$ 152'][i]}</span>
            </div>
          ))}
        </div>
      )
    default:
      return (
        <div className={card}>
          <div className="rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px]">
            Sua cotação <b>COT-000123</b> está pronta. Total: <b>R$ 3.040,00</b>
          </div>
          <div className="mt-4 flex h-11 items-center justify-center rounded-full bg-accent text-[17px] font-bold text-on-accent">Aprovar cotação</div>
        </div>
      )
  }
}

function Faq({ items }: { items: { id: string; question: string; answer: string }[] }) {
  const [open, setOpen] = React.useState<string | null>(null)
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((f) => {
        const isOpen = open === f.id
        return (
          <div key={f.id}>
            <button
              className="flex w-full items-center justify-between gap-6 py-5 text-left text-[19px] font-semibold"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : f.id)}
            >
              {f.question}
              <Plus className={cn('size-5 shrink-0 text-fg-2 transition-transform duration-300', isOpen && 'rotate-45')} />
            </button>
            <div className={cn('grid transition-all duration-300 ease-apple', isOpen ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]')}>
              <p className="overflow-hidden text-[17px] text-fg-2">{f.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Landing() {
  // Os textos são fixos (landing-content.ts); do banco vem só a taxa, que aparece quando chegar
  const { data } = usePublicSettings()
  useDocumentTitle(data?.seo_title ?? undefined)

  const fee = data ? previewFee(data.charge, 1) : 0
  const showFee = !!data?.charge.enabled && data.charge.show_on_landing && fee > 0
  const ctaLabel = (base: string) => (showFee ? `${base} — ${data?.charge.model === 'fixo_pedido' ? '' : 'a partir de '}${money(fee)}` : base)
  const steps = LANDING.steps.filter((s) => s.active && (!s.payment || data?.charge.enabled))

  return (
    <div className="min-h-dvh bg-bg">
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="overflow-hidden">
          <div className="mx-auto max-w-[1080px] px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-24">
            <div style={{ animation: 'rise 700ms cubic-bezier(0.25,0.1,0.25,1) both' }}>
              <h1 className="mx-auto max-w-[820px] text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[64px]">
                {LANDING.hero.title}
              </h1>
              <p className="mx-auto mt-5 max-w-[620px] text-[19px] leading-snug text-fg-2 sm:text-[21px]">{LANDING.hero.subtitle}</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
                <Button asChild size="lg">
                  <Link to="/cotar">{ctaLabel(LANDING.hero.cta_primary)}</Link>
                </Button>
                <a href="#como-funciona" className="text-[19px] text-accent-text hover:underline underline-offset-4">
                  {LANDING.hero.cta_secondary} ›
                </a>
              </div>
              <p className="mt-4 text-[13px] text-fg-3">Resposta {LANDING_ETA}</p>
            </div>
          </div>
          <div className="mx-auto max-w-[1180px] px-4 pb-20 sm:px-6">
            <HeroFlow />
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="scroll-mt-14 bg-bg-alt py-24 sm:py-32">
          <div className="mx-auto max-w-[980px] px-4 sm:px-6">
            <Reveal>
              <h2 className="text-center text-[34px] font-semibold leading-tight sm:text-[48px]">Como funciona.</h2>
            </Reveal>
            <ol className="mt-16 space-y-20 sm:space-y-28">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <Reveal className={cn('flex flex-col items-center gap-10 sm:flex-row sm:gap-16', i % 2 === 1 && 'sm:flex-row-reverse')}>
                    <div className="flex-1 text-center sm:text-left">
                      <span className="block text-[72px] font-extralight leading-none text-fg-3 tabular sm:text-[96px]">{i + 1}</span>
                      <h3 className="mt-4 text-[28px] font-semibold leading-tight sm:text-[32px]">{s.title}</h3>
                      <p className="mt-3 text-[19px] text-fg-2">{s.text}</p>
                    </div>
                    <div className="flex flex-1 justify-center">
                      <StepVisual index={LANDING.steps.indexOf(s)} />
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Vantagens */}
        <section id="vantagens" className="scroll-mt-14 py-24 sm:py-32">
          <div className="mx-auto max-w-[980px] px-4 sm:px-6">
            <Reveal>
              <h2 className="max-w-[640px] text-[34px] font-semibold leading-tight sm:text-[48px]">Feito para quem compra para a empresa.</h2>
            </Reveal>
            <div className="mt-14 grid gap-x-16 sm:grid-cols-2">
              {LANDING.benefits.map((b) => (
                <Reveal key={b.title} className="border-t border-line py-8">
                  <h3 className="text-[21px] font-semibold">{b.title}</h3>
                  <p className="mt-2 text-[17px] text-fg-2">{b.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="perguntas" className="scroll-mt-14 bg-bg-alt py-24 sm:py-32">
          <div className="mx-auto max-w-[760px] px-4 sm:px-6">
            <h2 className="mb-10 text-[34px] font-semibold leading-tight sm:text-[48px]">Perguntas frequentes.</h2>
            <Faq items={LANDING_FAQ} />
          </div>
        </section>

        {/* CTA final */}
        <section className="py-24 text-center sm:py-32">
          <div className="mx-auto max-w-[720px] px-4 sm:px-6">
            <h2 className="text-[34px] font-semibold leading-tight sm:text-[48px]">{LANDING.cta_final.title}</h2>
            <p className="mt-4 text-[19px] text-fg-2">{LANDING.cta_final.text}</p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/cotar">{ctaLabel(LANDING.cta_final.button)}</Link>
            </Button>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

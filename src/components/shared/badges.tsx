import { cn } from '@/lib/utils'
import { PAYMENT_STATUS, PRIORITY, PURCHASE_STATUS, QUOTE_STATUS, TONE_VAR } from '@/lib/status'
import type { PaymentStatus, Priority, PurchaseStatus, QuoteStatus } from '@/types/domain'

type Tone = keyof typeof TONE_VAR

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const c = TONE_VAR[tone]
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap',
        className,
      )}
      style={{ color: c, backgroundColor: `color-mix(in srgb, ${c} 13%, transparent)` }}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status, short }: { status: QuoteStatus; short?: boolean }) {
  const s = QUOTE_STATUS[status]
  return <Badge tone={s.tone}>{short ? s.short : s.label}</Badge>
}

export function PurchaseBadge({ status }: { status: PurchaseStatus }) {
  const s = PURCHASE_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function PriorityBadge({ priority, hideNormal }: { priority: Priority; hideNormal?: boolean }) {
  if (hideNormal && priority === 'normal') return null
  const p = PRIORITY[priority]
  return <Badge tone={p.tone}>{p.label}</Badge>
}

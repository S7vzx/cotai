import type { LucideIcon } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn, errorMessage } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  text?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <Icon className="size-12 text-fg-3" strokeWidth={1.25} aria-hidden />
      <h3 className="mt-4 text-[19px] font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-[15px] text-fg-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <AlertCircle className="size-10 text-[var(--status-red)]" strokeWidth={1.5} aria-hidden />
      <h3 className="mt-3 text-[17px] font-semibold">Não foi possível carregar</h3>
      <p className="mt-1 max-w-sm text-[15px] text-fg-2">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

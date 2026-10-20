import { ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Grupo "inset grouped" do iOS: título pequeno, linhas com hairline. */
export function Group({
  title,
  footer,
  className,
  children,
  action,
}: {
  title?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between px-4">
          {title && <h3 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">{title}</h3>}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-[14px] bg-surface [&>*+*]:border-t [&>*+*]:border-line dark:bg-surface">{children}</div>
      {footer && <p className="px-4 text-[13px] leading-snug text-fg-3">{footer}</p>}
    </section>
  )
}

interface RowProps {
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  children?: React.ReactNode
  to?: string
  onClick?: () => void
  className?: string
  /** Empilha o controle embaixo do rótulo (para inputs largos) */
  stacked?: boolean
}

export function Row({ label, description, icon, children, to, onClick, className, stacked }: RowProps) {
  const content = (
    <div
      className={cn(
        'flex min-h-[52px] gap-3 px-4 py-2.5',
        stacked ? 'flex-col items-stretch py-3.5' : 'items-center',
        (to || onClick) && 'hover:bg-surface-2/60',
        className,
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-3', !stacked && 'flex-1')}>
        {icon && <span className="flex size-7 shrink-0 items-center justify-center text-fg-2">{icon}</span>}
        <div className="min-w-0">
          <div className="text-[17px] leading-tight">{label}</div>
          {description && <div className="mt-0.5 text-[13px] leading-snug text-fg-2">{description}</div>}
        </div>
      </div>
      {children && <div className={cn(stacked ? 'w-full' : 'shrink-0')}>{children}</div>}
      {(to || onClick) && <ChevronRight className="size-4 shrink-0 text-fg-3" />}
    </div>
  )
  if (to)
    return (
      <Link to={to} className="block">
        {content}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    )
  return content
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-surface p-5 shadow-soft', className)}>{children}</div>
}

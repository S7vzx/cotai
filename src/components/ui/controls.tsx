import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full bg-[color-mix(in_srgb,var(--fg)_16%,transparent)] transition-colors duration-200 data-[state=checked]:bg-accent disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-[27px] translate-x-[2px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200 ease-apple data-[state=checked]:translate-x-[22px]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'flex size-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-[color-mix(in_srgb,var(--fg)_30%,transparent)] transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check className="size-4 text-on-accent" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode; title?: string }[]
  className?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}

/** Controle segmentado no estilo iOS. */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md', ...rest }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={rest['aria-label']} className={cn('inline-flex rounded-[10px] bg-surface-2 p-[3px]', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[8px] font-medium whitespace-nowrap transition-all duration-200 ease-apple',
              size === 'sm' ? 'h-7 px-3 text-[13px]' : 'h-8 px-4 text-[15px]',
              active ? 'bg-surface text-fg shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-[#636366]' : 'text-fg-2 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} aria-hidden />
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-fg-3/30 border-t-fg-2', className)}
    />
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

export const inputBase =
  'w-full rounded-xl bg-surface-2 px-4 text-[17px] text-fg placeholder:text-fg-3 outline-none transition-shadow duration-200 ' +
  'focus:shadow-[0_0_0_4px_var(--accent-soft)] focus:ring-1 focus:ring-accent disabled:opacity-60 ' +
  'aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-[var(--status-red)]'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputBase, 'h-11', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(inputBase, 'min-h-[88px] py-3 leading-snug', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(inputBase, 'h-11 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-2">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  ),
)
NativeSelect.displayName = 'NativeSelect'

interface FieldProps {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  // Liga o rótulo ao campo automaticamente (acessibilidade e leitores de tela)
  const autoId = React.useId()
  const single = React.Children.count(children) === 1 ? React.Children.toArray(children)[0] : null
  const child = React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(single) ? single : null
  const id = htmlFor ?? child?.props.id ?? autoId
  const describedBy = error || hint ? `${id}-desc` : undefined
  const control = child ? React.cloneElement(child, { id, 'aria-describedby': describedBy }) : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-fg-2">
          {label}
          {required && <span className="text-fg-3"> *</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={describedBy} role="alert" className="text-[13px] text-[var(--status-red)]">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-[13px] text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

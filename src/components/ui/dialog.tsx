import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

interface ContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** "side" abre como painel lateral no desktop (detalhes de compras, etc.) */
  variant?: 'center' | 'side'
}

const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

/**
 * No celular vira uma "bottom sheet" que sobe de baixo, com alça.
 * No desktop é uma sheet centralizada (ou lateral, com variant="side").
 */
export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  variant = 'center',
  className,
  children,
  ...props
}: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface text-fg shadow-2xl outline-none',
          'inset-x-0 bottom-0 rounded-t-[22px] data-[state=open]:animate-[sheet-up_320ms_cubic-bezier(0.25,0.1,0.25,1)]',
          variant === 'center'
            ? cn(
                'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:data-[state=open]:animate-[pop-in_220ms_cubic-bezier(0.25,0.1,0.25,1)]',
                sizes[size],
              )
            : 'sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:h-dvh sm:max-h-dvh sm:max-w-xl sm:rounded-none sm:rounded-l-[22px] sm:data-[state=open]:animate-[slide-in_280ms_cubic-bezier(0.25,0.1,0.25,1)]',
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-fg-3/30 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-4 sm:pt-6">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[22px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[15px] text-fg-2">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-2 hover:text-fg"
            aria-label="Fechar"
          >
            <X className="size-4" strokeWidth={2.2} />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive,
  loading,
  onConfirm,
  children,
}: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <button className="h-11 rounded-full bg-surface-2 px-5 text-[17px] font-semibold">Cancelar</button>
            </DialogClose>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'h-11 rounded-full px-5 text-[17px] font-semibold disabled:opacity-50',
                destructive ? 'bg-[var(--status-red)] text-white' : 'bg-accent text-on-accent font-bold text-[19px]',
              )}
            >
              {loading ? 'Aguarde…' : confirmLabel}
            </button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

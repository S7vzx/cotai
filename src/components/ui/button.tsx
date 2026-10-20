import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-200 ease-apple disabled:pointer-events-none disabled:opacity-45 select-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Texto branco sobre o verde exige 19px bold para contraste AA (ver docs/MARCA.md).
        primary: 'rounded-full bg-accent text-on-accent hover:bg-accent-hover font-bold',
        secondary: 'rounded-full bg-surface-2 text-fg hover:bg-[color-mix(in_srgb,var(--surface-2)_80%,var(--fg)_6%)]',
        outline: 'rounded-full border border-line bg-transparent text-fg hover:bg-surface-2',
        ghost: 'rounded-xl bg-transparent text-fg hover:bg-surface-2',
        link: 'text-accent-text hover:underline underline-offset-4 font-medium px-0',
        danger: 'rounded-full bg-[var(--status-red)] text-white hover:opacity-90',
        'danger-ghost': 'rounded-xl text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)]',
      },
      size: {
        sm: 'h-9 px-4 text-[15px]',
        md: 'h-11 px-5 text-[17px]',
        lg: 'h-13 px-7 text-[19px]',
        icon: 'h-10 w-10 rounded-full',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    compoundVariants: [
      { variant: 'primary', size: 'md', className: 'text-[19px]' },
      { variant: 'link', size: 'md', className: 'h-auto px-0' },
      { variant: 'link', size: 'sm', className: 'h-auto px-0' },
    ],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }

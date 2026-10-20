import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Menu = Dropdown.Root
export const MenuTrigger = Dropdown.Trigger

export function MenuContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[200px] overflow-hidden rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-1.5 shadow-xl backdrop-blur-xl',
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  )
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dropdown.Item> & { destructive?: boolean }) {
  return (
    <Dropdown.Item
      className={cn(
        'flex h-9 cursor-default items-center gap-2.5 rounded-lg px-3 text-[15px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-on-accent data-[disabled]:opacity-40',
        destructive && 'text-[var(--status-red)]',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparator() {
  return <Dropdown.Separator className="mx-2 my-1 h-px bg-line" />
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <Dropdown.Label className="px-3 pb-1 pt-1.5 text-[12px] font-medium text-fg-3">{children}</Dropdown.Label>
}

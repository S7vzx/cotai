import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex rounded-[10px] bg-surface-2 p-[3px]', className)} {...props} />
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'h-8 rounded-[8px] px-4 text-[15px] font-medium text-fg-2 transition-all data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:data-[state=active]:bg-[#636366]',
        className,
      )}
      {...props}
    />
  )
}

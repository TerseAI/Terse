import * as React from "react"

import * as TabsPrimitive from "@radix-ui/react-tabs"
import { type VariantProps, cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const tabsListVariants = cva("inline-flex items-center justify-center text-muted-foreground", {
    variants: {
        variant: {
            default: "h-9 rounded-lg bg-muted p-1",
            line: "w-full flex border-b border-border -mb-px"
        }
    },
    defaultVariants: {
        variant: "default"
    }
})

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>>(
    ({ className, variant, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn(tabsListVariants({ variant }), className)} {...props} />
)
TabsList.displayName = TabsPrimitive.List.displayName

const tabsTriggerVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    {
        variants: {
            variant: {
                default: "rounded-md px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                line: "flex-1 border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:hover:text-foreground"
            }
        },
        defaultVariants: {
            variant: "default"
        }
    }
)

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>>(
    ({ className, variant, ...props }, ref) => <TabsPrimitive.Trigger ref={ref} className={cn(tabsTriggerVariants({ variant }), className)} {...props} />
)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn("mt-2 outline-none", className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }

"use client"

import * as React from "react"

import { GripVertical } from "lucide-react"
import { Group, Panel, Separator, usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
    return <Group className={cn("flex h-full w-full", className)} {...props} />
}

function ResizablePanel({ className, panelRef, ...props }: React.ComponentProps<typeof Panel>) {
    return <Panel className={cn("", className)} panelRef={panelRef} {...props} />
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof Separator> & {
    withHandle?: boolean
}) {
    return (
        <Separator
            className={cn(
                "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-1 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90",
                className
            )}
            {...props}
        >
            {withHandle && (
                <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
                    <GripVertical className="h-2.5 w-2.5" />
                </div>
            )}
        </Separator>
    )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle, usePanelRef, type PanelImperativeHandle }

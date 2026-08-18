import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Clears the overlay sidebar trigger; equal left/right keeps the column centered. */
export const PAGE_SHELL = "px-16 pt-3 pb-10"

/** Gutters and measure for pages that scroll as a document. */
export function PageFrame({ children }: { children: ReactNode }) {
    return (
        <div className={cn("h-full min-w-0 overflow-y-auto overscroll-contain", PAGE_SHELL)}>
            <div className={PAGE_COLUMN}>{children}</div>
        </div>
    )
}

/** The column on its own, for pages that fill the viewport and scroll inside their own panes. */
export function PageColumn({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn(PAGE_COLUMN, className)}>{children}</div>
}

/** Wraps the title (and any actions/meta) so every page uses the same gap before content. */
export function PageHeader({ className, children }: { className?: string; children: ReactNode }) {
    return <header className={cn("mb-4", className)}>{children}</header>
}

/** Same height and vertical center as the sidebar org switcher. */
export function PageTitle({ className, children }: { className?: string; children: ReactNode }) {
    return <h1 className={cn("flex h-12 min-w-0 items-center text-2xl font-semibold tracking-tight text-foreground", className)}>{children}</h1>
}

const PAGE_COLUMN = "mx-auto w-full max-w-4xl"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Gutters and measure for pages that scroll as a document. */
export function PageFrame({ children }: { children: ReactNode }) {
    return (
        <div className="h-full min-w-0 overflow-y-auto overscroll-contain px-4 pt-6 pb-10">
            <div className={PAGE_COLUMN}>{children}</div>
        </div>
    )
}

/** The column on its own, for pages that fill the viewport and scroll inside their own panes. */
export function PageColumn({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn(PAGE_COLUMN, className)}>{children}</div>
}

const PAGE_COLUMN = "mx-auto w-full max-w-4xl"

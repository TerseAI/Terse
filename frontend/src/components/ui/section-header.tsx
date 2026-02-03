import * as React from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = React.HTMLAttributes<HTMLHeadingElement>

/**
 * Consistent, extra-large section title used across pages.
 */
export function SectionHeader({ className, ...props }: SectionHeaderProps) {
    return <h2 className={cn("text-3xl font-semibold tracking-tight leading-tight", className)} {...props} />
}

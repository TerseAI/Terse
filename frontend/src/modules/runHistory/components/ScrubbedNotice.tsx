import { EyeOff } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/utils/time"

type Variant = "marker" | "inline" | "panel"

type Props = {
    scrubbedAt: string
    variant?: Variant
    className?: string
}

const DEFAULT_HEADING = "Content removed after 30 days"
const DEFAULT_SUBTEXT = "Older runs are scrubbed for compliance. Run metadata is preserved."

export function ScrubbedNotice({ scrubbedAt, variant = "inline", className }: Props) {
    const tooltipLabel = `Scrubbed ${formatTimestamp(scrubbedAt)}`

    if (variant === "marker") {
        return (
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span aria-label={tooltipLabel} className={cn("inline-flex items-center text-muted-foreground/70", className)}>
                            <EyeOff className="size-3.5" aria-hidden="true" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{tooltipLabel}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    if (variant === "inline") {
        return (
            <div className={cn("flex items-center gap-2 text-xs text-muted-foreground/80", className)} title={tooltipLabel}>
                <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{DEFAULT_HEADING}</span>
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/10 px-6 py-8 text-center", className)} title={tooltipLabel}>
            <EyeOff className="size-5 text-muted-foreground/70" aria-hidden="true" />
            <div className="text-sm font-medium text-muted-foreground">{DEFAULT_HEADING}</div>
            <div className="max-w-sm text-xs text-muted-foreground/70">{DEFAULT_SUBTEXT}</div>
        </div>
    )
}

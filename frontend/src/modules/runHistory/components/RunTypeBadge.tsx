import { FlaskConical, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
    isTest?: boolean
    isManuallyTriggered?: boolean
    replayOfRunId?: string | null
    onOpenOriginal?: (originalRunId: string) => void
    className?: string
}

export default function RunTypeBadge({ isTest, isManuallyTriggered, replayOfRunId, onOpenOriginal, className }: Props) {
    // A replay overrides the test/manual badges: how it was originally triggered is carried by the
    // original run, which this badge links to.
    if (replayOfRunId) {
        const base = "inline-flex items-center gap-1 rounded-full bg-replay/10 px-2 py-0.5 font-medium text-replay flex-shrink-0"
        const label = (
            <>
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Replay
            </>
        )
        if (onOpenOriginal) {
            return (
                <button
                    type="button"
                    onClick={e => {
                        e.stopPropagation()
                        onOpenOriginal(replayOfRunId)
                    }}
                    title="Replay of an earlier run — open the original"
                    className={cn(
                        base,
                        "transition-colors hover:bg-replay/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-replay/40 focus-visible:ring-offset-1",
                        className
                    )}
                >
                    {label}
                </button>
            )
        }
        return (
            <span title="Replay of an earlier run" className={cn(base, className)}>
                {label}
            </span>
        )
    }
    if (isTest) {
        return (
            <span className={cn("inline-flex items-center gap-1 rounded-full bg-accent-tertiary/10 px-2 py-0.5 font-medium text-accent-tertiary flex-shrink-0", className)}>
                <FlaskConical className="w-3 h-3" />
                Test run
            </span>
        )
    }
    if (isManuallyTriggered) {
        return <span className={cn("inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-success flex-shrink-0", className)}>Manual</span>
    }
    return null
}

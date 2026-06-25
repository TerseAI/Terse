import { FlaskConical } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
    isTest?: boolean
    isManuallyTriggered?: boolean
    className?: string
}

export default function RunTypeBadge({ isTest, isManuallyTriggered, className }: Props) {
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

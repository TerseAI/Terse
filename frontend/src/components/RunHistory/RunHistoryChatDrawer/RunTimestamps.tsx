import { getFullTimestamp } from "@/utility/timeUtils"

type Props = {
    startTimestamp?: string
    endTimestamp?: string
}

export default function RunTimestamps({ startTimestamp, endTimestamp }: Props) {
    if (!startTimestamp && !endTimestamp) {
        return null
    }

    return (
        <div className="pt-4 border-t border-border space-y-2">
            {startTimestamp && <div className="text-center text-xs text-muted-foreground">Started: {getFullTimestamp(startTimestamp)}</div>}
            {endTimestamp && <div className="text-center text-xs text-muted-foreground">Completed: {getFullTimestamp(endTimestamp)}</div>}
        </div>
    )
}

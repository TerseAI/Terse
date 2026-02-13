import { MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatTimestamp } from "@/utility/timeUtils"

import { RunHistoryRecord } from "../../../shared/RunHistoryTypes"
import RunHistoryStatusBadge from "../RunHistoryStatusBadge"

import RunHistoryItemHeader from "./RunHistoryItemHeader"

type Props = {
    run: RunHistoryRecord
    runNumber?: number
    onViewChat?: (runId: string) => void
}

export default function RunHistoryItem({ run, runNumber, onViewChat }: Props) {
    const handleDrawerOpen = () => {
        onViewChat?.(run.id)
    }

    const copyToClipboard = (text: string) => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {})
        }
    }

    return (
        <div className="overflow-hidden bg-card border border-border rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                    <RunHistoryItemHeader run={run} runNumber={runNumber} formattedTimestamp={formatTimestamp(run.timestamp)} onCopy={copyToClipboard} />
                </div>
                <div className="flex items-center gap-3 md:ml-auto shrink-0">
                    <RunHistoryStatusBadge status={run.status} filtered={run.filtered} />
                    <Button variant="outline" size="sm" onClick={handleDrawerOpen} className="flex items-center gap-2" title="View chat">
                        <MessageSquare className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

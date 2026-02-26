import { Check, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/utility/timeUtils"

import { RunHistoryRecord } from "../../../shared/RunHistoryTypes"
import RunHistoryStatusBadge from "../RunHistoryStatusBadge"

import RunHistoryItemHeader from "./RunHistoryItemHeader"

type Props = {
    run: RunHistoryRecord
    onViewChat?: (runId: string) => void
    className?: string
    showStatusBadge?: boolean
    onApprove?: (runId: string) => void
    showApproveButton?: boolean
    showViewChatButton?: boolean
    viewButtonLabel?: string
}

export default function RunHistoryItem({ run, onViewChat, className, showStatusBadge = true, onApprove, showApproveButton, showViewChatButton, viewButtonLabel }: Props) {
    const shouldShowApproveButton = showApproveButton ?? Boolean(onApprove)
    const shouldShowViewChatButton = showViewChatButton ?? Boolean(onViewChat)

    const handleDrawerOpen = () => {
        onViewChat?.(run.id)
    }
    const handleApprove = () => {
        onApprove?.(run.id)
    }

    const copyToClipboard = (text: string) => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {})
        }
    }

    return (
        <div className={cn("overflow-hidden bg-card border border-border rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink", className)}>
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                    <RunHistoryItemHeader run={run} formattedTimestamp={formatTimestamp(run.timestamp)} onCopy={copyToClipboard} />
                </div>
                <div className="flex items-center gap-3 md:ml-auto shrink-0">
                    {showStatusBadge && <RunHistoryStatusBadge status={run.status} filtered={run.filtered} />}
                    {shouldShowApproveButton && (
                        <Button variant="outline" size="icon-sm" onClick={handleApprove} title="Approve run">
                            <Check className="w-4 h-4" />
                        </Button>
                    )}
                    {shouldShowViewChatButton && (
                        <Button variant="outline" size="icon-sm" onClick={handleDrawerOpen} title="Open run history">
                            <MessageSquare className="w-4 h-4" />
                            {viewButtonLabel && <span>{viewButtonLabel}</span>}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

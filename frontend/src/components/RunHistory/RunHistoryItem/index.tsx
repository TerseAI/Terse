import { useState } from "react"

import { Check, MessageSquare, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { RunHistoryRecord } from "terse-types"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/utility/timeUtils"

import { BackendProvider } from "../../../services/backend"
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
    const [isReTriggering, setIsReTriggering] = useState(false)
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

    const handleReTrigger = async () => {
        if (isReTriggering) return
        setIsReTriggering(true)
        try {
            await BackendProvider.triggerWithEvent(run.agentId, undefined, run.id)
            toast.success("Run re-triggered")
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status
            if (status === 404) {
                toast.error("Could not re-trigger run: the original event or automation is no longer available")
            } else {
                toast.error("Failed to re-trigger run")
            }
        } finally {
            setIsReTriggering(false)
        }
    }

    return (
        <div className={cn("overflow-hidden bg-card border border-border rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink", className)}>
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                    <RunHistoryItemHeader run={run} formattedTimestamp={formatTimestamp(run.timestamp)} onCopy={copyToClipboard} />
                </div>
                <div className="flex items-center gap-3 md:ml-auto shrink-0">
                    {showStatusBadge && <RunHistoryStatusBadge status={run.status} />}
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
                    <Button variant="outline" size="icon-sm" onClick={handleReTrigger} disabled={isReTriggering} title="Re-trigger run">
                        <RefreshCcw className={cn("w-4 h-4", isReTriggering && "animate-spin")} />
                    </Button>
                </div>
            </div>
        </div>
    )
}

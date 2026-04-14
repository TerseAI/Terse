import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2 } from "lucide-react"
import { RunHistoryStatus, RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { RunHistoryRecord } from "terse-types/RunHistoryTypes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/pages/Agents/components/Integration"

import RunHistoryStatusBadge from "../RunHistoryStatusBadge"

type Props = {
    trigger: RunHistoryTrigger
    runNumber?: number
    totalEvents?: number
    status: RunHistoryStatus
    filtered: boolean
    runs?: RunHistoryRecord[]
    currentRunIndex?: number
    onNavigate?: (runId: string) => void
    isFullscreen: boolean
    onFullscreenChange: (fullscreen: boolean) => void
    hasTriggerPayload?: boolean
    isTriggerPayloadOpen?: boolean
    onToggleTriggerPayload?: () => void
}

export default function RunHistoryChatDrawerHeader({
    trigger,
    status,
    runs,
    currentRunIndex,
    onNavigate,
    isFullscreen,
    onFullscreenChange,
    hasTriggerPayload = false,
    isTriggerPayloadOpen = false,
    onToggleTriggerPayload
}: Props) {
    const canGoPrevious = runs && currentRunIndex !== undefined && currentRunIndex > 0
    const canGoNext = runs && currentRunIndex !== undefined && currentRunIndex < runs.length - 1

    const handlePrevious = () => {
        if (runs && currentRunIndex !== undefined && currentRunIndex > 0 && onNavigate) {
            onNavigate(runs[currentRunIndex - 1].id)
        }
    }

    const handleNext = () => {
        if (runs && currentRunIndex !== undefined && currentRunIndex < runs.length - 1 && onNavigate) {
            onNavigate(runs[currentRunIndex + 1].id)
        }
    }

    const toggleFullscreen = () => {
        onFullscreenChange(!isFullscreen)
    }

    return (
        <div className="shrink-0 px-4 py-4">
            <div className="flex w-full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="mt-0.5 h-5 w-5 flex-shrink-0">
                                <IconForIntegration integration={trigger.integration} />
                            </div>
                            <span className="text-base font-semibold leading-tight break-words" title={trigger.title || trigger.source}>
                                {trigger.title || trigger.source}
                            </span>
                            {trigger.url && (
                                <a href={trigger.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80 transition-opacity flex-shrink-0" title={trigger.url}>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                        {(trigger.subheader || hasTriggerPayload) && (
                            <div className="mt-1 flex items-center gap-1.5">
                                {trigger.subheader && <p className="min-w-0 text-sm leading-5 text-muted-foreground break-words">{trigger.subheader}</p>}
                                {hasTriggerPayload && onToggleTriggerPayload && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onToggleTriggerPayload}
                                        aria-expanded={isTriggerPayloadOpen}
                                        aria-label={isTriggerPayloadOpen ? "Collapse trigger payload" : "Expand trigger payload"}
                                        className="h-7 w-7 flex-shrink-0 p-0 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    >
                                        <ChevronDown className={cn("size-4 transition-transform", isTriggerPayloadOpen && "rotate-180")} />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-1.5 self-start">
                    <RunHistoryStatusBadge status={status} />
                    {runs && currentRunIndex !== undefined && (
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={!canGoPrevious} className="h-9 w-9 p-0 sm:h-8 sm:w-8" title="Previous run">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleNext} disabled={!canGoNext} className="h-9 w-9 p-0 sm:h-8 sm:w-8" title="Next run">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="h-9 w-9 p-0 sm:h-8 sm:w-8" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}

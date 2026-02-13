import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import { RunHistoryStatus, RunHistoryTrigger } from "@/shared/RunHistoryTypes"
import { RunHistoryRecord } from "@/shared/RunHistoryTypes"

import RunHistoryStatusBadge from "../RunHistoryStatusBadge"

type Props = {
    trigger: RunHistoryTrigger
    runNumber?: number
    status: RunHistoryStatus
    filtered: boolean
    runs?: RunHistoryRecord[]
    currentRunIndex?: number
    onNavigate?: (runId: string) => void
    isFullscreen: boolean
    onFullscreenChange: (fullscreen: boolean) => void
}

export default function RunHistoryChatDrawerHeader({ trigger, runNumber, status, filtered, runs, currentRunIndex, onNavigate, isFullscreen, onFullscreenChange }: Props) {
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
        <div className="shrink-0 p-4 pr-4 border-b">
            <div className="flex items-start gap-3 w-full">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-4 h-4 flex-shrink-0 mt-0.5">
                        <IconForIntegration integration={trigger.integration} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {runNumber !== undefined && <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">{runNumber}</span>}
                            <span className="text-base font-semibold truncate" title={trigger.title || trigger.source}>
                                {trigger.title || trigger.source}
                            </span>
                            {trigger.url && (
                                <a href={trigger.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80 transition-opacity flex-shrink-0" title={trigger.url}>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                        {trigger.subheader && <p className="mt-1 text-sm text-muted-foreground truncate">{trigger.subheader}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <RunHistoryStatusBadge status={status} filtered={filtered} />
                    {runs && currentRunIndex !== undefined && (
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={!canGoPrevious} className="h-8 w-8 p-0" title="Previous run">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleNext} disabled={!canGoNext} className="h-8 w-8 p-0" title="Next run">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="h-8 w-8 p-0" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}

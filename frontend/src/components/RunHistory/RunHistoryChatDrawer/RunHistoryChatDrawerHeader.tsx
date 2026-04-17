import { useState } from "react"

import { Braces, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, Maximize2, Minimize2, Terminal } from "lucide-react"
import { RunHistoryRecord, RunHistoryStatus, RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/pages/Agents/components/Integration"

import RunHistoryStatusBadge from "../RunHistoryStatusBadge"

type Props = {
    trigger: RunHistoryTrigger
    runId: string
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
    runId,
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
    const [isReplayCopied, setIsReplayCopied] = useState(false)

    const hasRunNavigation = runs !== undefined && currentRunIndex !== undefined
    const canGoPrevious = hasRunNavigation && currentRunIndex > 0
    const canGoNext = hasRunNavigation && currentRunIndex < runs.length - 1

    const handlePrevious = () => {
        if (canGoPrevious && onNavigate) onNavigate(runs[currentRunIndex - 1].id)
    }

    const handleNext = () => {
        if (canGoNext && onNavigate) onNavigate(runs[currentRunIndex + 1].id)
    }

    const handleCopyReplay = async () => {
        try {
            await navigator.clipboard.writeText(`terse replay ${runId}`)
            setIsReplayCopied(true)
            window.setTimeout(() => setIsReplayCopied(false), 2000)
        } catch {
            setIsReplayCopied(false)
        }
    }

    return (
        <div className="shrink-0 px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-5 flex-shrink-0">
                            <IconForIntegration integration={trigger.integration} />
                        </div>
                        <span className="min-w-0 truncate text-base font-semibold leading-tight" title={trigger.title || trigger.source}>
                            {trigger.title || trigger.source}
                        </span>
                        {trigger.url && (
                            <a href={trigger.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground" title={trigger.url}>
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}
                    </div>
                    {trigger.subheader && <p className="mt-1 text-sm leading-5 text-muted-foreground break-words">{trigger.subheader}</p>}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                    <RunHistoryStatusBadge status={status} />
                    {hasRunNavigation && (
                        <div className="ml-1 flex items-center rounded-md border border-border/60">
                            <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={!canGoPrevious} className="h-7 w-7 rounded-r-none p-0 hover:bg-muted/50" title="Previous run">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="h-4 w-px bg-border/60" />
                            <Button variant="ghost" size="sm" onClick={handleNext} disabled={!canGoNext} className="h-7 w-7 rounded-l-none p-0 hover:bg-muted/50" title="Next run">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onFullscreenChange(!isFullscreen)} className="h-7 w-7 p-0" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={handleCopyReplay}
                    className={cn(
                        "group inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                        isReplayCopied
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border/70 bg-muted/40 text-foreground hover:border-border hover:bg-muted"
                    )}
                    title={isReplayCopied ? "Copied to clipboard" : "Click to copy CLI replay command"}
                >
                    {isReplayCopied ? <Check className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />}
                    <span className="truncate">terse replay {runId}</span>
                    {!isReplayCopied && <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                </button>

                {hasTriggerPayload && onToggleTriggerPayload && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleTriggerPayload}
                        aria-expanded={isTriggerPayloadOpen}
                        className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                        <Braces className="h-3.5 w-3.5" />
                        {isTriggerPayloadOpen ? "Hide payload" : "View payload"}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isTriggerPayloadOpen && "rotate-180")} />
                    </Button>
                )}
            </div>
        </div>
    )
}

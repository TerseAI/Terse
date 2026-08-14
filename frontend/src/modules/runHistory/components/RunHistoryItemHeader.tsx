import { Copy, ExternalLink } from "lucide-react"
import type { RunHistoryRecord } from "terse-types"

import { IconForIntegration } from "@/modules/agents/components/Integration"
import { useOpenRunDeepLink } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

import RunTypeBadge from "./RunTypeBadge"
import TriggeredBy from "./TriggeredBy"

type Props = {
    run: RunHistoryRecord
    formattedTimestamp: string
    onCopy: (text: string) => void
}

export default function RunHistoryItemHeader({ run, formattedTimestamp, onCopy }: Props) {
    const openRun = useOpenRunDeepLink()
    const title = run.trigger.title || run.trigger.source

    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                <IconForIntegration integration={run.trigger.integration} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate" title={title}>
                        {title}
                    </span>
                    {run.trigger.url && (
                        <a
                            href={run.trigger.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            aria-label={`Open ${title} in a new tab`}
                            className="grid size-7 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    <button
                        className="grid size-7 flex-shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                        onClick={e => {
                            e.stopPropagation()
                            onCopy(title ?? "")
                        }}
                        type="button"
                        aria-label={`Copy ${title}`}
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    {run.trigger.subheader && (
                        <>
                            <span className="truncate" title={run.trigger.subheader}>
                                {run.trigger.subheader}
                            </span>
                            <span className="flex-shrink-0 text-muted-foreground/40">·</span>
                        </>
                    )}
                    <span className="flex-shrink-0">{formattedTimestamp}</span>
                    {(run.isTest || run.isManuallyTriggered || run.replayOfRunId) && (
                        <>
                            <span className="flex-shrink-0 text-muted-foreground/40">·</span>
                            <RunTypeBadge isTest={run.isTest} isManuallyTriggered={run.isManuallyTriggered} replayOfRunId={run.replayOfRunId} onOpenOriginal={openRun} />
                            {run.triggeredByUserId && <TriggeredBy userId={run.triggeredByUserId} showLabel={false} className="text-xs" />}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

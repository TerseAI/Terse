import { Copy, ExternalLink } from "lucide-react"
import type { RunHistoryRecord } from "terse-types"

import { IconForIntegration } from "@/modules/agents/components/Integration"

type Props = {
    run: RunHistoryRecord
    formattedTimestamp: string
    onCopy: (text: string) => void
}

export default function RunHistoryItemHeader({ run, formattedTimestamp, onCopy }: Props) {
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
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    <button
                        className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => {
                            e.stopPropagation()
                            onCopy(title ?? "")
                        }}
                        type="button"
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
                    {run.isManuallyTriggered && (
                        <>
                            <span className="flex-shrink-0 text-muted-foreground/40">·</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-success flex-shrink-0">Manual</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

import { Copy, ExternalLink } from "lucide-react"

import { IconForIntegration } from "../../../pages/Agents/components/Integration"
import type { RunHistoryRecord } from "../../../shared/RunHistoryTypes"

type Props = {
    run: RunHistoryRecord
    formattedTimestamp: string
    onCopy: (text: string) => void
}

export default function RunHistoryItemHeader({ run, formattedTimestamp, onCopy }: Props) {
    const title = run.trigger.title || run.trigger.source

    return (
        <div className="group min-w-0 no-underline hover:no-underline">
            <div className="flex items-start gap-3.5">
                <div className="text-muted-foreground size-5 flex-shrink-0 mt-0.5">
                    <IconForIntegration integration={run.trigger.integration} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground truncate no-underline hover:no-underline" title={title}>
                            {title}
                        </span>
                        {run.trigger.url && (
                            <a href={run.trigger.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-foreground flex-shrink-0">
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <button
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={e => {
                                e.stopPropagation()
                                onCopy(title ?? "")
                            }}
                            type="button"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 truncate text-muted-foreground no-underline hover:no-underline">
                        {run.trigger.subheader && (
                            <span className="truncate no-underline hover:no-underline" title={run.trigger.subheader}>
                                {run.trigger.subheader}
                            </span>
                        )}
                        <span className="shrink-0 no-underline hover:no-underline">{formattedTimestamp}</span>
                        {run.isManuallyTriggered && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-accent-tertiary flex-shrink-0">Manual</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

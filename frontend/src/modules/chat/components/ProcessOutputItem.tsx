import { useId, useRef, useState } from "react"

import { AlertTriangle, ChevronRight } from "lucide-react"
import { DEPRECATED_DURABLE_RUNTIME_OUTPUT_LABEL } from "terse-types"

import { cn } from "@/lib/utils"

export interface ProcessOutputEvent {
    id: string
    stream: "stdout" | "stderr"
    content: string
    label: string
    timestamp: number
}

interface ProcessOutputItemProps {
    events: ProcessOutputEvent[]
}

export default function ProcessOutputItem({ events }: ProcessOutputItemProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const detailsId = useId()

    if (events.length === 0) return null

    if (events.some(event => event.label === DEPRECATED_DURABLE_RUNTIME_OUTPUT_LABEL)) {
        return (
            <div role="alert" className="flex min-w-0 items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="font-medium">Deprecated Terse SDK detected</p>
                    <p className="mt-0.5 text-xs leading-5 text-foreground/75">
                        This run used the legacy durable runtime. Upgrade <code className="font-mono text-foreground">terse-sdk</code> and <code className="font-mono text-foreground">terse-cli</code>,
                        then run <code className="font-mono text-foreground">terse deploy</code>. Compatibility mode is temporary.
                    </p>
                </div>
            </div>
        )
    }

    // Key to preserve scroll position when collapsing/expanding the process output
    const updateExpandedState = (nextExpanded: boolean) => {
        const root = rootRef.current
        const scrollContainer = root?.closest('[data-chat-scroll-container="true"]') as HTMLDivElement | null
        const previousTop = root?.getBoundingClientRect().top ?? 0
        const previousScrollTop = scrollContainer?.scrollTop ?? 0

        setIsExpanded(nextExpanded)

        requestAnimationFrame(() => {
            if (!root || !scrollContainer) return

            const nextTop = root.getBoundingClientRect().top
            const delta = nextTop - previousTop
            scrollContainer.scrollTop = previousScrollTop + delta
        })
    }

    const hasStderr = events.some(event => event.stream === "stderr")
    const outputLabel = events[0]?.label || (hasStderr ? "Process output" : "Stdout")
    const lineCount = events.reduce((count, event) => {
        const content = event.content.endsWith("\n") ? event.content.slice(0, -1) : event.content
        return content ? count + content.split("\n").length : count
    }, 0)

    return (
        <div ref={rootRef} className="min-w-0">
            <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => updateExpandedState(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                className="-ml-1 flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-150", isExpanded && "rotate-90")} aria-hidden="true" />
                <span className="min-w-0 truncate font-medium text-foreground/80">{outputLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 tabular-nums">{lineCount === 1 ? "1 line" : `${lineCount} lines`}</span>
            </button>

            {isExpanded && (
                <pre
                    id={detailsId}
                    className="chat-scrollbar m-0 ml-1 mt-1 max-h-72 min-w-0 overflow-auto whitespace-pre-wrap break-words border-l border-border py-2 pl-4 pr-2 font-mono text-xs leading-5 text-foreground/75 [overflow-wrap:anywhere] select-text"
                >
                    {events.map(event => (
                        <span key={event.id}>{event.content}</span>
                    ))}
                </pre>
            )}
        </div>
    )
}

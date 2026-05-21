import { useEffect, useRef, useState } from "react"

import { ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
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

const VISIBLE_LINES = 4
const BLURRED_LINES = 2
const ADJ_FACTOR = 0.8 // Adjustment factor to account for spacing between lines

export default function ProcessOutputItem({ events }: ProcessOutputItemProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isCollapsible, setIsCollapsible] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLPreElement>(null)

    useEffect(() => {
        const element = contentRef.current
        if (!element) return

        const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
        const collapsedHeight = lineHeight * VISIBLE_LINES

        setIsCollapsible(element.scrollHeight > collapsedHeight + 1)
    }, [events])

    if (events.length === 0) return null

    const isCollapsed = isCollapsible && !isExpanded

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

    return (
        <div ref={rootRef}>
            <div className="text-sm font-medium text-muted-foreground">Stdout</div>
            <div
                className={cn("relative", isCollapsed && "cursor-pointer")}
                onClick={() => {
                    if (isCollapsed) updateExpandedState(true)
                }}
            >
                <pre
                    ref={contentRef}
                    className={cn(
                        "m-0 min-w-0 overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-foreground/10 px-3 py-2 font-satoshi text-sm leading-6 tracking-[0.015em] select-text transition-[max-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        !isExpanded && "max-h-[4lh]"
                    )}
                >
                    {events.map(event => (
                        <span key={event.id} className={cn(event.stream === "stderr" ? "text-danger" : "text-white")}>
                            {event.content}
                        </span>
                    ))}
                </pre>

                {isCollapsed && (
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent via-background/20 to-background/70 backdrop-blur-[2px]"
                        style={{ height: `${BLURRED_LINES * ADJ_FACTOR}lh` }}
                    />
                )}

                {isCollapsible && (
                    <div className="absolute right-1.5 top-1.5">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onMouseDown={event => event.preventDefault()}
                            onClick={event => {
                                event.stopPropagation()
                                updateExpandedState(!isExpanded)
                            }}
                            className="h-6 w-6 rounded-full p-0 shadow-sm"
                        >
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

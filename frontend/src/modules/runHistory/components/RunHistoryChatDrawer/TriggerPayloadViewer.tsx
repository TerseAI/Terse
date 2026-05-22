import { useState } from "react"

import { AlertTriangle, Check, Copy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import ToolCallParameters from "@/modules/chat/components/ToolCallParameters"

type Props = {
    event: string | null
    eventType?: string | null
    isTruncated?: boolean
    isOpen: boolean
}

export default function TriggerPayloadViewer({ event, eventType, isTruncated = false, isOpen }: Props) {
    const [isCopied, setIsCopied] = useState(false)

    if (!event || !isOpen) return null

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(event)
            setIsCopied(true)
            window.setTimeout(() => setIsCopied(false), 2000)
        } catch {
            setIsCopied(false)
        }
    }

    return (
        <div className="px-4 pb-2">
            <div className="space-y-2 border-t border-border/50 pt-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {eventType && (
                            <>
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Event Type</span>
                                <Badge variant="outline" className="font-mono text-[11px] tracking-wide text-muted-foreground">
                                    {eventType}
                                </Badge>
                            </>
                        )}
                        {isTruncated && (
                            <Badge variant="outline" className="gap-1 text-warning">
                                <AlertTriangle className="size-3" />
                                Truncated
                            </Badge>
                        )}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="h-8 px-2.5">
                        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        {isCopied ? "Copied" : isTruncated ? "Copy Preview" : "Copy JSON"}
                    </Button>
                </div>
                <div className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                    {isTruncated ? <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{event}</pre> : <ToolCallParameters parameters={event} />}
                </div>
            </div>
        </div>
    )
}

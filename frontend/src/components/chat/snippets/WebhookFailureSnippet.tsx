import { AlertCircle } from "lucide-react"
import type { ChatSnippet } from "terse-types"

import { formatServerCheckStep } from "@/lib/sdkJobServerCheck"

export type WebhookFailureSnippetData = Extract<ChatSnippet, { type: "webhook_failure" }>

export function WebhookFailureSnippet({ snippet }: { snippet: WebhookFailureSnippetData }) {
    const title = snippet.stage === "handshake" ? "Server Challenge Failed" : "Webhook Delivery Failed"
    const stepLabel = snippet.step ? formatServerCheckStep(snippet.step) : null

    return (
        <div className="rounded-lg border border-danger/30 bg-danger/5 select-text">
            <div className="flex items-start gap-2 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-foreground">{title}</span>
                        {snippet.httpStatus !== undefined && <span className="font-mono text-xs text-danger/80">HTTP {snippet.httpStatus}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{snippet.message}</p>
                </div>
            </div>

            <div className="space-y-1.5 border-t border-danger/15 px-3 py-2.5 text-xs">
                {stepLabel && (
                    <DetailRow label="Stage">
                        <span className="text-foreground">{stepLabel}</span>
                    </DetailRow>
                )}
                <DetailRow label="URL">
                    <span className="font-mono break-all text-foreground">{snippet.triggerUrl}</span>
                </DetailRow>
                {snippet.bodySnippet && (
                    <DetailRow label="Response">
                        <pre className="m-0 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-xs text-foreground">{snippet.bodySnippet}</pre>
                    </DetailRow>
                )}
            </div>
        </div>
    )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
            <span className="text-muted-foreground">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

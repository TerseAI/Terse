import { useState } from "react"

import { Check, Copy, Webhook } from "lucide-react"
import type { AgentTrigger } from "terse-types"

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="p-1.5 hover:bg-muted rounded transition-colors shrink-0">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
        </button>
    )
}

export function WebhookTriggerCard({ trigger }: { trigger: AgentTrigger }) {
    const webhookUrl = trigger.metadata?.webhookUrl

    const curlCommand = webhookUrl
        ? `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"hello": "world"}'`
        : null

    return (
        <div className="rounded-md border border-input p-3 space-y-3">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 shrink-0">
                    <Webhook className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium">Webhook</span>
            </div>

            {webhookUrl && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">URL</div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 bg-muted rounded text-xs break-all select-all">{webhookUrl}</code>
                            <CopyButton text={webhookUrl} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Example</div>
                        <div className="flex items-start gap-2">
                            <pre className="flex-1 p-3 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{curlCommand}</pre>
                            <CopyButton text={curlCommand!} />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">Send a POST request to this URL to trigger the agent. The request body will be available as the event payload.</p>
                </div>
            )}
        </div>
    )
}

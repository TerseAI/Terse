import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { type Key, useSWRConfig } from "swr"
import { IntegrationType } from "terse-types/Integrations"
import { integrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BackendProvider } from "@/lib/http"

interface DisconnectButtonProps {
    integrationType: IntegrationType
    // Short label identifying which connection is being removed (e.g. an email, workspace
    // name, or "your PostHog account"). Rendered inline in the confirmation copy.
    summary?: string
    // Extra SWR keys to revalidate after a successful disconnect. The shared
    // integrations list is always invalidated; pass per-integration list keys here.
    revalidateKeys?: Key[]
    size?: "sm" | "default"
    className?: string
}

const PROVIDER_LABELS: Partial<Record<IntegrationType, string>> = {
    [IntegrationType.SLACK]: "Slack",
    [IntegrationType.GMAIL]: "Gmail",
    [IntegrationType.NOTION]: "Notion",
    [IntegrationType.LINEAR]: "Linear",
    [IntegrationType.GITHUB]: "GitHub",
    [IntegrationType.POSTHOG]: "PostHog",
    [IntegrationType.LAUNCHDARKLY]: "LaunchDarkly",
    [IntegrationType.DATADOG]: "Datadog",
    [IntegrationType.WORKOS]: "WorkOS",
    [IntegrationType.ATTIO]: "Attio",
    [IntegrationType.SNOWFLAKE]: "Snowflake",
    [IntegrationType.HEY_REACH]: "HeyReach"
}

export function DisconnectButton({ integrationType, summary, revalidateKeys, size = "default", className }: DisconnectButtonProps) {
    const { mutate } = useSWRConfig()
    const [open, setOpen] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)

    const providerLabel = PROVIDER_LABELS[integrationType] ?? integrationType

    const handleDisconnect = async () => {
        setIsDisconnecting(true)
        try {
            await BackendProvider.disconnectIntegration(integrationType)
            const keys = [integrationsKey(), ...(revalidateKeys ?? [])]
            await Promise.all(keys.map(k => mutate(k)))
            toast.success(`${providerLabel} disconnected.`)
            setOpen(false)
        } catch {
            toast.error(`Failed to disconnect ${providerLabel}. Please try again.`)
        } finally {
            setIsDisconnecting(false)
        }
    }

    return (
        <>
            <Button variant="ghost" size={size} disabled={isDisconnecting} onClick={() => setOpen(true)} className={className ?? "text-danger/80 hover:text-danger hover:bg-danger/10"}>
                {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
            <Dialog open={open} onOpenChange={next => !isDisconnecting && setOpen(next)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disconnect {providerLabel}?</DialogTitle>
                        <DialogDescription>
                            Terse will lose access to {summary ? <span className="text-foreground font-medium">{summary}</span> : `your ${providerLabel} account`}, and any stored credentials or
                            tokens will be cleared.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="border-warning/40 bg-warning/5 text-foreground flex items-start gap-2.5 rounded-md border p-3 text-sm">
                        <AlertTriangle aria-hidden className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                        <p className="leading-relaxed">Any agents that use this integration may stop working until you reconnect.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isDisconnecting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                            {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

import { useState } from "react"

import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { type Key, useSWRConfig } from "swr"
import { IntegrationType } from "terse-types/Integrations"
import {
    apolloIntegrationsKey,
    attioIntegrationsKey,
    datadogIntegrationsKey,
    githubIntegrationsKey,
    gmailIntegrationsKey,
    googleSearchConsoleIntegrationsKey,
    heyReachIntegrationsKey,
    higgsfieldIntegrationsKey,
    integrationsKey,
    launchdarklyIntegrationsKey,
    linearIntegrationsKey,
    metaAdsIntegrationsKey,
    notionIntegrationsKey,
    posthogIntegrationsKey,
    resendIntegrationsKey,
    slackIntegrationsKey,
    snowflakeIntegrationsKey,
    workosIntegrationsKey
} from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BackendProvider } from "@/lib/http"

export function revalidateKeysForIntegration(integrationType: IntegrationType): Key[] {
    switch (integrationType) {
        case IntegrationType.SLACK:
            return [slackIntegrationsKey()]
        case IntegrationType.GMAIL:
            return [gmailIntegrationsKey()]
        case IntegrationType.GOOGLE_SEARCH_CONSOLE:
            return [googleSearchConsoleIntegrationsKey()]
        case IntegrationType.NOTION:
            return [notionIntegrationsKey()]
        case IntegrationType.LINEAR:
            return [linearIntegrationsKey()]
        case IntegrationType.GITHUB:
            return [githubIntegrationsKey()]
        case IntegrationType.POSTHOG:
            return [posthogIntegrationsKey()]
        case IntegrationType.DATADOG:
            return [datadogIntegrationsKey()]
        case IntegrationType.LAUNCHDARKLY:
            return [launchdarklyIntegrationsKey()]
        case IntegrationType.WORKOS:
            return [workosIntegrationsKey()]
        case IntegrationType.ATTIO:
            return [attioIntegrationsKey()]
        case IntegrationType.SNOWFLAKE:
            return [snowflakeIntegrationsKey()]
        case IntegrationType.HEY_REACH:
            return [heyReachIntegrationsKey()]
        case IntegrationType.RESEND:
            return [resendIntegrationsKey()]
        case IntegrationType.APOLLO:
            return [apolloIntegrationsKey()]
        case IntegrationType.META_ADS:
            return [metaAdsIntegrationsKey()]
        case IntegrationType.HIGGSFIELD:
            return [higgsfieldIntegrationsKey()]
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
        case IntegrationType.WEBHOOK:
        case IntegrationType.WEBMONITOR:
            return []
        default:
            throw integrationType satisfies never
    }
}

interface DisconnectButtonProps {
    integrationType: IntegrationType
    revalidateKeys?: Key[]
    size?: "sm" | "default"
    className?: string
}

export function DisconnectButton({ integrationType, revalidateKeys, size = "default", className }: DisconnectButtonProps) {
    const { mutate } = useSWRConfig()
    const [open, setOpen] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)

    const handleDisconnect = async () => {
        setIsDisconnecting(true)
        try {
            await BackendProvider.disconnectIntegration(integrationType)
            const keys = [integrationsKey(), ...(revalidateKeys ?? [])]
            await Promise.all(keys.map(k => mutate(k)))
            toast.success("Integration disconnected.")
            setOpen(false)
        } catch {
            toast.error("Failed to disconnect. Please try again.")
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
                        <DialogTitle>Disconnect this integration?</DialogTitle>
                        <DialogDescription>Terse will lose access, and any stored credentials or tokens will be cleared.</DialogDescription>
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

import { Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useSWRConfig } from "swr"
import { IntegrationType } from "terse-types/Integrations"
import { gmailIntegrationsKey, integrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useAgentMutations } from "@/modules/agents/api/useAgents"
import { useOAuthConnection } from "@/modules/auth/hooks/useOAuthConnection"
import { useGmailIntegrations } from "@/modules/integrations/api/useGmailIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function GmailIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.GMAIL>(IntegrationType.GMAIL, {}, stateToken)
    const { integrations, isLoading } = useGmailIntegrations()
    const { mutate } = useSWRConfig()
    const { invalidateAgentLists } = useAgentMutations()
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.email

    const handleDisconnect = async () => {
        setIsDisconnecting(true)
        try {
            await BackendProvider.disconnectIntegration(IntegrationType.GMAIL)
            await Promise.all([mutate(integrationsKey()), mutate(gmailIntegrationsKey()), invalidateAgentLists()])
            toast.success("Gmail disconnected. Agents that used it are blocked until you reconnect.")
            setConfirmOpen(false)
        } catch {
            toast.error("Failed to disconnect Gmail. Please try again.")
        } finally {
            setIsDisconnecting(false)
        }
    }

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.GMAIL} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.GMAIL} isActive={isActive} />
            <CardContent>
                <GmailCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} showDisconnect={isConnected} onDisconnect={() => setConfirmOpen(true)} isDisconnecting={isDisconnecting} />
            <Dialog open={confirmOpen} onOpenChange={open => !isDisconnecting && setConfirmOpen(open)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disconnect Gmail?</DialogTitle>
                        <DialogDescription>
                            Terse will lose access to <span className="text-foreground font-medium">{summary}</span> at Google. Agents that read from or write to this account will be blocked until
                            you reconnect.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isDisconnecting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                            {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function GmailCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; email: string }>; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Mail className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No Gmail integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Gmail account to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Mail className="w-4 h-4" />} title={integration.email} description="Gmail account" />
            ))}
        </div>
    )
}

export default GmailIntegrationCard

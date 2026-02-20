import { useState } from "react"

import { Hash, MessageSquare, Trash2 } from "lucide-react"
import type { KeyedMutator } from "swr"

import { useSlackChannels } from "@/hooks/api/useSlackChannels"
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { IntegrationType, SlackIntegration } from "@/shared/Integrations"

import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { CountDisplay } from "./helpers/CountDisplay"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"
import { SlackConnectionOptions } from "./helpers/SlackConnectionOptions"

function SlackIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const { integrations, isLoading: integrationsLoading, mutate } = useSlackIntegrations()
    const handleConnectClick = () => {
        setShowConnectionOptions(true)
    }

    const handleBack = () => {
        setShowConnectionOptions(false)
    }

    const connect = async () => {
        setIsConnecting(true)
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(IntegrationType.SLACK, { isBotUser }, stateToken)

            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, "oauth-popup", "width=600,height=700")
                // Return to previous page after opening OAuth popup
                setShowConnectionOptions(false)
            } else {
                console.error("OAuth URL not available for this integration type")
            }
        } catch (error) {
            console.error("Error initiating OAuth:", error)
        } finally {
            setIsConnecting(false)
        }
    }

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.teamName

    if (compact) {
        if (showConnectionOptions) {
            return (
                <div className={cn("p-3 rounded-lg border border-border bg-card/50", className)}>
                    <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={handleBack} onConnect={connect} isConnecting={isConnecting} />
                </div>
            )
        }
        return <CompactIntegrationRow integration={IntegrationType.SLACK} isConnected={isConnected} summary={summary} connect={handleConnectClick} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.SLACK} isActive={isActive} />
            <CardContent>
                {showConnectionOptions ? (
                    <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={handleBack} onConnect={connect} isConnecting={isConnecting} />
                ) : (
                    <SlackCardContent integrations={integrations} isLoading={integrationsLoading} mutate={mutate} />
                )}
            </CardContent>
            {!showConnectionOptions && <IntegrationCardFooter connect={handleConnectClick} isConnecting={isConnecting} buttonText="Connect Another Slack" />}
        </Card>
    )
}

function SlackCardContent({ integrations, isLoading, mutate }: { integrations: SlackIntegration[]; isLoading: boolean; mutate: KeyedMutator<SlackIntegration[]> }) {
    if (isLoading && integrations.length === 0) {
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
                <MessageSquare className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Slack integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Slack workspace to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <SlackIntegrationItem integration={integration} key={integration.id} mutate={mutate} />
            ))}
        </div>
    )
}

function SlackIntegrationItem({ integration, mutate }: { integration: SlackIntegration; mutate: KeyedMutator<SlackIntegration[]> }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const { channels, isLoading: channelsLoading } = useSlackChannels(integration.id)
    const channelCount = channels.length
    const availableChannels = channels.filter(ch => !ch.isArchived).length

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await BackendProvider.deleteIntegration(IntegrationType.SLACK, integration.id)
            mutate()
            setShowDeleteDialog(false)
        } catch (error) {
            console.error("Failed to delete Slack integration:", error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <IntegrationItem
                    key={integration.id}
                    icon={<MessageSquare className="w-4 h-4" />}
                    title={`${integration.teamName || "Unknown Workspace"}${integration.isBotUser === false ? " - User" : " - Bot"}`}
                    description={
                        <span className="flex items-center gap-2">
                            <Hash className="size-3" />
                            <ChannelsCount channelCount={availableChannels} totalChannels={channelCount} isLoading={channelsLoading} />
                        </span>
                    }
                    className="flex-1"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting} title="Remove connection">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Remove Slack Connection</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove the connection to <span className="font-medium">{integration.teamName || "Unknown Workspace"}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Removing..." : "Remove"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function ChannelsCount({ channelCount, totalChannels, isLoading }: { channelCount: number; totalChannels: number; isLoading: boolean }) {
    const additionalInfo = totalChannels > channelCount ? `(${totalChannels - channelCount} archived)` : undefined

    return <CountDisplay count={channelCount} singular="channel available" plural="channels available" isLoading={isLoading} skeletonWidth="w-[100px]" additionalInfo={additionalInfo} />
}

export default SlackIntegrationCard

import { Target } from "lucide-react"
import type { KeyedMutator } from "swr"

import { useLinearIntegrations } from "@/hooks/api/useLinearIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { IntegrationType, LinearIntegration } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function LinearIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useLinearIntegrations()
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.LINEAR>(IntegrationType.LINEAR, {}, stateToken)

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.workspaceName

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.LINEAR} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.LINEAR} isActive={isActive} />
            <CardContent>
                <LinearCardContent integrations={integrations} isLoading={isLoading} mutate={mutate} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function LinearCardContent({ integrations, isLoading, mutate }: { integrations: LinearIntegration[]; isLoading: boolean; mutate: KeyedMutator<LinearIntegration[]> }) {
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
                <Target className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Linear integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Linear workspace to get started</p>
            </div>
        )
    }

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.LINEAR, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Target className="w-4 h-4" />}
                    title={integration.workspaceName || "Unknown Workspace"}
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove Linear Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the connection to ${integration.workspaceName || "Unknown Workspace"}? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

export default LinearIntegrationCard

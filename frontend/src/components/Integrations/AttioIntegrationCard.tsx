import { Users } from "lucide-react"
import type { KeyedMutator } from "swr"

import { useAttioIntegrations } from "@/hooks/api/useAttioIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { AttioIntegration, IntegrationType } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function AttioIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.ATTIO>(IntegrationType.ATTIO, {}, stateToken)
    const { integrations, isLoading: integrationsLoading, mutate } = useAttioIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.workspaceName

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.ATTIO} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.ATTIO} isActive={isActive} />
            <CardContent>
                <AttioCardContent integrations={integrations} isLoading={integrationsLoading} mutate={mutate} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function AttioCardContent({ integrations, isLoading, mutate }: { integrations: AttioIntegration[]; isLoading: boolean; mutate: KeyedMutator<AttioIntegration[]> }) {
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
                <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Attio integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Attio workspace to get started</p>
            </div>
        )
    }

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.ATTIO, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Users className="w-4 h-4" />}
                    title={integration.workspaceName || "Unknown Workspace"}
                    description={<span className="text-xs text-muted-foreground">Add and update contacts in Attio</span>}
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove Attio Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the connection to ${integration.workspaceName || "Unknown Workspace"}? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

export default AttioIntegrationCard

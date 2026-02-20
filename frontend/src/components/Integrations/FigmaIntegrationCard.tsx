import { Palette } from "lucide-react"
import type { KeyedMutator } from "swr"

import { useFigmaIntegrations } from "@/hooks/api/useFigmaIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { FigmaIntegration, IntegrationType } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function FigmaIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.FIGMA>(IntegrationType.FIGMA, {}, stateToken)
    const { integrations, isLoading, mutate } = useFigmaIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.handle || integrations[0]?.figma_user_id

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.FIGMA} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.FIGMA} isActive={isActive} />
            <CardContent>
                <FigmaCardContent integrations={integrations} isLoading={isLoading} mutate={mutate} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function FigmaCardContent({ integrations, isLoading, mutate }: { integrations: FigmaIntegration[]; isLoading: boolean; mutate: KeyedMutator<FigmaIntegration[]> }) {
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
                <Palette className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Figma integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Figma account to get started</p>
            </div>
        )
    }

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.FIGMA, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Palette className="w-4 h-4" />}
                    title={integration.handle || integration.figma_user_id}
                    description="Figma account"
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove Figma Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the connection to ${integration.handle || integration.figma_user_id}? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

export default FigmaIntegrationCard

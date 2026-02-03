import { Palette } from "lucide-react"

import { useFigmaIntegrations } from "@/hooks/api/useFigmaIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { FigmaIntegration, IntegrationType } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function FigmaIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.FIGMA>(IntegrationType.FIGMA, {}, stateToken)
    const { integrations, isLoading } = useFigmaIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.handle || integrations[0]?.figma_user_id

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.FIGMA} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.FIGMA} isActive={isActive} />
            <CardContent>
                <FigmaCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function FigmaCardContent({ integrations, isLoading }: { integrations: Array<FigmaIntegration>; isLoading: boolean }) {
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

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Palette className="w-4 h-4" />} title={integration.handle || integration.figma_user_id} description="Figma account" />
            ))}
        </div>
    )
}

export default FigmaIntegrationCard

import { Target } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"
import { linearIntegrationsKey } from "terse-types/InvalidationKeys"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOAuthConnection } from "@/modules/auth/hooks/useOAuthConnection"
import { useLinearIntegrations } from "@/modules/integrations/api/useLinearIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function LinearIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading } = useLinearIntegrations()
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
                <LinearCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter
                connect={connect}
                isConnecting={isConnecting}
                disconnect={isConnected ? { integrationType: IntegrationType.LINEAR, revalidateKeys: [linearIntegrationsKey()] } : undefined}
            />
        </Card>
    )
}

function LinearCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; workspaceName?: string; linearTeamName?: string }>; isLoading: boolean }) {
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
                <Target className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No Linear integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Linear workspace to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Target className="w-4 h-4" />} title={integration.workspaceName || "Unknown Workspace"} />
            ))}
        </div>
    )
}

export default LinearIntegrationCard

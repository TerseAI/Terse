import { Megaphone } from "lucide-react"
import { IntegrationType, MetaAdsIntegration } from "terse-types/Integrations"
import { metaAdsIntegrationsKey } from "terse-types/InvalidationKeys"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOAuthConnection } from "@/modules/auth/hooks/useOAuthConnection"
import { useMetaAdsIntegrations } from "@/modules/integrations/api/useMetaAdsIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function MetaAdsIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.META_ADS>(IntegrationType.META_ADS, {}, stateToken)
    const { integrations, isLoading: integrationsLoading } = useMetaAdsIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.accountName

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.META_ADS} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.META_ADS} isActive={isActive} />
            <CardContent>
                <MetaAdsCardContent integrations={integrations} isLoading={integrationsLoading} />
            </CardContent>
            <IntegrationCardFooter
                connect={connect}
                isConnecting={isConnecting}
                disconnect={isConnected ? { integrationType: IntegrationType.META_ADS, revalidateKeys: [metaAdsIntegrationsKey()] } : undefined}
            />
        </Card>
    )
}

function MetaAdsCardContent({ integrations, isLoading }: { integrations: MetaAdsIntegration[]; isLoading: boolean }) {
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
                <Megaphone className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No Meta Ads integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Meta ad account</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Megaphone className="w-4 h-4" />} title={integration.accountName || "Meta account"} />
            ))}
        </div>
    )
}

export default MetaAdsIntegrationCard

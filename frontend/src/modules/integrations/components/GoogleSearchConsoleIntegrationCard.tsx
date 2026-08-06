import { Search } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"
import { googleSearchConsoleIntegrationsKey } from "terse-types/InvalidationKeys"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOAuthConnection } from "@/modules/auth/hooks/useOAuthConnection"
import { useGoogleSearchConsoleIntegrations } from "@/modules/integrations/api/useGoogleSearchConsoleIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function GoogleSearchConsoleIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.GOOGLE_SEARCH_CONSOLE>(IntegrationType.GOOGLE_SEARCH_CONSOLE, {}, stateToken)
    const { integrations, isLoading } = useGoogleSearchConsoleIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.email

    if (compact) {
        return (
            <CompactIntegrationRow
                integration={IntegrationType.GOOGLE_SEARCH_CONSOLE}
                isConnected={isConnected}
                summary={summary}
                connect={connect}
                isConnecting={isConnecting}
                className={className}
            />
        )
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.GOOGLE_SEARCH_CONSOLE} isActive={isActive} />
            <CardContent>
                <GoogleSearchConsoleCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter
                connect={connect}
                isConnecting={isConnecting}
                disconnect={isConnected ? { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, revalidateKeys: [googleSearchConsoleIntegrationsKey()] } : undefined}
            />
        </Card>
    )
}

function GoogleSearchConsoleCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; email: string }>; isLoading: boolean }) {
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
                <Search className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No Google Search Console accounts connected</p>
                <p className="text-xs text-muted-foreground mt-1">Connect the Google account that owns your Search Console properties</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Search className="w-4 h-4" />} title={integration.email} />
            ))}
        </div>
    )
}

export default GoogleSearchConsoleIntegrationCard

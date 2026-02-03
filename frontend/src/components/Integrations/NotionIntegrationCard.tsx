import { BookOpen } from "lucide-react"

import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { IntegrationType } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function NotionIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.NOTION>(IntegrationType.NOTION, {}, stateToken)
    const { integrations, isLoading: integrationsLoading } = useNotionIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.workspaceName

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.NOTION} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.NOTION} isActive={isActive} />
            <CardContent>
                <NotionCardContent integrations={integrations} isLoading={integrationsLoading} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function NotionCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; workspaceName?: string }>; isLoading: boolean }) {
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
                <BookOpen className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Notion integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Notion workspace to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<BookOpen className="w-4 h-4" />}
                    title={integration.workspaceName || "Unknown Workspace"}
                    description={<span className="text-xs text-muted-foreground">Search to find pages and databases</span>}
                />
            ))}
        </div>
    )
}

export default NotionIntegrationCard

import { BookOpen } from "lucide-react"
import type { KeyedMutator } from "swr"

import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { IntegrationType, NotionIntegration } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function NotionIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.NOTION>(IntegrationType.NOTION, {}, stateToken)
    const { integrations, isLoading: integrationsLoading, mutate } = useNotionIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.workspaceName

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.NOTION} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.NOTION} isActive={isActive} />
            <CardContent>
                <NotionCardContent integrations={integrations} isLoading={integrationsLoading} mutate={mutate} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function NotionCardContent({ integrations, isLoading, mutate }: { integrations: NotionIntegration[]; isLoading: boolean; mutate: KeyedMutator<NotionIntegration[]> }) {
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

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.NOTION, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<BookOpen className="w-4 h-4" />}
                    title={integration.workspaceName || "Unknown Workspace"}
                    description={<span className="text-xs text-muted-foreground">Search to find pages and databases</span>}
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove Notion Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the connection to ${integration.workspaceName || "Unknown Workspace"}? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

export default NotionIntegrationCard

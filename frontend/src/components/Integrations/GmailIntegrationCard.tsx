import { Mail } from "lucide-react"

import { useGmailIntegrations } from "@/hooks/api/useGmailIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { cn } from "@/lib/utils"
import { IntegrationType } from "@/shared/Integrations"

import { Card, CardContent } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function GmailIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.GMAIL>(IntegrationType.GMAIL, {}, stateToken)
    const { integrations, isLoading } = useGmailIntegrations()

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.email

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.GMAIL} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.GMAIL} isActive={isActive} />
            <CardContent>
                <GmailCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function GmailCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; email: string }>; isLoading: boolean }) {
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
                <Mail className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Gmail integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Gmail account to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem key={integration.id} icon={<Mail className="w-4 h-4" />} title={integration.email} description="Gmail account" />
            ))}
        </div>
    )
}

export default GmailIntegrationCard

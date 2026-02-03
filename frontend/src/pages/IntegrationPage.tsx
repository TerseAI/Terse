import { FileText } from "lucide-react"

import IntegrationCard, { IntegrationCardSkeleton } from "@/components/Integrations/IntegrationCard"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Empty } from "@/components/ui/empty"
import { useIntegrations } from "@/hooks/api/useIntegrations"
import { IntegrationType } from "@/shared/Integrations"

function IntegrationPage() {
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations()

    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
            <div className="flex flex-row flex-wrap gap-12 mb-12">
                {isLoading || hasActive ? <IntegrationContent integrations={activeIntegrations ?? []} isLoading={isLoading} /> : <NoIntegrations />}
            </div>

            {hasInactive && (
                <>
                    <h1 className="text-xl font-bold text-foreground mb-10">Inactive Integrations</h1>
                    <div className="flex flex-row flex-wrap gap-12">
                        <IntegrationContent integrations={inactiveIntegrations ?? []} isLoading={isLoading} isActive={false} />
                    </div>
                </>
            )}
        </div>
    )
}

function IntegrationContent({ integrations, isLoading, isActive = true }: { integrations: IntegrationType[]; isLoading: boolean; isActive?: boolean }) {
    if (isLoading || !integrations) {
        return (
            <>
                {Array.from({ length: 3 }).map((_, index) => (
                    <IntegrationCardSkeleton key={index} />
                ))}
            </>
        )
    }

    return (
        <>
            {integrations.map(integration => (
                <IntegrationCard key={integration} integration={integration} isActive={isActive} />
            ))}
        </>
    )
}

function NoIntegrations() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No integrations found</EmptyTitle>
                <EmptyDescription>Integrations will appear here as you connect them with Automations.</EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

export default IntegrationPage

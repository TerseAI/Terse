import { IntegrationType } from "@/shared/Integrations"
import { useIntegrations } from "@/hooks/api/useIntegrations";
import IntegrationCard, { IntegrationCardSkeleton } from "@/components/Integrations/IntegrationCard";
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText } from "lucide-react";
import { Empty } from "@/components/ui/empty";

function IntegrationPage() {
    const { integrations, isLoading } = useIntegrations();
    console.log("integrations", JSON.stringify(integrations, null, 2));
    
    if (!isLoading && integrations && integrations.length === 0 || (integrations == null)) {
        return (
            <div className="flex flex-col h-full p-4">
                <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
                <div className="flex flex-row flex-wrap gap-12">
                    <NoIntegrations />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
            <div className="flex flex-row flex-wrap gap-12">
                <IntegrationContent integrations={integrations} isLoading={isLoading} />
            </div>
        </div>
    )
}

function IntegrationContent({ integrations, isLoading }: { integrations: IntegrationType[], isLoading: boolean }) {
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
            {integrations.map((integration) => (
                <IntegrationCard key={integration} integration={integration} />
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
                <EmptyDescription>
                    Integrations will appear here as you connect them with Automations.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

export default IntegrationPage;
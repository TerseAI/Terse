import { useIntegrations, IntegrationMetadata, Integration } from "@/context/Integrations";
import IntegrationCard, { IntegrationCardSkeleton } from "@/components/Integrations/IntegrationCard";
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileText } from "lucide-react";
import { Empty } from "@/components/ui/empty";
import { BackendProvider } from "@/services/backend";
import { useEffect, useState } from "react";
import { IntegrationsStatus } from "@/shared/types";

function IntegrationPage() {
    const { integrations, isLoading } = useIntegrations();
    const [integrationStatus, setIntegrationStatus] = useState<IntegrationsStatus | null>(null);

    useEffect(() => {
        const fetchIntegrations = async () => {
            const response = await BackendProvider.getIntegrationsStatus();
            setIntegrationStatus(response);
        };
        fetchIntegrations();
    }, []);

    const filteredIntegrations = removeDuplicateNotionIntegrations(integrations);


    if (!isLoading && filteredIntegrations.length === 0) {
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
                <IntegrationContent integrations={filteredIntegrations} integrationStatus={integrationStatus} isLoading={isLoading} />
            </div>
        </div>
    )
}

function IntegrationContent({ integrations, integrationStatus, isLoading }: { integrations: IntegrationMetadata[], integrationStatus: IntegrationsStatus | null, isLoading: boolean }) {
    if (isLoading || !integrationStatus) {
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
                <IntegrationCard key={integration.type} integration={integration.type} integrationId={integration.integrationId} integrationStatus={integrationStatus} />
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


// Function that checks if there is both Notion + Notion Page integrations. and Removes one of them
function removeDuplicateNotionIntegrations(integrations: IntegrationMetadata[]) {
    const notionIntegrations = integrations.filter(integration => integration.type === Integration.NOTION);
    const notionPageIntegrations = integrations.filter(integration => integration.type === Integration.NOTION_PAGE);
    if (notionIntegrations.length > 0 && notionPageIntegrations.length > 0) {
        return integrations.filter(integration => integration.type !== Integration.NOTION_PAGE);
    }
    return integrations;
}

export default IntegrationPage;
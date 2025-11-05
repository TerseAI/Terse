import { useIntegrations, IntegrationProvider, IntegrationMetadata, Integration } from "@/context/Integrations";
import IntegrationCard from "@/components/Integrations/IntegrationCard";

function IntegrationPage() {
    const { integrations } = useIntegrations();

    const filteredIntegrations = removeDuplicateNotionIntegrations(integrations);
    return (
        <IntegrationProvider>
            <div className="flex flex-col h-full p-4">
                <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
                <div className="flex flex-row flex-wrap">
                    {filteredIntegrations.map((integration) => (
                        <IntegrationCard key={integration.type} integration={integration.type} integrationId={integration.integrationId} />
                    ))}
                </div>
            </div>
        </IntegrationProvider>
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
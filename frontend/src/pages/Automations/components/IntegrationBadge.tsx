import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Integration } from "../../../context/Integrations";
import { formatIntegrationDisplay, IntegrationInstance } from "../../../utility/IntegrationFormatters";
import { getIntegrationInstances } from "../../../utility/IntegrationUtils";
import { BackendProvider } from "../../../services/backend";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { NotionDatabase, NotionDatabasesResponse, NotionIntegration } from "@/shared/types";

interface IntegrationBadgeProps {
    integrationId?: string;
    integrationType: Integration;
}

export function IntegrationBadge({ integrationId, integrationType }: IntegrationBadgeProps) {
    const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchIntegrations = async () => {
            setIsLoading(true);
            try {
                const response = await BackendProvider.getIntegrationsStatus();
                const instances = getIntegrationInstances(response.integrations, integrationType);
                setIntegrations(instances);
            } catch (error) {
                console.error('Error fetching integrations:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchIntegrations();
    }, [integrationType]);

    if (isLoading) {
        return <Spinner />;
    }

    const integration = integrations.find(i => i.id === integrationId);

    // Special handling for Notion - two badges vertically stacked
    if (integrationType === Integration.NOTION && integration) {
        return (
            <NotionIntegrationBadge integration={integration} />
        );
    }

    // Default behavior for other integrations
    const displayText = integration ? formatIntegrationDisplay(integration, integrationType) : 'Loading...';

    return (
        <Badge variant="secondary">
            <Check className="size-3" />
            {displayText}
        </Badge>
    );
}

function NotionIntegrationBadge({ integration }: { integration: IntegrationInstance }) {
    const workspaceName = integration.workspaceName || integration.workspaceId || 'Unknown Workspace';
    const databaseName = integration.databaseName || 'Unknown Database';

    return (
        <div className="flex flex-col gap-1">
                <Badge variant="secondary">
                    <Check className="size-3" />
                    {workspaceName}
                </Badge>
                <Badge variant="secondary">
                    <Check className="size-3" />
                    {databaseName}
                </Badge>
            </div>
    );
}
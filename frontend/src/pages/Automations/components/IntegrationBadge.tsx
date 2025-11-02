import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Integration } from "../../../context/Integrations";
import { formatIntegrationDisplay, IntegrationInstance } from "../../../utility/IntegrationFormatters";
import { getIntegrationInstances } from "../../../utility/IntegrationUtils";
import { BackendProvider } from "../../../services/backend";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

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
    const displayText = integration ? formatIntegrationDisplay(integration, integrationType) : 'Loading...';

    return (
        <Badge variant="secondary">
            <Check className="size-3" />
            {displayText}
        </Badge>
    );
}


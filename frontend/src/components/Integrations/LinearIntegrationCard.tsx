import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { cn } from "@/lib/utils";

function LinearIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const linearInstances = getIntegrationInstances(integrationStatus.integrations, IntegrationType.LINEAR);
    const currentInstance = linearInstances.find(instance => instance.id === integrationId) || linearInstances[0];
    const workspaceInfo = formatIntegrationDisplay(currentInstance, IntegrationType.LINEAR);

    // Linear uses API key, not OAuth, so no OAuth URL available
    const oauthUrl = null;

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.LINEAR} />
            <CardContent>
                <LinearCardContent workspaceInfo={workspaceInfo} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function LinearCardContent({ workspaceInfo }: { workspaceInfo: string | null }) {
    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground min-w-50">
            <span>{workspaceInfo || 'Unknown Workspace'}</span>
        </div>
    )
}

export default LinearIntegrationCard;


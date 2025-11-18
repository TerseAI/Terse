import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/types"
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";

function FigmaIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const figmaInstances = getIntegrationInstances(integrationStatus.integrations, IntegrationType.FIGMA);
    const currentInstance = figmaInstances.find(instance => instance.id === integrationId) || figmaInstances[0];
    const accountInfo = formatIntegrationDisplay(currentInstance, IntegrationType.FIGMA);
    const oauthUrl = useOAuthUrl(IntegrationType.FIGMA);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.FIGMA} />
            <CardContent>
                <FigmaCardContent accountInfo={accountInfo} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function FigmaCardContent({ accountInfo }: { accountInfo: string | null }) {
    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground min-w-50">
            <span>User ID: {accountInfo || 'Unknown Account'}</span>
        </div>
    )
}

export default FigmaIntegrationCard;


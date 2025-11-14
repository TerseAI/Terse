import { Card, CardContent } from "../ui/card";
import { Integration } from "@/types/Integration";
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";

function FigmaIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const figmaInstances = getIntegrationInstances(integrationStatus.integrations, Integration.FIGMA);
    const currentInstance = figmaInstances.find(instance => instance.id === integrationId) || figmaInstances[0];
    const accountInfo = formatIntegrationDisplay(currentInstance, Integration.FIGMA);
    const oauthUrl = useOAuthUrl(Integration.FIGMA);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={Integration.FIGMA} />
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


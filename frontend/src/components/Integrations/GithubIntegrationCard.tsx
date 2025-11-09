import { Card, CardContent } from "../ui/card";
import { Integration } from "@/context/Integrations";
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";

function GithubIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const oauthUrl = useOAuthUrl(Integration.GITHUB);
    const githubInstances = getIntegrationInstances(integrationStatus.integrations, Integration.GITHUB);
    const currentInstance = githubInstances.find(instance => instance.id === integrationId) || githubInstances[0];
    const repositoryInfo = formatIntegrationDisplay(currentInstance, Integration.GITHUB);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={Integration.GITHUB} />
            <CardContent>
                <GithubCardContent repositoryInfo={repositoryInfo} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function GithubCardContent({ repositoryInfo }: { repositoryInfo: string | null }) {
    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground min-w-50">
            <span>{repositoryInfo || 'Unknown Repository'}</span>
        </div>
    )
}

export default GithubIntegrationCard;


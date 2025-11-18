import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";
import { useAtlassianIntegrations } from "@/hooks/api/useAtlassianIntegrations";
import { Skeleton } from "../ui/skeleton";
import { Globe, Mail } from "lucide-react";

function AtlassianIntegrationCard({ className }: { className?: string }) {
    const oauthUrl = useOAuthUrl(IntegrationType.ATLASSIAN);
    const { integrations, isLoading } = useAtlassianIntegrations(); 

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.ATLASSIAN} />
            <CardContent>
                <AtlassianCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function AtlassianCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; email: string; baseUrl: string }>, isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Globe className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Atlassian integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Atlassian account to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <div
                    key={integration.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                            {integration.baseUrl}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{integration.email}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AtlassianIntegrationCard;


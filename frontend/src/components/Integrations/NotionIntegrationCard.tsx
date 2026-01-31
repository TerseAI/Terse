import { BookOpen } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

function NotionIntegrationCard({ className, isActive = true, stateToken }: { className?: string; isActive?: boolean; stateToken?: string }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.NOTION>(IntegrationType.NOTION, {}, stateToken);
    const { integrations, isLoading: integrationsLoading } = useNotionIntegrations();

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.NOTION} isActive={isActive} />
            <CardContent>
                <NotionCardContent 
                    integrations={integrations} 
                    isLoading={integrationsLoading} 
                />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function NotionCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; workspaceName?: string }>, isLoading: boolean }) {
    if (isLoading && integrations.length === 0) {
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
                <BookOpen className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Notion integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Notion workspace to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <IntegrationItem
                    key={integration.id}
                    icon={<BookOpen className="w-4 h-4" />}
                    title={integration.workspaceName || 'Unknown Workspace'}
                    description={
                        <span className="text-xs text-muted-foreground">
                            Search to find pages and databases
                        </span>
                    }
                />
            ))}
        </div>
    );
}

export default NotionIntegrationCard;

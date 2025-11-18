import { FileText, Database, BookOpen } from "lucide-react";
import { NotionResource } from "@/shared/types";
import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { CountDisplay } from "./helpers/CountDisplay";
import { useNotionResources } from "@/hooks/api/useNotionResources";
import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

function NotionIntegrationCard({ className }: { className?: string }) {
    const oauthUrl = useOAuthUrl(IntegrationType.NOTION);
    const { integrations, isLoading: integrationsLoading } = useNotionIntegrations();
    const firstIntegrationId = integrations[0]?.id;
    const { resources, isLoading: resourcesLoading } = useNotionResources(firstIntegrationId || null);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.NOTION} />
            <CardContent>
                <NotionCardContent 
                    integrations={integrations} 
                    resources={resources} 
                    isLoading={integrationsLoading || resourcesLoading} 
                />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function NotionCardContent({ integrations, resources, isLoading }: { integrations: Array<{ id: string; workspaceName?: string }>, resources: NotionResource[], isLoading: boolean }) {
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

    const numberOfPages = resources.filter(resource => resource.type === 'page').length;
    const numberOfDatabases = resources.filter(resource => resource.type === 'database').length;

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <div
                    key={integration.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                            {integration.workspaceName || 'Unknown Workspace'}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                            <div className="flex items-center gap-1">
                                <FileText className="size-3" />
                                <PagesCount numberOfPages={numberOfPages} isLoading={isLoading} />
                            </div>
                            <div className="flex items-center gap-1">
                                <Database className="size-3" />
                                <DatabaseCount numberOfDatabases={numberOfDatabases} isLoading={isLoading} />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function DatabaseCount({ numberOfDatabases, isLoading }: { numberOfDatabases: number, isLoading: boolean }) {
    return (
        <CountDisplay 
            count={numberOfDatabases} 
            singular="database" 
            isLoading={isLoading} 
        />
    )
}

function PagesCount({ numberOfPages, isLoading }: { numberOfPages: number, isLoading: boolean }) {
    return (
        <CountDisplay 
            count={numberOfPages} 
            singular="page" 
            isLoading={isLoading} 
        />
    )
}



export default NotionIntegrationCard;
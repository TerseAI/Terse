import { FileText, Database, BookOpen } from "lucide-react";
import { NotionResource } from "@/shared/types";
import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { CountDisplay } from "./helpers/CountDisplay";
import { useNotionResources } from "@/hooks/api/useNotionResources";
import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

function NotionIntegrationCard({ className, isActive = true }: { className?: string; isActive?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection(IntegrationType.NOTION);
    const { integrations, isLoading: integrationsLoading } = useNotionIntegrations();
    const firstIntegrationId = integrations[0]?.id;
    const { resources, isLoading: resourcesLoading } = useNotionResources(firstIntegrationId || null);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.NOTION} isActive={isActive} />
            <CardContent>
                <NotionCardContent 
                    integrations={integrations} 
                    resources={resources} 
                    isLoading={integrationsLoading || resourcesLoading} 
                />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
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
                <IntegrationItem
                    key={integration.id}
                    icon={<BookOpen className="w-4 h-4" />}
                    title={integration.workspaceName || 'Unknown Workspace'}
                    description={
                        <span className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <FileText className="size-3" />
                                <PagesCount numberOfPages={numberOfPages} isLoading={isLoading} />
                            </span>
                            <span className="flex items-center gap-1">
                                <Database className="size-3" />
                                <DatabaseCount numberOfDatabases={numberOfDatabases} isLoading={isLoading} />
                            </span>
                        </span>
                    }
                />
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
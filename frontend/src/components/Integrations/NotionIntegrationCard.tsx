import { BackendProvider } from "@/services/backend";
import { FileText, Database } from "lucide-react";
import { NotionResource, NotionResourcesResponse } from "@/shared/types";
import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Integration } from "@/context/Integrations";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { CountDisplay } from "./helpers/CountDisplay";
import { cn } from "@/lib/utils";

function NotionIntegrationCard({ integrationId, className }: { integrationId: string, className?: string }) {
    const [resources, setResources] = useState<NotionResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const oauthUrl = useOAuthUrl(Integration.NOTION);

    useEffect(() => {
        setIsLoading(true);
        const fetchResources = async () => {
            const response: NotionResourcesResponse = await BackendProvider.getNotionResources(integrationId);
            setResources(response.resources);
            setIsLoading(false);
        };
        fetchResources();
    }, [integrationId]);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={Integration.NOTION} />
            <CardContent>
                <NotionCardContent resources={resources} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function NotionCardContent({ resources, isLoading }: { resources: NotionResource[], isLoading: boolean }) {
    const numberOfPages = resources.filter(resource => resource.type === 'page').length;
    const numberOfDatabases = resources.filter(resource => resource.type === 'database').length;

    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <PagesCount numberOfPages={numberOfPages} isLoading={isLoading} />
            </div>
            <div className="flex items-center gap-2">
                <Database className="size-4" />
                <DatabaseCount numberOfDatabases={numberOfDatabases} isLoading={isLoading} />
            </div>
        </div>
    )
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
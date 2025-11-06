import { BackendProvider } from "@/services/backend";
import { BadgeCheckIcon, FileText, Database } from "lucide-react";
import { NotionResource, NotionResourcesResponse } from "@/shared/types";
import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { IntegrationTitle } from "../../pages/Automations/components/IntegrationTitle";
import { Integration } from "@/context/Integrations";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

function NotionIntegrationCard({ integrationId }: { integrationId: string }) {
    const [resources, setResources] = useState<NotionResource[]>([]);
    const [oauthUrl, setOauthUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const fetchResources = async () => {
            const response: NotionResourcesResponse = await BackendProvider.getNotionResources(integrationId);
            setResources(response.resources);
            setIsLoading(false);
        };
        fetchResources();
    }, [integrationId]);

    useEffect(() => {
        const fetchOAuthUrl = async () => {
            const notionResponse = await BackendProvider.requestNotionOAuthUrl();
            setOauthUrl(notionResponse.url);
        };
        fetchOAuthUrl();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <div className="flex justify-between">
                        <IntegrationTitle integration={Integration.NOTION} iconSize = "lg"/>
                        <Badge variant="secondary" className="text-primary-foreground">
                            <BadgeCheckIcon className="size-3 text-primary" />
                            Connected
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <NotionCardContent resources={resources} isLoading={isLoading} />
            </CardContent>
            <CardFooter>
                <Button variant="outline" onClick={() => { 
                    if (oauthUrl) {
                        window.open(oauthUrl, 'oauth-popup', 'width=600,height=700');
                    }
                }}>
                    Manage Connection
                </Button>
            </CardFooter>
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
    if (isLoading) {
        return <Skeleton className="w-[70px] h-4" />
    }
    return (
        <span>
            <span className="font-semibold text-foreground">{numberOfDatabases}</span> database{numberOfDatabases !== 1 ? 's' : ''}
        </span>
    )
}

function PagesCount({ numberOfPages, isLoading }: { numberOfPages: number, isLoading: boolean }) {
    if (isLoading) {
        return <Skeleton className="w-[70px] h-4" />
    }
    return (
        <span>
            <span className="font-semibold text-foreground">{numberOfPages}</span> page{numberOfPages !== 1 ? 's' : ''}
        </span>
    )
}



export default NotionIntegrationCard;
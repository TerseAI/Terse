import { BackendProvider } from "@/services/backend";
import { BadgeCheckIcon, FileText, Database } from "lucide-react";
import { NotionResource, NotionResourcesResponse } from "@/shared/types";
import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { IntegrationTitle } from "../../pages/Automations/components/IntegrationTitle";
import { Integration } from "@/context/Integrations";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

function NotionIntegrationCard({ integrationId }: { integrationId: string }) {
    const [resources, setResources] = useState<NotionResource[]>([]);
    const [oauthUrl, setOauthUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchResources = async () => {
            const response: NotionResourcesResponse = await BackendProvider.getNotionResources(integrationId);
            setResources(response.resources);
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

    const numberOfPages = resources.filter(resource => resource.type === 'page').length;
    const numberOfDatabases = resources.filter(resource => resource.type === 'database').length;

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
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <FileText className="size-4" />
                        <span>
                            <span className="font-semibold text-foreground">{numberOfPages}</span> page{numberOfPages !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Database className="size-4" />
                        <span>
                            <span className="font-semibold text-foreground">{numberOfDatabases}</span> database{numberOfDatabases !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
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

export default NotionIntegrationCard;
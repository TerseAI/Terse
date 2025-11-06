import { IntegrationTitle } from "@/pages/Automations/components/IntegrationTitle";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Integration } from "@/context/Integrations";
import { BadgeCheckIcon } from "lucide-react";
import { Button } from "../ui/button";
import { BackendProvider } from "@/services/backend";
import { useEffect, useState } from "react";
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";

function GmailIntegrationCard({ integrationStatus }: { integrationStatus: IntegrationsStatus }) {
    const [oauthUrl, setOauthUrl] = useState<string | null>(null);

    const gmailInstances = getIntegrationInstances(integrationStatus.integrations, Integration.GMAIL);
    const email = formatIntegrationDisplay(gmailInstances[0], Integration.GMAIL);

    useEffect(() => {
        const fetchOAuthUrl = async () => {
            const gmailResponse = await BackendProvider.requestGmailOAuthUrl();
            setOauthUrl(gmailResponse.url);
        };
        fetchOAuthUrl();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <div className="flex justify-between">
                        <IntegrationTitle integration={Integration.GMAIL} iconSize="lg" />
                        <Badge variant="secondary" className="text-primary-foreground">
                            <BadgeCheckIcon className="size-3 text-primary" />
                            Connected
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <GmailCardContent email={email} />
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

function GmailCardContent({ email }: { email: string | null }) {
    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground min-w-50">
            <span>{email || 'No email found'}</span>
        </div>
    )
}

export default GmailIntegrationCard;
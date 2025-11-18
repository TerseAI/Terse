import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/types"
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { cn } from "@/lib/utils";
import { Globe, Mail } from "lucide-react";

function ConfluenceIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const confluenceInstances = getIntegrationInstances(integrationStatus.integrations, IntegrationType.CONFLUENCE);
    const currentInstance = confluenceInstances.find(instance => instance.id === integrationId) || confluenceInstances[0];

    const userEmail = currentInstance.confluence_user_email;
    const baseUrl = currentInstance.base_url;

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.CONFLUENCE} />
            <CardContent>
                <ConfluenceCardContent userEmail={userEmail} baseUrl={baseUrl} />
            </CardContent>
        </Card>
    )
}

function ConfluenceCardContent({ userEmail, baseUrl }: { userEmail: string, baseUrl: string }) {
    return (
        <div className="grid grid-flow-row items-center gap-4 text-sm text-muted-foreground min-w-50">
            <div className="flex items-center gap-2">
                <Mail className="size-4" />
                <span>{userEmail || 'Unknown User Email'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Globe className="size-4" />
                <span>{baseUrl || 'Unknown Base URL'}</span>
            </div>
        </div>
    )
}

export default ConfluenceIntegrationCard;


import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { cn } from "@/lib/utils";
import { Globe, Mail } from "lucide-react";

function AtlassianIntegrationCard({ className }: { className?: string }) {
  

    const userEmail = currentInstance.email;
    const baseUrl = currentInstance.baseUrl;

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.ATLASSIAN} />
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

export default AtlassianIntegrationCard;


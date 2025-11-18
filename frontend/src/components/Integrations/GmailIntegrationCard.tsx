import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";

function GmailIntegrationCard({ className }: { className?: string }) {
    const oauthUrl = useOAuthUrl(IntegrationType.GMAIL);
    const gmailInstances = [] // getIntegrationInstances(integrationStatus.integrations, IntegrationType.GMAIL);
    const email = '' //formatIntegrationDisplay(gmailInstances[0], IntegrationType.GMAIL);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.GMAIL} />
            <CardContent>
                <GmailCardContent email={email} />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
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
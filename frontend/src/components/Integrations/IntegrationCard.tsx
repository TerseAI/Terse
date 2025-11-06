import { Integration } from "@/context/Integrations";
import NotionIntegrationCard from "./NotionIntegrationCard";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import GmailIntegrationCard from "./GmailIntegrationCard";
import { IntegrationsStatus } from "@/shared/types";

function IntegrationCard({ integration, integrationId, integrationStatus }: { integration: Integration, integrationId: string, integrationStatus: IntegrationsStatus }) {
    if (integration === Integration.NOTION_PAGE || integration === Integration.NOTION) {
        return (
            <NotionIntegrationCard integrationId={integrationId} />
        )
    } else if (integration === Integration.SLACK) {
        return (
            <div></div>
        )
    } else if (integration === Integration.LINEAR) {
        return (
            <div></div>
        )
    } else if (integration === Integration.JIRA) {
        return (
            <div></div>
        )
    } else if (integration === Integration.GITHUB) {
        return (
            <div></div>
        )
    } else if (integration === Integration.GMAIL) {
        return (
            <GmailIntegrationCard integrationStatus={integrationStatus} />
        )
    }
    console.error(`Unknown integration: ${integration}`);
    return (
        <>
        </>
    )
}

export function IntegrationCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Skeleton className="w-10 h-10" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Skeleton className="w-xs h-4 pb-2" />
                <Skeleton className="w-xs h-4 mt-2" />
            </CardContent>
            <CardFooter>
                <Skeleton className="w-xs h-8" />
            </CardFooter>
        </Card>
    )
}

export default IntegrationCard;
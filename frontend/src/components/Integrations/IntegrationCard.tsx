import { Integration } from "@/context/Integrations";
import NotionIntegrationCard from "./NotionIntegrationCard";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import GmailIntegrationCard from "./GmailIntegrationCard";
import SlackIntegrationCard from "./SlackIntegrationCard";
import LinearIntegrationCard from "./LinearIntegrationCard";
import GithubIntegrationCard from "./GithubIntegrationCard";
import ConfluenceIntegrationCard from "./ConfluenceIntegrationCard";
import FigmaIntegrationCard from "./FigmaIntegrationCard";
import { IntegrationsStatus } from "@/shared/types";

function IntegrationCard({ integration, integrationId, integrationStatus }: { integration: Integration, integrationId: string, integrationStatus: IntegrationsStatus }) {
    const cardClassName = "min-w-sm";
    
    if (integration === Integration.NOTION_PAGE || integration === Integration.NOTION) {
        return (
            <NotionIntegrationCard integrationId={integrationId} className={cardClassName} />
        )
    } else if (integration === Integration.SLACK) {
        return (
            <SlackIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        )
    } else if (integration === Integration.LINEAR) {
        return (
            <LinearIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        )
    } else if (integration === Integration.GITHUB) {
        return (
            <GithubIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        )
    } else if (integration === Integration.GMAIL) {
        return (
            <GmailIntegrationCard integrationStatus={integrationStatus} className={cardClassName} />
        )
    } else if (integration === Integration.CONFLUENCE) {
        return (
            <ConfluenceIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        )
    } else if (integration === Integration.FIGMA) {
        return (
            <FigmaIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
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
        <Card className="min-w-sm">
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
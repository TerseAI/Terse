import { IntegrationType } from "@/shared/Integrations"
import NotionIntegrationCard from "./NotionIntegrationCard";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import GmailIntegrationCard from "./GmailIntegrationCard";
import SlackIntegrationCard from "./SlackIntegrationCard";
import LinearIntegrationCard from "./LinearIntegrationCard";
import GithubIntegrationCard from "./GithubIntegrationCard";
import AtlassianIntegrationCard from "./AtlassianIntegrationCard";
import FigmaIntegrationCard from "./FigmaIntegrationCard";

function IntegrationCard({ integration }: { integration: IntegrationType }) {
    const cardClassName = "min-w-sm";

    console.log('integration in IntegrationCard', integration);
    
    switch (integration) {
        // case IntegrationType.NOTION:
        //     return (
        //         <NotionIntegrationCard integrationId={integrationId} className={cardClassName} />
        //     );
        // case IntegrationType.SLACK:
        //     return (
        //         <SlackIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        //     );
        // case IntegrationType.LINEAR:
        //     return (
        //         <LinearIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        //     );
        // case IntegrationType.GITHUB:
        //     return (
        //         <GithubIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        //     );
        case IntegrationType.GMAIL:
            return (
                <GmailIntegrationCard className={cardClassName} />
            );
        case IntegrationType.ATLASSIAN:
            return (
                <AtlassianIntegrationCard className={cardClassName} />
            );
        // case IntegrationType.FIGMA:
        //     return (
        //         <FigmaIntegrationCard integrationStatus={integrationStatus} integrationId={integrationId} className={cardClassName} />
        //     );
        // default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            // throw integration satisfies never;
    }
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
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
import PosthogIntegrationCard from "./PosthogIntegrationCard";
import LaunchDarklyIntegrationCard from "./LaunchDarklyIntegrationCard";
import DatadogIntegrationCard from "./DatadogIntegrationCard";

export interface IntegrationCardProps {
    className?: string;
    isActive?: boolean;
    stateToken?: string;
    compact?: boolean;
}

function IntegrationCard({ integration, isActive = true, stateToken, compact = false }: { integration: IntegrationType; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const cardClassName = compact ? "min-w-64 max-w-64" : "min-w-sm max-w-sm";

    switch (integration) {
        case IntegrationType.NOTION:
            return (
                <NotionIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.SLACK:
            return (
                <SlackIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.LINEAR:
            return (
                <LinearIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.GITHUB:
            return (
                <GithubIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.GMAIL:
            return (
                <GmailIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.ATLASSIAN:
            return (
                <AtlassianIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.FIGMA:
            return (
                <FigmaIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
            return null
        case IntegrationType.POSTHOG:
            return (
                <PosthogIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.LAUNCHDARKLY:
            return (
                <LaunchDarklyIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        case IntegrationType.DATADOG:
            return (
                <DatadogIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
            );
        default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            throw integration satisfies never;
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
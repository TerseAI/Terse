import { IntegrationType } from "terse-types/Integrations"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

import AttioIntegrationCard from "./AttioIntegrationCard"
import DatadogIntegrationCard from "./DatadogIntegrationCard"
import GithubIntegrationCard from "./GithubIntegrationCard"
import GmailIntegrationCard from "./GmailIntegrationCard"
import LaunchDarklyIntegrationCard from "./LaunchDarklyIntegrationCard"
import LinearIntegrationCard from "./LinearIntegrationCard"
import NotionIntegrationCard from "./NotionIntegrationCard"
import PosthogIntegrationCard from "./PosthogIntegrationCard"
import SlackIntegrationCard from "./SlackIntegrationCard"
import SnowflakeIntegrationCard from "./SnowflakeIntegrationCard"
import WorkOSIntegrationCard from "./WorkOSIntegrationCard"

export interface IntegrationCardProps {
    className?: string
    isActive?: boolean
    stateToken?: string
    compact?: boolean
}

function IntegrationCard({ integration, isActive = true, stateToken, compact = false }: { integration: IntegrationType; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const cardClassName = "min-w-sm max-w-sm"

    switch (integration) {
        case IntegrationType.NOTION:
            return <NotionIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.SLACK:
            return <SlackIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.LINEAR:
            return <LinearIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.GITHUB:
            return <GithubIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.GMAIL:
            return <GmailIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
            return null
        case IntegrationType.POSTHOG:
            return <PosthogIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.LAUNCHDARKLY:
            return <LaunchDarklyIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.DATADOG:
            return <DatadogIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.WORKOS:
            return <WorkOSIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.ATTIO:
            return <AttioIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.SNOWFLAKE:
            return <SnowflakeIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.WEBHOOK:
        case IntegrationType.WEBEVENT:
            return null
        default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            throw integration satisfies never
    }
}

export function IntegrationCardSkeleton() {
    return (
        <Card className="min-w-sm max-w-sm">
            {/* Header: matches IntegrationCardHeader with lg icon + title + badge */}
            <CardHeader>
                <CardTitle>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="w-24 h-5 rounded" />
                        </div>
                        <Skeleton className="w-24 h-6 rounded-full" />
                    </div>
                </CardTitle>
            </CardHeader>
            {/* Content: matches 2 IntegrationItem rows (Item size="sm" variant="outline") */}
            <CardContent className="space-y-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-border py-3 px-4">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3.5 w-1/2 rounded" />
                    </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-border py-3 px-4">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-2/3 rounded" />
                        <Skeleton className="h-3.5 w-2/5 rounded" />
                    </div>
                </div>
            </CardContent>
            {/* Footer: matches IntegrationCardFooter button */}
            <CardFooter>
                <Skeleton className="h-9 w-40 rounded-md" />
            </CardFooter>
        </Card>
    )
}

export default IntegrationCard

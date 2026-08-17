import { IntegrationType } from "terse-types/Integrations"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import ApolloIntegrationCard from "./ApolloIntegrationCard"
import AttioIntegrationCard from "./AttioIntegrationCard"
import DatadogIntegrationCard from "./DatadogIntegrationCard"
import GithubIntegrationCard from "./GithubIntegrationCard"
import GmailIntegrationCard from "./GmailIntegrationCard"
import GoogleSearchConsoleIntegrationCard from "./GoogleSearchConsoleIntegrationCard"
import HeyReachIntegrationCard from "./HeyReachIntegrationCard"
import HiggsfieldIntegrationCard from "./HiggsfieldIntegrationCard"
import LaunchDarklyIntegrationCard from "./LaunchDarklyIntegrationCard"
import LinearIntegrationCard from "./LinearIntegrationCard"
import MetaAdsIntegrationCard from "./MetaAdsIntegrationCard"
import NotionIntegrationCard from "./NotionIntegrationCard"
import PosthogIntegrationCard from "./PosthogIntegrationCard"
import ResendIntegrationCard from "./ResendIntegrationCard"
import SlackIntegrationCard from "./SlackIntegrationCard"
import SnowflakeIntegrationCard from "./SnowflakeIntegrationCard"
import WorkOSIntegrationCard from "./WorkOSIntegrationCard"

function IntegrationCard({
    integration,
    isActive = true,
    stateToken,
    compact = false,
    className
}: {
    integration: IntegrationType
    isActive?: boolean
    stateToken?: string
    compact?: boolean
    className?: string
}) {
    const cardClassName = cn(compact ? "w-full max-w-sm" : "w-full", className)

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
        case IntegrationType.GOOGLE_SEARCH_CONSOLE:
            return <GoogleSearchConsoleIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
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
        case IntegrationType.HEY_REACH:
            return <HeyReachIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.RESEND:
            return <ResendIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.APOLLO:
            return <ApolloIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.HIGGSFIELD:
            return <HiggsfieldIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.META_ADS:
            return <MetaAdsIntegrationCard className={cardClassName} isActive={isActive} stateToken={stateToken} compact={compact} />
        case IntegrationType.WEBHOOK:
        case IntegrationType.WEBMONITOR:
            return null
        default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            throw integration satisfies never
    }
}

export function IntegrationCardSkeleton({ compact = false }: { compact?: boolean }) {
    if (compact) {
        return (
            <div className="flex items-center gap-3 px-3 py-3.5">
                <Skeleton className="size-5 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
            </div>
        )
    }

    return (
        <Card className="w-full">
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

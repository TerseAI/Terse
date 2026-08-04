import { RadarIcon, WebhookIcon } from "lucide-react"
import { ConfigType } from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"

import {
    ApolloIcon,
    AttioIcon,
    CalendarClockIcon,
    DatadogIcon,
    GithubIcon,
    GmailIcon,
    GoogleSearchConsoleIcon,
    HeyReachIcon,
    LaunchDarklyIcon,
    LinearIcon,
    HiggsfieldIcon,
    MetaAdsIcon,
    NotionIcon,
    PosthogIcon,
    ResendIcon,
    SlackIcon,
    SnowflakeIcon,
    TerseIcon,
    WorkOSIcon
} from "@/modules/integrations/components/IntegrationIcons"

export function IconForConfigType({ type }: { type: ConfigType }) {
    switch (type) {
        case ConfigType.GITHUB:
            return <GithubIcon />
        case ConfigType.LINEAR_INPUT:
        case ConfigType.LINEAR_OUTPUT:
            return <LinearIcon />
        case ConfigType.SLACK:
        case ConfigType.SLACK_OUTPUT:
            return <SlackIcon />
        case ConfigType.GMAIL:
        case ConfigType.GMAIL_OUTPUT:
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            return <GmailIcon />
        case ConfigType.NOTION:
            return <NotionIcon />
        case ConfigType.POSTHOG:
            return <PosthogIcon />
        case ConfigType.LAUNCHDARKLY:
            return <LaunchDarklyIcon />
        case ConfigType.TIME_TRIGGER:
            return <CalendarClockIcon />
        case ConfigType.DATADOG:
            return <DatadogIcon />
        case ConfigType.WORKOS_INPUT:
        case ConfigType.WORKOS_OUTPUT:
            return <WorkOSIcon />
        case ConfigType.ATTIO_OUTPUT:
            return <AttioIcon />
        case ConfigType.SNOWFLAKE_OUTPUT:
            return <SnowflakeIcon />
        case ConfigType.WEBHOOK_INPUT:
            return <WebhookIcon />
        case ConfigType.WEBMONITOR:
            return <RadarIcon />
        case ConfigType.WEB:
        case ConfigType.IMAGE_EDIT:
        case ConfigType.MEMORY:
            return <TerseIcon />
        case ConfigType.HEY_REACH_INPUT:
            return <HeyReachIcon />
        case ConfigType.ATTIO_INPUT:
            return <AttioIcon />
        case ConfigType.RESEND_OUTPUT:
            return <ResendIcon />
        case ConfigType.APOLLO_OUTPUT:
            return <ApolloIcon />
        case ConfigType.GOOGLE_SEARCH_CONSOLE_OUTPUT:
            return <GoogleSearchConsoleIcon />
        case ConfigType.META_ADS_OUTPUT:
            return <MetaAdsIcon />
        case ConfigType.HIGGSFIELD_OUTPUT:
            return <HiggsfieldIcon />
        default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            throw type satisfies never
    }
}

export function IconForIntegration({ integration }: { integration: IntegrationType }) {
    switch (integration) {
        case IntegrationType.GITHUB:
            return <GithubIcon />
        case IntegrationType.LINEAR:
            return <LinearIcon />
        case IntegrationType.SLACK:
            return <SlackIcon />
        case IntegrationType.GMAIL:
            return <GmailIcon />
        case IntegrationType.NOTION:
            return <NotionIcon />
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
            return <CalendarClockIcon />
        case IntegrationType.WEBHOOK:
            return <WebhookIcon />
        case IntegrationType.WEBMONITOR:
            return <RadarIcon />
        case IntegrationType.POSTHOG:
            return <PosthogIcon />
        case IntegrationType.LAUNCHDARKLY:
            return <LaunchDarklyIcon />
        case IntegrationType.DATADOG:
            return <DatadogIcon />
        case IntegrationType.WORKOS:
            return <WorkOSIcon />
        case IntegrationType.ATTIO:
            return <AttioIcon />
        case IntegrationType.SNOWFLAKE:
            return <SnowflakeIcon />
        case IntegrationType.HEY_REACH:
            return <HeyReachIcon />
        case IntegrationType.RESEND:
            return <ResendIcon />
        case IntegrationType.APOLLO:
            return <ApolloIcon />
        case IntegrationType.GOOGLE_SEARCH_CONSOLE:
            return <GoogleSearchConsoleIcon />
        case IntegrationType.META_ADS:
            return <MetaAdsIcon />
        case IntegrationType.HIGGSFIELD:
            return <HiggsfieldIcon />
        default:
            throw integration satisfies never
    }
}

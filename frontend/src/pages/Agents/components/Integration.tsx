import {
    AttioIcon,
    CalendarClockIcon,
    ConfluenceIcon,
    DatadogIcon,
    FigmaIcon,
    GithubIcon,
    GmailIcon,
    JiraConfluenceIcon,
    JiraIcon,
    LaunchDarklyIcon,
    LinearIcon,
    NotionIcon,
    PosthogIcon,
    SlackIcon,
    TerseIcon,
    WorkOSIcon
} from "@/components/icons/IntegrationIcons"
import { ConfigType } from "@/shared/Configs"
import { IntegrationType } from "@/shared/Integrations"

export function IconForConfigType({ type }: { type: ConfigType }) {
    switch (type) {
        case ConfigType.GITHUB:
        case ConfigType.GITHUB_KB:
            return <GithubIcon />
        case ConfigType.LINEAR_INPUT:
        case ConfigType.LINEAR_OUTPUT:
        case ConfigType.LINEAR_KB:
            return <LinearIcon />
        case ConfigType.SLACK:
        case ConfigType.SLACK_OUTPUT:
        case ConfigType.SLACK_KB:
            return <SlackIcon />
        case ConfigType.GMAIL:
        case ConfigType.GMAIL_OUTPUT:
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            return <GmailIcon />
        case ConfigType.NOTION:
            return <NotionIcon />
        case ConfigType.FIGMA:
            return <FigmaIcon />
        case ConfigType.JIRA:
            return <JiraIcon />
        case ConfigType.CONFLUENCE:
            return <ConfluenceIcon />
        case ConfigType.POSTHOG:
            return <PosthogIcon />
        case ConfigType.LAUNCHDARKLY:
            return <LaunchDarklyIcon />
        case ConfigType.TIME_TRIGGER:
            return <CalendarClockIcon />
        case ConfigType.DATADOG:
            return <DatadogIcon />
        case ConfigType.TERSE:
            return <TerseIcon />
        case ConfigType.WORKOS_INPUT:
        case ConfigType.WORKOS_KB:
            return <WorkOSIcon />
        case ConfigType.ATTIO_OUTPUT:
            return <AttioIcon />
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
        case IntegrationType.FIGMA:
            return <FigmaIcon />
        case IntegrationType.ATLASSIAN:
            return <JiraConfluenceIcon />
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
            return <CalendarClockIcon />
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
        default:
            throw integration satisfies never
    }
}

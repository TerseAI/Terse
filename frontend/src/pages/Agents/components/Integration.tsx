import {
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
    WebBrowsingIcon
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
            return <GmailIcon />
        case ConfigType.NOTION_DATABASE:
        case ConfigType.NOTION_PAGE:
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
        case ConfigType.WEB_BROWSING:
            return <WebBrowsingIcon />
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
        default:
            throw integration satisfies never
    }
}

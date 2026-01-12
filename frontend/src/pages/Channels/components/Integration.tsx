import { ConfigType } from "@/shared/Configs";
import { IntegrationType } from "@/shared/Integrations";
import {
    GithubIcon,
    LinearIcon,
    SlackIcon,
    GmailIcon,
    NotionIcon,
    FigmaIcon,
    JiraIcon,
    ConfluenceIcon,
    JiraConfluenceIcon,
    PosthogIcon,
    CalendarClockIcon,
} from "@/components/icons/IntegrationIcons";

export function IconForConfigType({ type }: { type: ConfigType }) {
    switch (type) {
        case ConfigType.GITHUB:
        case ConfigType.GITHUB_KB:
            return <GithubIcon />;
        case ConfigType.LINEAR_INPUT:
        case ConfigType.LINEAR_OUTPUT:
            return <LinearIcon />;
        case ConfigType.SLACK:
            return <SlackIcon />;
        case ConfigType.GMAIL:
            return <GmailIcon />;
        case ConfigType.NOTION_DATABASE:
        case ConfigType.NOTION_PAGE:
            return <NotionIcon />;
        case ConfigType.FIGMA:
            return <FigmaIcon />;
        case ConfigType.JIRA:
            return <JiraIcon />;
        case ConfigType.CONFLUENCE:
            return <ConfluenceIcon />;
        case ConfigType.POSTHOG:
            return <PosthogIcon />;
        case ConfigType.TIME_TRIGGER:
            return <CalendarClockIcon />;        
        default:
            // Exhaustive check: TypeScript will error if any IntegrationType case is missing
            throw type satisfies never;
    }
}

export function IconForIntegration({ integration }: { integration: IntegrationType }) {
    switch (integration) {
        case IntegrationType.GITHUB:
            return <GithubIcon />;
        case IntegrationType.LINEAR:
            return <LinearIcon />;
        case IntegrationType.SLACK:
            return <SlackIcon />;
        case IntegrationType.GMAIL:
            return <GmailIcon />;
        case IntegrationType.NOTION:
            return <NotionIcon />;
        case IntegrationType.FIGMA:
            return <FigmaIcon />;
        case IntegrationType.ATLASSIAN:
            return <JiraConfluenceIcon />;
        case IntegrationType.TERSE:
        case IntegrationType.CRON_JOB:
            return <CalendarClockIcon />;
        case IntegrationType.POSTHOG:
            return <PosthogIcon />
        default:
            throw integration satisfies never;
    }
}

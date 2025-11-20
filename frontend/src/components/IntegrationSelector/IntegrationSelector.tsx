import { InputConfigSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { LinearIntegration } from './LinearIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
import { JiraIntegration } from './JiraIntegration';
import { ConfigType } from "@/shared/Configs";

export function IntegrationSelector(props: InputConfigSelectorProps) {
    switch (props.input.config?.configType || props.input.configType) {
        case ConfigType.GMAIL:
            return <GmailIntegration {...props} />;

        case ConfigType.NOTION_DATABASE:
        case ConfigType.NOTION_PAGE:
            return (
                <NotionIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.SLACK:
            return (
                <SlackIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.GITHUB:
            return (
                <GitHubIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.FIGMA:
            return (
                <FigmaIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.LINEAR:
            return (
                <LinearIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.JIRA:
            return (
                <JiraIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        case ConfigType.CONFLUENCE:
            return (
                <ConfluenceIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        default:
            throw new Error(`Unsupported config type: ${props.input.configType}`);
    }
}

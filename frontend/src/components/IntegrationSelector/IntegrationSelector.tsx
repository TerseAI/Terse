import { InputConfigSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { SlackOutputIntegration } from './SlackOutputIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
import { JiraIntegration } from './JiraIntegration';
import { ConfigType } from "@/shared/Configs";
import { LinearInputIntegration } from './LinearInputIntegration';
import { LinearOutputIntegration } from './LinearOutputIntegration';
import { TimeTriggerIntegration } from './TimeTriggerIntegration';

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

        case ConfigType.SLACK_OUTPUT:
            return (
                <SlackOutputIntegration
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

        case ConfigType.LINEAR_INPUT:
            return (
                <LinearInputIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );
        case ConfigType.LINEAR_OUTPUT:
            return (
                <LinearOutputIntegration
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
        
        case ConfigType.TIME_TRIGGER:
            return (
                <TimeTriggerIntegration
                    input={props.input}
                    variant={props.variant}
                    setConfig={props.setConfig}
                />
            );

        default:
            throw new Error(`Unsupported config type: ${props.input.configType}`);
    }
}

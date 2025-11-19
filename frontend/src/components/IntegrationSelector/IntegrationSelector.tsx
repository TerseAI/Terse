import { IntegrationType } from "@/shared/Integrations"
import { InputConfigSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { LinearIntegration } from './LinearIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
import { ConfigType } from "@/shared/Configs";

export function IntegrationSelector(props: InputConfigSelectorProps & { variant?: 'card' | 'dialog' }) {
    const { variant = 'card' } = props;

    switch (props.config.configType) {
        case ConfigType.GMAIL:
            return <GmailIntegration integrationType={props.config.integrationType} />;

        case ConfigType.NOTION_DATABASE, ConfigType.NOTION_PAGE:
            return (
                <NotionIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    notionConfig={props.notionConfig}
                    notionPageConfig={props.notionPageConfig}
                    onNotionConfigChange={props.onNotionConfigChange}
                    onNotionPageConfigChange={props.onNotionPageConfigChange}
                />
            );

        case ConfigType.SLACK:
            return (
                <SlackIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    slackConfig={props.slackConfig}
                    onSlackConfigChange={props.onSlackConfigChange}
                />
            );

        case ConfigType.GITHUB:
            return <GitHubIntegration
                integrationType={props.integrationType}
                githubConfig={props.githubConfig}
                onGithubConfigChange={props.onGithubConfigChange}
            />;

        case ConfigType.FIGMA:
            return (
                <FigmaIntegration
                    integrationType={props.integrationType}
                    figmaConfig={props.figmaConfig}
                    onFigmaConfigChange={props.onFigmaConfigChange}
                />
            );
        case ConfigType.LINEAR:
            return (
                <LinearIntegration
                />
            );

        case ConfigType.JIRA, ConfigType.CONFLUENCE:
            return (
                <ConfluenceIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    confluenceConfig={props.confluenceConfig}
                    onConfluenceConfigChange={props.onConfluenceConfigChange}
                />
            );

        default:
            throw props.config.configType satisfies never;
    }
}

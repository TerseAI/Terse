import { InputConfigSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { LinearIntegration } from './LinearIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
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

        // case ConfigType.SLACK:
        //     return (
        //         <SlackIntegration
        //             {...baseProps}
        //             integrationType={props.integrationType}
        //             slackConfig={props.slackConfig}
        //             onSlackConfigChange={props.onSlackConfigChange}
        //         />
        //     );

        // case ConfigType.GITHUB:
        //     return <GitHubIntegration
        //         integrationType={props.integrationType}
        //         githubConfig={props.githubConfig}
        //         onGithubConfigChange={props.onGithubConfigChange}
        //     />;

        // case ConfigType.FIGMA:
        //     return (
        //         <FigmaIntegration
        //             integrationType={props.integrationType}
        //             figmaConfig={props.figmaConfig}
        //             onFigmaConfigChange={props.onFigmaConfigChange}
        //         />
        //     );
        // case ConfigType.LINEAR:
        //     return (
        //         <LinearIntegration
        //         />
        //     );

        // case ConfigType.JIRA, ConfigType.CONFLUENCE:
        //     return (
        //         <ConfluenceIntegration
        //             {...baseProps}
        //             integrationType={props.integrationType}
        //             confluenceConfig={props.confluenceConfig}
        //             onConfluenceConfigChange={props.onConfluenceConfigChange}
        //         />
        //     );

        default:
            throw new Error(`Unsupported config type: ${props.input.configType}`);
    }
}

import { Integration } from "@/types/Integration";
import { BaseIntegrationProps, IntegrationSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { JiraIntegration } from './JiraIntegration';
import { LinearIntegration } from './LinearIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
import { useIntegrationSelector } from '../../hooks/useIntegrationSelector';

export function IntegrationSelector(props: IntegrationSelectorProps & { variant?: 'card' | 'dialog' }) {
    const { variant = 'card' } = props;
    const {
        integrations,
        isLoading,
        isConnecting,
        showForm,
        handleConnectNew,
        handleFormSuccess,
        handleFormCancel,
    } = useIntegrationSelector(props);

    const baseProps: BaseIntegrationProps = {
        selectedIntegrationId: props.selectedIntegrationId,
        onSelect: props.onSelect,
        integrations,
        isLoading,
        isConnecting,
        onConnect: handleConnectNew,
        label: props.label,
        variant,
    };

    switch (props.integrationType) {
        case Integration.GMAIL:
            return <GmailIntegration {...baseProps} integrationType={props.integrationType} />;

        case Integration.NOTION:
        case Integration.NOTION_PAGE:
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

        case Integration.SLACK:
            return (
                <SlackIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    slackConfig={props.slackConfig}
                    onSlackConfigChange={props.onSlackConfigChange}
                />
            );

        case Integration.GITHUB:
            return <GitHubIntegration
                {...baseProps}
                integrationType={props.integrationType}
                githubConfig={props.githubConfig}
                onGithubConfigChange={props.onGithubConfigChange}
            />;

        case Integration.FIGMA:
            return (
                <FigmaIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    figmaConfig={props.figmaConfig}
                    onFigmaConfigChange={props.onFigmaConfigChange}
                />
            );

        case Integration.JIRA:
            return (
                <JiraIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );

        case Integration.LINEAR:
            return (
                <LinearIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );

        case Integration.CONFLUENCE:
            return (
                <ConfluenceIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                    confluenceConfig={props.confluenceConfig}
                    onConfluenceConfigChange={props.onConfluenceConfigChange}
                />
            );

        default:
            return null;
    }
}

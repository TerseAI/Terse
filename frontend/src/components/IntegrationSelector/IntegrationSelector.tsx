import { IntegrationType } from "@/shared/Integrations"
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
import { useOAuthConnection } from "@/hooks/useOAuthConnection";

export function IntegrationSelector(props: IntegrationSelectorProps & { variant?: 'card' | 'dialog' }) {
    const { variant = 'card' } = props;
    const {
        showForm,
        handleFormSuccess,
        handleFormCancel,
    } = useIntegrationSelector(props);

    const { connect, isConnecting } = useOAuthConnection(props.integrationType);

    const baseProps: BaseIntegrationProps = {
        selectedIntegrationId: props.selectedIntegrationId,
        onSelect: props.onSelect,
        isConnecting,
        onConnect: connect,
        label: props.label,
        variant,
    };

    switch (props.integrationType) {
        case IntegrationType.GMAIL:
            return <GmailIntegration {...baseProps} integrationType={props.integrationType} />;

        case IntegrationType.NOTION:
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

        case IntegrationType.SLACK:
            return (
                <SlackIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    slackConfig={props.slackConfig}
                    onSlackConfigChange={props.onSlackConfigChange}
                />
            );

        case IntegrationType.GITHUB:
            return <GitHubIntegration
                {...baseProps}
                integrationType={props.integrationType}
                githubConfig={props.githubConfig}
                onGithubConfigChange={props.onGithubConfigChange}
            />;

        case IntegrationType.FIGMA:
            return (
                <FigmaIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    figmaConfig={props.figmaConfig}
                    onFigmaConfigChange={props.onFigmaConfigChange}
                />
            );

        case IntegrationType.JIRA:
            return (
                <JiraIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );

        case IntegrationType.LINEAR:
            return (
                <LinearIntegration
                    {...baseProps}
                    integrationType={props.integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );

        case IntegrationType.CONFLUENCE:
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

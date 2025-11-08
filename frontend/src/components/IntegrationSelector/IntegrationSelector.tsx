import { useEffect, useState } from 'react';
import { Integration } from '../../context/Integrations';
import { BackendProvider } from '../../services/backend';
import { getIntegrationInstances } from '../../utility/IntegrationUtils';
import { IntegrationSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { JiraIntegration } from './JiraIntegration';
import { LinearIntegration } from './LinearIntegration';
import { useOAuthConnection } from './useOAuthConnection';

export function IntegrationSelector(props: IntegrationSelectorProps) {
    const { integrationType, selectedIntegrationId, onSelect } = props;
    const [integrations, setIntegrations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(integrationType);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        fetchIntegrations();

        // Listen for OAuth completion messages
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'oauth-success') {
                fetchIntegrations();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [integrationType]);

    const fetchIntegrations = async () => {
        setIsLoading(true);
        try {
            const response = await BackendProvider.getIntegrationsStatus();
            const instances = getIntegrationInstances(response.integrations, integrationType);

            setIntegrations(instances);

            // Auto-select first integration if none is selected and we have options
            if (instances.length > 0 && !selectedIntegrationId) {
                onSelect(instances[0].id);
            }
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setIntegrations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectNew = async () => {
        // For Jira and Linear, show form instead of OAuth
        if (integrationType === Integration.JIRA || integrationType === Integration.LINEAR) {
            setShowForm(true);
            return;
        }

        setIsConnecting(true);
        await connectOAuth();
        setIsConnecting(false);
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        await fetchIntegrations();
    };

    const handleFormCancel = () => {
        setShowForm(false);
    };

    const baseProps = {
        selectedIntegrationId,
        onSelect,
        integrations,
        isLoading,
        isConnecting: isConnecting || isOAuthConnecting,
        onConnect: handleConnectNew,
        label: props.label
    };

    // Render integration-specific components
    switch (integrationType) {
        case Integration.GMAIL:
            return <GmailIntegration {...baseProps} integrationType={integrationType} />;
        
        case Integration.NOTION:
        case Integration.NOTION_PAGE:
            return (
                <NotionIntegration
                    {...baseProps}
                    integrationType={integrationType}
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
                    integrationType={integrationType}
                    slackConfig={props.slackConfig}
                    onSlackConfigChange={props.onSlackConfigChange}
                />
            );
        
        case Integration.GITHUB:
            return <GitHubIntegration {...baseProps} integrationType={integrationType} />;
        
        case Integration.FIGMA:
            return (
                <FigmaIntegration
                    {...baseProps}
                    integrationType={integrationType}
                    figmaConfig={props.figmaConfig}
                    onFigmaConfigChange={props.onFigmaConfigChange}
                />
            );
        
        case Integration.JIRA:
            return (
                <JiraIntegration
                    {...baseProps}
                    integrationType={integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );
        
        case Integration.LINEAR:
            return (
                <LinearIntegration
                    {...baseProps}
                    integrationType={integrationType}
                    showForm={showForm}
                    onFormSuccess={handleFormSuccess}
                    onFormCancel={handleFormCancel}
                />
            );
        
        default:
            return null;
    }
}


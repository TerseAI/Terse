import { useEffect, useState } from 'react';
import { Integration } from '../../context/Integrations';
import { BackendProvider } from '../../services/backend';
import { getIntegrationInstances, isInputComplete } from '../../utility/IntegrationUtils';
import { BaseIntegrationProps, IntegrationSelectorProps } from './types';
import { GmailIntegration } from './GmailIntegration';
import { NotionIntegration } from './NotionIntegration';
import { SlackIntegration } from './SlackIntegration';
import { GitHubIntegration } from './GitHubIntegration';
import { FigmaIntegration } from './FigmaIntegration';
import { JiraIntegration } from './JiraIntegration';
import { LinearIntegration } from './LinearIntegration';
import { ConfluenceIntegration } from './ConfluenceIntegration';
import { useOAuthConnection } from './useOAuthConnection';
import { IntegrationInstance } from '@/utility/IntegrationFormatters';

export function useIntegrationSelector(props: IntegrationSelectorProps): { 
    CardContent: () => React.ReactNode, 
    DialogContent: () => React.ReactNode,
    isConfigurationIncomplete: () => boolean
} {
    const { integrationType, selectedIntegrationId, onSelect } = props;
    const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
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
        // For Jira, Linear, and Confluence, show form instead of OAuth
        if (integrationType === Integration.JIRA || integrationType === Integration.LINEAR || integrationType === Integration.CONFLUENCE) {
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

    const baseProps: BaseIntegrationProps = {
        selectedIntegrationId,
        onSelect,
        integrations,
        isLoading,
        isConnecting: isConnecting || isOAuthConnecting,
        onConnect: handleConnectNew,
        label: props.label
    };

    // Create CardContent and DialogContent components
    const renderIntegration = (variant: 'card' | 'dialog') => {
        const variantProps = { ...baseProps, variant };
        
        switch (integrationType) {
            case Integration.GMAIL:
                return <GmailIntegration {...variantProps} integrationType={integrationType} />;
            
            case Integration.NOTION:
            case Integration.NOTION_PAGE:
                return (
                    <NotionIntegration
                        {...variantProps}
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
                        {...variantProps}
                        integrationType={integrationType}
                        slackConfig={props.slackConfig}
                        onSlackConfigChange={props.onSlackConfigChange}
                    />
                );
            
            case Integration.GITHUB:
                return <GitHubIntegration {...variantProps} integrationType={integrationType} />;
            
            case Integration.FIGMA:
                return (
                    <FigmaIntegration
                        {...variantProps}
                        integrationType={integrationType}
                        figmaConfig={props.figmaConfig}
                        onFigmaConfigChange={props.onFigmaConfigChange}
                    />
                );
            
            case Integration.JIRA:
                return (
                    <JiraIntegration
                        {...variantProps}
                        integrationType={integrationType}
                        showForm={showForm}
                        onFormSuccess={handleFormSuccess}
                        onFormCancel={handleFormCancel}
                    />
                );
            
            case Integration.LINEAR:
                return (
                    <LinearIntegration
                        {...variantProps}
                        integrationType={integrationType}
                        showForm={showForm}
                        onFormSuccess={handleFormSuccess}
                        onFormCancel={handleFormCancel}
                    />
                );
            
            case Integration.CONFLUENCE:
                return (
                    <ConfluenceIntegration
                        {...variantProps}
                        integrationType={integrationType}
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
    };

    const CardContent = () => renderIntegration('card');
    const DialogContent = () => renderIntegration('dialog');

    // Check if configuration is incomplete
    const isConfigurationIncomplete = () => {
        const input = {
            integration: props.integrationType,
            integrationId: props.selectedIntegrationId,
            notionConfig: props.notionConfig,
            notionPageConfig: props.notionPageConfig,
            slackConfig: props.slackConfig,
            figmaConfig: props.figmaConfig,
            gmailConfig: props.gmailConfig,
            confluenceConfig: props.confluenceConfig,
        };
        return !isInputComplete(input);
    };

    return { CardContent, DialogContent, isConfigurationIncomplete };
}


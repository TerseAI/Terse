import { useEffect, useState } from 'react';
import { IntegrationType } from "@/shared/Integrations"
import { isInputComplete } from '../utility/IntegrationUtils';
import { IntegrationSelectorProps } from '../components/IntegrationSelector/types';
import { useOAuthConnection } from './useOAuthConnection';
import { useIntegration } from './api/useIntegration';

export function useIntegrationSelector(props: IntegrationSelectorProps) {
    const { integrationType, selectedIntegrationId, onSelect } = props;
    // const { instances: IntegrationTypes, isLoading, mutate } = useIntegration(integrationType);
    const [showForm, setShowForm] = useState(false);
    
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(integrationType);
    const [isConnecting, setIsConnecting] = useState(false);

    // Auto-select first integration if none is selected and we have options
    useEffect(() => {
        if (integrations.length > 0 && !selectedIntegrationId) {
            onSelect(integrations[0].id);
        }
    }, [integrations, selectedIntegrationId, onSelect]);

    const handleConnectNew = async () => {
        // For Jira, Linear, and Confluence, show form instead of OAuth
        if (integrationType === IntegrationType.JIRA || integrationType === IntegrationType.LINEAR || integrationType === IntegrationType.CONFLUENCE) {
            setShowForm(true);
            return;
        }

        setIsConnecting(true);
        await connectOAuth();
        setIsConnecting(false);
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        await mutate();
    };

    const handleFormCancel = () => {
        setShowForm(false);
    };

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

    return {
        integrations,
        isLoading,
        isConnecting: isConnecting || isOAuthConnecting,
        showForm,
        isConfigurationIncomplete,
        handleConnectNew,
        handleFormSuccess,
        handleFormCancel,
    };
}

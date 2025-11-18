import { useEffect } from 'react';
import { IntegrationType } from '@/shared/types';
import { useIntegrations } from './useIntegrations';
import { getIntegrationInstances } from '@/utility/IntegrationUtils';
import { IntegrationInstance } from '@/utility/IntegrationFormatters';

export function useIntegration(integrationType: IntegrationType) {
    const { integrationStatus, isLoading, isError, mutate } = useIntegrations();

    // Transform the raw integration status to get instances for this specific integration type
    const instances: IntegrationInstance[] = integrationStatus
        ? getIntegrationInstances(integrationStatus.integrations, integrationType)
        : [];

    // Listen for OAuth completion messages and refetch when received
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'oauth-success') {
                mutate();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [mutate]);

    return {
        instances,
        isLoading,
        error: isError,
        mutate,
    };
}


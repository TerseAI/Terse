import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { IntegrationWithStatus } from '@/shared/Integrations';
import { integrationsKey } from '@/shared/InvalidationKeys';

export function useIntegrations() {
    const key = integrationsKey();

    const { data, error, isValidating, mutate } = useSWR<IntegrationWithStatus[]>(
        key,
        async () => {
            return BackendProvider.getAllIntegrations();
        }
    );

    const allIntegrations = data;
    const activeIntegrations = allIntegrations?.filter(integration => integration.isActive).map(integration => integration.integrationType) ?? [];
    const inactiveIntegrations = allIntegrations?.filter(integration => !integration.isActive).map(integration => integration.integrationType) ?? [];
    const isLoading = !data && !error;

    return {
        integrations: activeIntegrations,
        inactiveIntegrations,
        allIntegrations,
        integrationStatus: data,
        isLoading,
        isError: error,
        isValidating,
        mutate,
    };
}

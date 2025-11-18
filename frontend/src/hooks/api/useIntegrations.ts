import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { INTEGRATION_METADATA, IntegrationType } from '@/shared/Integrations';
import { integrationsKey } from '@/shared/InvalidationKeys';

export function useIntegrations() {
    const key = integrationsKey();

    const { data, error, isValidating, mutate } = useSWR<IntegrationType[]>(
        key,
        async () => {
            return BackendProvider.getActiveIntegrations();
        }
    );  

    const integrations = data ? data.map(integration => INTEGRATION_METADATA[integration]) : [];
    const isLoading = !data && !error;
    
    return {
        integrations,
        integrationStatus: data,
        isLoading,
        isError: error,
        isValidating,
        mutate,
    };
}

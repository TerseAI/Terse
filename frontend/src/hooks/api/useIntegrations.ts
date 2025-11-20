import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { IntegrationType } from '@/shared/Integrations';
import { integrationsKey } from '@/shared/InvalidationKeys';

export function useIntegrations() {
    const key = integrationsKey();

    const { data, error, isValidating, mutate } = useSWR<IntegrationType[]>(
        key,
        async () => {
            return BackendProvider.getActiveIntegrations();
        }
    );

    const integrations = data;
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

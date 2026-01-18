import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { DatadogIndexesResponse } from '@/shared/types';

type UseDatadogIndexesReturn = {
    indexes: DatadogIndexesResponse['indexes'];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
};

export function useDatadogIndexes(integrationId: string | null): UseDatadogIndexesReturn {
    const { data, error, isLoading } = useSWR<DatadogIndexesResponse>(
        integrationId ? `datadog-indexes-${integrationId}` : null,
        () => BackendProvider.getDatadogIndexes(integrationId!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    return {
        indexes: data?.indexes ?? [],
        isLoading,
        isError: Boolean(error),
        error,
    };
}

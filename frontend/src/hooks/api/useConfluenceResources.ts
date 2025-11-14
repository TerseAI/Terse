import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { ConfluenceResourcesResponse, UseConfluenceResourcesReturn } from '@/shared/types';
import { confluenceResourcesKey } from "@/shared/InvalidationKeys";

export function useConfluenceResources(integrationId: string | null | undefined): UseConfluenceResourcesReturn<KeyedMutator<ConfluenceResourcesResponse>> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<ConfluenceResourcesResponse>(
        confluenceResourcesKey(integrationId),
        integrationId ? () => BackendProvider.getConfluenceResources(integrationId) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    const loading = Boolean(integrationId) && (isLoading || (!data && !error));

    return {
        resources: data?.resources ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}


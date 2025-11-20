import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { AtlassianIntegration } from '@/shared/Integrations';
import { atlassianIntegrationsKey } from "@/shared/InvalidationKeys";
import { useOAuthSuccessListener } from '@/hooks/useOAuthSuccessListener';

type UseAtlassianIntegrationsReturn = {
    integrations: AtlassianIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<AtlassianIntegration[]>;
};

export function useAtlassianIntegrations(): UseAtlassianIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<AtlassianIntegration[]>(
        atlassianIntegrationsKey(),
        () => BackendProvider.getAtlassianIntegrations(),
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    useOAuthSuccessListener(mutate);

    const loading = (isLoading || (!data && !error));

    return {
        integrations: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}


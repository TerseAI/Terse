import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { LinearIntegration } from '@/shared/Integrations';
import { linearIntegrationsKey } from "@/shared/InvalidationKeys";

type UseLinearIntegrationsReturn = {
    integrations: LinearIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<LinearIntegration[]>;
};

export function useLinearIntegrations(): UseLinearIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<LinearIntegration[]>(
        linearIntegrationsKey(),
        () => BackendProvider.getLinearIntegrations(),
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

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


import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { FigmaIntegration } from '@/shared/Integrations';
import { figmaIntegrationsKey } from "@/shared/InvalidationKeys";

type UseFigmaIntegrationsReturn = {
    integrations: FigmaIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<FigmaIntegration[]>;
};

export function useFigmaIntegrations(): UseFigmaIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<FigmaIntegration[]>(
        figmaIntegrationsKey(),
        () => BackendProvider.getFigmaIntegrations(),
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


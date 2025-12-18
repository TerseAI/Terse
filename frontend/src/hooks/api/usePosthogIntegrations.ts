import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { PosthogIntegration } from '@/shared/Integrations';
import { posthogIntegrationsKey } from "@/shared/InvalidationKeys";
import { useOAuthSuccessListener } from '@/hooks/useOAuthSuccessListener';

type UsePosthogIntegrationsReturn = {
    integrations: PosthogIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<PosthogIntegration[]>;
};

export function usePosthogIntegrations(): UsePosthogIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<PosthogIntegration[]>(
        posthogIntegrationsKey(),
        () => BackendProvider.getPosthogIntegrations(),
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


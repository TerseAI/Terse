import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { GithubIntegration } from '@/shared/Integrations';
import { githubIntegrationsKey } from "@/shared/InvalidationKeys";
import { useOAuthSuccessListener } from '@/hooks/useOAuthSuccessListener';

type UseGithubIntegrationsReturn = {
    integrations: GithubIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<GithubIntegration[]>;
};

export function useGithubIntegrations(): UseGithubIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GithubIntegration[]>(
        githubIntegrationsKey(),
        () => BackendProvider.getGithubIntegrations(),
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


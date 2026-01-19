import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { LaunchDarklyIntegration } from '@/shared/Integrations';
import { launchdarklyIntegrationsKey } from "@/shared/InvalidationKeys";
import { useOAuthSuccessListener } from '@/hooks/useOAuthSuccessListener';

type UseLaunchdarklyIntegrationsReturn = {
    integrations: LaunchDarklyIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<LaunchDarklyIntegration[]>;
};

export function useLaunchdarklyIntegrations(): UseLaunchdarklyIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<LaunchDarklyIntegration[]>(
        launchdarklyIntegrationsKey(),
        () => BackendProvider.getLaunchDarklyIntegrations(),
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

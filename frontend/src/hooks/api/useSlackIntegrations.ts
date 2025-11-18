import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { SlackIntegration } from '@/shared/Integrations';
import { slackIntegrationsKey } from "@/shared/InvalidationKeys";

type UseSlackIntegrationsReturn = {
    integrations: SlackIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<SlackIntegration[]>;
};

export function useSlackIntegrations(): UseSlackIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<SlackIntegration[]>(
        slackIntegrationsKey(),
        () => BackendProvider.getSlackIntegrations(),
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


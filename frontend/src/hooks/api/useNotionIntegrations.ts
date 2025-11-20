import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { NotionIntegration } from '@/shared/Integrations';
import { notionIntegrationsKey } from "@/shared/InvalidationKeys";
import { useOAuthSuccessListener } from '@/hooks/useOAuthSuccessListener';

type UseNotionIntegrationsReturn = {
    integrations: NotionIntegration[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<NotionIntegration[]>;
};

export function useNotionIntegrations(): UseNotionIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<NotionIntegration[]>(
        notionIntegrationsKey(),
        () => BackendProvider.getNotionIntegrations(),
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


import useSWR, { type KeyedMutator } from "swr"
import type { NotionIntegration } from "terse-types/Integrations"
import { notionIntegrationsKey } from "terse-types/InvalidationKeys"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"

type UseNotionIntegrationsReturn = {
    integrations: NotionIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<NotionIntegration[]>
}

export function useNotionIntegrations(): UseNotionIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<NotionIntegration[]>(notionIntegrationsKey(), () => BackendProvider.getNotionIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    useOAuthSuccessListener(mutate)

    const loading = isLoading || (!data && !error)

    return {
        integrations: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

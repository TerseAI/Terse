import useSWR, { type KeyedMutator } from "swr"
import type { AtlassianIntegration } from "terse-types/Integrations"
import { atlassianIntegrationsKey } from "terse-types/InvalidationKeys"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"

type UseJiraIntegrationsReturn = {
    integrations: AtlassianIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<AtlassianIntegration[]>
}

export function useJiraIntegrations(): UseJiraIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<AtlassianIntegration[]>(atlassianIntegrationsKey(), () => BackendProvider.getAtlassianIntegrations(), {
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

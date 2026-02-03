import useSWR, { type KeyedMutator } from "swr"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"
import type { DatadogIntegration } from "@/shared/Integrations"
import { datadogIntegrationsKey } from "@/shared/InvalidationKeys"

type UseDatadogIntegrationsReturn = {
    integrations: DatadogIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<DatadogIntegration[]>
}

export function useDatadogIntegrations(): UseDatadogIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<DatadogIntegration[]>(datadogIntegrationsKey(), () => BackendProvider.getDatadogIntegrations(), {
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

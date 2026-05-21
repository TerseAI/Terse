import useSWR, { type KeyedMutator } from "swr"
import type { DatadogIntegration } from "terse-types/Integrations"
import { datadogIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

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

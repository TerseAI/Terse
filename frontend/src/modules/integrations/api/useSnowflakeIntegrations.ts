import useSWR, { type KeyedMutator } from "swr"
import type { SnowflakeIntegration } from "terse-types/Integrations"
import { snowflakeIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

type UseSnowflakeIntegrationsReturn = {
    integrations: SnowflakeIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<SnowflakeIntegration[]>
}

export function useSnowflakeIntegrations(): UseSnowflakeIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<SnowflakeIntegration[]>(snowflakeIntegrationsKey(), () => BackendProvider.getSnowflakeIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

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

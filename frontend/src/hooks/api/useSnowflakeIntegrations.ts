import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import type { SnowflakeIntegration } from "@/shared/Integrations"
import { snowflakeIntegrationsKey } from "@/shared/InvalidationKeys"

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

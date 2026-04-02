import useSWR from "swr"
import type { DatadogIndexesResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

type UseDatadogIndexesReturn = {
    indexes: DatadogIndexesResponse["indexes"]
    isLoading: boolean
    isError: boolean
    error: unknown
}

export function useDatadogIndexes(integrationId: string | null): UseDatadogIndexesReturn {
    const { data, error, isLoading } = useSWR<DatadogIndexesResponse>(integrationId ? `datadog-indexes-${integrationId}` : null, () => BackendProvider.getDatadogIndexes(integrationId!), {
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    return {
        indexes: data?.indexes ?? [],
        isLoading,
        isError: Boolean(error),
        error
    }
}

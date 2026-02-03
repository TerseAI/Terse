import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { confluenceResourcesKey } from "@/shared/InvalidationKeys"
import type { ConfluenceResourcesResponse, UseConfluenceResourcesReturn } from "@/shared/types"

export function useConfluenceResources(integrationId: string | null | undefined, search: string | null | undefined): UseConfluenceResourcesReturn<KeyedMutator<ConfluenceResourcesResponse>> {
    const shouldFetch = Boolean(integrationId)

    // Include search in key so SWR refetches when search changes
    const baseKey = confluenceResourcesKey(integrationId)
    const swrKey = shouldFetch && baseKey ? [...baseKey, search ?? ""] : null

    const { data, error, isLoading, isValidating, mutate } = useSWR<ConfluenceResourcesResponse>(
        swrKey,
        shouldFetch ? () => BackendProvider.getConfluenceResources(integrationId!, search ?? undefined) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true
        }
    )

    const loading = shouldFetch && (isLoading || (!data && !error))

    return {
        resources: data?.resources ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

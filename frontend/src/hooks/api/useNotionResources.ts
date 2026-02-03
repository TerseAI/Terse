import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { notionResourcesKey } from "@/shared/InvalidationKeys"
import type { NotionResource, NotionResourceType, NotionResourcesResponse } from "@/shared/types"

type UseNotionResourcesReturn = {
    resources: NotionResource[]
    response: NotionResourcesResponse | undefined
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<NotionResourcesResponse>
}

export function useNotionResources(integrationId: string | null | undefined, search: string | null | undefined, resourceType?: NotionResourceType): UseNotionResourcesReturn {
    const shouldFetch = Boolean(integrationId)

    // Include search and type in key so SWR refetches when they change
    const baseKey = notionResourcesKey(integrationId)
    const swrKey = shouldFetch && baseKey ? [...baseKey, search ?? "", resourceType ?? ""] : null

    const { data, error, isLoading, isValidating, mutate } = useSWR<NotionResourcesResponse>(
        swrKey,
        shouldFetch ? () => BackendProvider.getNotionResources(integrationId!, search ?? undefined, resourceType) : null,
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

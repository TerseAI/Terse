import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { attioObjectsKey } from "@/shared/InvalidationKeys"
import type { AttioObject } from "@/shared/types"

type UseAttioObjectsReturn = {
    objects: AttioObject[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<AttioObject[]>
}

export function useAttioObjects(integrationId: string | undefined): UseAttioObjectsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<AttioObject[]>(integrationId ? attioObjectsKey(integrationId) : null, () => BackendProvider.getAttioObjects(integrationId!), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    const loading = isLoading || (!data && !error && !!integrationId)

    return {
        objects: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

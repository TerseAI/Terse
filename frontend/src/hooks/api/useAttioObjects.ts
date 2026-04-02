import useSWR, { type KeyedMutator } from "swr"
import { attioObjectsKey } from "terse-types/InvalidationKeys"
import type { AttioObjectWithAttributes } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

type UseAttioObjectsReturn = {
    objects: AttioObjectWithAttributes[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<AttioObjectWithAttributes[]>
}

export function useAttioObjects(integrationId: string | undefined): UseAttioObjectsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<AttioObjectWithAttributes[]>(
        integrationId ? attioObjectsKey(integrationId) : null,
        () => BackendProvider.getAttioObjects(integrationId!),
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true
        }
    )

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

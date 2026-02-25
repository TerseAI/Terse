import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { userByIdKey } from "@/shared/InvalidationKeys"
import type { User } from "@/types/User"

type UseUserReturn = {
    user: User | null
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<User>
}

export function useUser(id: string | null | undefined): UseUserReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<User>(userByIdKey(id), id ? () => BackendProvider.getUserById(id) : null, {
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    const loading = Boolean(id) && (isLoading || (!data && !error))

    return {
        user: data ?? null,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

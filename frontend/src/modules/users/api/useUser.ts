import useSWR from "swr"
import { userByIdKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import type { User } from "@/types/User"

export function useUser(userId: string | null | undefined) {
    const { data, error, isLoading } = useSWR<User>(userByIdKey(userId), () => BackendProvider.getUserById(userId as string), { revalidateOnFocus: false })

    return {
        user: data ?? null,
        isLoading,
        isError: Boolean(error)
    }
}

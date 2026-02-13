import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { currentUserKey } from "@/shared/InvalidationKeys"
import type { User } from "@/types/User"

const SESSION_REFRESH_INTERVAL_MS = Number(import.meta.env.VITE_SESSION_REFRESH_INTERVAL_MS) || 240000 // Default: 4 minutes (for 5-minute access token duration)

export function useCurrentUser() {
    const { data, error, isLoading, mutate } = useSWR<User | null>(
        currentUserKey(),
        // Fetcher calls /api/me which triggers session refresh through auth middleware.
        // 401 errors propagate for redirect handling in AuthProvider.
        () => BackendProvider.getCurrentUser(),
        {
            revalidateOnFocus: false,
            refreshInterval: SESSION_REFRESH_INTERVAL_MS,
            refreshWhenHidden: true
        }
    )

    return {
        user: data ?? null,
        isLoading,
        isError: Boolean(error),
        error,
        mutate
    }
}

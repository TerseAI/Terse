import useSWR, { KeyedMutator } from "swr"
import { statsKey } from "terse-types/InvalidationKeys"
import { StatsInterval, StatsResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

export type UseStatsReturn = {
    stats: StatsResponse | null
    isLoading: boolean
    isError: Error | null
    mutate: KeyedMutator<StatsResponse>
}

// Get the user's timezone, with fallback to UTC
function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return "UTC"
    }
}

export function useStats(interval?: StatsInterval) {
    const timezone = getUserTimezone()

    const { data, error, isLoading, mutate } = useSWR<StatsResponse>(statsKey(timezone, interval), () => BackendProvider.getStats(timezone, interval), {
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    return {
        stats: data ?? null,
        isLoading,
        isError: error,
        mutate
    } as UseStatsReturn
}

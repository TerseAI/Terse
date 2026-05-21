import useSWR, { KeyedMutator } from "swr"
import { statsKey } from "terse-types/InvalidationKeys"
import { StatsInterval, StatsResponse } from "terse-types/types"

import { BackendProvider } from "@/lib/http"
import { getUserTimezone } from "@/utils/timezone"

type UseStatsReturn = {
    stats: StatsResponse | null
    isLoading: boolean
    isError: Error | null
    mutate: KeyedMutator<StatsResponse>
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

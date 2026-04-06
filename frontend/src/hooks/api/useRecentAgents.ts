import useSWR, { KeyedMutator } from "swr"
import { recentAgentsKey } from "terse-types/InvalidationKeys"
import type { RecentAgent } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

export type UseRecentAgentsReturn = {
    agents: RecentAgent[]
    isLoading: boolean
    isError: Error | null
    mutate: KeyedMutator<RecentAgent[]>
}

export function useRecentAgents(limit = 3) {
    const { data, error, isLoading, mutate } = useSWR<RecentAgent[]>(recentAgentsKey(limit), () => BackendProvider.getRecentAgents(limit), {
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    return {
        agents: data ?? [],
        isLoading,
        isError: error,
        mutate
    } as UseRecentAgentsReturn
}

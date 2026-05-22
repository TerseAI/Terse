import useSWR from "swr"
import { agentImprovementsKey } from "terse-types/InvalidationKeys"
import { GetAgentImprovementsResponse } from "terse-types/types"

import { BackendProvider } from "@/lib/http"

export function useAgentImprovements(agentId: string | null) {
    const key = agentImprovementsKey(agentId)

    const { data, error, isValidating, mutate } = useSWR<GetAgentImprovementsResponse>(
        key,
        agentId
            ? async () => {
                  return BackendProvider.getAgentImprovements(agentId)
              }
            : null
    )

    return {
        review: data?.review ?? null,
        improvements: data?.improvements ?? [],
        improvementsEnabled: data?.improvementsEnabled ?? true,
        isLoading: !!agentId && !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}

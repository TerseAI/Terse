import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { linearTeamsKey } from "@/shared/InvalidationKeys"
import type { LinearTeam } from "@/shared/types"

type UseLinearTeamsReturn = {
    teams: LinearTeam[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<LinearTeam[]>
}

export function useLinearTeams(integrationId: string | null | undefined): UseLinearTeamsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<LinearTeam[]>(linearTeamsKey(integrationId), integrationId ? () => BackendProvider.getLinearTeams(integrationId) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    const loading = Boolean(integrationId) && (isLoading || (!data && !error))

    return {
        teams: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

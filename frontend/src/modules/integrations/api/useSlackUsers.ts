import useSWR, { type KeyedMutator } from "swr"
import { slackUsersKey } from "terse-types/InvalidationKeys"
import type { SlackUserResponse, SlackUsersResponse } from "terse-types/types"

import { BackendProvider } from "@/lib/http"

type UseSlackUsersReturn = {
    users: SlackUserResponse[]
    response: SlackUsersResponse | undefined
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<SlackUsersResponse>
}

export function useSlackUsers(integrationId: string | null | undefined): UseSlackUsersReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<SlackUsersResponse>(slackUsersKey(integrationId), integrationId ? () => BackendProvider.getSlackUsers(integrationId) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    const loading = Boolean(integrationId) && (isLoading || (!data && !error))

    return {
        users: data?.users ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

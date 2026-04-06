import useSWR from "swr"
import { jiraResourcesKey } from "terse-types/InvalidationKeys"
import type { JiraResourcesResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

type UseJiraResourcesReturn = {
    projects: Array<{ id: string; key: string; name: string; projectTypeKey: string }>
    isLoading: boolean
    isError: boolean
    error: unknown
}

export function useJiraResources(integrationId: string | null): UseJiraResourcesReturn {
    const { data, error, isLoading } = useSWR<JiraResourcesResponse>(integrationId ? jiraResourcesKey(integrationId) : null, () => BackendProvider.getJiraResources(integrationId!), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    return {
        projects: data?.resources?.projects ?? [],
        isLoading: isLoading || (!data && !error && integrationId !== null),
        isError: Boolean(error),
        error
    }
}

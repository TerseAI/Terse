import useSWR, { type KeyedMutator } from "swr"

import { BackendProvider } from "@/services/backend"
import { githubRepositoriesKey } from "@/shared/InvalidationKeys"
import type { GetGithubRepositoriesForIntegrationResponse, Repository } from "@/shared/types"

type UseGithubResourcesReturn = {
    repositories: Repository[]
    response: GetGithubRepositoriesForIntegrationResponse | undefined
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<GetGithubRepositoriesForIntegrationResponse>
}

export function useGithubResources(installationId: number | null | undefined): UseGithubResourcesReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GetGithubRepositoriesForIntegrationResponse>(
        installationId ? githubRepositoriesKey(installationId) : null,
        installationId ? () => BackendProvider.getGithubRepositoriesForIntegration(installationId) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true
        }
    )

    const loading = isLoading || (!data && !error)

    return {
        repositories: data?.repositories ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

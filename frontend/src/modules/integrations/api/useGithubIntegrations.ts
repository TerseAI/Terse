import useSWR, { type KeyedMutator } from "swr"
import type { GithubIntegration } from "terse-types/Integrations"
import { githubIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UseGithubIntegrationsReturn = {
    integrations: GithubIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<GithubIntegration[]>
}

export function useGithubIntegrations(): UseGithubIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GithubIntegration[]>(githubIntegrationsKey(), () => BackendProvider.getGithubIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    useOAuthSuccessListener(mutate)

    const loading = isLoading || (!data && !error)

    return {
        integrations: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

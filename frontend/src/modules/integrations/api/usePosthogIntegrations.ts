import useSWR, { type KeyedMutator } from "swr"
import type { PosthogIntegration } from "terse-types/Integrations"
import { posthogIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UsePosthogIntegrationsReturn = {
    integrations: PosthogIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<PosthogIntegration[]>
}

export function usePosthogIntegrations(): UsePosthogIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<PosthogIntegration[]>(posthogIntegrationsKey(), () => BackendProvider.getPosthogIntegrations(), {
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

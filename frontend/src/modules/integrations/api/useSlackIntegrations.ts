import useSWR, { type KeyedMutator } from "swr"
import type { SlackIntegration } from "terse-types/Integrations"
import { slackIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UseSlackIntegrationsReturn = {
    integrations: SlackIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<SlackIntegration[]>
}

export function useSlackIntegrations(): UseSlackIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<SlackIntegration[]>(slackIntegrationsKey(), () => BackendProvider.getSlackIntegrations(), {
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

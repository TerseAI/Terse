import useSWR, { type KeyedMutator } from "swr"
import type { LinearIntegration } from "terse-types/Integrations"
import { linearIntegrationsKey } from "terse-types/InvalidationKeys"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"

type UseLinearIntegrationsReturn = {
    integrations: LinearIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<LinearIntegration[]>
}

export function useLinearIntegrations(): UseLinearIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<LinearIntegration[]>(linearIntegrationsKey(), () => BackendProvider.getLinearIntegrations(), {
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

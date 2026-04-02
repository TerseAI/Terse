import useSWR, { type KeyedMutator } from "swr"
import type { WorkOSIntegration } from "terse-types/Integrations"
import { workosIntegrationsKey } from "terse-types/InvalidationKeys"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"

type UseWorkOSIntegrationsReturn = {
    integrations: WorkOSIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<WorkOSIntegration[]>
}

export function useWorkOSIntegrations(): UseWorkOSIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<WorkOSIntegration[]>(workosIntegrationsKey(), () => BackendProvider.getWorkOSIntegrations(), {
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
